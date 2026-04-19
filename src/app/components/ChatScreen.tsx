import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChatListScreen } from "./ChatListScreen";
import { ChatRoomScreen } from "./ChatRoomScreen";
import { listChatRooms, listRoomMessages, sendChatMessage, type ChatRoomRecord } from "@/lib/chat";
import { useUserProfilePreview } from "@/app/context/UserProfilePreviewContext";
import { getProfileAvatar, subscribeProfileAvatarSync } from "@/lib/profileAvatarStore";
import { prefetchPublicProfileAvatars } from "@/lib/publicProfile";
import { createPaymentIntent } from "@/lib/payments";
import type { CurrencyCode } from "@/lib/currency";

export function getTotalUnreadCount(_items: ChatRoomRecord[]) {
  return 0;
}

export type ChatLaunchRequest = {
  chatId: string;
  nonce: number;
  /** When true, simulate a new participant joining a group via invite link. */
  fromInviteLink?: boolean;
};

type ChatScreenProps = {
  /** When nonce changes, opens that chat (e.g. from Explore Say Hi). */
  chatLaunch?: ChatLaunchRequest | null;
  myUserId?: string;
  openGroupChatNonce?: number;
  onChatLaunchConsumed?: () => void;
};

export function ChatScreen({
  chatLaunch = null,
  myUserId = "guest",
  openGroupChatNonce = 0,
  onChatLaunchConsumed,
}: ChatScreenProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { t } = useTranslation("common");
  const { openUserProfile } = useUserProfilePreview();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatRoomRecord[]>([]);
  const [avatarTick, setAvatarTick] = useState(0);
  const consumedLaunchNonce = useRef<number | null>(null);
  const displayName =
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim() ||
    "";

  const launchNonce = chatLaunch?.nonce ?? 0;
  const launchChatId = chatLaunch?.chatId;

  useEffect(() => {
    setChats(listChatRooms());
  }, [launchNonce, openGroupChatNonce]);

  useEffect(() => subscribeProfileAvatarSync(() => setAvatarTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const ids = new Set<string>();
        for (const chat of chats) {
          if (chat.type !== "direct") continue;
          const peer = chat.participantIds.find((id) => id !== myUserId && id.startsWith("user_"));
          if (peer) ids.add(peer);
        }
        if (!ids.size) return;
        await prefetchPublicProfileAvatars([...ids], token);
        if (!cancelled) setAvatarTick((n) => n + 1);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chats, myUserId, getToken]);

  useEffect(() => {
    if (!chatLaunch?.chatId) return;
    const nonce = chatLaunch.nonce;
    if (consumedLaunchNonce.current === nonce) return;
    consumedLaunchNonce.current = nonce;
    setChats(listChatRooms());
    setActiveChatId(chatLaunch.chatId);
    onChatLaunchConsumed?.();
  }, [chatLaunch, onChatLaunchConsumed]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  const activeMessages = useMemo(
    () => (activeChatId ? listRoomMessages(activeChatId) : []),
    [activeChatId, chats],
  );

  const chatListItems = useMemo(() => {
    return chats.map((chat) => {
      const peerId =
        chat.type === "direct"
          ? chat.participantIds.find((id) => id !== myUserId && id.startsWith("user_"))
          : undefined;
      const profileImageUrl = peerId ? getProfileAvatar(peerId) : undefined;
      return {
        ...chat,
        profileName: chat.type === "direct" ? chat.title : undefined,
        profileUserId: peerId,
        profileImageUrl,
        timeLabel: new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        participants: chat.participantIds,
      };
    });
  }, [chats, myUserId, avatarTick]);

  const directPeerClerkId =
    activeChat?.type === "direct"
      ? activeChat.participantIds.find((id) => id !== myUserId && id.startsWith("user_"))
      : undefined;
  const directPeerName = activeChat?.type === "direct" ? activeChat.title : undefined;

  let roomNode: ReactNode;
  if (activeChat) {
    roomNode = (
    <ChatRoomScreen
      chatId={activeChat.id}
      title={activeChat.title}
      type={activeChat.type}
      myUserId={myUserId}
      messages={activeMessages}
      onSendMessage={(chatId, text) => {
        const receiverId = activeChat.participantIds.find((id) => id !== myUserId) ?? "host";
        sendChatMessage({
          roomId: chatId,
          senderId: myUserId,
          receiverId,
          content: text,
          kind: "text",
        });
        setChats(listChatRooms());
      }}
      onSendActionMessage={(chatId, kind, content) => {
        const receiverId = activeChat.participantIds.find((id) => id !== myUserId) ?? "host";
        sendChatMessage({
          roomId: chatId,
          senderId: myUserId,
          receiverId,
          content,
          kind,
        });
        setChats(listChatRooms());
      }}
      participants={activeChat.participantIds}
      onInviteCompanion={(opts) => {
        const receiverId = activeChat.participantIds.find((id) => id !== myUserId) ?? "host";
        const name = displayName || t("chat.fallbackDisplayName");
        const line = t("chat.companionInviteLine", { name });
        const content = opts?.note ? `${line}\n\n${opts.note}` : line;
        sendChatMessage({
          roomId: activeChat.id,
          senderId: myUserId,
          receiverId,
          content,
          kind: "companion_invite",
        });
        setChats(listChatRooms());
      }}
      directPeerClerkId={directPeerClerkId}
      directPeerName={directPeerName}
      onOpenDirectPeerProfile={
        directPeerClerkId
          ? () =>
              openUserProfile({
                clerkId: directPeerClerkId,
                fallbackDisplayName: directPeerName ?? "",
                fallbackImageUrl: getProfileAvatar(directPeerClerkId),
              })
          : undefined
      }
      onCreatePaymentIntent={async ({ amount, currency }: { amount: number; currency: CurrencyCode }) => {
        const receiverId = activeChat.participantIds.find((id) => id !== myUserId) ?? "host";
        const token = await getToken({ template: "supabase" });
        if (!token) throw new Error("Sign in required");
        return createPaymentIntent({
          amount,
          currency,
          roomId: activeChat.id,
          receiverId,
          locale: navigator.language,
          accessToken: token,
        });
      }}
      onBack={() => setActiveChatId(null)}
    />
    );
  } else {
    roomNode = (
    <ChatListScreen
      items={chatListItems}
      onSelectChat={setActiveChatId}
      onOpenProfile={({ userId, name }) => {
        if (!userId.startsWith("user_")) return;
        openUserProfile({
          clerkId: userId,
          fallbackDisplayName: name,
          fallbackImageUrl: getProfileAvatar(userId),
        });
      }}
    />
    );
  }
  return roomNode;
}

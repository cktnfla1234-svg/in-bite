import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatListScreen } from "./ChatListScreen";
import { ChatRoomScreen } from "./ChatRoomScreen";
import { HostProfileScreen } from "./HostProfileScreen";
import { listChatRooms, listRoomMessages, sendChatMessage, type ChatRoomRecord } from "@/lib/chat";
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
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<{ userId: string; name: string } | null>(null);
  const [chats, setChats] = useState<ChatRoomRecord[]>([]);
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

  useEffect(() => {
    if (!launchNonce || !launchChatId) return;
    if (consumedLaunchNonce.current === launchNonce) return;
    consumedLaunchNonce.current = launchNonce;
    setChats(listChatRooms());
    setActiveChatId(launchChatId);
    onChatLaunchConsumed?.();
  }, [launchNonce, launchChatId, onChatLaunchConsumed]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  const activeMessages = useMemo(
    () => (activeChatId ? listRoomMessages(activeChatId) : []),
    [activeChatId, chats],
  );

  return activeProfile ? (
    <HostProfileScreen hostName={activeProfile.name} onBack={() => setActiveProfile(null)} />
  ) : activeChat ? (
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
  ) : (
    <ChatListScreen
      items={chats.map((chat) => ({
        ...chat,
        profileName:
          chat.type === "direct"
            ? chat.title
            : undefined,
        profileUserId:
          chat.type === "direct"
            ? chat.participantIds.find((id) => id !== myUserId)
            : undefined,
        timeLabel: new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        participants: chat.participantIds,
      }))}
      onSelectChat={setActiveChatId}
      onOpenProfile={setActiveProfile}
    />
  );
}

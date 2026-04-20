import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatListScreen } from "./ChatListScreen";
import { ChatRoomScreen } from "./ChatRoomScreen";
import {
  createGroupChatWithMembers,
  fetchGroupChatParticipantsRemote,
  hydrateChatRoomsFromRemote,
  fetchRemoteMessagesForRoom,
  isGroupRoomId,
  joinGroupChatRoomRemote,
  listChatRooms,
  listRoomMessages,
  mergeParticipantsIntoLocalGroupRoom,
  mergeRemoteMessagesIntoLocal,
  mergeSingleRemoteMessageFromPayload,
  parseDirectRoomPeers,
  sendChatMessage,
  syncChatMessageToSupabase,
  syncGroupChatRoomToSupabase,
  type ChatRoomRecord,
} from "@/lib/chat";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { useUserProfilePreview } from "@/app/context/UserProfilePreviewContext";
import { getProfileAvatar, subscribeProfileAvatarSync } from "@/lib/profileAvatarStore";
import { fetchPublicProfileByClerkId, prefetchPublicProfileAvatars } from "@/lib/publicProfile";
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
  onChatLaunchConsumed?: () => void;
};

export function ChatScreen({
  chatLaunch = null,
  myUserId = "guest",
  onChatLaunchConsumed,
}: ChatScreenProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { openUserProfile } = useUserProfilePreview();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatRoomRecord[]>([]);
  const [messageSyncTick, setMessageSyncTick] = useState(0);
  const [avatarTick, setAvatarTick] = useState(0);
  const [peerNameMap, setPeerNameMap] = useState<Record<string, string>>({});
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
  }, [launchNonce]);

  useEffect(() => {
    if (myUserId === "guest") return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const changed = await hydrateChatRoomsFromRemote(token, myUserId);
        if (!cancelled && changed) setChats(listChatRooms());
      } catch {
        // remote room hydration is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, myUserId]);

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
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const peerIds = [...new Set(
          chats
            .filter((chat) => chat.type === "direct")
            .map((chat) => chat.participantIds.find((id) => id !== myUserId && id.startsWith("user_")) || "")
            .filter(Boolean),
        )];
        if (!peerIds.length) return;
        const rows = await Promise.all(peerIds.map((id) => fetchPublicProfileByClerkId(id, token)));
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of rows) {
          const id = row?.clerk_id?.trim();
          const name = row?.display_name?.trim();
          if (id && name) next[id] = name;
        }
        if (Object.keys(next).length) {
          setPeerNameMap((prev) => ({ ...prev, ...next }));
        }
      } catch {
        // optional: keep existing local title fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chats, getToken, myUserId]);

  useEffect(() => {
    if (!chatLaunch?.chatId) return;
    const nonce = chatLaunch.nonce;
    if (consumedLaunchNonce.current === nonce) return;
    consumedLaunchNonce.current = nonce;
    const id = chatLaunch.chatId;
    setChats(listChatRooms());
    void (async () => {
      if (isGroupRoomId(id) && myUserId !== "guest") {
        try {
          const token = await getToken({ template: "supabase" });
          if (token) {
            const remote = await joinGroupChatRoomRemote(id, token);
            if (remote?.length) mergeParticipantsIntoLocalGroupRoom(id, remote);
            else mergeParticipantsIntoLocalGroupRoom(id, [myUserId]);
          } else {
            mergeParticipantsIntoLocalGroupRoom(id, [myUserId]);
          }
        } catch {
          mergeParticipantsIntoLocalGroupRoom(id, [myUserId]);
        }
        setChats(listChatRooms());
      }
      setActiveChatId(id);
      onChatLaunchConsumed?.();
    })();
  }, [chatLaunch, onChatLaunchConsumed, myUserId, getToken]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  const activeMessages = useMemo(
    () => (activeChatId ? listRoomMessages(activeChatId) : []),
    [activeChatId, chats, messageSyncTick],
  );

  /** Fetch + merge remote messages; Supabase Realtime INSERT + poll fallback. */
  useEffect(() => {
    if (!activeChatId || myUserId === "guest") return;
    let cancelled = false;
    let pollTimer: number | undefined;
    let channel: RealtimeChannel | null = null;
    let supabaseClient: ReturnType<typeof getSupabaseClient> | null = null;

    const pull = async () => {
      const token = await getToken({ template: "supabase" });
      if (!token || cancelled) return;
      const remote = await fetchRemoteMessagesForRoom(activeChatId, token);
      if (cancelled) return;
      if (mergeRemoteMessagesIntoLocal(activeChatId, remote)) {
        setMessageSyncTick((n) => n + 1);
        setChats(listChatRooms());
      }
    };

    void (async () => {
      await pull();
      if (cancelled) return;
      const token = await getToken({ template: "supabase" });
      if (!token || cancelled) return;
      supabaseClient = getSupabaseClient(token);
      if (!supabaseClient) return;
      channel = supabaseClient
        .channel(`room-messages:${activeChatId}:${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            if (String(row.room_id ?? "") !== activeChatId) return;
            if (mergeSingleRemoteMessageFromPayload(activeChatId, row)) {
              setMessageSyncTick((n) => n + 1);
              setChats(listChatRooms());
            }
          },
        )
        .subscribe();
      pollTimer = window.setInterval(() => void pull(), 12000);
    })();

    return () => {
      cancelled = true;
      if (pollTimer != null) window.clearInterval(pollTimer);
      if (supabaseClient && channel) void supabaseClient.removeChannel(channel);
    };
  }, [activeChatId, myUserId, getToken]);

  useEffect(() => {
    if (!activeChatId || !activeChat || activeChat.type !== "group" || myUserId === "guest") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const ids = await fetchGroupChatParticipantsRemote(activeChatId, token);
        if (ids?.length && !cancelled) {
          mergeParticipantsIntoLocalGroupRoom(activeChatId, ids);
          setChats(listChatRooms());
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeChatId, activeChat, myUserId, getToken]);

  const chatListItems = useMemo(() => {
    const myNameCandidates = new Set(
      [displayName, user?.fullName, user?.username, myUserId]
        .map((v) => (v ?? "").trim())
        .filter(Boolean),
    );
    return chats.map((chat) => {
      const peerId =
        chat.type === "direct"
          ? chat.participantIds.find((id) => id !== myUserId && id.startsWith("user_"))
          : undefined;
      const peerNameFromProfile = peerId ? peerNameMap[peerId] : undefined;
      const hasSelfTitle = myNameCandidates.has(chat.title?.trim() || "");
      const directTitle =
        peerNameFromProfile ||
        (chat.type === "direct" && hasSelfTitle && peerId ? peerId : chat.title);
      const profileImageUrl = peerId ? getProfileAvatar(peerId) : undefined;
      return {
        ...chat,
        title: chat.type === "direct" ? directTitle : chat.title,
        profileName: chat.type === "direct" ? directTitle : undefined,
        profileUserId: peerId,
        profileImageUrl,
        timeLabel: new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        participants: chat.participantIds,
      };
    });
  }, [chats, myUserId, avatarTick, displayName, user?.fullName, user?.username, peerNameMap]);

  const directPeerClerkId =
    activeChat?.type === "direct"
      ? activeChat.participantIds.find((id) => id !== myUserId && id.startsWith("user_"))
      : undefined;
  const directPeerName =
    activeChat?.type === "direct"
      ? (directPeerClerkId ? peerNameMap[directPeerClerkId] : undefined) || activeChat.title
      : undefined;

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
        const receiverId =
          activeChat.type === "group"
            ? (activeChat.participantIds.find((id) => id !== myUserId) ?? "group")
            : (activeChat.participantIds.find((id) => id !== myUserId) ?? "host");
        const msg = sendChatMessage({
          roomId: chatId,
          senderId: myUserId,
          receiverId,
          content: text,
          kind: "text",
        });
        setChats(listChatRooms());
        if (myUserId !== "guest") {
          void getToken({ template: "supabase" }).then((token) => {
            if (!token) return;
            void syncChatMessageToSupabase({
              roomId: chatId,
              senderId: myUserId,
              receiverId,
              content: text,
              accessToken: token,
              messageId: msg.id,
              kind: "text",
              createdAtISO: msg.createdAt,
              participantClerkIds: activeChat.participantIds,
            });
          });
        }
      }}
      onSendActionMessage={(chatId, kind, content) => {
        const receiverId =
          activeChat.type === "group"
            ? (activeChat.participantIds.find((id) => id !== myUserId) ?? "group")
            : (activeChat.participantIds.find((id) => id !== myUserId) ?? "host");
        const msg = sendChatMessage({
          roomId: chatId,
          senderId: myUserId,
          receiverId,
          content,
          kind,
        });
        setChats(listChatRooms());
        if (myUserId !== "guest") {
          void getToken({ template: "supabase" }).then((token) => {
            if (!token) return;
            void syncChatMessageToSupabase({
              roomId: chatId,
              senderId: myUserId,
              receiverId,
              content,
              accessToken: token,
              messageId: msg.id,
              kind,
              createdAtISO: msg.createdAt,
              participantClerkIds: activeChat.participantIds,
            });
          });
        }
      }}
      participants={activeChat.participantIds}
      onInviteCompanion={(opts) => {
        const receiverId =
          activeChat.type === "group"
            ? (activeChat.participantIds.find((id) => id !== myUserId) ?? "group")
            : (activeChat.participantIds.find((id) => id !== myUserId) ?? "host");
        const name = displayName || t("chat.fallbackDisplayName");
        const line = t("chat.companionInviteLine", { name });
        const content = opts?.note ? `${line}\n\n${opts.note}` : line;
        const msg = sendChatMessage({
          roomId: activeChat.id,
          senderId: myUserId,
          receiverId,
          content,
          kind: "companion_invite",
        });
        setChats(listChatRooms());
        if (myUserId !== "guest") {
          void getToken({ template: "supabase" }).then((token) => {
            if (!token) return;
            void syncChatMessageToSupabase({
              roomId: activeChat.id,
              senderId: myUserId,
              receiverId,
              content,
              accessToken: token,
              messageId: msg.id,
              kind: "companion_invite",
              createdAtISO: msg.createdAt,
              participantClerkIds: activeChat.participantIds,
            });
          });
        }
      }}
      onCopyChatInviteLink={async () => {
        const url = `${window.location.origin}/chat/${encodeURIComponent(activeChat.id)}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("chat.inviteLinkCopied"));
        } catch {
          toast.error(t("chat.inviteLinkCopyFailed"));
        }
      }}
      onStartGroupTripChat={
        activeChat.type === "direct"
          ? async () => {
              const peers = parseDirectRoomPeers(activeChat.id);
              if (!peers || !peers.includes(myUserId)) {
                toast.error(t("chat.groupTripCreateError"));
                return;
              }
              const title = activeChat.title?.trim() || t("chat.groupChatTitle");
              const roomId = createGroupChatWithMembers(peers, title);
              const sys = sendChatMessage({
                roomId,
                senderId: myUserId,
                receiverId: peers.find((p) => p !== myUserId) ?? "group",
                content: t("chat.groupTripOpenedSystem"),
                kind: "system",
              });
              setChats(listChatRooms());
              try {
                const token = await getToken({ template: "supabase" });
                if (token) {
                  await syncGroupChatRoomToSupabase(roomId, peers, token);
                  await syncChatMessageToSupabase({
                    roomId,
                    senderId: myUserId,
                    receiverId: peers.find((p) => p !== myUserId) ?? "group",
                    content: sys.content,
                    accessToken: token,
                    messageId: sys.id,
                    kind: "system",
                    createdAtISO: sys.createdAt,
                    participantClerkIds: peers,
                  });
                }
              } catch {
                /* ignore */
              }
              setActiveChatId(roomId);
              navigate(`/chat/${encodeURIComponent(roomId)}`);
              toast.success(t("chat.groupTripOpenedToast"));
            }
          : undefined
      }
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

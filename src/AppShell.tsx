"use client";

import { useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast, Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "@/app/components/BottomNav";
import { FloatingActionButton } from "@/app/components/FloatingActionButton";
import { ExploreScreen } from "@/app/components/ExploreScreen";
import { HomeScreen } from "@/app/components/HomeScreen";
import { ChatScreen, type ChatLaunchRequest } from "@/app/components/ChatScreen";
import { ProfileScreen } from "@/app/components/ProfileScreen";
import { CreateTourScreen } from "@/app/components/CreateTourScreen";
import { CreateDailyInbiteSheet } from "@/app/components/CreateDailyInbiteSheet";
import { AuthModal } from "@/app/components/AuthModal";
import { LoginPromptModal, type LoginPromptKind } from "@/app/components/LoginPromptModal";
import { PostSignupWelcomeModal } from "@/app/components/PostSignupWelcomeModal";
import { grantWelcomeReward, hasWelcomeRewardBeenGranted } from "@/lib/wallet";
import { PreferredCurrencyProvider } from "@/lib/PreferredCurrencyContext";
import { UserProfilePreviewProvider } from "@/app/context/UserProfilePreviewContext";
import {
  createGroupChatRoom,
  listRoomMessages,
  removeSyntheticChatRooms,
  sendChatMessage,
  startSayHiChat,
  syncChatMessageToSupabase,
  syncGroupChatRoomToSupabase,
} from "@/lib/chat";
import type { Experience } from "@/data/experiences";
import { ActivitySheet } from "@/app/components/ActivitySheet";
import { AppShellTabbarPadMotion } from "@/app/components/AppShellTabbarSafeArea";
import type { AppNotification } from "@/lib/notifications";
import {
  listNotifications,
  markNotificationRead,
  markNotificationReadRemote,
  mergeRemoteNotifications,
  removeDemoNotifications,
  subscribeNotificationChanges,
  subscribeNotificationsRealtime,
  unreadNotificationCount,
} from "@/lib/notifications";
import { playCrunchNotificationSound } from "@/lib/notificationSound";
import { getFcmDeviceToken } from "@/lib/pushNotifications";
import { updateProfileDeviceToken } from "@/lib/profile";
import { subscribeWebPush } from "@/lib/pwaPush";
import { clearCreateTourDraft, hasCreateTourDraft } from "@/lib/createTourDraft";

type Tab = "home" | "explore" | "chat" | "profile";

type AppShellProps = {
  isSignedIn?: boolean;
  /** Clerk user id — used for per-user welcome reward + new-signup welcome modal. */
  welcomeClerkUserId?: string | null;
  /** Clerk `user.createdAt` — welcome modal only if the account was just created. */
  welcomeClerkAccountCreatedAt?: Date | string | number | null;
  /** Deep-link target room id, e.g. /chat/:roomId */
  initialChatRoomId?: string | null;
  /** When Clerk + Supabase JWT template are configured (signed-in routes only). */
  getSupabaseToken?: () => Promise<string | null>;
  /** Optional initial tab for deep links. */
  initialTab?: Tab;
  /** Optional initial explore section for deep links. */
  initialExploreSection?: "invitations" | "dailyBites";
  /** Optional initial post id for /daily-bite/:postId deep links. */
  initialDailyPostId?: string | null;
};

const NEW_ACCOUNT_MAX_AGE_MS = 30 * 60 * 1000;

function parseClerkCreatedAt(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isBrandNewClerkAccount(createdAt: Date | null) {
  if (!createdAt) return false;
  const t = createdAt.getTime();
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  return ageMs >= 0 && ageMs <= NEW_ACCOUNT_MAX_AGE_MS;
}

export default function AppShell({
  isSignedIn = false,
  welcomeClerkUserId = null,
  welcomeClerkAccountCreatedAt = null,
  initialChatRoomId = null,
  getSupabaseToken,
  initialTab = "home",
  initialExploreSection = "invitations",
  initialDailyPostId = null,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRestoreDraft, setCreateRestoreDraft] = useState(false);
  const [createDraftPromptOpen, setCreateDraftPromptOpen] = useState(false);
  const [createDailyInbiteOpen, setCreateDailyInbiteOpen] = useState(false);
  const [authState, setAuthState] = useState<{
    open: boolean;
    initialAuthView: boolean;
    initialMode: "default" | "sign-up" | "log-in";
  }>({
    open: false,
    initialAuthView: false,
    initialMode: "default",
  });
  const [searchCity, setSearchCity] = useState("");
  const [searchTaste, setSearchTaste] = useState<string | null>(null);
  const [exploreSection, setExploreSection] = useState<"invitations" | "dailyBites">(initialExploreSection);
  const [dailyBiteEditModalOpen, setDailyBiteEditModalOpen] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState<{ open: boolean; kind: LoginPromptKind }>({
    open: false,
    kind: "chat",
  });
  const [postSignupOpen, setPostSignupOpen] = useState(false);
  const [rewardAnim, setRewardAnim] = useState(false);
  const [showHomeQuickAction, setShowHomeQuickAction] = useState(false);
  const [showHomeNotificationBar, setShowHomeNotificationBar] = useState(false);
  const [chatLaunch, setChatLaunch] = useState<ChatLaunchRequest | null>(null);
  const [isConnectingChat, setIsConnectingChat] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const [pendingDailyPostId, setPendingDailyPostId] = useState<string | null>(initialDailyPostId);
  const seenToastNotificationIds = useState(() => new Set<string>())[0];
  const chatUnreadCount = 0;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const { user } = useUser();
  const tabScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7638/ingest/05bfdf68-9e16-4df7-9d1c-8885890e8915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'846e91'},body:JSON.stringify({sessionId:'846e91',runId:'run1',hypothesisId:'H0',location:'src/AppShell.tsx:mount',message:'AppShell mounted for debug session',data:{path:typeof window!=='undefined'?window.location.pathname:'',isSignedIn},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [isSignedIn]);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (el) el.scrollTop = 0;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab, exploreSection]);

  const handleSearch = (query: string, taste?: string | null) => {
    setSearchCity(query);
    setSearchTaste(taste ?? null);
    setExploreSection("invitations");
    setActiveTab("explore");
    if (location.pathname !== "/explore") navigate("/explore");
  };

  const handleCardClick = (id: string) => {
    console.log("card clicked:", id);
  };

  const openCreateTourFlow = useCallback(() => {
    const clerkId = welcomeClerkUserId ?? "guest";
    // Open immediately so FAB click always has visible feedback.
    // If a draft exists, restore it directly in the sheet.
    setCreateDraftPromptOpen(false);
    setCreateRestoreDraft(hasCreateTourDraft(clerkId));
    setCreateOpen(true);
  }, [welcomeClerkUserId]);

  const openSayHiChat = async (hostId: string, hostName: string) => {
    if (!requireAuth("chat")) return;
    const meId = welcomeClerkUserId ?? "guest";
    const meName = "Traveler";
    const locale = typeof navigator !== "undefined" ? navigator.language : "en";
    setIsConnectingChat(true);
    try {
      const accessToken = getSupabaseToken ? await getSupabaseToken() : null;
      const { roomId } = await startSayHiChat({
        meId,
        meName,
        hostId,
        hostName,
        locale,
        accessToken: accessToken ?? undefined,
      });
      setChatLaunch({ chatId: roomId, nonce: Date.now() });
      setActiveTab("chat");
      navigate(`/chat/${encodeURIComponent(roomId)}`);
    } finally {
      setIsConnectingChat(false);
    }
  };

  const openBookingChat = async (experience: Experience) => {
    if (!requireAuth("booking")) return;
    const hostId = experience.hostClerkId?.trim();
    if (!hostId) return;
    if (hostId === (welcomeClerkUserId ?? "").trim()) {
      toast.error(t("inviteDetail.bookOwnError"));
      return;
    }

    const meId = welcomeClerkUserId ?? "guest";
    const meName = "Traveler";
    const locale = typeof navigator !== "undefined" ? navigator.language : "en";
    const bookingIntro = t("inviteDetail.bookingIntroMessage", { title: experience.title });
    setIsConnectingChat(true);
    try {
      const accessToken = getSupabaseToken ? await getSupabaseToken() : null;
      const { roomId } = await startSayHiChat({
        meId,
        meName,
        hostId,
        hostName: experience.hostName,
        locale,
        accessToken: accessToken ?? undefined,
      });

      const roomMessages = listRoomMessages(roomId);
      const hasSameIntro = roomMessages.some((message) => message.senderId === meId && message.content === bookingIntro);
      if (!hasSameIntro) {
        const msg = sendChatMessage({
          roomId,
          senderId: meId,
          receiverId: hostId,
          content: bookingIntro,
          kind: "text",
        });
        if (accessToken) {
          await syncChatMessageToSupabase({
            roomId,
            senderId: meId,
            receiverId: hostId,
            content: bookingIntro,
            accessToken,
            messageId: msg.id,
            kind: "text",
            createdAtISO: msg.createdAt,
            participantClerkIds: [meId, hostId],
          });
        }
      }

      setChatLaunch({ chatId: roomId, nonce: Date.now() });
      setActiveTab("chat");
      navigate(`/chat/${encodeURIComponent(roomId)}`);
    } finally {
      setIsConnectingChat(false);
    }
  };

  const isGuest = useMemo(() => !isSignedIn, [isSignedIn]);

  useEffect(() => {
    if (!welcomeClerkUserId) return;
    removeDemoNotifications(welcomeClerkUserId);
    removeSyntheticChatRooms();
    setActivityTick((t) => t + 1);
  }, [welcomeClerkUserId]);

  useEffect(() => {
    if (!welcomeClerkUserId) return;
    return subscribeNotificationChanges(() => setActivityTick((t) => t + 1));
  }, [welcomeClerkUserId]);

  useEffect(() => {
    if (!isSignedIn || !welcomeClerkUserId || !getSupabaseToken) return;
    void (async () => {
      try {
        const token = await getSupabaseToken();
        if (token) await mergeRemoteNotifications(welcomeClerkUserId, token);
        setActivityTick((t) => t + 1);
      } catch {
        // ignore
      }
    })();
  }, [getSupabaseToken, isSignedIn, welcomeClerkUserId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const payload = event.data as { type?: string; chatId?: string; postId?: string; url?: string } | null;
      if (!payload?.type) return;
      if (payload.type === "OPEN_CHAT" && payload.chatId) {
        if (createOpen) setCreateOpen(false);
        setActiveTab("chat");
        setChatLaunch({ chatId: payload.chatId, nonce: Date.now() });
        navigate(`/chat/${encodeURIComponent(payload.chatId)}`);
        return;
      }
      if (payload.type === "OPEN_POST" && payload.postId) {
        if (createOpen) setCreateOpen(false);
        setPendingDailyPostId(payload.postId);
        setExploreSection("dailyBites");
        setActiveTab("explore");
        navigate(`/app?openPost=${encodeURIComponent(payload.postId)}`);
        return;
      }
      if (payload.type === "OPEN_URL" && payload.url) {
        navigate(payload.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  useEffect(() => {
    if (!isSignedIn || !welcomeClerkUserId || !getSupabaseToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getSupabaseToken();
        if (!token || cancelled) return;
        await subscribeWebPush(token, welcomeClerkUserId);
      } catch {
        // push subscription is optional in unsupported browsers
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabaseToken, isSignedIn, welcomeClerkUserId]);

  useEffect(() => {
    if (!isSignedIn || !welcomeClerkUserId || !getSupabaseToken) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getSupabaseToken();
        if (!token || cancelled) return;
        unsub = subscribeNotificationsRealtime(
          welcomeClerkUserId,
          token,
          () => setActivityTick((t) => t + 1),
          (eventType, n) => {
            if (eventType !== "INSERT" || !n || n.read) return;
            if (seenToastNotificationIds.has(n.id)) return;
            seenToastNotificationIds.add(n.id);
            playCrunchNotificationSound();
            const icon = n.type === "like" ? "❤️" : n.type === "comment" || n.type === "reply" ? "💬" : "👍";
            toast.custom(
              () => (
                <div className="flex items-center gap-2 rounded-xl border border-[#E9D8C8] bg-[#FFFCF7] px-3 py-2 shadow-[0_12px_30px_rgba(44,26,14,0.12)]">
                  <span className="text-[15px] text-[#A0522D]">{icon}</span>
                  <span className="text-[13px] font-medium text-[#2C1A0E]">{n.content}</span>
                </div>
              ),
              { duration: 2000, position: "top-center" },
            );
          },
        );
      } catch {
        // Realtime not enabled or table missing
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [getSupabaseToken, isSignedIn, welcomeClerkUserId]);

  useEffect(() => {
    if (!isSignedIn || !welcomeClerkUserId || !getSupabaseToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getSupabaseToken();
        if (!token || cancelled) return;
        const deviceToken = await getFcmDeviceToken();
        if (!deviceToken || cancelled) return;
        await updateProfileDeviceToken(welcomeClerkUserId, token, deviceToken);
      } catch {
        // Optional bootstrap only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabaseToken, isSignedIn, welcomeClerkUserId]);

  const activityUnreadCount = welcomeClerkUserId ? unreadNotificationCount(welcomeClerkUserId) : 0;
  const activityItems = useMemo(
    () => (welcomeClerkUserId ? listNotifications(welcomeClerkUserId) : []),
    [welcomeClerkUserId, activityTick],
  );

  const handleOpenActivity = () => {
    if (!requireAuth("sharing")) return;
    setActivityOpen(true);
    setShowHomeNotificationBar(false);
  };

  const handleActivitySelect = (item: AppNotification) => {
    void (async () => {
      if (welcomeClerkUserId) {
        markNotificationRead(welcomeClerkUserId, item.id);
        setActivityTick((t) => t + 1);
        if (getSupabaseToken) {
          try {
            const token = await getSupabaseToken();
            if (token) await markNotificationReadRemote(token, item.id);
          } catch {
            // ignore
          }
        }
      }
      setActivityOpen(false);
      if (item.post_id) {
        setPendingDailyPostId(item.post_id);
        setExploreSection("dailyBites");
        setActiveTab("explore");
      }
    })();
  };

  const requireAuth = (kind: LoginPromptKind) => {
    if (!isGuest) return true;
    setLoginPrompt({ open: true, kind });
    return false;
  };

  useEffect(() => {
    if (!isSignedIn || !welcomeClerkUserId) {
      setPostSignupOpen(false);
      return;
    }
    const created = parseClerkCreatedAt(welcomeClerkAccountCreatedAt);
    if (!isBrandNewClerkAccount(created)) {
      setPostSignupOpen(false);
      return;
    }
    if (hasWelcomeRewardBeenGranted(welcomeClerkUserId)) return;
    setPostSignupOpen(true);
  }, [isSignedIn, welcomeClerkUserId, welcomeClerkAccountCreatedAt]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/chat/")) {
      setCreateOpen(false);
      setPendingDailyPostId(null);
      setActiveTab("chat");
      return;
    }
    if (path.startsWith("/daily-bite/")) {
      setCreateOpen(false);
      const rawPostId = path.split("/daily-bite/")[1] ?? "";
      const decodedPostId = decodeURIComponent(rawPostId);
      if (decodedPostId) setPendingDailyPostId(decodedPostId);
      setExploreSection("dailyBites");
      setActiveTab("explore");
      return;
    }
    if (path.startsWith("/explore")) {
      setCreateOpen(false);
      setPendingDailyPostId(null);
      setActiveTab("explore");
      return;
    }
    if (path === "/messages") {
      setCreateOpen(false);
      setPendingDailyPostId(null);
      setActiveTab("chat");
      return;
    }
    if (path === "/profile") {
      setCreateOpen(false);
      setPendingDailyPostId(null);
      setActiveTab("profile");
      return;
    }
    if (path === "/app") {
      setCreateOpen(false);
      setPendingDailyPostId(null);
      setActiveTab("home");
      return;
    }
  }, [location.pathname]);

  const handleChatLaunchConsumed = useCallback(() => {
    setChatLaunch(null);
  }, []);

  useEffect(() => {
    if (!initialChatRoomId) return;
    setActiveTab("chat");
    setChatLaunch({ chatId: initialChatRoomId, nonce: Date.now() });
  }, [initialChatRoomId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const openPost = params.get("openPost");
    if (!openPost) return;
    setPendingDailyPostId(openPost);
    setExploreSection("dailyBites");
    setActiveTab("explore");
  }, []);

  useEffect(() => {
    if (activeTab !== "home") {
      setShowHomeQuickAction(false);
      return;
    }

    setShowHomeQuickAction(true);
    let hide = window.setTimeout(() => setShowHomeQuickAction(false), 2800);
    const cycle = window.setInterval(() => {
      setShowHomeQuickAction(true);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setShowHomeQuickAction(false), 2800);
    }, 9000);

    return () => {
      window.clearTimeout(hide);
      window.clearInterval(cycle);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "home") {
      setShowHomeNotificationBar(false);
      return;
    }
    if (!activityUnreadCount) {
      setShowHomeNotificationBar(false);
      return;
    }
    setShowHomeNotificationBar(true);
    const timer = window.setTimeout(() => setShowHomeNotificationBar(false), 3000);
    return () => window.clearTimeout(timer);
  }, [activeTab, activityUnreadCount]);

  const tabPanelClass = (tab: Tab) =>
    activeTab === tab ? "block w-full min-h-0 flex-1 flex flex-col" : "hidden";
  const isCreateModalOpen = createOpen || createDailyInbiteOpen;
  const showFloatingActionButton =
    activeTab !== "chat" && !dailyBiteEditModalOpen && !isCreateModalOpen && !createDraftPromptOpen;

  return (
    <PreferredCurrencyProvider>
    <UserProfilePreviewProvider
      getSupabaseToken={getSupabaseToken}
      onSayHiHost={({ hostId, hostName }) => void openSayHiChat(hostId, hostName)}
      currentUserClerkId={welcomeClerkUserId}
    >
    <div className="relative box-border flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#FDFAF5] pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))]">
      <Toaster
        richColors={false}
        toastOptions={{
          duration: 2000,
          style: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
          },
        }}
      />
      <div
        ref={tabScrollRef}
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [flex-basis:0]"
      >
        {/* Keep all tab roots mounted (display toggle) so Daily Bite / Framer exit cannot leave other tabs painting nothing. */}
        <div className="relative flex min-h-full w-full flex-col">
          <div className={tabPanelClass("home")}>
            <HomeScreen
              isSignedIn={isSignedIn}
              onOpenAuth={() =>
                setAuthState({
                  open: true,
                  initialAuthView: false,
                  initialMode: "default",
                })
              }
              onSearch={handleSearch}
            />
          </div>
          <div className={tabPanelClass("explore")}>
            <ExploreScreen
              initialCity={searchCity}
              initialTaste={searchTaste}
              section={exploreSection}
              onSectionChange={setExploreSection}
              onCardClick={handleCardClick}
              onRequireAuth={(kind) => requireAuth(kind)}
              onSayHi={(experience: Experience) => void openSayHiChat(`host:${experience.id}`, experience.hostName)}
              onBookExperience={(experience: Experience) => void openBookingChat(experience)}
              onSayHiHost={({ hostId, hostName }) => void openSayHiChat(hostId, hostName)}
              onInviteCompanion={() => {
                if (!requireAuth("chat")) return;
                const uid = welcomeClerkUserId;
                if (!uid) return;
                const title =
                  user?.fullName?.trim() ||
                  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
                  user?.username?.trim() ||
                  t("chat.groupChatTitle");
                const roomId = createGroupChatRoom(uid, title);
                void (async () => {
                  try {
                    const token = getSupabaseToken ? await getSupabaseToken() : null;
                    if (token) await syncGroupChatRoomToSupabase(roomId, [uid], token);
                  } catch {
                    /* ignore */
                  }
                })();
                setChatLaunch({ chatId: roomId, nonce: Date.now() });
                setActiveTab("chat");
                navigate(`/chat/${encodeURIComponent(roomId)}`);
              }}
              onOpenCreateDailyInbite={() => setCreateDailyInbiteOpen(true)}
              activityUnreadCount={activityUnreadCount}
              onOpenActivity={handleOpenActivity}
              openDailyPostId={pendingDailyPostId}
              onConsumedOpenDailyPost={() => setPendingDailyPostId(null)}
              onOpenDailyPostRoute={(postId) => navigate(`/daily-bite/${encodeURIComponent(postId)}`)}
              onDailyBiteEditModalOpenChange={setDailyBiteEditModalOpen}
            />
          </div>
          <div className={tabPanelClass("chat")}>
            <ChatScreen
              chatLaunch={chatLaunch}
              onChatLaunchConsumed={handleChatLaunchConsumed}
              myUserId={welcomeClerkUserId ?? "guest"}
            />
          </div>
          <div className={tabPanelClass("profile")}>
            <ProfileScreen
              onOpenCreateTour={() => {
                if (!requireAuth("sharing")) return;
                openCreateTourFlow();
              }}
            />
          </div>
        </div>
      </div>

      <BottomNav
        activeTab={activeTab}
        chatUnreadCount={chatUnreadCount}
        onTabChange={(next) => {
          if (next === "profile" && !requireAuth("booking")) return;
          if (next === "chat" && !requireAuth("chat")) return;
          if (createOpen) setCreateOpen(false);
          setActiveTab(next);
          if (next === "profile" && location.pathname !== "/profile") navigate("/profile");
          if (next === "explore" && location.pathname !== "/explore") navigate("/explore");
          if (next === "home" && location.pathname !== "/app") navigate("/app");
          if (
            next === "chat" &&
            !location.pathname.startsWith("/chat/") &&
            location.pathname !== "/messages"
          ) {
            navigate("/messages");
          }
        }}
      />

      <AnimatePresence>
        {showHomeNotificationBar && activeTab === "home" && activityUnreadCount > 0 ? (
          <motion.button
            type="button"
            key="home-notification-bar"
            onClick={handleOpenActivity}
            className="fixed bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.9rem)] left-1/2 z-[84] w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-[#E6D5C6] bg-[#FFFCF7]/98 px-4 py-3 text-left shadow-[0_14px_40px_rgba(42,36,32,0.16)] backdrop-blur-sm"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="text-[13px] font-semibold text-[#2C1A0E]">
              {t("appShell.homeNotificationBar", {
                name: user?.firstName?.trim() || user?.username || "Traveler",
                count: activityUnreadCount,
              })}
            </div>
            <div className="mt-1 text-[11px] text-[#A0522D]/70">{t("appShell.openActivityCta")}</div>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showFloatingActionButton ? (
          <motion.div
            key="app-fab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <FloatingActionButton
              autoInvitationTooltip={activeTab === "explore" && exploreSection === "invitations"}
              onClick={() => {
                if (!requireAuth("sharing")) return;
                if (activeTab === "explore" && exploreSection === "dailyBites") {
                  setCreateDailyInbiteOpen(true);
                  return;
                }
                openCreateTourFlow();
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "home" && showHomeQuickAction ? (
          <motion.button
            type="button"
            className="fixed bottom-[5.45rem] right-20 z-50 rounded-full border border-[#A0522D] bg-white/90 px-5 py-2.5 text-[14px] font-semibold text-[#A0522D] shadow-[0_14px_35px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            onClick={() => {
              if (!requireAuth("sharing")) return;
              openCreateTourFlow();
            }}
          >
            {t("appShell.makeMyInbite")}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isConnectingChat ? (
          <AppShellTabbarPadMotion
            className="fixed inset-0 z-[72] flex items-center justify-center bg-[#FFFBF5]/85 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-[min(88vw,360px)] rounded-3xl border border-[#E6D5C6] bg-white p-5 shadow-[0_24px_60px_rgba(42,36,32,0.14)]">
              <div className="text-[14px] font-semibold text-[#2A2420]">{t("appShell.connecting")}</div>
              <div className="mt-3 space-y-2.5">
                <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#EBDCCE]" />
                <div className="h-3 w-3/5 animate-pulse rounded-full bg-[#F1E5DA]" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#EBDCCE]" />
              </div>
            </div>
          </AppShellTabbarPadMotion>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen ? (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setCreateOpen(false)}
            />

            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <CreateTourScreen onClose={() => setCreateOpen(false)} shouldRestoreDraft={createRestoreDraft} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createDraftPromptOpen ? (
          <AppShellTabbarPadMotion
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close draft prompt"
              className="absolute inset-0 bg-black/30"
              onClick={() => setCreateDraftPromptOpen(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-[360px] rounded-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 shadow-[0_24px_60px_rgba(42,36,32,0.18)]"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
            >
              <div className="text-[16px] font-semibold text-[#2C1A0E]">{t("createDraft.restoreTitle")}</div>
              <p className="mt-2 text-[13px] leading-6 text-[#A0522D]/75">
                {t("createDraft.restoreBody")}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-2xl border border-[#EDD5C0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#A0522D]"
                  onClick={() => {
                    clearCreateTourDraft(welcomeClerkUserId ?? "guest");
                    setCreateRestoreDraft(false);
                    setCreateDraftPromptOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  {t("createDraft.restoreNo")}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-2xl bg-[#A0522D] px-4 py-2.5 text-[13px] font-semibold text-white"
                  onClick={() => {
                    setCreateRestoreDraft(true);
                    setCreateDraftPromptOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  {t("createDraft.restoreYes")}
                </button>
              </div>
            </motion.div>
          </AppShellTabbarPadMotion>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createDailyInbiteOpen ? (
          <motion.div
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setCreateDailyInbiteOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <CreateDailyInbiteSheet onClose={() => setCreateDailyInbiteOpen(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AuthModal
        open={authState.open}
        initialAuthView={authState.initialAuthView}
        initialMode={authState.initialMode}
        onClose={() => setAuthState((cur) => ({ ...cur, open: false }))}
      />

      <LoginPromptModal
        open={loginPrompt.open}
        kind={loginPrompt.kind}
        onClose={() => setLoginPrompt((cur) => ({ ...cur, open: false }))}
        onSignUp={() => {
          setLoginPrompt((cur) => ({ ...cur, open: false }));
          setAuthState({
            open: true,
            initialAuthView: true,
            initialMode: "default",
          });
        }}
        onLogIn={() => {
          setLoginPrompt((cur) => ({ ...cur, open: false }));
          setAuthState({
            open: true,
            initialAuthView: true,
            initialMode: "log-in",
          });
        }}
      />

      <ActivitySheet
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        items={activityItems}
        onSelect={handleActivitySelect}
      />

      <PostSignupWelcomeModal
        open={postSignupOpen}
        onClose={() => {
          setPostSignupOpen(false);
          const { granted } = grantWelcomeReward(5, welcomeClerkUserId);
          if (granted) {
            setRewardAnim(true);
            window.setTimeout(() => setRewardAnim(false), 1100);
          }
        }}
        onStartExploring={() => {
          setPostSignupOpen(false);
          const { granted } = grantWelcomeReward(5, welcomeClerkUserId);
          if (granted) {
            setRewardAnim(true);
            window.setTimeout(() => setRewardAnim(false), 1100);
          }
          setActiveTab("home");
        }}
      />

      <AnimatePresence>
        {rewardAnim ? (
          <motion.div
            className="fixed left-1/2 top-1/2 z-[99] -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0.6, opacity: 0, x: 0, y: 0 }}
            animate={{
              scale: [0.6, 1.2, 1],
              opacity: [0, 1, 1, 0],
              x: [0, 0, 140],
              y: [0, 0, 360],
            }}
            transition={{ duration: 1.05, ease: "easeInOut" }}
            aria-hidden="true"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
              <span className="text-3xl">🍪</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
    </UserProfilePreviewProvider>
    </PreferredCurrencyProvider>
  );
}


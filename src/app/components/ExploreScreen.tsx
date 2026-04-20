import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Check, Heart, MessageCircle, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ExperienceDetail } from "./ExperienceDetail";
import { useUserProfilePreview } from "@/app/context/UserProfilePreviewContext";
import { dailyBites, experiences, type DailyBitePost, type Experience, type IncludedItem } from "@/data/experiences";
import {
  deleteLocalInvite,
  getLocalInvites,
  upsertLocalInvite,
  subscribeLocalInvitesSync,
  type LocalInvite,
} from "@/lib/localInvites";
import {
  deleteLocalDailyBite,
  getLocalDailyBites,
  subscribeLocalDailyBitesSync,
  toDailyBitePost,
  updateLocalDailyBite,
} from "@/lib/localDailyBites";
import {
  dailyBiteRowToPost,
  deleteDailyBitePost,
  fetchOwnDailyBites,
  fetchPublicDailyBites,
  updateDailyBitePost,
} from "@/lib/remoteDailyBites";
import {
  getProfileAvatar,
  subscribeProfileAvatarRealtime,
  subscribeProfileAvatarSync,
} from "@/lib/profileAvatarStore";
import { AppShellTabbarPadMotion } from "./AppShellTabbarSafeArea";
import type { LoginPromptKind } from "./LoginPromptModal";
import { FiatPriceBadge } from "./FiatPriceBadge";
import { BITE_REWARD_COMMENT } from "@/lib/bitePolicy";
import { applyBiteDeltaServer } from "@/lib/profile";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";
import { hasLikedPost, togglePostLike } from "@/lib/dailyBites";
import { insertNotificationRemote } from "@/lib/notifications";
import {
  fetchCommentLikeCount,
  fetchLikeCountsForComments,
  fetchMyLikedCommentIds,
  setCommentLikeRemote,
} from "@/lib/dailyBiteCommentLikes";
import { useDisplayPostBody } from "@/lib/contentTranslation";
import { fetchPublicInvites, type InviteRow } from "@/lib/invites";
import { isSurimChaDemoUser, upsertSurimChaDemoInvites } from "@/lib/surimChaDemoInvites";
import { getSupabaseClient } from "@/lib/supabase";
import {
  deleteDailyBiteComment,
  fetchDailyBiteComments,
  insertDailyBiteComment,
  type RemoteDailyBiteCommentRow,
} from "@/lib/dailyBiteCommentsRemote";
import { fetchPublicProfileByClerkId, prefetchPublicProfileAvatars } from "@/lib/publicProfile";
import { isSelectableCurrency } from "@/lib/currency";

type ExploreScreenProps = {
  initialCity?: string;
  initialTaste?: string | null;
  section?: "invitations" | "dailyBites";
  onSectionChange?: (next: "invitations" | "dailyBites") => void;
  onCardClick?: (id: string) => void;
  onRequireAuth?: (kind: LoginPromptKind) => boolean;
  onInviteCompanion?: () => void;
  onSayHi?: (experience: Experience) => void;
  onBookExperience?: (experience: Experience) => void;
  onSayHiHost?: (host: { hostId: string; hostName: string }) => void;
  onOpenCreateDailyInbite?: () => void;
  activityUnreadCount?: number;
  onOpenActivity?: () => void;
  /** When set, opens this Daily Bite in detail (then consumer clears). */
  openDailyPostId?: string | null;
  onConsumedOpenDailyPost?: () => void;
  onOpenDailyPostRoute?: (postId: string) => void;
  /** Lets AppShell hide the global FAB while the Daily Bite edit dialog is open. */
  onDailyBiteEditModalOpenChange?: (open: boolean) => void;
};

type ExploreMode = "feed" | "detail" | "dailyDetail";

function formatDateTimeLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function normalizeId(v?: string | null) {
  return (v ?? "").trim();
}

function isOwnDailyPost(post: DailyBitePost, userId?: string | null) {
  const postOwner = normalizeId(post.authorClerkId != null ? String(post.authorClerkId) : "");
  const me = normalizeId(userId != null ? String(userId) : "");
  return Boolean(postOwner && me && postOwner === me);
}

export function ExploreScreen({
  initialCity = "",
  initialTaste = null,
  section = "invitations",
  onSectionChange,
  onCardClick,
  onRequireAuth,
  onInviteCompanion,
  onSayHi,
  onBookExperience,
  onSayHiHost,
  onOpenCreateDailyInbite,
  activityUnreadCount = 0,
  onOpenActivity,
  openDailyPostId = null,
  onConsumedOpenDailyPost,
  onOpenDailyPostRoute,
  onDailyBiteEditModalOpenChange,
}: ExploreScreenProps) {
  const { preferredCurrency } = usePreferredCurrency();
  const { t } = useTranslation("common");
  const { openUserProfile } = useUserProfilePreview();
  const [mode, setMode] = useState<ExploreMode>("feed");
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedTaste, setSelectedTaste] = useState<string | null>(initialTaste);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedDailyPostId, setSelectedDailyPostId] = useState<string | null>(null);
  const [inviteExperiences, setInviteExperiences] = useState<Experience[]>([]);
  const [localDailyPosts, setLocalDailyPosts] = useState<DailyBitePost[]>(dailyBites);
  const [remoteDailyPosts, setRemoteDailyPosts] = useState<DailyBitePost[]>([]);
  const [showDailyCreateHint, setShowDailyCreateHint] = useState(false);
  const [showCommentRewardToast, setShowCommentRewardToast] = useState(false);
  const [dailyBiteEditPost, setDailyBiteEditPost] = useState<DailyBitePost | null>(null);
  const [dailyBiteDeleteId, setDailyBiteDeleteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ text: "", city: "", authorBio: "" });
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likePopPostId, setLikePopPostId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [avatarMapTick, setAvatarMapTick] = useState(0);
  /** Post IDs confirmed owned by the signed-in user via authenticated Supabase query (fixes missing author_clerk_id on public rows). */
  const [serverOwnedDailyIds, setServerOwnedDailyIds] = useState<Set<string>>(() => new Set());
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuestViewer = !user?.id;
  const { getToken } = useAuth();
  /** Bumped when the user toggles a post like so in-flight `hasLikedPost` hydration cannot overwrite optimistic UI. */
  const postLikeHydrationGeneration = useRef(0);

  const mergedDailyPosts = useMemo(() => {
    const mergeAvatar = (post: DailyBitePost): DailyBitePost => {
      const id = post.authorClerkId != null ? String(post.authorClerkId).trim() : "";
      if (!id) return post;
      const cached = getProfileAvatar(id)?.trim();
      const server = post.authorImageUrl?.trim();
      const next = cached || server;
      if (!next) return post;
      if (post.authorImageUrl === next) return post;
      return { ...post, authorImageUrl: next };
    };
    const byId = new Map<string, DailyBitePost>();
    for (const p of remoteDailyPosts) {
      byId.set(p.id, mergeAvatar(p));
    }
    for (const p of localDailyPosts) {
      const existing = byId.get(p.id);
      if (!existing) {
        byId.set(p.id, mergeAvatar(p));
        continue;
      }
      byId.set(p.id, mergeAvatar({
        ...existing,
        // Prefer local device author id so a sparse/legacy public row cannot strip ownership UI.
        authorClerkId:
          normalizeId(p.authorClerkId != null ? String(p.authorClerkId) : "") ||
          normalizeId(existing.authorClerkId != null ? String(existing.authorClerkId) : ""),
        authorName: existing.authorName || p.authorName,
        authorBio: existing.authorBio || p.authorBio,
      }));
    }
    const list = [...byId.values()];
    list.sort((a, b) => {
      const ta = Date.parse(a.createdAtIso ?? "") || 0;
      const tb = Date.parse(b.createdAtIso ?? "") || 0;
      return tb - ta;
    });
    return list;
  }, [remoteDailyPosts, localDailyPosts, avatarMapTick]);

  const myOwnedDailyPostIds = useMemo(() => {
    const uid = normalizeId(user?.id);
    if (!uid) return new Set<string>();
    const out = new Set<string>();
    for (const p of mergedDailyPosts) {
      if (isOwnDailyPost(p, uid)) out.add(p.id);
    }
    for (const p of localDailyPosts) {
      if (normalizeId(p.authorClerkId != null ? String(p.authorClerkId) : "") === uid) out.add(p.id);
    }
    for (const id of serverOwnedDailyIds) out.add(id);
    return out;
  }, [localDailyPosts, mergedDailyPosts, serverOwnedDailyIds, user?.id]);

  useEffect(() => {
    const uid = user?.id?.trim();
    if (!uid) {
      setServerOwnedDailyIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const own = await fetchOwnDailyBites(token, uid, 120);
        if (cancelled) return;
        setServerOwnedDailyIds(new Set(own.map((p) => p.id)));
      } catch (e) {
        console.warn("[ExploreScreen] fetchOwnDailyBites failed", e);
        if (!cancelled) setServerOwnedDailyIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, getToken, section]);

  useEffect(() => {
    onDailyBiteEditModalOpenChange?.(dailyBiteEditPost != null);
  }, [dailyBiteEditPost, onDailyBiteEditModalOpenChange]);

  useEffect(() => {
    return () => {
      onDailyBiteEditModalOpenChange?.(false);
    };
  }, [onDailyBiteEditModalOpenChange]);

  const hasActivityUnread = activityUnreadCount > 0;
  const activityBell = (
    <button
      type="button"
      onClick={() => onOpenActivity?.()}
      className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EDD5C0] bg-white/80 text-[#A0522D] shadow-sm"
      aria-label={hasActivityUnread ? t("explore.activityUnreadAria") : t("explore.activityAria")}
    >
      <Bell className="h-5 w-5" strokeWidth={2} />
      {hasActivityUnread ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#D64545] px-1 py-0.5 text-center text-[10px] font-semibold leading-none text-white ring-2 ring-white/90">
          {activityUnreadCount > 99 ? "99+" : activityUnreadCount}
        </span>
      ) : null}
    </button>
  );

  useEffect(() => {
    if (!user) return;
    if (!isSurimChaDemoUser(user)) return;
    upsertSurimChaDemoInvites(user);
  }, [user?.id, user?.fullName, user?.firstName, user?.lastName, user?.username]);

  useEffect(() => {
    const syncLocalInvites = () => {
      const myAvatar = getProfileAvatar(user?.id);
      const myDisplayName =
        user?.fullName?.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        user?.username?.trim() ||
        "Surim Cha";
      setInviteExperiences(
        getLocalInvites().map((invite) => mapLocalInviteToExperience(invite, user?.id, myAvatar, myDisplayName)),
      );
    };
    syncLocalInvites();
    return subscribeLocalInvitesSync(syncLocalInvites);
  }, [user?.id, user?.fullName, user?.firstName, user?.lastName, user?.username, avatarMapTick]);

  /** Sync invite cards from Supabase (all hosts). Uses anon client like Daily Bites — needs public SELECT RLS on `invites`. */
  useEffect(() => {
    let alive = true;
    let channelCleanup: (() => void) | undefined;
    void (async () => {
      try {
        const rows = await fetchPublicInvites(160);
        if (!alive) return;
        for (const row of rows) {
          upsertLocalInvite(mapInviteRowToLocalInvite(row));
        }
        const supabase = getSupabaseClient();
        if (!supabase || !alive) return;
        const channel = supabase
          .channel("invites-public-feed")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "invites" },
            (payload) => {
              if (payload.eventType === "DELETE") {
                const oldRow = payload.old as { id?: string } | null;
                if (oldRow?.id) deleteLocalInvite(oldRow.id);
                return;
              }
              const row = payload.new as Partial<InviteRow> | null;
              if (!row?.id) return;
              upsertLocalInvite(mapInviteRowToLocalInvite(row as InviteRow));
            },
          )
          .subscribe();
        channelCleanup = () => {
          void supabase.removeChannel(channel);
        };
      } catch {
        // Realtime is optional
      }
    })();
    return () => {
      alive = false;
      channelCleanup?.();
    };
  }, []);

  useEffect(() => {
    const syncLocalDailyBites = () => {
      const mapped = getLocalDailyBites().map((bite) => {
        const post = toDailyBitePost(bite);
        const override = bite.authorClerkId ? getProfileAvatar(bite.authorClerkId) : undefined;
        return override ? { ...post, authorImageUrl: override } : post;
      });
      setLocalDailyPosts([...mapped, ...dailyBites]);
    };
    syncLocalDailyBites();
    return subscribeLocalDailyBitesSync(syncLocalDailyBites);
  }, [avatarMapTick]);

  useEffect(() => {
    if (section !== "dailyBites") return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchPublicDailyBites(80);
        if (!cancelled) setRemoteDailyPosts(next);
      } catch {
        if (!cancelled) setRemoteDailyPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  /** Refresh author avatars from `public_profile_for_clerk` so feed matches profile edits without opening the modal. */
  useEffect(() => {
    if (section !== "dailyBites") return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const ids = new Set<string>();
        for (const p of remoteDailyPosts) {
          const id = normalizeId(p.authorClerkId != null ? String(p.authorClerkId) : "");
          if (id.startsWith("user_")) ids.add(id);
        }
        for (const p of localDailyPosts) {
          const id = normalizeId(p.authorClerkId != null ? String(p.authorClerkId) : "");
          if (id.startsWith("user_")) ids.add(id);
        }
        if (!ids.size) return;
        await prefetchPublicProfileAvatars([...ids], token);
        if (!cancelled) setAvatarMapTick((v) => v + 1);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, remoteDailyPosts, localDailyPosts, getToken]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let alive = true;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || !alive) return;
        const supabase = getSupabaseClient(token);
        if (!supabase) return;
        const channel = supabase
          .channel("daily-bites-feed")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "daily_bites" },
            (payload) => {
              const row = payload.new as Record<string, unknown>;
              if (!row?.id || typeof row.id !== "string") return;
              try {
                const post = dailyBiteRowToPost({
                  id: row.id,
                  author_clerk_id: String(row.author_clerk_id ?? ""),
                  author_name: String(row.author_name ?? ""),
                  author_bio: String(row.author_bio ?? ""),
                  body: String(row.body ?? ""),
                  city: String(row.city ?? ""),
                  photo_urls: row.photo_urls,
                  author_image_url: (row.author_image_url as string | null) ?? null,
                  likes_count: typeof row.likes_count === "number" ? row.likes_count : null,
                  comments_count: typeof row.comments_count === "number" ? row.comments_count : null,
                  created_at: String(row.created_at ?? new Date().toISOString()),
                });
                setRemoteDailyPosts((prev) => {
                  if (prev.some((p) => p.id === post.id)) return prev;
                  return [post, ...prev].sort((a, b) => {
                    const ta = Date.parse(a.createdAtIso ?? "") || 0;
                    const tb = Date.parse(b.createdAtIso ?? "") || 0;
                    return tb - ta;
                  });
                });
              } catch {
                // ignore malformed payload
              }
            },
          )
          .subscribe();
        cleanup = () => {
          void supabase.removeChannel(channel);
        };
      } catch {
        // realtime optional
      }
    })();
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [getToken]);

  useEffect(() => {
    const unsubLocal = subscribeProfileAvatarSync(() => setAvatarMapTick((v) => v + 1));
    let unsubRealtime: (() => void) | undefined;
    let alive = true;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!alive) return;
        unsubRealtime = await subscribeProfileAvatarRealtime(() => setAvatarMapTick((v) => v + 1), token ?? undefined);
      } catch {
        // ignore if realtime/env is unavailable
      }
    })();
    return () => {
      alive = false;
      unsubLocal();
      unsubRealtime?.();
    };
  }, [getToken]);

  const combinedExperiences = useMemo(() => {
    const existingIds = new Set(inviteExperiences.map((item) => item.id));
    const base = experiences.filter((item) => !existingIds.has(item.id));
    return [...inviteExperiences, ...base];
  }, [inviteExperiences]);

  const filteredExperiences = useMemo(() => {
    const normalizedCity = selectedCity.trim().toLowerCase();
    const normalizedTaste = selectedTaste?.trim().toLowerCase() ?? null;

    return combinedExperiences.filter((experience) => {
      const matchesCity = normalizedCity
        ? experience.city.trim().toLowerCase() === normalizedCity
        : true;
      const matchesTaste = normalizedTaste
        ? experience.tasteTags.some((tag) => tag.toLowerCase() === normalizedTaste)
        : true;

      return matchesCity && matchesTaste;
    });
  }, [combinedExperiences, selectedCity, selectedTaste]);

  const sortedExperiences = useMemo(() => {
    const base = [...filteredExperiences];
    const noFilters = !selectedCity.trim() && !selectedTaste;
    if (!noFilters) return base;

    const rank = new Map(base.map((item, idx) => [item.id, idx]));
    const toTs = (v?: string) => {
      if (!v) return Number.NEGATIVE_INFINITY;
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
    };

    base.sort((a, b) => {
      const diff = toTs(b.createdAt) - toTs(a.createdAt);
      if (diff !== 0) return diff;
      return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
    });
    return base;
  }, [filteredExperiences, selectedCity, selectedTaste]);

  const filteredDailyPosts = useMemo(() => {
    const city = selectedCity.trim().toLowerCase();
    if (!city) return mergedDailyPosts;
    return mergedDailyPosts.filter((post) => post.city.trim().toLowerCase() === city);
  }, [mergedDailyPosts, selectedCity]);

  useEffect(() => {
    setLikeCounts((prev) => {
      const next = { ...prev };
      for (const post of mergedDailyPosts) {
        if (typeof next[post.id] !== "number") {
          next[post.id] = Math.max(0, post.likeCount ?? 0);
        }
      }
      return next;
    });
  }, [mergedDailyPosts]);

  useEffect(() => {
    if (!user?.id) return;
    const baseline = postLikeHydrationGeneration.current;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const entries = await Promise.all(
          mergedDailyPosts.map(async (post) => [post.id, await hasLikedPost(post.id, user.id, token)] as const),
        );
        if (cancelled) return;
        if (baseline !== postLikeHydrationGeneration.current) return;
        setLikedPosts(Object.fromEntries(entries));
      } catch {
        // Keep local default state if DB is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, mergedDailyPosts, user?.id]);

  useEffect(() => {
    if (!dailyBiteEditPost) return;
    setEditDraft({
      text: dailyBiteEditPost.text,
      city: dailyBiteEditPost.city,
      authorBio: dailyBiteEditPost.authorBio ?? "",
    });
  }, [dailyBiteEditPost]);

  const selectedExperience = useMemo(() => {
    return (
      sortedExperiences.find((experience) => experience.id === selectedExperienceId) ??
      sortedExperiences[0] ??
      null
    );
  }, [sortedExperiences, selectedExperienceId]);

  const selectedDailyPost = useMemo(() => {
    if (!selectedDailyPostId) return null;
    return filteredDailyPosts.find((post) => post.id === selectedDailyPostId) ?? null;
  }, [filteredDailyPosts, selectedDailyPostId]);

  useEffect(() => {
    if (!openDailyPostId) return;
    const exists = mergedDailyPosts.some((p) => p.id === openDailyPostId);
    if (!exists) return;
    setSelectedDailyPostId(openDailyPostId);
    setMode("dailyDetail");
    onConsumedOpenDailyPost?.();
  }, [openDailyPostId, mergedDailyPosts, onConsumedOpenDailyPost]);

  useEffect(() => {
    if (mode !== "dailyDetail" || !selectedDailyPost) return;
    setCommentCounts((prev) => ({
      ...prev,
      [selectedDailyPost.id]: selectedDailyPost.commentCount ?? 0,
    }));
  }, [mode, selectedDailyPost]);

  useEffect(() => {
    setSelectedCity(initialCity);
  }, [initialCity]);

  // Sync search-driven reset only when not on a Daily Bite deep link — otherwise a fresh AppShell
  // with empty `initialCity` would clear the opened post detail.
  // Reset stacked explore views only when the *route* changes — not when `initialCity` updates alone,
  // otherwise a parent re-render can kick users out of Daily Bite detail mid-flow.
  useEffect(() => {
    if (location.pathname.startsWith("/daily-bite/")) return;
    setMode("feed");
    setSelectedExperienceId(null);
    setSelectedDailyPostId(null);
  }, [location.pathname]);

  useEffect(() => {
    setSelectedTaste(initialTaste);
  }, [initialTaste]);

  useEffect(() => {
    if (section !== "dailyBites" || mode !== "feed") {
      setShowDailyCreateHint(false);
      return;
    }
    setShowDailyCreateHint(true);
    const hide = window.setTimeout(() => setShowDailyCreateHint(false), 2200);
    const cycle = window.setInterval(() => {
      setShowDailyCreateHint(true);
      window.setTimeout(() => setShowDailyCreateHint(false), 1800);
    }, 8000);
    return () => {
      window.clearTimeout(hide);
      window.clearInterval(cycle);
    };
  }, [mode, section]);

  useEffect(() => {
    if (section !== "dailyBites" && mode === "dailyDetail") {
      setMode("feed");
      setSelectedDailyPostId(null);
    }
  }, [section, mode]);

  useEffect(() => {
    if (mode === "dailyDetail" && !selectedDailyPost) {
      setMode("feed");
      setSelectedDailyPostId(null);
    }
  }, [mode, selectedDailyPost]);

  const handleOpenHost = (experienceId?: string) => {
    if (onRequireAuth && !onRequireAuth("booking")) return;
    const target =
      sortedExperiences.find((experience) => experience.id === experienceId) ??
      selectedExperience;
    if (!target) return;
    setSelectedExperienceId(target.id);
    onCardClick?.(target.id);
    const hid = normalizeId(target.hostClerkId ?? "");
    if (hid.startsWith("user_")) {
      openUserProfile({
        clerkId: hid,
        fallbackDisplayName: target.hostName,
        fallbackImageUrl: target.hostAvatarUrl,
      });
    }
  };

  const handleOpenDetail = (experienceId?: string) => {
    if (onRequireAuth && !onRequireAuth("booking")) return;
    const target =
      sortedExperiences.find((experience) => experience.id === experienceId) ??
      selectedExperience;
    if (!target) return;
    setSelectedExperienceId(target.id);
    onCardClick?.(target.id);
    setMode("detail");
  };

  const handleSayHi = (experienceId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onRequireAuth && !onRequireAuth("chat")) return;
    const target = sortedExperiences.find((item) => item.id === experienceId);
    if (!target) return;
    onSayHi?.(target);
  };

  const handleOpenDailyPost = (postId: string) => {
    if (location.pathname !== `/daily-bite/${encodeURIComponent(postId)}`) onOpenDailyPostRoute?.(postId);
    setSelectedDailyPostId(postId);
    setMode("dailyDetail");
  };

  const handleToggleLike = async (postId: string) => {
    if (myOwnedDailyPostIds.has(postId)) return;
    if (onRequireAuth && !onRequireAuth("sharing")) return;
    postLikeHydrationGeneration.current += 1;
    const post = mergedDailyPosts.find((p) => p.id === postId);
    const currentlyLiked = Boolean(likedPosts[postId]);
    setLikedPosts((prev) => ({ ...prev, [postId]: !currentlyLiked }));
    setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? -1 : 1)) }));
    setLikePopPostId(postId);
    window.setTimeout(() => {
      setLikePopPostId((current) => (current === postId ? null : current));
    }, 220);

    if (!user?.id) return;
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) throw new Error("missing_token");
      const result = await togglePostLike(postId, user.id, token);
      postLikeHydrationGeneration.current += 1;
      setLikedPosts((prev) => ({ ...prev, [postId]: result.liked }));
    } catch {
      // Roll back optimistic update on failure.
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? 1 : -1)) }));
      toast.error(t("explore.unknownError"));
    }
  };

  const runDeleteDailyPost = async (postId: string) => {
    if (!user?.id) return;
    const target = mergedDailyPosts.find((p) => p.id === postId);
    if (!target || !myOwnedDailyPostIds.has(postId)) return;
    try {
      deleteLocalDailyBite(postId);
      const token = await getToken({ template: "supabase" });
      if (token) await deleteDailyBitePost(token, postId);
      setRemoteDailyPosts((prev) => prev.filter((p) => p.id !== postId));
      setServerOwnedDailyIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setMode("feed");
      setSelectedDailyPostId(null);
      setDailyBiteDeleteId(null);
      if (location.pathname.startsWith("/daily-bite/")) navigate("/explore");
    } catch {
      toast.error(t("explore.unknownError"));
    }
  };

  const saveDailyBiteEdit = async () => {
    const post = dailyBiteEditPost;
    if (!post || !user?.id || !myOwnedDailyPostIds.has(post.id)) return;
    const trimmed = editDraft.text.trim();
    if (!trimmed) {
      toast.error(t("explore.dailyBiteEmptyBodyError"));
      return;
    }
    const nextCity = editDraft.city.trim() || "Local";
    const nextBio = editDraft.authorBio.trim();
    const postId = post.id;
    updateLocalDailyBite(postId, (prev) => ({ ...prev, text: trimmed, city: nextCity, authorBio: nextBio }));
    setRemoteDailyPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, text: trimmed, city: nextCity, authorBio: nextBio } : p)),
    );
    try {
      const token = await getToken({ template: "supabase" });
      if (token) {
        await updateDailyBitePost(token, postId, {
          body: trimmed,
          city: nextCity,
          authorBio: nextBio,
          photoUrls: post.photoUrls ?? [],
        });
      }
      setDailyBiteEditPost(null);
    } catch {
      toast.error(t("explore.unknownError"));
    }
  };

  const dailyBiteModals = (
    <AnimatePresence>
      {dailyBiteEditPost ? (
        <AppShellTabbarPadMotion
          key="daily-edit"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/25 p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setDailyBiteEditPost(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-bite-edit-title"
            className="flex min-h-0 max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#E6D2BF] bg-[#FFFBF6] shadow-[0_24px_60px_rgba(42,36,32,0.18)] sm:max-h-[min(92dvh,720px)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 pt-5">
              <h2 id="daily-bite-edit-title" className="text-[17px] font-semibold text-[#2C1A0E]">
                {t("explore.dailyBiteEditModalTitle")}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 pt-4">
              <label className="block text-[12px] font-semibold text-[#A0522D]/85">
                {t("explore.dailyBiteEditBodyLabel")}
                <textarea
                  value={editDraft.text}
                  onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                  rows={6}
                  className="mt-1.5 w-full resize-y rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[14px] text-[#2C1A0E] outline-none focus:border-[#A0522D]/50"
                />
              </label>
              <label className="mt-3 block text-[12px] font-semibold text-[#A0522D]/85">
                {t("explore.dailyBiteEditCityLabel")}
                <input
                  type="text"
                  value={editDraft.city}
                  onChange={(e) => setEditDraft((d) => ({ ...d, city: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[14px] text-[#2C1A0E] outline-none focus:border-[#A0522D]/50"
                />
              </label>
              <label className="mt-3 block pb-4 text-[12px] font-semibold text-[#A0522D]/85 max-sm:pb-6">
                {t("explore.dailyBiteEditBioLabel")}
                <input
                  type="text"
                  value={editDraft.authorBio}
                  onChange={(e) => setEditDraft((d) => ({ ...d, authorBio: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[14px] text-[#2C1A0E] outline-none focus:border-[#A0522D]/50"
                />
              </label>
              <div className="sticky bottom-0 z-10 -mx-5 border-t border-[#E6D2BF]/90 bg-[#FFFBF6]/98 px-5 pt-3 shadow-[0_-10px_24px_rgba(42,36,32,0.06)] backdrop-blur-sm max-sm:pb-[max(1rem,calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)))] sm:pb-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyBiteEditPost(null)}
                    className="rounded-full border border-[#EDD5C0] bg-white px-4 py-2 text-[13px] font-semibold text-[#A0522D]"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDailyBiteEdit()}
                    className="rounded-full bg-[#A0522D] px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AppShellTabbarPadMotion>
      ) : null}
      {dailyBiteDeleteId ? (
        <AppShellTabbarPadMotion
          key="daily-delete"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setDailyBiteDeleteId(null)}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="daily-bite-del-title"
            aria-describedby="daily-bite-del-desc"
            className="w-full max-w-sm rounded-2xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 shadow-[0_24px_60px_rgba(42,36,32,0.18)]"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="daily-bite-del-title" className="text-[17px] font-semibold text-[#2C1A0E]">
              {t("explore.dailyBiteDeleteConfirmTitle")}
            </h2>
            <p id="daily-bite-del-desc" className="mt-2 text-[14px] leading-relaxed text-[#2C1A0E]/85">
              {t("explore.dailyBiteDeleteConfirmBody")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDailyBiteDeleteId(null)}
                className="rounded-full border border-[#EDD5C0] bg-white px-4 py-2 text-[13px] font-semibold text-[#A0522D]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void runDeleteDailyPost(dailyBiteDeleteId)}
                className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
              >
                {t("explore.dailyBiteDeleteConfirm")}
              </button>
            </div>
          </motion.div>
        </AppShellTabbarPadMotion>
      ) : null}
    </AnimatePresence>
  );

  if (mode === "detail" && selectedExperience) {
    const hostClerk = normalizeId(selectedExperience.hostClerkId ?? "");
    const isOwnInvite = Boolean(user?.id && hostClerk && user.id === hostClerk);
    const shareToastMessage = "링크가 복사되었습니다! 친구들에게 인바이트를 보내보세요! 🍪";
    const shareUrl = window.location.href;
    const shareTitle = `[인바이트] ${selectedExperience.hostName}님이 당신을 특별한 ${selectedExperience.title}에 초대했습니다! ☕`;
    const copyShareUrl = async () => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    const handleShareInvitation = async () => {
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({
            title: shareTitle,
            text: shareTitle,
            url: shareUrl,
          });
          toast.success(shareToastMessage);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
      try {
        await copyShareUrl();
        toast.success(shareToastMessage);
      } catch {
        toast.error("링크 복사에 실패했습니다. 다시 시도해 주세요.");
      }
    };

    return (
      <ExperienceDetail
        experience={selectedExperience}
        isOwnInvite={isOwnInvite}
        onBack={() => setMode("feed")}
        onSayHi={() => {
          if (onRequireAuth && !onRequireAuth("chat")) return;
          onSayHi?.(selectedExperience);
        }}
        onEditInvitation={() => {
          navigate("/profile", { state: { editInviteId: selectedExperience.id } });
        }}
        onShareInvitation={() => {
          void handleShareInvitation();
        }}
        onOpenHostProfile={
          hostClerk.startsWith("user_")
            ? () =>
                openUserProfile({
                  clerkId: hostClerk,
                  fallbackDisplayName: selectedExperience.hostName,
                  fallbackImageUrl: selectedExperience.hostAvatarUrl,
                })
            : undefined
        }
        onBookExperience={() => {
          if (isOwnInvite) {
            toast.error("본인의 초대장은 예약할 수 없습니다.");
            return;
          }
          if (onRequireAuth && !onRequireAuth("booking")) return;
          onBookExperience?.(selectedExperience);
        }}
        bookDisabled={isOwnInvite}
        bookDisabledMessage={isOwnInvite ? "본인의 초대장은 예약할 수 없습니다." : undefined}
      />
    );
  }

  if (mode === "dailyDetail" && selectedDailyPost) {
    return (
      <>
      <main className="flex min-h-0 min-h-full flex-col overflow-hidden bg-[#FDFAF5]">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-8 pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("feed");
                  if (location.pathname.startsWith("/daily-bite/")) navigate("/explore");
                }}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#A0522D]"
              >
                {t("explore.backDailyBites")}
              </button>
              {activityBell}
            </div>
            <AnimatePresence initial={false}>
              <motion.div
                key={selectedDailyPost.id}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <DailyBiteCard
                  post={selectedDailyPost}
                  canManage={myOwnedDailyPostIds.has(selectedDailyPost.id)}
                  canSayHi={!myOwnedDailyPostIds.has(selectedDailyPost.id)}
                  liked={Boolean(likedPosts[selectedDailyPost.id])}
                  likeCount={likeCounts[selectedDailyPost.id] ?? selectedDailyPost.likeCount ?? 0}
                  commentCount={commentCounts[selectedDailyPost.id] ?? selectedDailyPost.commentCount ?? 0}
                  animateLike={likePopPostId === selectedDailyPost.id}
                  onToggleLike={() => void handleToggleLike(selectedDailyPost.id)}
                  allowLike={!myOwnedDailyPostIds.has(selectedDailyPost.id)}
                  onEdit={() => setDailyBiteEditPost(selectedDailyPost)}
                  onDelete={() => setDailyBiteDeleteId(selectedDailyPost.id)}
                  onSayHiHost={onSayHiHost}
                />
              </motion.div>
            </AnimatePresence>
            <DailyBiteCommentsSection
              postId={selectedDailyPost.id}
              postAuthorClerkId={selectedDailyPost.authorClerkId}
              onRequireAuth={onRequireAuth}
              getToken={getToken}
              onReward={() => {
                setShowCommentRewardToast(true);
                window.setTimeout(() => setShowCommentRewardToast(false), 1000);
              }}
              onCommentTotalChange={(total) =>
                setCommentCounts((prev) => ({ ...prev, [selectedDailyPost.id]: total }))
              }
            />
          </div>
        <AnimatePresence>
          {showCommentRewardToast ? (
            <motion.div
              className="pointer-events-none fixed bottom-[calc(5rem+0.65rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#2E1C11]/92 px-3 py-1.5 text-[11px] font-semibold text-[#FFF6EC]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              {t("explore.commentReward")}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      {dailyBiteModals}
      </>
    );
  }

  return (
    <>
    <main className="flex min-h-0 min-h-full flex-col overflow-hidden bg-[#FDFAF5]">
      <div className="shrink-0 px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="font-brand-display text-[24px] font-semibold text-[#A0522D]">
            {t("explore.title")}
          </div>
          {activityBell}
        </div>

        <div className="mt-2 flex gap-2 rounded-2xl bg-white/60 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => onSectionChange?.("invitations")}
            className="flex-1 rounded-2xl py-3 text-[13px] font-semibold"
            style={{
              background: section === "invitations" ? "#A0522D" : "rgba(255,255,255,0.3)",
              color: section === "invitations" ? "white" : "rgba(160,82,45,0.55)",
            }}
          >
            {t("explore.invitations")}
          </button>
          <button
            type="button"
            onClick={() => onSectionChange?.("dailyBites")}
            className="flex-1 rounded-2xl py-3 text-[13px] font-semibold"
            style={{
              background: section === "dailyBites" ? "#A0522D" : "rgba(255,255,255,0.3)",
              color: section === "dailyBites" ? "white" : "rgba(160,82,45,0.55)",
            }}
          >
            {t("explore.dailyBites")}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedCity.trim() ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCity("");
                setSelectedExperienceId(null);
                setSelectedDailyPostId(null);
              }}
              className="flex items-center gap-2 rounded-full bg-[#A0522D] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_14px_35px_rgba(160,82,45,0.25)]"
            >
              {selectedCity} <span className="text-white/80">×</span>
            </button>
          ) : null}
          {selectedTaste ? (
            <button
              type="button"
              onClick={() => {
                setSelectedTaste(null);
                setSelectedExperienceId(null);
                setSelectedDailyPostId(null);
              }}
              className="flex items-center gap-2 rounded-full border border-[#EDD5C0] bg-white/70 px-4 py-2 text-[13px] font-semibold text-[#A0522D] shadow-sm transition-opacity active:opacity-80"
              aria-label={t("explore.removeTasteFilter", { taste: selectedTaste })}
            >
              {selectedTaste} <span className="text-[#A0522D]/65" aria-hidden>×</span>
            </button>
          ) : null}
        </div>

        {isGuestViewer ? (
          <div className="mt-4 rounded-2xl border border-[#EDD5C0] bg-white/70 px-4 py-3 text-center text-[12px] text-[#A0522D]/80">
            {t("explore.guestTeaser")}
          </div>
        ) : null}
      </div>

      <div
        key={section}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-8"
      >
        {section === "dailyBites" ? (
          filteredDailyPosts.length ? (
            <div className="mt-6 space-y-4">
              {filteredDailyPosts.map((post) => (
                <motion.article
                  key={post.id}
                  onClick={() => handleOpenDailyPost(post.id)}
                  className="cursor-pointer"
                  whileTap={{ scale: 0.995 }}
                >
                  <DailyBiteCard
                    post={post}
                    canManage={myOwnedDailyPostIds.has(post.id)}
                    canSayHi={!myOwnedDailyPostIds.has(post.id)}
                    liked={Boolean(likedPosts[post.id])}
                    likeCount={likeCounts[post.id] ?? post.likeCount ?? 0}
                    commentCount={commentCounts[post.id] ?? post.commentCount ?? 0}
                    animateLike={likePopPostId === post.id}
                    onToggleLike={() => void handleToggleLike(post.id)}
                    allowLike={!myOwnedDailyPostIds.has(post.id)}
                    onEdit={() => setDailyBiteEditPost(post)}
                    onDelete={() => setDailyBiteDeleteId(post.id)}
                    onSayHiHost={onSayHiHost}
                  />
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[26px] bg-white/60 px-6 py-10 text-center shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
              <div className="font-brand-display text-[24px] text-[#A0522D]">
                {t("explore.noDailyBitesTitle")}
              </div>
              <p className="mt-3 text-sm text-[#A0522D]/70">
                {t("explore.noDailyBitesHint")}
              </p>
            </div>
          )
        ) : sortedExperiences.length ? (
          <div className="mt-6 space-y-5">
            {sortedExperiences.map((experience) => (
              <div
                key={experience.id}
                className="invite-experience-card rounded-[26px] bg-white/60 p-0 shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
              >
                <div className="overflow-hidden rounded-[26px]">
                  {experience.coverPhotoUrl ? (
                    <img
                      src={experience.coverPhotoUrl}
                      alt={experience.title}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="h-44 w-full bg-gradient-to-br from-[#2B1A12] to-[#5D3B24]" />
                  )}
                </div>

                <div className="px-5 pb-5 pt-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenHost(experience.id)}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/70 bg-[#E7D7C7]"
                      aria-label={`View ${experience.hostName} profile`}
                    >
                      {experience.hostAvatarUrl ? (
                        <img src={experience.hostAvatarUrl} alt={experience.hostName} className="h-full w-full object-cover" />
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      {(() => {
                        const isMyInvite =
                          Boolean(user?.id && experience.hostClerkId && user.id === experience.hostClerkId);
                        return (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenHost(experience.id)}
                          className={`text-left text-[14px] font-semibold text-[#A0522D] hover:underline ${
                            isGuestViewer ? "blur-[1.6px]" : ""
                          }`}
                        >
                          {isGuestViewer ? `${experience.hostName.slice(0, 1)}***` : experience.hostName}
                        </button>
                        {isMyInvite ? (
                          <span className="text-[11px] font-medium text-[#A0522D]/58">
                            {t("explore.myInviteLabel")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleSayHi(experience.id, e)}
                            className="font-brand-display inline-flex items-center gap-1 rounded-full border border-[#A0522D] bg-transparent px-2.5 py-1 text-[11px] font-semibold text-[#A0522D] transition hover:bg-[#A0522D]/5"
                          >
                            <MessageCircle className="h-3 w-3 opacity-80" strokeWidth={2} />
                            Say Hi
                          </button>
                        )}
                      </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => handleOpenHost(experience.id)}
                        className={`mt-0.5 block text-left text-[12px] text-[#A0522D]/70 ${
                          isGuestViewer ? "blur-[1.2px]" : ""
                        }`}
                      >
                        {experience.city}, {experience.country}
                      </button>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-[#A0522D]/60">
                      ★ {experience.rating}{" "}
                      <span className="text-[10px]">({experience.reviews})</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(experience.id)}
                    className="mt-3 block text-left"
                  >
                    <h3 className="font-brand-display text-[18px] font-semibold text-[#A0522D]">
                      {experience.title}
                    </h3>
                  </button>
                  <p className="font-body-ko mt-2 text-[13px] leading-5 text-[#A0522D]/70">
                    {isGuestViewer
                      ? `${experience.about.slice(0, 72).trim()}...`
                      : experience.about}
                  </p>

                  <div className="mt-4 flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-2">
                      {experience.includedItems.map((item) => (
                        <span
                          key={item.id}
                          className="font-body-ko inline-flex items-center gap-1 rounded-full border border-[#E8DED4] bg-[#FFFCF8]/95 px-2.5 py-1.5 text-[12px] font-medium text-[#5C4033] shadow-[0_1px_3px_rgba(160,82,45,0.06)]"
                        >
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-[#A0522D]/65"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="text-[13px] opacity-85" aria-hidden>
                            {item.emoji}
                          </span>
                          <span>{getIncludedLabelEnglish(item.id, item.labelKo)}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-end border-t border-[#EDD5C0]/70 pt-2.5">
                      <FiatPriceBadge
                        variant="inline"
                        priceAmount={experience.priceAmount}
                        hostCurrency={experience.hostCurrency}
                        preferredCurrency={preferredCurrency}
                        className="!text-[clamp(1.2rem,5vw,1.75rem)] !font-extrabold tracking-tight text-[#7A3E24]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[26px] bg-white/60 px-6 py-10 text-center shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
            <div className="font-brand-display text-[24px] text-[#A0522D]">
              {t("explore.noInvitationsTitle")}
            </div>
            <p className="mt-3 text-sm text-[#A0522D]/70">
              {t("explore.noInvitationsHint")}
            </p>
          </div>
        )}
      </div>

      {section === "dailyBites" && mode === "feed" && showDailyCreateHint ? (
        <div className="pointer-events-none fixed bottom-[5.45rem] right-20 z-40 rounded-full border border-[#A0522D] bg-white/95 px-5 py-2.5 text-[14px] font-semibold text-[#A0522D] shadow-[0_14px_35px_rgba(0,0,0,0.08)]">
          {t("explore.shareDailyHint")}
        </div>
      ) : null}
    </main>
    {dailyBiteModals}
    </>
  );
}

function DailyBiteCard({
  post,
  canManage = false,
  canSayHi = true,
  allowLike = true,
  liked = false,
  likeCount = 0,
  commentCount: commentCountProp,
  animateLike = false,
  onToggleLike,
  onEdit,
  onDelete,
  onSayHiHost,
}: {
  post: DailyBitePost;
  canManage?: boolean;
  canSayHi?: boolean;
  /** When false (e.g. own post), like is disabled — cannot interact with own post likes from the card. */
  allowLike?: boolean;
  liked?: boolean;
  likeCount?: number;
  commentCount?: number;
  animateLike?: boolean;
  onToggleLike?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSayHiHost?: (host: { hostId: string; hostName: string }) => void;
}) {
  const { t } = useTranslation("common");
  const { openUserProfile } = useUserProfilePreview();
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const postMenuRef = useRef<HTMLDivElement | null>(null);
  const displayBody = useDisplayPostBody(post.id, post.text);
  const commentCount = commentCountProp ?? post.commentCount ?? 0;
  const clerkHostId = normalizeId(post.authorClerkId != null ? String(post.authorClerkId) : "");
  const authorAvatarOverride = clerkHostId ? getProfileAvatar(clerkHostId) : undefined;
  const displayAuthorAvatar = authorAvatarOverride || post.authorImageUrl;
  const canOpenAuthorProfile = clerkHostId.startsWith("user_");
  const normalizedHostId = clerkHostId
    ? `host:${clerkHostId}`
    : `daily-author:${post.authorName.trim().toLowerCase().replace(/\s+/g, "-")}`;
  /** Real Clerk users: use raw `user_*` so direct rooms are not stripped by `removeSyntheticChatRooms`. */
  const sayHiHostId = clerkHostId.startsWith("user_") ? clerkHostId : normalizedHostId;

  useEffect(() => {
    if (!postMenuOpen) return;
    const close = (ev: Event) => {
      const el = postMenuRef.current;
      if (el && !el.contains(ev.target as Node)) setPostMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [postMenuOpen]);

  return (
    <article className="rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#EDD5C0] bg-[#F0E4D8] disabled:cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              if (!canOpenAuthorProfile) return;
              openUserProfile({
                clerkId: clerkHostId,
                fallbackDisplayName: post.authorName,
                fallbackImageUrl: displayAuthorAvatar,
              });
            }}
            disabled={!canOpenAuthorProfile}
            aria-label={canOpenAuthorProfile ? t("profilePreview.viewProfileAria", { name: post.authorName }) : undefined}
          >
            {displayAuthorAvatar ? (
              <img src={displayAuthorAvatar} alt="" className="h-full w-full object-cover" />
            ) : null}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canOpenAuthorProfile}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canOpenAuthorProfile) return;
                  openUserProfile({
                    clerkId: clerkHostId,
                    fallbackDisplayName: post.authorName,
                    fallbackImageUrl: displayAuthorAvatar,
                  });
                }}
                className={`text-left text-[14px] font-semibold text-[#A0522D] disabled:cursor-default ${
                  canOpenAuthorProfile ? "hover:underline" : ""
                }`}
              >
                {post.authorName}
              </button>
              {canSayHi ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSayHiHost?.({ hostId: sayHiHostId, hostName: post.authorName });
                  }}
                  className="rounded-full border border-[#A0522D]/45 bg-white/75 px-2.5 py-0.5 text-[11px] font-semibold lowercase tracking-[0.01em] text-[#A0522D] hover:bg-[#A0522D]/5"
                >
                  {t("explore.sayHi")}
                </button>
              ) : null}
            </div>
            <div className="mt-1 text-[12px] text-[#A0522D]/60">
              {post.city} · {formatDateTimeLabel(post.createdAtIso) || post.createdLabel}
              {formatDateTimeLabel(post.createdAtIso) ? ` · ${post.createdLabel}` : ""}
            </div>
          </div>
        </div>
        {canManage ? (
          <div className="relative shrink-0" ref={postMenuRef}>
            <button
              type="button"
              aria-label={t("explore.dailyBitePostMenuAria")}
              aria-expanded={postMenuOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation();
                setPostMenuOpen((o) => !o);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDD5C0] bg-white/90 text-[#A0522D] shadow-sm transition-colors hover:bg-[#A0522D]/5"
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2} />
            </button>
            {postMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[9.5rem] overflow-hidden rounded-xl border border-[#E6D2BF] bg-[#FFFBF6] py-1 shadow-[0_16px_40px_rgba(42,36,32,0.14)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPostMenuOpen(false);
                    onEdit?.();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-[#2C1A0E] hover:bg-[#A0522D]/8"
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPostMenuOpen(false);
                    onDelete?.();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50"
                >
                  {t("common.delete")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {post.photoUrls?.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {post.photoUrls.slice(0, 6).map((url, idx) => (
            <div key={`${post.id}-photo-${idx}`} className="overflow-hidden rounded-xl border border-[#EDD5C0] bg-white">
              <img src={url} alt={`${post.authorName} daily photo ${idx + 1}`} className="h-24 w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#2C1A0E]">{displayBody}</p>

      <div className="mt-3 flex items-center gap-4 text-[12px] font-semibold text-[#A0522D]/70">
        {allowLike ? (
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike?.();
            }}
            whileTap={{ scale: 0.96 }}
            animate={animateLike ? { scale: [0.8, 1.1, 1.0] } : { scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="inline-flex items-center gap-1"
          >
            <Heart className="h-3.5 w-3.5" fill={liked ? "#A0522D" : "transparent"} color={liked ? "#A0522D" : "currentColor"} />{" "}
            {likeCount}
          </motion.button>
        ) : (
          <span className="inline-flex cursor-default items-center gap-1 opacity-45" aria-label={t("explore.like")}>
            <Heart className="h-3.5 w-3.5" fill={liked ? "#A0522D" : "transparent"} color={liked ? "#A0522D" : "currentColor"} />{" "}
            {likeCount}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {commentCount}
        </span>
      </div>
    </article>
  );
}

type StoredComment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  likedBy: string[];
  /** Total likes from Supabase when available; falls back to likedBy.length. */
  likesCount?: number;
  /** From `profiles.image_url` when available. */
  authorImageUrl?: string | null;
};

function dailyCommentsStorageKey(postId: string) {
  return `inbite:daily-bite-comments:v1:${postId}`;
}

function loadStoredComments(postId: string): StoredComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(dailyCommentsStorageKey(postId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistStoredComments(postId: string, rows: StoredComment[]) {
  window.localStorage.setItem(dailyCommentsStorageKey(postId), JSON.stringify(rows));
}

function mapRemoteCommentToStored(r: RemoteDailyBiteCommentRow): StoredComment {
  return {
    id: r.id,
    authorId: r.author_clerk_id,
    authorName: r.author_name?.trim() || "Someone",
    text: r.body,
    createdAt: r.created_at,
    likedBy: [],
    likesCount: 0,
    authorImageUrl: null,
  };
}

function mergeCommentThreads(local: StoredComment[], remote: StoredComment[]): StoredComment[] {
  const map = new Map<string, StoredComment>();
  for (const row of remote) {
    const prevLocal = local.find((l) => l.id === row.id);
    map.set(row.id, {
      ...row,
      likedBy: prevLocal?.likedBy?.length ? prevLocal.likedBy : row.likedBy,
      likesCount:
        typeof prevLocal?.likesCount === "number" && (prevLocal.likesCount ?? 0) > (row.likesCount ?? 0)
          ? prevLocal.likesCount
          : row.likesCount,
      authorImageUrl: row.authorImageUrl ?? prevLocal?.authorImageUrl,
    });
  }
  for (const row of local) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    return ta - tb;
  });
}

function DailyBiteCommentsSection({
  postId,
  postAuthorClerkId,
  onRequireAuth,
  getToken,
  onReward,
  onCommentTotalChange,
}: {
  postId: string;
  postAuthorClerkId?: string | null;
  onRequireAuth?: (kind: LoginPromptKind) => boolean;
  getToken: ReturnType<typeof useAuth>["getToken"];
  onReward?: () => void;
  onCommentTotalChange?: (total: number) => void;
}) {
  const { t } = useTranslation("common");
  const { user } = useUser();
  const { openUserProfile } = useUserProfilePreview();
  const [avatarMapTick, setAvatarMapTick] = useState(0);
  const [comments, setComments] = useState<StoredComment[]>(() => loadStoredComments(postId));
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const commentLikeHydrationGeneration = useRef(0);

  useEffect(() => {
    setComments(loadStoredComments(postId));
    setDraft("");
    setMsg(null);
  }, [postId]);

  useEffect(() => subscribeProfileAvatarSync(() => setAvatarMapTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    const baseline = commentLikeHydrationGeneration.current;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        const local = loadStoredComments(postId);
        let merged: StoredComment[];
        if (token) {
          const remoteRows = await fetchDailyBiteComments(token, postId);
          const remote = remoteRows.map(mapRemoteCommentToStored);
          merged = mergeCommentThreads(local, remote);
        } else {
          merged = local;
        }
        if (cancelled) return;
        let mergedForUi = merged;
        if (token) {
          const clerkIds = [...new Set(merged.map((c) => c.authorId).filter((id) => id.startsWith("user_")))];
          if (clerkIds.length) {
            const imgMap = new Map<string, string | null>();
            await Promise.all(
              clerkIds.map(async (cid) => {
                const row = await fetchPublicProfileByClerkId(cid, token);
                imgMap.set(cid, row?.image_url?.trim() || null);
              }),
            );
            if (cancelled) return;
            mergedForUi = merged.map((c) => ({
              ...c,
              authorImageUrl: imgMap.get(c.authorId) ?? c.authorImageUrl,
            }));
          }
        }
        if (cancelled) return;
        // Avoid wiping in-flight optimistic updates (e.g. comment like): the follow-up
        // `myLikes` patch is skipped when generation changes, so this first `setComments`
        // must not replace fresher React state with a stale `mergedForUi` snapshot.
        if (baseline !== commentLikeHydrationGeneration.current) {
          setComments((prev) => mergeCommentThreads(prev, mergedForUi));
        } else {
          setComments(mergedForUi);
        }

        if (!token || !user?.id) return;
        const ids = mergedForUi.map((c) => c.id);
        if (!ids.length) return;
        const [counts, myLikes] = await Promise.all([
          fetchLikeCountsForComments(token, ids),
          fetchMyLikedCommentIds(token, postId, user.id, ids),
        ]);
        if (cancelled) return;
        if (baseline !== commentLikeHydrationGeneration.current) return;
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            likesCount: counts.get(c.id) ?? c.likedBy.length,
            likedBy: myLikes.has(c.id)
              ? Array.from(new Set([...c.likedBy.filter((x) => x !== user.id), user.id]))
              : c.likedBy.filter((x) => x !== user.id),
          })),
        );
      } catch {
        if (!cancelled) setComments(loadStoredComments(postId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, postId, user?.id]);

  /** Other devices/tabs: new rows on `daily_bite_comments` (enable table in Supabase → Realtime). */
  useEffect(() => {
    let cancelled = false;
    let removeChannel: (() => void) | undefined;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const supabase = getSupabaseClient(token);
        if (!supabase) return;
        const channel = supabase
          .channel(`daily-bite-comments:${postId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "daily_bite_comments",
              filter: `post_id=eq.${postId}`,
            },
            (payload) => {
              const raw = payload.new as Record<string, unknown>;
              if (!raw?.id || typeof raw.id !== "string") return;
              const row: RemoteDailyBiteCommentRow = {
                id: raw.id,
                author_clerk_id: String(raw.author_clerk_id ?? ""),
                author_name: String(raw.author_name ?? ""),
                body: String(raw.body ?? ""),
                created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
              };
              const mapped = mapRemoteCommentToStored(row);
              setComments((prev) => {
                if (prev.some((c) => c.id === mapped.id)) return prev;
                return mergeCommentThreads(prev, [mapped]);
              });
              void (async () => {
                try {
                  const t2 = await getToken({ template: "supabase" });
                  const me = user?.id;
                  if (!t2 || !me) return;
                  const [count, mySet] = await Promise.all([
                    fetchCommentLikeCount(t2, mapped.id),
                    fetchMyLikedCommentIds(t2, postId, me, [mapped.id]),
                  ]);
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === mapped.id
                        ? {
                            ...c,
                            likesCount: count,
                            likedBy: mySet.has(mapped.id)
                              ? Array.from(new Set([...c.likedBy.filter((x) => x !== me), me]))
                              : c.likedBy.filter((x) => x !== me),
                          }
                        : c,
                    ),
                  );
                  if (mapped.authorId.startsWith("user_")) {
                    const prof = await fetchPublicProfileByClerkId(mapped.authorId, t2);
                    const img = prof?.image_url?.trim();
                    if (img) {
                      setComments((prev) =>
                        prev.map((c) => (c.id === mapped.id ? { ...c, authorImageUrl: img } : c)),
                      );
                    }
                  }
                } catch {
                  // optional
                }
              })();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "daily_bite_comments",
              filter: `post_id=eq.${postId}`,
            },
            (payload) => {
              const raw = payload.old as Record<string, unknown> | null;
              const id = raw && typeof raw.id === "string" ? raw.id : null;
              if (!id) return;
              setComments((prev) => prev.filter((c) => c.id !== id));
            },
          )
          .subscribe();
        removeChannel = () => {
          void supabase.removeChannel(channel);
        };
      } catch {
        // Realtime not enabled or table missing
      }
    })();
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [getToken, postId, user?.id]);

  useEffect(() => {
    persistStoredComments(postId, comments);
    onCommentTotalChange?.(comments.length);
    // Parent may pass an inline handler; avoid re-running on identity change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, postId]);

  if (!user?.id) return null;

  const rewardKey = `inbite:comment-reward:${user.id}:${postId}`;
  const actorName = user.firstName?.trim() || user.username || "Someone";

  const pushRemote = (row: Parameters<typeof insertNotificationRemote>[1]) => {
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (token) await insertNotificationRemote(token, row);
      } catch {
        // ignore
      }
    })();
  };

  const submit = async () => {
    if (!draft.trim() || submitBusy) return;
    const trimmed = draft.trim();
    const alreadyRewarded = window.localStorage.getItem(rewardKey) === "1";
    const replyMatch = trimmed.match(/^@([^\s]+)\s*/);
    const isReply = Boolean(replyMatch);
    const replyTargetName = replyMatch?.[1];
    const targetComment = replyTargetName
      ? comments.find((c) => c.authorName === replyTargetName)
      : undefined;

    setSubmitBusy(true);
    setMsg(null);

    let row: StoredComment;
    try {
      const token = await getToken({ template: "supabase" });
      if (token) {
        const inserted = await insertDailyBiteComment(token, {
          postId,
          authorClerkId: user.id,
          authorName: actorName,
          body: trimmed,
        });
        if (inserted) {
          row = {
            id: inserted.id,
            authorId: user.id,
            authorName: actorName,
            text: trimmed,
            createdAt: inserted.createdAt,
            likedBy: [],
            likesCount: 0,
            authorImageUrl: user.imageUrl ?? null,
          };
        } else {
          row = {
            id: crypto.randomUUID(),
            authorId: user.id,
            authorName: actorName,
            text: trimmed,
            createdAt: new Date().toISOString(),
            likedBy: [],
            likesCount: 0,
            authorImageUrl: user.imageUrl ?? null,
          };
          setMsg(t("explore.commentSavedLocalOnly"));
        }
      } else {
        row = {
          id: crypto.randomUUID(),
          authorId: user.id,
          authorName: actorName,
          text: trimmed,
          createdAt: new Date().toISOString(),
          likedBy: [],
          likesCount: 0,
          authorImageUrl: user.imageUrl ?? null,
        };
      }
    } catch {
      row = {
        id: crypto.randomUUID(),
        authorId: user.id,
        authorName: actorName,
        text: trimmed,
        createdAt: new Date().toISOString(),
        likedBy: [],
        likesCount: 0,
        authorImageUrl: user.imageUrl ?? null,
      };
      setMsg(t("explore.commentSavedLocalOnly"));
    } finally {
      setSubmitBusy(false);
    }

    setComments((prev) => [...prev, row]);
    setDraft("");

    try {
      const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;

      if (
        isReply &&
        targetComment &&
        targetComment.authorId !== user.id &&
        targetComment.authorId !== postAuthorClerkId
      ) {
        const content = t("explore.notifyReplyPeer", { name: actorName });
        pushRemote({
          type: "reply",
          actor_id: user.id,
          target_id: targetComment.authorId,
          content,
          post_id: postId,
          comment_id: row.id,
        });
      }
    } catch {
      // Notifications are best-effort; comment text is already persisted locally.
    }

    if (!alreadyRewarded) {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token) {
          window.dispatchEvent(
            new CustomEvent("inbite-apply-bite", {
              detail: {
                clerkId: user.id,
                delta: BITE_REWARD_COMMENT,
                kind: "comment",
                meta: { post_id: postId },
              },
            }),
          );
        } else {
          await applyBiteDeltaServer(user.id, token, BITE_REWARD_COMMENT, "comment", { post_id: postId });
        }
        window.localStorage.setItem(rewardKey, "1");
        onReward?.();
      } catch (rewardErr) {
        console.warn("BITE comment reward failed", rewardErr);
        setMsg(t("explore.rewardFailSoft"));
      }
    }
  };

  const deleteMyComment = async (comment: StoredComment) => {
    if (comment.authorId !== user.id) return;
    if (deleteBusyId) return;
    if (!window.confirm(t("explore.commentDeleteConfirm"))) return;

    commentLikeHydrationGeneration.current += 1;
    const snapshot = comments;
    setDeleteBusyId(comment.id);
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      const token = await getToken({ template: "supabase" });
      if (token) {
        const ok = await deleteDailyBiteComment(token, comment.id);
        if (!ok) {
          setComments(snapshot);
          toast.error(t("explore.commentDeleteFailed"));
        }
      }
    } catch {
      setComments(snapshot);
      toast.error(t("explore.commentDeleteFailed"));
    } finally {
      setDeleteBusyId(null);
    }
  };

  const toggleCommentLike = async (comment: StoredComment) => {
    if (onRequireAuth && !onRequireAuth("sharing")) return;
    if (!user.id) return;
    commentLikeHydrationGeneration.current += 1;
    const liked = comment.likedBy.includes(user.id);
    const nextLiked = liked ? comment.likedBy.filter((id) => id !== user.id) : [...comment.likedBy, user.id];
    const optimisticCount = (comment.likesCount ?? comment.likedBy.length) + (liked ? -1 : 1);

    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== comment.id) return c;
        return { ...c, likedBy: nextLiked, likesCount: Math.max(0, optimisticCount) };
      }),
    );

    try {
      const token = await getToken({ template: "supabase" });
      if (token) {
        await setCommentLikeRemote(token, postId, comment.id, user.id, !liked);
        const count = await fetchCommentLikeCount(token, comment.id);
        setComments((prev) =>
          prev.map((c) => (c.id === comment.id ? { ...c, likesCount: count, likedBy: nextLiked } : c)),
        );
      }
    } catch (err) {
      // Keep optimistic UI state even when remote sync fails, so likes don't "flash then revert".
      console.warn("[DailyBiteComments] comment like sync failed; keeping optimistic state", err);
    }

    if (!liked && comment.authorId !== user.id) {
      const content = t("explore.notifyCommentLike", { name: actorName });
      pushRemote({
        type: "comment_like",
        actor_id: user.id,
        target_id: comment.authorId,
        content,
        post_id: postId,
        comment_id: comment.id,
      });
    }
  };

  const replyTo = (name: string) => {
    setDraft(`@${name} `);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  return (
    <>
      <div className="mt-8 space-y-3">
        {comments.map((c) => {
          const liked = c.likedBy.includes(user.id);
          const likeTotal = c.likesCount ?? c.likedBy.length;
          const avatarSrc = getProfileAvatar(c.authorId) || c.authorImageUrl || undefined;
          const canOpen = c.authorId.startsWith("user_");
          const isMine = c.authorId === user.id;
          return (
            <div key={c.id} className="rounded-xl border border-[#EDE4DB] bg-white/75 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  disabled={!canOpen}
                  className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#EDD5C0] bg-[#F0E4D8] disabled:cursor-default"
                  onClick={() => {
                    if (!canOpen) return;
                    openUserProfile({
                      clerkId: c.authorId,
                      fallbackDisplayName: c.authorName,
                      fallbackImageUrl: avatarSrc,
                    });
                  }}
                  aria-label={canOpen ? t("profilePreview.viewProfileAria", { name: c.authorName }) : undefined}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#A0522D]/50">
                      {(c.authorName || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!canOpen}
                    onClick={() => {
                      if (!canOpen) return;
                      openUserProfile({
                        clerkId: c.authorId,
                        fallbackDisplayName: c.authorName,
                        fallbackImageUrl: avatarSrc,
                      });
                    }}
                    className={`text-left text-[12px] font-semibold text-[#A0522D]/85 disabled:cursor-default ${
                      canOpen ? "hover:underline" : ""
                    }`}
                  >
                    {c.authorName}
                  </button>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#2C1A0E]">{c.text}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#A0522D]/45">
                <button
                  type="button"
                  aria-pressed={liked}
                  aria-label={liked ? t("explore.commentUnlikeAria") : t("explore.commentLikeAria")}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleCommentLike(c);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-0.5 py-0.5 font-medium transition ${
                    liked ? "text-[#A0522D]" : "text-[#A0522D]/55 hover:text-[#A0522D]/85"
                  }`}
                >
                  <Heart
                    className="h-4 w-4 shrink-0"
                    strokeWidth={liked ? 0 : 2}
                    fill={liked ? "#A0522D" : "transparent"}
                    color="#A0522D"
                  />
                  <span>{t("explore.like")}</span>
                  <span className="tabular-nums text-[#A0522D]/50">· {likeTotal}</span>
                </button>
                <button
                  type="button"
                  onClick={() => replyTo(c.authorName)}
                  className="font-medium hover:text-[#A0522D]/70"
                >
                  {t("explore.reply")}
                </button>
                {isMine ? (
                  <button
                    type="button"
                    disabled={deleteBusyId === c.id}
                    aria-label={t("explore.deleteMyCommentAria")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteMyComment(c);
                    }}
                    className="inline-flex items-center gap-1 font-medium text-[#A0522D]/45 hover:text-red-700/90 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {t("explore.deleteMyComment")}
                  </button>
                ) : null}
              </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-[#EDD5C0] bg-white/70 p-3">
        <div className="text-[12px] font-semibold text-[#A0522D]/80">{t("explore.commentLabel")}</div>
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-2.5 h-16 w-full resize-none rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] outline-none"
          placeholder={t("explore.commentPlaceholder")}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitBusy}
          className="mt-2 w-full rounded-xl bg-[#A0522D] py-2 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {submitBusy ? "…" : t("explore.postComment")}
        </button>
        {msg ? <p className="mt-2 text-[11px] text-[#A0522D]/75">{msg}</p> : null}
      </div>
    </>
  );
}

const INCLUDED_LABEL_MAP: Record<string, IncludedItem> = {
  meal: { id: "meal", labelKo: "Meal", emoji: "🍽️" },
  coffee: { id: "coffee", labelKo: "Coffee", emoji: "☕" },
  dessert: { id: "dessert", labelKo: "Dessert", emoji: "🍰" },
  transport: { id: "transport", labelKo: "Transport", emoji: "🚕" },
  admission: { id: "admission", labelKo: "Admission ticket", emoji: "🎟️" },
  tea: { id: "tea", labelKo: "Tea", emoji: "☕" },
  guidebook: { id: "guidebook", labelKo: "Guidebook", emoji: "📖" },
  souvenir: { id: "souvenir", labelKo: "Souvenir", emoji: "🎁" },
};

function mapLocalInviteToExperience(
  invite: LocalInvite,
  myClerkId?: string | null,
  myAvatarUrl?: string,
  myDisplayName?: string,
): Experience {
  const [cityRaw = invite.location, countryRaw = ""] = invite.location.split(",");
  const city = cityRaw.trim();
  const country = countryRaw.trim() || "Local";
  const itinerary = Array.isArray(invite.itinerary) ? invite.itinerary : [];
  const includedIds = invite.includedOptions ?? [];
  const includedItems = includedIds.map((id) => INCLUDED_LABEL_MAP[id]).filter(Boolean);

  const ownerClerkId = invite.hostClerkId ?? myClerkId ?? undefined;
  const isOwnInvite = Boolean(ownerClerkId && myClerkId && ownerClerkId === myClerkId);
  const hostName =
    invite.hostDisplayName ??
    (isOwnInvite ? myDisplayName || "Surim Cha" : "Host");
  const hostAvatarUrl =
    invite.hostClerkId && invite.hostClerkId !== myClerkId
      ? getProfileAvatar(invite.hostClerkId) || undefined
      : myAvatarUrl;

  return {
    id: invite.id,
    title: invite.title,
    hostName,
    hostClerkId: ownerClerkId,
    hostAvatarUrl,
    coverPhotoUrl: invite.primaryPhotoUrl,
    city,
    country,
    tasteTags: invite.tasteTags?.length ? invite.tasteTags : ["Cafe Hopping"],
    priceAmount: invite.priceAmount,
    hostCurrency: invite.hostCurrency,
    rating: 5.0,
    reviews: 1,
    createdAt: invite.createdAt,
    about: invite.description,
    aboutDetailKo: invite.description,
    durationLabel: `${Math.max(1, itinerary.length)} stops`,
    maxGuestsLabel: "Up to 6 guests",
    included: includedIds,
    includedItems,
    itinerary: itinerary.map((stop) => ({
      time: stop.time,
      title: stop.title,
      description: stop.description,
    })),
  };
}

function getIncludedLabelEnglish(id: string, fallback: string): string {
  const normalized = id.toLowerCase();
  if (normalized === "meal" || normalized.includes("meal")) return "Meal";
  if (normalized === "coffee") return "Coffee";
  if (normalized === "dessert") return "Dessert";
  if (normalized.includes("entrance") || normalized.includes("admission")) return "Admission ticket";
  if (normalized.includes("tea")) return "Tea";
  if (normalized.includes("transport")) return "Transport";
  if (normalized.includes("guide")) return "Guidebook";
  if (normalized.includes("souvenir")) return "Souvenir";
  return fallback;
}

function mapInviteRowToLocalInvite(row: InviteRow): LocalInvite {
  const location = row.location ?? "";
  const [cityRaw = location] = location.split(",");
  return {
    id: row.id,
    title: row.title ?? "",
    location,
    city: cityRaw.trim(),
    locationDetail: "",
    description: row.description ?? "",
    primaryPhotoUrl: row.primary_photo_url ?? "",
    itinerary: Array.isArray(row.itinerary) ? row.itinerary : [],
    tasteTags: Array.isArray(row.taste_tags) ? row.taste_tags : [],
    includedOptions: Array.isArray(row.included_options) ? row.included_options : [],
    hostClerkId: typeof row.clerk_id === "string" ? row.clerk_id : undefined,
    priceAmount: Number(row.price_amount ?? 0),
    hostCurrency:
      typeof row.host_currency === "string" && isSelectableCurrency(row.host_currency)
        ? row.host_currency
        : "KRW",
    capacity: Number(row.capacity ?? 2),
    meetupAt: row.meetup_at ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

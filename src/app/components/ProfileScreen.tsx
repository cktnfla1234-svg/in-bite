import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { ProfileEditSheet, type EditableProfile } from "./ProfileEditSheet";
import { WalletOverlay } from "./WalletOverlay";
import {
  fetchBitesHistory,
  type BiteHistoryRow,
  fetchExtendedProfile,
  saveExtendedProfile,
} from "@/lib/profile";
import { compressDataUrlList } from "@/lib/imageCompress";
import { getWalletBalance, roundBiteDisplay, WALLET_BALANCE_SYNC } from "@/lib/wallet";
import { hasCreatedHostedTour } from "@/lib/hostedTours";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { GoogleLogo, KakaoLogo, NaverLogo } from "./ui/SocialLogos";
import { GOOGLE_OAUTH_STRATEGY, KAKAO_OAUTH_STRATEGY, NAVER_OAUTH_STRATEGY } from "@/lib/authStrategies";
import {
  deleteLocalInvite,
  getLocalInvites,
  subscribeLocalInvitesSync,
  updateLocalInvite,
  type LocalInviteItineraryItem,
  type LocalInvite,
} from "@/lib/localInvites";
import { updateInvite } from "@/lib/invites";
import { SELECTABLE_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import i18n from "@/lib/i18n/config";
import { getCountryNameEn } from "@/lib/locations/dataset";
import { formatProfileLocationDisplay } from "@/lib/locations/profileDisplay";
import { migrateEditableProfileLocation } from "@/lib/locations/profileMigration";
import { normalizeAppLocale } from "@/lib/i18n/appLocales";
import { setProfileAvatar } from "@/lib/profileAvatarStore";
import {
  getLocalDailyBites,
  subscribeLocalDailyBitesSync,
  toDailyBitePost,
  updateLocalDailyBiteAuthorAvatar,
} from "@/lib/localDailyBites";
import { fetchOwnDailyBites } from "@/lib/remoteDailyBites";
import type { DailyBitePost } from "@/data/experiences";

type ProfileScreenProps = {
  onOpenCreateTour?: () => void;
};

export function ProfileScreen({ onOpenCreateTour }: ProfileScreenProps) {
  const { t, i18n } = useTranslation("common");
  const uiLocale = normalizeAppLocale(i18n.language);
  const { user } = useUser();
  const { getToken } = useAuth();
  const { preferredCurrency, persistPreferredCurrency } = usePreferredCurrency();
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const { signOut } = useClerk();
  const [editOpen, setEditOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [biteHistory, setBiteHistory] = useState<BiteHistoryRow[]>([]);
  const [historyTab, setHistoryTab] = useState<"invitee" | "invitor">("invitee");
  const [showShareDailyCta, setShowShareDailyCta] = useState(() => !hasCreatedHostedTour());
  const [socialConnecting, setSocialConnecting] = useState<"kakao" | "naver" | "google" | null>(null);
  const [socialConnectError, setSocialConnectError] = useState<string | null>(null);
  const [inviteeHistory, setInviteeHistory] = useState<LocalInvite[]>([]);
  const [myDailyBites, setMyDailyBites] = useState<DailyBitePost[]>([]);
  const [editingInviteId, setEditingInviteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingLocation, setEditingLocation] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingPriceAmount, setEditingPriceAmount] = useState(45000);
  const [editingCapacity, setEditingCapacity] = useState(2);
  const [editingMeetupAt, setEditingMeetupAt] = useState("");
  const [editingTasteTags, setEditingTasteTags] = useState<string[]>([]);
  const [editingTimeline, setEditingTimeline] = useState<LocalInviteItineraryItem[]>([]);
  const [editingInviteSaving, setEditingInviteSaving] = useState(false);
  const lastMergedServerProfileUserIdRef = useRef<string | null>(null);

  const TASTE_TAG_OPTIONS = [
    "Cafe Hopping",
    "Night Markets",
    "Art & Culture",
    "Street Food",
    "Vegetarian Friendly",
    "Vegan Spots",
    "Slow Travel",
    "Hidden Local Places",
    "Photography Walks",
    "Live Music",
  ];
  const [profile, setProfile] = useState<EditableProfile>({
    name: "",
    countryCode: "KR",
    country: getCountryNameEn("KR"),
    city: "Seoul",
    address: "",
    mbti: "ENTP",
    hobbies: "",
    bio: "",
    profilePhoto: "",
    photos: [],
  });

  const invitorHistory: { title: string; meta: string; badge: string; status: string }[] = [];

  useEffect(() => {
    if (!user?.id) {
      setBalance(0);
      return;
    }
    const sync = () => {
      setBalance(getWalletBalance(user.id));
    };
    sync();
    const onWalletEvent = () => sync();
    window.addEventListener(WALLET_BALANCE_SYNC, onWalletEvent);
    return () => {
      window.removeEventListener(WALLET_BALANCE_SYNC, onWalletEvent);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!walletOpen || !user?.id) return;
    let cancelled = false;
    void (async () => {
      setBalance(getWalletBalance(user.id));
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const rows = await fetchBitesHistory(user.id, token);
        if (!cancelled) setBiteHistory(rows);
      } catch {
        if (!cancelled) setBiteHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletOpen, user?.id, getToken]);

  useEffect(() => {
    const syncInvites = () => {
      setInviteeHistory(getLocalInvites());
    };
    syncInvites();
    return subscribeLocalInvitesSync(syncInvites);
  }, []);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setMyDailyBites([]);
      return;
    }

    let cancelled = false;
    const sync = () => {
      const mine = getLocalDailyBites()
        .filter((b) => b.authorClerkId === uid)
        .map((b) => toDailyBitePost(b));
      setMyDailyBites(mine);
    };
    sync();
    const unsub = subscribeLocalDailyBitesSync(sync);

    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const remote = await fetchOwnDailyBites(token, uid, 120);
        if (cancelled) return;
        setMyDailyBites((prev) => {
          const map = new Map<string, DailyBitePost>();
          for (const p of remote) map.set(p.id, p);
          for (const p of prev) if (!map.has(p.id)) map.set(p.id, p);
          return [...map.values()].sort((a, b) => {
            const ta = Date.parse(a.createdAtIso ?? "") || 0;
            const tb = Date.parse(b.createdAtIso ?? "") || 0;
            return tb - ta;
          });
        });
      } catch {
        // fallback to local list only
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [getToken, user?.id]);

  useEffect(() => {
    const storageKey = `inbite:profile:${user?.id ?? "guest"}`;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<EditableProfile> & { countryCode?: string };
        const loc = migrateEditableProfileLocation(parsed);
        setProfile({
          name: parsed.name ?? "",
          countryCode: loc.countryCode,
          country: getCountryNameEn(loc.countryCode),
          city: loc.city,
          address: (parsed as Partial<EditableProfile>).address ?? "",
          mbti: parsed.mbti ?? "ENTP",
          hobbies: parsed.hobbies ?? "",
          bio: parsed.bio ?? "",
          profilePhoto: (parsed as Partial<EditableProfile>).profilePhoto ?? "",
          photos: (parsed as Partial<EditableProfile>).photos ?? [],
        });
        return;
      } catch {
        // Ignore broken cache and fall back to defaults
      }
    }

    const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    setProfile({
      name: fallbackName,
      countryCode: "KR",
      country: getCountryNameEn("KR"),
      city: "Seoul",
      address: "",
      mbti: "ENTP",
      hobbies: "",
      bio: "",
      profilePhoto: "",
      photos: [],
    });
  }, [user?.firstName, user?.id, user?.lastName]);

  useEffect(() => {
    if (!user?.id) lastMergedServerProfileUserIdRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (lastMergedServerProfileUserIdRef.current === user.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const row = await fetchExtendedProfile(user.id, token);
        if (cancelled) return;
        lastMergedServerProfileUserIdRef.current = user.id;
        if (!row) return;

        setProfile((prev) => {
          const galleryRaw = row.profile_gallery;
          let gallery: string[] = [];
          if (Array.isArray(galleryRaw)) {
            gallery = galleryRaw.filter((x): x is string => typeof x === "string");
          } else if (typeof galleryRaw === "string" && galleryRaw.trim()) {
            try {
              const parsed = JSON.parse(galleryRaw) as unknown;
              if (Array.isArray(parsed)) {
                gallery = parsed.filter((x): x is string => typeof x === "string");
              }
            } catch {
              // ignore
            }
          }

          const img = row.image_url;
          const hasRemote =
            Boolean(row.display_name?.trim()) ||
            Boolean(row.profile_bio?.trim()) ||
            Boolean(row.profile_city?.trim()) ||
            gallery.length > 0 ||
            (typeof img === "string" && img.trim().length > 0);

          if (!hasRemote) return prev;

          const ccRaw = row.profile_country_code;
          const cc =
            typeof ccRaw === "string" && ccRaw.trim() ? ccRaw.trim().toUpperCase() : prev.countryCode;

          const remotePhoto =
            typeof img === "string" && img.startsWith("data:")
              ? img
              : typeof img === "string" && img.startsWith("http") && !prev.profilePhoto
                ? img
                : prev.profilePhoto;

          const next: EditableProfile = {
            ...prev,
            name: row.display_name?.trim() ? String(row.display_name).trim() : prev.name,
            city: row.profile_city?.trim() ? String(row.profile_city).trim() : prev.city,
            countryCode: cc,
            country: getCountryNameEn(cc),
            address: row.profile_address != null ? String(row.profile_address) : prev.address,
            mbti: row.profile_mbti?.trim() ? String(row.profile_mbti).trim() : prev.mbti,
            hobbies: row.profile_hobbies != null ? String(row.profile_hobbies) : prev.hobbies,
            bio: row.profile_bio != null ? String(row.profile_bio) : prev.bio,
            profilePhoto: remotePhoto || prev.profilePhoto,
            photos: gallery.length ? gallery : prev.photos,
          };

          try {
            window.localStorage.setItem(`inbite:profile:${user.id}`, JSON.stringify(next));
          } catch {
            // ignore quota on cache refresh
          }
          return next;
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, getToken]);

  useEffect(() => {
    if (!user?.id) return;
    const image = profile.profilePhoto || user.imageUrl || "";
    if (image) setProfileAvatar(user.id, image);
  }, [profile.profilePhoto, user?.id, user?.imageUrl]);

  async function persistProfileToLocalStorage(storageKey: string, payload: EditableProfile): Promise<EditableProfile> {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      return payload;
    } catch (e) {
      if (!(e instanceof DOMException) || e.name !== "QuotaExceededError") {
        throw e instanceof Error ? e : new Error("Could not save profile locally.");
      }
      const parts: string[] = [];
      if (payload.profilePhoto) parts.push(payload.profilePhoto);
      for (const p of payload.photos) {
        if (p) parts.push(p);
      }
      const tiny = await compressDataUrlList(parts, 720, 0.62);
      let j = 0;
      const profilePhoto = payload.profilePhoto ? tiny[j++]! : "";
      const photos: string[] = [];
      for (const p of payload.photos) {
        photos.push(p ? tiny[j++]! : "");
      }
      const lean: EditableProfile = { ...payload, profilePhoto, photos };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(lean));
        return lean;
      } catch {
        throw new Error(
          "Profile is too large for this device’s storage. Remove a gallery photo or use smaller images.",
        );
      }
    }
  }

  const handleSaveProfile = async (next: EditableProfile) => {
    const uid = user?.id;
    const storageKey = `inbite:profile:${uid ?? "guest"}`;

    const parts: string[] = [];
    if (next.profilePhoto) parts.push(next.profilePhoto);
    for (const p of next.photos) {
      if (p) parts.push(p);
    }
    const compressed = await compressDataUrlList(parts, 1280, 0.78);
    let i = 0;
    const profilePhoto = next.profilePhoto ? compressed[i++]! : "";
    const photos: string[] = [];
    for (const p of next.photos) {
      photos.push(p ? compressed[i++]! : "");
    }
    const toSave: EditableProfile = { ...next, profilePhoto, photos };

    const stored = await persistProfileToLocalStorage(storageKey, toSave);
    setProfile(stored);

    if (uid) {
      setProfileAvatar(uid, stored.profilePhoto);
      updateLocalDailyBiteAuthorAvatar(uid, stored.profilePhoto);
      const token = await getToken({ template: "supabase" });
      if (token) {
        try {
          await saveExtendedProfile(uid, token, {
            name: stored.name,
            city: stored.city,
            countryCode: stored.countryCode,
            address: stored.address,
            mbti: stored.mbti,
            hobbies: stored.hobbies,
            bio: stored.bio,
            profilePhoto: stored.profilePhoto,
            photos: stored.photos,
          });
        } catch (err) {
          const msg =
            err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
              ? String((err as { message: string }).message)
              : "";
          if (msg.includes("column") || msg.includes("schema")) {
            throw new Error(
              "Server profile storage is not set up yet. Ask the team to run the Supabase migration for extended profile fields.",
            );
          }
          throw err instanceof Error ? err : new Error("Could not sync profile to the server.");
        }
      }
    }
  };

  const connectedProviders = useMemo(() => {
    const providers = new Set<string>();
    for (const account of user?.externalAccounts ?? []) {
      const provider = String((account as { provider?: unknown }).provider ?? "").toLowerCase();
      providers.add(provider);
    }
    return providers;
  }, [user?.externalAccounts]);

  const isKakaoConnected = useMemo(
    () => connectedProviders.has("kakao") || connectedProviders.has("oauth_kakao"),
    [connectedProviders],
  );
  const isNaverConnected = useMemo(
    () => connectedProviders.has("naver") || connectedProviders.has("oauth_naver"),
    [connectedProviders],
  );
  const isGoogleConnected = useMemo(
    () => connectedProviders.has("google") || connectedProviders.has("oauth_google"),
    [connectedProviders],
  );

  const connectSocial = async (provider: "kakao" | "naver" | "google") => {
    if (!user) return;
    setSocialConnectError(null);
    setSocialConnecting(provider);
    try {
      const strategy =
        provider === "kakao"
          ? KAKAO_OAUTH_STRATEGY
          : provider === "naver"
            ? NAVER_OAUTH_STRATEGY
            : GOOGLE_OAUTH_STRATEGY;
      await user.createExternalAccount({
        strategy: strategy as never,
        redirectUrl: window.location.href,
      });
    } catch (err) {
      setSocialConnectError(err instanceof Error ? err.message : t("profile.socialFailed"));
    } finally {
      setSocialConnecting(null);
    }
  };

  const startEditInvite = (invite: LocalInvite) => {
    setEditingInviteId(invite.id);
    setEditingTitle(invite.title);
    setEditingLocation(invite.location);
    setEditingDescription(invite.description);
    setEditingPriceAmount(invite.priceAmount ?? 45000);
    setEditingCapacity(invite.capacity ?? 2);
    setEditingMeetupAt(invite.meetupAt ?? "");
    setEditingTasteTags(invite.tasteTags ?? []);
    setEditingTimeline(invite.itinerary ?? []);
  };

  const saveEditedInvite = async () => {
    if (!editingInviteId) return;
    const [cityRaw = editingLocation] = editingLocation.split(",");
    const patch: Partial<LocalInvite> = {
      title: editingTitle.trim() || t("profile.untitledBite"),
      location: editingLocation.trim(),
      city: cityRaw.trim(),
      description: editingDescription.trim(),
      priceAmount: Math.max(0, editingPriceAmount || 0),
      capacity: Math.max(1, editingCapacity || 1),
      meetupAt: editingMeetupAt,
      tasteTags: editingTasteTags.length ? editingTasteTags : ["Cafe Hopping"],
      itinerary: editingTimeline.length
        ? editingTimeline
        : [{ time: "", title: "", description: "" }],
    };
    updateLocalInvite(editingInviteId, patch);
    setEditingInviteSaving(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (token) {
        await updateInvite(
          editingInviteId,
          {
            title: String(patch.title),
            location: String(patch.location),
            primaryPhotoUrl:
              inviteeHistory.find((x) => x.id === editingInviteId)?.primaryPhotoUrl ?? "",
            description: String(patch.description),
            itinerary: (patch.itinerary ?? []).map((item) => ({
              time: item.time,
              title: item.title,
              description: item.description,
            })),
            tasteTags: patch.tasteTags ?? [],
            includedOptions:
              inviteeHistory.find((x) => x.id === editingInviteId)?.includedOptions ?? [],
            priceAmount: Number(patch.priceAmount ?? 0),
            hostCurrency:
              inviteeHistory.find((x) => x.id === editingInviteId)?.hostCurrency ?? "KRW",
            capacity: Number(patch.capacity ?? 2),
            meetupAt: String(patch.meetupAt ?? ""),
          },
          token,
        );
      }
    } catch {
      // keep optimistic local update
    } finally {
      setEditingInviteSaving(false);
    }
    setEditingInviteId(null);
  };

  return (
    <main className="relative min-h-[100svh] bg-[#FDFAF5] pb-24 pt-6">
      <div className="px-5">
        <div
          className="text-[26px] font-semibold text-[#A0522D]"
          style={{ fontFamily: "'Patrick Hand', cursive" }}
        >
          {t("profile.title")}
        </div>

        <div className="mt-5 rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-[#E7D7C7] border-2 border-white/70">
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-[#C4A882] flex items-center justify-center">
                    <span aria-hidden="true">🐻</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="absolute ml-10 mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#A0522D] text-white shadow-[0_18px_45px_rgba(160,82,45,0.25)]"
              aria-label={t("profile.editProfileAria")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20h4l10.5-10.5a2 2 0 0 0-4-4L4 20Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <path d="M13.5 6.5 17.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-[18px] font-semibold text-[#A0522D]">
                {profile.name || t("profile.setName")}
              </div>
              <div className="text-[12px] text-[#A0522D]/70 flex items-center gap-2">
                <span aria-hidden="true">📍</span> {formatProfileLocationDisplay(profile, uiLocale)}
              </div>
              <div className="mt-1 text-[13px] text-[#A0522D]">
                ★ 0.0 <span className="text-[#A0522D]/70">· {t("profile.reviews")}</span>
              </div>
              <div className="mt-1 text-[12px] text-[#A0522D]/70">
                {t("profile.mbti")} {profile.mbti || t("profile.mbtiNotSet")}
              </div>
              <div className="mt-3 text-[13px] leading-6 text-[#A0522D]/70">
                {profile.bio || t("profile.bioPlaceholder")}
              </div>
              <div className="mt-2 text-[13px] text-[#A0522D]">
                {t("profile.hobbies")}{" "}
                <span className="text-[#A0522D]/70">
                  {profile.hobbies || t("profile.hobbiesPlaceholder")}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">0</div>
              <div className="text-[11px] text-[#A0522D]/60">{t("profile.biteMates")}</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">0</div>
              <div className="text-[11px] text-[#A0522D]/60">{t("profile.cookiesGiven")}</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">0</div>
              <div className="text-[11px] text-[#A0522D]/60">{t("profile.dailyBitesStat")}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12px] font-semibold text-[#A0522D]/70">
              {t("profile.photos")} ({profile.photos.length})
            </div>
            {profile.photos.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {profile.photos.map((photo) => (
                  <div key={photo} className="h-24 overflow-hidden rounded-[14px] border border-[#E5D8CC] bg-white">
                    <img src={photo} alt="Profile gallery" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[22px] border border-dashed border-[#E5D8CC] bg-white/70 relative h-44">
                <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#A0522D]/60">
                  {t("profile.addPhotosHint")}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[22px] bg-white/80 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-[#A0522D]/70">{t("profile.biteBalance")}</div>
                <div className="text-[28px] font-semibold text-[#A0522D]">
                  <span aria-hidden="true">🍪</span> {roundBiteDisplay(balance)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWalletOpen(true)}
                className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#A0522D] border border-[#EDD5C0]"
              >
                {t("profile.viewDetails")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 text-[16px] font-semibold text-[#A0522D]">{t("profile.myDailyBites")}</div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {myDailyBites.length === 0 ? (
            <div className="col-span-3 rounded-[18px] border border-dashed border-[#E5D8CC] bg-white/70 p-6 text-center text-[13px] text-[#A0522D]/65">
              {t("profile.noDailyBitesYet")}
            </div>
          ) : (
            myDailyBites.slice(0, 12).map((post) => (
              <button
                key={post.id}
                type="button"
                className="col-span-3 rounded-[18px] border border-[#E5D8CC] bg-white/80 p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-semibold text-[#A0522D]">{post.city}</div>
                  <div className="text-[11px] text-[#A0522D]/60">{formatDateTimeLabel(post.createdAtIso)}</div>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#2C1A0E]/85">{post.text}</p>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHistoryTab("invitee")}
            className="rounded-2xl py-3 text-[13px] font-semibold border border-[#EDD5C0]"
            style={{
              background: historyTab === "invitee" ? "#A0522D" : "rgba(255,255,255,0.8)",
              color: historyTab === "invitee" ? "#fff" : "#A0522D",
            }}
          >
            {t("profile.inviteeTab")}
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab("invitor")}
            className="rounded-2xl py-3 text-[13px] font-semibold border border-[#EDD5C0]"
            style={{
              background: historyTab === "invitor" ? "#A0522D" : "rgba(255,255,255,0.8)",
              color: historyTab === "invitor" ? "#fff" : "#A0522D",
              boxShadow:
                historyTab === "invitor"
                  ? "0 18px 45px rgba(160,82,45,0.25)"
                  : "none",
            }}
          >
            {t("profile.invitorTab")}
          </button>
        </div>

        {showShareDailyCta ? (
          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
            <div className="min-w-0 flex-1">
              <div
                className="text-[15px] font-semibold text-[#A0522D]"
                style={{ fontFamily: "'Patrick Hand', cursive" }}
              >
                {t("profile.shareDailyTitle")}
              </div>
              <div className="mt-1 text-[12px] leading-snug text-[#A0522D]/65" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                {t("profile.shareDailySubtitle")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateTour?.()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#A0522D] bg-[#A0522D] text-white shadow-[0_10px_28px_rgba(160,82,45,0.28)] transition active:scale-95"
              aria-label={t("profile.createTourAria")}
            >
              <Plus className="h-6 w-6" strokeWidth={2.4} />
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {historyTab === "invitee" ? (
            inviteeHistory.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#E5D8CC] bg-white/70 p-5 text-center text-[13px] text-[#A0522D]/65">
                {t("profile.noInviteeHistory")}
              </div>
            ) : (
              inviteeHistory.map((invite) => (
                <div key={invite.id} className="rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)] flex gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2B1A12] to-[#5D3B24]">
                    {invite.primaryPhotoUrl ? (
                      <img src={invite.primaryPhotoUrl} alt={invite.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[14px] font-semibold text-[#A0522D]">{invite.title}</div>
                      <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#A0522D]/60 border border-[#EDD5C0]">
                        {t("profile.inviteBadge")}
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] text-[#A0522D]/60">📅 {formatDateLabel(invite.createdAt)}</div>
                    <div className="mt-1 text-[12px] text-[#A0522D]/60">📍 {invite.location}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditInvite(invite)}
                        className="rounded-full border border-[#EDD5C0] bg-white px-3 py-1 text-[11px] font-semibold text-[#A0522D]"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLocalInvite(invite.id)}
                        className="rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-600"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : invitorHistory.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#E5D8CC] bg-white/70 p-5 text-center text-[13px] text-[#A0522D]/65">
              {t("profile.noHostHistory")}
            </div>
          ) : (
            invitorHistory.map((x) => (
              <div key={x.title} className="rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)] flex gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2B1A12] to-[#5D3B24]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[14px] font-semibold text-[#A0522D]">{x.title}</div>
                    <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#A0522D]/60 border border-[#EDD5C0]">
                      {x.badge}
                    </span>
                  </div>
                  <div className="mt-2 text-[12px] text-[#A0522D]/60">📅 {x.meta}</div>
                  <div className="mt-1 text-[12px] text-[#A0522D]/60">⬤ {x.status}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <LanguageSwitcher className="mt-6" />

        <div className="mt-6 rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
          <div className="text-[15px] font-semibold text-[#A0522D]">{t("profile.displayCurrency")}</div>
          <p className="mt-1 text-[12px] leading-5 text-[#A0522D]/65">{t("profile.displayCurrencyHint")}</p>
          <label className="mt-3 block">
            <span className="text-[11px] font-semibold text-[#A0522D]/75">{t("profile.preferredCurrency")}</span>
            <select
              value={preferredCurrency}
              disabled={currencyBusy}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                setCurrencyBusy(true);
                void persistPreferredCurrency(next).finally(() => setCurrencyBusy(false));
              }}
              className="mt-1 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[13px] font-medium text-[#2C1A0E] outline-none disabled:opacity-60"
            >
              {SELECTABLE_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
          <div className="text-[15px] font-semibold text-[#A0522D]">{t("profile.connectSocial")}</div>
          <div className="mt-3 space-y-2.5">
            {(
              [
                { key: "kakao", label: "KakaoTalk" },
                { key: "naver", label: "Naver" },
                { key: "google", label: "Google" },
              ] as const
            ).map((item) => {
              const connected =
                item.key === "kakao"
                  ? isKakaoConnected
                  : item.key === "naver"
                    ? isNaverConnected
                    : isGoogleConnected;
              const connecting = socialConnecting === item.key;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-2xl border border-[#EDD5C0] bg-white/75 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2 text-[13px] text-[#A0522D]">
                    {item.key === "kakao" ? (
                      <KakaoLogo />
                    ) : item.key === "naver" ? (
                      <NaverLogo />
                    ) : (
                      <GoogleLogo />
                    )}
                    <span>{item.label}</span>
                  </div>
                  <button
                    type="button"
                    disabled={connected || connecting}
                    onClick={() => void connectSocial(item.key)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      background: connected ? "rgba(160,82,45,0.12)" : connecting ? "rgba(160,82,45,0.35)" : "#A0522D",
                      color: connected ? "#A0522D" : "white",
                      opacity: connected ? 1 : connecting ? 0.8 : 1,
                    }}
                  >
                    {connected ? t("profile.connected") : connecting ? t("profile.connecting") : t("profile.connect")}
                  </button>
                </div>
              );
            })}
          </div>
          {socialConnectError ? (
            <p className="mt-3 text-[11px] text-red-600">{socialConnectError}</p>
          ) : null}
          <p className="mt-3 text-[11px] leading-5 text-[#A0522D]/65">{t("profile.socialHint")}</p>
        </div>

        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: "/" })}
          className="mt-5 w-full rounded-2xl border border-[#A0522D]/30 bg-white/80 py-3 text-[14px] font-semibold text-[#A0522D] transition hover:bg-[#FFF5EC]"
        >
          {t("profile.logOut")}
        </button>
      </div>

      <ProfileEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
      />

      {walletOpen && user?.id ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setWalletOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[520px]">
            <WalletOverlay
              balance={balance}
              biteHistory={biteHistory}
              onClose={() => setWalletOpen(false)}
              onRefresh={() => {
                setBalance(getWalletBalance(user.id));
                void (async () => {
                  try {
                    const token = await getToken({ template: "supabase" });
                    if (!token) return;
                    setBiteHistory(await fetchBitesHistory(user.id, token));
                  } catch {
                    setBiteHistory([]);
                  }
                })();
              }}
            />
          </div>
        </div>
      ) : null}

      {editingInviteId ? (
        <div className="fixed inset-0 z-[85] bg-[#FDFAF5]">
          <div className="h-full overflow-y-auto px-5 pb-8 pt-5">
            <div className="mx-auto w-full max-w-[860px]">
            <div className="text-[24px] font-semibold text-[#A0522D]">{t("profile.editInvite")}</div>
            <input
              className="mt-4 w-full rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder={t("profile.titlePh")}
            />
            <input
              className="mt-3 w-full rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
              value={editingLocation}
              onChange={(e) => setEditingLocation(e.target.value)}
              placeholder={t("profile.locationPh")}
            />
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
              value={editingDescription}
              onChange={(e) => setEditingDescription(e.target.value)}
              placeholder={t("profile.descriptionPh")}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                className="rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
                value={editingPriceAmount}
                onChange={(e) => setEditingPriceAmount(Number(e.target.value))}
                placeholder="Price (BITE)"
              />
              <input
                type="number"
                min={1}
                className="rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
                value={editingCapacity}
                onChange={(e) => setEditingCapacity(Number(e.target.value))}
                placeholder="Capacity"
              />
            </div>
            <input
              type="datetime-local"
              className="mt-3 w-full rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[15px] outline-none"
              value={editingMeetupAt}
              onChange={(e) => setEditingMeetupAt(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {TASTE_TAG_OPTIONS.map((tag) => {
                const active = editingTasteTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setEditingTasteTags((cur) =>
                        cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag],
                      )
                    }
                    className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: active ? "rgba(160,82,45,0.12)" : "white",
                      color: "#A0522D",
                      border: active ? "1px solid rgba(160,82,45,0.35)" : "1px solid #EDD5C0",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-[#EDD5C0] bg-white/70 p-3">
              <div className="text-[13px] font-semibold text-[#A0522D]">DateTime & Itinerary</div>
              <div className="mt-3 space-y-2">
                {editingTimeline.map((row, idx) => (
                  <div key={`${idx}-${row.title}`} className="grid grid-cols-3 gap-2">
                    <input
                      value={row.time}
                      onChange={(e) =>
                        setEditingTimeline((cur) =>
                          cur.map((it, i) => (i === idx ? { ...it, time: e.target.value } : it)),
                        )
                      }
                      className="rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] outline-none"
                      placeholder="Time"
                    />
                    <input
                      value={row.title}
                      onChange={(e) =>
                        setEditingTimeline((cur) =>
                          cur.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it)),
                        )
                      }
                      className="rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] outline-none"
                      placeholder="Title"
                    />
                    <input
                      value={row.description}
                      onChange={(e) =>
                        setEditingTimeline((cur) =>
                          cur.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)),
                        )
                      }
                      className="rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] outline-none"
                      placeholder="Description"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditingTimeline((cur) => [...cur, { time: "", title: "", description: "" }])
                  }
                  className="rounded-full border border-[#EDD5C0] bg-white px-3 py-1 text-[12px] font-semibold text-[#A0522D]"
                >
                  + Add Row
                </button>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditingInviteId(null)}
                className="w-full rounded-2xl border border-[#A0522D]/45 bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void saveEditedInvite()}
                disabled={editingInviteSaving}
                className="w-full rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {editingInviteSaving ? "Saving..." : t("common.save")}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("profile.justNow");
  return date.toLocaleDateString();
}

function formatDateTimeLabel(value?: string) {
  if (!value) return i18n.t("profile.justNow");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("profile.justNow");
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

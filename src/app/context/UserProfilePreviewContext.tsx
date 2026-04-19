import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { fetchPublicProfileByClerkId, type PublicProfileSnapshot } from "@/lib/publicProfile";
import { setProfileAvatar } from "@/lib/profileAvatarStore";

export type OpenUserProfileArgs = {
  clerkId: string;
  fallbackDisplayName?: string;
  fallbackImageUrl?: string;
};

type UserProfilePreviewContextValue = {
  openUserProfile: (args: OpenUserProfileArgs) => void;
  closeUserProfile: () => void;
};

const UserProfilePreviewContext = createContext<UserProfilePreviewContextValue | null>(null);

export function useUserProfilePreview() {
  const ctx = useContext(UserProfilePreviewContext);
  if (!ctx) {
    return {
      openUserProfile: () => {},
      closeUserProfile: () => {},
    };
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  getSupabaseToken?: () => Promise<string | null>;
  /** Opens / creates Say Hi chat (same as Daily Bite card). */
  onSayHiHost?: (host: { hostId: string; hostName: string }) => void;
  currentUserClerkId?: string | null;
};

export function UserProfilePreviewProvider({
  children,
  getSupabaseToken,
  onSayHiHost,
  currentUserClerkId,
}: ProviderProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [clerkId, setClerkId] = useState<string | null>(null);
  const [fallbackName, setFallbackName] = useState("");
  const [fallbackImage, setFallbackImage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<PublicProfileSnapshot | null>(null);
  /** True when the last open attempted Supabase with a JWT (so a missing snapshot may be an RPC/DB issue). */
  const [lastFetchHadToken, setLastFetchHadToken] = useState(false);

  const closeUserProfile = useCallback(() => {
    setOpen(false);
    setClerkId(null);
    setSnapshot(null);
    setLastFetchHadToken(false);
    setLoading(false);
  }, []);

  const openUserProfile = useCallback(
    (args: OpenUserProfileArgs) => {
      const id = args.clerkId?.trim();
      if (!id) return;
      setClerkId(id);
      setFallbackName(args.fallbackDisplayName?.trim() || "");
      setFallbackImage(args.fallbackImageUrl?.trim() || undefined);
      setSnapshot(null);
      setLastFetchHadToken(false);
      setOpen(true);
      setLoading(true);
      void (async () => {
        try {
          const token = (await getSupabaseToken?.()) ?? null;
          setLastFetchHadToken(Boolean(token));
          if (!token) {
            setSnapshot(null);
            return;
          }
          const row = await fetchPublicProfileByClerkId(id, token);
          setSnapshot(row);
          const fresh = row?.image_url?.trim();
          if (fresh) setProfileAvatar(id, fresh);
        } catch {
          setSnapshot(null);
        } finally {
          setLoading(false);
        }
      })();
    },
    [getSupabaseToken],
  );

  const handleSayHi = useCallback(() => {
    const id = clerkId?.trim();
    if (!id || !id.startsWith("user_")) return;
    if (id === (currentUserClerkId ?? "").trim()) return;
    const name =
      snapshot?.display_name?.trim() ||
      fallbackName.trim() ||
      t("profilePreview.fallbackName");
    onSayHiHost?.({ hostId: `host:${id}`, hostName: name });
    closeUserProfile();
  }, [clerkId, currentUserClerkId, snapshot?.display_name, fallbackName, onSayHiHost, closeUserProfile, t]);

  const displayName =
    snapshot?.display_name?.trim() ||
    fallbackName ||
    t("profilePreview.fallbackName");
  const imageUrl = snapshot?.image_url?.trim() || fallbackImage;
  const canSayHiFromPreview =
    Boolean(onSayHiHost) &&
    Boolean(clerkId?.trim().startsWith("user_")) &&
    (clerkId ?? "").trim() !== (currentUserClerkId ?? "").trim();

  /** Only show the RPC/setup hint when Supabase was called but we still have no row and no UI fallbacks. */
  const showHardLoadError =
    !loading &&
    lastFetchHadToken &&
    !snapshot &&
    !(fallbackName?.trim() || fallbackImage?.trim());

  const value = useMemo(
    () => ({
      openUserProfile,
      closeUserProfile,
    }),
    [openUserProfile, closeUserProfile],
  );

  return (
    <UserProfilePreviewContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {open && clerkId ? (
          <motion.div
            key="user-profile-preview"
            className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label={t("profilePreview.closeAria")}
              className="absolute inset-0 bg-black/30"
              onClick={closeUserProfile}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-profile-preview-title"
              className="relative z-[1] m-0 w-full max-w-md rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-6 shadow-[0_-20px_60px_rgba(42,36,32,0.18)] sm:mx-4 sm:rounded-3xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="mx-auto mb-4 hidden h-1.5 w-10 rounded-full bg-[#E3D3C5] sm:block" />
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#EDD5C0] bg-[#F0E4D8]">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2">
                  <h2 id="user-profile-preview-title" className="text-[18px] font-semibold text-[#5C3318]">
                    {displayName}
                  </h2>
                  {canSayHiFromPreview ? (
                    <button
                      type="button"
                      onClick={handleSayHi}
                      className="rounded-full border border-[#A0522D]/45 bg-white/90 px-3 py-1 text-[11px] font-semibold lowercase tracking-[0.01em] text-[#A0522D] shadow-sm hover:bg-[#A0522D]/5"
                      aria-label={t("profilePreview.sayHiAria", { name: displayName })}
                    >
                      {t("explore.sayHi")}
                    </button>
                  ) : null}
                </div>
                {loading ? (
                  <p className="mt-2 text-[13px] text-[#A0522D]/65">{t("loading")}</p>
                ) : showHardLoadError ? (
                  <p className="mt-2 text-[13px] text-[#A0522D]/70">{t("profilePreview.loadError")}</p>
                ) : (
                  <div className="mt-3 w-full space-y-2 text-left text-[13px] text-[#2C1A0E]/88">
                    {!loading && !snapshot && (fallbackName?.trim() || fallbackImage?.trim()) ? (
                      <p className="text-center text-[11px] leading-relaxed text-[#A0522D]/55">
                        {t("profilePreview.serverExtrasHint")}
                      </p>
                    ) : null}
                    {snapshot?.profile_city ? (
                      <p>
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.city")}</span>{" "}
                        {snapshot.profile_city}
                        {snapshot.profile_country_code ? ` · ${snapshot.profile_country_code}` : ""}
                      </p>
                    ) : null}
                    {snapshot?.profile_mbti ? (
                      <p>
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.mbti")}</span>{" "}
                        {snapshot.profile_mbti}
                      </p>
                    ) : null}
                    {snapshot ? (
                      <p>
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.hobbies")}</span>{" "}
                        {snapshot.profile_hobbies?.trim() ? snapshot.profile_hobbies : t("profilePreview.fieldEmpty")}
                      </p>
                    ) : null}
                    {snapshot ? (
                      <p className="whitespace-pre-wrap break-words">
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.bio")}</span>{" "}
                        {snapshot.profile_bio?.trim() ? snapshot.profile_bio : t("profilePreview.fieldEmpty")}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeUserProfile}
                className="mt-6 w-full rounded-2xl border border-[#E4CCB8] bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
              >
                {t("common.close")}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </UserProfilePreviewContext.Provider>
  );
}

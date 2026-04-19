import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { fetchPublicProfileByClerkId, type PublicProfileSnapshot } from "@/lib/publicProfile";

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
};

export function UserProfilePreviewProvider({ children, getSupabaseToken }: ProviderProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [clerkId, setClerkId] = useState<string | null>(null);
  const [fallbackName, setFallbackName] = useState("");
  const [fallbackImage, setFallbackImage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<PublicProfileSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);

  const closeUserProfile = useCallback(() => {
    setOpen(false);
    setClerkId(null);
    setSnapshot(null);
    setLoadError(false);
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
      setLoadError(false);
      setOpen(true);
      setLoading(true);
      void (async () => {
        try {
          const token = (await getSupabaseToken?.()) ?? null;
          if (!token) {
            setLoadError(true);
            setSnapshot(null);
            return;
          }
          const row = await fetchPublicProfileByClerkId(id, token);
          setSnapshot(row);
          if (!row) setLoadError(true);
        } catch {
          setLoadError(true);
          setSnapshot(null);
        } finally {
          setLoading(false);
        }
      })();
    },
    [getSupabaseToken],
  );

  const displayName =
    snapshot?.display_name?.trim() ||
    fallbackName ||
    t("profilePreview.fallbackName");
  const imageUrl = snapshot?.image_url?.trim() || fallbackImage;

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
                <h2 id="user-profile-preview-title" className="mt-3 text-[18px] font-semibold text-[#5C3318]">
                  {displayName}
                </h2>
                {loading ? (
                  <p className="mt-2 text-[13px] text-[#A0522D]/65">{t("loading")}</p>
                ) : loadError && !snapshot ? (
                  <p className="mt-2 text-[13px] text-[#A0522D]/70">{t("profilePreview.loadError")}</p>
                ) : (
                  <div className="mt-3 w-full space-y-2 text-left text-[13px] text-[#2C1A0E]/88">
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
                    {snapshot?.profile_hobbies ? (
                      <p>
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.hobbies")}</span>{" "}
                        {snapshot.profile_hobbies}
                      </p>
                    ) : null}
                    {snapshot?.profile_bio ? (
                      <p className="whitespace-pre-wrap break-words">
                        <span className="font-semibold text-[#A0522D]/85">{t("profilePreview.bio")}</span>{" "}
                        {snapshot.profile_bio}
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

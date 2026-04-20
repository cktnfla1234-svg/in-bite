import { AnimatePresence, motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";
import { AppShellTabbarPadMotion } from "./AppShellTabbarSafeArea";
import { CookieLogo } from "./ui/CookieLogo";

type PostSignupWelcomeModalProps = {
  open: boolean;
  onClose: () => void;
  onStartExploring: () => void;
};

export function PostSignupWelcomeModal({
  open,
  onClose,
  onStartExploring,
}: PostSignupWelcomeModalProps) {
  const { t } = useTranslation("common");

  return (
    <AnimatePresence>
      {open ? (
        <AppShellTabbarPadMotion
          className="fixed inset-0 z-[95] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[3px]"
            onClick={onClose}
          />

          <motion.div
            className="relative w-[92%] max-w-[420px] rounded-[28px] bg-[#FFFBF1] px-6 pb-6 pt-10 shadow-[0_20px_70px_rgba(0,0,0,0.25)]"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <button
              type="button"
              aria-label={t("postSignupWelcome.closeAria")}
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-[#A0522D]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="absolute left-1/2 top-[-18px] flex h-[56px] w-[56px] -translate-x-1/2 items-center justify-center rounded-full bg-[#EFE1D4]">
              <CookieLogo size={26} />
            </div>

            <h2
              className="text-center font-semibold"
              style={{
                color: "#5A3828",
                fontSize: "22px",
                fontFamily: "'Patrick Hand', cursive",
              }}
            >
              {t("postSignupWelcome.title")}
            </h2>

            <p className="mt-5 text-center text-sm leading-6 text-[#6F4C32]">
              <Trans
                ns="common"
                i18nKey="postSignupWelcome.body"
                components={{
                  bite: <b />,
                  energy: <b />,
                }}
              />
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={onStartExploring}
                className="h-12 w-full rounded-2xl bg-[#A0522D] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(160,82,45,0.25)]"
              >
                {t("postSignupWelcome.startExploring")}
              </button>
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-[#A0522D]/70">{t("postSignupWelcome.footer")}</p>
          </motion.div>
        </AppShellTabbarPadMotion>
      ) : null}
    </AnimatePresence>
  );
}


import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export type LoginPromptKind = "chat" | "booking" | "sharing";

type LoginPromptModalProps = {
  open: boolean;
  kind: LoginPromptKind;
  onClose: () => void;
  onSignUp?: () => void;
  onLogIn?: () => void;
};

export function LoginPromptModal({
  open,
  kind,
  onClose,
  onSignUp,
  onLogIn,
}: LoginPromptModalProps) {
  const { t } = useTranslation("common");
  const bodyKey = `loginPrompt.${kind}Body` as const;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            className="relative w-[92%] max-w-[420px] rounded-[26px] bg-[#FFFBF1] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div
              className="text-center text-[20px] font-semibold"
              style={{ color: "#A0522D", fontFamily: "'Patrick Hand', cursive" }}
            >
              {t("loginPrompt.title")}
            </div>
            <div className="mt-3 text-center text-[13px] leading-6 text-[#A0522D]/70">
              {t(bodyKey)}
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => onSignUp?.()}
                className="h-12 w-full rounded-2xl bg-[#A0522D] text-sm font-semibold text-white"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => onLogIn?.()}
                className="h-11 w-full rounded-2xl border border-[#A0522D]/30 bg-white/80 text-sm font-semibold text-[#A0522D]"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 w-full rounded-2xl border border-[#A0522D]/30 bg-white/60 text-sm font-semibold text-[#A0522D]"
              >
                {t("common.notNow")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

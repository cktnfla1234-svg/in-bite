import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

const TAB_ENTRY_DELAY_MS = 500;
/** 페이드인 완료 후 말풍선이 유지되는 시간 (3~4초 구간의 중앙) */
const TOOLTIP_HOLD_MS = 3500;
const TOOLTIP_FADE_IN_MS = 400;

type FloatingActionButtonProps = {
  onClick: () => void;
  /** Invitation 탭(Explore → invitations)일 때 + 버튼 옆 자동 말풍선 */
  autoInvitationTooltip?: boolean;
};

export function FloatingActionButton({ onClick, autoInvitationTooltip = false }: FloatingActionButtonProps) {
  const { t, i18n } = useTranslation("common");
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current != null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const dismiss = () => {
      clearTimers();
      setBubbleVisible(false);
    };

    if (!autoInvitationTooltip) {
      dismiss();
      return;
    }

    setBubbleVisible(false);

    const onScroll = () => {
      dismiss();
    };

    let cancelled = false;
    let onInitialized: (() => void) | null = null;

    const armAfterI18nReady = () => {
      if (cancelled) return;
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        setBubbleVisible(true);
        hideTimerRef.current = window.setTimeout(() => {
          hideTimerRef.current = null;
          setBubbleVisible(false);
        }, TOOLTIP_HOLD_MS + TOOLTIP_FADE_IN_MS);
      }, TAB_ENTRY_DELAY_MS);
    };

    if (i18n.isInitialized) {
      armAfterI18nReady();
    } else {
      onInitialized = () => {
        if (cancelled) return;
        if (onInitialized) i18n.off("initialized", onInitialized);
        armAfterI18nReady();
      };
      i18n.on("initialized", onInitialized);
    }

    return () => {
      cancelled = true;
      if (onInitialized) i18n.off("initialized", onInitialized);
      clearTimers();
      window.removeEventListener("scroll", onScroll, { capture: true });
      setBubbleVisible(false);
    };
  }, [autoInvitationTooltip, i18n.isInitialized, i18n]);

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-[88] flex items-center gap-2.5">
      <AnimatePresence>
        {bubbleVisible ? (
          <motion.div
            key="invite-fab-tooltip"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pointer-events-none rounded-full border border-[#A0522D] bg-white/90 px-5 py-2.5 text-[14px] font-semibold text-[#A0522D] shadow-[0_14px_35px_rgba(0,0,0,0.08)]"
          >
            {t("floating_invite_hint")}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        aria-label={t("fab.createAria")}
        onClick={onClick}
        className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#A0522D] text-white shadow-[0_12px_30px_rgba(160,82,45,0.35)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

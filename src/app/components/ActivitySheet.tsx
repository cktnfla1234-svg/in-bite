import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { AppNotification } from "@/lib/notifications";

type ActivitySheetProps = {
  open: boolean;
  onClose: () => void;
  items: AppNotification[];
  onSelect: (item: AppNotification) => void;
};

export function ActivitySheet({ open, onClose, items, onSelect }: ActivitySheetProps) {
  const { t } = useTranslation("common");
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-label={t("activity.closeAria")} />
          <motion.div
            className="relative mb-0 w-full max-w-lg rounded-t-[28px] border border-[#E6D5C6] bg-[#FFFBF5] shadow-[0_-20px_60px_rgba(42,36,32,0.18)] sm:mb-0 sm:rounded-[28px]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[#EDD5C0]/80 px-5 py-4">
              <div className="text-[17px] font-semibold text-[#2A2420]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {t("activity.title")}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#A0522D]/70 hover:bg-[#F3E8DA]"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[min(70svh,520px)] overflow-y-auto px-3 py-2 pb-6">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-[#8C7663]">{t("activity.empty")}</div>
              ) : (
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="relative w-full rounded-2xl px-3 py-3 text-left transition hover:bg-[#A0522D]/5"
                      >
                        {!item.read ? (
                          <span className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#A0522D]" aria-hidden />
                        ) : null}
                        <div className={`text-[13px] leading-snug text-[#2A2420]/90 ${!item.read ? "pl-4" : ""}`}>{item.content}</div>
                        <div className={`mt-1 text-[11px] text-[#A98E79] ${!item.read ? "pl-4" : ""}`}>
                          {new Date(item.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Tab = "home" | "explore" | "chat" | "profile";

type BottomNavProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  chatUnreadCount?: number;
};

const TABS: { id: Tab; labelKey: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: "home",
    labelKey: "nav.home",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#A0522D" : "#C4A882"} strokeWidth="1.7">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    id: "explore",
    labelKey: "nav.explore",
    icon: (active) => {
      const stroke = active ? "#A0522D" : "#C4A882";
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.7" />
          <path
            d="M12 6l4 6-4 6-4-6 4-6z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="1.6" fill={stroke} stroke="none" />
        </svg>
      );
    },
  },
  {
    id: "chat",
    labelKey: "nav.chat",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#A0522D" : "#C4A882"} strokeWidth="1.7">
        <path d="M7 17l-3 3 1-4c-1.2-1.2-2-2.8-2-4.6C3 6.9 6.1 4 10 4h4c3.9 0 7 2.9 7 7.4S17.9 19 14 19H10c-1.2 0-2.3-.3-3-.8Z" />
        <circle cx="9" cy="12" r="1" fill={active ? "#A0522D" : "#C4A882"} stroke="none" />
        <circle cx="14" cy="12" r="1" fill={active ? "#A0522D" : "#C4A882"} stroke="none" />
      </svg>
    ),
  },
  {
    id: "profile",
    labelKey: "nav.profile",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#A0522D" : "#C4A882"} strokeWidth="1.7">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function BottomNav({ activeTab, onTabChange, chatUnreadCount = 0 }: BottomNavProps) {
  const { t } = useTranslation("common");
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[94] flex items-center"
      style={{
        background: "rgba(253,250,245,0.97)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #EDD5C0",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-1 flex-col items-center gap-1 py-3 transition-all active:scale-95"
          >
            <div className="relative">
              {tab.icon(isActive)}
              {tab.id === "chat" && chatUnreadCount > 0 ? (
                <div className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A0522D] px-1 text-[11px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(160,82,45,0.3)]">
                  {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                </div>
              ) : null}
            </div>
            <span
              className="font-brand-display text-[10px] tracking-wider"
              style={{
                color: isActive ? "#A0522D" : "#C4A882",
                letterSpacing: "0.07em",
              }}
            >
              {t(tab.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

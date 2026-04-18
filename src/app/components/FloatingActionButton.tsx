import { useTranslation } from "react-i18next";

type FloatingActionButtonProps = {
  onClick: () => void;
};

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  const { t } = useTranslation("common");
  return (
    <button
      type="button"
      aria-label={t("fab.createAria")}
      onClick={onClick}
      className="fixed right-4 bottom-20 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#A0522D] text-white shadow-[0_12px_30px_rgba(160,82,45,0.35)]"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

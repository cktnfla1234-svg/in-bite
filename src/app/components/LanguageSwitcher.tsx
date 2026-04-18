import { useAuth, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateProfileLanguageCode } from "@/lib/profile";
import { LANGUAGE_OPTIONS, type AppLocale } from "@/lib/i18n/appLocales";
import i18n, { persistAppLocale } from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  className?: string;
};

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { t } = useTranslation("common");
  const { user } = useUser();
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const current = (i18n.language ?? "en").split("-")[0] as AppLocale;

  const apply = async (lng: AppLocale) => {
    if (lng === current) return;
    void i18n.changeLanguage(lng);
    persistAppLocale(lng);
    if (!user?.id) return;
    setSaving(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (token) await updateProfileLanguageCode(user.id, token, lng);
    } catch {
      // offline — UI language already switched
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-[22px] border border-[#EDD5C0]/80 bg-white/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="text-[15px] font-semibold text-[#A0522D]">{t("profile.languageTitle")}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((opt) => {
          const active = opt.code === current;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={saving}
              onClick={() => void apply(opt.code)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border px-3.5 py-2 text-left text-[13px] font-semibold transition disabled:opacity-60"
              style={{
                borderColor: active ? "#A0522D" : "rgba(237, 213, 192, 0.9)",
                background: active ? "rgba(160, 82, 45, 0.12)" : "rgba(255,255,255,0.85)",
                color: "#5A3828",
              }}
            >
              <span className="text-lg leading-none" aria-hidden>
                {opt.flag}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {saving ? <p className="mt-2 text-[11px] text-[#A0522D]/60">{t("profile.syncing")}</p> : null}
    </div>
  );
}

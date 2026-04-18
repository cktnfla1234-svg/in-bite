import { useAuth, useUser } from "@clerk/clerk-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { saveCurrentTastes, upsertClerkProfile } from "@/lib/profile";

const TASTE_GROUPS: { title: string; options: string[] }[] = [
  {
    title: "Food & Diet",
    options: [
      "Vegetarian Friendly",
      "Vegan Spots",
      "Gluten-Free Options",
      "Halal-Friendly",
      "Dessert Places",
      "Street Food",
    ],
  },
  {
    title: "Lifestyle",
    options: [
      "Cafe Hopping",
      "Night Markets",
      "Slow Travel",
      "Hidden Local Places",
      "Photography Walks",
      "Wellness & Yoga",
    ],
  },
  {
    title: "Culture & Activities",
    options: [
      "Art & Culture",
      "Local Festivals",
      "Live Music",
      "Museums",
      "Nature Escapes",
      "Sunrise/Sunset Spots",
    ],
  },
];

export function TastesOnboardingPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => selected.length > 0 && !saving, [saving, selected.length]);

  const toggleTaste = (taste: string) => {
    setSelected((prev) =>
      prev.includes(taste) ? prev.filter((item) => item !== taste) : [...prev, taste],
    );
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        throw new Error("Missing Clerk JWT template token (supabase).");
      }
      await upsertClerkProfile(user, token);
      await saveCurrentTastes(user.id, selected, token);
      navigate("/app", { replace: true });
    } catch (err) {
      const detail =
        typeof err === "object" && err !== null
          ? "message" in err
            ? String((err as { message?: unknown }).message ?? "")
            : JSON.stringify(err)
          : String(err ?? "");
      console.error("Failed to save tastes", err);
      setError(
        detail ? `Failed to save tastes: ${detail}` : "Failed to save tastes.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-16 pt-10">
      <section className="mx-auto w-full max-w-[560px] px-6">
        <LanguageSwitcher className="mb-6" />
        <h1
          className="text-[32px] leading-[1.2] text-[#A0522D]"
          style={{ fontFamily: "'Patrick Hand', cursive" }}
        >
          {t("onboarding.tastesTitle")}
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#7C6A5E]">{t("onboarding.tastesSubtitle")}</p>

        <div className="mt-4 text-[12px] text-[#A0522D]/75">
          {t("onboarding.selected")} <span className="font-semibold">{selected.length}</span>
        </div>

        <div className="mt-6 space-y-5">
          {TASTE_GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-[#A0522D]/80">
                {group.title}
              </h2>
              <div className="flex flex-wrap gap-3">
                {group.options.map((taste) => {
                  const active = selected.includes(taste);
                  return (
                    <button
                      key={taste}
                      type="button"
                      onClick={() => toggleTaste(taste)}
                      className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                      style={{
                        background: active ? "#A0522D" : "white",
                        color: active ? "white" : "#A0522D",
                        border: "1px solid #EDD5C0",
                      }}
                    >
                      {taste}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="mt-10 h-12 w-full rounded-2xl text-sm font-semibold transition-opacity"
          style={{
            background: "#A0522D",
            color: "white",
            opacity: canSubmit ? 1 : 0.45,
          }}
        >
          {saving ? t("onboarding.saving") : t("onboarding.continue")}
        </button>
      </section>
    </main>
  );
}

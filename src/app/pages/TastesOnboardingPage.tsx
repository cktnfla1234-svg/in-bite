import { useAuth, useUser } from "@clerk/clerk-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { saveOnboardingProfile, upsertClerkProfile } from "@/lib/profile";

const GENDER_OPTIONS = ["👨‍🦱 남성", "👩‍🦰 여성", "🌈 기타", "🤫 비공개"] as const;
const HOBBY_OPTIONS = [
  "☕️ 카페 투어",
  "⛰️ 등산",
  "🥗 비건/채식",
  "🖼️ 전시회 관람",
  "📚 독서",
  "📸 사진 촬영",
  "🍷 와인/위스키",
  "🏃‍♂️ 러닝/조깅",
  "🎧 LP/음악 감상",
  "🧘‍♀️ 요가/명상",
  "🏕️ 캠핑/차박",
  "🐱 동물 보호",
  "🍳 쿠킹 클래스",
  "🏋️‍♂️ 웨이트 트레이닝",
  "✈️ 즉흥 여행",
] as const;
const MOOD_OPTIONS = [
  "✨ 활기찬",
  "🤫 조용한",
  "🎨 예술적인",
  "🤝 친절한",
  "🎸 힙한",
  "🧘‍♂️ 차분한",
  "🧐 지적인",
  "🤪 위트 있는",
  "🌏 모험적인",
  "🌞 긍정적인",
  "💼 열정적인",
  "🍕 소탈한",
  "🎀 섬세한",
  "🌊 자유로운",
  "🧸 다정한",
] as const;
const MAX_PICK = 3;

function toggleWithLimit(current: string[], value: string): { next: string[]; blocked: boolean } {
  if (current.includes(value)) {
    return { next: current.filter((v) => v !== value), blocked: false };
  }
  if (current.length >= MAX_PICK) {
    return { next: current, blocked: true };
  }
  return { next: [...current, value], blocked: false };
}

function onboardingCacheKey(clerkId: string) {
  return `inbite:onboarding:${clerkId}`;
}

export function TastesOnboardingPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 81 }, (_, idx) => String(thisYear - 15 - idx)), [thisYear]);
  const [ageInput, setAgeInput] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [agePrivate, setAgePrivate] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [pickWarning, setPickWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = !saving;

  const handleAgePrivateChange = (checked: boolean) => {
    setAgePrivate(checked);
    if (checked) {
      setAgeInput("");
      setBirthYear("");
    }
  };

  const computedAge = useMemo(() => {
    if (agePrivate) return null;
    const byNumber = Number.parseInt(ageInput.trim(), 10);
    if (Number.isFinite(byNumber) && byNumber >= 0 && byNumber <= 120) return byNumber;
    const byYear = Number.parseInt(birthYear, 10);
    if (Number.isFinite(byYear)) {
      const age = thisYear - byYear;
      if (age >= 0 && age <= 120) return age;
    }
    return null;
  }, [ageInput, agePrivate, birthYear, thisYear]);

  const handleToggleHobby = (item: string) => {
    const { next, blocked } = toggleWithLimit(hobbies, item);
    if (blocked) {
      setPickWarning("Hobbies는 최대 3개까지 선택할 수 있어요.");
      return;
    }
    setPickWarning(null);
    setHobbies(next);
  };

  const handleToggleMood = (item: string) => {
    const { next, blocked } = toggleWithLimit(moods, item);
    if (blocked) {
      setPickWarning("Mood는 최대 3개까지 선택할 수 있어요.");
      return;
    }
    setPickWarning(null);
    setMoods(next);
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
      await saveOnboardingProfile(
        user.id,
        {
          age: computedAge,
          gender,
          bio: bio.trim() || null,
          hobbies,
          moods,
        },
        token,
      );
      try {
        window.localStorage.setItem(onboardingCacheKey(user.id), "1");
      } catch {
        // ignore storage errors
      }
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
        detail ? `Failed to save onboarding profile: ${detail}` : "Failed to save onboarding profile.",
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
        <div className="mt-6 space-y-5">
          <section className="rounded-2xl border border-[#EDD5C0] bg-white/70 p-4">
            <h2 className="text-[14px] font-semibold text-[#A0522D]">Age</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="number"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                placeholder="나이를 직접 입력"
                disabled={agePrivate}
                className="rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] text-[#5C3318] outline-none disabled:opacity-50"
              />
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                disabled={agePrivate}
                className="rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] text-[#5C3318] outline-none disabled:opacity-50"
              >
                <option value="">출생 연도 선택</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-[13px] text-[#7C6A5E]">
              <input
                type="checkbox"
                checked={agePrivate}
                onChange={(e) => handleAgePrivateChange(e.target.checked)}
              />
              나이 비공개
            </label>
          </section>

          <section className="rounded-2xl border border-[#EDD5C0] bg-white/70 p-4">
            <h2 className="text-[14px] font-semibold text-[#A0522D]">Gender</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => {
                const active = gender === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGender(option)}
                    className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      background: active ? "#A0522D" : "white",
                      color: active ? "white" : "#A0522D",
                      border: "1px solid #EDD5C0",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#EDD5C0] bg-white/70 p-4">
            <h2 className="text-[14px] font-semibold text-[#A0522D]">Bio</h2>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="나를 한 문장으로 표현한다면?"
              className="mt-3 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] text-[#5C3318] outline-none"
            />
          </section>

          <section className="rounded-2xl border border-[#EDD5C0] bg-white/70 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#A0522D]">Hobbies</h2>
              <span className="text-[12px] text-[#A0522D]/70">
                ({hobbies.length} / {MAX_PICK})
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {HOBBY_OPTIONS.map((item) => {
                const active = hobbies.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleToggleHobby(item)}
                    className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      background: active ? "#A0522D" : "white",
                      color: active ? "white" : "#A0522D",
                      border: "1px solid #EDD5C0",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#EDD5C0] bg-white/70 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#A0522D]">Mood</h2>
              <span className="text-[12px] text-[#A0522D]/70">
                ({moods.length} / {MAX_PICK})
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((item) => {
                const active = moods.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleToggleMood(item)}
                    className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      background: active ? "#A0522D" : "white",
                      color: active ? "white" : "#A0522D",
                      border: "1px solid #EDD5C0",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            </section>
        </div>

        {pickWarning ? <p className="mt-4 text-sm text-amber-700">{pickWarning}</p> : null}
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

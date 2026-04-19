import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, useUser } from "@clerk/clerk-react";
import { addHostedTour } from "@/lib/hostedTours";
import { createInvite } from "@/lib/invites";
import { addLocalInvite } from "@/lib/localInvites";
import { BITE_COST_CREATE_INVITE } from "@/lib/bitePolicy";
import { applyBiteDeltaServer, fetchProfileBitesBalance } from "@/lib/profile";
import { getWalletBalance, roundBiteDisplay, WALLET_BALANCE_SYNC } from "@/lib/wallet";
import { formatFiat, fractionDigitsFor, type CurrencyCode } from "@/lib/currency";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";
import { CountryCitySelect } from "@/app/components/CountryCitySelect";
import { buildStoredLocationEnglish } from "@/lib/locations/dataset";
import { normalizeAppLocale } from "@/lib/i18n/appLocales";

type CreateTourScreenProps = {
  onClose: () => void;
};

const INCLUDED_OPTIONS = [
  { id: "meal", label: "Meal", icon: "🍽️" },
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "dessert", label: "Dessert", icon: "🍰" },
  { id: "transport", label: "Transport", icon: "🚕" },
  { id: "admission", label: "Admission ticket", icon: "🎟️" },
];

const TASTE_TAG_OPTIONS = [
  "Cafe Hopping",
  "Night Markets",
  "Art & Culture",
  "Street Food",
  "Vegetarian Friendly",
  "Vegan Spots",
  "Slow Travel",
  "Hidden Local Places",
  "Photography Walks",
  "Live Music",
];

type TimelineItem = {
  id: string;
  time: string;
  title: string;
  description: string;
};

const emptyTimelineItem = (): TimelineItem => ({
  id: crypto.randomUUID(),
  time: "",
  title: "",
  description: "",
});

/** Whole-number currencies (e.g. KRW): slider 0–300,000 in host units. */
const SLIDER_MAX_WHOLE = 300_000;
const SLIDER_STEP_WHOLE = 1_000;
/** Decimal currencies: separate cap so the control stays usable. */
const SLIDER_MAX_DECIMAL = 3_000;
const SLIDER_STEP_DECIMAL = 5;

export function CreateTourScreen({ onClose }: CreateTourScreenProps) {
  const { t, i18n } = useTranslation("common");
  const uiLocale = normalizeAppLocale(i18n.language);
  const { getToken } = useAuth();
  const { user } = useUser();
  const { preferredCurrency } = usePreferredCurrency();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primaryPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [included, setIncluded] = useState<Record<string, boolean>>(() => ({}));
  const [priceAmount, setPriceAmount] = useState(45000);
  const [hostCurrency, setHostCurrency] = useState<CurrencyCode>("KRW");
  const [capacity, setCapacity] = useState(2);
  const [meetupAt, setMeetupAt] = useState("");
  const [biteBalance, setBiteBalance] = useState(0);
  const [title, setTitle] = useState("");
  const [countryCode, setCountryCode] = useState("KR");
  const [cityEn, setCityEn] = useState("Seoul");
  const [locationDetail, setLocationDetail] = useState("");
  const [description, setDescription] = useState("");
  const [tasteTags, setTasteTags] = useState<string[]>([]);
  const [customTaste, setCustomTaste] = useState("");
  const [customTasteTags, setCustomTasteTags] = useState<string[]>([]);
  const [primaryPhoto, setPrimaryPhoto] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([emptyTimelineItem()]);
  const [step, setStep] = useState<1 | 2>(1);
  const [basicError, setBasicError] = useState("");
  const [timelineError, setTimelineError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  const selectedCount = useMemo(() => Object.values(included).filter(Boolean).length, [included]);
  const baseLocation = useMemo(
    () => buildStoredLocationEnglish(countryCode, cityEn),
    [countryCode, cityEn],
  );
  const hasBasicInfo = Boolean(
    title.trim() && countryCode.trim() && cityEn.trim() && description.trim() && primaryPhoto,
  );
  const displayedTasteTags = useMemo(
    () => [...TASTE_TAG_OPTIONS, ...customTasteTags],
    [customTasteTags],
  );

  const { sliderMax, sliderStep } = useMemo(() => {
    if (fractionDigitsFor(hostCurrency) === 0) {
      return { sliderMax: SLIDER_MAX_WHOLE, sliderStep: SLIDER_STEP_WHOLE };
    }
    return { sliderMax: SLIDER_MAX_DECIMAL, sliderStep: SLIDER_STEP_DECIMAL };
  }, [hostCurrency]);

  const toggleOption = (id: string) => {
    setIncluded((cur) => ({ ...cur, [id]: !cur[id] }));
  };

  const toggleTasteTag = (tag: string) => {
    setTasteTags((cur) =>
      cur.includes(tag) ? cur.filter((item) => item !== tag) : [...cur, tag],
    );
  };

  const addCustomTasteTag = () => {
    const normalized = customTaste.trim();
    if (!normalized) return;
    setCustomTasteTags((cur) => (cur.includes(normalized) ? cur : [...cur, normalized]));
    setTasteTags((cur) => (cur.includes(normalized) ? cur : [...cur, normalized]));
    setCustomTaste("");
  };

  const handlePrimaryPhotoPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const first = files[0];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(first);
    });
    setPrimaryPhoto(dataUrl);
  };

  const addTimelineItem = () => {
    setTimeline((prev) => [...prev, emptyTimelineItem()]);
  };

  const removeTimelineItem = (id: string) => {
    setTimeline((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateTimelineItem = (id: string, key: "time" | "title" | "description", value: string) => {
    setTimeline((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const validateTimeline = () => {
    if (!timeline.length) {
      setTimelineError("Add at least one timeline activity.");
      return false;
    }
    const invalid = timeline.find(
      (item) => !item.time.trim() || !item.title.trim() || !item.description.trim(),
    );
    if (invalid) {
      setTimelineError("Please fill Time, Activity Title, and Activity Description for each row.");
      return false;
    }
    setTimelineError("");
    return true;
  };

  const handleNextStep = () => {
    if (!hasBasicInfo) {
      setBasicError("Please complete title, location, primary photo, and description first.");
      return;
    }
    setBasicError("");
    setStep(2);
  };

  const handleCreateInvite = async () => {
    if (!hasBasicInfo) {
      setStep(1);
      setBasicError("Please complete title, location, primary photo, and description first.");
      return;
    }
    if (!validateTimeline()) return;

    if (user?.id) {
      const bal = getWalletBalance(user.id);
      if (bal < BITE_COST_CREATE_INVITE) {
        setSaveError(
          `You need at least ${BITE_COST_CREATE_INVITE} BITE energy to publish an invite. (Current balance: ${roundBiteDisplay(bal)})`,
        );
        return;
      }
    }

    const main = baseLocation.trim();
    const finalLocation = locationDetail.trim() ? `${main} · ${locationDetail.trim()}` : main;
    const city = cityEn.trim();
    const itinerary = timeline.map((item) => ({
      time: item.time.trim(),
      title: item.title.trim(),
      description: item.description.trim(),
    }));
    const finalTasteTags = tasteTags.length ? tasteTags : ["Cafe Hopping"];
    const includedOptions = Object.entries(included)
      .filter(([, active]) => active)
      .map(([id]) => id);

    let token: string | null = null;
    if (user?.id) {
      try {
        token = (await getToken({ template: "supabase" })) ?? null;
        if (token) {
          await applyBiteDeltaServer(user.id, token, -BITE_COST_CREATE_INVITE, "create_invite");
        } else {
          window.dispatchEvent(
            new CustomEvent("inbite-apply-bite", {
              detail: { clerkId: user.id, delta: -BITE_COST_CREATE_INVITE, kind: "create_invite" },
            }),
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message === "insufficient_balance") {
          setSaveError("Not enough BITE energy to publish this invite.");
          return;
        }
        setSaveError("We couldn’t deduct BITE energy. Check your connection and try again.");
        return;
      }
    }

    const hostDisplay =
      user?.fullName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username?.trim() ||
      undefined;

    addLocalInvite({
      id: crypto.randomUUID(),
      title: title.trim(),
      location: finalLocation,
      city: city?.trim() || main,
      locationDetail: locationDetail.trim(),
      description: description.trim(),
      primaryPhotoUrl: primaryPhoto,
      itinerary,
      tasteTags: finalTasteTags,
      includedOptions,
      priceAmount: Math.max(0, priceAmount),
      hostCurrency,
      capacity,
      meetupAt,
      createdAt: new Date().toISOString(),
      hostClerkId: user?.id,
      hostDisplayName: hostDisplay,
    });

    setSaveError("");
    setIsSaving(true);
    try {
      if (user?.id && token) {
        await createInvite(
          {
            clerkId: user.id,
            title: title.trim(),
            location: finalLocation,
            primaryPhotoUrl: primaryPhoto,
            description: description.trim(),
            itinerary,
            tasteTags: finalTasteTags,
            includedOptions,
            priceAmount: Math.max(0, priceAmount),
            hostCurrency,
            capacity,
            meetupAt,
          },
          token,
        );
      }

      addHostedTour({
        title: title.trim(),
        city: city?.trim() || main,
        district: locationDetail.trim(),
        description: description.trim(),
        tasteTags: finalTasteTags,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Invite sync to Supabase failed, kept locally.", err);
      if (user?.id) {
        try {
          const supabaseToken = token ?? (await getToken({ template: "supabase" }));
          if (supabaseToken) {
            await applyBiteDeltaServer(user.id, supabaseToken, BITE_COST_CREATE_INVITE, "adjustment", {
              reason: "create_invite_refund",
            });
          } else {
            window.dispatchEvent(
              new CustomEvent("inbite-apply-bite", {
                detail: { clerkId: user.id, delta: BITE_COST_CREATE_INVITE, kind: "adjustment" },
              }),
            );
          }
        } catch {
          // ignore refund failure
        }
      }
    } finally {
      setIsSaving(false);
    }
    onClose();
  };

  useEffect(() => {
    if (step === 2) {
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  useEffect(() => {
    setHostCurrency(preferredCurrency);
  }, [preferredCurrency]);

  useEffect(() => {
    setPriceAmount((p) => {
      const capped = Math.min(Math.max(0, p), sliderMax);
      const snapped = Math.round(capped / sliderStep) * sliderStep;
      return Math.min(Math.max(0, snapped), sliderMax);
    });
  }, [sliderMax, sliderStep]);

  useEffect(() => {
    if (!user?.id) {
      setBiteBalance(0);
      return;
    }
    const sync = () => setBiteBalance(getWalletBalance(user.id));
    sync();
    const h = () => sync();
    window.addEventListener(WALLET_BALANCE_SYNC, h);
    return () => window.removeEventListener(WALLET_BALANCE_SYNC, h);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const serverBalance = await fetchProfileBitesBalance(user.id, token);
        if (cancelled || serverBalance == null) return;
        setBiteBalance(serverBalance);
      } catch {
        // keep local cache balance
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, user?.id]);

  return (
    <div
      ref={containerRef}
      className="mx-auto max-h-[90svh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-[#FDFAF5] shadow-[0_-20px_70px_rgba(0,0,0,0.25)]"
    >
      <div className="px-5 pt-4 max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem+1.25rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18 9 12l6-6" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 text-center text-[18px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            Create Your Inbite
          </div>
          <div className="w-10" />
        </div>

        <div className="mt-5 rounded-2xl border border-[#EDD5C0] bg-white/60 p-3 text-[12px] font-semibold text-[#A0522D]/80">
          Step {step} of 2
        </div>

        {step === 1 ? (
          <>
            <div className="mt-6 text-[12px] font-semibold text-[#A0522D]/70">Experience Title *</div>
            <input
              className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
              placeholder="e.g., Local Food Tour with Han River Picnic"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="mt-5 text-[12px] font-semibold text-[#A0522D]/70">{t("locationPicker.meetingTitle")}</div>
            <div className="mt-2">
              <CountryCitySelect
                locale={uiLocale}
                countryCode={countryCode}
                cityEn={cityEn}
                onChange={(next) => {
                  setCountryCode(next.countryCode);
                  setCityEn(next.cityEn);
                }}
                labels={{
                  country: t("locationPicker.country"),
                  city: t("locationPicker.city"),
                  searchCountry: t("locationPicker.searchCountry"),
                  searchCity: t("locationPicker.searchCity"),
                  createCity: "",
                }}
                formatCreateCityLabel={(input) => t("locationPicker.createCity", { city: input })}
              />
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
              placeholder={t("locationPicker.districtOptional")}
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
            />

            <div className="mt-5 text-[12px] font-semibold text-[#A0522D]/70">Primary Photo *</div>
            <div className="mt-3">
              {primaryPhoto ? (
                <div className="relative h-40 overflow-hidden rounded-2xl border border-[#EDD5C0] bg-white">
                  <img src={primaryPhoto} alt="Primary invite" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPrimaryPhoto("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => primaryPhotoInputRef.current?.click()}
                  className="flex h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#EDD5C0] bg-white/40"
                >
                  <div className="text-[14px] font-semibold text-[#A0522D]">Add Primary Photo</div>
                </button>
              )}
              <input
                ref={primaryPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handlePrimaryPhotoPick(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="mt-5 text-[12px] font-semibold text-[#A0522D]/70">Experience Description *</div>
            <textarea
              className="mt-2 min-h-[110px] w-full resize-none rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
              placeholder="What would you like to share in this experience? Tell us your unique story."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {basicError ? <p className="mt-3 text-[12px] font-semibold text-red-600">{basicError}</p> : null}
          </>
        ) : (
          <>
            <div className="mt-6 text-[12px] font-semibold text-[#A0522D]/70">Journey Timeline</div>
            <div className="mt-3 rounded-2xl border border-[#EDD5C0] bg-white/60 p-4">
              <div className="relative space-y-4 pl-3">
                <div className="pointer-events-none absolute bottom-3 left-[14px] top-3 w-[2px] bg-[#A0522D]/25" />
                {timeline.map((item, index) => (
                  <div key={item.id} className="relative">
                    <div className="absolute left-0 top-6 h-7 w-7 rounded-full bg-[#A0522D] text-center text-[10px] font-semibold leading-7 text-white">
                      {item.time || `${index + 1}`}
                    </div>
                    <div className="ml-10 rounded-2xl border border-[#EDD5C0] bg-[#FDFAF5] p-3">
                      <input
                        className="w-full rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                        placeholder="Time (e.g., 14:00)"
                        value={item.time}
                        onChange={(e) => updateTimelineItem(item.id, "time", e.target.value)}
                      />
                      <input
                        className="mt-2 w-full rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                        placeholder="Activity Title"
                        value={item.title}
                        onChange={(e) => updateTimelineItem(item.id, "title", e.target.value)}
                      />
                      <textarea
                        className="mt-2 min-h-[78px] w-full resize-none rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                        placeholder="Activity Description"
                        value={item.description}
                        onChange={(e) => updateTimelineItem(item.id, "description", e.target.value)}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeTimelineItem(item.id)}
                          className="rounded-full border border-[#EDD5C0] px-3 py-1 text-[12px] font-semibold text-[#A0522D]"
                          aria-label="Delete timeline row"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTimelineItem}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#A0522D]/35 bg-[#A0522D]/10 px-4 py-2 text-[13px] font-semibold text-[#A0522D]"
              >
                <span className="text-[16px] leading-none">+</span> Add Timeline Row
              </button>
            </div>
            {timelineError ? <p className="mt-3 text-[12px] font-semibold text-red-600">{timelineError}</p> : null}
          </>
        )}

        {step === 2 ? (
          <div className="mt-6 rounded-[22px] bg-white/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
            <div className="text-[12px] font-semibold text-[#A0522D]/70">Tour price (fiat)</div>
            <div className="mt-3 rounded-xl border border-[#EDD5C0] bg-white px-3 py-4">
              <div className="text-center">
                <div className="text-[11px] font-semibold text-[#A0522D]/65">{hostCurrency}</div>
                <div className="mt-1 text-[clamp(1.15rem,4.5vw,1.45rem)] font-semibold leading-tight text-[#A0522D] tabular-nums">
                  {formatFiat(priceAmount, hostCurrency)}
                </div>
              </div>
              <label className="mt-4 block" htmlFor="invite-price-slider">
                <span className="sr-only">Invite price</span>
                <input
                  id="invite-price-slider"
                  type="range"
                  min={0}
                  max={sliderMax}
                  step={sliderStep}
                  value={Math.min(priceAmount, sliderMax)}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (!Number.isFinite(raw)) return;
                    const snapped = Math.round(raw / sliderStep) * sliderStep;
                    setPriceAmount(Math.min(Math.max(0, snapped), sliderMax));
                  }}
                  className="mt-3 h-3 w-full cursor-pointer accent-[#A0522D]"
                />
              </label>
              <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-[#A0522D]/50 tabular-nums">
                <span>{formatFiat(0, hostCurrency)}</span>
                <span>{formatFiat(sliderMax, hostCurrency)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <>
            <div className="mt-5 text-[12px] font-semibold text-[#A0522D]/70">Taste Tags</div>
            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-full border border-[#EDD5C0] bg-white/70 px-4 py-2.5 text-[13px] outline-none"
                placeholder="Add your own taste tag"
                value={customTaste}
                onChange={(e) => setCustomTaste(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTasteTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomTasteTag}
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#A0522D] text-[20px] font-semibold leading-none text-white"
                aria-label="Add custom taste tag"
              >
                →
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayedTasteTags.map((tag) => {
                const active = tasteTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTasteTag(tag)}
                    className="rounded-full px-4 py-2 text-[12px] font-semibold"
                    style={{
                      background: active ? "rgba(160,82,45,0.12)" : "rgba(255,255,255,0.55)",
                      color: "#A0522D",
                      border: active
                        ? "1px solid rgba(160,82,45,0.35)"
                        : "1px solid rgba(237,213,192,0.9)",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 text-[12px] font-semibold text-[#A0522D]/70">Included Options</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {INCLUDED_OPTIONS.map((opt) => {
                const active = !!included[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className="rounded-full px-4 py-2 text-[12px] font-semibold"
                    style={{
                      background: active ? "rgba(160,82,45,0.12)" : "rgba(255,255,255,0.55)",
                      color: "#A0522D",
                      border: active ? "1px solid rgba(160,82,45,0.35)" : "1px solid rgba(237,213,192,0.9)",
                    }}
                  >
                    <span className="mr-2" aria-hidden="true">
                      {opt.icon}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {saveError ? <p className="mt-3 text-[12px] font-semibold text-red-600">{saveError}</p> : null}

        <div className="mt-5 flex gap-2">
          {step === 2 ? (
            <button
              type="button"
              className="w-[36%] rounded-2xl border border-[#EDD5C0] bg-white py-4 text-[14px] font-semibold text-[#A0522D]"
              onClick={() => setStep(1)}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            disabled={isSaving}
            className="w-full rounded-2xl bg-[#A0522D] py-4 text-[15px] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.25)] disabled:opacity-60"
            onClick={step === 1 ? handleNextStep : () => setConfirmCreateOpen(true)}
          >
            {step === 1 ? "Next: Journey Timeline" : isSaving ? "Saving..." : "Create BITE"}
          </button>
        </div>

        {confirmCreateOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close create confirmation"
              onClick={() => setConfirmCreateOpen(false)}
              className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
            />
            <div className="relative z-10 w-full max-w-[430px] rounded-[24px] border border-[#E8D6C7] bg-[#FFF9F5] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.22)]">
              <div className="text-[15px] font-bold text-[#A0522D]">Why 1 BITE?</div>
              <p className="mt-2 text-[13px] leading-6 text-[#6F4C32]">
                In-Bite is <span className="font-semibold">100% commission-free</span>. To ensure high-quality
                connections and prevent spam, we charge <span className="font-semibold">1 BITE</span> for each
                invitation.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmCreateOpen(false)}
                  className="flex-1 rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[13px] font-semibold text-[#A0522D]"
                >
                  Stop
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setConfirmCreateOpen(false);
                    void handleCreateInvite();
                  }}
                  className="flex-1 rounded-2xl bg-[#A0522D] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  Create Inbite
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

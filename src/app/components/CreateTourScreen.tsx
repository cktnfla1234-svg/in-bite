import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addHostedTour } from "@/lib/hostedTours";
import { createInvite } from "@/lib/invites";
import { addLocalInvite } from "@/lib/localInvites";
import { BITE_COST_CREATE_INVITE } from "@/lib/bitePolicy";
import { applyBiteDeltaServer, fetchProfileBitesBalance } from "@/lib/profile";
import { getWalletBalance, roundBiteDisplay, WALLET_BALANCE_SYNC } from "@/lib/wallet";
import { type CurrencyCode } from "@/lib/currency";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";
import { CountryCitySelect } from "@/app/components/CountryCitySelect";
import { buildStoredLocationEnglish } from "@/lib/locations/dataset";
import { normalizeAppLocale } from "@/lib/i18n/appLocales";
import { AppShellTabbarPad } from "@/app/components/AppShellTabbarSafeArea";
import { InvitePriceCapacityMeetupFields } from "@/app/components/InvitePriceCapacityMeetupFields";
import {
  InviteJourneyTimelineEditor,
  emptyInviteTimelineRow,
  itineraryFromTimelineRows,
  type InviteTimelineRow,
} from "@/app/components/InviteJourneyTimelineEditor";

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

export function CreateTourScreen({ onClose }: CreateTourScreenProps) {
  const { t, i18n } = useTranslation("common");
  const uiLocale = normalizeAppLocale(i18n.language);
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { preferredCurrency } = usePreferredCurrency();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primaryPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [included, setIncluded] = useState<Record<string, boolean>>(() => ({}));
  const [priceAmount, setPriceAmount] = useState(45000);
  const [hostCurrency, setHostCurrency] = useState<CurrencyCode>("KRW");
  const [capacity, setCapacity] = useState(2);
  const [meetupAt, setMeetupAt] = useState("");
  const [meetupTbd, setMeetupTbd] = useState(false);
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
  const [timeline, setTimeline] = useState<InviteTimelineRow[]>([emptyInviteTimelineRow()]);
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

  const validateTimeline = () => {
    if (!timeline.length) {
      setTimelineError(t("inviteFields.timelineErrorEmpty"));
      return false;
    }
    const invalid = timeline.find(
      (item) => !item.time.trim() || !item.title.trim() || !item.description.trim(),
    );
    if (invalid) {
      setTimelineError(t("inviteFields.timelineErrorRow"));
      return false;
    }
    setTimelineError("");
    return true;
  };

  const handleNextStep = () => {
    if (!hasBasicInfo) {
      const missing: string[] = [];
      if (!title.trim()) missing.push("title");
      if (!countryCode.trim() || !cityEn.trim()) missing.push("location");
      if (!primaryPhoto) missing.push("primary photo");
      if (!description.trim()) missing.push("description");
      toast.error(`Please complete required fields: ${missing.join(", ")}`);
      setBasicError("Please complete title, location, primary photo, and description first.");
      return;
    }
    setBasicError("");
    setStep(2);
  };

  const handleCreateInvite = async () => {
    if (isSaving) return;
    console.log("[CreateInvite] Upload button clicked");
    if (!hasBasicInfo) {
      const missing: string[] = [];
      if (!title.trim()) missing.push("title");
      if (!countryCode.trim() || !cityEn.trim()) missing.push("location");
      if (!primaryPhoto) missing.push("primary photo");
      if (!description.trim()) missing.push("description");
      console.warn("[CreateInvite] blocked: missing required fields", { missing });
      toast.error(`Please complete required fields: ${missing.join(", ")}`);
      setStep(1);
      setBasicError("Please complete title, location, primary photo, and description first.");
      return;
    }
    setSaveError("");
    if (!validateTimeline()) {
      console.warn("[CreateInvite] blocked: invalid timeline");
      toast.error(t("inviteFields.timelineErrorRow"));
      return;
    }
    if (!meetupTbd && !meetupAt.trim()) {
      console.warn("[CreateInvite] blocked: meetup datetime missing");
      toast.error(t("inviteFields.meetupRequiredWhenNotTbd"));
      setSaveError(t("inviteFields.meetupRequiredWhenNotTbd"));
      return;
    }

    if (user?.id) {
      const bal = getWalletBalance(user.id);
      if (bal < BITE_COST_CREATE_INVITE) {
        console.warn("[CreateInvite] blocked: insufficient BITE balance", { balance: bal });
        toast.error(
          `You need at least ${BITE_COST_CREATE_INVITE} BITE energy. Current balance: ${roundBiteDisplay(bal)}`,
        );
        setSaveError(
          `You need at least ${BITE_COST_CREATE_INVITE} BITE energy to publish an invite. (Current balance: ${roundBiteDisplay(bal)})`,
        );
        return;
      }
    }

    const main = baseLocation.trim();
    const finalLocation = locationDetail.trim() ? `${main} · ${locationDetail.trim()}` : main;
    const city = cityEn.trim();
    const itinerary = itineraryFromTimelineRows(timeline);
    const finalTasteTags = tasteTags.length ? tasteTags : ["Cafe Hopping"];
    const includedOptions = Object.entries(included)
      .filter(([, active]) => active)
      .map(([id]) => id);

    const hostDisplay =
      user?.fullName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username?.trim() ||
      undefined;
    setSaveError("");
    setIsSaving(true);
    let token: string | null = null;
    let biteDeducted = false;
    try {
      if (!user?.id) {
        throw new Error("sign_in_required");
      }

      token = (await getToken({ template: "supabase" })) ?? null;
      if (!token) {
        throw new Error("missing_supabase_token");
      }

      // 1) Deduct 1 BITE on profiles (via atomic RPC).
      console.log("[CreateInvite] deducting BITE on server");
      await applyBiteDeltaServer(user.id, token, -BITE_COST_CREATE_INVITE, "create_invite");
      biteDeducted = true;
      console.log("[CreateInvite] BITE deduction succeeded");

      // 2) Insert invite row.
      console.log("[CreateInvite] before Supabase createInvite call");
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
          meetupAt: meetupTbd ? "" : meetupAt,
        },
        token,
      );
      console.log("[CreateInvite] after Supabase createInvite call");

      // 3) Reflect in local feed after successful remote insert.
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
        meetupAt: meetupTbd ? "" : meetupAt,
        createdAt: new Date().toISOString(),
        hostClerkId: user.id,
        hostDisplayName: hostDisplay,
      });

      addHostedTour({
        title: title.trim(),
        city: city?.trim() || main,
        district: locationDetail.trim(),
        description: description.trim(),
        tasteTags: finalTasteTags,
        createdAt: new Date().toISOString(),
      });

      setConfirmCreateOpen(false);
      onClose();
      navigate("/explore");
      return;
    } catch (err) {
      console.error("[CreateInvite] failed during submit flow", err);

      // If invite insert failed after deduction, refund BITE.
      if (biteDeducted && user?.id) {
        try {
          const supabaseToken = token ?? (await getToken({ template: "supabase" }));
          if (supabaseToken) {
            await applyBiteDeltaServer(user.id, supabaseToken, BITE_COST_CREATE_INVITE, "adjustment", {
              reason: "create_invite_refund",
            });
          }
        } catch {
          // ignore refund failure
        }
      }

      let message = "게시 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
      if (err instanceof Error && err.message === "insufficient_balance") {
        message = "Not enough BITE energy to publish this invite.";
      } else if (err instanceof Error && err.message === "missing_supabase_token") {
        message = "인증 정보를 확인할 수 없습니다. 다시 로그인 후 시도해 주세요.";
      } else if (err instanceof Error && err.message === "sign_in_required") {
        message = "로그인 후 초대장을 생성할 수 있습니다.";
      }
      toast.error(message);
      setSaveError(message);
    } finally {
      setIsSaving(false);
      console.log("[CreateInvite] submit flow finished");
    }
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
      <div className="px-5 pt-4 max-sm:pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
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
            <InviteJourneyTimelineEditor
              rows={timeline}
              onChange={setTimeline}
              errorText={timelineError || undefined}
              titleClassName="mt-6"
            />
          </>
        )}

        {step === 2 ? (
          <InvitePriceCapacityMeetupFields
            className="mt-6"
            hostCurrency={hostCurrency}
            priceAmount={priceAmount}
            onPriceAmountChange={setPriceAmount}
            capacity={capacity}
            onCapacityChange={setCapacity}
            meetupAt={meetupAt}
            onMeetupAtChange={setMeetupAt}
            meetupTbd={meetupTbd}
            onMeetupTbdChange={setMeetupTbd}
          />
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
          <AppShellTabbarPad className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                    void handleCreateInvite();
                  }}
                  className="flex-1 rounded-2xl bg-[#A0522D] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? "처리 중..." : "Create Inbite"}
                </button>
              </div>
            </div>
          </AppShellTabbarPad>
        ) : null}

        {isSaving ? (
          <AppShellTabbarPad className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            <div className="relative z-10 w-full max-w-[320px] rounded-[22px] border border-[#E8D6C7] bg-[#FFF9F5] px-5 py-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[#D7B89C] border-t-[#A0522D]" />
              <p className="mt-3 text-[14px] font-semibold text-[#A0522D]">처리 중...</p>
              <p className="mt-1 text-[12px] text-[#6F4C32]">포인트 차감 및 초대장 업로드를 진행하고 있어요.</p>
            </div>
          </AppShellTabbarPad>
        ) : null}
      </div>
    </div>
  );
}

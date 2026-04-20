export type CreateTourDraft = {
  title: string;
  countryCode: string;
  cityEn: string;
  locationDetail: string;
  description: string;
  primaryPhoto: string;
  timeline: Array<{ time: string; title: string; description: string }>;
  step: 1 | 2;
  tasteTags: string[];
  customTasteTags: string[];
  included: Record<string, boolean>;
  priceAmount: number;
  hostCurrency: string;
  capacity: number;
  meetupAt: string;
  meetupTbd: boolean;
  updatedAt: string;
};

function draftKey(clerkId?: string | null) {
  return `inbite:create-tour-draft:${clerkId?.trim() || "guest"}`;
}

export function loadCreateTourDraft(clerkId?: string | null): CreateTourDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(clerkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateTourDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.title && !parsed.description && !parsed.primaryPhoto) return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      countryCode: typeof parsed.countryCode === "string" ? parsed.countryCode : "KR",
      cityEn: typeof parsed.cityEn === "string" ? parsed.cityEn : "Seoul",
      locationDetail: typeof parsed.locationDetail === "string" ? parsed.locationDetail : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      primaryPhoto: typeof parsed.primaryPhoto === "string" ? parsed.primaryPhoto : "",
      timeline: Array.isArray(parsed.timeline)
        ? parsed.timeline.map((item) => ({
            time: typeof item?.time === "string" ? item.time : "",
            title: typeof item?.title === "string" ? item.title : "",
            description: typeof item?.description === "string" ? item.description : "",
          }))
        : [],
      step: parsed.step === 2 ? 2 : 1,
      tasteTags: Array.isArray(parsed.tasteTags) ? parsed.tasteTags.filter((x): x is string => typeof x === "string") : [],
      customTasteTags: Array.isArray(parsed.customTasteTags)
        ? parsed.customTasteTags.filter((x): x is string => typeof x === "string")
        : [],
      included: parsed.included && typeof parsed.included === "object" ? (parsed.included as Record<string, boolean>) : {},
      priceAmount: typeof parsed.priceAmount === "number" ? parsed.priceAmount : 45000,
      hostCurrency: typeof parsed.hostCurrency === "string" ? parsed.hostCurrency : "KRW",
      capacity: typeof parsed.capacity === "number" ? parsed.capacity : 2,
      meetupAt: typeof parsed.meetupAt === "string" ? parsed.meetupAt : "",
      meetupTbd: Boolean(parsed.meetupTbd),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveCreateTourDraft(clerkId: string | null | undefined, draft: CreateTourDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(clerkId), JSON.stringify(draft));
  } catch {
    // ignore quota/storage errors
  }
}

export function clearCreateTourDraft(clerkId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(clerkId));
  } catch {
    // ignore
  }
}

export function hasCreateTourDraft(clerkId?: string | null): boolean {
  return Boolean(loadCreateTourDraft(clerkId));
}

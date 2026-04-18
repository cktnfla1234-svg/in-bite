import { getWalletBalance, setWalletBalance } from "./wallet";
import { getSupabaseClient } from "./supabase";
import type { BiteHistoryKind } from "./bitePolicy";
import { isSelectableCurrency, type CurrencyCode } from "./currency";

type ClerkLikeUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmailAddress?: { emailAddress: string } | null;
};

export function roundBiteAmount(n: number) {
  return Math.round(n * 100) / 100;
}

export async function upsertClerkProfile(user: ClerkLikeUser, token: string) {
  const supabase = getSupabaseClient(token);
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const nowIso = new Date().toISOString();

  const { error: insertError } = await supabase.from("profiles").upsert(
    {
      clerk_id: user.id,
      email,
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: user.imageUrl,
      bites_balance: 0,
      welcome_bonus_granted: false,
      preferred_currency: "KRW",
      updated_at: nowIso,
    },
    { onConflict: "clerk_id", ignoreDuplicates: true },
  );

  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      email,
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: user.imageUrl,
      updated_at: nowIso,
    })
    .eq("clerk_id", user.id);

  if (updateError) throw updateError;
}

export async function getOnboardingCompleted(clerkId: string, token: string) {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.onboarding_completed);
}

export async function updateProfileBitesBalance(clerkId: string, token: string, bitesBalance: number) {
  const supabase = getSupabaseClient(token);
  const next = roundBiteAmount(Math.max(0, bitesBalance));
  const { error } = await supabase
    .from("profiles")
    .update({ bites_balance: next, updated_at: new Date().toISOString() })
    .eq("clerk_id", clerkId);
  if (error) throw error;
}

export async function applyBiteDeltaServer(
  clerkId: string,
  token: string,
  delta: number,
  kind: BiteHistoryKind | string,
  meta: Record<string, unknown> = {},
): Promise<{ balance: number }> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase.rpc("apply_bite_delta", {
    p_delta: delta,
    p_kind: kind,
    p_meta: meta,
  });

  if (!error && data != null) {
    const balance = roundBiteAmount(Number(data));
    setWalletBalance(balance, clerkId);
    return { balance };
  }

  const { data: row, error: readErr } = await supabase
    .from("profiles")
    .select("bites_balance")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (readErr || !row) {
    throw readErr ?? new Error("profile missing");
  }

  const cur = roundBiteAmount(Number(row.bites_balance) || 0);
  const next = roundBiteAmount(cur + delta);
  if (next < 0) {
    throw new Error("insufficient_balance");
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ bites_balance: next, updated_at: new Date().toISOString() })
    .eq("clerk_id", clerkId);

  if (upErr) throw upErr;

  const { error: histErr } = await supabase.from("bites_history").insert({
    clerk_id: clerkId,
    delta: roundBiteAmount(delta),
    balance_after: next,
    kind,
    meta: meta ?? {},
  });

  if (histErr) {
    console.warn("bites_history insert failed; balance updated", histErr);
  }

  setWalletBalance(next, clerkId);
  return { balance: next };
}

export type BiteHistoryRow = {
  id: number;
  clerk_id: string;
  delta: number;
  balance_after: number;
  kind: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export async function fetchBitesHistory(clerkId: string, token: string, limit = 50): Promise<BiteHistoryRow[]> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("bites_history")
    .select("id, clerk_id, delta, balance_after, kind, meta, created_at")
    .eq("clerk_id", clerkId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchBitesHistory", error);
    return [];
  }
  return (data ?? []) as BiteHistoryRow[];
}

export async function fetchProfileBitesBalance(clerkId: string, token: string): Promise<number | null> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("profiles")
    .select("bites_balance")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  if (error || !data) return null;
  return roundBiteAmount(Number(data.bites_balance) || 0);
}

export async function mergeWalletBalanceWithSupabase(clerkId: string, token: string) {
  const server = await fetchProfileBitesBalance(clerkId, token);
  if (server == null) return;

  const local = getWalletBalance(clerkId);
  const merged = roundBiteAmount(Math.max(server, local));
  setWalletBalance(merged, clerkId);
  if (merged !== server) {
    try {
      await updateProfileBitesBalance(clerkId, token, merged);
    } catch {
      // keep merged local; next session may retry
    }
  }
}

export async function saveCurrentTastes(clerkId: string, tastes: string[], token: string) {
  const supabase = getSupabaseClient(token);
  const { error } = await supabase
    .from("profiles")
    .update({
      current_tastes: tastes,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);

  if (error) throw error;
}

export async function fetchProfileCurrencyPrefs(clerkId: string, token: string): Promise<CurrencyCode> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    console.warn("fetchProfileCurrencyPrefs", error);
    return "KRW";
  }
  const raw = data?.preferred_currency;
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "KRW";
  return isSelectableCurrency(code) ? code : "KRW";
}

export async function updatePreferredCurrency(clerkId: string, token: string, code: CurrencyCode) {
  const supabase = getSupabaseClient(token);
  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_currency: code,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);

  if (error) throw error;
}

export async function fetchProfileLanguageCode(clerkId: string, token: string): Promise<string | null> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase.from("profiles").select("language_code").eq("clerk_id", clerkId).maybeSingle();
  if (error) {
    console.warn("fetchProfileLanguageCode", error);
    return null;
  }
  const raw = data?.language_code;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function updateProfileLanguageCode(clerkId: string, token: string, languageCode: string) {
  const supabase = getSupabaseClient(token);
  const { error } = await supabase
    .from("profiles")
    .update({
      language_code: languageCode,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);

  if (error) throw error;
}

export async function updateProfileDeviceToken(clerkId: string, token: string, deviceToken: string) {
  const supabase = getSupabaseClient(token);
  const { error } = await supabase
    .from("profiles")
    .update({
      device_token: deviceToken,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);
  if (error) throw error;
}

export async function updateProfileImageUrl(clerkId: string, token: string, imageUrl: string) {
  const supabase = getSupabaseClient(token);
  const { error } = await supabase
    .from("profiles")
    .update({
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);
  if (error) throw error;
}

/** Optional columns from `supabase_profiles_extended.sql` — ignored if not migrated yet. */
export type ExtendedProfileRow = {
  image_url: string | null;
  display_name: string | null;
  profile_city: string | null;
  profile_country_code: string | null;
  profile_address: string | null;
  profile_mbti: string | null;
  profile_hobbies: string | null;
  profile_bio: string | null;
  profile_gallery: unknown;
};

export async function fetchExtendedProfile(clerkId: string, token: string): Promise<ExtendedProfileRow | null> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "image_url, display_name, profile_city, profile_country_code, profile_address, profile_mbti, profile_hobbies, profile_bio, profile_gallery",
    )
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    console.warn("fetchExtendedProfile", error);
    return null;
  }
  return data as ExtendedProfileRow | null;
}

export async function saveExtendedProfile(
  clerkId: string,
  token: string,
  payload: {
    name: string;
    city: string;
    countryCode: string;
    address: string;
    mbti: string;
    hobbies: string;
    bio: string;
    profilePhoto: string;
    photos: string[];
  },
) {
  const supabase = getSupabaseClient(token);
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      image_url: payload.profilePhoto || null,
      display_name: payload.name || null,
      profile_city: payload.city || null,
      profile_country_code: payload.countryCode || null,
      profile_address: payload.address || null,
      profile_mbti: payload.mbti || null,
      profile_hobbies: payload.hobbies || null,
      profile_bio: payload.bio || null,
      profile_gallery: payload.photos,
      updated_at: nowIso,
    })
    .eq("clerk_id", clerkId);

  if (error) throw error;
}

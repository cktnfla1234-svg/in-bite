import { getSupabaseClient } from "./supabase";
import type { CurrencyCode } from "./currency";

export type InviteItineraryItem = {
  time: string;
  title: string;
  description: string;
};

export type CreateInviteInput = {
  clerkId: string;
  title: string;
  location: string;
  primaryPhotoUrl: string;
  description: string;
  itinerary: InviteItineraryItem[];
  tasteTags: string[];
  includedOptions: string[];
  /** Tour price in fiat (host_currency). */
  priceAmount: number;
  hostCurrency: CurrencyCode;
  capacity: number;
  meetupAt: string;
};

export type InviteRow = {
  id: string;
  clerk_id: string;
  title: string;
  location: string;
  primary_photo_url: string;
  description: string;
  itinerary: InviteItineraryItem[];
  taste_tags: string[] | null;
  included_options: string[] | null;
  price_amount: number;
  host_currency: string;
  capacity: number | null;
  meetup_at: string | null;
  created_at: string;
};

function getErrorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "";
  const e = err as { message?: unknown; details?: unknown; hint?: unknown };
  const parts = [e.message, e.details, e.hint].filter((v): v is string => typeof v === "string");
  return parts.join(" ").trim();
}

function isMissingColumnError(err: unknown, column: string): boolean {
  const msg = getErrorText(err).toLowerCase();
  if (!msg) return false;
  return msg.includes("schema cache") && msg.includes(`'${column.toLowerCase()}'`);
}

function parseMissingInvitesColumn(err: unknown): string | null {
  const msg = getErrorText(err);
  if (!msg) return null;
  const m = msg.match(/could not find the '([^']+)' column of 'invites' in the schema cache/i);
  return m?.[1] ?? null;
}

function omitKey<T extends Record<string, unknown>>(obj: T, key: string): Record<string, unknown> {
  const { [key]: _dropped, ...rest } = obj;
  return rest;
}

function toInviteRowsWithOptionalDefaults(rows: unknown[]): InviteRow[] {
  return rows.map((row) => {
    const r = row as Omit<InviteRow, "capacity" | "meetup_at"> & {
      capacity?: number | null;
      meetup_at?: string | null;
    };
    return {
      ...r,
      capacity: typeof r.capacity === "number" ? r.capacity : null,
      meetup_at: typeof r.meetup_at === "string" ? r.meetup_at : null,
    };
  });
}

export async function createInvite(input: CreateInviteInput, token: string) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  let payload: Record<string, unknown> = {
    clerk_id: input.clerkId,
    title: input.title,
    location: input.location,
    primary_photo_url: input.primaryPhotoUrl,
    description: input.description,
    itinerary: input.itinerary,
    taste_tags: input.tasteTags,
    included_options: input.includedOptions,
    price_amount: input.priceAmount,
    host_currency: input.hostCurrency,
    capacity: input.capacity,
    meetup_at: input.meetupAt || null,
  };
  for (let i = 0; i < 3; i += 1) {
    const { error } = await supabase.from("invites").insert(payload);
    if (!error) return;
    const missing = parseMissingInvitesColumn(error);
    if (missing && missing in payload) {
      payload = omitKey(payload, missing);
      continue;
    }
    throw error;
  }
  throw new Error("createInvite failed after schema compatibility retries.");
}

export async function updateInvite(
  inviteId: string,
  input: Omit<CreateInviteInput, "clerkId">,
  token: string,
) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  let payload: Record<string, unknown> = {
      title: input.title,
      location: input.location,
      primary_photo_url: input.primaryPhotoUrl,
      description: input.description,
      itinerary: input.itinerary,
      taste_tags: input.tasteTags,
      included_options: input.includedOptions,
      price_amount: input.priceAmount,
      host_currency: input.hostCurrency,
      capacity: input.capacity,
      meetup_at: input.meetupAt || null,
      updated_at: new Date().toISOString(),
    };
  for (let i = 0; i < 3; i += 1) {
    const { error } = await supabase.from("invites").update(payload).eq("id", inviteId);
    if (!error) return;
    const missing = parseMissingInvitesColumn(error);
    if (missing && missing in payload) {
      payload = omitKey(payload, missing);
      continue;
    }
    throw error;
  }
  throw new Error("updateInvite failed after schema compatibility retries.");
}

export async function deleteInvite(inviteId: string, token: string) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  if (error) throw error;
}

/**
 * Lists invites visible to the **authenticated** JWT. With legacy RLS (`select_own_invites`),
 * this returns only the current user's rows — do not use for the public Explore feed.
 */
export async function listOwnInvites(token: string): Promise<InviteRow[]> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return [];
  const selectFull =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, meetup_at, created_at";
  const selectNoCapacity =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, meetup_at, created_at";
  const selectNoMeetup =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, created_at";
  const selectNoOptional =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, created_at";
  const selectCandidates = [selectFull, selectNoCapacity, selectNoMeetup, selectNoOptional];
  for (const select of selectCandidates) {
    const { data, error } = await supabase
      .from("invites")
      .select(select)
      .order("created_at", { ascending: false });
    if (!error) return toInviteRowsWithOptionalDefaults((data ?? []) as unknown[]);
    const missing = parseMissingInvitesColumn(error);
    if (missing === "capacity" || missing === "meetup_at") continue;
    throw error;
  }
  return [];
}

const PUBLIC_INVITE_SELECT =
  "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, meetup_at, created_at";

/**
 * Public invite feed (anon Supabase client), same pattern as `fetchPublicDailyBites`.
 * Requires RLS that allows `anon` to `select` from `public.invites` (see `supabase_rls_production_invites_feed.sql`).
 */
export async function fetchPublicInvites(limit = 160): Promise<InviteRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const selectNoCapacity =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, meetup_at, created_at";
  const selectNoMeetup =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, created_at";
  const selectNoOptional =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, created_at";
  const selectCandidates = [PUBLIC_INVITE_SELECT, selectNoCapacity, selectNoMeetup, selectNoOptional];
  for (const select of selectCandidates) {
    const { data, error } = await supabase
      .from("invites")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error) return toInviteRowsWithOptionalDefaults((data ?? []) as unknown[]);
    const missing = parseMissingInvitesColumn(error);
    if (missing === "capacity" || missing === "meetup_at") continue;
    console.warn("fetchPublicInvites", error);
    return [];
  }
  return [];
}

/**
 * Fetches invites authored by a specific Clerk user.
 * Requires an authenticated JWT and SELECT policy on `invites`.
 */
export async function fetchInvitesByClerkId(token: string, clerkId: string, limit = 40): Promise<InviteRow[]> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return [];
  const targetClerkId = clerkId.trim();
  if (!targetClerkId) return [];
  const selectNoCapacity =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, meetup_at, created_at";
  const selectNoMeetup =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, created_at";
  const selectNoOptional =
    "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, created_at";
  const selectCandidates = [PUBLIC_INVITE_SELECT, selectNoCapacity, selectNoMeetup, selectNoOptional];
  for (const select of selectCandidates) {
    const { data, error } = await supabase
      .from("invites")
      .select(select)
      .eq("clerk_id", targetClerkId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error) return toInviteRowsWithOptionalDefaults((data ?? []) as unknown[]);
    const missing = parseMissingInvitesColumn(error);
    if (missing === "capacity" || missing === "meetup_at") continue;
    console.warn("fetchInvitesByClerkId", error);
    return [];
  }
  return [];
}

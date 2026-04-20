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

export async function createInvite(input: CreateInviteInput, token: string) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const { error } = await supabase.from("invites").insert({
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
    bites: 1,
  });

  if (error) throw error;
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
  const { error } = await supabase
    .from("invites")
    .update({
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
    })
    .eq("id", inviteId);
  if (error) throw error;
}

/**
 * Lists invites visible to the **authenticated** JWT. With legacy RLS (`select_own_invites`),
 * this returns only the current user's rows — do not use for the public Explore feed.
 */
export async function listOwnInvites(token: string): Promise<InviteRow[]> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("invites")
    .select(
      "id, clerk_id, title, location, primary_photo_url, description, itinerary, taste_tags, included_options, price_amount, host_currency, capacity, meetup_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InviteRow[];
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
  const { data, error } = await supabase
    .from("invites")
    .select(PUBLIC_INVITE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchPublicInvites", error);
    return [];
  }
  return (data ?? []) as InviteRow[];
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

  const { data, error } = await supabase
    .from("invites")
    .select(PUBLIC_INVITE_SELECT)
    .eq("clerk_id", targetClerkId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchInvitesByClerkId", error);
    return [];
  }
  return (data ?? []) as InviteRow[];
}

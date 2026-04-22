import type { Experience } from "@/data/experiences";
import type { LocalInvite } from "@/lib/localInvites";
import { getSupabaseClient } from "@/lib/supabase";

export type InviteDiscoveryRow = {
  location: string;
  taste_tags: string[] | null;
};

/** Match CreateTourScreen: city is first comma segment before optional " · " detail. */
export function cityFromStoredLocation(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "";
  const beforeDetail = trimmed.split("·")[0]?.trim() ?? trimmed;
  const [firstPart] = beforeDetail.split(",");
  return (firstPart ?? beforeDetail).trim() || beforeDetail;
}

function rankLabelsByFrequency(items: string[]): string[] {
  const score = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (!key) continue;
    score.set(key, (score.get(key) ?? 0) + 1);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

/** After ranked invite-derived labels, pad from defaults until at least `minCount` unique labels. */
export function mergeRankedWithDefaults(ranked: string[], defaults: string[], minCount: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const s = raw.trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };

  for (const s of ranked) add(s);

  let guard = 0;
  while (out.length < minCount && defaults.length > 0 && guard < 400) {
    for (const d of defaults) {
      add(d);
      if (out.length >= minCount) break;
    }
    guard += 1;
  }

  return out;
}

function collectCityLabels(
  local: LocalInvite[],
  remote: InviteDiscoveryRow[],
  catalog: Pick<Experience, "city">[],
): string[] {
  const fromRemote = remote.map((r) => cityFromStoredLocation(r.location));
  const fromLocal = local.map((i) => i.city.trim()).filter(Boolean);
  const fromCatalog = catalog.map((e) => e.city.trim()).filter(Boolean);
  return [...fromRemote, ...fromLocal, ...fromCatalog];
}

function collectTasteLabels(
  local: LocalInvite[],
  remote: InviteDiscoveryRow[],
  catalog: Pick<Experience, "tasteTags">[],
): string[] {
  const fromRemote = remote.flatMap((r) => r.taste_tags ?? []);
  const fromLocal = local.flatMap((i) => i.tasteTags);
  const fromCatalog = catalog.flatMap((e) => e.tasteTags);
  return [...fromRemote, ...fromLocal, ...fromCatalog];
}

export function computePopularDestinations(
  local: LocalInvite[],
  remote: InviteDiscoveryRow[],
  catalog: Pick<Experience, "city">[],
  defaultCities: string[],
  minCount = 8,
): string[] {
  const ranked = rankLabelsByFrequency(collectCityLabels(local, remote, catalog));
  return mergeRankedWithDefaults(ranked, defaultCities, minCount);
}

export function computePopularTastes(
  local: LocalInvite[],
  remote: InviteDiscoveryRow[],
  catalog: Pick<Experience, "tasteTags">[],
  defaultTastes: string[],
  minCount = 8,
): string[] {
  const ranked = rankLabelsByFrequency(collectTasteLabels(local, remote, catalog));
  return mergeRankedWithDefaults(ranked, defaultTastes, minCount);
}

export async function fetchInviteDiscoveryRows(): Promise<InviteDiscoveryRow[]> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("invites")
      .select("location, taste_tags")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) return [];
    return (data ?? []) as InviteDiscoveryRow[];
  } catch {
    return [];
  }
}

/** Refetch discovery when any invite row changes (debounced). Requires public SELECT on `invites` + Realtime on table. */
export function subscribeInvitesDiscoveryRealtime(
  onRefresh: () => void,
  opts?: { debounceMs?: number; channelSuffix?: string },
): () => void {
  if (typeof window === "undefined") return () => {};

  const debounceMs = opts?.debounceMs ?? 320;
  const suffix = opts?.channelSuffix ?? "default";

  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  let timer: number | null = null;
  const schedule = () => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      onRefresh();
    }, debounceMs);
  };

  const channel = supabase
    .channel(`home-invites-discovery:${suffix}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invites" },
      () => {
        schedule();
      },
    )
    .subscribe();

  return () => {
    if (timer != null) window.clearTimeout(timer);
    void channel.unsubscribe();
    void supabase.removeChannel(channel);
  };
}

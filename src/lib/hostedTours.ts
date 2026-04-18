const STORAGE_KEY = "inbite-has-hosted-tour";
const TOURS_STORAGE_KEY = "inbite-hosted-tours";

export type HostedTour = {
  title: string;
  city: string;
  district?: string;
  description?: string;
  tasteTags: string[];
  createdAt: string;
};

export function hasCreatedHostedTour(): boolean {
  if (typeof window === "undefined") return false;
  const hasFlag = window.localStorage.getItem(STORAGE_KEY) === "1";
  return hasFlag || getHostedTours().length > 0;
}

export function markHostedTourCreated(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, "1");
  window.dispatchEvent(new Event("inbite-hosted-tour-sync"));
}

export function getHostedTours(): HostedTour[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TOURS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HostedTour[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addHostedTour(tour: HostedTour): void {
  if (typeof window === "undefined") return;
  const tours = getHostedTours();
  tours.unshift(tour);
  window.localStorage.setItem(TOURS_STORAGE_KEY, JSON.stringify(tours));
  markHostedTourCreated();
}

function rankByFrequency(items: string[]): string[] {
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

export function getPopularCities(limit = 8): string[] {
  const ranked = rankByFrequency(getHostedTours().map((tour) => tour.city));
  return ranked.slice(0, limit);
}

export function getPopularTastes(limit = 10): string[] {
  const allTastes = getHostedTours().flatMap((tour) => tour.tasteTags);
  const ranked = rankByFrequency(allTastes);
  return ranked.slice(0, limit);
}

export type IncludedItem = {
  id: string;
  /** Korean label shown on cards and detail (e.g. "식사 포함") */
  labelKo: string;
  emoji: string;
};

export type ItineraryStop = {
  time: string;
  title: string;
  description?: string;
};

export type Experience = {
  id: string;
  title: string;
  hostName: string;
  hostClerkId?: string;
  hostAvatarUrl?: string;
  coverPhotoUrl?: string;
  city: string;
  country: string;
  tasteTags: string[];
  /** Tour price in host's fiat currency (ISO 4217). */
  priceAmount: number;
  hostCurrency: string;
  rating: number;
  reviews: number;
  /** ISO timestamp for recency sorting (mainly local invites). */
  createdAt?: string;
  /** Short line on cards */
  about: string;
  /** Longer Korean body for the detail screen */
  aboutDetailKo: string;
  durationLabel: string;
  maxGuestsLabel: string;
  /** Legacy simple labels; kept for any string-only use */
  included: string[];
  includedItems: IncludedItem[];
  itinerary: ItineraryStop[];
};

export const experiences: Experience[] = [];

export type DailyBitePost = {
  id: string;
  authorName: string;
  authorBio: string;
  text: string;
  city: string;
  createdLabel: string;
  /** ISO timestamp for ordering merged local + remote feeds. */
  createdAtIso?: string;
  photoUrls?: string[];
  authorImageUrl?: string;
  likeCount?: number;
  commentCount?: number;
  /** When set, likes/comments can notify this owner via Activity + Supabase. */
  authorClerkId?: string | null;
};

export const dailyBites: DailyBitePost[] = [];

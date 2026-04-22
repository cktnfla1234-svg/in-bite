import { getLocalInvites, type LocalInvite } from "@/lib/localInvites";

type ClerkUserLike = {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

/**
 * Stable ids aligned with `supabase_seed_surim_demo_invites.sql` so server + local stay one card each.
 * Legacy string ids are stripped on sync so old devices do not keep duplicate rows.
 */
export const SURIM_DEMO_INVITE_IDS = [
  "a1000000-0000-4000-8000-000000000001",
  "a1000000-0000-4000-8000-000000000002",
] as const;

const LEGACY_SURIM_DEMO_INVITE_IDS = ["surim-demo-cafe-books", "surim-demo-vegan-seoul"] as const;

/**
 * Matches the Surim Cha demo account (Clerk display name).
 * Optional: set `VITE_DEMO_INVITES_OWNER_CLERK_ID` to your Clerk user id to seed regardless of name.
 */
export function isSurimChaDemoUser(user: ClerkUserLike | null | undefined): boolean {
  if (!user) return false;
  const envId = typeof import.meta.env.VITE_DEMO_INVITES_OWNER_CLERK_ID === "string"
    ? import.meta.env.VITE_DEMO_INVITES_OWNER_CLERK_ID.trim()
    : "";
  if (envId && user.id === envId) return true;
  const full = (user.fullName ?? [user.firstName, user.lastName].filter(Boolean).join(" ")).trim().toLowerCase();
  return full.includes("surim") && full.includes("cha");
}

function buildSurimDemoInvites(ownerClerkId: string, ownerDisplayName: string): LocalInvite[] {
  const createdAt = "2026-04-19T10:00:00.000Z";
  const meetup = "2026-05-10T14:00:00.000Z";

  const cafeBooks: LocalInvite = {
    id: SURIM_DEMO_INVITE_IDS[0],
    title: "책 마시고 커피 읽을 사람🙋‍♀️",
    location: "Seoul, South Korea",
    city: "Seoul",
    locationDetail: "Sungsoo-dong",
    description:
      "좋아하는 작가나 책 선정해서 수다떨어요!\n책 읽고 이야기 할 사람이 없는 사람 '대''환''영'✨",
    primaryPhotoUrl:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
    itinerary: [
      {
        time: "14:00",
        title: "첫번째, 카페 · Upside Coffee",
        description: "시그니처 커피(해방촌 커피, 뚝섬 커피, 바나나 에스프레소 등)이 너무 맛있는 곳이에요! 너무 조용하지도, 시끄럽지도 않아서 얘기나누기 딱 좋아요!",
      },
      {
        time: "15:30",
        title: "두번째, 카페 · MaCoy Cafe",
        description: "성수 제일 카푸치노 맛집.",
      },
      {
        time: "16:15",
        title: "세번째, 카페 · Circle",
        description: "(Optional) 연달아 커피가 힘들면 커피 or 티 선택가능한 곳으로 모십니다~~",
      },
    ],
    tasteTags: ["Cafe Hopping", "Art & Culture", "Slow Travel"],
    includedOptions: ["coffee", "dessert", "tea"],
    priceAmount: 15000,
    hostCurrency: "KRW",
    capacity: 4,
    meetupAt: meetup,
    createdAt,
    hostClerkId: ownerClerkId,
    hostDisplayName: ownerDisplayName,
  };

  const veganTour: LocalInvite = {
    id: SURIM_DEMO_INVITE_IDS[1],
    title: "비건은 힘이 세다🥑👊",
    location: "Seoul, South Korea",
    city: "Seoul",
    locationDetail: "Jongno-gu",
    description:
      "비건 브런치 → 플랜트 베이스 디저트 카페까지 한 번에 부수는 반나절 코스예요.\n알레르기·선호(무글루텐 등)는 미리 알려주세요!✨",
    primaryPhotoUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    itinerary: [
      {
        time: "11:00",
        title: "비건 브런치",
        description: "종로 오세계향 — 모든 한식이 비건 재료로 만들어짐!",
      },
      {
        time: "13:00",
        title: "종로 비건 카페",
        description: "케이크·쿠키가 모두 비건. 우유 계란 없이 어케했노? 커피 or 티 선택.",
      },
    ],
    tasteTags: ["Vegetarian Friendly", "Street Food", "Cafe Hopping"],
    includedOptions: ["meal", "coffee", "dessert"],
    priceAmount: 0,
    hostCurrency: "KRW",
    capacity: 5,
    meetupAt: "2026-05-17T11:00:00.000Z",
    createdAt,
    hostClerkId: ownerClerkId,
    hostDisplayName: ownerDisplayName,
  };

  return [cafeBooks, veganTour];
}

/**
 * Inserts or refreshes the two Surim Cha demo invites at the top of local storage.
 * Other users' invites in the same list are left unchanged.
 */
export function upsertSurimChaDemoInvites(user: ClerkUserLike): void {
  if (typeof window === "undefined") return;
  if (!isSurimChaDemoUser(user)) return;

  const display =
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    "Surim Cha";

  const demos = buildSurimDemoInvites(user.id, display);
  const demoIdSet = new Set<string>([...SURIM_DEMO_INVITE_IDS, ...LEGACY_SURIM_DEMO_INVITE_IDS]);
  const rest = getLocalInvites().filter((i) => !demoIdSet.has(i.id));
  const next = [...demos, ...rest];
  window.localStorage.setItem("inbite:local-invites", JSON.stringify(next));
  window.dispatchEvent(new Event("inbite-local-invites-sync"));
}

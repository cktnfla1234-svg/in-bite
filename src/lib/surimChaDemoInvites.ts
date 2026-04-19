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
    title: "책 읽으며 카페 두 곳 투어 (강남 → 연남)",
    location: "Seoul, South Korea",
    city: "Seoul",
    locationDetail: "강남역 1번 출구 · 연남동 골목",
    description:
      "조용히 책 읽기 좋은 카페 두 곳을 옮겨 다니며 커피 한 잔씩 나눠요.\n첫 카페에서는 각자 읽고 싶은 책 한 권만 들고 오면 됩니다.\n두 번째 카페까지 걸으며 가볍게 수다도 나눠요. 초보 독서모임 환영!",
    primaryPhotoUrl:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
    itinerary: [
      {
        time: "14:00",
        title: "1카페 · 강남",
        description: "에스프레소 베이스 커피와 창가 자리에서 1시간 독서.",
      },
      {
        time: "15:30",
        title: "이동 · 지하철 2호선",
        description: "합정 방향으로 이동 (약 25분).",
      },
      {
        time: "16:15",
        title: "2카페 · 연남",
        description: "핸드드립 위주 카페. 디저트는 선택!",
      },
    ],
    tasteTags: ["Cafe Hopping", "Art & Culture", "Slow Travel"],
    includedOptions: ["coffee", "dessert", "transport"],
    priceAmount: 35000,
    hostCurrency: "KRW",
    capacity: 4,
    meetupAt: meetup,
    createdAt,
    hostClerkId: ownerClerkId,
    hostDisplayName: ownerDisplayName,
  };

  const veganTour: LocalInvite = {
    id: SURIM_DEMO_INVITE_IDS[1],
    title: "서울 비건 식당 & 카페 투어",
    location: "Seoul, South Korea",
    city: "Seoul",
    locationDetail: "종로·성수 일대",
    description:
      "비건 브런치 → 플랜트 베이스 디저트 카페까지 한 번에 즐기는 반나절 코스예요.\n알레르기·선호(무글루텐 등)는 미리 알려주세요. 사진 많이 찍어도 좋아요!",
    primaryPhotoUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    itinerary: [
      {
        time: "11:00",
        title: "비건 브런치",
        description: "종로 근처 비건 레스토랑 — 샐러드·토스트·스무디 보울.",
      },
      {
        time: "13:00",
        title: "성수 비건 카페",
        description: "케이크·쿠키는 모두 비건. 커피 or 티 선택.",
      },
    ],
    tasteTags: ["Vegetarian Friendly", "Street Food", "Cafe Hopping"],
    includedOptions: ["meal", "coffee", "dessert"],
    priceAmount: 42000,
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

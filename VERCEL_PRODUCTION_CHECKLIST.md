# Vercel 프로덕션 배포 점검 가이드

로컬에서는 되는데 **배포 URL(Vercel)에서만** 데이터가 안 보이거나, 저장·클릭이 안 될 때 아래 순서대로 확인하세요.  
(로컬 `.env`와 **Vercel Production 환경 변수**는 별도입니다. Vercel에 넣지 않으면 프로덕션 빌드에는 값이 들어가지 않습니다.)

---

## 1) Vercel — 환경 변수 (Production)

1. 브라우저에서 [Vercel Dashboard](https://vercel.com/dashboard) 로그인.
2. **In-Bite** 프로젝트 선택 → 상단 **Settings** → 왼쪽 **Environment Variables**.
3. 아래 변수를 **하나씩** 추가하거나, 이미 있으면 값이 비어 있지 않은지 확인합니다.

| 변수 이름 | 값은 어디서? |
|-----------|----------------|
| `VITE_SUPABASE_URL` | [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → **Settings** → **API** → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | 같은 페이지의 **anon public** 키 (긴 `eyJ...` 문자열) |
| `VITE_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → 앱 선택 → **API Keys** → **Publishable key** (`pk_live_...` 또는 `pk_test_...`) |

4. 각 변수를 저장할 때 **Environment** 체크박스에서 **Production**이 반드시 켜져 있는지 확인하세요.  
   (Preview만 켜 두면 프로덕션 도메인 배포에는 적용되지 않습니다.)
5. 변수를 **추가·수정했다면** 반드시 **새 배포**가 필요합니다.  
   - **Deployments** 탭 → 최신 배포 옆 **⋯** → **Redeploy** (또는 빈 커밋 푸시).

**로컬에서 빠르게 확인:** 프로젝트 루트에 `.env`를 두고 `npm run check:env` — Vercel과는 무관하지만, 로컬에 필요한 키 이름을 알 수 있습니다.

---

## 2) Clerk — JWT 템플릿 `supabase`

앱은 `getToken({ template: "supabase" })` 로 Supabase에 넘길 JWT를 받습니다. **이름이 정확히 `supabase`인 템플릿**이 없으면 토큰이 `null`이 되고, 프로필 동기·RLS 통과 쿼리가 실패합니다.

1. [Clerk Dashboard](https://dashboard.clerk.com) → 사용 중인 **애플리케이션** 선택.
2. 왼쪽 **Configure** → **JWT Templates** (또는 **Sessions** 근처 메뉴, Clerk 버전에 따라 경로가 조금 다를 수 있음).
3. **New template** → 이름을 **`supabase`** 로 저장 (소문자, 하이픈 없음).
4. 템플릿 페이로드에서 **`sub` 클레임이 Clerk 사용자 ID**(`user_...` 형태)인지 확인합니다.  
   기본 템플릿이면 `sub`는 사용자 ID입니다. **이메일 등으로 `sub`를 바꾸면 Supabase RLS와 맞지 않습니다.**
5. **Production** 배포에 쓰는 Clerk 키가 **같은 앱**의 키인지 확인하세요.  
   - Vercel의 `VITE_CLERK_PUBLISHABLE_KEY`가 `pk_live_...` 이면, **Live** 인스턴스의 JWT 템플릿을 봐야 합니다.

자세한 설명은 저장소의 [AUTH_SUPABASE_SETUP.md](./AUTH_SUPABASE_SETUP.md) §4를 참고하세요.

---

## 3) Supabase — RLS SQL 실행 (초대 피드 등)

배포 DB에 **초대(`invites`)를 본인 것만 SELECT** 하는 정책만 있으면, 탐색 화면에서 **다른 사람 초대가 안 보입니다.**  
아래 파일을 Supabase **SQL Editor**에서 실행하세요.

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → **SQL Editor** → **New query**.
2. 저장소의 파일 **`supabase_rls_production_invites_feed.sql`** 내용을 전부 복사해 붙여넣기 → **Run**.

처음 스키마를 올릴 때는 다음 순서를 권장합니다 (이미 실행한 항목은 건너뛰어도 됩니다).

| 순서 | 파일 (저장소 루트) | 목적 |
|------|---------------------|------|
| 1 | `supabase_profiles.sql` | `profiles` 테이블 |
| 2 | `supabase_profiles_rls_fix.sql` | 프로필 RLS |
| 3 | `supabase_invites.sql` | `invites` 테이블 |
| 4 | **`supabase_rls_production_invites_feed.sql`** | 피드용 공개 SELECT + 본인 쓰기 |
| 5 | `supabase_daily_bites_feed.sql` 등 | 데일리 바이트 (이미 쓰는 경우) |
| 6 | `supabase_rls_inbite_profiles_daily_bites.sql` | 데일리 바이트·좋아요 RLS 묶음 |

---

## 4) 배포 후 브라우저에서 확인

1. Vercel 프로덕션 URL을 **시크릿 창**에서 열어 캐시·확장 프로그램 영향을 줄입니다.
2. **F12** → **Console**  
   - `[In-Bite] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing` 가 보이면 → **1번 Vercel 환경 변수**를 다시 확인하고 Redeploy.
3. **Network** 탭 → 필터에 `supabase` 입력 → 요청 선택 → **Status**  
   - **401**: JWT 없음/만료/Clerk–Supabase 연동 문제 → **2번 JWT 템플릿**과 Supabase **JWT Secret**(Clerk 연동 문서) 확인.  
   - **403 / Postgrest 에러에 RLS, policy, permission**: **3번 SQL** 미실행 또는 정책 불일치.

JWT 내용을 직접 보고 싶다면(고급): 로그인 후 콘솔에서 `await window.Clerk?.session?.getToken({ template: 'supabase' })` 는 보안상 권장되지 않을 수 있으므로, Clerk 대시보드의 JWT 템플릿 미리보기와 Supabase 로그를 우선 사용하세요.

---

## 5) 관련 문서

- [AUTH_SUPABASE_SETUP.md](./AUTH_SUPABASE_SETUP.md) — Clerk + Supabase 전체 체크리스트 (로컬 포함)
- [.env.example](./.env.example) — 필요한 변수 이름 목록

문제가 계속되면 **Console 전체 메시지**와 **실패한 요청의 URL·HTTP 상태 코드**를 알려주면 원인 좁히기에 도움이 됩니다.

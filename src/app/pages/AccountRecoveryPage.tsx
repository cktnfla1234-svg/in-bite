import { Link } from "react-router-dom";
import { BrandMark } from "@/app/components/ui/CookieLogo";

const KAKAO_ACCOUNT_CENTER = "https://accounts.kakao.com/weblogin/find_password?lang=ko_KR";
const NAVER_ID_PW_INQUIRY = "https://nid.naver.com/user2/help/idPwInquiry?lang=ko_KR";

export function AccountRecoveryPage() {
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-10">
      <div className="mx-auto max-w-md px-5">
        <BrandMark size={34} />

        <div className="mt-10">
          <h1
            className="text-[26px] font-semibold text-[#A0522D]"
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            회원정보 찾기
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-[#A0522D]/70">
            가입하신 방식을 선택해 주세요. In-Bite는 소셜 계정의 비밀번호를 보관하지 않습니다.
          </p>
        </div>

        <section className="mt-8 rounded-[22px] border border-[#EDD5C0] bg-white/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
          <h2 className="text-[15px] font-semibold text-[#A0522D]">카카오로 가입·로그인하신 경우</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#5C4033]">
            이메일·비밀번호 찾기는 카카오 계정 센터에서 진행해 주세요.
          </p>
          <a
            href={KAKAO_ACCOUNT_CENTER}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-[13px] font-semibold text-[#A0522D] underline underline-offset-2"
          >
            카카오 비밀번호·계정 찾기
          </a>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#EDD5C0] bg-white/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
          <h2 className="text-[15px] font-semibold text-[#A0522D]">네이버로 가입·로그인하신 경우</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#5C4033]">
            아이디·비밀번호 문의는 네이버 아이디 찾기 페이지를 이용해 주세요.
          </p>
          <a
            href={NAVER_ID_PW_INQUIRY}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-[13px] font-semibold text-[#A0522D] underline underline-offset-2"
          >
            네이버 아이디·비밀번호 찾기
          </a>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#EDD5C0] bg-white/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
          <h2 className="text-[15px] font-semibold text-[#A0522D]">이메일로 가입하신 경우</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#5C4033]">
            로그인 화면에서 이메일을 입력한 뒤, 표시되는{" "}
            <span className="font-semibold text-[#A0522D]">「비밀번호를 잊으셨나요?」</span> 링크로
            비밀번호 재설정 메일을 받을 수 있습니다.
          </p>
          {hasClerkKey ? (
            <Link
              to="/sign-in"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#A0522D] text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(160,82,45,0.28)]"
            >
              로그인 화면으로 이동
            </Link>
          ) : (
            <p className="mt-3 text-[12px] text-[#A0522D]/65">
              이메일 로그인을 쓰려면 환경 변수에 Clerk 키를 설정해 주세요.
            </p>
          )}
        </section>

        <div className="mt-10 flex flex-wrap justify-center gap-4 text-[13px]">
          <Link to="/sign-in" className="font-medium text-[#A0522D] underline-offset-2 hover:underline">
            로그인
          </Link>
          <span className="text-[#A0522D]/35">|</span>
          <Link to="/sign-up" className="font-medium text-[#A0522D] underline-offset-2 hover:underline">
            회원가입
          </Link>
          <span className="text-[#A0522D]/35">|</span>
          <Link to="/app" className="font-medium text-[#A0522D] underline-offset-2 hover:underline">
            둘러보기
          </Link>
        </div>
      </div>
    </main>
  );
}

import type { CSSProperties } from "react";

type CookieLogoProps = {
  size?: number;
  style?: CSSProperties;
};

export function CookieLogo({ size = 36, style }: CookieLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="#D4B896" />
      <circle cx="37.5" cy="10.5" r="4.2" fill="#FDFAF5" />
      <circle cx="42" cy="16.5" r="3.6" fill="#FDFAF5" />
      <circle cx="40" cy="24" r="3.8" fill="#FDFAF5" />
      <circle cx="15" cy="16" r="2" fill="#6B4423" />
      <circle cx="25" cy="14" r="2" fill="#6B4423" />
      <circle cx="13" cy="26" r="2" fill="#6B4423" />
      <circle cx="22" cy="23" r="2" fill="#6B4423" />
      <circle cx="28" cy="30" r="2" fill="#6B4423" />
      <circle cx="18" cy="33" r="2" fill="#6B4423" />
    </svg>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <CookieLogo size={size} />
      <div className="leading-none">
        <div
          className="font-semibold"
          style={{
            fontFamily: "'Patrick Hand', cursive",
            color: "#A0522D",
            fontSize: size * 0.58,
          }}
        >
          人-Bite
        </div>
        <div className="mt-1 text-[12px] text-[#A0522D]/90">
          An invitation into someone&apos;s daily life
        </div>
      </div>
    </div>
  );
}


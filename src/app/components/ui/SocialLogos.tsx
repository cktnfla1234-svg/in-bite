type SocialLogoProps = {
  className?: string;
};

export function KakaoLogo({ className }: SocialLogoProps) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FEE500] ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.5C7.31 4.5 3.5 7.51 3.5 11.25c0 2.42 1.62 4.55 4.06 5.75l-.83 2.79a.45.45 0 0 0 .68.5l3.13-2.08c.48.08.97.12 1.46.12 4.7 0 8.5-3.01 8.5-6.75S16.7 4.5 12 4.5Z"
          fill="#191600"
        />
      </svg>
    </span>
  );
}

export function NaverLogo({ className }: SocialLogoProps) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#03C75A] ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h3.1l3.8 5.45V2H13v12H9.9L6.1 8.55V14H3V2Z" fill="white" />
      </svg>
    </span>
  );
}

export function GoogleLogo({ className }: SocialLogoProps) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-[#E8E8E8] ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
  );
}

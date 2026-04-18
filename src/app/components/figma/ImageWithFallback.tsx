import type { ImgHTMLAttributes } from "react";

export function ImageWithFallback(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} />;
}

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

/**
 * Matches `.app-pad-bottom-tabbar` in `src/styles/theme.css` (BottomNav height + safe-area).
 * Use {@link AppShellTabbarPad} / {@link AppShellTabbarPadMotion} instead of typing this class.
 */
export const APP_SHELL_TABBAR_PAD_CLASS = "app-pad-bottom-tabbar" as const;

export function withAppShellTabbarPad(className?: string) {
  const extra = className?.trim();
  if (!extra) return APP_SHELL_TABBAR_PAD_CLASS;
  return `${APP_SHELL_TABBAR_PAD_CLASS} ${extra}`.replace(/\s+/g, " ").trim();
}

/** Plain `div` with tab-bar + safe-area bottom padding (for fixed overlays, full-screen editors, etc.). */
export const AppShellTabbarPad = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => <div ref={ref} className={withAppShellTabbarPad(className)} {...props} />,
);
AppShellTabbarPad.displayName = "AppShellTabbarPad";

/** `motion.div` with the same padding — use for bottom sheets and animated overlays inside AppShell. */
export const AppShellTabbarPadMotion = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, ...props }, ref) => <motion.div ref={ref} className={withAppShellTabbarPad(className)} {...props} />,
);
AppShellTabbarPadMotion.displayName = "AppShellTabbarPadMotion";

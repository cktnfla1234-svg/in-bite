import { WELCOME_BITE_GRANT } from "./bitePolicy";

const LEGACY_BALANCE_KEY = "inbite:wallet-balance";
const WELCOME_GRANTED_KEY = "inbite:welcome-reward-granted";

export const WALLET_BALANCE_SYNC = "inbite-wallet-balance-sync";

function welcomeRewardKeyForUser(clerkUserId: string) {
  return `inbite:welcome-reward-granted:${clerkUserId}`;
}

function balanceKeyForUser(clerkUserId: string) {
  return `inbite:wallet-balance:${clerkUserId}`;
}

export function roundBiteDisplay(n: number) {
  return Math.round(n * 100) / 100;
}

export function formatLedgerDateLabel(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function emitBalanceSync(clerkUserId: string | null | undefined) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_BALANCE_SYNC, { detail: { clerkUserId: clerkUserId ?? null } }));
}

export function setWelcomeGrantedFlag(clerkUserId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(welcomeRewardKeyForUser(clerkUserId.trim()), "true");
}

export function getWalletBalance(clerkUserId?: string | null) {
  if (typeof window === "undefined") return 0;
  const uid = clerkUserId?.trim();
  if (uid) {
    const direct = window.localStorage.getItem(balanceKeyForUser(uid));
    if (direct != null) {
      const n = Number(direct);
      return Number.isFinite(n) ? roundBiteDisplay(Math.max(0, n)) : 0;
    }
    const legacy = window.localStorage.getItem(LEGACY_BALANCE_KEY);
    if (legacy != null) {
      const n = Number(legacy);
      const v = Number.isFinite(n) ? roundBiteDisplay(Math.max(0, n)) : 0;
      window.localStorage.setItem(balanceKeyForUser(uid), String(v));
      window.localStorage.removeItem(LEGACY_BALANCE_KEY);
      return v;
    }
    return 0;
  }
  const raw = window.localStorage.getItem(LEGACY_BALANCE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? roundBiteDisplay(Math.max(0, n)) : 0;
}

export function setWalletBalance(next: number, clerkUserId?: string | null) {
  if (typeof window === "undefined") return;
  const v = roundBiteDisplay(Math.max(0, next));
  const uid = clerkUserId?.trim();
  if (uid) {
    window.localStorage.setItem(balanceKeyForUser(uid), String(v));
  } else {
    window.localStorage.setItem(LEGACY_BALANCE_KEY, String(v));
  }
  emitBalanceSync(uid ?? null);
}

export function hasWelcomeRewardBeenGranted(clerkUserId?: string | null) {
  if (typeof window === "undefined") return false;
  const uid = clerkUserId?.trim();
  if (uid) {
    return window.localStorage.getItem(welcomeRewardKeyForUser(uid)) === "true";
  }
  return window.localStorage.getItem(WELCOME_GRANTED_KEY) === "true";
}

export function grantWelcomeReward(amount = WELCOME_BITE_GRANT, clerkUserId?: string | null) {
  if (typeof window === "undefined") return { granted: false, balance: 0 };
  if (hasWelcomeRewardBeenGranted(clerkUserId)) {
    return { granted: false, balance: getWalletBalance(clerkUserId) };
  }

  const uid = clerkUserId?.trim();
  if (uid) {
    window.dispatchEvent(
      new CustomEvent("inbite-apply-bite", {
        detail: { clerkId: uid, delta: amount, kind: "welcome_bonus" },
      }),
    );
    return { granted: true, balance: getWalletBalance(uid) };
  }

  const balance = getWalletBalance(null) + amount;
  setWalletBalance(balance, null);
  window.localStorage.setItem(WELCOME_GRANTED_KEY, "true");
  return { granted: true, balance };
}

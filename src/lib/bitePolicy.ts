/**
 * In-Bite BITE = platform activity energy (utility points). Not peer-to-peer cash.
 * @see supabase_bites_economy.sql
 */

export const WELCOME_BITE_GRANT = 5;

/** Cost to publish one invite (−1.0 BITE; discourages spam, encourages quality). */
export const BITE_COST_CREATE_INVITE = 1.0;

/** First greeting to a host is free. */
export const BITE_COST_SAY_HI = 0;

/** Reward for sharing a Daily Bite (local story). Once per local calendar day (enforced in UI + optional server meta). */
export const BITE_REWARD_DAILY_BITE = 0.2;

/** Reward for a comment on a post (once per post per user). */
export const BITE_REWARD_COMMENT = 0.1;

/** Platform revenue: one bundle price in KRW (payment integration TBD). */
export const BITE_BUNDLE_PRICE_KRW = 5000;

/** BITE granted per completed ₩5,000 bundle purchase (demo / policy default). */
export const BITE_BUNDLE_AMOUNT = 1;

export type BiteHistoryKind =
  | "welcome_bonus"
  | "create_invite"
  | "say_hi"
  | "daily_bite"
  | "comment"
  | "purchase_bundle"
  | "adjustment";

import { createClient } from "@supabase/supabase-js";

type TablePlan = {
  label: string;
  candidates: string[];
};

const DELETE_PLAN: TablePlan[] = [
  { label: "likes", candidates: ["likes", "post_likes"] },
  { label: "notifications", candidates: ["notifications"] },
  { label: "payments", candidates: ["payments"] },
  { label: "messages", candidates: ["messages"] },
  { label: "daily_bites", candidates: ["daily_bites"] },
  { label: "invites", candidates: ["invites"] },
];

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolveSupabaseUrl(): string {
  const url = getEnv("SUPABASE_URL") ?? getEnv("VITE_SUPABASE_URL");
  if (!url) throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL).");
  return url;
}

function resolveServiceRoleKey(): string {
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

function isMissingTableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "42P01";
}

async function deleteAllRowsByCreatedAt(
  supabase: ReturnType<typeof createClient>,
  table: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().gte("created_at", "1970-01-01T00:00:00.000Z");
  if (error) throw error;
}

async function cleanup() {
  if (getEnv("CLEANUP_CONFIRM") !== "YES") {
    throw new Error('Safety check failed: set CLEANUP_CONFIRM=YES to run destructive cleanup.');
  }

  const supabase = createClient(resolveSupabaseUrl(), resolveServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Starting cleanup...");
  for (const step of DELETE_PLAN) {
    let handled = false;
    for (const table of step.candidates) {
      try {
        await deleteAllRowsByCreatedAt(supabase, table);
        console.log(`- Cleared ${table}`);
        handled = true;
        break;
      } catch (error) {
        if (isMissingTableError(error)) continue;
        throw error;
      }
    }
    if (!handled) {
      console.log(`- Skipped ${step.label} (table not found)`);
    }
  }
  console.log("Cleanup complete.");
}

cleanup().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
});

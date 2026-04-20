import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";
export type NotificationType = "like" | "comment" | "reply" | "comment_like";

export type AppNotification = {
  id: string;
  type: NotificationType;
  actor_id: string;
  target_id: string;
  content: string;
  post_id?: string | null;
  comment_id?: string | null;
  read: boolean;
  created_at: string;
};
export type NotificationRealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

const NOTIFY_EVENT = "inbite-notifications-changed";

function storageKey(clerkId: string) {
  return `inbite:notifications:v1:${clerkId}`;
}

function readLocal(clerkId: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(clerkId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(clerkId: string, items: AppNotification[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(clerkId), JSON.stringify(items));
  window.dispatchEvent(new Event(NOTIFY_EVENT));
}

export function listNotifications(clerkId: string): AppNotification[] {
  return readLocal(clerkId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function hasUnreadNotifications(clerkId: string): boolean {
  return readLocal(clerkId).some((n) => !n.read);
}

export function unreadNotificationCount(clerkId: string): number {
  return readLocal(clerkId).reduce((acc, item) => acc + (item.read ? 0 : 1), 0);
}

export function markAllNotificationsRead(clerkId: string) {
  const next = readLocal(clerkId).map((n) => ({ ...n, read: true }));
  writeLocal(clerkId, next);
}

export function markNotificationRead(clerkId: string, notificationId: string) {
  const next = readLocal(clerkId).map((n) => (n.id === notificationId ? { ...n, read: true } : n));
  writeLocal(clerkId, next);
}

export async function markNotificationReadRemote(token: string, notificationId: string) {
  try {
    const supabase = getSupabaseClient(token);
    if (!supabase) return;
    await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
  } catch {
    // Row may exist only locally (demo id) or table missing.
  }
}

export function appendNotification(clerkId: string, n: Omit<AppNotification, "id" | "read" | "created_at">) {
  const row: AppNotification = {
    ...n,
    id: crypto.randomUUID(),
    read: false,
    created_at: new Date().toISOString(),
  };
  const next = [row, ...readLocal(clerkId)];
  writeLocal(clerkId, next);
  return row;
}

export function subscribeNotificationChanges(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFY_EVENT, handler);
  return () => window.removeEventListener(NOTIFY_EVENT, handler);
}

export function removeDemoNotifications(clerkId: string) {
  const next = readLocal(clerkId).filter(
    (item) => !item.actor_id.startsWith("demo:") && !(item.comment_id ?? "").startsWith("demo-"),
  );
  writeLocal(clerkId, next);
}

export async function insertNotificationRemote(token: string, row: Omit<AppNotification, "id" | "read" | "created_at">) {
  try {
    const supabase = getSupabaseClient(token);
    if (!supabase) return;
    await supabase.from("notifications").insert({
      type: row.type,
      actor_id: row.actor_id,
      target_id: row.target_id,
      content: row.content,
      post_id: row.post_id ?? null,
      comment_id: row.comment_id ?? null,
      read: false,
    });
  } catch {
    // Table may not exist yet in dev — local feed still works.
  }
}

export async function mergeRemoteNotifications(clerkId: string, token: string) {
  try {
    const supabase = getSupabaseClient(token);
    if (!supabase) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, actor_id, target_id, content, post_id, comment_id, read, created_at")
      .eq("target_id", clerkId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error || !data?.length) return;
    const local = readLocal(clerkId);
    const byKey = new Map(local.map((n) => [n.id, n]));
    for (const r of data as AppNotification[]) {
      if (!byKey.has(r.id)) byKey.set(r.id, r);
    }
    writeLocal(clerkId, Array.from(byKey.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  } catch {
    // ignore
  }
}

function mapDbRowToNotification(raw: Record<string, unknown>): AppNotification | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  return {
    id,
    type: raw.type as NotificationType,
    actor_id: String(raw.actor_id ?? ""),
    target_id: String(raw.target_id ?? ""),
    content: String(raw.content ?? ""),
    post_id: raw.post_id != null ? String(raw.post_id) : null,
    comment_id: raw.comment_id != null ? String(raw.comment_id) : null,
    read: Boolean(raw.read),
    created_at: raw.created_at != null ? String(raw.created_at) : new Date().toISOString(),
  };
}

export function upsertLocalNotification(clerkId: string, row: AppNotification) {
  const cur = readLocal(clerkId);
  const idx = cur.findIndex((n) => n.id === row.id);
  const next = idx >= 0 ? cur.map((n, i) => (i === idx ? { ...n, ...row } : n)) : [row, ...cur];
  writeLocal(clerkId, next.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export function removeLocalNotification(clerkId: string, id: string) {
  writeLocal(
    clerkId,
    readLocal(clerkId).filter((n) => n.id !== id),
  );
}

/** Supabase Realtime: merge INSERT/UPDATE/DELETE into local inbox for `target_id`. */
export function subscribeNotificationsRealtime(
  clerkId: string,
  token: string,
  onChange: () => void,
  onRealtimeEvent?: (eventType: NotificationRealtimeEvent, notification: AppNotification | null) => void,
): () => void {
  const supabase = getSupabaseClient(token);
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`notifications-realtime:${clerkId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `target_id=eq.${clerkId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const row = mapDbRowToNotification(payload.new);
          if (row && row.target_id === clerkId) {
            upsertLocalNotification(clerkId, row);
            onRealtimeEvent?.(payload.eventType, row);
          }
        } else if (payload.eventType === "DELETE") {
          const old = payload.old;
          const id = old && typeof old === "object" && "id" in old ? String((old as { id: unknown }).id) : "";
          if (id) removeLocalNotification(clerkId, id);
          onRealtimeEvent?.("DELETE", null);
        }
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

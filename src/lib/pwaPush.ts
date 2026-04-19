import { getSupabaseClient } from "./supabase";

function base64UrlToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribeWebPush(token: string, clerkId: string): Promise<PushSubscriptionJSON | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const vapidKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  if (!vapidKey) return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidKey),
    });
  }
  const json = subscription.toJSON();

  const supabase = getSupabaseClient(token);
  if (!supabase || !clerkId.trim()) return json;

  await supabase
    .from("profiles")
    .update({
      push_subscription: json,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_id", clerkId);

  return json;
}

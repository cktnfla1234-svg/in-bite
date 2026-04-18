self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "In-Bite";
  const body = payload.body || "새 알림이 도착했어요.";
  const data = payload.data || {};
  const icon = payload.icon || "/favicon.svg";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      data,
      tag: data.tag || `inbite-${Date.now()}`,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const chatId = data.chatId || data.roomId || null;
  const postId = data.postId || null;
  const url = data.url || (chatId ? `/chat/${encodeURIComponent(chatId)}` : postId ? `/app?openPost=${encodeURIComponent(postId)}` : "/app");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        const client = clients[0];
        client.focus();
        if (chatId) {
          client.postMessage({ type: "OPEN_CHAT", chatId });
        } else if (postId) {
          client.postMessage({ type: "OPEN_POST", postId });
        } else if (url) {
          client.postMessage({ type: "OPEN_URL", url });
        }
        return;
      }
      return self.clients.openWindow(url);
    }),
  );
});

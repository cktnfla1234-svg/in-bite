import { getSupabaseClient } from "./supabase";

export type ChatRoomType = "direct" | "group";

export type ChatRoomRecord = {
  id: string;
  title: string;
  type: ChatRoomType;
  participantIds: string[];
  createdAt: string;
  lastMessage: string;
  lastMessageAt: string;
};

export type ChatMessageRecord = {
  id: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  kind?: "icebreaker" | "text" | "payment_request" | "companion_invite" | "bite_gift" | "system";
};

const ROOMS_KEY = "inbite:chat:rooms:v1";
const MESSAGES_KEY = "inbite:chat:messages:v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function directRoomId(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `direct:${x}__${y}`;
}

function createId(prefix: string) {
  return `${prefix}:${Math.random().toString(36).slice(2, 10)}:${Date.now()}`;
}

export function listChatRooms(): ChatRoomRecord[] {
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  return [...rooms].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function listRoomMessages(roomId: string): ChatMessageRecord[] {
  const all = readJson<ChatMessageRecord[]>(MESSAGES_KEY, []);
  return all.filter((m) => m.roomId === roomId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function saveRooms(next: ChatRoomRecord[]) {
  writeJson(ROOMS_KEY, next);
}

function saveMessages(next: ChatMessageRecord[]) {
  writeJson(MESSAGES_KEY, next);
}

function upsertRoom(room: ChatRoomRecord) {
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  const idx = rooms.findIndex((r) => r.id === room.id);
  if (idx >= 0) rooms[idx] = room;
  else rooms.unshift(room);
  saveRooms(rooms);
}

function appendMessage(msg: ChatMessageRecord) {
  const all = readJson<ChatMessageRecord[]>(MESSAGES_KEY, []);
  all.push(msg);
  saveMessages(all);
}

export function sendChatMessage(input: Omit<ChatMessageRecord, "id" | "createdAt">) {
  const msg: ChatMessageRecord = {
    ...input,
    id: createId("msg"),
    createdAt: nowIso(),
  };
  appendMessage(msg);
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  const idx = rooms.findIndex((r) => r.id === input.roomId);
  if (idx >= 0) {
    rooms[idx] = {
      ...rooms[idx],
      lastMessage: input.content,
      lastMessageAt: msg.createdAt,
    };
    saveRooms(rooms);
  }
  return msg;
}

type StartSayHiArgs = {
  meId: string;
  meName: string;
  hostId: string;
  hostName: string;
  locale?: string | null;
  accessToken?: string | null;
};

function localizedGreeting(meName: string, locale?: string | null) {
  const lang = (locale ?? "").toLowerCase();
  if (lang.startsWith("ko")) {
    return `👋 반가워요! ${meName}님이 인사를 건넸습니다.`;
  }
  return `👋 Hi there! '${meName}' sent a wave.`;
}

async function syncSupabaseRoomAndMessage(args: {
  roomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  accessToken: string;
}) {
  const supabase = getSupabaseClient(args.accessToken);
  if (!supabase) return;
  const iso = nowIso();
  const participant_clerk_ids = [args.senderId, args.receiverId].filter(Boolean);
  const { error: roomErr } = await supabase.from("chat_rooms").upsert(
    {
      id: args.roomId,
      created_at: iso,
      updated_at: iso,
      participant_clerk_ids,
    },
    { onConflict: "id" },
  );
  if (roomErr) {
    const { error: legacyErr } = await supabase.from("chat_rooms").upsert(
      { id: args.roomId, created_at: iso, updated_at: iso },
      { onConflict: "id" },
    );
    if (legacyErr) {
      console.warn("[chat] chat_rooms upsert", roomErr, legacyErr);
      return;
    }
  }
  const { error: msgErr } = await supabase.from("messages").insert({
    room_id: args.roomId,
    sender_id: args.senderId,
    receiver_id: args.receiverId,
    content: args.content,
    created_at: iso,
  });
  if (msgErr) console.warn("[chat] messages insert", msgErr);
}

export async function startSayHiChat({
  meId,
  meName,
  hostId,
  hostName,
  locale,
  accessToken,
}: StartSayHiArgs): Promise<{ roomId: string; autoSent: boolean }> {
  const roomId = directRoomId(meId, hostId);
  const iso = nowIso();
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  const existing = rooms.find((r) => r.id === roomId);
  if (!existing) {
    upsertRoom({
      id: roomId,
      title: hostName,
      type: "direct",
      participantIds: [meId, hostId],
      createdAt: iso,
      lastMessage: "Say hi to start this conversation.",
      lastMessageAt: iso,
    });
  }

  const messages = listRoomMessages(roomId);
  if (messages.length > 0) {
    return { roomId, autoSent: false };
  }

  const content = localizedGreeting(meName, locale);
  sendChatMessage({
    roomId,
    senderId: meId,
    receiverId: hostId,
    content,
    kind: "icebreaker",
  });

  if (accessToken) {
    await syncSupabaseRoomAndMessage({
      roomId,
      senderId: meId,
      receiverId: hostId,
      content,
      accessToken,
    });
  }

  return { roomId, autoSent: true };
}

function isSyntheticParticipantId(userId: string) {
  if (userId === "guest") return true;
  if (userId.startsWith("daily-author:")) return true;
  if (userId.startsWith("demo:")) return true;
  /** `host:user_…` was a mistaken legacy shape for a real Clerk user — keep those rooms. */
  if (userId.startsWith("host:user_")) return false;
  if (userId.startsWith("host:")) return true;
  return false;
}

export function removeSyntheticChatRooms() {
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  const keptRooms = rooms.filter((room) => !room.participantIds.some((id) => isSyntheticParticipantId(id)));
  const keptRoomIds = new Set(keptRooms.map((room) => room.id));
  const messages = readJson<ChatMessageRecord[]>(MESSAGES_KEY, []);
  const keptMessages = messages.filter((message) => keptRoomIds.has(message.roomId));
  saveRooms(keptRooms);
  saveMessages(keptMessages);
}

export function isGroupRoomId(roomId: string) {
  return roomId.trim().startsWith("group:");
}

/** Parses `direct:userA__userB` into sorted pair (order matches storage). */
export function parseDirectRoomPeers(roomId: string): [string, string] | null {
  if (!roomId.startsWith("direct:")) return null;
  const rest = roomId.slice("direct:".length);
  const parts = rest.split("__");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export function createGroupChatRoom(hostClerkId: string, title: string): string {
  const roomId = `group:${crypto.randomUUID()}`;
  const iso = nowIso();
  upsertRoom({
    id: roomId,
    title: title.trim() || "Group chat",
    type: "group",
    participantIds: [hostClerkId],
    createdAt: iso,
    lastMessage: "",
    lastMessageAt: iso,
  });
  return roomId;
}

export function createGroupChatWithMembers(participantIds: string[], title: string): string {
  const unique = [...new Set(participantIds.filter(Boolean))];
  const roomId = `group:${crypto.randomUUID()}`;
  const iso = nowIso();
  upsertRoom({
    id: roomId,
    title: title.trim() || "Group chat",
    type: "group",
    participantIds: unique.length ? unique : ["guest"],
    createdAt: iso,
    lastMessage: "",
    lastMessageAt: iso,
  });
  return roomId;
}

export function mergeParticipantsIntoLocalGroupRoom(roomId: string, participantIds: string[]) {
  if (!isGroupRoomId(roomId)) return;
  const rooms = readJson<ChatRoomRecord[]>(ROOMS_KEY, []);
  const idx = rooms.findIndex((r) => r.id === roomId);
  const merged = [...new Set(participantIds.filter(Boolean))];
  if (idx < 0) {
    const iso = nowIso();
    upsertRoom({
      id: roomId,
      title: "Group chat",
      type: "group",
      participantIds: merged,
      createdAt: iso,
      lastMessage: "",
      lastMessageAt: iso,
    });
    return;
  }
  const prev = rooms[idx]!;
  if (prev.type !== "group") return;
  const nextIds = [...new Set([...prev.participantIds, ...merged])];
  rooms[idx] = { ...prev, participantIds: nextIds };
  saveRooms(rooms);
}

export async function syncGroupChatRoomToSupabase(roomId: string, participantIds: string[], accessToken: string) {
  if (!isGroupRoomId(roomId)) return;
  const supabase = getSupabaseClient(accessToken);
  if (!supabase) return;
  const iso = nowIso();
  const { error: roomErr } = await supabase.from("chat_rooms").upsert(
    {
      id: roomId,
      created_at: iso,
      updated_at: iso,
      participant_clerk_ids: participantIds,
    },
    { onConflict: "id" },
  );
  if (roomErr) {
    const { error: legacyErr } = await supabase.from("chat_rooms").upsert(
      { id: roomId, created_at: iso, updated_at: iso },
      { onConflict: "id" },
    );
    if (legacyErr) console.warn("[chat] group chat_rooms upsert", roomErr, legacyErr);
  }
}

export async function joinGroupChatRoomRemote(
  roomId: string,
  accessToken: string,
): Promise<string[] | null> {
  if (!isGroupRoomId(roomId)) return null;
  const supabase = getSupabaseClient(accessToken);
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("join_group_chat_room", { p_room_id: roomId });
  if (error) {
    console.warn("[chat] join_group_chat_room", error);
    return null;
  }
  if (data == null || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).participant_clerk_ids;
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function fetchGroupChatParticipantsRemote(
  roomId: string,
  accessToken: string,
): Promise<string[] | null> {
  if (!isGroupRoomId(roomId)) return null;
  const supabase = getSupabaseClient(accessToken);
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("participant_clerk_ids")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { participant_clerk_ids?: unknown }).participant_clerk_ids;
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function syncChatMessageToSupabase(args: {
  roomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  accessToken: string;
}) {
  const supabase = getSupabaseClient(args.accessToken);
  if (!supabase) return;
  const iso = nowIso();
  const { error: msgErr } = await supabase.from("messages").insert({
    room_id: args.roomId,
    sender_id: args.senderId,
    receiver_id: args.receiverId,
    content: args.content,
    created_at: iso,
  });
  if (msgErr) console.warn("[chat] messages insert", msgErr);
}


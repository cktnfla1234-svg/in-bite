import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { CookieLogo } from "./ui/CookieLogo";

export type ChatListItem = {
  id: string;
  title: string;
  type: "direct" | "group";
  lastMessage: string;
  timeLabel: string;
  profileName?: string;
  profileUserId?: string;
  /** Resolved from profile cache / Supabase for direct chats. */
  profileImageUrl?: string | null;
  unreadCount?: number;
  participants?: string[];
};

type ChatListScreenProps = {
  items: ChatListItem[];
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenProfile?: (user: { userId: string; name: string }) => void;
};

const SWIPE_DELETE_WIDTH = 92;
const SWIPE_OPEN_THRESHOLD = 48;

function GroupAvatarStack() {
  return (
    <div className="relative h-12 w-12">
      <div className="absolute left-0 top-1 h-8 w-8 rounded-full border-2 border-white/80 bg-[#EFDCC7] shadow-sm" />
      <div className="absolute right-0 top-1 h-8 w-8 rounded-full border-2 border-white/80 bg-[#DDB893] shadow-sm" />
      <div className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-white/85 bg-[#C89B6E] shadow-sm" />
    </div>
  );
}

type SwipeRowProps = {
  chat: ChatListItem;
  isSwipeOpen: boolean;
  onOpenSwipe: (chatId: string | null) => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenProfile?: (user: { userId: string; name: string }) => void;
};

function SwipeChatRow({
  chat: c,
  isSwipeOpen,
  onOpenSwipe,
  onSelectChat,
  onDeleteChat,
  onOpenProfile,
}: SwipeRowProps) {
  const draggingRef = useRef(false);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-[92px] items-center justify-center rounded-2xl bg-[#D35244] text-[13px] font-semibold text-white"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteChat(c.id);
          onOpenSwipe(null);
        }}
        aria-label="Delete chat"
      >
        Delete
      </button>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -SWIPE_DELETE_WIDTH, right: 0 }}
        dragElastic={0.05}
        animate={{ x: isSwipeOpen ? -SWIPE_DELETE_WIDTH : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 42 }}
        onDragStart={() => {
          draggingRef.current = true;
        }}
        onDragEnd={(_, info) => {
          draggingRef.current = false;
          if (info.offset.x < -SWIPE_OPEN_THRESHOLD) {
            onOpenSwipe(c.id);
            return;
          }
          onOpenSwipe(null);
        }}
        onClick={() => {
          if (draggingRef.current) return;
          if (isSwipeOpen) {
            onOpenSwipe(null);
            return;
          }
          onSelectChat(c.id);
        }}
        className="w-full cursor-pointer rounded-2xl bg-white/65 px-4 py-4 text-left shadow-[0_18px_55px_rgba(0,0,0,0.05)]"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isSwipeOpen) {
              onOpenSwipe(null);
              return;
            }
            onSelectChat(c.id);
          }
        }}
      >
        <div className="flex items-start gap-3">
          {c.type === "group" ? (
            <GroupAvatarStack />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!c.profileUserId || !c.profileName) return;
                onOpenProfile?.({ userId: c.profileUserId, name: c.profileName });
              }}
              className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/70 bg-[#E7D7C7]"
              aria-label={c.profileName ? `View ${c.profileName} profile` : "View profile"}
            >
              {c.profileImageUrl ? (
                <img src={c.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CookieLogo size={22} />
                </div>
              )}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c.profileUserId || !c.profileName) return;
                  onOpenProfile?.({ userId: c.profileUserId, name: c.profileName });
                }}
                className="truncate text-[14px] font-semibold text-[#A0522D] hover:underline"
              >
                {c.title}
              </button>
              <div className="shrink-0 text-[12px] text-[#A0522D]/60">
                {c.timeLabel}
              </div>
            </div>
            <div className="mt-1 line-clamp-2 text-[13px] text-[#A0522D]">
              {c.lastMessage}
            </div>
            {c.type === "group" && c.participants?.length ? (
              <div className="mt-1 text-[11px] text-[#A0522D]/60">
                {c.participants.length} people in this Bite room
              </div>
            ) : null}
          </div>

          {c.unreadCount ? (
            <div className="flex shrink-0 items-center">
              <div className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#A0522D] px-2 text-[12px] font-semibold text-white">
                {c.unreadCount}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

export function ChatListScreen({ items, onSelectChat, onDeleteChat, onOpenProfile }: ChatListScreenProps) {
  const [swipeOpenChatId, setSwipeOpenChatId] = useState<string | null>(null);

  return (
    <div className="min-h-full w-full bg-[#FDFAF5] pb-24 pt-6">
      <div className="px-5">
        <div className="text-[22px] font-semibold text-[#A0522D]">Messages</div>
        <div className="mt-1 text-[12px] text-[#A0522D]/60">
          Connect with hosts and travelers
        </div>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5D8CC] bg-white/70 px-4 py-8 text-center">
              <div className="text-[14px] font-semibold text-[#A0522D]">
                No chats yet
              </div>
              <div className="mt-2 text-[12px] text-[#A0522D]/65">
                When you send a first message, your chat list will appear here.
              </div>
            </div>
          ) : (
            items.map((c) => (
              <SwipeChatRow
                key={c.id}
                chat={c}
                isSwipeOpen={swipeOpenChatId === c.id}
                onOpenSwipe={setSwipeOpenChatId}
                onSelectChat={onSelectChat}
                onDeleteChat={onDeleteChat}
                onOpenProfile={onOpenProfile}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

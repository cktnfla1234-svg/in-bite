import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Gift, Handshake, Link2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessageRecord } from "@/lib/chat";
import { getProfileAvatar } from "@/lib/profileAvatarStore";
import { BITE_BUNDLE_PRICE_KRW } from "@/lib/bitePolicy";
import { formatFiat, type CurrencyCode } from "@/lib/currency";
import { ChatPaymentSheet } from "./ChatPaymentSheet";

type ChatRoomScreenProps = {
  chatId: string;
  title: string;
  type: "direct" | "group";
  myUserId: string;
  messages: ChatMessageRecord[];
  onSendMessage: (chatId: string, text: string) => void;
  onSendActionMessage?: (
    chatId: string,
    kind: "payment_request" | "companion_invite" | "bite_gift" | "system",
    content: string,
  ) => void;
  participants?: string[];
  onInviteCompanion?: (options?: { note?: string }) => void;
  /** Copy `/chat/:id` link (group trip or current room). */
  onCopyChatInviteLink?: () => void | Promise<void>;
  /** From a 1:1 room, create a group room with the same two people and go there (then share link). */
  onStartGroupTripChat?: () => void | Promise<void>;
  onCreatePaymentIntent?: (input: { amount: number; currency: CurrencyCode }) => Promise<{ clientSecret: string }>;
  onBack: () => void;
  /** Direct chat: the other participant’s Clerk id (for profile preview). */
  directPeerClerkId?: string;
  directPeerName?: string;
  onOpenDirectPeerProfile?: () => void;
};

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ChatRoomScreen({
  chatId,
  title,
  type,
  myUserId,
  messages,
  onSendMessage,
  onSendActionMessage,
  participants = [],
  onInviteCompanion,
  onCopyChatInviteLink,
  onStartGroupTripChat,
  onCreatePaymentIntent,
  onBack,
  directPeerClerkId,
  directPeerName,
  onOpenDirectPeerProfile,
}: ChatRoomScreenProps) {
  const { t, i18n } = useTranslation("common");
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState(1);
  const [giftNote, setGiftNote] = useState("");
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(5000);
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>("KRW");
  const [paymentSecret, setPaymentSecret] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [inviteAcceptedIds, setInviteAcceptedIds] = useState<Record<string, boolean>>({});

  const amountLabel = useMemo(() => {
    const lang = i18n.language || "en";
    const locale = lang.startsWith("ko") ? "ko-KR" : lang.startsWith("de") ? "de-DE" : "en-US";
    return BITE_BUNDLE_PRICE_KRW.toLocaleString(locale);
  }, [i18n.language]);

  const handleSend = () => {
    if (!draft.trim()) return;
    onSendMessage(chatId, draft.trim());
    setDraft("");
  };

  const formatSeparator = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    if (sameLocalDay(date, now)) return t("chat.today");
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    if (sameLocalDay(date, y)) return t("chat.yesterday");
    const lang = i18n.language || "en";
    const locale = lang.startsWith("ko") ? "ko-KR" : lang.startsWith("de") ? "de-DE" : "en-US";
    return date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
  };

  const rows: Array<{ type: "separator"; label: string } | { type: "message"; message: ChatMessageRecord }> = [];
  let lastDayKey = "";
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDayKey) {
      rows.push({ type: "separator", label: formatSeparator(m.createdAt) });
      lastDayKey = dayKey;
    }
    rows.push({ type: "message", message: m });
  }

  const sendDisabled = !draft.trim();
  const paymentOptions: CurrencyCode[] = ["KRW", "AUD", "EUR"];
  const paymentAmountLabel = formatFiat(paymentAmount, paymentCurrency, i18n.language);

  const parseInviteContent = (content: string) => {
    const parts = content.split("\n\n");
    const headline = (parts[0] ?? content).trim();
    const note = parts.slice(1).join("\n\n").trim();
    return { headline, note };
  };

  return (
    <div className="min-h-full w-full bg-[#FDFAF5] pb-24 pt-6">
      <div className="px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-3 text-[14px] font-semibold text-[#A0522D]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18 9 12l6-6" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
      </div>

      <div className="mt-5 px-5 pb-36">
        <div className="space-y-4">
          {rows.map((row, idx) => {
            if (row.type === "separator") {
              return (
                <div key={`sep-${idx}`} className="flex justify-center py-1">
                  <div className="rounded-full border border-[#EADCCF] bg-[#F6EFE6] px-3 py-1 text-[11px] text-[#8E725D]">
                    {row.label}
                  </div>
                </div>
              );
            }
            const m = row.message;
            const isMe = m.senderId === myUserId;
            let prevPeerMsg: ChatMessageRecord | null = null;
            for (let j = idx - 1; j >= 0; j--) {
              const rj = rows[j];
              if (rj.type === "separator") break;
              if (rj.type === "message") {
                prevPeerMsg = rj.message;
                break;
              }
            }
            const showPeerHeader =
              type === "direct" &&
              !isMe &&
              Boolean(directPeerClerkId && onOpenDirectPeerProfile && directPeerName) &&
              m.senderId === directPeerClerkId &&
              (!prevPeerMsg || prevPeerMsg.senderId !== m.senderId);
            const peerAvatar = directPeerClerkId ? getProfileAvatar(directPeerClerkId) : undefined;
            const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const isIce = m.kind === "icebreaker";
            const isInviteCard = m.kind === "companion_invite";
            const isPaymentCard = m.kind === "payment_request";
            const isGiftCard = m.kind === "bite_gift";
            const inviteParts = isInviteCard ? parseInviteContent(m.content) : null;

            return (
              <div key={m.id} className={isMe ? "flex justify-end" : "flex justify-start"}>
                <div className={isMe ? "max-w-[80%]" : "max-w-[85%]"}>
                  <div className="mb-2 text-center text-[11px] text-[#A0522D]/60">{time}</div>
                  {showPeerHeader ? (
                    <button
                      type="button"
                      onClick={() => onOpenDirectPeerProfile?.()}
                      className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-[#EDD5C0] bg-white/80 px-2 py-1.5 text-left text-[12px] font-semibold text-[#A0522D] shadow-sm transition hover:bg-[#A0522D]/5"
                    >
                      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[#EDD5C0] bg-[#F0E4D8]">
                        {peerAvatar ? (
                          <img src={peerAvatar} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 truncate">{directPeerName}</span>
                    </button>
                  ) : null}
                  <motion.div
                    initial={isIce ? { scale: 0.9, y: 6 } : undefined}
                    animate={isIce ? { scale: [0.95, 1.04, 1], y: [6, -2, 0] } : undefined}
                    transition={isIce ? { duration: 0.42, ease: "easeOut" } : undefined}
                    className={
                      isIce
                        ? "rounded-[18px] border border-dashed border-[#C88467] bg-[#FFF3EB] px-4 py-3 text-[13px] leading-5 text-[#8F4A2D]"
                        : isInviteCard
                          ? "companion-invite-card rounded-[18px] border border-[#DDBFA8] bg-[#FFF8F1] px-4 py-3 text-[13px] leading-5 text-[#8F4A2D]"
                          : isPaymentCard
                            ? "rounded-[18px] border border-[#D7C2AE] bg-[#FFFCF7] px-4 py-3 text-[13px] leading-5 text-[#8F4A2D]"
                            : isGiftCard
                              ? "rounded-[18px] border border-[#E1C39E] bg-[#FFF6EB] px-4 py-3 text-[13px] leading-5 text-[#8F4A2D]"
                            : isMe
                              ? "rounded-[18px] bg-[#A0522D] px-4 py-3 text-[13px] leading-5 text-white shadow-[0_14px_35px_rgba(160,82,45,0.22)]"
                              : "rounded-[18px] bg-white/70 px-4 py-3 text-[13px] leading-5 text-[#A0522D] border border-[#EDD5C0]"
                    }
                  >
                    {isInviteCard && inviteParts ? (
                      <>
                        <p className="font-semibold leading-snug">{inviteParts.headline}</p>
                        {inviteParts.note ? (
                          <p className="mt-2 rounded-xl border border-[#EAD4C4] bg-white/60 px-3 py-2 text-[12px] font-normal text-[#7A4B2F]/90">
                            {inviteParts.note}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      m.content
                    )}
                    {isInviteCard ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={Boolean(inviteAcceptedIds[m.id])}
                          onClick={() => {
                            setInviteAcceptedIds((cur) => ({ ...cur, [m.id]: true }));
                            onSendActionMessage?.(chatId, "system", t("chat.systemInviteAccepted"));
                          }}
                          className="rounded-xl border border-[#A0522D] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#A0522D] disabled:opacity-55"
                        >
                          {inviteAcceptedIds[m.id] ? t("chat.inviteAcceptedLabel") : t("chat.acceptInvite")}
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {type === "group" ? (
        <div className="mt-4 px-5">
          <div className="rounded-2xl bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
            <div className="text-[12px] text-[#A0522D]/65">
              {t("chat.groupNotice", { count: participants.length || 2 })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed left-0 right-0 bottom-20 z-50 px-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            aria-label={t("chat.menuAria")}
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E4CCB8] bg-[#FFF8F0] text-[#A0522D]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5.5v.01M12 12v.01M12 18.5v.01" stroke="#A0522D" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[#A0522D]/90 outline-none placeholder:text-[#A0522D]/50"
            placeholder={t("chat.messagePlaceholder")}
          />
          <button
            type="button"
            aria-label={t("chat.sendAria")}
            onClick={handleSend}
            disabled={sendDisabled}
            className={
              sendDisabled
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E8D5C8] bg-transparent text-[#A0522D]/35"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#A0522D] bg-[#FFF8F0] text-[#A0522D]"
            }
          >
            <Send className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            key="action-menu"
            className="fixed inset-0 z-[96]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/20"
              aria-label={t("chat.closeActions")}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 shadow-[0_-18px_55px_rgba(0,0,0,0.14)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E3D3C5]" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setPaymentError(null);
                  setPaymentCurrency(i18n.language.startsWith("ko") ? "KRW" : i18n.language.startsWith("de") ? "EUR" : "AUD");
                  setPaymentAmount(5000);
                  setPaymentPickerOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#E9D6C6] bg-white px-4 py-3 text-left text-[14px] font-semibold text-[#7A4B2F]"
              >
                <CreditCard className="h-5 w-5 shrink-0 text-[#A0522D]" aria-hidden />
                {t("chat.menuPayment")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setGiftAmount(1);
                  setGiftNote("");
                  setGiftSheetOpen(true);
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#E9D6C6] bg-white px-4 py-3 text-left text-[14px] font-semibold text-[#7A4B2F]"
              >
                <Gift className="h-5 w-5 shrink-0 text-[#A0522D]" aria-hidden />
                {t("chat.menuGift")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setInviteNote("");
                  setInviteFormOpen(true);
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#E9D6C6] bg-white px-4 py-3 text-left text-[14px] font-semibold text-[#7A4B2F]"
              >
                <Handshake className="h-5 w-5 shrink-0 text-[#A0522D]" aria-hidden />
                {t("chat.menuInvite")}
              </button>
              {type === "direct" && onStartGroupTripChat ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void onStartGroupTripChat();
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#E9D6C6] bg-white px-4 py-3 text-left text-[14px] font-semibold text-[#7A4B2F]"
                >
                  <Link2 className="h-5 w-5 shrink-0 text-[#A0522D]" aria-hidden />
                  {t("chat.menuStartGroupTrip")}
                </button>
              ) : null}
              {onCopyChatInviteLink ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void onCopyChatInviteLink();
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[#E9D6C6] bg-white px-4 py-3 text-left text-[14px] font-semibold text-[#7A4B2F]"
                >
                  <Link2 className="h-5 w-5 shrink-0 text-[#A0522D]" aria-hidden />
                  {type === "group" ? t("chat.menuCopyGroupInviteLink") : t("chat.menuCopyChatLink")}
                </button>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {paymentPickerOpen ? (
          <motion.div
            key="payment-picker"
            className="fixed inset-0 z-[96]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/25"
              aria-label={t("chat.paymentCancel")}
              onClick={() => setPaymentPickerOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-[0_-18px_55px_rgba(0,0,0,0.16)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-[#E3D3C5]" />
              <h2 className="text-[16px] font-bold text-[#7A4B2F]">{t("chat.paymentTitle")}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#A0522D]/70">{t("chat.paymentPickHint")}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentPickerOpen(false)}
                  className="flex-1 rounded-2xl border border-[#E4CCB8] bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
                >
                  {t("chat.paymentCancel")}
                </button>
                <button
                  type="button"
                  disabled={!onCreatePaymentIntent || paymentBusy}
                  onClick={() => {
                    if (!onCreatePaymentIntent) return;
                    setPaymentBusy(true);
                    setPaymentError(null);
                    void onCreatePaymentIntent({ amount: paymentAmount, currency: paymentCurrency })
                      .then(({ clientSecret }) => {
                        setPaymentSecret(clientSecret);
                        setPaymentPickerOpen(false);
                        onSendActionMessage?.(chatId, "payment_request", t("chat.paymentRequestBody", { amount: paymentAmountLabel }));
                      })
                      .catch((err) => {
                        setPaymentError(err instanceof Error ? err.message : t("chat.paymentFailed"));
                      })
                      .finally(() => setPaymentBusy(false));
                  }}
                  className="flex-1 rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {paymentBusy ? t("chat.paymentProcessing") : t("chat.paymentContinue")}
                </button>
              </div>
              <label className="mt-4 block text-[12px] font-semibold text-[#A0522D]/70">{t("chat.paymentCurrencyLabel")}</label>
              <div className="mt-2 flex gap-2">
                {paymentOptions.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPaymentCurrency(code)}
                    className={
                      paymentCurrency === code
                        ? "rounded-xl border border-[#A0522D] bg-[#FFF0E6] px-3 py-2 text-[13px] font-semibold text-[#A0522D]"
                        : "rounded-xl border border-[#E4CCB8] bg-white px-3 py-2 text-[13px] font-semibold text-[#A0522D]/75"
                    }
                  >
                    {code}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-[12px] font-semibold text-[#A0522D]/70">{t("chat.paymentAmountInput")}</label>
              <input
                type="number"
                min={1}
                step={paymentCurrency === "KRW" ? 1000 : 1}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Math.max(1, Number(e.target.value) || 1))}
                className="mt-2 w-full rounded-2xl border border-[#E9D6C6] bg-white px-3 py-2.5 text-[14px] text-[#7A4B2F] outline-none"
              />
              <div className="mt-2 text-[12px] text-[#A0522D]/70">{t("chat.paymentAmountLabel", { amount: paymentAmountLabel })}</div>
              {paymentError ? <p className="mt-2 text-[12px] text-red-600">{paymentError}</p> : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        <ChatPaymentSheet
          open={Boolean(paymentSecret)}
          clientSecret={paymentSecret}
          amount={paymentAmount}
          currency={paymentCurrency}
          onClose={() => setPaymentSecret(null)}
          onPaid={() => {
            setPaymentSecret(null);
          }}
        />
      </AnimatePresence>

      <AnimatePresence>
        {giftSheetOpen ? (
          <motion.div
            key="gift-sheet"
            className="fixed inset-0 z-[72]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/25"
              aria-label={t("chat.giftCancel")}
              onClick={() => setGiftSheetOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 pb-8 shadow-[0_-18px_55px_rgba(0,0,0,0.16)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E3D3C5]" />
              <h2 className="text-[16px] font-bold text-[#7A4B2F]">{t("chat.giftTitle")}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#A0522D]/70">{t("chat.giftHint")}</p>
              <div className="mt-3 flex gap-2">
                {[1, 3, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGiftAmount(value)}
                    className={
                      giftAmount === value
                        ? "rounded-xl border border-[#A0522D] bg-[#FFF0E6] px-3 py-2 text-[13px] font-semibold text-[#A0522D]"
                        : "rounded-xl border border-[#E4CCB8] bg-white px-3 py-2 text-[13px] font-semibold text-[#A0522D]/75"
                    }
                  >
                    {value} BITE
                  </button>
                ))}
              </div>
              <textarea
                value={giftNote}
                onChange={(e) => setGiftNote(e.target.value)}
                rows={2}
                className="mt-3 w-full resize-none rounded-2xl border border-[#E9D6C6] bg-white px-3 py-2.5 text-[13px] text-[#7A4B2F] outline-none placeholder:text-[#A0522D]/45"
                placeholder={t("chat.giftPlaceholder")}
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setGiftSheetOpen(false)}
                  className="flex-1 rounded-2xl border border-[#E4CCB8] bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
                >
                  {t("chat.giftCancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const content = giftNote.trim()
                      ? `${t("chat.giftMessage", { amount: giftAmount })}\n\n${giftNote.trim()}`
                      : t("chat.giftMessage", { amount: giftAmount });
                    onSendActionMessage?.(chatId, "bite_gift", content);
                    setGiftSheetOpen(false);
                    setGiftNote("");
                  }}
                  className="flex-1 rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white"
                >
                  {t("chat.giftSend")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {inviteFormOpen ? (
          <motion.div
            key="invite-form"
            className="fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/25"
              aria-label={t("chat.inviteCancel")}
              onClick={() => setInviteFormOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 pb-8 shadow-[0_-18px_55px_rgba(0,0,0,0.16)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E3D3C5]" />
              <h2 className="text-[16px] font-bold text-[#7A4B2F]">{t("chat.inviteFormTitle")}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#A0522D]/70">{t("chat.inviteFormHint")}</p>
              <textarea
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-[#E9D6C6] bg-white px-3 py-2.5 text-[13px] text-[#7A4B2F] outline-none placeholder:text-[#A0522D]/45"
                placeholder={t("chat.inviteFormPlaceholder")}
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInviteFormOpen(false)}
                  className="flex-1 rounded-2xl border border-[#E4CCB8] bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
                >
                  {t("chat.inviteCancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInviteCompanion?.({ note: inviteNote.trim() || undefined });
                    setInviteFormOpen(false);
                    setInviteNote("");
                  }}
                  className="flex-1 rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white"
                >
                  {t("chat.inviteSend")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

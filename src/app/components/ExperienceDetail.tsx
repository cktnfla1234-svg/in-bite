import { motion } from "framer-motion";
import { Check, Clock, MapPin, MessageCircle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CookieLogo } from "./ui/CookieLogo";
import { FiatPriceBadge } from "./FiatPriceBadge";
import type { Experience } from "@/data/experiences";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";

type ExperienceDetailProps = {
  experience: Experience;
  onBack: () => void;
  onSayHi?: () => void;
  onEditInvitation?: () => void;
  onDeleteInvitation?: () => void;
  onShareInvitation?: () => void;
  onBookExperience?: () => void;
  bookDisabled?: boolean;
  bookDisabledMessage?: string;
  isOwnInvite?: boolean;
  /** Opens global profile preview (host row). */
  onOpenHostProfile?: () => void;
};

export function ExperienceDetail({
  experience,
  onBack,
  onSayHi,
  onEditInvitation,
  onDeleteInvitation,
  onShareInvitation,
  onBookExperience,
  bookDisabled = false,
  bookDisabledMessage,
  isOwnInvite = false,
  onOpenHostProfile,
}: ExperienceDetailProps) {
  const { t } = useTranslation("common");
  const { preferredCurrency } = usePreferredCurrency();
  return (
    <main className="invite-experience-detail min-h-full w-full bg-[#FDFAF5] pb-28">
      <div className="relative">
        {experience.coverPhotoUrl ? (
          <img
            src={experience.coverPhotoUrl}
            alt={experience.title}
            className="h-[min(42vh,320px)] w-full object-cover"
          />
        ) : (
          <div className="h-[min(42vh,320px)] w-full bg-gradient-to-br from-[#2B1A12] via-[#4A3020] to-[#6B4830]" />
        )}

        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#3D2A1F] shadow-[0_6px_20px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18 9 12l6-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] shadow-[0_6px_20px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
          <FiatPriceBadge
            priceAmount={experience.priceAmount}
            hostCurrency={experience.hostCurrency}
            preferredCurrency={preferredCurrency}
            className="bg-white/95 py-2 pl-3 pr-3.5 text-[13px]"
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 px-5">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => onOpenHostProfile?.()}
              disabled={!onOpenHostProfile}
              className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[#E7D7C7] shadow-[0_10px_30px_rgba(0,0,0,0.12)] ${
                onOpenHostProfile ? "cursor-pointer ring-0 transition hover:opacity-95" : "cursor-default"
              }`}
              aria-label={onOpenHostProfile ? `View ${experience.hostName} profile` : undefined}
            >
              {experience.hostAvatarUrl ? (
                <img src={experience.hostAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <CookieLogo size={40} />
              )}
            </button>
            <div className="mb-1 min-w-0 flex-1 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-[#EDD5C0]/80">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!onOpenHostProfile}
                  onClick={() => onOpenHostProfile?.()}
                  className={`font-body-ko text-left text-[15px] font-semibold text-[#5C3318] ${
                    onOpenHostProfile ? "hover:underline" : ""
                  }`}
                >
                  {experience.hostName}
                </button>
                {isOwnInvite ? (
                  <button
                    type="button"
                    onClick={() => onEditInvitation?.()}
                    className="font-brand-display inline-flex items-center gap-1 rounded-full border border-[#A0522D] bg-transparent px-3 py-1 text-[12px] font-semibold text-[#A0522D] shadow-none transition hover:bg-[#A0522D]/5"
                  >
                    {t("inviteDetail.editInvitation")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSayHi?.()}
                    className="font-brand-display inline-flex items-center gap-1 rounded-full border border-[#A0522D] bg-transparent px-3 py-1 text-[12px] font-semibold text-[#A0522D] shadow-none transition hover:bg-[#A0522D]/5"
                  >
                    <MessageCircle className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
                    Say Hi
                  </button>
                )}
              </div>
              <div className="font-body-ko mt-1 flex items-center gap-1 text-[12px] text-[#7A5C4E]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A0522D]/55" strokeWidth={2} />
                <span>
                  {experience.city}, {experience.country}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-[calc(3.5rem+36px)]">
        <h1 className="font-brand-display text-[clamp(1.75rem,6vw,2.15rem)] leading-tight font-semibold text-[#A0522D]">
          {experience.title}
        </h1>

        <div className="font-body-ko mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[#7A5C4E]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[#A0522D]/55" strokeWidth={2} />
            {experience.durationLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-[#A0522D]/55" strokeWidth={2} />
            {experience.maxGuestsLabel}
          </span>
        </div>

        <section className="mt-8">
          <h2 className="font-brand-display text-[1.15rem] font-semibold text-[#A0522D]">
            What&apos;s Included
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {experience.includedItems.map((item) => (
              <div
                key={item.id}
                className="font-body-ko inline-flex items-center gap-2 rounded-2xl border border-[#E5D8CC] bg-white/90 px-3.5 py-2 text-[12px] font-medium text-[#5C4033] shadow-[0_2px_8px_rgba(160,82,45,0.06)]"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-[#A0522D]/75" strokeWidth={2.5} />
                <span aria-hidden className="text-[13px] opacity-90">
                  {item.emoji}
                </span>
                <span>{item.labelKo}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-brand-display text-[1.15rem] font-semibold text-[#A0522D]">
            About This Experience
          </h2>
          <p className="font-body-ko mt-3 text-[14px] leading-[1.75] text-[#3D2A22]/90">
            {experience.aboutDetailKo}
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-brand-display text-[1.15rem] font-semibold text-[#A0522D]">
            Journey Timeline
          </h2>

          <div className="relative mt-5 pl-2">
            <svg
              className="pointer-events-none absolute left-[21px] top-3 bottom-10 w-8 text-[#D4B8A5]/85"
              viewBox="0 0 32 200"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M16 0 C18 40, 10 80, 16 120 S14 170, 16 200"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute left-[27px] top-4 bottom-8 w-px bg-gradient-to-b from-[#E0C9B8] via-[#D4B8A5] to-[#E0C9B8]" aria-hidden />

            <ul className="relative space-y-0">
              {experience.itinerary.map((stop, index) => (
                <motion.li
                  key={`${stop.time}-${stop.title}-${index}`}
                  className="relative flex gap-4 pb-9 last:pb-2"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-12% 0px -8% 0px", amount: 0.35 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 }}
                >
                  <div className="relative z-[1] flex w-14 shrink-0 justify-center pt-0.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#A0522D] text-[11px] font-bold leading-tight tracking-tight text-white shadow-[0_6px_16px_rgba(160,82,45,0.35)]">
                      {stop.time}
                    </div>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="font-body-ko text-[14px] font-semibold text-[#A0522D]">
                      {stop.title}
                    </div>
                    {stop.description ? (
                      <p className="font-body-ko mt-1 text-[12px] leading-relaxed text-[#7A6558]">
                        {stop.description}
                      </p>
                    ) : null}
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8">
          <div className="rounded-[22px] border border-[#EDD5C0]/70 bg-white/90 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.05)]">
            <h2 className="font-brand-display text-[1.1rem] font-semibold text-[#A0522D]">
              About Your Host
            </h2>
            <p className="font-body-ko mt-2 text-[13px] leading-relaxed text-[#4A382E]">
              {experience.about}
            </p>
          </div>
        </section>

        {isOwnInvite ? (
          <>
            <div className="mt-8 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onEditInvitation?.()}
                className="font-brand-display rounded-[14px] border border-[#A0522D] bg-white py-2.5 text-[0.95rem] font-semibold text-[#A0522D] transition hover:bg-[#A0522D]/5"
              >
                {t("inviteDetail.editInvitation")}
              </button>
              <button
                type="button"
                onClick={() => onDeleteInvitation?.()}
                className="font-brand-display rounded-[14px] border border-red-300 bg-white py-2.5 text-[0.95rem] font-semibold text-red-600 transition hover:bg-red-50"
              >
                {t("common.delete")}
              </button>
            </div>
            <p className="font-body-ko mt-10 text-center text-[12px] text-[#7A5C4E]">
              {t("inviteDetail.ownInviteNoBookHint")}
            </p>
            <button
              type="button"
              onClick={() => onShareInvitation?.()}
              className="font-brand-display mt-3 w-full rounded-[18px] bg-[#A0522D] py-4 text-[1.15rem] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.28)] transition hover:bg-[#8B452F]"
            >
              {t("inviteDetail.shareWithFriends")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onBookExperience?.()}
            disabled={bookDisabled}
            title={bookDisabled && bookDisabledMessage ? bookDisabledMessage : undefined}
            className="font-brand-display mt-10 w-full rounded-[18px] bg-[#A0522D] py-4 text-[1.15rem] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.28)] transition hover:bg-[#8B452F] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#A0522D]"
          >
            {bookDisabled ? t("inviteDetail.bookUnavailable") : "Book This Experience"}
          </button>
        )}
      </div>
    </main>
  );
}

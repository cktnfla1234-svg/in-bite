import { useTranslation } from "react-i18next";
import type { LocalInviteItineraryItem } from "@/lib/localInvites";

export type InviteTimelineRow = {
  id: string;
  time: string;
  title: string;
  description: string;
};

export function emptyInviteTimelineRow(): InviteTimelineRow {
  return { id: crypto.randomUUID(), time: "", title: "", description: "" };
}

export function inviteTimelineRowsFromItinerary(
  items: LocalInviteItineraryItem[] | undefined,
): InviteTimelineRow[] {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [emptyInviteTimelineRow()];
  return list.map((item) => ({
    id: crypto.randomUUID(),
    time: item.time ?? "",
    title: item.title ?? "",
    description: item.description ?? "",
  }));
}

export function itineraryFromTimelineRows(rows: InviteTimelineRow[]): LocalInviteItineraryItem[] {
  return rows.map((r) => ({
    time: r.time.trim(),
    title: r.title.trim(),
    description: r.description.trim(),
  }));
}

type InviteJourneyTimelineEditorProps = {
  rows: InviteTimelineRow[];
  onChange: (next: InviteTimelineRow[]) => void;
  errorText?: string;
  /** Classes on the section title (e.g. `mt-6` on create step 2, `mt-4` in profile edit). */
  titleClassName?: string;
};

export function InviteJourneyTimelineEditor({
  rows,
  onChange,
  errorText,
  titleClassName = "mt-6",
}: InviteJourneyTimelineEditorProps) {
  const { t } = useTranslation("common");

  const addRow = () => {
    onChange([...rows, emptyInviteTimelineRow()]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    onChange(rows.filter((item) => item.id !== id));
  };

  const updateRow = (id: string, key: "time" | "title" | "description", value: string) => {
    onChange(rows.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  return (
    <>
      <div className={`text-[12px] font-semibold text-[#A0522D]/70 ${titleClassName}`.trim()}>
        {t("inviteFields.journeyTimeline")}
      </div>
      <div className="mt-3 rounded-2xl border border-[#EDD5C0] bg-white/60 p-4">
        <div className="relative space-y-4 pl-3">
          <div className="pointer-events-none absolute bottom-3 left-[14px] top-3 w-[2px] bg-[#A0522D]/25" />
          {rows.map((item, index) => (
            <div key={item.id} className="relative">
              <div className="absolute left-0 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-[#A0522D] text-center text-[10px] font-semibold leading-none text-white">
                <span className="line-clamp-2 px-0.5">{item.time.trim() || String(index + 1)}</span>
              </div>
              <div className="ml-10 rounded-2xl border border-[#EDD5C0] bg-[#FDFAF5] p-3">
                <input
                  className="w-full rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                  placeholder={t("inviteFields.timelineTimePh")}
                  value={item.time}
                  onChange={(e) => updateRow(item.id, "time", e.target.value)}
                />
                <input
                  className="mt-2 w-full rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                  placeholder={t("inviteFields.timelineTitlePh")}
                  value={item.title}
                  onChange={(e) => updateRow(item.id, "title", e.target.value)}
                />
                <textarea
                  className="mt-2 min-h-[78px] w-full resize-none rounded-xl border border-[#EDD5C0] bg-white/70 px-3 py-2 text-[13px] outline-none"
                  placeholder={t("inviteFields.timelineDescriptionPh")}
                  value={item.description}
                  onChange={(e) => updateRow(item.id, "description", e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRow(item.id)}
                    className="rounded-full border border-[#EDD5C0] px-3 py-1 text-[12px] font-semibold text-[#A0522D]"
                    aria-label={t("inviteFields.timelineDeleteAria")}
                  >
                    {t("inviteFields.timelineDelete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#A0522D]/35 bg-[#A0522D]/10 px-4 py-2 text-[13px] font-semibold text-[#A0522D]"
        >
          <span className="text-[16px] leading-none">+</span> {t("inviteFields.timelineAddRow")}
        </button>
      </div>
      {errorText ? <p className="mt-3 text-[12px] font-semibold text-red-600">{errorText}</p> : null}
    </>
  );
}

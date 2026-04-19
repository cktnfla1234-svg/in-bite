import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { addLocalDailyBite } from "@/lib/localDailyBites";
import { BITE_REWARD_DAILY_BITE } from "@/lib/bitePolicy";
import { applyBiteDeltaServer } from "@/lib/profile";
import { compressDataUrlList } from "@/lib/imageCompress";
import { insertDailyBitePost } from "@/lib/remoteDailyBites";

type CreateDailyInbiteSheetProps = {
  onClose: () => void;
};

function localCalendarDayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateDailyInbiteSheet({ onClose }: CreateDailyInbiteSheetProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [city, setCity] = useState("Seoul");
  const [text, setText] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isReadingPhotos, setIsReadingPhotos] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState("");

  const handlePhotoPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsReadingPhotos(true);
    setError("");
    try {
      const picked = await Promise.all(
        Array.from(files)
          .slice(0, 6 - photoUrls.length)
          .map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ""));
                reader.onerror = () => reject(new Error("Failed to read image file."));
                reader.readAsDataURL(file);
              }),
          ),
      );
      setPhotoUrls((prev) => [...prev, ...picked].slice(0, 6));
    } catch {
      setError("Failed to process photos. Please try selecting them again.");
    } finally {
      setIsReadingPhotos(false);
    }
  };

  const handleSubmit = () => {
    void (async () => {
      if (!text.trim()) {
        setError("Please write your daily inbite message.");
        return;
      }
      if (isReadingPhotos) {
        setError("Photos are still processing. Please wait a moment.");
        return;
      }

      setSubmitBusy(true);
      setError("");
      try {
        const compressedPhotos = photoUrls.length ? await compressDataUrlList(photoUrls, 1280, 0.76) : [];

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const displayName =
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          user?.username?.trim() ||
          "You";
        const authorBio = bio.trim() || "Sharing a small moment from today.";

        addLocalDailyBite({
          id,
          authorName: displayName,
          authorBio,
          text: text.trim(),
          city: city.trim() || "Local",
          createdAt,
          photoUrls: compressedPhotos,
          authorImageUrl: user?.imageUrl ?? undefined,
          likeCount: 0,
          commentCount: 0,
          authorClerkId: user?.id,
        });

        const uid = user?.id?.trim();
        if (uid) {
          try {
            const token = await getToken({ template: "supabase" });
            if (token) {
              await insertDailyBitePost(token, {
                id,
                authorClerkId: uid,
                authorName: displayName,
                authorBio,
                body: text.trim(),
                city: city.trim() || "Local",
                photoUrls: compressedPhotos,
                authorImageUrl: user?.imageUrl ?? undefined,
                createdAt,
              });
            }
          } catch (syncErr) {
            console.warn("Daily bite not synced to server (others may not see it yet)", syncErr);
          }
        }
        if (uid) {
          const day = localCalendarDayKey();
          const rewardKey = `inbite:daily-bite-day:${uid}:${day}`;
          if (!window.localStorage.getItem(rewardKey)) {
            try {
              const token = await getToken({ template: "supabase" });
              if (!token) {
                window.dispatchEvent(
                  new CustomEvent("inbite-apply-bite", {
                    detail: {
                      clerkId: uid,
                      delta: BITE_REWARD_DAILY_BITE,
                      kind: "daily_bite",
                      meta: { local_day: day },
                    },
                  }),
                );
              } else {
                await applyBiteDeltaServer(uid, token, BITE_REWARD_DAILY_BITE, "daily_bite", { local_day: day });
              }
              window.localStorage.setItem(rewardKey, "1");
            } catch {
              // Post still counts locally; reward can be retried another day or via support.
            }
          }
        }

        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not save this post. Try fewer photos, smaller images, or a shorter message.",
        );
      } finally {
        setSubmitBusy(false);
      }
    })();
  };

  return (
    <section className="flex max-h-[min(88dvh,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-t-[28px] bg-[#FDFAF5] shadow-[0_-16px_45px_rgba(0,0,0,0.12)]">
      <div className="shrink-0 px-5 pt-6">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#E6D3C3]" />
        <h2
          className="text-[26px] font-semibold text-[#A0522D]"
          style={{ fontFamily: "'Patrick Hand', cursive" }}
        >
          Create Daily Inbite
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-6">
        <div className="mt-5 space-y-4 pb-4">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#A0522D]/80">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/80 px-4 py-3 text-[14px] text-[#2C1A0E] outline-none"
              placeholder="e.g. Seoul"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-[#A0522D]/80">Daily inbite</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-2 h-32 w-full resize-none rounded-2xl border border-[#EDD5C0] bg-white/80 px-4 py-3 text-[14px] leading-6 text-[#2C1A0E] outline-none"
              placeholder="What happened today?"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-[#A0522D]/80">Photos (up to 6)</span>
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={isReadingPhotos || photoUrls.length >= 6}
              onChange={(e) => {
                void handlePhotoPick(e.target.files);
                e.currentTarget.value = "";
              }}
              className="mt-2 block w-full rounded-2xl border border-[#EDD5C0] bg-white/80 px-4 py-3 text-[13px] text-[#2C1A0E] disabled:opacity-60"
            />
            {isReadingPhotos ? <p className="mt-1 text-[11px] text-[#A0522D]/60">Processing photos...</p> : null}
            {photoUrls.length ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photoUrls.map((url, idx) => (
                  <div key={`${idx}-${url.slice(0, 12)}`} className="relative overflow-hidden rounded-xl border border-[#EDD5C0] bg-white">
                    <img src={url} alt={`Daily bite upload ${idx + 1}`} className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute right-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-[#A0522D]/80">Short bio (optional)</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 h-20 w-full resize-none rounded-2xl border border-[#EDD5C0] bg-white/80 px-4 py-3 text-[13px] leading-5 text-[#2C1A0E] outline-none"
              placeholder="A line about you"
            />
          </label>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#EDD5C0]/70 bg-[#FDFAF5]/98 px-5 pt-3 backdrop-blur-sm pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))]">
        {error ? <p className="mb-3 text-[12px] text-[#B54545]">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[#EDD5C0] bg-white px-4 py-3 text-[13px] font-semibold text-[#A0522D]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isReadingPhotos || submitBusy}
            className="flex-1 rounded-2xl bg-[#A0522D] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(160,82,45,0.3)] disabled:opacity-60"
          >
            {submitBusy ? "Posting…" : isReadingPhotos ? "Preparing photos..." : "Post Daily Inbite"}
          </button>
        </div>
      </div>
    </section>
  );
}

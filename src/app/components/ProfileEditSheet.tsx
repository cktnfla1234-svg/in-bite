import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CountryCitySelect } from "./CountryCitySelect";
import { getCountryNameEn } from "@/lib/locations/dataset";
import { normalizeAppLocale } from "@/lib/i18n/appLocales";

export type EditableProfile = {
  name: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** English country name (synced with countryCode; used where a plain string is needed). */
  country: string;
  /** English canonical city name (list match or custom). */
  city: string;
  address: string;
  mbti: string;
  hobbies: string;
  bio: string;
  profilePhoto: string;
  photos: string[];
};

const MBTI_OPTIONS = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

const PROFILE_CROP_OUTPUT = 640;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function cropDiameterFromViewport() {
  if (typeof window === "undefined") return 300;
  const w = window.innerWidth;
  return Math.round(clamp(w * 0.77, 260, Math.min(360, w - 32)));
}

type ProfileEditSheetProps = {
  open: boolean;
  onClose: () => void;
  profile: EditableProfile;
  onSave: (profile: EditableProfile) => void | Promise<void>;
};

export function ProfileEditSheet({ open, onClose, profile, onSave }: ProfileEditSheetProps) {
  const { t, i18n } = useTranslation("common");
  const locale = normalizeAppLocale(i18n.language);
  const [draft, setDraft] = useState<EditableProfile>(profile);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImageSize, setCropImageSize] = useState<{ w: number; h: number } | null>(null);
  const [cropDiameter, setCropDiameter] = useState(300);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ lastDist: number } | null>(null);
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const cropRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    cropRef.current = { x: cropX, y: cropY };
  }, [cropX, cropY]);

  useEffect(() => {
    if (open) {
      setDraft(profile);
      setSaveError("");
      setSaveBusy(false);
    }
  }, [open, profile]);

  const baseScale = cropImageSize ? Math.max(cropDiameter / cropImageSize.w, cropDiameter / cropImageSize.h) : 1;
  const displayW = cropImageSize ? cropImageSize.w * baseScale * cropZoom : 0;
  const displayH = cropImageSize ? cropImageSize.h * baseScale * cropZoom : 0;
  const maxOffsetX = Math.max(0, (displayW - cropDiameter) / 2);
  const maxOffsetY = Math.max(0, (displayH - cropDiameter) / 2);

  useEffect(() => {
    setCropX((prev) => clamp(prev, -maxOffsetX, maxOffsetX));
  }, [maxOffsetX]);

  useEffect(() => {
    setCropY((prev) => clamp(prev, -maxOffsetY, maxOffsetY));
  }, [maxOffsetY]);

  const handlePhotoPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, 5 - draft.photos.length);
    const dataUrls = await Promise.all(
      selected.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Failed to read image file."));
            reader.readAsDataURL(file);
          }),
      ),
    );
    setDraft((prev) => ({ ...prev, photos: [...prev.photos, ...dataUrls].slice(0, 5) }));
  };

  const handleProfilePhotoPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image."));
    });
    setCropDiameter(cropDiameterFromViewport());
    setCropSource(dataUrl);
    setCropImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
  };

  const applyProfileCrop = async () => {
    if (!cropSource || !cropImageSize || displayW <= 0 || displayH <= 0) return;
    setIsApplyingCrop(true);
    try {
      const img = new Image();
      img.src = cropSource;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = PROFILE_CROP_OUTPUT;
      canvas.height = PROFILE_CROP_OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to initialize image editor.");

      const D = cropDiameter;
      const left = (D - displayW) / 2 + cropX;
      const top = (D - displayH) / 2 + cropY;
      const sx = ((0 - left) / displayW) * cropImageSize.w;
      const sy = ((0 - top) / displayH) * cropImageSize.h;
      const sw = (D / displayW) * cropImageSize.w;
      const sh = (D / displayH) * cropImageSize.h;

      ctx.fillStyle = "#FDFAF5";
      ctx.fillRect(0, 0, PROFILE_CROP_OUTPUT, PROFILE_CROP_OUTPUT);
      ctx.save();
      ctx.beginPath();
      ctx.arc(PROFILE_CROP_OUTPUT / 2, PROFILE_CROP_OUTPUT / 2, PROFILE_CROP_OUTPUT / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PROFILE_CROP_OUTPUT, PROFILE_CROP_OUTPUT);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setDraft((prev) => ({ ...prev, profilePhoto: croppedDataUrl }));
      setCropSource(null);
      setCropImageSize(null);
    } finally {
      setIsApplyingCrop(false);
    }
  };

  const clearPointers = useCallback(() => {
    pointersRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
  }, []);

  const onCropPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchRef.current = { lastDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) };
      dragRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      pinchRef.current = null;
      const { x, y } = cropRef.current;
      dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y };
    }
  }, []);

  const onCropPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (dist > 1 && pinchRef.current.lastDist > 1) {
          const factor = dist / pinchRef.current.lastDist;
          pinchRef.current.lastDist = dist;
          setCropZoom((z) => clamp(z * factor, 1, 3));
        }
        return;
      }

      if (pointersRef.current.size === 1 && dragRef.current && dragRef.current.id === e.pointerId) {
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;
        setCropX(clamp(dragRef.current.ox + dx, -maxOffsetX, maxOffsetX));
        setCropY(clamp(dragRef.current.oy + dy, -maxOffsetY, maxOffsetY));
      }
    },
    [maxOffsetX, maxOffsetY],
  );

  const onCropPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (dragRef.current?.id === e.pointerId) dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [],
  );

  const onCropWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setCropZoom((z) => clamp(z + delta, 1, 3));
  }, []);

  const submitProfile = async () => {
    setSaveError("");
    setSaveBusy(true);
    console.info("[ProfileEditSheet] save submit", {
      nameLen: draft.name.trim().length,
      hasProfilePhoto: Boolean(draft.profilePhoto),
      galleryCount: draft.photos.length,
    });
    try {
      await Promise.resolve(onSave(draft));
      console.info("[ProfileEditSheet] save finished OK");
      onClose();
    } catch (err) {
      console.error("[ProfileEditSheet] save failed", err);
      setSaveError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

          <motion.div
            className="absolute inset-0 flex items-center justify-center p-3"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="mx-auto max-h-[90svh] w-full max-w-[560px] overflow-y-auto rounded-[28px] bg-[#FDFAF5] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <div className="px-5 pb-8 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[18px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    Edit Profile
                  </div>
                  <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <form
                  className="mt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitProfile();
                  }}
                >
                  <div className="text-[12px] font-semibold text-[#A0522D]/70">Profile photo</div>
                  <div className="mt-3 rounded-2xl border border-[#EDD5C0] bg-white/55 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#EDD5C0] bg-white">
                        {draft.profilePhoto ? (
                          <img
                            src={draft.profilePhoto}
                            alt="Profile avatar"
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-[#A0522D]/45">👤</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {draft.profilePhoto ? (
                          <button
                            type="button"
                            className="rounded-xl border-2 border-[#A0522D]/35 bg-white px-3 py-2 text-[13px] font-bold text-[#A0522D]"
                            onClick={() => setDraft((prev) => ({ ...prev, profilePhoto: "" }))}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-xl border-2 border-[#A0522D]/35 bg-white px-3 py-2 text-[13px] font-bold text-[#A0522D]"
                            onClick={() => profilePhotoInputRef.current?.click()}
                          >
                            Upload
                          </button>
                        )}
                      </div>
                      <input
                        ref={profilePhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          void handleProfilePhotoPick(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[#EDD5C0]/80 pt-5 text-[12px] font-semibold text-[#A0522D]/70">
                    Photos ({draft.photos.length}/5)
                  </div>
                  <div className="mt-3 flex gap-3">
                    <div className="grid w-full grid-cols-3 gap-3">
                      {draft.photos.map((photo, idx) => (
                        <div key={photo} className="relative h-24 overflow-hidden rounded-2xl border border-[#EDD5C0] bg-white">
                          <img src={photo} alt={`Profile photo ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                photos: prev.photos.filter((_, i) => i !== idx),
                              }))
                            }
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {draft.photos.length < 5 ? (
                        <button
                          type="button"
                          className="h-24 rounded-2xl border-2 border-dashed border-[#EDD5C0] bg-white/40 text-[12px] font-bold text-[#A0522D]/70"
                          aria-label="Add photo"
                          onClick={() => photoInputRef.current?.click()}
                        >
                          Add Photo
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handlePhotoPick(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>

                  <div className="mt-4 text-[12px] font-semibold text-[#A0522D]/70">Name</div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your display name"
                  />

                  <div className="mt-4">
                    <CountryCitySelect
                      locale={locale}
                      countryCode={draft.countryCode}
                      cityEn={draft.city}
                      onChange={(next) =>
                        setDraft((prev) => ({
                          ...prev,
                          countryCode: next.countryCode,
                          city: next.cityEn,
                          country: getCountryNameEn(next.countryCode),
                        }))
                      }
                      labels={{
                        country: t("locationPicker.country"),
                        city: t("locationPicker.city"),
                        searchCountry: t("locationPicker.searchCountry"),
                        searchCity: t("locationPicker.searchCity"),
                        createCity: "",
                      }}
                      formatCreateCityLabel={(input) => t("locationPicker.createCity", { city: input })}
                    />
                  </div>

                  <div className="mt-4 text-[12px] font-semibold text-[#A0522D]/70">Address</div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
                    value={draft.address}
                    onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Street / district / detail"
                  />

                  <div className="mt-4 text-[12px] font-semibold text-[#A0522D]/70">MBTI</div>
                  <select
                    className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
                    value={draft.mbti}
                    onChange={(e) => setDraft((prev) => ({ ...prev, mbti: e.target.value }))}
                  >
                    {MBTI_OPTIONS.map((mbti) => (
                      <option key={mbti} value={mbti}>
                        {mbti}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 text-[12px] font-semibold text-[#A0522D]/70">Hobbies</div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
                    value={draft.hobbies}
                    onChange={(e) => setDraft((prev) => ({ ...prev, hobbies: e.target.value }))}
                    placeholder="e.g. Hiking, Coffee, Photography"
                  />

                  <div className="mt-4 text-[12px] font-semibold text-[#A0522D]/70">Bio</div>
                  <textarea
                    className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
                    value={draft.bio}
                    onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
                    placeholder="Introduce yourself"
                  />

                  {saveError ? <p className="mt-3 text-center text-[12px] font-medium text-red-600">{saveError}</p> : null}

                  <button
                    type="submit"
                    disabled={saveBusy}
                    className="mt-5 w-full rounded-2xl bg-[#A0522D] py-4 text-[15px] font-semibold text-white disabled:opacity-60"
                  >
                    {saveBusy ? "Saving…" : "Save Changes"}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>

          <AnimatePresence onExitComplete={clearPointers}>
            {cropSource && cropImageSize ? (
              <motion.div
                className="fixed inset-0 z-[90] flex flex-col bg-[#FDFAF5]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-between px-5 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
                  <div className="text-[17px] font-bold text-[#A0522D]">{t("profile.cropTitle")}</div>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#A0522D]/25 text-[#A0522D]"
                    aria-label={t("profile.cropCancel")}
                    onClick={() => {
                      clearPointers();
                      setCropSource(null);
                      setCropImageSize(null);
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div
                  className="relative flex min-h-0 flex-1 touch-none select-none overflow-hidden"
                  style={{ touchAction: "none" }}
                  onPointerDown={onCropPointerDown}
                  onPointerMove={onCropPointerMove}
                  onPointerUp={onCropPointerUp}
                  onPointerCancel={onCropPointerUp}
                  onWheel={onCropWheel}
                >
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <div
                      className="relative overflow-hidden rounded-full shadow-[0_16px_48px_rgba(160,82,45,0.22)]"
                      style={{ width: cropDiameter, height: cropDiameter }}
                    >
                      <img
                        src={cropSource}
                        alt=""
                        draggable={false}
                        className="absolute max-w-none"
                        style={{
                          width: `${displayW}px`,
                          height: `${displayH}px`,
                          left: `${(cropDiameter - displayW) / 2 + cropX}px`,
                          top: `${(cropDiameter - displayH) / 2 + cropY}px`,
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 rounded-full ring-[3px] ring-inset ring-[#A0522D]/40"
                        aria-hidden
                      />
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <div
                      style={{
                        width: cropDiameter,
                        height: cropDiameter,
                        borderRadius: "50%",
                        boxShadow: "0 0 0 max(120vw, 120vh) rgba(24, 18, 14, 0.52)",
                      }}
                    />
                  </div>
                </div>

                <div className="border-t border-[#EADBCF] bg-[#FFFBF5]">
                <p className="px-6 pb-2 pt-3 text-center text-[13px] font-medium leading-snug text-[#7A6A5E]/65">{t("profile.cropGuide")}</p>

                <div className="px-6 pb-3">
                  <label className="text-[12px] font-bold text-[#A0522D]/80">Zoom</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={cropZoom}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                    className="mt-2 w-full accent-[#A0522D]"
                  />
                </div>

                <div className="flex gap-4 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-1">
                  <button
                    type="button"
                    className="h-14 min-h-[52px] flex-1 rounded-2xl border-2 border-[#A0522D]/45 bg-white text-[15px] font-bold text-[#A0522D] shadow-sm"
                    onClick={() => {
                      clearPointers();
                      setCropSource(null);
                      setCropImageSize(null);
                    }}
                  >
                    {t("profile.cropCancel")}
                  </button>
                  <button
                    type="button"
                    className="h-14 min-h-[52px] flex-1 rounded-2xl bg-[#A0522D] text-[15px] font-bold text-white shadow-[0_14px_36px_rgba(160,82,45,0.28)] disabled:opacity-60"
                    onClick={() => void applyProfileCrop()}
                    disabled={isApplyingCrop}
                  >
                    {isApplyingCrop ? t("profile.cropApplying") : t("profile.cropApply")}
                  </button>
                </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

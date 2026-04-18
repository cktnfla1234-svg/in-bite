/**
 * Resize and re-encode a data-URL image as JPEG to reduce localStorage / payload size.
 */
export async function compressDataUrlAsJpeg(
  dataUrl: string,
  maxSide: number,
  quality = 0.82,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return dataUrl;

  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for compression."));
  });

  const w0 = img.naturalWidth || 1;
  const h0 = img.naturalHeight || 1;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.fillStyle = "#FDFAF5";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressDataUrlList(
  urls: string[],
  maxSide: number,
  quality = 0.78,
): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    try {
      out.push(await compressDataUrlAsJpeg(u, maxSide, quality));
    } catch {
      out.push(u);
    }
  }
  return out;
}

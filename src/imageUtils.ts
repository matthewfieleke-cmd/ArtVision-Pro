/** Downscale and JPEG-compress for localStorage-friendly thumbnails. */
export function compressDataUrl(
  dataUrl: string,
  maxWidth = 720,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export async function cropDataUrl(dataUrl: string, crop: PixelCrop, quality = 0.92): Promise<string> {
  const img = await loadImage(dataUrl);
  const safeWidth = Math.max(1, Math.round(crop.width));
  const safeHeight = Math.max(1, Math.round(crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(
    img,
    Math.max(0, Math.round(crop.x)),
    Math.max(0, Math.round(crop.y)),
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );
  return canvas.toDataURL('image/jpeg', quality);
}

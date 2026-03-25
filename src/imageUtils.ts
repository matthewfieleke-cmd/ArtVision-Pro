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

export type CropPreset = 'freeform' | 'portrait' | 'square' | 'landscape';

export type AutoCropSuggestion = {
  crop: PixelCrop;
  rotation: number;
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

function rotateBounds(width: number, height: number, radians: number): { width: number; height: number } {
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width: Math.ceil(width * cos + height * sin),
    height: Math.ceil(width * sin + height * cos),
  };
}

export async function cropDataUrlWithRotation(
  dataUrl: string,
  crop: PixelCrop,
  rotation = 0,
  quality = 0.92
): Promise<string> {
  const img = await loadImage(dataUrl);
  const radians = (rotation * Math.PI) / 180;
  const safeWidth = Math.max(1, Math.round(crop.width));
  const safeHeight = Math.max(1, Math.round(crop.height));
  const rotated = rotateBounds(img.naturalWidth, img.naturalHeight, radians);

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.save();
  ctx.translate(-Math.round(crop.x), -Math.round(crop.y));
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', quality);
}

export async function suggestPaintingCrop(dataUrl: string): Promise<AutoCropSuggestion> {
  const img = await loadImage(dataUrl);
  const sampleMax = 300;
  const scale = Math.min(1, sampleMax / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const lum = (idx: number) => 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  let total = 0;
  let borderTotal = 0;
  let borderCount = 0;
  const borderBand = Math.max(4, Math.round(Math.min(width, height) * 0.08));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const L = lum(idx);
      total += L;
      if (x < borderBand || y < borderBand || x >= width - borderBand || y >= height - borderBand) {
        borderTotal += L;
        borderCount += 1;
      }
    }
  }
  const globalMean = total / (width * height);
  const borderMean = borderCount ? borderTotal / borderCount : globalMean;
  const threshold = Math.max(12, Math.abs(borderMean - globalMean) * 0.45 + 12);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const L = lum(idx);
      const right = lum((y * width + (x + 1)) * 4);
      const down = lum(((y + 1) * width + x) * 4);
      const edge = Math.abs(L - right) + Math.abs(L - down);
      const borderDelta = Math.abs(L - borderMean);
      if (edge > threshold || borderDelta > threshold * 0.9) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hits += 1;
      }
    }
  }

  if (!hits || maxX <= minX || maxY <= minY) {
    return {
      crop: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
      rotation: 0,
    };
  }

  const padX = Math.round((maxX - minX) * 0.06);
  const padY = Math.round((maxY - minY) * 0.06);
  const sx = img.naturalWidth / width;
  const sy = img.naturalHeight / height;

  const crop = {
    x: Math.max(0, Math.round((minX - padX) * sx)),
    y: Math.max(0, Math.round((minY - padY) * sy)),
    width: Math.min(img.naturalWidth, Math.round((maxX - minX + padX * 2) * sx)),
    height: Math.min(img.naturalHeight, Math.round((maxY - minY + padY * 2) * sy)),
  };

  return { crop, rotation: 0 };
}

/**
 * Builds a semi-transparent heatmap of pixel differences between two loaded images,
 * both drawn to the same dimensions (cover crop). Used for "hold to highlight changes."
 */
export async function buildDifferenceOverlayDataUrl(
  original: HTMLImageElement,
  revised: HTMLImageElement,
  maxSide = 360
): Promise<string | null> {
  const rw = revised.naturalWidth;
  const rh = revised.naturalHeight;
  if (!rw || !rh || !original.naturalWidth || !original.naturalHeight) return null;

  const scale = Math.min(1, maxSide / Math.max(rw, rh));
  const w = Math.max(1, Math.round(rw * scale));
  const h = Math.max(1, Math.round(rh * scale));

  const c0 = document.createElement('canvas');
  c0.width = w;
  c0.height = h;
  const c1 = document.createElement('canvas');
  c1.width = w;
  c1.height = h;
  const ctx0 = c0.getContext('2d');
  const ctx1 = c1.getContext('2d');
  if (!ctx0 || !ctx1) return null;

  const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    const ir = img.naturalWidth / img.naturalHeight;
    const tr = w / h;
    let sw: number;
    let sh: number;
    let sx: number;
    let sy: number;
    if (ir > tr) {
      sh = img.naturalHeight;
      sw = sh * tr;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = img.naturalWidth;
      sh = sw / tr;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };

  drawCover(ctx0, original);
  drawCover(ctx1, revised);

  const d0 = ctx0.getImageData(0, 0, w, h);
  const d1 = ctx1.getImageData(0, 0, w, h);
  const out = ctx1.createImageData(w, h);
  const a = d0.data;
  const b = d1.data;
  const o = out.data;

  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i]! - b[i]!);
    const dg = Math.abs(a[i + 1]! - b[i + 1]!);
    const db = Math.abs(a[i + 2]! - b[i + 2]!);
    const m = (dr + dg + db) / (3 * 255);
    const t = m < 0.04 ? 0 : Math.min(1, (m - 0.04) / 0.25);
    o[i] = 124;
    o[i + 1] = 58;
    o[i + 2] = 237;
    o[i + 3] = Math.round(t * 200);
  }

  ctx1.putImageData(out, 0, 0);
  return c1.toDataURL('image/png');
}

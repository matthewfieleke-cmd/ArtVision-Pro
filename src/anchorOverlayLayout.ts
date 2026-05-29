/** Normalized anchor region from the critique API (0–1 in image pixel space). */
export type NormalizedAnchorRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Pixels: image drawn inside container with `object-fit: contain`. */
export function objectContainDisplayRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number; width: number; height: number } {
  if (
    containerW <= 0 ||
    containerH <= 0 ||
    naturalW <= 0 ||
    naturalH <= 0 ||
    !Number.isFinite(containerW) ||
    !Number.isFinite(containerH) ||
    !Number.isFinite(naturalW) ||
    !Number.isFinite(naturalH)
  ) {
    return { x: 0, y: 0, width: Math.max(0, containerW), height: Math.max(0, containerH) };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  const x = (containerW - width) / 2;
  const y = (containerH - height) / 2;
  return { x, y, width, height };
}

/**
 * Maps a normalized region on the bitmap into percentages of the layout container
 * (so overlays align under `object-contain` letterboxing).
 */
export function mapNormalizedRegionToContainerPercent(
  region: NormalizedAnchorRegion,
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number
): { left: string; top: string; width: string; height: string } {
  const display = objectContainDisplayRect(containerW, containerH, naturalW, naturalH);

  const rx = clamp01(region.x);
  const ry = clamp01(region.y);
  const rw = clampRegionSize(region.width, rx);
  const rh = clampRegionSize(region.height, ry);

  const boxLeft = display.x + rx * display.width;
  const boxTop = display.y + ry * display.height;
  const boxW = rw * display.width;
  const boxH = rh * display.height;

  if (containerW <= 0 || containerH <= 0) {
    return { left: '0%', top: '0%', width: '0%', height: '0%' };
  }

  return {
    left: `${(boxLeft / containerW) * 100}%`,
    top: `${(boxTop / containerH) * 100}%`,
    width: `${(boxW / containerW) * 100}%`,
    height: `${(boxH / containerH) * 100}%`,
  };
}

/**
 * Maps a normalized region onto the ACTUAL rendered `<img>` rectangle (given
 * relative to the positioning container), then expresses the result as
 * percentages of that container.
 *
 * This is more robust than `mapNormalizedRegionToContainerPercent`, which
 * assumes the image fills the container under `object-contain`. That
 * assumption breaks in layouts where the image is centered at an intrinsic
 * width inside a wider/taller container (e.g. the desktop compact critique
 * column), causing the overlay to drift. Measuring the image rect directly
 * keeps the highlight aligned in every layout. Any residual `object-contain`
 * letterboxing *within* the image element is still handled, because we run the
 * contain math against the image rect's own dimensions.
 */
export function mapNormalizedRegionToImageRectPercent(
  region: NormalizedAnchorRegion,
  container: { width: number; height: number },
  imageRect: { left: number; top: number; width: number; height: number },
  naturalW: number,
  naturalH: number
): { left: string; top: string; width: string; height: string } {
  if (container.width <= 0 || container.height <= 0) {
    return { left: '0%', top: '0%', width: '0%', height: '0%' };
  }

  const display = objectContainDisplayRect(imageRect.width, imageRect.height, naturalW, naturalH);

  const rx = clamp01(region.x);
  const ry = clamp01(region.y);
  const rw = clampRegionSize(region.width, rx);
  const rh = clampRegionSize(region.height, ry);

  const boxLeft = imageRect.left + display.x + rx * display.width;
  const boxTop = imageRect.top + display.y + ry * display.height;
  const boxW = rw * display.width;
  const boxH = rh * display.height;

  return {
    left: `${(boxLeft / container.width) * 100}%`,
    top: `${(boxTop / container.height) * 100}%`,
    width: `${(boxW / container.width) * 100}%`,
    height: `${(boxH / container.height) * 100}%`,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clampRegionSize(size: number, start: number): number {
  if (!Number.isFinite(size)) return 0;
  return Math.min(Math.max(0, size), Math.max(0, 1 - start));
}

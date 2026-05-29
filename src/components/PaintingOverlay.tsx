import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { CriterionAnchor } from '../../shared/critiqueAnchors';
import { mapNormalizedRegionToImageRectPercent } from '../anchorOverlayLayout';

type Layout = {
  containerW: number;
  containerH: number;
  /** Rendered <img> rect, relative to the positioning container. */
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
  naturalW: number;
  naturalH: number;
};

type Props = {
  anchor: CriterionAnchor;
  /** The same wrapper that contains the `object-contain` image as direct child. */
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * Stage lighting on the approximate anchor region: vignette + soft glow.
 * Positions the highlight using the same math as `object-fit: contain` letterboxing.
 */
export function PaintingOverlay({ anchor, containerRef }: Props) {
  const layoutRef = useRef<Layout | null>(null);
  const [, bump] = useState(0);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const img = root.querySelector('img');
    if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
      layoutRef.current = null;
      bump((n: number) => n + 1);
      return;
    }
    const r = root.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || imgRect.width <= 0 || imgRect.height <= 0) return;
    layoutRef.current = {
      containerW: r.width,
      containerH: r.height,
      // Measure the actual rendered image box relative to the container so the
      // overlay stays aligned even when the image does not fill the container
      // (e.g. centered at intrinsic width in the desktop compact layout).
      imageLeft: imgRect.left - r.left,
      imageTop: imgRect.top - r.top,
      imageWidth: imgRect.width,
      imageHeight: imgRect.height,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    };
    bump((n: number) => n + 1);
  }, [containerRef]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    const img = root?.querySelector('img');
    img?.addEventListener('load', measure);
    if (typeof ResizeObserver !== 'undefined' && root) {
      const ro = new ResizeObserver(() => measure());
      ro.observe(root);
      return () => {
        ro.disconnect();
        img?.removeEventListener('load', measure);
      };
    }
    return () => img?.removeEventListener('load', measure);
  }, [containerRef, measure, anchor.region.x, anchor.region.y, anchor.region.width, anchor.region.height]);

  const layout = layoutRef.current;
  const coords =
    layout &&
    mapNormalizedRegionToImageRectPercent(
      anchor.region,
      { width: layout.containerW, height: layout.containerH },
      {
        left: layout.imageLeft,
        top: layout.imageTop,
        width: layout.imageWidth,
        height: layout.imageHeight,
      },
      layout.naturalW,
      layout.naturalH
    );

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className={`anchor-stage-vignette absolute inset-0 ${coords ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      />
      {coords ? (
        <div
          className="anchor-stage-spot absolute box-border rounded-2xl border border-white/40 anchor-stage-glow"
          style={{
            left: coords.left,
            top: coords.top,
            width: coords.width,
            height: coords.height,
          }}
        />
      ) : null}
    </div>
  );
}

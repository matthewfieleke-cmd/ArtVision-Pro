import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { CropPreset, PixelCrop } from '../imageUtils';
import { cropDataUrl } from '../imageUtils';

type Props = {
  imageSrc: string;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (croppedImage: string) => void | Promise<void>;
};

const PRESETS: Array<{ id: CropPreset; label: string; aspect: number }> = [
  { id: 'portrait', label: 'Portrait', aspect: 3 / 4 },
  { id: 'landscape', label: 'Landscape', aspect: 4 / 3 },
];

function maxCenteredAspectCrop(nw: number, nh: number, aspectWidthOverHeight: number): PixelCrop {
  const imageRatio = nw / nh;
  let cw: number;
  let ch: number;
  if (imageRatio > aspectWidthOverHeight) {
    ch = nh;
    cw = nh * aspectWidthOverHeight;
  } else {
    cw = nw;
    ch = nw / aspectWidthOverHeight;
  }
  return {
    x: (nw - cw) / 2,
    y: (nh - ch) / 2,
    width: cw,
    height: ch,
  };
}

function clampCrop(c: PixelCrop, nw: number, nh: number, minSide: number): PixelCrop {
  let { x, y, width, height } = c;
  width = Math.max(minSide, Math.min(width, nw));
  height = Math.max(minSide, Math.min(height, nh));
  x = Math.max(0, Math.min(x, nw - width));
  y = Math.max(0, Math.min(y, nh - height));
  return { x, y, width, height };
}

type DragKind =
  | { kind: 'move'; startX: number; startY: number; crop: PixelCrop }
  | { kind: 'edge'; edge: 'n' | 's' | 'e' | 'w'; startX: number; startY: number; crop: PixelCrop }
  | { kind: 'corner'; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; crop: PixelCrop };

function layoutImageInStage(
  stageW: number,
  stageH: number,
  nw: number,
  nh: number
): { scale: number; offX: number; offY: number; dispW: number; dispH: number } {
  if (stageW <= 0 || stageH <= 0 || nw <= 0 || nh <= 0) {
    return { scale: 1, offX: 0, offY: 0, dispW: nw, dispH: nh };
  }
  const scale = Math.min(stageW / nw, stageH / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offX = (stageW - dispW) / 2;
  const offY = (stageH - dispH) / 2;
  return { scale, offX, offY, dispW, dispH };
}

export function ImageCropModal({
  imageSrc,
  title = 'Frame the painting before critique',
  description = 'Choose portrait or landscape to start, then drag any edge or corner to adjust the crop. Use photo when you are ready to analyze.',
  onCancel,
  onConfirm,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [preset, setPreset] = useState<CropPreset>('portrait');
  const [cropRect, setCropRect] = useState<PixelCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [busy, setBusy] = useState(false);
  type ActiveDrag = DragKind & { pointerId: number };
  const dragRef = useRef<ActiveDrag | null>(null);
  const applyDragRef = useRef<(clientX: number, clientY: number) => void>(() => {});

  const windowListenersRef = useRef({
    move: (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      applyDragRef.current(e.clientX, e.clientY);
    },
    up: (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      window.removeEventListener('pointermove', windowListenersRef.current.move);
      window.removeEventListener('pointerup', windowListenersRef.current.up);
      window.removeEventListener('pointercancel', windowListenersRef.current.up);
    },
  });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNatural({ w: 0, h: 0 });
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setStageSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const minSide = useMemo(() => {
    const m = Math.min(natural.w, natural.h);
    return Math.max(32, Math.floor(m * 0.04));
  }, [natural.w, natural.h]);

  const applyPreset = useCallback(
    (p: CropPreset) => {
      if (natural.w <= 0 || natural.h <= 0) return;
      const aspect = PRESETS.find((e) => e.id === p)?.aspect ?? 3 / 4;
      const next = maxCenteredAspectCrop(natural.w, natural.h, aspect);
      setCropRect(clampCrop(next, natural.w, natural.h, minSide));
    },
    [natural.w, natural.h, minSide]
  );

  useEffect(() => {
    if (natural.w > 0 && natural.h > 0) {
      applyPreset(preset);
    }
  }, [natural.w, natural.h, preset, applyPreset]);

  const layout = useMemo(
    () => layoutImageInStage(stageSize.w, stageSize.h, natural.w, natural.h),
    [stageSize.w, stageSize.h, natural.w, natural.h]
  );

  const screenRect = useMemo(() => {
    const { scale, offX, offY } = layout;
    return {
      left: offX + cropRect.x * scale,
      top: offY + cropRect.y * scale,
      width: cropRect.width * scale,
      height: cropRect.height * scale,
    };
  }, [layout, cropRect]);

  const clientToImageDelta = useCallback(
    (clientDx: number, clientDy: number) => {
      const s = layout.scale;
      if (s <= 0) return { dx: 0, dy: 0 };
      return { dx: clientDx / s, dy: clientDy / s };
    },
    [layout.scale]
  );

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d || natural.w <= 0 || natural.h <= 0) return;
      const { dx, dy } = clientToImageDelta(clientX - d.startX, clientY - d.startY);
      const start = d.crop;
      let next: PixelCrop;

      if (d.kind === 'move') {
        next = {
          x: start.x + dx,
          y: start.y + dy,
          width: start.width,
          height: start.height,
        };
      } else if (d.kind === 'edge') {
        switch (d.edge) {
          case 'n':
            next = {
              x: start.x,
              y: start.y + dy,
              width: start.width,
              height: start.height - dy,
            };
            break;
          case 's':
            next = {
              x: start.x,
              y: start.y,
              width: start.width,
              height: start.height + dy,
            };
            break;
          case 'w':
            next = {
              x: start.x + dx,
              y: start.y,
              width: start.width - dx,
              height: start.height,
            };
            break;
          case 'e':
            next = {
              x: start.x,
              y: start.y,
              width: start.width + dx,
              height: start.height,
            };
            break;
        }
      } else {
        switch (d.corner) {
          case 'nw':
            next = {
              x: start.x + dx,
              y: start.y + dy,
              width: start.width - dx,
              height: start.height - dy,
            };
            break;
          case 'ne':
            next = {
              x: start.x,
              y: start.y + dy,
              width: start.width + dx,
              height: start.height - dy,
            };
            break;
          case 'sw':
            next = {
              x: start.x + dx,
              y: start.y,
              width: start.width - dx,
              height: start.height + dy,
            };
            break;
          case 'se':
            next = {
              x: start.x,
              y: start.y,
              width: start.width + dx,
              height: start.height + dy,
            };
            break;
        }
      }

      setCropRect(clampCrop(next, natural.w, natural.h, minSide));
    },
    [clientToImageDelta, natural.w, natural.h, minSide]
  );

  applyDragRef.current = applyDrag;

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', windowListenersRef.current.move);
      window.removeEventListener('pointerup', windowListenersRef.current.up);
      window.removeEventListener('pointercancel', windowListenersRef.current.up);
      dragRef.current = null;
    },
    []
  );

  const beginDrag = useCallback((kind: DragKind, e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { ...kind, pointerId: e.pointerId };
    window.addEventListener('pointermove', windowListenersRef.current.move);
    window.addEventListener('pointerup', windowListenersRef.current.up);
    window.addEventListener('pointercancel', windowListenersRef.current.up);
  }, []);

  const onCropAreaPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).dataset.handle) return;
      beginDrag(
        {
          kind: 'move',
          startX: e.clientX,
          startY: e.clientY,
          crop: { ...cropRect },
        },
        e
      );
    },
    [beginDrag, cropRect]
  );

  const confirmCrop = useCallback(async () => {
    if (natural.w <= 0 || natural.h <= 0) return;
    setBusy(true);
    try {
      const rounded: PixelCrop = {
        x: Math.round(cropRect.x),
        y: Math.round(cropRect.y),
        width: Math.round(cropRect.width),
        height: Math.round(cropRect.height),
      };
      const cropped = await cropDataUrl(imageSrc, rounded);
      await onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }, [cropRect, imageSrc, natural.w, natural.h, onConfirm]);

  const ready = natural.w > 0 && natural.h > 0;

  const handleThickness = 20;
  const cornerSize = 28;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-photo-title"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Crop photo</p>
          <h2 id="crop-photo-title" className="mt-1 font-display text-lg font-normal text-white">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          aria-label="Close crop editor"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          <p className="text-sm leading-relaxed text-slate-300">{description}</p>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
            {PRESETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setPreset(entry.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  preset === entry.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (natural.w > 0 && natural.h > 0) {
                  setCropRect(clampCrop({ x: 0, y: 0, width: natural.w, height: natural.h }, natural.w, natural.h, minSide));
                }
              }}
              disabled={!ready}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              Full frame
            </button>
          </div>

          <div
            ref={stageRef}
            className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
          >
            {ready ? (
              <>
                <img
                  src={imageSrc}
                  alt=""
                  className="pointer-events-none absolute select-none"
                  draggable={false}
                  style={{
                    left: layout.offX,
                    top: layout.offY,
                    width: layout.dispW,
                    height: layout.dispH,
                  }}
                />
                {/* Dim outside crop */}
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute bg-slate-950/65"
                    style={{
                      left: 0,
                      right: 0,
                      top: 0,
                      height: `${screenRect.top}px`,
                    }}
                  />
                  <div
                    className="absolute bg-slate-950/65"
                    style={{
                      left: 0,
                      width: `${screenRect.left}px`,
                      top: `${screenRect.top}px`,
                      height: `${screenRect.height}px`,
                    }}
                  />
                  <div
                    className="absolute bg-slate-950/65"
                    style={{
                      left: `${screenRect.left + screenRect.width}px`,
                      right: 0,
                      top: `${screenRect.top}px`,
                      height: `${screenRect.height}px`,
                    }}
                  />
                  <div
                    className="absolute bg-slate-950/65"
                    style={{
                      left: 0,
                      right: 0,
                      top: `${screenRect.top + screenRect.height}px`,
                      bottom: 0,
                    }}
                  />
                </div>
                {/* Crop box + move area */}
                <div
                  className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                  style={{
                    left: `${screenRect.left}px`,
                    top: `${screenRect.top}px`,
                    width: `${screenRect.width}px`,
                    height: `${screenRect.height}px`,
                  }}
                  onPointerDown={onCropAreaPointerDown}
                >
                  {/* Edge handles */}
                  <button
                    type="button"
                    data-handle="n"
                    aria-label="Resize top edge"
                    className="absolute left-0 right-0 top-0 z-10 -translate-y-1/2 cursor-ns-resize touch-none border-0 bg-transparent p-0"
                    style={{ height: handleThickness }}
                    onPointerDown={(e) =>
                      beginDrag(
                        { kind: 'edge', edge: 'n', startX: e.clientX, startY: e.clientY, crop: { ...cropRect } },
                        e
                      )
                    }
                  />
                  <button
                    type="button"
                    data-handle="s"
                    aria-label="Resize bottom edge"
                    className="absolute bottom-0 left-0 right-0 z-10 translate-y-1/2 cursor-ns-resize touch-none border-0 bg-transparent p-0"
                    style={{ height: handleThickness }}
                    onPointerDown={(e) =>
                      beginDrag(
                        { kind: 'edge', edge: 's', startX: e.clientX, startY: e.clientY, crop: { ...cropRect } },
                        e
                      )
                    }
                  />
                  <button
                    type="button"
                    data-handle="w"
                    aria-label="Resize left edge"
                    className="absolute bottom-0 left-0 top-0 z-10 -translate-x-1/2 cursor-ew-resize touch-none border-0 bg-transparent p-0"
                    style={{ width: handleThickness }}
                    onPointerDown={(e) =>
                      beginDrag(
                        { kind: 'edge', edge: 'w', startX: e.clientX, startY: e.clientY, crop: { ...cropRect } },
                        e
                      )
                    }
                  />
                  <button
                    type="button"
                    data-handle="e"
                    aria-label="Resize right edge"
                    className="absolute bottom-0 right-0 top-0 z-10 translate-x-1/2 cursor-ew-resize touch-none border-0 bg-transparent p-0"
                    style={{ width: handleThickness }}
                    onPointerDown={(e) =>
                      beginDrag(
                        { kind: 'edge', edge: 'e', startX: e.clientX, startY: e.clientY, crop: { ...cropRect } },
                        e
                      )
                    }
                  />
                  {/* Corner handles */}
                  {(
                    [
                      ['nw', 'nwse-resize', -1, -1],
                      ['ne', 'nesw-resize', 1, -1],
                      ['sw', 'nesw-resize', -1, 1],
                      ['se', 'nwse-resize', 1, 1],
                    ] as const
                  ).map(([corner, cursor, sx, sy]) => (
                    <button
                      key={corner}
                      type="button"
                      data-handle={corner}
                      aria-label={`Resize ${corner} corner`}
                      className="absolute z-20 touch-none rounded-sm border-2 border-white bg-violet-600 shadow-md"
                      style={{
                        width: cornerSize,
                        height: cornerSize,
                        left: sx < 0 ? -cornerSize / 2 : 'auto',
                        right: sx > 0 ? -cornerSize / 2 : 'auto',
                        top: sy < 0 ? -cornerSize / 2 : 'auto',
                        bottom: sy > 0 ? -cornerSize / 2 : 'auto',
                        cursor,
                      }}
                      onPointerDown={(e) =>
                        beginDrag(
                          {
                            kind: 'corner',
                            corner,
                            startX: e.clientX,
                            startY: e.clientY,
                            crop: { ...cropRect },
                          },
                          e
                        )
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading image…</div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-3">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmCrop()}
            disabled={busy || !ready}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {busy ? 'Working…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

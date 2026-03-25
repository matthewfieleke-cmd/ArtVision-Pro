import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Check, Crop, Move, RotateCcw, Sparkles, SquareDashedBottom, Undo2, X } from 'lucide-react';
import type { CropPreset, PerspectiveCorners, Point } from '../imageUtils';
import { cropDataUrlWithRotation, perspectiveCropDataUrl, suggestPaintingCrop } from '../imageUtils';

type Props = {
  imageSrc: string;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (croppedImage: string) => void | Promise<void>;
};

const PRESETS: Array<{ id: CropPreset; label: string; aspect?: number }> = [
  { id: 'freeform', label: 'Freeform' },
  { id: 'portrait', label: 'Portrait', aspect: 3 / 4 },
  { id: 'square', label: 'Square', aspect: 1 },
  { id: 'landscape', label: 'Landscape', aspect: 4 / 3 },
];

export function ImageCropModal({
  imageSrc,
  title = 'Frame the painting before critique',
  description = 'Drag, zoom, rotate, or straighten the image to isolate the painted area. Use Auto frame to detect the painting, then fine-tune crop or perspective.',
  onCancel,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<CropPreset>('portrait');
  const [detecting, setDetecting] = useState(true);
  const [imageForEditing, setImageForEditing] = useState(imageSrc);
  const [autoStraightened, setAutoStraightened] = useState(false);
  const [corners, setCorners] = useState<PerspectiveCorners | null>(null);
  const [cornersDraft, setCornersDraft] = useState<PerspectiveCorners | null>(null);
  const [mode, setMode] = useState<'crop' | 'perspective'>('crop');
  const stageRef = useRef<HTMLDivElement | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const aspect = useMemo(
    () => PRESETS.find((entry) => entry.id === preset)?.aspect,
    [preset]
  );

  const normalizedCorners = useMemo(() => cornersDraft ?? corners, [corners, cornersDraft]);

  useEffect(() => {
    let cancelled = false;
    setDetecting(true);
    setImageForEditing(imageSrc);
    setAutoStraightened(false);
    void suggestPaintingCrop(imageSrc)
      .then(async (suggestion) => {
        if (cancelled) return;
        setCorners(suggestion.corners);
        setCornersDraft(suggestion.corners);
        setRotation(suggestion.rotation);
        if (suggestion.confidence !== 'low') {
          try {
            const corrected = await perspectiveCropDataUrl(imageSrc, suggestion.corners);
            if (cancelled) return;
            setImageForEditing(corrected);
            setCorners(null);
            setCornersDraft(null);
            setAutoStraightened(true);
          } catch {
            /* keep original if rectification fails */
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRotation(0);
          setCorners(null);
          setCornersDraft(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const confirmCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const cropped = await cropDataUrlWithRotation(imageForEditing, croppedAreaPixels, rotation);
      await onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }, [croppedAreaPixels, imageForEditing, onConfirm, rotation]);

  const applyPerspectiveCorrection = useCallback(async () => {
    if (!normalizedCorners) {
      setMode('crop');
      return;
    }
    setBusy(true);
    try {
      const corrected = await perspectiveCropDataUrl(imageSrc, normalizedCorners);
      setImageForEditing(corrected);
      setCorners(null);
      setCornersDraft(null);
      setAutoStraightened(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setMode('crop');
    } finally {
      setBusy(false);
    }
  }, [imageSrc, normalizedCorners]);

  const nudgeCorner = useCallback((cornerIndex: number, dx: number, dy: number) => {
    setCornersDraft((current: PerspectiveCorners | null) => {
      const base = current ?? corners;
      if (!base) return current;
      const next = [...base] as PerspectiveCorners;
      next[cornerIndex] = {
        x: Math.min(1, Math.max(0, base[cornerIndex]!.x + dx)),
        y: Math.min(1, Math.max(0, base[cornerIndex]!.y + dy)),
      };
      return next;
    });
  }, [corners]);

  const startHandleDrag = useCallback(
    (cornerIndex: number, event: React.PointerEvent<HTMLButtonElement>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      event.preventDefault();
      const move = (clientX: number, clientY: number) => {
        setCornersDraft((current: PerspectiveCorners | null) => {
          const base = current ?? corners;
          if (!base) return current;
          const next = [...base] as PerspectiveCorners;
          next[cornerIndex] = {
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
          };
          return next;
        });
      };
      move(event.clientX, event.clientY);
      const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [corners]
  );

  const cornerStyle = useCallback(
    (cornerIndex: number) => {
      const active = normalizedCorners?.[cornerIndex];
      if (!active) return undefined;
      return {
        left: `${active.x * 100}%`,
        top: `${active.y * 100}%`,
      };
    },
    [normalizedCorners]
  );

  const polygonPoints = useMemo(() => {
    if (!normalizedCorners) return '';
    return normalizedCorners.map((corner: Point) => `${corner.x * 100}% ${corner.y * 100}%`).join(', ');
  }, [normalizedCorners]);

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
          <p className="text-sm leading-relaxed text-slate-300">
            {description}
          </p>

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
            {corners ? (
              <button
                type="button"
                onClick={() => setMode((current) => (current === 'crop' ? 'perspective' : 'crop'))}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  mode === 'perspective'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <SquareDashedBottom className="h-4 w-4" />
                Straighten
              </button>
            ) : null}
            {autoStraightened ? (
              <button
                type="button"
                onClick={() => {
                  setImageForEditing(imageSrc);
                  setAutoStraightened(false);
                  setMode(corners ? 'perspective' : 'crop');
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setRotation(0);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <Undo2 className="h-4 w-4" />
                Original
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setDetecting(true);
                void suggestPaintingCrop(imageSrc)
                  .then((suggestion) => {
                    setRotation(suggestion.rotation);
                    setCorners(suggestion.corners);
                    setCornersDraft(suggestion.corners);
                    setImageForEditing(imageSrc);
                    setAutoStraightened(false);
                    setZoom(1);
                    setCrop({ x: 0, y: 0 });
                    setMode(suggestion.confidence !== 'low' ? 'crop' : 'perspective');
                  })
                  .finally(() => setDetecting(false));
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4 text-violet-300" />
              {detecting ? 'Framing…' : 'Auto frame'}
            </button>
          </div>

          <div
            ref={stageRef}
            className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
          >
            {mode === 'crop' ? (
              <Cropper
                image={imageForEditing}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                cropShape="rect"
                objectFit="contain"
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
              />
            ) : (
              <>
                <img
                  src={imageSrc}
                  alt=""
                  className="h-full w-full object-contain"
                  draggable={false}
                />
                {polygonPoints ? (
                  <div
                    className="pointer-events-none absolute inset-0 bg-violet-400/15"
                    style={{ clipPath: `polygon(${polygonPoints})` }}
                  />
                ) : null}
                {(['Top left', 'Top right', 'Bottom right', 'Bottom left'] as const).map((label, cornerIndex) => (
                  <button
                    key={label}
                    type="button"
                    onPointerDown={(event) => startHandleDrag(cornerIndex, event)}
                    className="absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 shadow-lg"
                    style={cornerStyle(cornerIndex)}
                    aria-label={`Move ${label} perspective handle`}
                  />
                ))}
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs leading-relaxed text-slate-200 backdrop-blur-sm">
                  Drag the corner handles to match the painting edges, then tap <strong>Apply straighten</strong>.
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="crop-zoom" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Zoom
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                  <Crop className="h-3.5 w-3.5" />
                  {PRESETS.find((entry) => entry.id === preset)?.label ?? 'Freeform'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                    setRotation(0);
                    setImageForEditing(imageSrc);
                    setAutoStraightened(false);
                    setCornersDraft(corners);
                    setMode(corners ? 'perspective' : 'crop');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
            {mode === 'crop' ? (
              <>
                <input
                  id="crop-zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
                />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label htmlFor="crop-rotation" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rotation
                  </label>
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Straighten
                  </button>
                </div>
                <input
                  id="crop-rotation"
                  type="range"
                  min={-15}
                  max={15}
                  step={0.1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
                />
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['Top left', 'Top right', 'Bottom right', 'Bottom left'] as const).map((label, index) => (
                  <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => nudgeCorner(index as 0 | 1 | 2 | 3, -0.01, 0)}
                        className="flex-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeCorner(index as 0 | 1 | 2 | 3, 0.01, 0)}
                        className="flex-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeCorner(index as 0 | 1 | 2 | 3, 0, -0.01)}
                        className="flex-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeCorner(index as 0 | 1 | 2 | 3, 0, 0.01)}
                        className="flex-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
            Use original
          </button>
          {mode === 'crop' ? (
            <button
              type="button"
              onClick={() => void confirmCrop()}
              disabled={busy || !croppedAreaPixels}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {busy ? 'Cropping…' : 'Use crop'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void applyPerspectiveCorrection()}
              disabled={busy || !normalizedCorners}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition disabled:opacity-50"
            >
              <Move className="h-4 w-4" />
              {busy ? 'Straightening…' : 'Apply straighten'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

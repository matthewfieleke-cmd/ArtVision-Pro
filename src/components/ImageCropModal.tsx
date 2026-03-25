import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Check, Crop, RotateCcw, X } from 'lucide-react';
import { cropDataUrl } from '../imageUtils';

type Props = {
  imageSrc: string;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (croppedImage: string) => void | Promise<void>;
};

export function ImageCropModal({
  imageSrc,
  title = 'Frame the painting before critique',
  description = 'Drag and zoom to isolate the painted area. Use Freeform for unusual proportions or Locked for a portrait-style frame.',
  onCancel,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedAspect, setLockedAspect] = useState(true);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const confirmCrop = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const cropped = await cropDataUrl(imageSrc, croppedAreaPixels);
      await onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }, [croppedAreaPixels, imageSrc, onConfirm]);

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

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-1">
            <button
              type="button"
              onClick={() => setLockedAspect(true)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                lockedAspect ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Locked
            </button>
            <button
              type="button"
              onClick={() => setLockedAspect(false)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                !lockedAspect ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Freeform
            </button>
          </div>

          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={lockedAspect ? 3 / 4 : undefined}
              cropShape="rect"
              objectFit="contain"
              showGrid={true}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="crop-zoom" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Zoom
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                  <Crop className="h-3.5 w-3.5" />
                  {lockedAspect ? '3:4 frame' : 'Freeform'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
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
          <button
            type="button"
            onClick={() => void confirmCrop()}
            disabled={busy || !croppedAreaPixels}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {busy ? 'Cropping…' : 'Use crop'}
          </button>
        </div>
      </div>
    </div>
  );
}

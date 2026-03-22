import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'requesting' | 'live' | 'error';

export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('Camera API not available. Use upload instead.');
      return;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setStatus('live');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not access camera');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  return { videoRef, status, error, start, stop, captureFrame };
}

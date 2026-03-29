/** Same-origin paths under `public/art/` — avoids Wikimedia hotlink blocks on mobile. */
export function artImage(filename: string): string {
  const meta = import.meta as ImportMeta & {
    env?: {
      BASE_URL?: string;
    };
  };
  const base = typeof meta.env?.BASE_URL === 'string' ? meta.env.BASE_URL : '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}art/${filename}`;
}

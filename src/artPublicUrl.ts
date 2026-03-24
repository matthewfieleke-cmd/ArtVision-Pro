/** Same-origin paths under `public/art/` — avoids Wikimedia hotlink blocks on mobile. */
export function artImage(filename: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}art/${filename}`;
}

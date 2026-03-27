import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  resizeEditOutputToMatchUpload,
  scaleGeometryToActualCanvas,
  type ApiInputGeometry,
} from '../lib/previewImageResize.js';

function geom(partial: Partial<ApiInputGeometry> & Pick<ApiInputGeometry, 'canvasWidth' | 'canvasHeight'>): ApiInputGeometry {
  return {
    innerWidth: partial.innerWidth ?? partial.canvasWidth,
    innerHeight: partial.innerHeight ?? partial.canvasHeight,
    offsetX: partial.offsetX ?? 0,
    offsetY: partial.offsetY ?? 0,
    ...partial,
  };
}

function testScaleGeometryToActualCanvas(): void {
  const g = geom({
    canvasWidth: 1024,
    canvasHeight: 1024,
    innerWidth: 800,
    innerHeight: 900,
    offsetX: 112,
    offsetY: 62,
  });
  const r = scaleGeometryToActualCanvas(g, 1025, 1026);
  assert.ok(Math.abs(r.left - 112) <= 2);
  assert.ok(Math.abs(r.top - 62) <= 2);
  assert.ok(r.width > 0 && r.height > 0);
  assert.ok(r.left + r.width <= 1025);
  assert.ok(r.top + r.height <= 1026);
}

async function testTrimRemovesBottomWhiteBar(): Promise<void> {
  const w = 80;
  const hArt = 72;
  const hBar = 8;
  const art = await sharp({
    create: { width: w, height: hArt, channels: 3, background: { r: 90, g: 120, b: 70 } },
  })
    .png()
    .toBuffer();
  const edited = await sharp({
    create: {
      width: w,
      height: hArt + hBar,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: art, left: 0, top: 0 }])
    .png()
    .toBuffer();

  const full: ApiInputGeometry = {
    canvasWidth: w,
    canvasHeight: hArt + hBar,
    innerWidth: w,
    innerHeight: hArt + hBar,
    offsetX: 0,
    offsetY: 0,
  };

  const targetH = hArt + hBar;
  const { buffer: out } = await resizeEditOutputToMatchUpload(edited, w, targetH, 'image/png', full);
  const { width: ow, height: oh } = await sharp(out).metadata();
  assert.equal(ow, w);
  assert.equal(oh, targetH);
  const bottomRow = await sharp(out)
    .extract({ left: 0, top: targetH - 1, width: w, height: 1 })
    .raw()
    .toBuffer();
  const g = bottomRow[1]!;
  assert.ok(g < 250, 'expected bottom row to be painting pixels after trim, not white');
}

export async function runPreviewResizeTests(): Promise<void> {
  testScaleGeometryToActualCanvas();
  await testTrimRemovesBottomWhiteBar();
}

async function main(): Promise<void> {
  await runPreviewResizeTests();
  console.log('Preview resize tests passed.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) void main();

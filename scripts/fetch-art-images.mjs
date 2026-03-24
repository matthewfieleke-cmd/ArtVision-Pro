/**
 * Download PD-art images via Commons Special:Redirect (stable; avoids broken thumb paths).
 * Writes to public/art/ for same-origin serving (fixes mobile Wikimedia hotlink blocks).
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'art');

/** [local filename, exact Commons file name including extension] */
const IMAGES = [
  ['courbet-burial-ornans.jpg', 'Gustave_Courbet_-_A_Burial_at_Ornans_-_Google_Art_Project.jpg'],
  ['courbet-stonebreakers.jpg', 'Gustave Courbet - The Stonebreakers - WGA05457.jpg'],
  [
    'daumier-third-class-carriage.jpg',
    'Honoré Daumier (French, Marseilles 1808–1879 Valmondois) - The Third-Class Carriage - Google Art Project.jpg',
  ],
  ['millet-gleaners.jpg', 'Jean-François_Millet_-_Gleaners_-_Google_Art_Project_2.jpg'],
  ['repin-barge-haulers.jpg', 'Ilya_Repin_-_Barge_Haulers_on_the_Volga_-_Google_Art_Project.jpg'],
  ['homer-gulf-stream.jpg', 'Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg'],
  ['eakins-wrestlers.jpg', 'Eakins,_Thomas_-_Wrestlers_1899.jpg'],
  ['monet-impression-sunrise.jpg', 'Monet_-_Impression,_Sunrise.jpg'],
  ['renoir-moulin-galette.jpg', 'Pierre-Auguste_Renoir,_Le_Moulin_de_la_Galette.jpg'],
  ['degas-ballet-class.jpg', 'Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg'],
  ['pissarro-boulevard-montmartre.jpg', 'Camille_Pissarro_-_Boulevard_Montmartre,_Spring_-_Google_Art_Project.jpg'],
  ['morisot-cradle.jpg', 'Berthe_Morisot_-_The_Cradle_-_Google_Art_Project.jpg'],
  ['cassatt-childs-bath.jpg', "Mary_Cassatt_-_The_Child's_Bath_-_Google_Art_Project.jpg"],
  [
    'munch-scream.jpg',
    'Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg',
  ],
  ['kandinsky-composition-vii.jpg', 'Composition VII - Wassily Kandinsky, GAC.jpg'],
  ['schiele-self-portrait-physalis.jpg', 'Egon_Schiele_-_Self-Portrait_with_Physalis_-_Google_Art_Project.jpg'],
  ['kirchner-street-berlin.jpg', 'Ernst Ludwig Kirchner - Berlin Street Scene - Google Art Project.jpg'],
  [
    'nolde-prophet.jpg',
    'Emil Nolde (1867-1956) - Clematis and Dahlia (1940) - Oil on canvas - National Gallery of Denmark.jpg',
  ],
  [
    'modersohn-becker-self-portrait-veil.jpg',
    'Paula_Modersohn-Becker_-_Self-portrait_with_hat_and_veil_-_Google_Art_Project.jpg',
  ],
  ['kandinsky-yellow-red-blue.jpg', 'Gelb-Rot-Blau, by Wassily Kandinsky.jpg'],
  [
    'mondrian-composition-ii.jpg',
    'Piet_Mondriaan,_1930_-_Mondrian_Composition_II_in_Red,_Blue,_and_Yellow.jpg',
  ],
  ['malevich-black-square.jpg', 'Black_Square.jpg'],
  [
    'malevich-white-on-white.jpg',
    "Kazimir Malevich - 'Suprematist Composition- White on White', oil on canvas, 1918, Museum of Modern Art.jpg",
  ],
  ['miro-1938-detail.jpg', 'JOAN_MIRO_PAINTING_1938_DETAIL.jpg'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function redirectUrl(fileName) {
  const q = new URLSearchParams();
  q.set('title', `Special:Redirect/file/${fileName}`);
  q.set('width', '1024');
  return `https://commons.wikimedia.org/w/index.php?${q.toString()}`;
}

async function fileReady(path) {
  try {
    const s = await stat(path);
    return s.size > 5000;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let ok = 0;
  let skipped = 0;
  const ua =
    'ArtVision-Pro/1.0 (educational art PWA; https://github.com/matthewfieleke-cmd/ArtVision-Pro)';

  for (const [name, fileName] of IMAGES) {
    const dest = join(OUT_DIR, name);
    if (await fileReady(dest)) {
      skipped++;
      continue;
    }

    const url = redirectUrl(fileName);
    await sleep(700);

    let res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': ua },
    });

    if (res.status === 429) {
      console.warn(`429 ${name}, waiting 18s…`);
      await sleep(18000);
      res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': ua } });
    }

    if (!res.ok) {
      console.error(`FAIL ${name}: HTTP ${res.status} (${fileName})`);
      process.exitCode = 1;
      continue;
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('image')) {
      console.error(`FAIL ${name}: not an image (${ct})`);
      process.exitCode = 1;
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) {
      console.error(`FAIL ${name}: too small (${buf.length})`);
      process.exitCode = 1;
      continue;
    }

    await writeFile(dest, buf);
    ok++;
    console.log(`Wrote public/art/${name} (${Math.round(buf.length / 1024)} KB)`);
  }

  console.log(`Art images: ${ok} downloaded, ${skipped} skipped (${IMAGES.length} total).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

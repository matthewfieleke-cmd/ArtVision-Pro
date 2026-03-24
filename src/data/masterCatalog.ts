import { artImage } from '../artPublicUrl';
import type { Style } from '../types';

export type MasterFigure = {
  workTitle: string;
  year?: string;
  medium?: string;
  collection?: string;
  analysis: string;
  /** Wikimedia Commons or other embeddable URL; omit when only in-copyright reproductions exist */
  imageUrl?: string;
  imageAlt: string;
  credit: string;
  moreInfoUrl?: string;
};

export type MasterEntry = {
  slug: string;
  style: Style;
  displayName: string;
  /** One-line hook */
  tagline: string;
  intro: string;
  historicalPlacement: string;
  whyMaster: string[];
  figures: MasterFigure[];
  readings: { label: string; url: string }[];
};

function slugFor(style: Style, name: string): string {
  const s =
    style === 'Abstract Art'
      ? 'abstract-art'
      : style === 'Impressionism'
        ? 'impressionism'
        : style === 'Expressionism'
          ? 'expressionism'
          : 'realism';
  const n = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${s}-${n}`;
}

/** Master work JPEGs ship under public/art/ (same-origin; avoids Wikimedia hotlink blocks). */

/** Curated for educational use; images are PD-art or photographer CC where noted. */
export const MASTER_ENTRIES: MasterEntry[] = [
  {
    slug: slugFor('Realism', 'Gustave Courbet'),
    style: 'Realism',
    displayName: 'Gustave Courbet',
    tagline: 'Material fact, scale, and the politics of the visible',
    intro:
      'Gustave Courbet (1819–1877) positioned painting as a record of concrete experience—bodies, soil, stone, and weather—at a scale that rivaled history painting. His Realism is not photographic neutrality but a deliberate argument about what deserves monumental form.',
    historicalPlacement:
      'Emerging in mid-century France, Courbet’s work intersects with 1848-era social ferment and the Salon system’s hierarchies (history, genre, landscape). Scholars read his large canvases as interventions in who and what counts as a fit subject for serious art (see Linda Nochlin’s foundational essays on Realism and gendered labor).',
    whyMaster: [
      'Controls monumental scale and figure-ground relationships without relying on academic idealization.',
      'Builds form through weight, touch, and temperature shifts in pigment rather than linear contour alone.',
      'Uses composition to frame social meaning (who is centered, who labors, who looks back).',
    ],
    figures: [
      {
        workTitle: 'A Burial at Ornans',
        year: '1849–50',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        analysis:
          'The frieze-like arrangement of townspeople across a wide horizontal field collapses the traditional pyramidal heroics of history painting into a collective, secular ritual. Notice how faces and black clothing are built from restrained value steps: deep but differentiated blacks keep legibility at a distance (a core Realist value-structuring lesson). Earth and sky are handled with distinct temperature families—cool sky against warmer, dustier ground—so the human band reads as anchored, not pasted on backdrop.',
        imageUrl: artImage('courbet-burial-ornans.jpg'),
        imageAlt: 'Courbet, A Burial at Ornans',
        credit: 'Google Art Project / Musée d’Orsay; public domain (PD-old).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_A_Burial_at_Ornans_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'The Stone Breakers',
        year: '1849 (destroyed 1945)',
        medium: 'Oil on canvas',
        collection: 'Formerly Gemäldegalerie, Dresden',
        analysis:
          'Although the canvas was destroyed, reproductions remain essential pedagogically: Courbet places two laborers close to the picture plane, cropping them as if the viewer shares their footing. The lesson is tactile specificity—rough fabric, cracked stone, gritty pigment texture—used to insist on the dignity of anonymous work. Study high-resolution images for edge control: hard silhouette where the figures meet sky versus softer internal modeling along sleeves and cheeks.',
        imageUrl: artImage('courbet-stonebreakers.jpg'),
        imageAlt: 'Courbet, The Stone Breakers (reproduction)',
        credit: 'Web Gallery of Art reproduction; original destroyed 1945; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_The_Stonebreakers_-_WGA05457.jpg',
      },
    ],
    readings: [
      { label: 'Linda Nochlin, Realism (1971)', url: 'https://www.worldcat.org/search?q=au%3ANochlin+Realism' },
      { label: 'Michael Fried, Courbet’s Realism (1990)', url: 'https://www.worldcat.org/title/112877' },
    ],
  },
  {
    slug: slugFor('Realism', 'Jean-François Millet'),
    style: 'Realism',
    displayName: 'Jean-François Millet',
    tagline: 'Rural labor, gravity, and the epic in the everyday',
    intro:
      'Jean-François Millet (1814–1875) translated peasant life into compositions of almost classical gravity. His Realism fuses Barbizon attention to soil and weather with a moral seriousness about work and endurance.',
    historicalPlacement:
      'Barbizon-school landscape practice meets Second Empire debates about class and visibility. Millet’s gleaners and sower became cultural flashpoints—read in his time through anxieties about rural poverty and in ours through feminist and social histories of labor.',
    whyMaster: [
      'Unifies figure groups into pyramids and arcs that read from afar while retaining tactile surface incident.',
      'Balances sentiment and restraint: empathy without prettifying labor.',
      'Demonstrates how low horizon lines and sky mass can monumentalize ordinary tasks.',
    ],
    figures: [
      {
        workTitle: 'The Gleaners',
        year: '1857',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        analysis:
          'Three women bend in the foreground while harvest activity recedes in light-struck distance—a textbook study in depth through value and scale, not line. The backs and shoulders form a stable triangular mass; golden field notes are broken with violet-brown shadows to avoid sugary yellow. Compare edge strategies: firm silhouettes against sky versus softer transitions where bodies meet stubble.',
        imageUrl: artImage('millet-gleaners.jpg'),
        imageAlt: 'Millet, The Gleaners',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg',
      },
    ],
    readings: [
      { label: 'Alexandra Murphy, Jean-François Millet (exh. cat., Museum of Fine Arts, Boston)', url: 'https://www.worldcat.org/search?q=Millet+MFA+Boston+catalog' },
    ],
  },
  {
    slug: slugFor('Realism', 'Ilya Repin'),
    style: 'Realism',
    displayName: 'Ilya Repin',
    tagline: 'Narrative clarity, Russian Realism, and psychological portraiture',
    intro:
      'Ilya Repin (1844–1930) anchored the Peredvizhniki (Wanderers) movement. His Realism weds acute observation of social conditions with portraiture’s psychological acuity.',
    historicalPlacement:
      'Late imperial Russia’s modernization and political tension inform canvases that circulated beyond the Academy. Repin’s history scenes and types of rural and urban life remain central to eastern European museum pedagogy.',
    whyMaster: [
      'Sustains complex multi-figure narratives with readable focal hierarchies.',
      'Combines tight facial drawing with broad painterly passages in clothing and landscape.',
      'Uses directional light to stage moral and emotional emphasis without melodrama.',
    ],
    figures: [
      {
        workTitle: 'Barge Haulers on the Volga',
        year: '1870–73',
        medium: 'Oil on canvas',
        collection: 'State Russian Museum, Saint Petersburg',
        analysis:
          'The diagonal file of haulers pulls the eye along the river while the boy’s upright figure interrupts rhythm—an intentional compositional “hinge.” Skin and fabric are modeled with cool reflected light from water and warm top light, selling weight and exhaustion. Study how hands and ropes receive sharper edges than distant banks, keeping tactile priority where the story lives.',
        imageUrl: artImage('repin-barge-haulers.jpg'),
        imageAlt: 'Repin, Barge Haulers on the Volga',
        credit: 'Google Art Project; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Ilya_Repin_-_Barge_Haulers_on_the_Volga_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Elizabeth Valkenier, Russian Realist Art', url: 'https://www.worldcat.org/search?q=Valkenier+Russian+Realist' },
    ],
  },
  {
    slug: slugFor('Realism', 'Honoré Daumier'),
    style: 'Realism',
    displayName: 'Honoré Daumier',
    tagline: 'Graphic force, caricature, and the ethics of looking',
    intro:
      'Honoré Daumier (1808–1879) moved between lithography and paint, sharpening modern life into legible types. His Realism is inseparable from satire and speed of observation.',
    historicalPlacement:
      'July Monarchy and Second Empire Paris; print culture and censorship shaped his lithographic output. Paintings such as Third-Class Carriage translate that graphic shorthand into oil.',
    whyMaster: [
      'Economy of mark: few strokes imply posture, class, and mood.',
      'Masters chiaroscuro in confined interiors without losing readability.',
      'Bridges journalism and fine art—composition as social argument.',
    ],
    figures: [
      {
        workTitle: 'The Third-Class Carriage',
        year: 'c. 1862–64',
        medium: 'Oil on canvas',
        collection: 'Metropolitan Museum of Art, New York',
        analysis:
          'A shallow box of figures reads as class portrait: nursing mother, sleeping poor, alert observer. Light enters from one side, carving faces from shadow with printmaker-like contrast. Note how Daumier sacrifices detail on legs and luggage to keep faces and hands as emotional anchors—selective finish as narrative device.',
        imageUrl: artImage('daumier-third-class-carriage.jpg'),
        imageAlt: 'Daumier, The Third-Class Carriage',
        credit: 'Google Art Project / Met Museum; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Honor%C3%A9_Daumier_-_The_Third-Class_Carriage_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Bruce Laughton, Honoré Daumier (1996)', url: 'https://www.worldcat.org/search?q=Laughton+Daumier' },
    ],
  },
  {
    slug: slugFor('Realism', 'Winslow Homer'),
    style: 'Realism',
    displayName: 'Winslow Homer',
    tagline: 'American Realism, weather, and the moralized landscape',
    intro:
      'Winslow Homer (1836–1910) moved from illustration to oils and watercolor, crystallizing American Realism around sea, forest, and labor under extreme conditions.',
    historicalPlacement:
      'Post–Civil War United States; Homer’s marine pictures engage isolation, race, and survival in ways later critics tied to nation-building myth and its fractures.',
    whyMaster: [
      'Builds pictorial tension through weather, foam, and horizon geometry.',
      'Controls high-contrast light without losing atmospheric depth.',
      'Uses figure scale against nature to stage vulnerability and resolve.',
    ],
    figures: [
      {
        workTitle: 'The Gulf Stream',
        year: '1899',
        medium: 'Oil on canvas',
        collection: 'Metropolitan Museum of Art, New York',
        analysis:
          'A lone boat, sharks, and a waterspout compress narrative into design: warm planks and skin pop against cool, green-black water. Homer’s brush escalates from smooth distant swells to broken, directional strokes on foam—edge and texture teach where danger lives. The composition denies easy rescue; mastery here is withholding closure while keeping forms lucid.',
        imageUrl: artImage('homer-gulf-stream.jpg'),
        imageAlt: 'Homer, The Gulf Stream',
        credit: 'Metropolitan Museum of Art; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg',
      },
    ],
    readings: [
      { label: 'Randall C. Griffin, Winslow Homer: An American Vision', url: 'https://www.worldcat.org/search?q=Griffin+Winslow+Homer' },
    ],
  },
  {
    slug: slugFor('Realism', 'Thomas Eakins'),
    style: 'Realism',
    displayName: 'Thomas Eakins',
    tagline: 'American daylight, anatomy, and the ethics of exact seeing',
    intro:
      'Thomas Eakins (1844–1916) fused rigorous anatomy, photography-informed perspective, and unidealized American subjects. His Realism insists that moral seriousness lives in truthful measurement and light.',
    historicalPlacement:
      'Postbellum Philadelphia; teaching controversies at the Pennsylvania Academy underscored his commitment to the nude and dissection as artistic training. Scholars link him to emerging American art institutions and to early cinema’s fascination with motion.',
    whyMaster: [
      'Builds form through observed structure—bone, weight, and contact—without salon prettification.',
      'Controls outdoor and studio light so value explains volume and distance (rowing pictures, portraits).',
      'Uses composition to stage modern American bodies in measurable space.',
    ],
    figures: [
      {
        workTitle: 'Wrestlers',
        year: '1899',
        medium: 'Oil on canvas',
        collection: 'Los Angeles County Museum of Art',
        analysis:
          'Two grappling bodies lock in a shallow, stage-like space; limbs interlock with almost clinical clarity. Eakins models flesh with cool reflected light and warm highlights—value temperature does anatomical work. Study edge logic: sharp contour where limbs separate versus softer transitions along muscle cylinders.',
        imageUrl: artImage('eakins-wrestlers.jpg'),
        imageAlt: 'Eakins, Wrestlers',
        credit: 'Public domain (PD-old); Wikimedia Commons.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Eakins,_Thomas_-_Wrestlers_1899.jpg',
      },
    ],
    readings: [
      { label: 'Lloyd Goodrich, Thomas Eakins (Whitney Museum)', url: 'https://www.worldcat.org/search?q=Goodrich+Eakins' },
    ],
  },
  {
    slug: slugFor('Realism', 'Johannes Vermeer'),
    style: 'Realism',
    displayName: 'Johannes Vermeer',
    tagline: 'Northern light, intimacy, and the ethics of attention',
    intro:
      'Johannes Vermeer (1632–1675) painted slowly in Delft: a handful of interiors where daylight, maps, and pearls become a theology of looking. His “Realism” is not reportage but distilled concentration—few works, each a lesson in value, texture, and withheld narrative.',
    historicalPlacement:
      'Dutch Golden Age domestic genre; feminist and technical scholarship emphasize camera obscura debates, pigment analysis (natural ultramarine), and the gendered space of women’s labor and leisure in these rooms.',
    whyMaster: [
      'Builds convincing space and material with a narrow value range and disciplined color chords.',
      'Uses soft edges and pointillé highlights to make flesh, fabric, and metal breathe.',
      'Elevates ordinary moments through composition and light—not anecdote.',
    ],
    figures: [
      {
        workTitle: 'Girl with a Pearl Earring',
        year: 'c. 1665',
        medium: 'Oil on canvas',
        collection: 'Mauritshuis, The Hague',
        analysis:
          'The turban and pearl read almost as abstract shapes until the eyes and mouth claim the canvas. Notice how the background drops away in deep shadow while the face stays in a narrow light key—warm halftones in the skin, cool reflected light in the whites. Vermeer’s lesson: restraint in palette plus precision in a few sharp accents (the pearl’s catch-light) can outperform busy detail.',
        imageUrl: artImage('daily-vermeer-pearl.jpg'),
        imageAlt: 'Vermeer, Girl with a Pearl Earring',
        credit: 'Mauritshuis / Wikimedia Commons (public domain).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Meisje_met_de_parel.jpg',
      },
    ],
    readings: [
      { label: 'Arthur K. Wheelock, Vermeer and the Art of Painting', url: 'https://www.worldcat.org/search?q=Wheelock+Vermeer' },
    ],
  },
  {
    slug: slugFor('Realism', 'Diego Velázquez'),
    style: 'Realism',
    displayName: 'Diego Velázquez',
    tagline: 'Court painter, mirror, and the limits of seeing',
    intro:
      'Diego Velázquez (1599–1660) served the Spanish Habsburg court while pushing oil paint toward unprecedented immediacy. His late work collapses distance between viewer, subject, and painter—Realism as epistemology.',
    historicalPlacement:
      'Golden Age Spain; postcolonial scholarship re-reads court imagery alongside empire. Las Meninas remains a cornerstone of art-historical method (Michel Foucault’s reading of representation).',
    whyMaster: [
      'Orchestrates complex multi-figure space without losing optical clarity.',
      'Uses economical brushwork on secondary passages to reserve focus for faces and hands.',
      'Makes composition itself a subject—who looks, who is seen, who paints.',
    ],
    figures: [
      {
        workTitle: 'Las Meninas',
        year: '1656',
        medium: 'Oil on canvas',
        collection: 'Museo del Prado, Madrid',
        analysis:
          'The Infanta anchors the foreground while servants, dwarfs, and the artist at his canvas stage a drama of attention. The mirror’s distant royals and the open door’s silhouette stretch depth in opposite directions. Study Velázquez’s hierarchy of finish: crisp lace and hair versus broad shorthand on costumes—selective detail as narrative steering.',
        imageUrl: artImage('daily-velazquez-las-meninas.jpg'),
        imageAlt: 'Velázquez, Las Meninas',
        credit: 'Prado / Google Earth export on Wikimedia (check reuse).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Las_Meninas,_by_Diego_Vel%C3%A1zquez,_from_Prado_in_Google_Earth.jpg',
      },
    ],
    readings: [
      { label: 'Jonathan Brown, Velázquez: Painter and Courtier', url: 'https://www.worldcat.org/search?q=Brown+Velazquez' },
    ],
  },
  {
    slug: slugFor('Realism', 'Francisco Goya'),
    style: 'Realism',
    displayName: 'Francisco Goya',
    tagline: 'Witness, war, and the modern body in pain',
    intro:
      'Francisco Goya (1746–1828) moved from court tapestry cartoons to etching and painting that indict superstition, invasion, and state violence. His Realism is often grim: light used to expose rather than flatter.',
    historicalPlacement:
      'Enlightenment, Peninsular War, and Fernando VII’s reaction; Goya bridges Rococo skill and modern political image-making. Disability and madness in his late work invite ethical interpretation.',
    whyMaster: [
      'Stages empathy and horror with stark value contrast and readable gesture.',
      'Maintains compositional clarity in chaotic subject matter.',
      'Uses broad handling and selective detail for moral focus.',
    ],
    figures: [
      {
        workTitle: 'The Third of May 1808',
        year: '1814',
        medium: 'Oil on canvas',
        collection: 'Museo del Prado, Madrid',
        analysis:
          'A lantern throws a rectangle of light on the victim’s shirt—white as target and martyr’s shroud. The firing squad merges into a single dark mass; faces are minimal. Lesson: one high-key shape and one gesture (outstretched arms) can carry an entire history painting. Compare edge control: hard contour on the condemned versus painterly melt in the hill and crowd.',
        imageUrl: artImage('daily-goya-third-may.jpg'),
        imageAlt: 'Goya, The Third of May 1808',
        credit: 'Prado / Google Earth export on Wikimedia (check reuse).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:El_Tres_de_Mayo,_by_Francisco_de_Goya,_from_Prado_in_Google_Earth.jpg',
      },
    ],
    readings: [
      { label: 'Robert Hughes, Goya', url: 'https://www.worldcat.org/search?q=Hughes+Goya' },
    ],
  },
  {
    slug: slugFor('Realism', 'J. M. W. Turner'),
    style: 'Realism',
    displayName: 'J. M. W. Turner',
    tagline: 'Light, steam, and the sublime sea',
    intro:
      'Joseph Mallord William Turner (1775–1851) took British landscape from topographical clarity toward dissolved light and weather. His late work anticipates Impressionism and abstraction while retaining narrative hooks—ships, storms, industry.',
    historicalPlacement:
      'Romanticism, industrial revolution, and Royal Academy politics; Turner’s bequest established the Tate tradition. Climate and empire now frame readings of his seas and ports.',
    whyMaster: [
      'Unifies sky, water, and smoke in continuous luminosity without losing motif.',
      'Uses temperature and opacity shifts to suggest depth when contour dissolves.',
      'Balances spectacle with metaphor—sunset as elegy.',
    ],
    figures: [
      {
        workTitle: 'The Fighting Temeraire',
        year: '1839',
        medium: 'Oil on canvas',
        collection: 'The National Gallery, London',
        analysis:
          'A ghostly ship of the line is towed by a dark tug into a molten sunset—past and future in one silhouette. Turner sacrifices rigging detail for a few decisive masts and hull reads; the sky does the emotional work. Squint: value masses remain legible. Lesson: atmospheric perspective can be emotionally, not only optically, motivated.',
        imageUrl: artImage('daily-turner-temeraire.jpg'),
        imageAlt: 'Turner, The Fighting Temeraire',
        credit: 'National Gallery / Wikimedia Commons.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Turner,_J._M._W._-_The_Fighting_T%C3%A9m%C3%A9raire_tugged_to_her_last_Berth_to_be_broken.jpg',
      },
    ],
    readings: [
      { label: 'James Hamilton, Turner: A Life', url: 'https://www.worldcat.org/search?q=Hamilton+Turner+Life' },
    ],
  },
  {
    slug: slugFor('Realism', 'John Singer Sargent'),
    style: 'Realism',
    displayName: 'John Singer Sargent',
    tagline: 'Bravura brush, society portrait, and the economy of chic',
    intro:
      'John Singer Sargent (1856–1925) bridged American patronage and European technique. His portraits flatter and probe—silk, velvet, and skin rendered with swaggering wet-on-wet passages.',
    historicalPlacement:
      'Belle Époque salons and transatlantic elites; scholarship addresses race, gender, and the performance of class in his sitters. Madame X ignited scandal in Paris before becoming an icon.',
    whyMaster: [
      'Controls large dark shapes (gowns, backgrounds) so faces read instantly.',
      'Alternates razor drawing in profiles with painterly dissolve in fabric.',
      'Uses selective impasto for jewelry and highlights—accents as punctuation.',
    ],
    figures: [
      {
        workTitle: 'Madame X (Madame Pierre Gautreau)',
        year: '1883–84',
        medium: 'Oil on canvas',
        collection: 'The Metropolitan Museum of Art, New York',
        analysis:
          'The black dress is built from blue-violet and warm reflected light—not flat black. The powdered skin and auburn hair sit in high-key contrast against the gown’s abyss. One fallen strap (repainted after scandal) redirects the entire narrative tension. Study Sargent’s edges: profile contour is incisive; hands are abbreviated; jewelry gets the sharpest ticks.',
        imageUrl: artImage('daily-sargent-madame-x.jpg'),
        imageAlt: 'Sargent, Madame X',
        credit: 'The Met / Wikimedia Commons.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Madame_X_(Madame_Pierre_Gautreau)_MET_DT278076.jpg',
      },
    ],
    readings: [
      { label: 'Trevor Fairbrother, John Singer Sargent: The Sensualist', url: 'https://www.worldcat.org/search?q=Fairbrother+Sargent' },
    ],
  },
  {
    slug: slugFor('Realism', 'Richard Estes'),
    style: 'Realism',
    displayName: 'Richard Estes',
    tagline: 'Photorealism, acrylic, and the poetry of reflective glass',
    intro:
      'Richard Estes (born 1932) helped define American Photorealism: city views where shop windows, chrome, and glass stack reflections until the picture plane becomes a compressed optical puzzle. He often worked in acrylic for its capacity to hold crisp edges and rapid layering.',
    historicalPlacement:
      '1960s–70s New York; Photorealism emerged alongside Pop and Minimalism, sometimes mistaken for mechanical copying. Scholarship emphasizes camera-aided observation, deliberate editing, and the uncanny stillness of urban infrastructure.',
    whyMaster: [
      'Turns mundane street furniture into rigorous studies of reflection, transparency, and doubling.',
      'Maintains believable space while fracturing the view—Photorealist discipline as composition, not gimmick.',
      'Exploits acrylic’s fast drying to build complex glazed information without muddiness.',
    ],
    figures: [
      {
        workTitle: 'Telephone Booths',
        year: '1967',
        medium: 'Acrylic on Masonite',
        collection: 'Private collection / reproduced in major Photorealism literature',
        analysis:
          'Repeated glass panels create a hall of mirrors: street, signage, and sky reappear in skewed shards. Estes asks you to track which edges are object, which are reflection, and where they contradict—value steps stay discrete so confusion reads as clarity. For painters: study how he reserves the sharpest accents for metal mullions and lettering while letting reflected buildings soften. Copyright restricts embedding; use museum or auction-house authorized images for zoom-level study.',
        imageUrl: undefined,
        imageAlt: 'Richard Estes, Telephone Booths (view authorized reproduction)',
        credit:
          'Artwork © Richard Estes / ARS, New York. High-resolution reproduction not embedded; consult major collection or catalogue raisonné.',
        moreInfoUrl: 'https://en.wikipedia.org/wiki/Telephone_Booths_(painting)',
      },
    ],
    readings: [
      { label: 'Linda Chase, Hyperrealism (Photorealism today)', url: 'https://www.worldcat.org/search?q=Chase+Hyperrealism' },
      { label: 'Louis K. Meisel, Photorealism (catalogue tradition)', url: 'https://www.worldcat.org/search?q=Meisel+Photorealism' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Georges Seurat'),
    style: 'Impressionism',
    displayName: 'Georges Seurat',
    tagline: 'Pointillism, optics, and the science of Sunday light',
    intro:
      'Georges Seurat (1859–1891) systematized Impressionist color into divisionism—small touches of complement and neighbor hues that mix in the eye. His ambition was both optical and social: modern leisure made laboratory.',
    historicalPlacement:
      'Third Republic Paris; Neo-Impressionism split from Impressionist spontaneity toward method. Scholarship links Seurat to color theory, anarchist circles, and the sociology of the boulevard.',
    whyMaster: [
      'Maintains readable figure groups and depth while surface is entirely optically mixed dots.',
      'Builds shadow and grass temperature from disciplined complements, not blended mud.',
      'Proves monumental scale can rest on microscopic touch discipline.',
    ],
    figures: [
      {
        workTitle: 'A Sunday on La Grande Jatte',
        year: '1884',
        medium: 'Oil on canvas',
        collection: 'Art Institute of Chicago',
        analysis:
          'Shadow under trees is woven from violets, greens, and oranges; parasols and skirts become patterns of dots at close range but cohere into silhouettes at distance. The lesson: plan the big value shapes first, then subdivide into complementary families. Seurat’s edge is aggregate—soft boundaries from millions of hard marks.',
        imageUrl: artImage('daily-seurat-grande-jatte.jpg'),
        imageAlt: 'Seurat, A Sunday on La Grande Jatte',
        credit: 'Google Art Project / Wikimedia Commons.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Georges_Seurat_-_A_Sunday_on_La_Grande_Jatte_--_1884_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Robert L. Herbert, Seurat and the Making of La Grande Jatte', url: 'https://www.worldcat.org/search?q=Herbert+Seurat+Grande+Jatte' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Paul Cézanne'),
    style: 'Impressionism',
    displayName: 'Paul Cézanne',
    tagline: 'Constructive stroke, Mont Sainte-Victoire, and the bridge to Cubism',
    intro:
      'Paul Cézanne (1839–1906) took Impressionist color into architecture: planes built from parallel hatch and patch, nature “treated by the cylinder, sphere, and cone” (his famous phrase to Bernard).',
    historicalPlacement:
      'Aix-en-Provence and Paris circles; Cézanne links Impressionist light to Picasso and Braque’s analytic phase. Conservation studies track his layered revisions.',
    whyMaster: [
      'Replaces outline with color boundaries that still describe solid form.',
      'Unifies landscape through repeated diagonal and horizontal modules.',
      'Balances warm-cool modulation with geological weight.',
    ],
    figures: [
      {
        workTitle: 'Mont Sainte-Victoire and Château Noir',
        year: '1904–06',
        medium: 'Oil on canvas',
        collection: 'Multiple versions; Google Art scan cited',
        analysis:
          'The mountain reads as stacked planes of blue-green and ochre rather than a single silhouette. Château Noir anchors mid-ground while pines punctuate rhythm. Cézanne teaches “passage”—edges where two color areas share a middle tone so forms interlock. Compare to Impressionist dissolve: here structure persists under the shimmer.',
        imageUrl: artImage('daily-cezanne-mont-sainte-victoire.jpg'),
        imageAlt: 'Cézanne, Mont Sainte-Victoire and Château Noir',
        credit: 'Google Art Project / Wikimedia Commons.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Paul_Cezanne_-_Mont_Sainte-Victoire_and_Ch%C3%A2teau_Noir_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Alex Danchev, Cézanne: A Life', url: 'https://www.worldcat.org/search?q=Danchev+Cezanne' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Claude Monet'),
    style: 'Impressionism',
    displayName: 'Claude Monet',
    tagline: 'Light as the true subject',
    intro:
      'Claude Monet (1840–1926) pushed plein-air practice toward serial investigation of the same motif under changing conditions. Impressionism, in his hands, is an epistemology of perception.',
    historicalPlacement:
      'Third Republic France; Monet’s exhibitions with the Société anonyme and later Giverny series align with modernity, leisure, and technological vision (photography) without copying it.',
    whyMaster: [
      'Separates color into discrete touches that fuse optically at a distance.',
      'Maintains compositional order while dissolving contour—edges as light events.',
      'Demonstrates how value structure survives high-chroma palettes.',
    ],
    figures: [
      {
        workTitle: 'Impression, Sunrise',
        year: '1872',
        medium: 'Oil on canvas',
        collection: 'Musée Marmottan Monet, Paris',
        analysis:
          'The orange sun and its reflection float on a cool blue-gray harbor—a case study in simultaneous contrast and reduced drawing. Forms are indicated with horizontal scumbles; detail is sacrificed for overall luminosity. Squint: the painting still “reads” because value keys are few and hierarchical.',
        imageUrl: artImage('monet-impression-sunrise.jpg'),
        imageAlt: 'Monet, Impression, Sunrise',
        credit: 'Public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Monet_-_Impression,_Sunrise.jpg',
      },
      {
        workTitle: 'Pond with Water Lilies',
        year: 'c. 1917–19',
        medium: 'Oil on canvas',
        collection: 'Musée de l’Orangerie / related holdings',
        analysis:
          'Horizon often disappears: lily pads, reflection, and sky share one horizontal weave. Monet lets rose, emerald, and cobalt streaks cross without muddying—wet surface as abstract field with botanical anchors. Late lesson: limit your motif (ellipse of pads, bridge hint) so freedom in touch does not become chaos.',
        imageUrl: artImage('daily-monet-water-lilies.jpg'),
        imageAlt: 'Monet, Water Lilies (pond)',
        credit: 'Google Art Project / Wikimedia Commons.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Pond_with_Water_Lilies_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Paul Hayes Tucker, Monet in the ’90s (Yale)', url: 'https://www.worldcat.org/search?q=Tucker+Monet+90s' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Pierre-Auguste Renoir'),
    style: 'Impressionism',
    displayName: 'Pierre-Auguste Renoir',
    tagline: 'Figure painting, warmth, and the social skin of modernity',
    intro:
      'Pierre-Auguste Renoir (1841–1919) braided Impressionist light with Rubensian softness of flesh, often in scenes of leisure and intimacy.',
    historicalPlacement:
      'Haussmann-era Paris cafés, riversides, and dance halls; Renoir’s nudes later vexed modernist critics (feminist art history re-reads them through desire and class).',
    whyMaster: [
      'Transitions from atmosphere to solid form without chalky over-blending.',
      'Uses warm-cool vibration on skin and fabric to keep roundness.',
      'Composes crowded scenes with rhythmic intervals of color accents.',
    ],
    figures: [
      {
        workTitle: 'Bal du moulin de la Galette',
        year: '1876',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        analysis:
          'Dappled shade breaks into patches of complementary blues and oranges; figures cohere through linked hats, faces, and repeated circular tables. Renoir sacrifices individual facial detail for ensemble sparkle—study how a few sharper profiles anchor the swirl. Brush size scales with form: smaller touches on faces, broader passes in background foliage.',
        imageUrl: artImage('renoir-moulin-galette.jpg'),
        imageAlt: 'Renoir, Bal du moulin de la Galette',
        credit: 'Public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir,_Le_Moulin_de_la_Galette.jpg',
      },
    ],
    readings: [
      { label: 'Barbara Ehrlich White, Renoir: His Life, Art, and Letters', url: 'https://www.worldcat.org/search?q=White+Renoir+Life' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Edgar Degas'),
    style: 'Impressionism',
    displayName: 'Edgar Degas',
    tagline: 'Movement, cropping, and the anti-heroic instant',
    intro:
      'Edgar Degas (1834–1917) preferred “Independent” to “Impressionist” but shared their modern subjects and optical curiosity. His ballet and bathers rethink space through photography-like cuts.',
    historicalPlacement:
      'Opera culture, class stratification backstage, and Japonisme inform his oblique viewpoints. Pastel and monotype expanded his graphic velocity.',
    whyMaster: [
      'Uses off-center framing and diagonal thrust to simulate witnessed time.',
      'Draws with sculptural understanding—weight on planted feet, spiral torsos.',
      'Alternates finish: crisp line for profile, vapor for tutu atmosphere.',
    ],
    figures: [
      {
        workTitle: 'The Ballet Class',
        year: '1871–74',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        analysis:
          'A shallow stage-like room stacks dancers in depth; the instructor’s seated mass anchors left while activity ricochets right. Degas teaches edge contrast: hard contour on limbs against soft floor reflections. Repetition of white skirts becomes a rhythmic abstraction—Impressionist unity-through-variation.',
        imageUrl: artImage('degas-ballet-class.jpg'),
        imageAlt: 'Degas, The Ballet Class',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Richard Kendall, Degas: Beyond Impressionism', url: 'https://www.worldcat.org/search?q=Kendall+Degas' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Camille Pissarro'),
    style: 'Impressionism',
    displayName: 'Camille Pissarro',
    tagline: 'Systematic light, rural labor, and anarchist sympathy',
    intro:
      'Camille Pissarro (1830–1903) was a methodological core of Impressionism and later experimented with pointillist divisionism. His landscapes embed political sympathy for peasants.',
    historicalPlacement:
      'Exile and return between London, Pontoise, and Eragny; correspondence with Cézanne and Seurat maps stylistic bridges across Impressionist generations.',
    whyMaster: [
      'Structures scenes with clear planar recession while keeping touch lively.',
      'Demonstrates weather as a full-picture color cast, not local tinting alone.',
      'Shows how to integrate figures into landscape without anecdotal clutter.',
    ],
    figures: [
      {
        workTitle: 'Boulevard Montmartre, Spring',
        year: '1897',
        medium: 'Oil on canvas',
        collection: 'Courtauld Gallery, London',
        analysis:
          'Rain-wet pavement mirrors façades in broken verticals; carriage and pedestrian scales establish depth. Pissarro’s brush follows architectural rhythm—long horizontals of balconies versus staccato umbrellas. Lesson: unify a busy motif through repeated hue intervals (gray-violet cobbles echoing rooflines).',
        imageUrl: artImage('pissarro-boulevard-montmartre.jpg'),
        imageAlt: 'Pissarro, Boulevard Montmartre, Spring',
        credit: 'Google Art Project; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Camille_Pissarro_-_Boulevard_Montmartre,_Spring_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Martha Ward, Pissarro, Neo-Impressionism, and the Spaces of the Avant-Garde', url: 'https://www.worldcat.org/search?q=Ward+Pissarro' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Berthe Morisot'),
    style: 'Impressionism',
    displayName: 'Berthe Morisot',
    tagline: 'Intimacy, women’s worlds, and feather-light touch',
    intro:
      'Berthe Morisot (1841–1895) painted domestic life, gardens, and modern femininity with a touch so rapid it verges on drawing-in-paint. She was a core exhibitor with the Impressionists.',
    historicalPlacement:
      'Feminist art history recovers Morisot from footnote status, emphasizing professional strategy within gendered constraints (public/private spheres, critical language).',
    whyMaster: [
      'Achieves luminosity with pale, high-key palettes without losing form.',
      'Uses shallow space and mirror reflections to complicate viewpoint.',
      'Integrates figure and environment through shared color chords.',
    ],
    figures: [
      {
        workTitle: 'The Cradle',
        year: '1872',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        analysis:
          'A gauze curtain creates a soft vertical veil between viewer and sleeping infant—edges dissolve into atmosphere yet the mother’s gaze stabilizes the scene. Morisot’s whites are built from blue-violet shadows and warm highlights, avoiding chalk. Compare transparent versus opaque passages in veil versus face.',
        imageUrl: artImage('morisot-cradle.jpg'),
        imageAlt: 'Morisot, The Cradle',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Berthe_Morisot_-_The_Cradle_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Kathleen Adler & Tamar Garb, Berthe Morisot (exh. cat.)', url: 'https://www.worldcat.org/search?q=Adler+Garb+Morisot' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'Mary Cassatt'),
    style: 'Impressionism',
    displayName: 'Mary Cassatt',
    tagline: 'Domestic light, mother and child, and pastel logic in oil',
    intro:
      'Mary Cassatt (1844–1926) brought Impressionist optics to intimate interiors and the modern lives of women. Trained across the Atlantic, she translated pastel softness and Japanese print cropping into oil compositions of rare tenderness.',
    historicalPlacement:
      'Paris Impressionist circles and American collectors; Cassatt helped shape US taste for French modernism. Feminist scholarship emphasizes her professional agency and recurring motif of care without sentimentality.',
    whyMaster: [
      'Compresses figure and setting into high-key harmonies—whites built from violet and warm glints.',
      'Uses cropping and tilted planes like prints—modern composition without anecdotal clutter.',
      'Handles flesh and fabric with separate but related stroke systems.',
    ],
    figures: [
      {
        workTitle: 'The Child’s Bath',
        year: '1893',
        medium: 'Oil on canvas',
        collection: 'Art Institute of Chicago',
        analysis:
          'A mother bends over a child’s foot in a tight, tilted rectangle—space feels shallow and enveloping. Patterns on dress and rug rhyme without merging; edges stay soft in light, sharper where hands meet skin. Compare Cassatt’s white construction to Morisot: both avoid chalk through systematic shadow color in highlights.',
        imageUrl: artImage('cassatt-childs-bath.jpg'),
        imageAlt: 'Cassatt, The Child’s Bath',
        credit: 'Google Art Project; public domain (PD-old).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Mary_Cassatt_-_The_Child%27s_Bath_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Griselda Pollock, Mary Cassatt (exh. cat. context)', url: 'https://www.worldcat.org/search?q=Pollock+Cassatt' },
    ],
  },
  {
    slug: slugFor('Impressionism', 'David Hockney'),
    style: 'Impressionism',
    displayName: 'David Hockney',
    tagline: 'California light, acrylic flatness, and the long look at a short splash',
    intro:
      'David Hockney (born 1937) moved between graphic design clarity, photographic collage, and lush painting. His 1960s Los Angeles pool pictures use acrylic’s opaque, even films to describe modernist architecture, then switch to obsessive small-brush work where water becomes a field of event.',
    historicalPlacement:
      'British Pop roots and transatlantic queer modernity; Hockney’s pools belong to Southern California leisure culture and to art-historical dialogue with Matisse and Picasso. Critics note the paradox of extended studio time depicting an instantaneous splash.',
    whyMaster: [
      'Balances graphic simplicity (deck, sky, building) with turbulent micro-detail where narrative lives.',
      'Uses acrylic to separate “still” structure from “moving” surface logic.',
      'Updates Impressionist interest in the moment without mimicking 1870s broken color.',
    ],
    figures: [
      {
        workTitle: 'A Bigger Splash',
        year: '1967',
        medium: 'Acrylic on canvas',
        collection: 'Tate, London',
        analysis:
          'The diving board and empty chair imply a body that just left; the splash is the painting’s protagonist—white filaments against turquoise. Hockney’s flat color blocks read as heat and emptiness; the splash contradicts with bristling strokes. Lesson: one high-energy motif can carry the whole if everything else is ruthlessly simplified. © David Hockney; use Tate’s collection page for authorized images.',
        imageUrl: undefined,
        imageAlt: 'David Hockney, A Bigger Splash (view at Tate)',
        credit: 'Artwork © David Hockney. Reproduction not embedded; use Tate authorized viewer.',
        moreInfoUrl: 'https://www.tate.org.uk/art/artworks/hockney-a-bigger-splash-t01839',
      },
    ],
    readings: [
      { label: 'Marco Livingstone, David Hockney', url: 'https://www.worldcat.org/search?q=Livingstone+Hockney' },
      { label: 'Lawrence Weschler, True to Life: Twenty-Five Years of Conversations with David Hockney', url: 'https://www.worldcat.org/search?q=Weschler+Hockney' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Vincent van Gogh'),
    style: 'Expressionism',
    displayName: 'Vincent van Gogh',
    tagline: 'Impasto, rhythm, and the spiritual landscape',
    intro:
      'Vincent van Gogh (1853–1890) compressed Dutch drawing discipline into southern color—Arles and Saint-Rémy canvases where cypress, wheat, and night sky vibrate with directional stroke. He is often taught between Post-Impressionism and Expressionism; here he anchors expressive color-as-force for painters.',
    historicalPlacement:
      'European modernity and mental-health history complicate his reception; scholarship emphasizes letter-driven intent, Protestant visual culture, and Japanese print influence. Copyright on some photographs varies—museum pages remain authoritative.',
    whyMaster: [
      'Aligns every stroke with form and feeling—sky spirals, field rows, fabric folds.',
      'Uses saturated complements without losing value structure.',
      'Makes humble motifs (bedroom, chair, stars) carry existential weight.',
    ],
    figures: [
      {
        workTitle: 'The Starry Night',
        year: '1889',
        medium: 'Oil on canvas',
        collection: 'Museum of Modern Art, New York',
        analysis:
          'The sky is a vortex of blues and yellows; the village below is comparatively quiet—emotional weather concentrated aloft. Cypress acts as a dark flame between worlds. Lesson: repeat a stroke direction across a passage to unify it; let one or two stars hold the highest key. Thick paint catches real light—surface as part of meaning.',
        imageUrl: artImage('daily-van-gogh-starry-night.jpg'),
        imageAlt: 'van Gogh, The Starry Night',
        credit: 'Google Art Project / Wikimedia (MoMA holds the work; verify commercial reuse).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Steven Naifeh & Gregory White Smith, Van Gogh: The Life', url: 'https://www.worldcat.org/search?q=Naifeh+Van+Gogh+Life' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Edvard Munch'),
    style: 'Expressionism',
    displayName: 'Edvard Munch',
    tagline: 'Psychic color, linear pulse, and Symbolist roots',
    intro:
      'Edvard Munch (1863–1944) channeled anxiety, desire, and mortality into images that became templates for German Expressionism. His work bridges late Symbolism and modernist distortion.',
    historicalPlacement:
      'Kristiania (Oslo) bohemia, continental travel, and printmaking’s serial repetition (“The Scream” exists in paint and lithograph). His Frieze of Life series theorizes love, illness, and death as cycles.',
    whyMaster: [
      'Distorts form and color for emotional truth rather than anatomical default.',
      'Uses rhythmic, undulating line to knit figure and setting into one nervous field.',
      'Exploits high-key and non-naturalistic hue for mood without losing readability.',
    ],
    figures: [
      {
        workTitle: 'The Scream',
        year: '1893 (version discussed: tempera/oil casein)',
        medium: 'Tempera and oil on cardboard',
        collection: 'National Museum of Norway, Oslo',
        analysis:
          'The fjord’s perspectival rails vibrate against a blood-orange sky; the figure’s mask-like head becomes a focal capacitor. Munch compresses hands to temples—gesture as pictogram. Lesson: let contour wobble; let complementary streaks (blue-green water vs orange air) do expressive work that naturalistic shading would dull.',
        imageUrl: artImage('munch-scream.jpg'),
        imageAlt: 'Munch, The Scream',
        credit: 'National Gallery of Norway; public domain (artist life+70).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg',
      },
    ],
    readings: [
      { label: 'Patricia G. Berman, In Munch’s Time (Yale)', url: 'https://www.worldcat.org/search?q=Berman+Munch' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Wassily Kandinsky'),
    style: 'Expressionism',
    displayName: 'Wassily Kandinsky (Expressionist phase)',
    tagline: 'Color as vibration before full abstraction',
    intro:
      'Wassily Kandinsky (1866–1944) appears in ArtVision’s Expressionism list for his Munich-era canvases, where landscape and rider motifs dissolve into chromatic intensity and spiritualized form—before his stricter geometric turn.',
    historicalPlacement:
      'Der Blaue Reiter circle and On the Spiritual in Art (1911) theorize synesthetic ambition. Scholarship tracks his move from Jadgstill landscape to non-objective painting across war and exile.',
    whyMaster: [
      'Orchestrates color chords as musical analogues—warm advances, cool recedes, but deliberately broken.',
      'Uses diagonal energy and floating motifs to destabilize horizon logic.',
      'Bridges recognizable motif and emerging abstraction—useful benchmark for “expressive” color decisions.',
    ],
    figures: [
      {
        workTitle: 'Composition VII',
        year: '1913',
        medium: 'Oil on canvas',
        collection: 'Tretyakov Gallery, Moscow',
        analysis:
          'A turbulent field of angular shards and arabesques barely tethered to apocalyptic narrative hints. Kandinsky layers transparent glazes and opaque accents so depth feels both optical and symbolic. Study how black lines “conduct” chaos—linear scaffolding inside color storms is an advanced unity lesson.',
        imageUrl: artImage('kandinsky-composition-vii.jpg'),
        imageAlt: 'Kandinsky, Composition VII',
        credit: 'Wikimedia Commons (GAC scan); check local copyright term for your jurisdiction.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Composition_VII_-_Wassily_Kandinsky,_GAC.jpg',
      },
    ],
    readings: [
      { label: 'Peg Weiss, Kandinsky and Old Russia (Yale)', url: 'https://www.worldcat.org/search?q=Weiss+Kandinsky' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Egon Schiele'),
    style: 'Expressionism',
    displayName: 'Egon Schiele',
    tagline: 'Line, exposure, and Viennese modernism',
    intro:
      'Egon Schiele (1890–1918) extended Art Nouveau linearity into jagged, self-conscious poses. His Expressionism is graphic, erotic, and psychologically confrontational.',
    historicalPlacement:
      'Vienna circa 1900; Schiele’s trials for “immoral” imagery intersect with fin-de-siècle discourses on the body. His watercolors and drawings are as central as oils.',
    whyMaster: [
      'Combines elegant contour with deliberate awkwardness—no accidental distortion.',
      'Uses sallow, heightened palettes to strip romantic fleshiness.',
      'Compresses space so bodies press the picture plane as psychological pressure.',
    ],
    figures: [
      {
        workTitle: 'Self-Portrait with Physalis',
        year: '1912',
        medium: 'Oil on wood',
        collection: 'Leopold Museum, Vienna',
        analysis:
          'The figure’s cropped, off-center stance and staring asymmetry refuse classical balance. Garment and skin share sickly greens and pinks—temperature used as mood, not local color truth. Note how fingernails and eye sockets get hard accents while cheeks dissolve—selective sharpness as anxiety.',
        imageUrl: artImage('schiele-self-portrait-physalis.jpg'),
        imageAlt: 'Schiele, Self-Portrait with Physalis',
        credit: 'Google Art Project; verify rights for commercial reuse in your region.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Egon_Schiele_-_Self-Portrait_with_Physalis_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Jane Kallir, Egon Schiele: The Complete Works', url: 'https://www.worldcat.org/search?q=Kallir+Schiele' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Ernst Ludwig Kirchner'),
    style: 'Expressionism',
    displayName: 'Ernst Ludwig Kirchner',
    tagline: 'Brücke color, urban speed, carved aesthetics',
    intro:
      'Ernst Ludwig Kirchner (1880–1938) co-founded Die Brücke, channeling “primitive” and craft sources into jagged urban scenes. His woodcut thinking informs painted edges.',
    historicalPlacement:
      'Dresden and Berlin modernity; National Socialist persecution destroyed careers and bodies—ethical framing of his work now includes colonial archive critique.',
    whyMaster: [
      'Deploys non-naturalistic complementary pairs for nervous energy.',
      'Carves space with hatched shadows reminiscent of printmaking.',
      'Composes street life with slicing diagonals and compressed perspective.',
    ],
    figures: [
      {
        workTitle: 'Street, Berlin',
        year: '1913',
        medium: 'Oil on canvas',
        collection: 'Museum of Modern Art, New York',
        analysis:
          'Cocotte figures with mask-like faces advance toward the viewer while street wedges recede. Kirchner’s blues and violets spike against orange-pink flesh—Expressionist temperature as social alienation. Compare outline: ink-dark contours versus interior patches of flat color.',
        imageUrl: artImage('kirchner-street-berlin.jpg'),
        imageAlt: 'Kirchner, Street, Berlin',
        credit: 'Google Art Project / MoMA; verify rights for your use.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Ernst_Ludwig_Kirchner_-_Berlin_Street_Scene_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Jill Lloyd, German Expressionism: Primitivism and Modernity', url: 'https://www.worldcat.org/search?q=Lloyd+German+Expressionism' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Emil Nolde'),
    style: 'Expressionism',
    displayName: 'Emil Nolde',
    tagline: 'Chromatic excess, flower close-ups, and contested biography',
    intro:
      'Emil Nolde (1867–1956) pursued saturated watercolor and oil with almost floral ferocity. His technical brilliance is studied alongside his documented Nazi party involvement—serious scholarship does not separate aesthetics from politics.',
    historicalPlacement:
      'Expressionism and “degenerate art” confiscations; postwar rehabilitation debates continue. Museums now foreground provenance and ethical framing.',
    whyMaster: [
      'Pushes chroma near the threshold of chaos while retaining simple silhouettes.',
      'Uses wet-on-wet and reserved paper in watercolor for luminous darkness.',
      'Demonstrates how small formats can feel monumental through color pressure.',
    ],
    figures: [
      {
        workTitle: 'Clematis and Dahlia',
        year: '1940',
        medium: 'Oil on canvas',
        collection: 'National Gallery of Denmark, Copenhagen',
        analysis:
          'Late Nolde still pushes chroma to the edge of chaos while silhouettes stay simple—reds, violets, and greens vibrate against a dark ground. Study wet-on-wet timing in the petals: hard accents where form turns versus feathered passages where pigment swims. For painters: translate his pressure and saturation into your own floral or figure passages.',
        imageUrl: artImage('nolde-prophet.jpg'),
        imageAlt: 'Nolde, Clematis and Dahlia',
        credit: 'National Gallery of Denmark; public domain (artist life+70).',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Emil_Nolde_(1867-1956)_-_Clematis_and_Dahlia_(1940)_-_Oil_on_canvas_-_National_Gallery_of_Denmark.jpg',
      },
    ],
    readings: [
      { label: 'WorldCat — Emil Nolde monographs & exhibition catalogs', url: 'https://www.worldcat.org/search?q=au%3ANolde+Emil+painting' },
      { label: 'Neue Nationalgalerie Berlin — Nolde scholarship & provenance pages', url: 'https://www.smb.museum/en/museums-institutions/neue-nationalgalerie/home.html' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Paula Modersohn-Becker'),
    style: 'Expressionism',
    displayName: 'Paula Modersohn-Becker',
    tagline: 'Monumental simplicity, early modern selfhood, and earthy form',
    intro:
      'Paula Modersohn-Becker (1876–1907) worked in Worpswede and Paris, compressing figures, still life, and self-portraiture into solemn, simplified masses. Her short career bridges Post-Impressionist structure and German modernist inwardness.',
    historicalPlacement:
      'Scholarship highlights her as one of the first modern women to paint sustained nude self-portraits and to engage Paul Cézanne’s constructive brushwork. Her death at thirty-one shaped her mythic reception.',
    whyMaster: [
      'Reduces form to weighted geometry without losing empathy—stillness as force.',
      'Uses earth pigments and warm greys for flesh that feels grounded, not cosmetic.',
      'Balances childlike outline with adult psychological gravity.',
    ],
    figures: [
      {
        workTitle: 'Self-Portrait with Hat and Veil',
        year: '1906–07',
        medium: 'Oil on canvas',
        collection: 'Private collections / reproduced widely',
        analysis:
          'The face fills the frame; hat and veil become flat shapes that cradle simplified features. Eyes are dark, mouth reserved—expression through massing rather than anecdote. Lesson: test how few value steps still convey a person; compare her contour economy to Schiele’s nervous line.',
        imageUrl: artImage('modersohn-becker-self-portrait-veil.jpg'),
        imageAlt: 'Modersohn-Becker, Self-Portrait with Hat and Veil',
        credit: 'Google Art Project; verify rights for your jurisdiction.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Paula_Modersohn-Becker_-_Self-portrait_with_hat_and_veil_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'Rainer Stamm, Paula Modersohn-Becker', url: 'https://www.worldcat.org/search?q=Stamm+Modersohn-Becker' },
    ],
  },
  {
    slug: slugFor('Expressionism', 'Jean-Michel Basquiat'),
    style: 'Expressionism',
    displayName: 'Jean-Michel Basquiat',
    tagline: 'Neo-Expressionism, street glyph, and layered urgency',
    intro:
      'Jean-Michel Basquiat (1960–1988) fused graffiti tempo, art-historical sampling, and raw figuration into large canvases that read like public walls turned inward. Acrylic, oil stick, and spray paint let him stack speeds: fast ground, slower drawing, sudden aerosol atmosphere.',
    historicalPlacement:
      '1980s New York downtown scene; Basquiat’s rise intersects with hip-hop, punk, and the market’s appetite for painterly return. Scholarship addresses primitivist framing, collaboration with Andy Warhol, and the politics of Black representation in the neo-avant-garde.',
    whyMaster: [
      'Builds iconic central forms (skull, crown, mask) that hold chaotic peripheral marks.',
      'Layers media for legible sequence—flat color, then scratch, then spray—without total mud.',
      'Merges text, symbol, and figure into a contemporary hieroglyphic voice.',
    ],
    figures: [
      {
        workTitle: 'Untitled (Skull)',
        year: '1982',
        medium: 'Acrylic, spray paint, and oil stick on canvas',
        collection: 'Private collection (sold Sotheby’s 2017; exhibited Brooklyn Museum, Seattle Art Museum, others)',
        analysis:
          'The skull fills the vertical canvas like a totem; eyes and teeth are scoured and redrawn, suggesting violence and vulnerability at once. Electric blue ground pushes warm bone tones forward; oil stick drags over acrylic flats, preserving underlayer hue. Lesson: reserve a simple silhouette, then allow the surface to accrete “errors” that become expression. © The Estate of Jean-Michel Basquiat; use museum or estate-authorized sources for images.',
        imageUrl: undefined,
        imageAlt: 'Jean-Michel Basquiat, Untitled Skull (view authorized reproduction)',
        credit: 'Artwork © The Estate of Jean-Michel Basquiat / ADAGP, Paris / ARS, New York. Reproduction not embedded.',
        moreInfoUrl: 'https://en.wikipedia.org/wiki/Untitled_(1982_Basquiat_skull_painting)',
      },
    ],
    readings: [
      { label: 'Fred Hoffman, The Art of Jean-Michel Basquiat', url: 'https://www.worldcat.org/search?q=Hoffman+Basquiat' },
      { label: 'Dieter Buchhart & Eleanor Nairne, Basquiat: Boom for Real (exh. cat.)', url: 'https://www.worldcat.org/search?q=Buchhart+Basquiat+Boom' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Wassily Kandinsky'),
    style: 'Abstract Art',
    displayName: 'Wassily Kandinsky (Abstract phase)',
    tagline: 'Non-objective painting as structured feeling',
    intro:
      'In ArtVision’s Abstract list, Kandinsky stands for mature non-objective painting where geometry, biomorphism, and color theory replace motif. This entry complements the Expressionist-phase page.',
    historicalPlacement:
      'Bauhaus years refine his pedagogy (Point and Line to Plane). Compare Moscow, Weimar, and Paris periods for shifting balances of hard edge versus organic float.',
    whyMaster: [
      'Balances freehand curves and measured intervals—rhythm without illustration.',
      'Uses limited anchoring accents (black line, red dot) to organize large fields.',
      'Demonstrates how titles and theory frame abstract work historically.',
    ],
    figures: [
      {
        workTitle: 'Yellow-Red-Blue',
        year: '1925',
        medium: 'Oil on canvas',
        collection: 'Centre Pompidou, Paris',
        analysis:
          'Geometric sectors coexist with cloud-like forms; the painting is a lab for competing visual languages. Notice how black lines segment the canvas like musical measures while color areas “sound” against each other. Lesson: abstract mastery often means two or three clear structural devices, not infinite novelty.',
        imageUrl: artImage('kandinsky-yellow-red-blue.jpg'),
        imageAlt: 'Kandinsky, Yellow-Red-Blue',
        credit: 'Wikimedia Commons; verify rights for your jurisdiction.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Gelb-Rot-Blau,_by_Wassily_Kandinsky.jpg',
      },
    ],
    readings: [
      { label: 'Rose-Carol Washton Long, Kandinsky: The Development of an Abstract Style', url: 'https://www.worldcat.org/search?q=Washton+Long+Kandinsky' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Piet Mondrian'),
    style: 'Abstract Art',
    displayName: 'Piet Mondrian',
    tagline: 'Neoplasticism: right angle, primary plane, universal harmony',
    intro:
      'Piet Mondrian (1872–1944) distilled painting toward vertical/horizontal grids and primary colors, theorizing spiritual equilibrium through abstraction.',
    historicalPlacement:
      'De Stijl and Paris interwar modernism; Mondrian’s serial refinements from tree and pier studies to Broadway Boogie-Woogie map a rarefied path from nature to pure relation.',
    whyMaster: [
      'Proves that minute shifts in line weight and rectangle proportion change entire balance.',
      'Uses white and gray not as emptiness but as active intervals.',
      'Exemplifies edge control at its most stringent—every junction matters.',
    ],
    figures: [
      {
        workTitle: 'Composition II in Red, Blue, and Yellow',
        year: '1930',
        medium: 'Oil on canvas',
        collection: 'Kunsthaus Zürich (version cited varies by catalog)',
        analysis:
          'A dominant red rectangle anchors while smaller blue and yellow blocks activate corners; black bars regulate pace like measures in music. Mondrian sanded and revised edges—surface is matte and exact. Study asymmetry: perfect symmetry would kill the pulse; his “dynamic equilibrium” depends on unequal but balanced intervals.',
        imageUrl: artImage('mondrian-composition-ii.jpg'),
        imageAlt: 'Mondrian, Composition II in Red, Blue, and Yellow',
        credit: 'Public domain (check local term).',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Piet_Mondriaan,_1930_-_Mondrian_Composition_II_in_Red,_Blue,_and_Yellow.jpg',
      },
    ],
    readings: [
      { label: 'Yve-Alain Bois, Painting as Model', url: 'https://www.worldcat.org/search?q=Bois+Painting+as+Model' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Mark Rothko'),
    style: 'Abstract Art',
    displayName: 'Mark Rothko',
    tagline: 'Color field, luminosity, and the scale of the body',
    intro:
      'Mark Rothko (1903–1970) developed stacked rectangular clouds of color intended to envelop the viewer. His abstraction refuses illustration while retaining tragic sublimity.',
    historicalPlacement:
      'Postwar New York School; Rothko Chapel and Seagram murals debates raise questions of architecture, religion, and commerce. Copyright in photographs of his work is restrictive; museums control licensing.',
    whyMaster: [
      'Demonstrates edge softness as emotional content—feathered horizons “breathe.”',
      'Shows how huge fields of close hues demand flawless substrate and layering.',
      'Uses simple structure (few rectangles) to sustain prolonged looking.',
    ],
    figures: [
      {
        workTitle: 'No. 61 (Rust and Blue) [Brown Blue, Brown Blue on Wine]',
        year: '1953',
        medium: 'Oil on canvas',
        collection: 'Museum of Contemporary Art, Los Angeles',
        analysis:
          'Horizontals of rust and inky blue hover with blurred boundaries; the painting performs slow revelation as your eyes adapt. Rothko’s technique involves thin washes and brushed softness—brushwork hidden but surface velvety. Because many in-situ photos are rights-managed, study in museum light when possible; digitally, rely on institutional viewer pages linked below.',
        imageUrl: undefined,
        imageAlt: 'Rothko color field (view at museum link)',
        credit:
          'Artwork © 1998 Kate Rothko Prizel & Christopher Rothko / ARS, New York. Embedded reproduction omitted here due to copyright; use MoMA / MFA / Tate authorized viewers for study.',
        moreInfoUrl: 'https://www.nga.gov/collection/artist-info.1055.html',
      },
    ],
    readings: [
      { label: 'Dore Ashton, About Rothko', url: 'https://www.worldcat.org/search?q=Ashton+About+Rothko' },
      { label: 'MoMA Rothko collection record (rights-safe reference)', url: 'https://www.moma.org/artists/5047' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Kazimir Malevich'),
    style: 'Abstract Art',
    displayName: 'Kazimir Malevich',
    tagline: 'Suprematism and the zero degree of painting',
    intro:
      'Kazimir Malevich (1879–1935) proclaimed Suprematism—geometry freed from objecthood—as a new pictorial language. His work anchors early abstract avant-gardes in eastern Europe.',
    historicalPlacement:
      'Revolutionary Russia, UNOVIS pedagogy, and later Polish exile complicate reception; conservation studies of surface cracking on Black Square revise mythic readings.',
    whyMaster: [
      'Radical reduction tests composition: where can mass sit on white infinity?',
      'Uses slight rotation and offset to dynamize static shapes.',
      'Historicizes “icon” strategies—black square as both painting and sign.',
    ],
    figures: [
      {
        workTitle: 'Black Square',
        year: '1915 (version 1930s exhibited)',
        medium: 'Oil on linen',
        collection: 'Tretyakov Gallery, Moscow',
        analysis:
          'The black quadrilateral floats on white with tactile facture visible on close inspection—Malevich is not printing a logo but painting an event. Edges are imperfect; that waver generates pictorial warmth inside radical austerity. Lesson: minimalism in paint still demands touch decisions (impasto, drag, scumble).',
        imageUrl: artImage('malevich-black-square.jpg'),
        imageAlt: 'Malevich, Black Square',
        credit: 'Public domain (check jurisdiction).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Black_Square.jpg',
      },
      {
        workTitle: 'Suprematist Composition: White on White',
        year: '1918',
        medium: 'Oil on canvas',
        collection: 'Museum of Modern Art, New York',
        analysis:
          'A tilted white square on off-white ground pushes value contrast to the threshold of visibility—training the eye to notice temperature and edge rather than hue drama. Conservation imaging reveals underlayers; pedagogically, copy the exercise in grisaille to learn discrimination.',
        imageUrl: artImage('malevich-white-on-white.jpg'),
        imageAlt: 'Malevich, White on White',
        credit: 'MoMA / Wikimedia Commons; verify rights.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Kazimir_Malevich_-_%27Suprematist_Composition-_White_on_White%27,_oil_on_canvas,_1918,_Museum_of_Modern_Art.jpg',
      },
    ],
    readings: [
      { label: 'Troels Andersen, Malevich (catalogue raisonné context)', url: 'https://www.worldcat.org/search?q=Andersen+Malevich' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Jackson Pollock'),
    style: 'Abstract Art',
    displayName: 'Jackson Pollock',
    tagline: 'All-over composition and the choreography of paint',
    intro:
      'Jackson Pollock (1912–1956) expanded Abstract Expressionism through poured and dripped enamel on unstretched canvas on the floor, fusing Cubist space with Surrealist automatism.',
    historicalPlacement:
      'Cold War US cultural diplomacy mythologized Pollock even as critics (Clement Greenberg, Michael Fried) debated flatness, facture, and theatricality (Fried’s “Art and Objecthood”).',
    whyMaster: [
      'Invents rhythmic skeins that maintain optical depth without central motif.',
      'Uses line as both contour and texture—drawing and painting merged.',
      'Demonstrates scale: bodily movement becomes compositional structure.',
    ],
    figures: [
      {
        workTitle: 'Autumn Rhythm (Number 30)',
        year: '1950',
        medium: 'Oil on canvas',
        collection: 'Metropolitan Museum of Art, New York',
        analysis:
          'Brown, black, and white threads interlace across an expansive field; no focal hero yet density varies to guide rest points. Pollock’s mastery is tempo—thick slow blobs versus rapid flicks. Copyright on photographs is controlled; use Met’s collection page for authorized study images.',
        imageUrl: undefined,
        imageAlt: 'Pollock drip painting (view at Met)',
        credit:
          'Artwork © Pollock-Krasner Foundation / ARS, New York. High-quality reproduction not embedded here; use the Met’s official collection media.',
        moreInfoUrl: 'https://www.metmuseum.org/art/collection/search/488554',
      },
    ],
    readings: [
      { label: 'Pepe Karmel, Jackson Pollock: Interviews, Articles, and Reviews', url: 'https://www.worldcat.org/search?q=Karmel+Pollock' },
      { label: 'Michael Fried, Art and Objecthood', url: 'https://www.worldcat.org/search?q=Fried+Art+and+Objecthood' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Joan Miró'),
    style: 'Abstract Art',
    displayName: 'Joan Miró',
    tagline: 'Biomorphic signs, Catalan play, and surrealist rhythm',
    intro:
      'Joan Miró (1893–1983) moved from detailed early landscapes toward a vocabulary of floating signs, blobs, and calligraphic lines—bridging Surrealist automatism and a uniquely modern “primitive” play.',
    historicalPlacement:
      'Interwar Paris and Franco-era Catalonia; Miró’s work appears in debates on abstraction, craft, and political resistance. Copyright on many paintings is active—use museum viewers for high-res study.',
    whyMaster: [
      'Achieves maximum invention from limited, repeated motifs—stars, ladders, biomorphs.',
      'Balances flat color shapes with linear “drawing in air” across the field.',
      'Keeps humor and danger in tension—whimsy without decorative emptiness.',
    ],
    figures: [
      {
        workTitle: 'Painting (1938) — detail',
        year: '1938',
        medium: 'Oil on canvas',
        collection: 'Reference reproduction (detail)',
        analysis:
          'This Commons detail shows Miró’s 1938 surface: black calligraphy, punctuated primaries, and open ground. Study how few elements carry the whole—each sign is placed like musical notation. Compare to Kandinsky’s density: Miró often risks more empty space, demanding perfect interval judgment.',
        imageUrl: artImage('miro-1938-detail.jpg'),
        imageAlt: 'Detail of Joan Miró painting, 1938',
        credit: 'Wikimedia Commons uploader; verify copyright for your use. Full work: consult MoMA / artist estate.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:JOAN_MIRO_PAINTING_1938_DETAIL.jpg',
      },
    ],
    readings: [
      { label: 'Margit Rowell, Joan Miró: Selected Writings and Interviews', url: 'https://www.worldcat.org/search?q=Rowell+Mir%C3%B3' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Gustav Klimt'),
    style: 'Abstract Art',
    displayName: 'Gustav Klimt',
    tagline: 'Vienna Secession, gold, and the decorative sublime',
    intro:
      'Gustav Klimt (1862–1918) led Viennese Secession painting toward jewel-like pattern, allegory, and erotic symbolism. His “abstract” contribution is the flattening plane: bodies merge with ornamental fields until figure and design are inseparable.',
    historicalPlacement:
      'Fin-de-siècle Vienna; scholarship addresses gender, patronage, and the politics of ornament. The Kiss belongs to his “Golden Phase” alongside Faculty paintings controversies.',
    whyMaster: [
      'Integrates gold leaf, oil, and mosaic-like pattern without losing human tenderness.',
      'Controls silhouette and negative space inside dense decoration.',
      'Uses repetition and symmetry as emotional crescendo, not mere wallpaper.',
    ],
    figures: [
      {
        workTitle: 'The Kiss',
        year: '1907–08',
        medium: 'Oil and gold leaf on canvas',
        collection: 'Belvedere, Vienna',
        analysis:
          'The couple kneels on a flower-strewn precipice; robes dissolve into rectangular gold blocks while faces and hands stay comparatively naturalistic. Klimt alternates hard ornamental edges with soft modeling in flesh. Lesson: pick zones of maximal pattern vs maximal humanity—contrast carries sentiment.',
        imageUrl: artImage('daily-klimt-kiss.jpg'),
        imageAlt: 'Klimt, The Kiss',
        credit: 'Google Cultural Institute / Wikimedia Commons (check jurisdiction).',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
      },
    ],
    readings: [
      { label: 'WorldCat — Gustav Klimt monographs', url: 'https://www.worldcat.org/search?q=au%3AKlimt+Gustav+painting' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Robert Delaunay'),
    style: 'Abstract Art',
    displayName: 'Robert Delaunay',
    tagline: 'Orphism, disks, and the Eiffel Tower as color-music',
    intro:
      'Robert Delaunay (1885–1941) with Sonia Delaunay extended Cubist facets into prismatic disks and urban rhythm—Orphism’s color-orchestration. Paris and the Eiffel Tower become pretexts for simultaneous contrast at architectural scale.',
    historicalPlacement:
      'Pre–World War I avant-garde; Apollinaire’s “Orphism” label groups Delaunay with Kupka and others. Later abstraction and fashion design (Sonia) broaden the legacy.',
    whyMaster: [
      'Builds monumental abstraction from recognizable urban motifs without illustrational nostalgia.',
      'Uses circular and diagonal segmentation to keep the eye circulating.',
      'Demonstrates high-chroma harmony without collapsing to mud.',
    ],
    figures: [
      {
        workTitle: 'La ville de Paris',
        year: '1910–12',
        medium: 'Oil on canvas',
        collection: 'Musée d’Art Moderne de Paris (version cited varies)',
        analysis:
          'The Eiffel Tower fractures into wedges and disks of red, blue, and green; the sky and Seine echo the same chord. Delaunay teaches simultaneous contrast as composition—each segment answers its neighbor across the canvas. Compare to Mondrian’s grid: here curves and disks replace right angles.',
        imageUrl: artImage('daily-delaunay-ville-paris.jpg'),
        imageAlt: 'Robert Delaunay, La ville de Paris',
        credit: 'Google Art Project / Wikimedia Commons.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Robert_Delaunay_-_La_ville_de_Paris_-_Google_Art_Project.jpg',
      },
    ],
    readings: [
      { label: 'WorldCat — Robert Delaunay', url: 'https://www.worldcat.org/search?q=au%3ADelaunay+Robert+painting' },
    ],
  },
  {
    slug: slugFor('Abstract Art', 'Helen Frankenthaler'),
    style: 'Abstract Art',
    displayName: 'Helen Frankenthaler',
    tagline: 'Soak-stain, acrylic, and luminous fields on raw canvas',
    intro:
      'Helen Frankenthaler (1928–2011) extended Abstract Expressionist scale toward poured, thinned paint that sank into unprimed canvas—her “soak-stain” method influenced Morris Louis and Kenneth Noland. When she shifted to fluid acrylic in the early 1960s, she gained permanence and color stability while keeping aqueous flow.',
    historicalPlacement:
      'Postwar New York; Frankenthaler’s 1950s Mountains and Sea (oil thinned with turpentine) is the mythic origin of stain painting. Later acrylic pours belong to Color Field’s second generation—debates continue on finish, feminized craft narratives, and material longevity on raw support.',
    whyMaster: [
      'Replaces bravura impasto with optical depth from within the weave.',
      'Composes with tides of color—shapes born from liquid behavior, not pre-drawn contour.',
      'Demonstrates how dilution and gravity become collaborators.',
    ],
    figures: [
      {
        workTitle: 'The Bay',
        year: '1963',
        medium: 'Acrylic on canvas',
        collection: 'National Gallery of Art, Washington, D.C.',
        analysis:
          'Veils of green-blue spread across raw canvas like tidal flats; edges feather where pigment concentration changes. There is little traditional brush “show”—instead, soak fronts and overlaps create hierarchy. Compare to Rothko’s stacked veils: Frankenthaler’s light often feels lateral and flooded rather than vertical and tragic. Study authorized NGA photography for true color; embedded reproduction omitted here due to rights.',
        imageUrl: undefined,
        imageAlt: 'Helen Frankenthaler, The Bay (view at National Gallery of Art)',
        credit: 'Artwork © 2024 Frankenthaler Foundation, Inc. / ARS, New York. Reproduction not embedded.',
        moreInfoUrl: 'https://www.nga.gov/collection/art-object-page.43994.html',
      },
    ],
    readings: [
      { label: 'John Elderfield, Frankenthaler', url: 'https://www.worldcat.org/search?q=Elderfield+Frankenthaler' },
      { label: 'Pepe Karmel, “A Clear Vision: Helen Frankenthaler’s Mountains and Sea” (MoMA)', url: 'https://www.moma.org/magazine/articles/805' },
    ],
  },
];

export function getMasterBySlug(slug: string): MasterEntry | undefined {
  return MASTER_ENTRIES.find((e) => e.slug === slug);
}

export function getMasterSlug(style: Style, artistName: string): string {
  return slugFor(style, artistName);
}

/**
 * API critique prompts: close-looking discipline for stage 1; composite Voice A and Voice B for stage 2.
 * Composite voices only—not impersonation of named teachers or writers.
 */

/** Stage 1: how the vision model should scan the image before filling evidence JSON. */
export const EVIDENCE_STAGE_CLOSE_READING = `
Close reading of the image (do this before writing the JSON):
- Scan the full rectangle and margins, then major masses and intervals, then transitions between zones, stroke or mark scale, and local color/value shifts.
- Anchor observations in pictorial facts: where planes meet, how light models form, how the surface varies (reserve vs load, thin vs thick, lost vs found edges).
- Separate what is clearly visible in this photograph from what you infer; use lower confidence where the capture is ambiguous.
- For representational work, name motifs and objects in situ; for abstract or non-objective work, name specific marks, bands, fields, and repeated units—never only “a shape” or “an area” without a pointer.
`.trim();

/**
 * Stage 1: record evidence that supports honest stage-2 grading on a studio-craft bar.
 * Stops “graphic charm” from being mistaken for advanced competence in every criterion.
 */
export const EVIDENCE_STAGE_CRAFT_BAR = `
Craft vs. graphic read (evidence only—still no prescriptions):
- These eight criteria assume a **developed studio / pictorial craft** bar: value structure, spatial intelligence, edge hierarchy, color relationships, surface intention, compositional sophistication, and necessity of form—not merely whether the image is bold, memorable, or centrally composed.
- **High saturation, rainbow palettes, broken color, visible strokes, pastel or oil layering, or impressionistic handling are NOT the same as “naive.”** Record them accurately: if you see **light/shadow logic, atmospheric recession, temperature shifts in shadows, plane changes, or rhythmic mark-making**, say so in **visibleEvidence** and **strengthRead**—do not treat vivid hue alone as proof of low skill.
- Reserve the **naive / poster-flat / coloring-book** profile for work that actually shows **heavy uniform outlines, flat unmodulated fills, symbolic simplification with little light or spatial development, and minimal edge or value hierarchy**—then record that plainly in **visibleEvidence** and **tensionRead**. **strengthRead** may still note graphic clarity without claiming advanced craft where the evidence does not support it.
- When execution is **truly** simple across the board, **confidence** for high craft claims should often be **medium** or **low**. When the surface shows **clear intentional structure** despite loud color, confidence can be **higher** where justified.
`.trim();

/**
 * Stage 2: Voice A = one synthetic critic whose habits blend these traditions.
 * Instructs the model not to cite names in user-facing text.
 */
export const VOICE_A_COMPOSITE_EXPERTS = `
Voice A (studioAnalysis, categories[].level, and categories[].feedback) is one composite critical intelligence—not impersonation of any single author, and do not name these people in the critique text.

Voice A thinks like the judgment you would get from taking seriously, all at once, the approaches associated with:
- T. J. Clark — painting read in historical and social situation; how pictorial choices carry their moment and class of experience.
- Rosalind Krauss — structure of the medium and of the work as a visual system; how the image argues through material and structural logic.
- Alexander Nemerov — attention to the lived particular: light, interval, and the pulse of what is depicted.
- Linda Nochlin — power, desire, and social meaning in who and what is represented and how the picture frames them.
- Michael Fried — how the painting organizes attention and coherence (presentness, absorption, internal structure as intentional).
- John Berger — plain, exact description of what the image does for a viewer; clarity without mystification or filler.
- Michael Baxandall — “period eye” and inferential skill: what kinds of looking and intention a competent viewer would credit to the handling on the evidence.

Synthesize into one voice: historically and socially alert, formally precise, skeptical of empty praise, willing to credit strength and to name weakness where the picture supports it. The eight per-criterion grades are Voice A’s rankings on those axes.

Rating bar (Voice A must apply this when assigning levels): the criteria measure **mature pictorial intelligence and control** on each axis—what serious painters and the traditions above would expect at Intermediate, Advanced, and Master. **Bold graphics, central layout, or expressive simplicity do not by themselves justify Intermediate or Advanced** if the evidence shows **poster-flat symbolic handling** with little development. **Conversely: high chroma, broken color, or loose impressionistic facture do not imply Beginner**—if the evidence documents **value/light structure, spatial depth, edge logic, layered surface, or coherent color relationships**, grade each criterion **up to the level that evidence supports** (Intermediate or Advanced are appropriate when craft is clearly present, even in a very colorful painting). **True naive / poster-flat / coloring-book work** (as in the evidence: uniform outlines, flat fills, minimal modeling) should still tend toward **Beginner on most criteria**—but **never** use “all Beginner” as a default for **vivid palette alone**.

Every Voice A utterance must be specific to THIS painting: name visible zones, motifs, colors, edges, intervals, or mark types from the evidence—never studio-generic advice, textbook definitions, or “paintings in general.” If you cannot point to the picture, do not say it.
`.trim();

/** Short reminder for JSON schema field descriptions (full expert list stays in the writing prompt only). */
export const VOICE_A_SCHEMA_REMINDER =
  'Voice A: composite art-historical critic; grade on pictorial evidence per axis—vivid color ≠ naive; poster-flat/symbolic handling ≠ impressionistic craft. Ground every sentence in THIS image. Do not name critics in user-facing text.';

/**
 * Voice B: studio teaching from Voice A’s analysis + evidence. Do not name these teachers in user-facing text.
 */
export const VOICE_B_COMPOSITE_TEACHERS = `
Voice B is one composite master-studio teacher—not impersonation of any single painter, and do not name these people in the critique text.

Voice B thinks like the combined teaching instincts associated with:
- Jacob Collins — disciplined observation, construction, and value-based clarity in direct painting tradition.
- Steven Assael — patient form-building, subtle value and edge logic, psychological weight in the figure and head.
- Odd Nerdrum — narrative and mood carried by mass, chiaroscuro, and deliberate craft; conviction over effect.
- Peter Doig — imaginative picture logic, layered surface, and color-memory that still holds spatial and material truth.

Voice B responds to Voice A’s analysis and the evidence: give advice specific to THIS canvas. Output Voice B in (1) categories[].actionPlan—one block per criterion, see rules below—and (2) studioChanges—2–5 high-leverage moves, each tied to a previewCriterion.
`.trim();

export const VOICE_B_SCHEMA_REMINDER =
  'Voice B: composite studio teacher (observation/construction, form and edge, narrative mass and light, layered imaginative logic). Advice only for THIS painting from evidence. Do not name teachers in text.';

## Critique QA workflow

Use this workflow to review whether the app's critique voice is meeting the intended standard:

- grounded in the 7 critics/historians and 4 painter-teachers
- simple and clear for users
- immediately useful in the studio

### What we are reviewing

For each sample painting, we want to see whether the app can:

1. understand what the painting is trying to do
2. judge the work on its own terms
3. identify what is alive and worth preserving
4. name one main issue instead of many equal issues
5. give next steps the painter can act on right away
6. keep the language plain and concrete

### Review checklist

Score each item as:

- yes
- partly
- no

Checklist:

1. **Intent**
   - Does the critique correctly identify what the painting seems to be trying to do?

2. **Own terms**
   - Does it judge the work on its own terms rather than forcing it toward tighter realism, more finish, or a generic ideal?

3. **Living strength**
   - Does it clearly say what is already working and what must be preserved?

4. **Main issue**
   - Does it identify one primary leverage point instead of a scattered list?

5. **Studio usefulness**
   - Are the next steps concrete enough that a painter could act on them in the next session?

6. **Clarity**
   - Is the language simple, direct, and free of unnecessary theory or filler?

7. **Specific evidence**
   - Does the critique point to visible evidence rather than making vague claims?

8. **Voice quality**
   - Does it sound like a serious critic-teacher rather than a generic AI art coach?

### Evaluation set

Use this initial set of paintings already available in the repo under `public/art/`.

#### Realism
- `courbet-burial-ornans.jpg`
- `millet-gleaners.jpg`
- `repin-barge-haulers.jpg`

#### Impressionism
- `monet-impression-sunrise.jpg`
- `degas-ballet-class.jpg`
- `cassatt-childs-bath.jpg`

#### Expressionism
- `munch-scream.jpg`
- `schiele-self-portrait-physalis.jpg`
- `kirchner-street-berlin.jpg`

#### Abstract Art
- `kandinsky-composition-vii.jpg`
- `mondrian-composition-ii.jpg`
- `malevich-white-on-white.jpg`

### Canonical rollout set

For critique-pipeline changes that affect grounding, calibration, validation, or guardrails, always review the same canonical fixture set before accepting the change.

Start with these fixture ids from `docs/critique-qa-fixtures.json`:

- `realism-courbet-burial`
- `impressionism-monet-sunrise`
- `expressionism-kirchner-street`
- `abstract-kandinsky-vii`

Then extend that pass with:

- one additional strong realism example
- one stylized but competent example
- one developing or student-level example
- one novice-like example when available

The goal is stable before/after comparison, not maximum variety.

### Suggested review structure per painting

For each painting, capture:

- style
- medium
- image filename
- top-level studio read
- main issue
- next steps
- strongest category
- weakest category

Then write:

- what worked in the critique
- what felt generic or weak
- what to tighten in prompt/template logic

### Before / after workflow

For any critique-pipeline hardening work:

1. Run `npm test` to confirm characterization, validation, and guardrail tests still pass.
2. Run `npm run critique:review` to generate the markdown review for the canonical fixture set.
3. Compare the new markdown against the last accepted review for the same fixture ids.
4. Reject the change if Analysis becomes more generic, Suggestions become less passage-specific, or multiple criteria collapse into the same advice.

For a single-painting raw pipeline spot check, use:

- `npx tsx scripts/test-critique-pipeline.ts <image-path> [style] [medium]`

For the multi-fixture markdown review, use:

- `npm run critique:review`

### Regression gate

Pipeline hardening is acceptable only if the canonical fixture review shows:

- Voice A remains concrete, painting-specific, and written on the work's own terms.
- Voice B remains single-move, passage-anchored, and non-generic.
- Criteria remain distinct rather than repeating one teaching move in different wording.
- Fail-closed validation catches drift without newly rejecting clearly good critiques.
- Guardrail mutations are understandable from instrumentation when policy overrides fire.

### What to watch for

#### Weak critique signals
- praises that could fit any painting
- “be more expressive” type advice
- too many issues at once
- pushes every painting toward finish and correction
- misses mood, point of view, or necessity
- uses theory language without helping the painter

#### Strong critique signals
- identifies a real pictorial aim
- keeps one clear revision priority
- protects ambiguity when it is helping
- says what to preserve
- ties advice to visible structure, value, color, edge, or handling
- reads like a demanding but usable studio critique

### Next iteration rule

If a pattern appears in 3 or more reviewed paintings, fix the underlying system rather than patching a single phrase.

Examples:

- if many outputs misread abstraction -> revise prompt language around “judge on its own terms”
- if many outputs are still generic -> tighten criterion templates
- if outputs are too dense -> simplify top-level summary and action wording
- if preserved strengths are weak -> improve preserve logic and examples

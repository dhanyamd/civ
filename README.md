# Material Studio

Sustainable material selection from a 3D building model. Click any element of a
building, see what it is made of, what that costs in money and embodied carbon,
and which lower-impact materials could take its place.

React 18 · TypeScript · Vite · Tailwind · three.js · web-ifc · OpenRouter (`google/gemini-3.8-flash`)

```bash
npm install
npm run dev        # http://localhost:5173
```

`.env`:

```
OPENROUTER_API_KEY="sk-or-v1-..."
AI_MODEL="google/gemini-3.8-flash"   # optional, this is the default
GROQ_API_KEY="gsk_..."               # optional fallback, used only if the above is absent
```

Keys are read server-side only — by the Vite dev middleware in development and
by `server/index.mjs` in production — and never reach the browser. Swap models
by changing `AI_MODEL`; any OpenAI-compatible chat model on OpenRouter works.

---

## The idea

Pick a building, click a column or a facade panel, and the app tells you what it
is built from, how much of the building's carbon sits in it, and what you could
build it from instead. The substitution list is filtered to what is structurally
legitimate for that element and then reviewed by a model acting as engineer of
record, which will reject options that do not work.

## Where the carbon numbers come from

**31 of the 51 materials carry a real, published EPD.** They are downloaded
from [Ökobaudat](https://oekobaudat.de), the German federal construction
materials LCA database, by `scripts/fetch-epds.mjs`, which writes
`src/data/epds.json`. Every record keeps its UUID, so the app can link straight
to the source document and the figure is auditable:

```
concrete C30/37   0.1147   Transportbetonwerk Aachen-Haaren, 2025, EN 15804+A2
structural steel  0.5598   Structural Steel: Sections and merchant bars
green steel       0.2819   SALCOS® Beams and Sections
CLT               0.2498   Cross-laminated timber    (biogenic −1.616)
glass unit        1.7807   Insulated glazing, double pane
aluminium         6.2860   Aluminium profiles
```

Regenerate with `node scripts/fetch-epds.mjs`; diagnose a failing query with
`node scripts/probe-epds.mjs "<search term>"`.

### Why the model is never asked for a number

An LLM asked for a carbon factor returns a plausible figure from memory that
differs between runs and cites nothing. Embodied carbon is *measured* — plant
energy, fuel mix, transport — and third-party verified; that document is the
EPD. So the dataset supplies every number and the model only writes prose.

### What the importer had to get right

- **GWP-fossil, not GWP-total.** Under EN 15804+A2 a CLT panel's GWP-total is
  about −641 kgCO2e/m³ because the standard counts the carbon the tree absorbed.
  Comparing that against concrete would be nonsense, so GWP-fossil is the
  comparable headline and biogenic uptake is reported separately.
- **Unit notation.** Ökobaudat writes area as `qm` on most datasets and `m^2` on
  others. Matching only the SI spelling silently rejected every plasterboard,
  glass unit and membrane in the database.
- **Not the stated conversion factor.** Datasets disagree on whether
  "conversion factor to 1 kg" means kg per declared unit or its reciprocal,
  which produced a factor six orders of magnitude out. Only gross density and
  grammage are trusted, behind a plausibility gate of 0.001–30 kgCO2e/kg.
- **Hard `require` gates per material.** Without them a C12/15 mix stood in for
  structural C30/37, SALCOS green steel became the conventional steel baseline,
  and "non-**slated** bitumen sheet" matched natural slate.

### The 20 materials without an EPD

Reclaimed steel and timber, basalt rebar, LC3, geopolymer and CO2-cured
concrete, mycelium composite, laminated bamboo, zinc, slate and limestone have
no usable Ökobaudat record. Their figures stay as industry estimates and are
labelled **Estimate** in the UI, against a **Verified EPD** badge for the rest.
The **EPD only** switch in the header — on by default — keeps unevidenced
materials out of the substitution lists entirely.

That gap is worth noticing rather than hiding: the materials with the best
carbon story are often the ones with the thinnest data behind them.

**Costs are indicative rates throughout.** No free dataset equivalent to
Ökobaudat exists for pricing, and the UI says so.

## How the quantities are produced

- **Geometry is the quantity take-off.** Each parametric element declares the
  boxes it draws; net volume is that box volume × the element's `solidity` ×
  each material's composition fraction. The same data draws the model and
  schedules it, so the figures cannot drift from what you are looking at.
- **`solidity`** is how much of the drawn envelope is real material. A 305×305
  UC drawn as a 360 mm box is 13.5% steel; a 90 mm window band is 15% glass and
  frame and the rest air.
- **Substitutions are compared at equal volume**, stated plainly on screen. An
  earlier version applied resize multipliers for equal structural duty; they
  were removed because they were the author's rules of thumb rather than
  measured data. If a substitute really needs a bigger section, the model's
  written review says so.

## Real IFC models — where the materials actually come from

`.glb` is a *rendering* format. It stores how a surface should look, not what
it is built from, and public GLB buildings prove it: Khronos' Virtual City has
materials named `VMtl01`, `_22jyj`, `Scrape04`.

**IFC is different.** It is the open BIM standard Revit exports to, and it
carries the material every element was specified with:

```
IFCMATERIAL('Concrete, Cast-in-Place gray')
IFCMATERIAL('Metal - Steel - 345 MPa')
IFCMATERIAL('Masonry - Brick')
IFCMATERIAL('Roofing - EPDM Membrane')
```

The app parses IFC with `web-ifc` (lazy-loaded, it is a few MB), reads each
element's `IfcRelAssociatesMaterial`, and measures volume from the file's own
geometry. So for an IFC model nothing about the material or the quantity is
invented here — both come out of the file.

`src/lib/ifcMaterialMap.ts` maps those raw strings onto the carbon dataset by
ordered regex rules. The mapping is shown in the UI — raw IFC name above, the
matched dataset entry and its factor below — so a wrong match is visible rather
than buried. An unmatched name is reported as unmatched and gets no number.

**Generate** steps through the catalogue, which is listed live from the
web-ifc public test corpus at runtime (`src/lib/ifcCatalogue.ts`). Roughly 25
real buildings, smallest first. Nothing is bundled into this repo, so no
third-party licence rides along.

## Layout

```
server/insight.mjs   Groq handler, framework-free (no HTTP coupling)
server/http.mjs      request plumbing shared by dev middleware and prod server
server/index.mjs     production server: serves dist/ + /api
vite.config.ts       mounts the same /api handler in dev

src/data/materials.ts        carbon + cost database, with sources and hazards
src/data/swapRules.ts        swap pools, equal-duty resizing, thermal lambdas
src/data/buildings/*.ts      the parametric models — geometry + schedule
src/lib/quantities.ts        take-off, rollup, substitution deltas
src/lib/sceneBuilder.ts      one merged mesh per scheduled element
src/components/studio/*      viewer, library, panels
```

## Deploy

Any Node host:

```bash
npm run build
PORT=8080 GROQ_API_KEY=gsk_... npm start
```

Serves the built SPA and `/api` from one process. Set `GROQ_API_KEY` as an
environment variable in the host's dashboard rather than shipping `.env`.

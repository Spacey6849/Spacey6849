# Maintenance notes

Only `README.md` renders on the profile. Everything else here exists to generate the poster it embeds.

## Repo requirement

For this to show at <https://github.com/Spacey6849>, the repo must be **named exactly `Spacey6849`** (repo name == username), public, with `README.md` at the root.

## How the cards work

No third-party card services. `scripts/generate-cards.mjs` queries the GitHub GraphQL API and LeetCode's public GraphQL endpoint, then writes two SVGs into `assets/`:

```
profile-dark.svg    profile-light.svg      the poster
moon-dark.png       moon-light.png        60-frame sprite sheet, inlined
space-grotesk.woff2                        subset display face, inlined
astronaut-sprite.png                       packed pixel art, inlined
```

**Everything is one SVG.** Identity, stack, GitHub stats, LeetCode and contact links all sit inside a single 880×1652 poster — one frame, one starfield drifting behind the whole thing, one entrance cascade running top to bottom. It was three separate cards before; merging them means the sections share continuous motion instead of each restarting its own.

The README picks between the two files with `<picture>` + `prefers-color-scheme`, so the poster follows GitHub's light/dark theme. Palette is strictly greyscale — no colour anywhere. Dark reads as deep space; light reads as a printed star chart.

### How the sections stack

`SECTION` in `cards.mjs` holds each block's height. Each section is a pure function taking the `y` it starts at and positioning its contents relative to that, and the poster lays them out by running total. Resizing a section shifts everything below it automatically — no coordinate below needs re-deriving.

```
identity  196   stack  measured   github  646   leetcode  368   links  108
```

The stack is the exception: its chips flow and wrap, so how tall it is depends on how many rows they need. `layoutStack()` therefore returns its own height and the poster substitutes that while stacking, rather than trusting a constant that would silently drift out of date whenever a tech is added.

If LeetCode is unreachable its section is dropped and the poster is simply shorter.

### Stack chips

65 chips across 9 groups — languages, frontend, backend, data, ai, hardware, testing, infra, tools — with 61 carrying a real simple-icons mark drawn in the poster's ink. Brand colours would break the single palette. `bullmq`, `groq`, `matplotlib` and `playwright` have no upstream mark and render label-only.

Two upstream slugs are not what you would guess: CSS is `css3`, and Playwright is absent from simple-icons entirely.

Widths are computed from the label (monospace advance is ~0.6em) and wrap against the right edge, so nothing overflows regardless of what gets added.

Group keys are set uppercase, tracked, muted, and **right-anchored** against the chip column. They were bold white and left-aligned, which put them at nearly the weight of the chips they introduce, and left their ragged right edges facing a hard chip edge. Right-anchoring gives every key the same right edge (`x=112`) and the tracking places them below the section label in the hierarchy.

**The astronaut is an exclusion zone.** He floats inside this section, and rows level with him wrap early — `rightEdgeAt(y)` returns his left edge instead of the margin. Before that the rows simply ran full width and he covered whichever chips landed underneath, which is exactly what happened when the stack grew from 37 chips to 65. Each chip breathes its fill between 7% and 15% opacity on a staggered loop.

This is what took the two posters from 384 KB to 504 KB — 34 more vector paths.

### What cannot go in the SVG

**Links.** An SVG embedded through `<img>` cannot be interactive — an `<a>` inside it is dead, and so is `currentColor`. `<object>`, `<embed>`, inline `<svg>` and `<map>` are all stripped by GitHub's sanitiser, so there is no way around it.

The README is now the poster and nothing else, so **nothing on the profile is clickable**. The contact chips in the poster show the handles as text; a visitor has to type them. If that ever needs to change, the fix is a markdown row of linked images underneath — which is what used to be there.

### Profile views

The count under the location comes from komarev's counter badge, read at build time and drawn into the poster.

**Reading it increments it.** The badge counts requests, so the daily workflow adds roughly 365 a year on top of real visits. That was a deliberate, accepted trade — it is the only way to get a live number into an SVG that cannot fetch anything itself.

Two alternatives were checked and rejected:

- **GitHub's traffic API** (`/repos/{owner}/{repo}/traffic/views`) counts *repo* views. For a profile repo it reads **1**, because profile pages do not register there. Baking that number in would be wrong.
- **Embedding the badge inside the poster** is impossible; an SVG behind an `<img>` cannot fetch anything.

If the inflation ever needs correcting, `komarev.com/ghpvc/?...&base=N` offsets by a known amount. A failed fetch drops the line rather than failing the run.

## Animation

Motion is layered. A one-shot entrance cascade plays on load — text rises, figures pop, the trajectory draws itself while the area fill wipes in behind it, bars grow, heatmap cells ignite on a diagonal sweep. Then ambient loops take over and never stop: three parallax star layers drift at different speeds, the nebula swells and settles, fourteen shooting stars streak diagonally at staggered intervals, the moon turns while three satellites orbit it, a probe runs the contribution trajectory, bars hold a slow brightness swell, and lit heatmap cells breathe out of phase.

Three constraints shaped how this is built:

- **Animation lives only in the `<style>` block; nothing starts hidden via an attribute.** If a sanitiser ever strips `<style>`, the cards still render correctly — just static. This is why you will not find `opacity="0"` anywhere.
- **No JavaScript, no external references.** SVGs embedded through `<img>` cannot run scripts or fetch anything, so it is CSS keyframes only.
- **`prefers-reduced-motion: reduce` removes the motion that actually causes discomfort, not every animation.** Suppressed: only the parallax star drift, which is constant full-field motion. Everything else keeps running, shooting stars included, with the ship and probe at roughly half speed. The ship and probe run at roughly half speed there (44s and 18s). Entrance moves become plain fades.

  Two earlier versions got this wrong in opposite directions: the first killed every animation outright and made the poster look broken; the second still suppressed the ship, which is the one thing most people watch.

### If nothing appears to animate

Check the machine, not the SVG. **Windows → Settings → Accessibility → Visual effects → Animation effects.** With that off, `SPI_GETCLIENTAREAANIMATION` reports `0`, Chrome reports `prefers-reduced-motion: reduce`, and the poster falls back to the reduced set above. This machine currently has it **off** — so the moon and its satellites still turn, but the parallax, comets and ship stay still until the setting is on.

Verified that GitHub keeps `<style>` and `@keyframes` in proxied SVGs — the same technique `github-readme-streak-stats` uses.

### The transform-box trap

Cards set `*{transform-box:fill-box}` so rotations and scales measure against each element's own box. That is what makes bars grow from their left edge — but it also broke the orbiting satellites: a group's box was the satellite itself, so it spun in place instead of going around the moon. Each rotating group now contains an invisible circle sized `orbitRadius + satelliteRadius`, which recentres the box on the moon. Measured orbit centre is exactly `726, 104`.

### Seamless parallax

Each of the three star layers holds its stars **twice**, the second copy offset by exactly one card width, and slides left by exactly that width per cycle. When the loop restarts, the second copy is sitting precisely where the first began, so there is no visible jump. Layer speeds are 190s / 120s / 74s — slower reads as further away.

This doubles the star markup: 520 circles across the three layers. With the calendar grid and the inlined moon sheet the two posters come to 384 KB. Well inside anything GitHub cares about.

### The contribution calendar and the ship

The GitHub-style grid is the real thing: one column per week, Sunday at the top, five intensity bands, month labels along the top, `mon`/`wed`/`fri` down the side, and a `less → more` legend. 366 days, 216 of them lit.

Two details worth keeping:

**The leftmost month is never labelled.** It is a partial week or two, and labelling it pushes a stub up against the next month and squeezes that one out — which is how `sep` went missing on the first attempt. Seeding it as "previous" without emitting a label gives all twelve. GitHub's own calendar behaves the same way.

**A ship flies the commits.** Its route is not decorative: `commitRoute()` threads a Catmull-Rom spline through one committed square per week, so the ship only ever passes over days that actually have contributions. Weeks with nothing are skipped. Verified: 45 waypoints, all 45 on lit cells, 0 on empty ones — matching exactly the 45 of 53 weeks that have commits.

Choosing each week's *busiest* day was the obvious first cut and flew terribly. Adjacent weeks can peak six rows apart, and six rows over a 14px column is an ~80 degree climb, so the ship spent most of the year pointing straight up or down. Two changes fixed it without ever leaving a lit square:

1. Take the committed day **closest to the previous waypoint's row**, breaking ties toward the busier day.
2. Pull each row toward its neighbours' average, then **snap back onto a row that week actually has**.

Median segment went from near-vertical to 18 degrees, with only 6 of 44 segments still steeper than 45 — and those sit where the contributions genuinely are sparse.

Straight lines between cells made it jerk at every waypoint; the spline keeps the heading continuous so `offset-rotate: auto` banks it cleanly. It runs on a 26s loop with a flickering thruster and a dashed track showing the trail.

The ship itself is drawn nose-first along +x so `offset-rotate: auto` aims it down the path. It was a bare 16px arrowhead until it got a proper silhouette — hull, swept wings, tail fins, engine nozzle and canopy, about 36px long. At that size detail is invisible and the outline does all the work, which is why the wings and engine matter and the canopy highlight does not.

To judge any of this you have to *look* at it. `pymupdf` rasterises an SVG straight to PNG with no native dependencies, which beats the alternatives: `renderPM` needs a C backend, and reading a PDF needs poppler. Note that a static rasteriser ignores CSS, so the ship renders at its authored origin rather than along `offset-path` — to see it in place, evaluate the route's Béziers and stamp the ship at a few points first.


### The transform-box trap, part two

`*{transform-box:fill-box}` was applied to every element so that bars could scale from their left edge. That turned out to also distort **plain translations that compose with an ancestor rotation** — which is why the first batch of shooting stars flew dead horizontal despite a `rotate(26)` on the parent.

Measured on a minimal case, translating 100px along a 45°-rotated parent:

```
without fill-box   (120.7, 120.7)   correct
with    fill-box   (147.0,  51.2)   wrong
```

No per-element `transform-box` override fixes it — `view-box`, `content-box` and `stroke-box` all produced the same wrong result. The fix is to stop using `*` and scope the property to the elements that genuinely scale or rotate about their own box: `.pop .grow .wipe .ignite .halo .planet .thruster .orbit*`.

A warning for measuring this sort of thing: **`getScreenCTM()` does not account for CSS transforms**, only SVG attribute transforms. Using it to check the orbiting satellites made them look frozen when they were rotating perfectly well. Compare `getComputedStyle(el).transform` instead.

### The astronaut

`assets/Astronaut.png` is the source art; `scripts/build-astronaut.py` packs it to `astronaut-sprite.png` (240x272, 64-colour palette, ~70 KB) which the poster inlines as a data URI. He sits in the empty gutter right of the stack chips and drifts on a 14s cycle — a bob plus a slight roll, on offset phases so the loop does not read as a metronome.

Resampling uses NEAREST, not LANCZOS: this is pixel art, and smooth resampling invents intermediate colours that both soften the edges and cost bytes. He is the one deliberately coloured thing on an otherwise greyscale card.

**A warning written in blood.** The first version of that script wrote to `assets/astronaut.png` while reading `assets/Astronaut.png`. Windows paths are case-insensitive, so those are *the same file* — the run silently destroyed the 1199x1312 original, and it had never been committed, so git could not bring it back. The script now refuses to run when source and output resolve to one path. If you ever add a similar build step, compare `.resolve()`, not the strings.

### The display face

The two faces split by *what the text is*, not by where it sits:

- **Space Grotesk** — the name, section headings, every figure, and prose captions: "contributions in the last year", "current streak", "active days", "easy / medium / hard".
- **Monospace** — identifiers and data: stack chip labels, language names, handles, dates, month and weekday labels, the legend, and every numeric value like `3 / 2105` or `49%`.

The first version set the captions in mono too, which left prose sitting in a code face beside display headings and made the hierarchy read soft. Splitting on meaning rather than position fixed it.

One caution when moving anything to the display face: **its widths are proportional**, while several layout helpers estimate label width from a monospace advance of ~0.6em. `barRow`'s `labelGap` and `chipWidth` both do. Anything switched to display needs the collision check re-run, not just a glance.

`scripts/build-font.py` downloads the Latin subset from Google Fonts and cuts it to the 103 glyphs the poster can draw: **22 KB to 8.6 KB**. It is a variable font, so one file covers both 400 and 700. Space Grotesk is SIL OFL 1.1, which permits embedding. Re-run it only if the character set changes.

The font is inlined as a base64 data URI for the same reason as the moon sheet: an SVG behind an `<img>` cannot fetch anything, so a linked webfont renders nothing. `font-display: block` rather than `swap`, since the SVG is rasterised once and a swap risks painting the fallback.

**Verifying an embedded font actually applies** is awkward, because you cannot measure text inside an `<img>`. The method that works: rasterise to a canvas and diff the pixels against a control with the `@font-face` stripped, always including a repeat of the control to prove the measurement is stable.

One trap there — canvas rasterises an SVG with its animations at time zero, and the entrance keyframes start at `opacity: 0`. The first attempt measured an invisible headline and wrongly concluded the font had not applied. Stripping the animation `<style>` block first fixes it, which works precisely because nothing in this poster is hidden via an attribute.

### Header rows

Both stat sections use the same three-column header: headline figure left, supporting detail centred in what was dead space, and two small figures right.

- **GitHub** — the two streaks used to be a full-width band below the calendar. Moving them up removed a divider and **128px**.
- **LeetCode** — the easy/medium/hard bars used to sit below the headline. Moving them into the same gutter freed **102px**.

Both section tags carry their brand mark, via `tagRow`'s optional `mark` argument; the identity tag passes none and stays flush at the left margin.

Both share `STREAK_X`, so the centre column lines up between the two sections.

### The calendar bombardment

The contribution grid does not just sit there. A ship patrols the right edge, stops level with each weekday row, and fires a beam down it — squares start **empty** and fill in as the beam sweeps past. Once all seven rows are done a second ship streaks a full lap of the poster, and the cycle repeats on a 21s loop.

`assault.mjs` owns the whole thing, and its timing constants are the single source of truth. Nothing here reacts at runtime — an SVG behind an `<img>` cannot run scripts — so every moment is computed at build time and baked in as an `animation-delay`.

```
DWELL    1.15s   parked on a row, firing
TRANSIT  0.5s    moving to the next row
BEAM     0.85s   for a beam to cross the grid
CYCLE    21s     bombardment + fly-around
```

Each row fires a short **tracer** that leaves the ship and crosses the grid; squares light as its leading edge reaches them. A cell's delay is `row * (DWELL + TRANSIT) + (distance from the muzzle / sweep span) * BEAM`.

`sweepSpan()` exists so the tracer and the cell timing cannot disagree. They were originally computed separately — 783px of travel against a 769px timing span — which ran them at different speeds and left every square lighting up about 40px *behind* the round. Sharing one number puts the leading edge within **±4.5px** of each cell's centre, against an 11px cell.

Squares hold empty before their moment because `.shot` uses `animation-fill-mode: both` — and if the stylesheet is ever stripped they render fully lit, which is the honest fallback.

**`animation-fill-mode: both` on `.bullet` is equally load-bearing.** Without it, a row that has not fired yet renders at its *natural* state, which for a tracer is a fully drawn streak lying across the grid. The first version showed all seven at once as static lines.

Verified by scrubbing the live timeline: `6/216` cells lit at 0.2s, `85` at 4s, `178` at 9s, `216/216` exactly as the ship reaches the bottom row at 11s. The tour ship then takes over at 12.5s, reaches the poster's bottom by 15s and its top by 18s, and is back at the grid by 20.5s.

**Two ships, not one.** The patrol ship is drawn nose-left and never rotates, because it hovers facing the grid it is shooting. The touring copy is drawn nose-right with `offset-rotate: auto` so it banks into its curve. One element cannot do both — it would fly backwards for half the cycle. They swap by opacity, so only one is ever visible.

**Everything runs on the cycle length, not its own duration.** A beam that lasted 1.2s with a 6.9s delay would re-fire every 1.2s from then on, not once per lap. Beams and cells therefore share `animation-duration: 21s` and encode their moment as a percentage inside the keyframes. For the same reason none of these are re-timed under reduced motion — slowing any one of them would desync all 216 squares.

### The moon

`Moon/*.png` is a 60-frame 48x48 rotation. `scripts/build-moon-sprite.py` packs it into one 2880x48 sheet, desaturates it to keep the poster monochrome, and writes a darkened copy for the light theme (mean luminance 124 vs 64, so it still reads on white). Run that script only when the frames change; the sheets are committed so the Node generator needs no image library.

The generator inlines the sheet as a base64 data URI — an SVG behind an `<img>` cannot fetch anything, so an external reference would render nothing. Playback is a clip one frame wide plus `translateX` under `steps(60)`.

One wide image beats stacking 60 and cross-fading them: a single decode, and with CSS stripped the clip just shows frame 0 rather than every frame piled up.

### The probe on the trajectory

The dot that runs the contribution line uses CSS `offset-path: path(...)` with the sparkline's own path data, animating `offset-distance` from 0% to 100%. Verified it parses and moves: `(34,846) → (222,829) → (750,824)` across the plot.

Because `offset-path` positions the element from its own origin, the probe circle sits at `0,0` in its own coordinates. It is wrapped in a clip covering just the plot area, so if CSS is ever stripped it hides rather than parking in the card's top-left corner.

### Stars are seeded, not random

`seededRandom()` derives star positions from the card name. `Math.random()` would rewrite both SVGs on every run and make the daily workflow commit pure noise. Output is byte-identical across runs — verified.

Run it locally:

```bash
GH_TOKEN=$(gh auth token) node scripts/generate-cards.mjs
```

`.github/workflows/update-cards.yml` runs the same script daily at 00:30 UTC (06:00 IST) and commits `assets/` only when something changed.

### Private contributions

1755 of the 1950 contributions last year are private, so this looked like it would need a personal token. **Measured, it does not.** A real workflow run on `Test-readme` using the default `GITHUB_TOKEN` produced `1951 contributions · 218 active days` — the full figure, private work included.

That works because **Settings → Profile → Include private contributions on my profile** is enabled, which publishes the counts (not the repos) to any caller. Leave that setting on and no secret is required.

`PROFILE_TOKEN` remains supported as a fallback: if that setting is ever turned off the totals collapse to public-only activity, and adding a classic PAT with `read:user` and `repo` under that secret name restores them. The workflow prefers it automatically when present.

## Data decisions

| Field | How it is computed |
|---|---|
| contributions / active days / best week | Last 371 days, trimmed to whole weeks so the sparkline buckets align with GitHub's grid |
| current streak | Longest run of consecutive contribution days ending today **or yesterday** — a day with no commits yet does not read as broken |
| longest streak | Best run across every year the account has existed, not just the last one |
| by repos | Counts each repo's **primary** language, so a stylesheet does not score the same as what the repo is written in |
| by bytes | Language byte totals, with markup/build languages excluded and a per-repo cap applied — see below |

Excluded from the language mix as markup or build config: HTML, CSS, SCSS, Sass, Less, Stylus, MDX, TeX, Roff, CMake, Makefile, Dockerfile, Batchfile, Procfile, Nix, Jupyter Notebook, EJS, Handlebars, Pug, Blade, Mustache, Vim Script, Gnuplot, RTF.

### The 2 MB per-repo cap

`smart-todo-task-scheduler` reports **45.6 MB of Python and 1.3 MB of Cython** — a checked-in virtualenv. Uncapped it produced `python 65% · typescript 21% · cython 2%`, which is not what you write. Each repo's bytes are now scaled down to at most 2 MB before aggregating, giving `typescript 50% · python 21% · javascript 14%`.

The cap is a workaround. The real fix is in that repo: add a `.gitattributes` marking the vendored tree, which also corrects the language bar on the repo's own page.

```gitattributes
.venv/**      linguist-vendored
venv/**       linguist-vendored
site-packages/** linguist-vendored
```

## Testing before it goes live

`Spacey6849/Test-readme` (private) holds an identical copy. A repo README renders through the same pipeline as a profile README, so it is a faithful preview of layout, both themes, and animation — the only thing it cannot show is the profile page itself, which requires a public repo named `Spacey6849`.

Verified there: `<picture>` and `<source media="(prefers-color-scheme: dark)">` both survive GitHub's HTML sanitiser, and the scheduled workflow runs and commits correctly.

## Known caveats

- GitHub's contribution API is occasionally inconsistent — one run returned a total ~40 lower with recent days missing, which briefly rendered the streak as 0. It self-corrects on the next daily run.
- LeetCode returns `5000001` as its "unranked" sentinel; the card hides the rank below 5,000,000 rather than printing it.
- If LeetCode is unreachable the script logs it and drops that section; the poster regenerates without it, just shorter.
- GitHub's image proxy (camo) caches SVGs, so a fresh commit can take a few minutes to show.

## Local preview

Markdown preview in VS Code (`Ctrl+Shift+V`) renders the README and both card themes.

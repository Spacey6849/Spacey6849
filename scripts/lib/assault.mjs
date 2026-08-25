/**
 * The calendar bombardment.
 *
 * A ship patrols the right edge of the contribution grid, stopping level with
 * each weekday row and firing a beam down it. Squares start empty and fill in
 * as the beam sweeps past. Once every row is done the ship streaks across the
 * whole poster, and the cycle repeats.
 *
 * None of this reacts at runtime — an SVG behind an <img> cannot run scripts.
 * Every moment is computed here and baked in as an `animation-delay`, which is
 * why the timings below are exported: anything that shifts the ship's clock
 * has to shift the cells' clock by exactly the same amount.
 */

const ROWS = 7;

export const CYCLE = 21; // one full bombardment plus the fly-around
const DWELL = 1.15; // time parked on a row, firing
const TRANSIT = 0.5; // time moving between rows
const BEAM = 0.85; // time a round takes to travel from the ship to the far edge
const BULLET = 26; // length of the tracer itself
export const STANDOFF = 30; // how far the ship holds off the grid's right edge

const ROW_PERIOD = DWELL + TRANSIT;
export const PATROL_END = ROWS * ROW_PERIOD; // 11.55s
const TOUR_START = PATROL_END + 0.45;
const TOUR_END = CYCLE - 0.4;

const round = (n) => Math.round(n * 100) / 100;
const pct = (seconds) => round((seconds / CYCLE) * 100);

/** When the ship arrives at each row and starts firing. */
export function rowFiresAt(row) {
  return row * ROW_PERIOD;
}

/**
 * When the bullet reaches a given column.
 *
 * The bullet leaves the ship, which stands off to the right of the grid, so the
 * sweep spans `standoff + gridWidth` — not just the grid. Timing a cell against
 * the grid alone would put every square slightly ahead of the round passing it.
 */
export function shotTiming({ columns, rows = ROWS, gridWidth, cell, gap, standoff = STANDOFF }) {
  const pitch = cell + gap;
  // Distance the tracer's leading edge covers, measured to the centre of the
  // last column. `sweepSpan` must be the exact same number the tracer travels,
  // or the two run at different speeds and the lighting drifts off the round.
  const span = sweepSpan({ gridWidth, cell, standoff });
  const shots = [];

  for (let row = 0; row < rows; row += 1) {
    const start = rowFiresAt(row);
    for (let column = 0; column < columns; column += 1) {
      const fromShip = standoff + gridWidth - (column * pitch + cell / 2);
      shots.push({ column, row, at: round(start + (fromShip / span) * BEAM) });
    }
  }
  return shots;
}

/** Ship's muzzle to the centre of the furthest column. */
export function sweepSpan({ gridWidth, cell, standoff = STANDOFF }) {
  return standoff + gridWidth - cell / 2;
}

/* ------------------------------------------------------------------ paths */

function patrolPath(plot, cell, gap, standoff) {
  const pitch = cell + gap;
  const x = plot.x + plot.width + standoff;
  const y = (row) => plot.y + row * pitch + cell / 2;
  return `M${x} ${y(0)} L${x} ${y(ROWS - 1)}`;
}

/**
 * The victory lap: out to the right, up over the poster, across and back down
 * so the ship re-enters the grid from the top. Drawn as one open curve because
 * `offset-path` needs a single path.
 */
function tourPath(plot, cell, gap, standoff, width, height) {
  const pitch = cell + gap;
  const x = plot.x + plot.width + standoff;
  const startY = plot.y + (ROWS - 1) * pitch + cell / 2;
  const endY = plot.y + cell / 2;
  const right = width - 40;
  const left = 60;

  return (
    `M${x} ${startY} ` +
    `C${right} ${startY + 60} ${right + 30} ${height - 120} ${right - 40} ${height - 60} ` +
    `C${width * 0.45} ${height + 20} ${left - 30} ${height - 140} ${left} ${height * 0.62} ` +
    `C${left - 20} ${height * 0.3} ${left + 40} ${60} ${width * 0.34} ${52} ` +
    `C${width * 0.7} ${44} ${x + 60} ${endY - 120} ${x} ${endY}`
  );
}

/* ----------------------------------------------------------------- markup */

/**
 * One tracer per row: a short streak that leaves the ship and crosses the grid.
 * The travel distance rides on a custom property so a single keyframe serves
 * every row.
 */
function bullets(plot, cell, gap, standoff, theme, gradientId) {
  const pitch = cell + gap;
  const muzzle = plot.x + plot.width + standoff;
  const travel = round(sweepSpan({ gridWidth: plot.width, cell, standoff }));
  const rows = [];

  for (let row = 0; row < ROWS; row += 1) {
    const y = plot.y + row * pitch + cell / 2;
    // The head sits at the leading (left) edge and the tail streams out behind
    // it to the right, so the rect starts at the muzzle and extends rightward.
    rows.push(
      `<g class="bullet b${row}" style="--travel:-${travel}px">` +
        `<rect x="${round(muzzle)}" y="${round(y - 1.1)}" width="${BULLET}" height="2.2" rx="1.1" ` +
        `fill="url(#${gradientId})" />` +
        `</g>`,
    );
  }
  return rows.join("");
}

/**
 * Hull drawn nose-**left**, because the patrol ship never rotates: it hovers
 * facing the grid it is shooting at. The touring copy is a separate element
 * drawn nose-right so `offset-rotate: auto` can bank it properly — one element
 * cannot do both without pointing backwards for half the cycle.
 */
function hull(theme, facing) {
  const flip = facing === "left" ? "scale(-1 1)" : "";
  return (
    `<g transform="${flip}">` +
    `<path d="M-6 -3.6 L-12 -11 L-15 -10 L-13 -3.2 L-13 3.2 L-15 10 L-12 11 L-6 3.6 Z" ` +
    `fill="${theme.ink}" fill-opacity="0.5" />` +
    `<path d="M5 -3.4 L-2 -9.5 L-9 -9.5 L-6 -3.8 Z" fill="${theme.ink}" fill-opacity="0.78" />` +
    `<path d="M5 3.4 L-2 9.5 L-9 9.5 L-6 3.8 Z" fill="${theme.ink}" fill-opacity="0.78" />` +
    `<path d="M19 0 L8 -3.2 L-9 -4.3 L-14 -2.3 L-14 2.3 L-9 4.3 L8 3.2 Z" fill="${theme.ink}" />` +
    `<path d="M-14 -2.3 L-17.5 -1.7 L-17.5 1.7 L-14 2.3 Z" fill="${theme.ink}" fill-opacity="0.55" />` +
    `<ellipse cx="7" cy="0" rx="4.6" ry="1.85" fill="${theme.bg}" fill-opacity="0.9" />` +
    `<ellipse cx="8.3" cy="-0.4" rx="1.7" ry="0.66" fill="${theme.ink}" />` +
    `<g class="thruster"><path d="M-17.5 0 L-29 -2.9 L-29 2.9 Z" fill="${theme.ink}" fill-opacity="0.45" /></g>` +
    `</g>`
  );
}

export function assault({ plot, cell, gap, theme, id, width, height, standoff = STANDOFF }) {
  const beamId = `beam-${id}`;
  const clip = `assault-${id}`;

  return (
    `<defs>` +
    `<linearGradient id="${beamId}" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="${theme.ink}" stop-opacity="0.95" />` +
    `<stop offset="35%" stop-color="${theme.ink}" stop-opacity="0.5" />` +
    `<stop offset="100%" stop-color="${theme.ink}" stop-opacity="0" />` +
    `</linearGradient>` +
    `<clipPath id="${clip}">` +
    `<rect x="${plot.x - 4}" y="${plot.y - 10}" width="${plot.width + standoff + 60}" height="${plot.height + 20}" />` +
    `</clipPath>` +
    `</defs>` +
    `<g clip-path="url(#${clip})">${bullets(plot, cell, gap, standoff, theme, beamId)}</g>` +
    `<g class="patrol" style="offset-path:path('${patrolPath(plot, cell, gap, standoff)}')">${hull(theme, "left")}</g>` +
    `<g class="tour" style="offset-path:path('${tourPath(plot, cell, gap, standoff, width, height)}')">${hull(theme, "right")}</g>`
  );
}

/* -------------------------------------------------------------------- css */

/** Keyframes that park the ship on each row, then step to the next. */
function patrolKeyframes() {
  const stops = [];
  for (let row = 0; row < ROWS; row += 1) {
    const distance = round((row / (ROWS - 1)) * 100);
    const arrive = rowFiresAt(row);
    stops.push(`${pct(arrive)}%{offset-distance:${distance}%}`);
    stops.push(`${pct(arrive + DWELL)}%{offset-distance:${distance}%}`);
  }
  // Hold on the last row until the tour takes over, then hide. The jump back
  // to the top happens while invisible, so the loop has no visible snap.
  stops.push(`${pct(TOUR_START)}%{offset-distance:100%;opacity:1}`);
  stops.push(`${pct(TOUR_START + 0.15)}%{offset-distance:100%;opacity:0}`);
  stops.push(`${pct(TOUR_END)}%{offset-distance:0%;opacity:0}`);
  stops.push(`99.4%{offset-distance:0%;opacity:0}`);
  stops.push(`100%{offset-distance:0%;opacity:1}`);
  return `@keyframes patrol{0%{opacity:1;offset-distance:0%}${stops.join("")}}`;
}

function tourKeyframes() {
  return (
    "@keyframes tour{" +
    `0%,${pct(TOUR_START)}%{offset-distance:0%;opacity:0}` +
    `${pct(TOUR_START + 0.2)}%{opacity:1}` +
    `${pct(TOUR_END - 0.3)}%{opacity:1}` +
    `${pct(TOUR_END)}%,100%{offset-distance:100%;opacity:0}` +
    "}"
  );
}

/**
 * The tracer flies right to left, then stays hidden for the rest of the lap.
 *
 * It runs on the full cycle rather than its own short duration: the row delay
 * is absolute seconds, and a short duration would simply re-fire every
 * duration after that instead of once per lap.
 */
function bulletKeyframes() {
  const sweep = pct(BEAM);
  return (
    "@keyframes bullet{" +
    "0%{transform:translateX(0);opacity:0}" +
    `${round(sweep * 0.06)}%{opacity:1}` +
    `${round(sweep * 0.94)}%{opacity:1}` +
    `${sweep}%{transform:translateX(var(--travel));opacity:0}` +
    `100%{transform:translateX(var(--travel));opacity:0}` +
    "}"
  );
}

export function assaultCss() {
  const bulletRules = [];
  for (let row = 0; row < ROWS; row += 1) {
    bulletRules.push(`.b${row}{animation-delay:${round(rowFiresAt(row))}s}`);
  }

  return (
    `.patrol{offset-rotate:0deg;animation:patrol ${CYCLE}s linear infinite}` +
    `.tour{offset-rotate:auto;animation:tour ${CYCLE}s cubic-bezier(.4,0,.5,1) infinite}` +
    // `both` is load-bearing: without it a row that has not fired yet renders
    // at its natural state — a fully drawn tracer sitting across the grid.
    `.bullet{animation-name:bullet;animation-duration:${CYCLE}s;animation-fill-mode:both;` +
    "animation-timing-function:linear;animation-iteration-count:infinite}" +
    bulletRules.join("") +
    // Squares hold empty until their beam arrives, then stay lit for the rest
    // of the cycle. `both` is what keeps them dark before the delay.
    `.shot{animation-name:shot;animation-duration:${CYCLE}s;animation-fill-mode:both;` +
    "animation-timing-function:ease-out;animation-iteration-count:infinite}" +
    "@keyframes shot{" +
    "0%{opacity:0;transform:scale(.4)}" +
    "1.4%{opacity:1;transform:scale(1.5)}" +
    "4%{opacity:1;transform:scale(1)}" +
    "100%{opacity:1;transform:scale(1)}" +
    "}" +
    patrolKeyframes() +
    tourKeyframes() +
    bulletKeyframes()
  );
}

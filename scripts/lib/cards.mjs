/**
 * One poster. Identity, stack, GitHub, LeetCode and contact links all live
 * inside a single SVG so the whole profile reads as one object — one frame, one
 * starfield drifting behind everything, one entrance cascade running top to
 * bottom.
 *
 * Each section is a pure function taking the y it starts at and returning
 * markup positioned relative to it. SECTION holds their heights, and the
 * poster stacks them by running total, so moving or resizing a section never
 * requires re-deriving every coordinate below it.
 */

import { assault, shotTiming } from "./assault.mjs";
import { CONTACTS } from "./icons.mjs";
import { STACK_GROUPS } from "./stack.mjs";
import {
  THEMES,
  astronaut,
  barRow,
  contributionGrid,
  document_,
  fontFace,
  frame,
  heatmap,
  icon,
  monthYear,
  moonSprite,
  orbit,
  rect,
  shootingStar,
  shootingStarGradient,
  shortDate,
  sparkline,
  text,
} from "./svg.mjs";

const WIDTH = 880;
const PAD = 34;
const RIGHT = WIDTH - PAD;
const COL_2 = 478;

// Centre gutter between the headline figure and the right-hand column.
const STREAK_X = 286;

/**
 * The astronaut floats inside the stack section. Chips flow around him rather
 * than under him — before this the rows simply ran full width and he covered
 * whichever chips happened to land there.
 */
const ASTRO = { x: 688, width: 152, height: 172, offsetY: 196, clearance: 14 };

const MARK = Object.fromEntries(CONTACTS.map((c) => [c.key, c.path]));

/**
 * Shooting stars, seeded by hand rather than randomly so the poster stays
 * byte-identical between builds. `at` is a fraction of the poster height, so
 * adding or dropping a section cannot strand one past the bottom edge.
 *
 * Angles alternate sign and the durations are mutually non-harmonic, which
 * keeps them from visibly falling into step with each other.
 */
const SHOOTING_STARS = [
  { at: 0.03, angle: 26, length: 95, duration: 11, delay: 0.6 },
  { at: 0.09, angle: -19, length: 62, duration: 17, delay: 6.2 },
  { at: 0.16, angle: 33, length: 78, duration: 13, delay: 2.8 },
  { at: 0.23, angle: 21, length: 55, duration: 19, delay: 9.4 },
  { at: 0.31, angle: -28, length: 88, duration: 15, delay: 4.1 },
  { at: 0.39, angle: 24, length: 70, duration: 12, delay: 11.7 },
  { at: 0.47, angle: -22, length: 100, duration: 18, delay: 1.9 },
  { at: 0.55, angle: 30, length: 58, duration: 14, delay: 7.6 },
  { at: 0.63, angle: 18, length: 84, duration: 16, delay: 13.2 },
  { at: 0.71, angle: -31, length: 66, duration: 11, delay: 5.3 },
  { at: 0.79, angle: 27, length: 92, duration: 20, delay: 8.8 },
  { at: 0.86, angle: -20, length: 60, duration: 13, delay: 3.4 },
  { at: 0.93, angle: 29, length: 75, duration: 17, delay: 10.5 },
  { at: 0.98, angle: 23, length: 68, duration: 15, delay: 15.1 },
];

// Far enough to clear the poster even on the shallowest angle.
const STAR_TRAVEL = 1320;
const STAR_START_X = -280;

const SECTION = {
  identity: 196,
  stack: 0, // measured at render time by layoutStack

  github: 646,
  leetcode: 368,
  links: 108,
};

/* ------------------------------------------------------------ primitives */

function divider(y, theme) {
  return rect({ x: PAD, y, width: WIDTH - PAD * 2, height: 1, fill: theme.border, cls: "fade" });
}

function label(content, x, y, theme, delay) {
  return text(content, { x, y, size: 10, fill: theme.muted, spacing: 1.6, cls: `rise d${delay}`, face: "display" });
}

function tagRow(left, right, y, theme, delay, mark = null) {
  return (
    (mark ? icon(mark, { x: PAD, y: y - 10, size: 12, fill: theme.muted, cls: `rise d${delay}` }) : "") +
    label(left, mark ? PAD + 18 : PAD, y, theme, delay) +
    text(right, { x: RIGHT, y, size: 10, fill: theme.muted, anchor: "end", cls: `rise d${delay + 2}` })
  );
}

/** The headline figure of a section, with its caption beneath. */
function headline(value, caption, top, theme, delay) {
  return (
    text(value, { x: PAD, y: top + 102, size: 54, weight: 700, fill: theme.text, cls: `pop d${delay}`, face: "display" }) +
    text(caption, { x: PAD, y: top + 124, size: 12, fill: theme.muted, cls: `rise d${delay + 4}`, face: "display" })
  );
}

/** A smaller figure with a caption beneath it, right-aligned. */
function figure(value, caption, y, theme, delay) {
  return (
    text(value, { x: RIGHT, y, size: 26, weight: 700, fill: theme.text, anchor: "end", cls: `pop d${delay}`, face: "display" }) +
    text(caption, { x: RIGHT, y: y + 18, size: 11, fill: theme.muted, anchor: "end", cls: `rise d${delay + 2}`, face: "display" })
  );
}

/**
 * A streak, sized to sit in the gap between the headline figure and the
 * right-hand column rather than as its own full-width band.
 */
function streak(count, caption, range, x, y, theme, delay) {
  return (
    text(count, { x, y, size: 27, weight: 700, fill: theme.text, cls: `pop d${delay}`, face: "display" }) +
    text(caption, { x, y: y + 16, size: 10.5, fill: theme.muted, cls: `rise d${delay + 2}`, face: "display" }) +
    text(range, { x, y: y + 30, size: 9.5, fill: theme.muted, cls: `rise d${delay + 3}` })
  );
}

/** Two-column "key   value" rows, used by the stack section. */
function definitionRows(rows, top, theme, delay, keyWidth = 92) {
  return rows
    .map((row, i) => {
      const y = top + i * 21;
      return (
        text(row.key, { x: PAD, y, size: 11.5, fill: theme.text, cls: `rise d${delay + i}` }) +
        text(row.value, { x: PAD + keyWidth, y, size: 11.5, fill: theme.muted, cls: `rise d${delay + i + 1}` })
      );
    })
    .join("");
}

/* -------------------------------------------------------------- sections */

function identitySection(top, profile, theme, moon, views) {
  return (
    tagRow("profile", profile.location, top + 36, theme, 0) +
    orbit({ cx: 726, cy: top + 104, theme, moon }) +
    text(profile.name.toUpperCase(), { x: PAD, y: top + 100, size: 34, weight: 700, spacing: 1.5, fill: theme.text, cls: "pop d2", face: "display" }) +
    text(profile.role, { x: PAD, y: top + 128, size: 13, fill: theme.muted, cls: "rise d5", face: "display" }) +
    text(profile.study, { x: PAD, y: top + 150, size: 13, fill: theme.muted, cls: "rise d7", face: "display" }) +
    (views
      ? text(`${views.toLocaleString("en-US")} profile views`, {
          x: RIGHT,
          y: top + 54,
          size: 10,
          fill: theme.muted,
          anchor: "end",
          cls: "rise d4",
          face: "display",
        })
      : "")
  );
}

const CHIP = {
  height: 26,
  gap: 7,
  rowGap: 8,
  padX: 10,
  icon: 13,
  iconGap: 6,
  font: 10.5,
  keyColumn: 96,
  keyGutter: 18,
  groupGap: 12,
};

/** Monospace advance is ~0.6em, so a label's width is predictable. */
function chipWidth(item) {
  const glyph = item.path ? CHIP.icon + CHIP.iconGap : 0;
  return Math.round(CHIP.padX * 2 + glyph + item.label.length * CHIP.font * 0.6);
}

function chip(item, x, y, theme, delay) {
  const width = chipWidth(item);
  const textX = x + CHIP.padX + (item.path ? CHIP.icon + CHIP.iconGap : 0);
  return (
    `<g class="rise d${delay}">` +
    rect({ x, y, width, height: CHIP.height, fill: theme.ink, rx: 7, opacity: 0.07, cls: `chip d${delay}` }) +
    rect({ x: x + 0.5, y: y + 0.5, width: width - 1, height: CHIP.height - 1, fill: "none", rx: 6.5, stroke: theme.border }) +
    (item.path
      ? icon(item.path, { x: x + CHIP.padX, y: y + (CHIP.height - CHIP.icon) / 2, size: CHIP.icon, fill: theme.text, opacity: 0.9 })
      : "") +
    text(item.label, { x: textX, y: y + CHIP.height / 2 + 3.6, size: CHIP.font, fill: theme.text }) +
    `</g>`
  );
}

/**
 * Chips flow left to right and wrap, so a group's height depends on how many
 * rows it needs. The section therefore reports its own height instead of
 * declaring a constant one — see SECTION in posterCard.
 */
function layoutStack(top, theme) {
  const left = PAD + CHIP.keyColumn;
  const astroTop = top + ASTRO.offsetY - ASTRO.clearance;
  const astroBottom = top + ASTRO.offsetY + ASTRO.height + ASTRO.clearance;
  // Rows level with the astronaut wrap early; the rest use the full width.
  const rightEdgeAt = (rowY) =>
    rowY + CHIP.height > astroTop && rowY < astroBottom ? ASTRO.x - ASTRO.clearance : RIGHT;

  let y = top + 56;
  let markup = label("STACK", PAD, top + 30, theme, 8);
  let delay = 9;

  for (const group of STACK_GROUPS) {
    const rowStart = y;
    let x = left;
    let rows = 1;

    for (const item of group.items) {
      const width = chipWidth(item);
      if (x + width > rightEdgeAt(y)) {
        x = left;
        y += CHIP.height + CHIP.rowGap;
        rows += 1;
      }
      markup += chip(item, x, y, theme, delay);
      x += width + CHIP.gap;
      delay += 1;
    }

    // Right-anchored against the chip column: the keys vary a lot in length,
    // and ragged-left against a hard chip edge reads as misalignment. Muted and
    // tracked so they sit below the section label in the hierarchy rather than
    // competing with the chips they introduce.
    markup += text(group.key.toUpperCase(), {
      x: left - CHIP.keyGutter,
      y: rowStart + CHIP.height / 2 + 3.5,
      size: 9.5,
      weight: 600,
      spacing: 1.3,
      fill: theme.muted,
      anchor: "end",
      cls: `rise d${delay - group.items.length}`,
      face: "display",
    });

    y += CHIP.height + CHIP.groupGap;
  }

  return { markup, height: y - top + 12 };
}

const LANGUAGES_TOP = 500;

/**
 * Contact chips, drawn in the poster's own monochrome so the card stays a
 * single palette. Nothing here is clickable — an SVG behind an <img> cannot
 * be — so these read as information, not navigation.
 */
function linksSection(top, links, theme) {
  const chipHeight = 40;
  const chipGap = 12;
  const chipWidth = Math.floor((WIDTH - PAD * 2 - chipGap * (links.length - 1)) / links.length);
  const y = top + 46;

  const chips = links
    .map((link, i) => {
      const x = PAD + i * (chipWidth + chipGap);
      const delay = 54 + i * 2;
      return (
        `<g class="rise d${delay}">` +
        rect({ x, y, width: chipWidth, height: chipHeight, fill: theme.ink, rx: 8, opacity: 0.05 }) +
        rect({ x: x + 0.5, y: y + 0.5, width: chipWidth - 1, height: chipHeight - 1, fill: "none", rx: 7.5, stroke: theme.border }) +
        icon(link.path, { x: x + 14, y: y + chipHeight / 2 - 8, size: 16, fill: theme.text }) +
        text(link.label, { x: x + 40, y: y + 17, size: 12, weight: 700, fill: theme.text, face: "display" }) +
        text(link.handle, { x: x + 40, y: y + 31, size: 9.5, fill: theme.muted }) +
        `</g>`
      );
    })
    .join("");

  return label("LINKS", PAD, top + 30, theme, 53) + chips;
}

function languageColumn(title, items, x, top, theme, delay) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items
    .map((item, i) =>
      barRow({
        item,
        x,
        y: top + LANGUAGES_TOP + 16 + i * 22,
        labelWidth: 96,
        barWidth: 170,
        max,
        theme,
        index: i,
        delayOffset: delay,
      }),
    )
    .join("");
  return label(title, x, top + LANGUAGES_TOP, theme, delay) + rows;
}

/** A year of contribution boxes with a ship flying the grid. */
function calendarBlock(top, calendar, theme, themeName, posterHeight) {
  const measure = contributionGrid({ days: calendar, x: PAD, y: top + 322, cell: 11, gap: 3, theme });
  const columns = Math.ceil(calendar.length / 7);
  const shots = shotTiming({ columns, gridWidth: measure.plot.width, cell: 11, gap: 3 });
  const grid = contributionGrid({ days: calendar, x: PAD, y: top + 322, cell: 11, gap: 3, theme, shots });

  return (
    label("CONTRIBUTIONS", PAD, top + 296, theme, 22) +
    text(`${calendar.length} days`, {
      x: RIGHT,
      y: top + 296,
      size: 10,
      fill: theme.muted,
      anchor: "end",
      cls: "rise d24",
    }) +
    grid.markup +
    assault({ plot: grid.plot, cell: 11, gap: 3, theme, id: themeName, width: WIDTH, height: posterHeight }) +
    grid.legend(top + 443)
  );
}

function githubSection(top, stats, theme, themeName, posterHeight) {
  const currentRange = stats.current.length
    ? `${shortDate(stats.current.start)} – ${shortDate(stats.current.end)}`
    : "no active streak";
  const longestRange = stats.longest.length
    ? `${shortDate(stats.longest.start)} – ${shortDate(stats.longest.end)}`
    : "—";

  return (
    tagRow("github", `@${stats.login}`, top + 34, theme, 22, MARK.github) +
    headline(String(stats.total), "contributions in the last year", top, theme, 23) +
    figure(String(stats.activeDays), "active days", top + 78, theme, 24) +
    figure(String(stats.bestWeek), "best week", top + 128, theme, 26) +
    // Streaks sit in the dead space between the headline and the right column.
    streak(String(stats.current.length), "current streak", currentRange, STREAK_X, top + 92, theme, 28) +
    rect({ x: STREAK_X + 148, y: top + 68, width: 1, height: 56, fill: theme.border, cls: "fade" }) +
    streak(String(stats.longest.length), "longest streak", longestRange, STREAK_X + 172, top + 92, theme, 30) +
    sparkline({
      values: stats.weeks,
      x: PAD,
      y: top + 168,
      width: WIDTH - PAD * 2,
      height: 64,
      theme,
      id: themeName,
    }) +
    divider(top + 262, theme) +
    calendarBlock(top, stats.calendar, theme, themeName, posterHeight) +
    divider(top + 470, theme) +
    languageColumn("BY BYTES", stats.byBytes, PAD, top, theme, 32) +
    languageColumn("BY REPOS", stats.byRepos, COL_2, top, theme, 34)
  );
}

function difficultyRow(name, bucket, index, top, theme) {
  const item = {
    name,
    value: bucket.total ? (bucket.done / bucket.total) * 100 : 0,
    label: `${bucket.done} / ${bucket.total}`,
  };
  return barRow({
    item,
    x: STREAK_X,
    y: top + 74 + index * 24,
    labelWidth: 62,
    barWidth: 190,
    max: 100,
    theme,
    index,
    delayOffset: 44,
    // "3 / 2105" is far wider than a "49%" language value.
    labelGap: 62,
    // Difficulty names are words; language names are identifiers.
    face: "display",
  });
}

function leetcodeSection(top, lc, theme) {
  const rank = lc.ranking ? `#${lc.ranking.toLocaleString("en-US")}` : "";
  const stamp = (ts) => monthYear(new Date(ts * 1000).toISOString().slice(0, 10));

  return (
    tagRow("leetcode", [`@${lc.username}`, rank].filter(Boolean).join("  ·  "), top + 36, theme, 40, MARK.leetcode) +
    headline(String(lc.solved.all.done), `solved of ${lc.solved.all.total}`, top, theme, 41) +
    figure(String(lc.streak), "day streak", top + 78, theme, 42) +
    figure(String(lc.activeDays), "active days", top + 128, theme, 44) +
    // Difficulty bars sit in the gutter beside the headline, matching the
    // GitHub header above it.
    difficultyRow("easy", lc.solved.easy, 0, top, theme) +
    difficultyRow("medium", lc.solved.medium, 1, top, theme) +
    difficultyRow("hard", lc.solved.hard, 2, top, theme) +
    divider(top + 168, theme) +
    label("submissions · last 52 weeks", PAD, top + 200, theme, 50) +
    heatmap({ days: lc.heatmap, x: PAD, y: top + 216, cell: 12, gap: 3, theme }) +
    text(stamp(lc.heatmap[0].ts), { x: PAD, y: top + 338, size: 10, fill: theme.muted, cls: "rise d52" }) +
    text(stamp(lc.heatmap.at(-1).ts), {
      x: RIGHT,
      y: top + 338,
      size: 10,
      fill: theme.muted,
      anchor: "end",
      cls: "rise d52",
    })
  );
}

/* ---------------------------------------------------------------- poster */

export function posterCard({ profile, links, stats, leetcode, moon, font, astro, views }, themeName) {
  const theme = THEMES[themeName];
  const stack = layoutStack(0, theme); // measured first; positioned once its top is known

  // Sections stack by running total; each divider sits on a section boundary.
  const tops = {};
  let cursor = 0;
  for (const [name, height] of Object.entries(SECTION)) {
    if (name === "leetcode" && !leetcode) continue;
    tops[name] = cursor;
    cursor += name === "stack" ? stack.height : height;
  }
  const height = cursor;

  const boundaries = Object.values(tops)
    .slice(1)
    .map((top) => divider(top, theme))
    .join("");

  const moonMarkup = moon
    ? moonSprite({
        cx: 726,
        cy: tops.identity + 104,
        frames: moon.frames,
        size: moon.size,
        base64: moon.base64,
        id: themeName,
      })
    : "";

  const body =
    frame({ width: WIDTH, height, theme, seed: `poster-${themeName}`, stars: 300 }) +
    shootingStarGradient(`shoot-${themeName}`, theme) +
    SHOOTING_STARS.map((star) =>
      shootingStar({
        startX: STAR_START_X,
        startY: Math.round(height * star.at),
        travel: STAR_TRAVEL,
        theme,
        gradientId: `shoot-${themeName}`,
        ...star,
      }),
    ).join("") +
    boundaries +
    identitySection(tops.identity, profile, theme, moonMarkup, views) +
    layoutStack(tops.stack, theme).markup +
    (astro
      ? astronaut({
          x: ASTRO.x,
          y: tops.stack + ASTRO.offsetY,
          width: ASTRO.width,
          height: ASTRO.height,
          base64: astro.base64,
        })
      : "") +
    githubSection(tops.github, stats, theme, themeName, height) +
    (leetcode ? leetcodeSection(tops.leetcode, leetcode, theme) : "") +
    linksSection(tops.links, links, theme);

  return document_({ width: WIDTH, height, title: `${profile.name} — profile`, body, face: fontFace(font) });
}

#!/usr/bin/env node
/**
 * Regenerates the profile poster into assets/.
 *
 * Usage:  GH_TOKEN=$(gh auth token) node scripts/generate-cards.mjs
 * Env:    GH_TOKEN | GITHUB_TOKEN   required
 *         GH_LOGIN                  default Spacey6849
 *         LEETCODE_USER             default spacey6849
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { posterCard } from "./lib/cards.mjs";
import { CONTACTS } from "./lib/icons.mjs";
import { collectGitHub } from "./lib/github.mjs";
import { collectLeetCode } from "./lib/leetcode.mjs";
import { collectViews } from "./lib/views.mjs";

const ASSETS = join(dirname(dirname(fileURLToPath(import.meta.url))), "assets");
const THEMES = ["dark", "light"];

const PROFILE = {
  name: "moses thomas rodrigues",
  role: "full stack developer  ·  ai & iot systems",
  study: "b.e. electronics & computer engineering  ·  agnel institute, goa",
  location: "goa, india",
};

const MOON = { file: "moon-{theme}.png", frames: 60, size: 48 };
const FONT_FILE = "space-grotesk.woff2";
const ASTRONAUT = { file: "astronaut-sprite.png", width: 240, height: 272 };

async function write(name, contents) {
  await writeFile(join(ASSETS, name), contents, "utf8");
  console.log(`  assets/${name}  ${contents.length} bytes`);
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN is required");

  const login = process.env.GH_LOGIN || "Spacey6849";
  const leetcodeUser = process.env.LEETCODE_USER || "spacey6849";

  await mkdir(ASSETS, { recursive: true });

  const stats = await collectGitHub(login, token);
  console.log(
    `github: ${stats.total} contributions · ${stats.activeDays} active days · ` +
      `streak ${stats.current.length} (longest ${stats.longest.length}) · ${stats.repoCount} repos`,
  );

  // LeetCode is a nice-to-have. A flaky response should shorten the poster, not
  // fail the run and leave the GitHub half unpublished.
  let leetcode = null;
  try {
    leetcode = await collectLeetCode(leetcodeUser);
    console.log(
      `leetcode: ${leetcode.solved.all.done} solved · streak ${leetcode.streak} · ${leetcode.activeDays} active days`,
    );
  } catch (error) {
    console.error(`leetcode: skipped (${error.message})`);
  }

  // Reading this increments the counter — see lib/views.mjs. A failure just
  // drops the line rather than failing the run.
  let views = null;
  try {
    views = await collectViews(login);
    console.log(`views: ${views} profile views`);
  } catch (error) {
    console.error(`views: skipped (${error.message})`);
  }

  // Inlined for the same reason as the moon sheet: an SVG behind an <img>
  // cannot fetch a webfont, so a linked one would silently fall back.
  const font = (await readFile(join(ASSETS, FONT_FILE))).toString("base64");
  const astro = {
    ...ASTRONAUT,
    base64: (await readFile(join(ASSETS, ASTRONAUT.file))).toString("base64"),
  };

  for (const theme of THEMES) {
    // The sprite sheet is inlined as a data URI: an SVG behind an <img> cannot
    // fetch anything, so an external reference would render nothing.
    const sheet = await readFile(join(ASSETS, MOON.file.replace("{theme}", theme)));
    const moon = { frames: MOON.frames, size: MOON.size, base64: sheet.toString("base64") };
    const data = { profile: PROFILE, links: CONTACTS, stats, leetcode, moon, font, astro, views };
    await write(`profile-${theme}.svg`, posterCard(data, theme));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

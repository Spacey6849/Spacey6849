/**
 * Profile view count, read from komarev's counter badge.
 *
 * GitHub has no API for profile-page views. Its traffic endpoint counts *repo*
 * views, which for a profile repo reads 1 — profile pages do not register
 * there. The only real measure is a counter image embedded in the README, and
 * komarev's is the usual one.
 *
 * **This fetch increments the counter.** The badge counts requests, so a daily
 * CI read adds roughly 365 a year on top of genuine visits. That trade is
 * deliberate: it is the only way to get a live number into an SVG that cannot
 * fetch anything itself. If it ever matters, `komarev.com/ghpvc/?...&base=N`
 * can offset a known amount.
 */

const ENDPOINT = "https://komarev.com/ghpvc/";

export async function collectViews(username) {
  const res = await fetch(`${ENDPOINT}?username=${encodeURIComponent(username)}`, {
    headers: { "User-Agent": "profile-card-generator" },
  });

  if (!res.ok) throw new Error(`komarev ${res.status}`);

  const svg = await res.text();
  const labels = [...svg.matchAll(/>([^<]{1,30})<\/text>/g)].map((m) => m[1].trim());
  const count = labels.find((value) => /^[\d,]+$/.test(value));

  if (!count) throw new Error("no count found in the badge");
  return Number(count.replace(/,/g, ""));
}

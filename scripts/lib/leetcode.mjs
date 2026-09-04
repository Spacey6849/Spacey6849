/** LeetCode public GraphQL: solved counts, streak, submission calendar. */

const ENDPOINT = "https://leetcode.com/graphql";

const QUERY = `
  query ($username: String!) {
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays submissionCalendar }
    }
    allQuestionsCount { difficulty count }
  }
`;

const DAY = 86400;

function indexByDifficulty(rows) {
  return Object.fromEntries(rows.map((row) => [row.difficulty, row.count]));
}

/** Last 52 weeks of submission counts, oldest first, aligned to whole weeks. */
function buildHeatmap(submissionCalendar) {
  const raw = JSON.parse(submissionCalendar || "{}");
  const byDay = new Map();
  for (const [seconds, count] of Object.entries(raw)) {
    byDay.set(Number(seconds), count);
  }

  const todayUtc = Math.floor(Date.now() / 1000 / DAY) * DAY;
  // Walk back to the most recent Sunday so columns are calendar weeks.
  const endOfWeek = todayUtc + (6 - new Date(todayUtc * 1000).getUTCDay()) * DAY;
  const start = endOfWeek - (52 * 7 - 1) * DAY;

  const days = [];
  for (let ts = start; ts <= endOfWeek; ts += DAY) {
    days.push({ ts, count: byDay.get(ts) ?? 0 });
  }
  return days;
}

export async function collectLeetCode(username) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "profile-card-generator",
    },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
  });

  if (!res.ok) throw new Error(`LeetCode ${res.status}: ${await res.text()}`);

  const body = await res.json();
  if (body.errors) throw new Error(`LeetCode: ${JSON.stringify(body.errors)}`);

  const user = body.data.matchedUser;
  if (!user) throw new Error(`LeetCode user not found: ${username}`);

  const solved = indexByDifficulty(user.submitStatsGlobal.acSubmissionNum);
  const totals = indexByDifficulty(body.data.allQuestionsCount);

  // LeetCode returns 5,000,001 as "unranked" rather than omitting the field.
  const ranking = user.profile?.ranking;

  const heatmap = buildHeatmap(user.userCalendar.submissionCalendar);

  return {
    username: user.username,
    ranking: ranking && ranking < 5_000_000 ? ranking : null,
    maxStreak: user.userCalendar.streak,
    activeDays: user.userCalendar.totalActiveDays,
    solved: {
      all: { done: solved.All ?? 0, total: totals.All ?? 0 },
      easy: { done: solved.Easy ?? 0, total: totals.Easy ?? 0 },
      medium: { done: solved.Medium ?? 0, total: totals.Medium ?? 0 },
      hard: { done: solved.Hard ?? 0, total: totals.Hard ?? 0 },
    },
    heatmap,
    // LeetCode's own header reads "N submissions in the past one year"; the
    // calendar holds per-day counts, so the total is their sum.
    submissions: heatmap.reduce((sum, day) => sum + day.count, 0),
  };
}

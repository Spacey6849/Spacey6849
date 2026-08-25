/** GitHub GraphQL data collection: contributions, streaks, language mix. */

const ENDPOINT = "https://api.github.com/graphql";

async function gql(query, variables, token) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-card-generator",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  if (body.errors) {
    throw new Error(`GitHub GraphQL: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

const YEARS_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection { contributionYears }
    }
  }
`;

const CALENDAR_QUERY = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

const REPOS_QUERY = `
  query ($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          primaryLanguage { name }
          languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
      }
    }
  }
`;

/** Every contribution day the account has, oldest first. */
async function fetchAllDays(login, token) {
  const { user } = await gql(YEARS_QUERY, { login }, token);
  const years = user.contributionsCollection.contributionYears;

  const perYear = await Promise.all(
    years.map((year) =>
      gql(
        CALENDAR_QUERY,
        {
          login,
          from: `${year}-01-01T00:00:00Z`,
          to: `${year}-12-31T23:59:59Z`,
        },
        token,
      ),
    ),
  );

  const byDate = new Map();
  for (const data of perYear) {
    for (const week of data.user.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        byDate.set(day.date, day.contributionCount);
      }
    }
  }

  // The calendar for the current year runs to Dec 31, so it is padded with
  // future zero-days. Those would read as a broken streak — drop them.
  const today = new Date().toISOString().slice(0, 10);

  return [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .filter((day) => day.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Markup, styling and build-config languages. GitHub counts their bytes like
 * any other, which lets a single generated stylesheet or docs tree outrank
 * everything actually written by hand.
 */
const NOT_A_LANGUAGE = new Set([
  "HTML", "CSS", "SCSS", "Sass", "Less", "Stylus", "MDX", "TeX", "Roff",
  "CMake", "Makefile", "Dockerfile", "Batchfile", "Procfile", "Nix",
  "Jupyter Notebook", "EJS", "Handlebars", "Pug", "Blade", "Mustache",
  "Vim Script", "Vim Snippet", "Gnuplot", "Rich Text Format",
]);

async function fetchRepos(login, token) {
  const repos = [];
  let cursor = null;

  for (;;) {
    const { user } = await gql(REPOS_QUERY, { login, cursor }, token);
    repos.push(...user.repositories.nodes);
    if (!user.repositories.pageInfo.hasNextPage) break;
    cursor = user.repositories.pageInfo.endCursor;
  }

  return repos;
}

function topFive(counts, toLabel) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.toLowerCase(), value, label: toLabel(value) }));
}

/**
 * Ceiling on how many bytes one repository may contribute. A single checked-in
 * virtualenv or vendored dependency tree can outweigh every hand-written line
 * on the account, so oversized repos are scaled down rather than dropped.
 */
const REPO_BYTE_CAP = 2_000_000;

function summariseLanguages(repos) {
  const bytes = new Map();
  const primary = new Map();

  for (const repo of repos) {
    const counted = repo.languages.edges.filter((edge) => !NOT_A_LANGUAGE.has(edge.node.name));
    const repoTotal = counted.reduce((sum, edge) => sum + edge.size, 0);
    const weight = repoTotal > REPO_BYTE_CAP ? REPO_BYTE_CAP / repoTotal : 1;

    for (const edge of counted) {
      const name = edge.node.name;
      bytes.set(name, (bytes.get(name) ?? 0) + edge.size * weight);
    }

    // Counting every language present would score a repo's stylesheet the same
    // as what the repo is actually written in, so count the primary only.
    const main = repo.primaryLanguage?.name;
    if (main && !NOT_A_LANGUAGE.has(main)) {
      primary.set(main, (primary.get(main) ?? 0) + 1);
    }
  }

  const totalBytes = [...bytes.values()].reduce((sum, n) => sum + n, 0) || 1;
  const asPercent = new Map([...bytes].map(([name, size]) => [name, Math.round((size / totalBytes) * 100)]));

  return {
    byBytes: topFive(asPercent, (value) => `${value}%`),
    byRepos: topFive(primary, String),
  };
}

/** Longest run of consecutive contribution days, and the run still open today. */
function computeStreaks(days) {
  let longest = { length: 0, start: null, end: null };
  let run = { length: 0, start: null, end: null };

  for (const day of days) {
    if (day.count > 0) {
      run = {
        length: run.length + 1,
        start: run.length === 0 ? day.date : run.start,
        end: day.date,
      };
      if (run.length > longest.length) longest = { ...run };
    } else {
      run = { length: 0, start: null, end: null };
    }
  }

  // The run is only "current" if it reaches today or yesterday — today may not
  // have a commit yet, and that should not read as a broken streak.
  const recent = new Set([days.at(-1)?.date, days.at(-2)?.date].filter(Boolean));
  const current = run.length > 0 && recent.has(run.end) ? run : { length: 0, start: null, end: null };

  return { current, longest };
}

function sliceLastYear(days) {
  // Trim to whole weeks so the sparkline buckets line up with GitHub's grid.
  const window = days.slice(-371);
  const firstSunday = window.findIndex((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0);
  return firstSunday === -1 ? window : window.slice(firstSunday);
}

export async function collectGitHub(login, token) {
  const [days, repos] = await Promise.all([fetchAllDays(login, token), fetchRepos(login, token)]);
  const languages = summariseLanguages(repos);

  const lastYear = sliceLastYear(days);

  const weeks = [];
  for (let i = 0; i < lastYear.length; i += 7) {
    weeks.push(lastYear.slice(i, i + 7).reduce((sum, d) => sum + d.count, 0));
  }

  return {
    login,
    calendar: lastYear,
    total: lastYear.reduce((sum, d) => sum + d.count, 0),
    activeDays: lastYear.filter((d) => d.count > 0).length,
    bestWeek: Math.max(0, ...weeks),
    weeks,
    repoCount: repos.length,
    ...computeStreaks(days),
    ...languages,
  };
}

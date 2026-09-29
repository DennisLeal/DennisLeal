import { mkdir, writeFile } from "node:fs/promises";

const username = "DennisLeal";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required.");

async function github(path) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "DennisLeal-profile-stats"
    }
  });
  if (!response.ok) {
    throw new Error("GitHub API " + response.status + " for " + path + ": " + (await response.text()));
  }
  return response.json();
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function svgStart(width, height, title, subtitle) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + " " + height + '" role="img" aria-labelledby="title desc">' +
    "<title id=\"title\">" + escapeXml(title) + "</title>" +
    "<desc id=\"desc\">" + escapeXml(subtitle) + "</desc>" +
    '<rect width="100%" height="100%" rx="12" fill="#1a1b26" stroke="#414868"/>' +
    '<text x="28" y="38" fill="#c0caf5" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="700">' +
    escapeXml(title) + "</text>" +
    '<text x="28" y="60" fill="#565f89" font-family="Segoe UI,Arial,sans-serif" font-size="11">' +
    escapeXml(subtitle) + "</text>";
}

const user = await github("/users/" + username);
const allRepos = await github("/users/" + username + "/repos?per_page=100&type=owner");
const repos = allRepos.filter((repo) => !repo.fork && !repo.archived);
const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
const stats = [
  ["PUBLIC REPOSITORIES", repos.length],
  ["STARS EARNED", stars],
  ["FORKS", forks],
  ["FOLLOWERS", user.followers]
];

let statsSvg = svgStart(660, 220, username + "'s GitHub Stats", "Public non-fork repositories · refreshed every six hours");
for (let index = 0; index < stats.length; index += 1) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = 30 + column * 315;
  const y = 108 + row * 68;
  statsSvg += '<text x="' + x + '" y="' + y + '" fill="#7aa2f7" font-family="Segoe UI,Arial,sans-serif" font-size="11" font-weight="600" letter-spacing="1">' +
    escapeXml(stats[index][0]) + "</text>";
  statsSvg += '<text x="' + x + '" y="' + (y + 27) + '" fill="#c0caf5" font-family="Segoe UI,Arial,sans-serif" font-size="22" font-weight="700">' +
    number(stats[index][1]) + "</text>";
}
statsSvg += "</svg>";

const languageResponses = await Promise.all(repos.map((repo) =>
  github("/repos/" + username + "/" + encodeURIComponent(repo.name) + "/languages")
));
const languageTotals = new Map();
for (const languageMap of languageResponses) {
  for (const [language, bytes] of Object.entries(languageMap)) {
    languageTotals.set(language, (languageTotals.get(language) || 0) + bytes);
  }
}
const languageEntries = Array.from(languageTotals.entries()).sort((a, b) => b[1] - a[1]);
const totalBytes = languageEntries.reduce((sum, entry) => sum + entry[1], 0);
const topLanguages = languageEntries.slice(0, 6);
const colors = {
  "C": "#555555",
  "C#": "#178600",
  "C++": "#f34b7d",
  "CSS": "#563d7c",
  "Dart": "#00b4ab",
  "Go": "#00add8",
  "HTML": "#e34c26",
  "Java": "#b07219",
  "JavaScript": "#f1e05a",
  "Kotlin": "#a97bff",
  "Python": "#3572a5",
  "Ruby": "#701516",
  "Rust": "#dea584",
  "Shell": "#89e051",
  "Swift": "#f05138",
  "TypeScript": "#3178c6"
};

let languagesSvg = svgStart(520, 300, "Top Languages", "Language bytes across public non-fork repositories");
if (topLanguages.length === 0 || totalBytes === 0) {
  languagesSvg += '<text x="28" y="112" fill="#a9b1d6" font-family="Segoe UI,Arial,sans-serif" font-size="14">No public language data yet</text>';
} else {
  topLanguages.forEach(([language, bytes], index) => {
    const y = 91 + index * 32;
    const percent = (bytes / totalBytes) * 100;
    const barWidth = Math.max(3, Math.round(330 * percent / 100));
    const color = colors[language] || "#7aa2f7";
    languagesSvg += '<text x="28" y="' + y + '" fill="#c0caf5" font-family="Segoe UI,Arial,sans-serif" font-size="12">' +
      escapeXml(language) + "</text>";
    languagesSvg += '<rect x="130" y="' + (y - 10) + '" width="330" height="8" rx="4" fill="#292e42"/>';
    languagesSvg += '<rect x="130" y="' + (y - 10) + '" width="' + barWidth + '" height="8" rx="4" fill="' + color + '"/>';
    languagesSvg += '<text x="488" y="' + y + '" text-anchor="end" fill="#a9b1d6" font-family="Segoe UI,Arial,sans-serif" font-size="11">' +
      percent.toFixed(1) + "%</text>";
  });
}
languagesSvg += "</svg>";

await mkdir("assets", { recursive: true });
await writeFile("assets/github-stats.svg", statsSvg + "\n", "utf8");
await writeFile("assets/top-languages.svg", languagesSvg + "\n", "utf8");
console.log("Generated stats for " + repos.length + " public non-fork repositories.");
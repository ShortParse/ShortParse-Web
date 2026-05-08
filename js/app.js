let currentJobId = null;
let pollTimer = null;
let currentReportData = null;
let selectedAnalysisIndex = 0;

const CLASS_COLORS = {
  "DeathKnight": "#C41E3A",
  "Death Knight": "#C41E3A",
  "DemonHunter": "#A330C9",
  "Demon Hunter": "#A330C9",
  "Druid": "#FF7C0A",
  "Evoker": "#33937F",
  "Hunter": "#AAD372",
  "Mage": "#3FC7EB",
  "Monk": "#00FF98",
  "Paladin": "#F48CBA",
  "Priest": "#FFFFFF",
  "Rogue": "#FFF468",
  "Shaman": "#0070DD",
  "Warlock": "#8788EE",
  "Warrior": "#C69B6D"
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("analyzeButton")
    .addEventListener("click", startAnalysis);
});

function statusCard() {
  return document
    .querySelector(".status")
    .closest(".card");
}

async function startAnalysis() {
  statusCard().classList.remove("hidden");

  const reportUrl = document
    .getElementById("reportUrl")
    .value
    .trim();

  const button = document.getElementById("analyzeButton");
  const status = document.getElementById("status");

  clearRenderedResults();

  if (!reportUrl) {
    status.textContent =
      "Please paste a Warcraft Logs URL.";
    return;
  }

  button.disabled = true;

  status.textContent = "Creating job...";

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        report_url: reportUrl
      })
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create job: ${response.status}`
      );
    }

    const job = await response.json();

    currentJobId = job.job_id;

    status.textContent =
      "Job queued. Starting analysis...";

    await pollJob();

    pollTimer = setInterval(
      pollJob,
      3000
    );

  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
}

async function pollJob() {
  const button =
    document.getElementById("analyzeButton");

  const status =
    document.getElementById("status");

  if (!currentJobId) {
    return;
  }

  try {
    const response = await fetch(
      `/api/jobs/${currentJobId}/summary`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job summary: ${response.status}`
      );
    }

    const summary = await response.json();

    status.textContent =
      `Status: ${summary.status}`;

    if (summary.status === "completed") {

      clearInterval(pollTimer);

      const resultResponse = await fetch(
        `/api/jobs/${currentJobId}/result`
      );

      if (!resultResponse.ok) {
        throw new Error(
          `Failed to fetch result: ${resultResponse.status}`
        );
      }

      const analysis =
        await resultResponse.json();

      currentReportData = analysis;
      selectedAnalysisIndex = 0;

      statusCard().classList.add("hidden");

      renderReport(analysis);

      button.disabled = false;

      return;
    }

    if (summary.status === "failed") {

      clearInterval(pollTimer);

      status.textContent =
        "Status: failed";

      showDebug(
        "Analysis failed.\n\n" +
        "Reason:\n" +
        (summary.error || "Unknown error.")
      );

      button.disabled = false;
    }

  } catch (error) {
    status.textContent = error.message;

    button.disabled = false;

    clearInterval(pollTimer);
  }
}

function renderReport(data) {
  if (
    !data.analyses ||
    !data.analyses.length
  ) {
    showDebug(
      JSON.stringify(data, null, 2)
    );

    return;
  }

  renderBossTiles(data);

  renderSelectedAnalysis(0);
}

function renderBossTiles(data) {
  const bossTilesCard =
    document.getElementById("bossTilesCard");

  const bossTiles =
    document.getElementById("bossTiles");

  bossTiles.innerHTML =
    data.analyses.map((analysis, index) => {

      const fight = analysis.fight || {};
      const raid = analysis.raid || {};
      const scorecard =
        analysis.scorecard || [];

      const issues =
        analysis.issues || [];

      const result =
        fight.kill
          ? "Kill"
          : "Best Wipe";

      const duration =
        formatDurationSeconds(
          fight.duration_seconds
        );

      const hp =
        fight.boss_percentage != null
          ? `${fight.boss_percentage}% HP`
          : "HP unknown";

      return `
        <button
          class="boss-tile ${index === selectedAnalysisIndex ? "active" : ""}"
          type="button"
          onclick="selectBoss(${index})"
        >
          <div class="boss-name">
            ${escapeHtml(fight.name || "Unknown Boss")}
          </div>

          <div class="boss-meta">
            <span class="meta-pill">
              ${escapeHtml(raid.name || "Unknown Raid")}
            </span>

            <span class="meta-pill">
              ${escapeHtml(result)}
            </span>

            <span class="meta-pill">
              ${escapeHtml(duration)}
            </span>

            <span class="meta-pill">
              ${escapeHtml(hp)}
            </span>

            <span class="meta-pill">
              ${scorecard.length} players
            </span>

            <span class="meta-pill">
              ${issues.length} issues
            </span>
          </div>
        </button>
      `;
    }).join("");

  bossTilesCard
    .classList
    .remove("hidden");
}

function selectBoss(index) {
  selectedAnalysisIndex = index;

  renderBossTiles(currentReportData);

  renderSelectedAnalysis(index);

  document
    .getElementById("resultCard")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function renderSelectedAnalysis(index) {
  const analysis =
    currentReportData.analyses[index];

  if (!analysis) {
    return;
  }

  const playerLookup =
    buildPlayerLookup(analysis);

  renderSummary(
    currentReportData,
    analysis,
    playerLookup
  );

  renderScorecard(
    analysis.scorecard || [],
    playerLookup
  );

  renderBenchmarks(
      analysis.benchmarks || {},
      playerLookup
  );

  renderIssues(
    analysis.issues || [],
    playerLookup
  );

  document
    .getElementById("rawResult")
    .textContent =
      JSON.stringify(
        currentReportData,
        null,
        2
      );
}

function renderSummary(
  data,
  analysis,
  playerLookup
) {
  const report = data.report || {};
  const fight = analysis.fight || {};
  const raid = analysis.raid || {};
  const scorecard =
    analysis.scorecard || [];

  const issues =
    analysis.issues || [];

  const timelineSummary =
    analysis.timeline_summary || {};

  const worstPlayer =
    scorecard[0];

  document
    .getElementById("selectedBossTitle")
    .textContent =
      fight.name || "Report Summary";

  document
    .getElementById("selectedBossSubtitle")
    .textContent =
      `${raid.name || "Unknown Raid"} • ${fight.kill ? "Kill" : "Best Wipe"}`;

  const stats = [
    ["Report", report.title || "Unknown"],
    ["Raid", raid.name || "Unknown"],
    ["Fight", fight.name || "Unknown"],
    ["Result", fight.kill ? "Kill" : "Best Wipe"],
    [
      "Duration",
      formatDurationSeconds(
        fight.duration_seconds
      )
    ],
    [
      "Boss HP Left",
      fight.boss_percentage != null
        ? `${fight.boss_percentage}%`
        : "Unknown"
    ],
    ["Players", String(scorecard.length)],
    [
      "Top Concern",
      worstPlayer
        ? getPlayerDisplayName(
            worstPlayer.player,
            playerLookup
          )
        : "None"
    ],
    ["Issues", String(issues.length)],
    [
      "Deaths",
      String(
        timelineSummary.deaths ?? "N/A"
      )
    ],
    [
      "Mechanics",
      String(
        timelineSummary.mechanics ?? "N/A"
      )
    ],
    [
      "Cooldowns",
      String(
        timelineSummary.cooldowns ?? "N/A"
      )
    ]
  ];

  const grid =
    document.getElementById("summaryGrid");

  grid.innerHTML = stats.map(
    ([label, value]) => `
      <div class="stat">
        <div class="stat-label">
          ${escapeHtml(label)}
        </div>

        <div class="stat-value">
          ${value}
        </div>
      </div>
    `
  ).join("");

  document
    .getElementById("resultCard")
    .classList
    .remove("hidden");
}

function renderScorecard(
  scorecard,
  playerLookup
) {
  if (!scorecard.length) {

    document
      .getElementById("scorecardCard")
      .classList
      .add("hidden");

    return;
  }

  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Class</th>
            <th>Spec</th>
            <th>Role</th>
            <th>Grade</th>
            <th>Issue Score</th>
            <th>Major</th>
            <th>Warnings</th>
            <th>Top Issue</th>
          </tr>
        </thead>

        <tbody>
          ${scorecard.map(row => {

            const player =
              playerLookup[row.player] || {};

            return `
              <tr>
                <td>
                  ${renderPlayerName(
                    row.player,
                    playerLookup
                  )}
                </td>

                <td>
                  ${escapeHtml(player.className || "Unknown")}
                </td>

                <td>
                  ${escapeHtml(player.spec || "Unknown")}
                </td>

                <td>
                  ${escapeHtml(player.role || "Unknown")}
                </td>

                <td>
                  <span class="pill grade-${escapeHtml(row.grade)}">
                    ${escapeHtml(row.grade)}
                  </span>
                </td>

                <td>
                  ${escapeHtml(row.issue_score)}
                </td>

                <td>
                  ${escapeHtml(row.major_count)}
                </td>

                <td>
                  ${escapeHtml(row.warning_count)}
                </td>

                <td>
                  ${escapeHtml(row.top_issue || "")}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
    .getElementById("scorecardTable")
    .innerHTML = html;

  document
    .getElementById("scorecardCard")
    .classList
    .remove("hidden");
}

function renderBenchmarks(
  benchmarks,
  playerLookup
) {
  const benchmarkEntries =
    Object.entries(benchmarks || {});

  if (!benchmarkEntries.length) {
    document
      .getElementById("benchmarksCard")
      .classList
      .add("hidden");

    return;
  }

  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Metric</th>
            <th>Player Value</th>
            <th>Top 1</th>
            <th>Top 5</th>
            <th>Top 10</th>
            <th>Average</th>
            <th>% Avg</th>
            <th>Grade</th>
          </tr>
        </thead>

        <tbody>
          ${benchmarkEntries.map(([playerName, comparison]) => {
            const benchmark = comparison.benchmark || {};

            return `
              <tr>
                <td>
                  ${renderPlayerName(playerName, playerLookup)}
                </td>

                <td>
                  ${escapeHtml((comparison.metric || "").toUpperCase())}
                </td>

                <td class="benchmark-value">
                  ${formatNumber(comparison.player_value)}
                </td>

                <td>
                  ${renderBenchmarkEntry(benchmark.top_1)}
                </td>

                <td>
                  ${renderBenchmarkEntry(benchmark.top_5)}
                </td>

                <td>
                  ${renderBenchmarkEntry(benchmark.top_10)}
                </td>

                <td class="benchmark-value">
                  ${formatNumber(benchmark.average_baseline)}
                </td>

                <td>
                  ${comparison.percent_of_average ?? "N/A"}%
                </td>

                <td>
                  <span class="pill grade-${escapeHtml(comparison.grade)}">
                    ${escapeHtml(comparison.grade)}
                  </span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
    .getElementById("benchmarksTable")
    .innerHTML = html;

  document
    .getElementById("benchmarksCard")
    .classList
    .remove("hidden");
}


function renderBenchmarkEntry(entry) {
  if (!entry) {
    return `<span class="benchmark-muted">N/A</span>`;
  }

  const value = formatNumber(entry.value);
  const player = escapeHtml(entry.player_name || "Unknown");
  const rank = escapeHtml(entry.rank || "");

  if (!entry.compare_url) {
    return `
      <div class="benchmark-value">
        ${value}
      </div>
      <div class="benchmark-muted">
        ${player}
      </div>
    `;
  }

  return `
    <div class="benchmark-value">
      ${value}
    </div>

    <div class="benchmark-muted">
      ${player}
    </div>

    <a
      class="compare-link"
      href="${escapeHtml(entry.compare_url)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      View Compare
    </a>
  `;
}


function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  return Number(value).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 1
    }
  );
}

function renderIssues(
  issues,
  playerLookup
) {
  if (!issues.length) {

    document
      .getElementById("issuesCard")
      .classList
      .add("hidden");

    return;
  }

  const topIssues =
    issues.slice(0, 20);

  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Score</th>
            <th>Player</th>
            <th>Category</th>
            <th>Issue</th>
          </tr>
        </thead>

        <tbody>
          ${topIssues.map(issue => `
            <tr>
              <td class="severity-${escapeHtml(issue.severity)}">
                ${escapeHtml(issue.severity)}
              </td>

              <td>
                ${escapeHtml(issue.score)}
              </td>

              <td>
                ${renderPlayerName(
                  issue.player,
                  playerLookup
                )}
              </td>

              <td>
                ${escapeHtml(issue.category)}
              </td>

              <td>
                ${escapeHtml(issue.message)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
    .getElementById("issuesTable")
    .innerHTML = html;

  document
    .getElementById("issuesCard")
    .classList
    .remove("hidden");
}

function buildPlayerLookup(
  analysis
) {
  const lookup = {};

  for (
    const player of analysis.roster || []
  ) {
    lookup[player.name] = {
      className:
        normalizeClassName(player.class),

      spec: player.spec,
      role: player.role
    };
  }

  return lookup;
}

function renderPlayerName(
  playerName,
  playerLookup
) {
  const player =
    playerLookup[playerName];

  const color =
    getClassColor(
      player?.className
    );

  return `
    <span
      class="player-name"
      style="color: ${color}"
    >
      ${escapeHtml(playerName)}
    </span>
  `;
}

function getPlayerDisplayName(
  playerName,
  playerLookup
) {
  return renderPlayerName(
    playerName,
    playerLookup
  );
}

function getClassColor(
  className
) {
  return (
    CLASS_COLORS[className]
    || "#FFFFFF"
  );
}

function normalizeClassName(
  className
) {
  if (!className) {
    return "Unknown";
  }

  const classMap = {
    "DeathKnight":
      "Death Knight",

    "DemonHunter":
      "Demon Hunter"
  };

  return (
    classMap[className]
    || className
  );
}

function formatDurationSeconds(
  seconds
) {
  if (
    seconds == null ||
    Number.isNaN(Number(seconds))
  ) {
    return "Unknown";
  }

  const totalSeconds =
    Math.round(Number(seconds));

  const minutes =
    Math.floor(totalSeconds / 60);

  const remainder =
    totalSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function clearRenderedResults() {
  currentReportData = null;
  selectedAnalysisIndex = 0;

  document
    .getElementById("bossTilesCard")
    .classList
    .add("hidden");

  document
    .getElementById("resultCard")
    .classList
    .add("hidden");

  document
    .getElementById("scorecardCard")
    .classList
    .add("hidden");

  document
      .getElementById("benchmarksCard")
      .classList
      .add("hidden");

  document
      .getElementById("benchmarksTable")
      .innerHTML = "";

  document
      .getElementById("issuesCard")
      .classList
      .add("hidden");

  document
    .getElementById("debugCard")
    .classList
    .add("hidden");

  document
    .getElementById("bossTiles")
    .innerHTML = "";

  document
    .getElementById("summaryGrid")
    .innerHTML = "";

  document
    .getElementById("scorecardTable")
    .innerHTML = "";

  document
    .getElementById("issuesTable")
    .innerHTML = "";

  document
    .getElementById("rawResult")
    .textContent = "";
}

function showDebug(text) {
  document
    .getElementById("rawResult")
    .textContent = text;

  document
    .getElementById("debugCard")
    .classList
    .remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
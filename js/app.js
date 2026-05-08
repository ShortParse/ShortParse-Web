let currentJobId = null;
let pollTimer = null;
let currentReportData = null;
let selectedAnalysisIndex = 0;
let selectedTab = "scorecard";
let currentShareUrl = "";

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
  document.getElementById("analyzeButton").addEventListener("click", startAnalysis);
  document.getElementById("copyShareButton").addEventListener("click", copyShareLink);
  document.getElementById("analyzeAnotherButton").addEventListener("click", resetToAnalyzeMode);

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTab = button.dataset.tab;
      renderActiveTab();
    });
  });

  loadSharedJobFromUrl();
});

function statusCard() {
  return document.getElementById("statusCard");
}

function analyzeCard() {
  return document.getElementById("analyzeCard");
}

function headerActions() {
  return document.getElementById("headerActions");
}

async function startAnalysis() {
  statusCard().classList.remove("hidden");

  const reportUrl = document.getElementById("reportUrl").value.trim();
  const button = document.getElementById("analyzeButton");
  const status = document.getElementById("status");

  clearRenderedResults();

  if (!reportUrl) {
    status.textContent = "Please paste a Warcraft Logs URL.";
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
      throw new Error(`Failed to create job: ${response.status}`);
    }

    const job = await response.json();

    currentJobId = job.job_id;
    status.textContent = "Job queued. Starting analysis...";

    await pollJob();

    pollTimer = setInterval(pollJob, 3000);
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
}

async function pollJob() {
  const button = document.getElementById("analyzeButton");
  const status = document.getElementById("status");

  if (!currentJobId) {
    return;
  }

  try {
    const response = await fetch(`/api/jobs/${currentJobId}/summary`);

    if (!response.ok) {
      throw new Error(`Failed to fetch job summary: ${response.status}`);
    }

    const summary = await response.json();
    status.textContent = `Status: ${summary.status}`;

    if (summary.status === "completed") {
      clearInterval(pollTimer);

      const resultResponse = await fetch(`/api/jobs/${currentJobId}/result`);

      if (!resultResponse.ok) {
        throw new Error(`Failed to fetch result: ${resultResponse.status}`);
      }

      const analysis = await resultResponse.json();

      currentReportData = analysis;
      selectedAnalysisIndex = 0;
      selectedTab = "scorecard";

      enterReportMode(currentJobId);
      renderReport(analysis);

      button.disabled = false;
      return;
    }

    if (summary.status === "failed") {
      clearInterval(pollTimer);

      status.textContent = "Status: failed";

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

async function loadSharedJobFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("job");

  if (!jobId) {
    return;
  }

  currentJobId = jobId;

  statusCard().classList.remove("hidden");

  const status = document.getElementById("status");
  status.textContent = "Loading shared report...";

  try {
    const response = await fetch(`/api/jobs/${jobId}/result`);

    if (!response.ok) {
      throw new Error(`Failed to load shared report: ${response.status}`);
    }

    const analysis = await response.json();

    currentReportData = analysis;
    selectedAnalysisIndex = 0;
    selectedTab = "scorecard";

    enterReportMode(jobId);
    renderReport(analysis);
  } catch (error) {
    status.textContent = error.message;
  }
}

function enterReportMode(jobId) {
  currentShareUrl = `${window.location.origin}${window.location.pathname}?job=${jobId}`;

  analyzeCard().classList.add("hidden");
  statusCard().classList.add("hidden");
  headerActions().classList.remove("hidden");
}

function resetToAnalyzeMode() {
  clearRenderedResults();

  currentJobId = null;
  currentShareUrl = "";

  analyzeCard().classList.remove("hidden");
  statusCard().classList.remove("hidden");
  headerActions().classList.add("hidden");

  document.getElementById("status").textContent = "Waiting for report...";
  document.getElementById("analyzeButton").disabled = false;

  window.history.replaceState({}, "", window.location.pathname);
}

async function copyShareLink() {
  if (!currentShareUrl && currentJobId) {
    currentShareUrl = `${window.location.origin}${window.location.pathname}?job=${currentJobId}`;
  }

  await navigator.clipboard.writeText(currentShareUrl);

  const button = document.getElementById("copyShareButton");
  button.textContent = "Copied!";

  setTimeout(() => {
    button.textContent = "Share This Report";
  }, 1500);
}

function renderReport(data) {
  if (!data.analyses || !data.analyses.length) {
    showDebug(JSON.stringify(data, null, 2));
    return;
  }

  renderBossTiles(data);
  renderSelectedAnalysis(0);
}

function renderBossTiles(data) {
  const bossTilesCard = document.getElementById("bossTilesCard");
  const bossTiles = document.getElementById("bossTiles");

  bossTiles.innerHTML = data.analyses.map((analysis, index) => {
    const fight = analysis.fight || {};
    const raid = analysis.raid || {};
    const scorecard = analysis.scorecard || [];
    const issues = analysis.issues || [];

    const result = fight.kill ? "Kill" : "Best Wipe";
    const duration = formatDurationSeconds(fight.duration_seconds);

    const hp = fight.boss_percentage != null
      ? `${fight.boss_percentage}% HP`
      : "HP unknown";

    return `
      <button
        class="boss-tile ${index === selectedAnalysisIndex ? "active" : ""}"
        type="button"
        onclick="selectBoss(${index})"
      >
        <div class="boss-name">${escapeHtml(fight.name || "Unknown Boss")}</div>

        <div class="boss-meta">
          <span class="meta-pill">${escapeHtml(raid.name || "Unknown Raid")}</span>
          <span class="meta-pill">${escapeHtml(result)}</span>
          <span class="meta-pill">${escapeHtml(duration)}</span>
          <span class="meta-pill">${escapeHtml(hp)}</span>
          <span class="meta-pill">${scorecard.length} players</span>
          <span class="meta-pill">${issues.length} issues</span>
        </div>
      </button>
    `;
  }).join("");

  bossTilesCard.classList.remove("hidden");
}

function selectBoss(index) {
  selectedAnalysisIndex = index;
  selectedTab = "scorecard";

  renderBossTiles(currentReportData);
  renderSelectedAnalysis(index);

  document.getElementById("resultCard").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderSelectedAnalysis(index) {
  const analysis = currentReportData.analyses[index];

  if (!analysis) {
    return;
  }

  const playerLookup = buildPlayerLookup(analysis);

  renderSummary(currentReportData, analysis, playerLookup);
  renderActiveTab();

  document.getElementById("detailsCard").classList.remove("hidden");
}

function renderActiveTab() {
  const analysis = currentReportData?.analyses?.[selectedAnalysisIndex];

  if (!analysis) {
    return;
  }

  const playerLookup = buildPlayerLookup(analysis);

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === selectedTab);
  });

  if (selectedTab === "scorecard") {
    renderScorecardTab(analysis.scorecard || [], playerLookup);
    return;
  }

  if (selectedTab === "benchmarks") {
    renderBenchmarksTab(analysis.benchmarks || {}, playerLookup);
    return;
  }

  if (selectedTab === "playerMetrics") {
    renderPlayerMetricsTab(analysis.player_metrics || {}, playerLookup);
    return;
  }

  if (selectedTab === "cooldowns") {
    renderCooldownsTab(analysis.player_metrics || {}, playerLookup);
    return;
  }

  if (selectedTab === "timeline") {
    renderTimelineTab(analysis.timeline || [], playerLookup);
    return;
  }

  if (selectedTab === "issues") {
    renderIssuesTab(analysis.issues || [], playerLookup);
    return;
  }

  if (selectedTab === "raw") {
    renderRawTab();
  }
}

function renderSummary(data, analysis, playerLookup) {
  const report = data.report || {};
  const fight = analysis.fight || {};
  const raid = analysis.raid || {};
  const scorecard = analysis.scorecard || [];
  const issues = analysis.issues || [];
  const timelineSummary = analysis.timeline_summary || {};
  const worstPlayer = scorecard[0];

  document.getElementById("selectedBossTitle").textContent =
    fight.name || "Report Summary";

  document.getElementById("selectedBossSubtitle").textContent =
    `${raid.name || "Unknown Raid"} • ${fight.kill ? "Kill" : "Best Wipe"}`;

  const stats = [
    ["Report", report.title || "Unknown"],
    ["Raid", raid.name || "Unknown"],
    ["Fight", fight.name || "Unknown"],
    ["Result", fight.kill ? "Kill" : "Best Wipe"],
    ["Duration", formatDurationSeconds(fight.duration_seconds)],
    ["Boss HP Left", fight.boss_percentage != null ? `${fight.boss_percentage}%` : "Unknown"],
    ["Players", String(scorecard.length)],
    ["Top Concern", worstPlayer ? getPlayerDisplayName(worstPlayer.player, playerLookup) : "None"],
    ["Issues", String(issues.length)],
    ["Deaths", String(timelineSummary.deaths ?? "N/A")],
    ["Mechanics", String(timelineSummary.mechanics ?? "N/A")],
    ["Cooldowns", String(timelineSummary.cooldowns ?? "N/A")]
  ];

  const grid = document.getElementById("summaryGrid");

  grid.innerHTML = stats.map(([label, value]) => `
    <div class="stat">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
    </div>
  `).join("");

  document.getElementById("resultCard").classList.remove("hidden");
}

function renderScorecardTab(scorecard, playerLookup) {
  if (!scorecard.length) {
    renderEmptyTab("Scorecard", "No scorecard data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Scorecard</h2>
    <p class="tab-panel-description">Players are sorted by highest issue score first.</p>

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
            const player = playerLookup[row.player] || {};

            return `
              <tr>
                <td>${renderPlayerName(row.player, playerLookup)}</td>
                <td>${escapeHtml(player.className || "Unknown")}</td>
                <td>${escapeHtml(player.spec || "Unknown")}</td>
                <td>${escapeHtml(player.role || "Unknown")}</td>
                <td><span class="pill grade-${escapeHtml(row.grade)}">${escapeHtml(row.grade)}</span></td>
                <td>${escapeHtml(row.issue_score)}</td>
                <td>${escapeHtml(row.major_count)}</td>
                <td>${escapeHtml(row.warning_count)}</td>
                <td>${escapeHtml(row.top_issue || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBenchmarksTab(benchmarks, playerLookup) {
  const benchmarkEntries = Object.entries(benchmarks || {});

  if (!benchmarkEntries.length) {
    renderEmptyTab("Benchmark Comparisons", "No benchmark data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Benchmark Comparisons</h2>
    <p class="tab-panel-description">
      Compare each player against Top 1, Top 5, and Top 10 Warcraft Logs benchmark parses.
    </p>

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
                <td>${renderPlayerName(playerName, playerLookup)}</td>
                <td>${escapeHtml((comparison.metric || "").toUpperCase())}</td>
                <td class="benchmark-value">${formatNumber(comparison.player_value)}</td>
                <td>${renderBenchmarkEntry(benchmark.top_1)}</td>
                <td>${renderBenchmarkEntry(benchmark.top_5)}</td>
                <td>${renderBenchmarkEntry(benchmark.top_10)}</td>
                <td class="benchmark-value">${formatNumber(benchmark.average_baseline)}</td>
                <td>${comparison.percent_of_average ?? "N/A"}%</td>
                <td><span class="pill grade-${escapeHtml(comparison.grade)}">${escapeHtml(comparison.grade)}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayerMetricsTab(playerMetrics, playerLookup) {
  const entries = Object.entries(playerMetrics || {});

  if (!entries.length) {
    renderEmptyTab("Player Metrics", "No player metric data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Player Metrics</h2>
    <p class="tab-panel-description">
      Core performance, survival, activity, and consumable data for each player.
    </p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>DPS</th>
            <th>HPS</th>
            <th>DTPS</th>
            <th>Deaths</th>
            <th>Active %</th>
            <th>Avoidable Hits</th>
            <th>Avoidable Damage</th>
            <th>Potions</th>
            <th>Healthstone</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(([playerName, data]) => {
            const identity = data.identity || {};
            const performance = data.performance || {};
            const activity = data.activity || {};
            const consumables = data.consumables || {};

            return `
              <tr>
                <td>${renderPlayerName(playerName, playerLookup)}</td>
                <td>${escapeHtml(identity.role || "Unknown")}</td>
                <td>${formatNumber(performance.dps)}</td>
                <td>${formatNumber(performance.hps)}</td>
                <td>${formatNumber(performance.dtps)}</td>
                <td>${escapeHtml(performance.deaths ?? "N/A")}</td>
                <td>${formatPercent(activity.active_percent)}</td>
                <td>${escapeHtml(performance.avoidable_hit_count ?? "N/A")}</td>
                <td>${formatNumber(performance.avoidable_damage_taken)}</td>
                <td>${escapeHtml(consumables.combat_potions ?? "N/A")}</td>
                <td>${consumables.healthstone_used ? "Yes" : "No"}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}


function renderCooldownsTab(playerMetrics, playerLookup) {
  const rows = [];

  for (const [playerName, data] of Object.entries(playerMetrics || {})) {
    const cooldowns = data.cooldowns || {};

    for (const [cooldownName, cooldownData] of Object.entries(cooldowns)) {
      rows.push({
        playerName,
        cooldownName,
        ...cooldownData
      });
    }
  }

  if (!rows.length) {
    renderEmptyTab("Cooldowns", "No cooldown data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Cooldowns</h2>
    <p class="tab-panel-description">
      Defensive, offensive, and utility cooldown usage detected during the selected fight.
    </p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Cooldown</th>
            <th>Category</th>
            <th>Casts</th>
            <th>Expected</th>
            <th>Efficiency</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${renderPlayerName(row.playerName, playerLookup)}</td>
              <td>${escapeHtml(row.cooldownName)}</td>
              <td>${escapeHtml(row.category || "Unknown")}</td>
              <td>${escapeHtml(row.casts ?? row.count ?? "N/A")}</td>
              <td>${escapeHtml(row.expected_uses ?? row.possible_uses ?? "N/A")}</td>
              <td>${formatPercent(row.efficiency_percent)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


function renderTimelineTab(timeline, playerLookup) {
  if (!timeline || !timeline.length) {
    renderEmptyTab("Timeline", "No timeline data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Timeline</h2>
    <p class="tab-panel-description">
      Important fight events detected during the selected boss encounter.
    </p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Player</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          ${timeline.map(event => `
            <tr>
              <td>${formatTimelineTime(event.time ?? event.timestamp ?? event.relative_time)}</td>
              <td>${escapeHtml(event.type || event.category || "Event")}</td>
              <td>${event.player ? renderPlayerName(event.player, playerLookup) : "—"}</td>
              <td>${escapeHtml(event.message || event.description || event.name || "Unknown event")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderIssuesTab(issues, playerLookup) {
  if (!issues.length) {
    renderEmptyTab("Top Issues", "No issues detected.");
    return;
  }

  const topIssues = issues.slice(0, 20);

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Top Issues</h2>
    <p class="tab-panel-description">
      Highest-priority issues detected for the selected boss encounter.
    </p>

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
              <td class="severity-${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</td>
              <td>${escapeHtml(issue.score)}</td>
              <td>${renderPlayerName(issue.player, playerLookup)}</td>
              <td>${escapeHtml(issue.category)}</td>
              <td>${escapeHtml(issue.message)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRawTab() {
  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Raw JSON</h2>
    <p class="tab-panel-description">Debug output for development.</p>
    <pre>${escapeHtml(JSON.stringify(currentReportData, null, 2))}</pre>
  `;
}

function renderEmptyTab(title, message) {
  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">${escapeHtml(title)}</h2>
    <p class="tab-panel-description">${escapeHtml(message)}</p>
  `;
}

function renderBenchmarkEntry(entry) {
  if (!entry) {
    return `<span class="benchmark-muted">N/A</span>`;
  }

  const value = formatNumber(entry.value);
  const player = escapeHtml(entry.player_name || "Unknown");

  if (!entry.compare_url) {
    return `
      <div class="benchmark-value">${value}</div>
      <div class="benchmark-muted">${player}</div>
    `;
  }

  return `
    <div class="benchmark-value">${value}</div>
    <div class="benchmark-muted">${player}</div>
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

function buildPlayerLookup(analysis) {
  const lookup = {};

  for (const player of analysis.roster || []) {
    lookup[player.name] = {
      className: normalizeClassName(player.class),
      spec: player.spec,
      role: player.role
    };
  }

  return lookup;
}

function renderPlayerName(playerName, playerLookup) {
  const player = playerLookup[playerName];
  const color = getClassColor(player?.className);

  return `
    <span class="player-name" style="color: ${color}">
      ${escapeHtml(playerName)}
    </span>
  `;
}

function getPlayerDisplayName(playerName, playerLookup) {
  return renderPlayerName(playerName, playerLookup);
}

function getClassColor(className) {
  return CLASS_COLORS[className] || "#FFFFFF";
}

function normalizeClassName(className) {
  if (!className) {
    return "Unknown";
  }

  const classMap = {
    "DeathKnight": "Death Knight",
    "DemonHunter": "Demon Hunter"
  };

  return classMap[className] || className;
}

function formatDurationSeconds(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) {
    return "Unknown";
  }

  const totalSeconds = Math.round(Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatPercent(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  return `${Number(value).toFixed(1)}%`;
}


function formatTimelineTime(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  const seconds = Number(value);

  if (seconds > 1000000) {
    return "—";
  }

  return formatDurationSeconds(seconds);
}

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 1
  });
}

function clearRenderedResults() {
  currentReportData = null;
  selectedAnalysisIndex = 0;
  selectedTab = "scorecard";

  document.getElementById("bossTilesCard").classList.add("hidden");
  document.getElementById("resultCard").classList.add("hidden");
  document.getElementById("detailsCard").classList.add("hidden");

  document.getElementById("bossTiles").innerHTML = "";
  document.getElementById("summaryGrid").innerHTML = "";
  document.getElementById("tabContent").innerHTML = "";
}

function showDebug(text) {
  document.getElementById("detailsCard").classList.remove("hidden");

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Debug Output</h2>
    <pre>${escapeHtml(text)}</pre>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
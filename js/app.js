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

function getLogIcon(level) {
  switch (level) {
    case "success":
      return "✓";

    case "error":
      return "✖";

    case "warning":
      return "⚠";

    default:
      return "⟳";
  }
}

function formatLogTime(value) {
  if (!value) {
    return "--:--:--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

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

  clearRenderedResults();

  if (!reportUrl) {
    renderAnalysisConsole({
      status: "waiting",
      progress: 0,
      current_step: "Missing Report URL",
      logs: [
        {
          time: new Date().toISOString(),
          level: "warning",
          message: "Please paste a Warcraft Logs URL."
        }
      ]
    });

    return;
  }

  button.disabled = true;

  renderAnalysisConsole({
    status: "queued",
    progress: 0,
    current_step: "Creating job",
    logs: [
      {
        time: new Date().toISOString(),
        level: "info",
        message: "Creating analysis job..."
      }
    ]
  });

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

    renderAnalysisConsole({
      status: "queued",
      progress: job.progress ?? 0,
      current_step: job.current_step || "Job queued",
      logs: job.logs || [
        {
          time: new Date().toISOString(),
          level: "info",
          message: "Job queued. Starting analysis..."
        }
      ]
    });

    await pollJob();

    pollTimer = setInterval(pollJob, 3000);
  } catch (error) {
    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Error",
      logs: [
        {
          time: new Date().toISOString(),
          level: "error",
          message: error.message
        }
      ]
    });

    button.disabled = false;
  }
}

async function pollJob() {
  const button = document.getElementById("analyzeButton");

  if (!currentJobId) {
    return;
  }

  try {
    const response = await fetch(`/api/jobs/${currentJobId}/summary`);

    if (!response.ok) {
      throw new Error(`Failed to fetch job summary: ${response.status}`);
    }

    const summary = await response.json();

    renderAnalysisConsole(summary);

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

      renderAnalysisConsole(summary);

      showDebug(
        "Analysis failed.\n\n" +
        "Reason:\n" +
        (summary.error || "Unknown error.")
      );

      button.disabled = false;
    }
  } catch (error) {
    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Error",
      logs: [
        {
          time: new Date().toISOString(),
          level: "error",
          message: error.message
        }
      ]
    });

    button.disabled = false;
    clearInterval(pollTimer);
  }
}

function renderAnalysisConsole(summary) {
  const statusCard = document.getElementById("statusCard");
  const existingConsole = document.getElementById("analysisConsole");

  let previousScrollTop = 0;
  let wasNearBottom = true;

  if (existingConsole) {
    previousScrollTop = existingConsole.scrollTop;

    wasNearBottom =
      existingConsole.scrollHeight -
      existingConsole.scrollTop -
      existingConsole.clientHeight <
      120;
  }

  const progress = summary.progress ?? 0;
  const currentStep = summary.current_step || summary.status || "Working...";
  const logs = summary.logs || [];

  statusCard.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Analysis Console</h2>
        <p class="section-description">
          ShortParse is working through the report. This updates live while the job runs.
        </p>
      </div>
    </div>

    <div class="analysis-status-row">
      <div>
        <div class="analysis-status-label">Current Step</div>
        <div class="analysis-current-step">${escapeHtml(currentStep)}</div>
      </div>

      <div class="analysis-progress-number">${escapeHtml(progress)}%</div>
    </div>

    <div class="analysis-progress-bar">
      <div class="analysis-progress-fill" style="width: ${escapeHtml(progress)}%;"></div>
    </div>

    <div id="analysisConsole" class="analysis-console">
      ${logs.map(log => `
        <div class="analysis-log-line analysis-log-${escapeHtml(log.level || "info")}">
          <span class="analysis-log-icon">
            ${getLogIcon(log.level || "info")}
          </span>
          <span class="analysis-log-time">${formatLogTime(log.time)}</span>
          <span class="analysis-log-message">${escapeHtml(log.message)}</span>
        </div>
      `).join("")}
    </div>
  `;

  const newConsole = document.getElementById("analysisConsole");

  if (!newConsole) {
    return;
  }

  if (wasNearBottom) {
    newConsole.scrollTop = newConsole.scrollHeight;
  } else {
    newConsole.scrollTop = previousScrollTop;
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

  statusCard().innerHTML = `
    <div class="section-header">
      <div>
        <h2>Status</h2>
        <p id="status" class="status">Waiting for report...</p>
      </div>
    </div>
  `;

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

function renderBossTiles(data) {
  const bossTilesCard = document.getElementById("bossTilesCard");
  const bossTiles = document.getElementById("bossTiles");

  bossTiles.innerHTML = data.analyses.map((analysis, index) => {
    const fight = analysis.fight || {};

    const difficulty = formatDifficulty(fight.difficulty);
    const resultClass = fight.kill ? "kill" : "wipe";
    const resultLabel = fight.kill
      ? "Kill"
      : `Wipe (${fight.boss_percentage ?? "?"}%)`;

    return `
      <button
        class="encounter-nav-button ${index === selectedAnalysisIndex ? "active" : ""}"
        type="button"
        onclick="selectBoss(${index})"
      >
        <span class="encounter-nav-name">
          ${escapeHtml(fight.name || "Unknown Boss")}
        </span>

        <span class="encounter-nav-meta">
          <span class="encounter-difficulty difficulty-${escapeHtml(difficulty.toLowerCase())}">
            ${escapeHtml(difficulty)}
          </span>

          <span class="encounter-meta-divider">|</span>

          <span class="encounter-result ${resultClass}">
            ${escapeHtml(resultLabel)}
          </span>
        </span>
      </button>
    `;
  }).join("");

  bossTilesCard.classList.remove("hidden");

  const scrollLeftButton = document.getElementById("bossScrollLeft");
  const scrollRightButton = document.getElementById("bossScrollRight");

  scrollLeftButton.onclick = () => {
    bossTiles.scrollBy({
      left: -300,
      behavior: "smooth"
    });
  };

  scrollRightButton.onclick = () => {
    bossTiles.scrollBy({
      left: 300,
      behavior: "smooth"
    });
  };

  bossTiles.onwheel = (event) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();

      bossTiles.scrollBy({
        left: event.deltaY,
        behavior: "smooth"
      });
    }
  };
}

function formatDifficulty(value) {
  const difficultyMap = {
    1: "LFR",
    2: "Normal",
    3: "Heroic",
    4: "Mythic",
    5: "Timewalking",
    10: "Normal",
    14: "Normal",
    15: "Heroic",
    16: "Mythic",
    17: "LFR"
  };

  return difficultyMap[value] || "Unknown";
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

  if (selectedTab === "raidCoach") {
    renderRaidCoachTab(analysis.raid_coach || {});
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

  if (selectedTab === "mechanics") {
    renderMechanicsTab(analysis.mechanics || {});
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

function renderRaidCoachTab(raidCoach) {
  if (!raidCoach || !Object.keys(raidCoach).length) {
    renderEmptyTab("Raid Coach", "No raid coach summary available.");
    return;
  }

  const overallRead =
    raidCoach.overall_read || "No overall summary available.";

  const topPriorities =
    raidCoach.top_priorities || [];

  const whatWentWell =
    raidCoach.what_went_well || [];

  const needsAttention =
    raidCoach.needs_attention || [];

  const nextPullFocus =
    raidCoach.next_pull_focus || [];

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Raid Coach</h2>

    <p class="tab-panel-description">
      Automatically generated raid-analysis insights and recommendations.
    </p>

    <div class="raid-coach-layout">

      <div class="raid-coach-card raid-coach-overall">
        <div class="raid-coach-title">
          Overall Read
        </div>

        <div class="raid-coach-overall-text">
          ${escapeHtml(overallRead)}
        </div>
      </div>

      ${renderRaidCoachSection(
        "Top Priorities",
        topPriorities,
        "priority"
      )}

      ${renderRaidCoachSection(
        "What Went Well",
        whatWentWell,
        "success"
      )}

      ${renderRaidCoachSection(
        "Needs Attention",
        needsAttention,
        "warning"
      )}

      ${renderRaidCoachSection(
        "Next Pull Focus",
        nextPullFocus,
        "focus"
      )}

    </div>
  `;
}

function renderRaidCoachSection(
  title,
  items,
  type = "default"
) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="raid-coach-card">
      <div class="raid-coach-title">
        ${escapeHtml(title)}
      </div>

      <ul class="raid-coach-list">
        ${items.map(item => `
          <li class="raid-coach-item raid-coach-${escapeHtml(type)}">
            ${escapeHtml(item)}
          </li>
        `).join("")}
      </ul>
    </div>
  `;
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
                <td>${renderBenchmarkGrade(comparison)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>     
    </div>
    
    ${hasRelaxedBenchmarkFilters(benchmarkEntries) ? ` <p class="benchmark-disclaimer"> * Benchmark filters were broadened for one or more players to ensure enough comparison parses were available. </p> ` : ""}
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
                <td>${formatPercent(activity.active_time_pct)}</td>
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

function renderMechanicsTab(mechanics) {
  console.log("ShortParse renderMechanicsTab fired", mechanics);

  const analysis = currentReportData?.analyses?.[selectedAnalysisIndex];
  const playerLookup = buildPlayerLookup(analysis || {});
  const raidMechanics = mechanics.raid_mechanics || {};
  const rows = Object.entries(raidMechanics);

  if (!rows.length) {
    renderEmptyTab("Mechanics", "No tracked mechanic data available.");
    return;
  }

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Mechanics</h2>
    <p class="tab-panel-description">
      Raid-wide tracked mechanics for the selected boss encounter.
    </p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Mechanic</th>
            <th>Severity</th>
            <th>Hits</th>
            <th>Damage Taken</th>
            <th>Players Hit</th>
            <th>Worst Player</th>
            <th>Worst Hits</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(([mechanicName, data], index) => {
            const failures = Object.entries(
              data.player_failures || {}
            );

            return `
              <tr>
                <td>
                <button
                  class="mechanic-name-button"
                  onclick="toggleMechanicRow(${index})"
                >
                  <span id="mechanic-arrow-${index}">▶</span>
${escapeHtml(mechanicName)}
</button>
                </td>

                <td class="severity-${escapeHtml(data.severity || "Info")}">
                  ${escapeHtml(data.severity || "Info")}
                </td>

                <td>${formatNumber(data.hits)}</td>

                <td>${formatNumber(data.damage)}</td>

                <td>
                  ${Array.isArray(data.players_hit)
                    ? data.players_hit.length
                    : 0}
                </td>

                <td>${escapeHtml(data.worst_player || "—")}</td>

                <td>${formatNumber(data.worst_hits)}</td>

                <td>${escapeHtml(data.note || "")}</td>
              </tr>

              <tr
                id="mechanic-expand-${index}"
                class="mechanic-expanded-row hidden"
              >
                <td colspan="8">
                  <div class="mechanic-expanded-content">

                    <div class="mechanic-expanded-title">
                      Player Failures
                    </div>

                    <table class="mechanic-player-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Hits</th>
                          <th>Damage Taken</th>
                        </tr>
                      </thead>

                      <tbody>
                        ${failures.map(([playerName, playerData]) => `
                          <tr>
                            <td>${renderPlayerName(playerName, playerLookup)}</td>
                            <td>${formatNumber(playerData.hits)}</td>
                            <td>${formatNumber(playerData.damage)}</td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>

                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function toggleMechanicRow(index) {
  const row = document.getElementById(`mechanic-expand-${index}`);
  const arrow = document.getElementById(`mechanic-arrow-${index}`);

  if (!row || !arrow) {
    return;
  }

  const isHidden = row.classList.contains("hidden");

  row.classList.toggle("hidden");

  arrow.textContent = isHidden
    ? "▼"
    : "▶";
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
              <td>${escapeHtml(row.possible_casts ?? "N/A")}</td>
              <td>${formatPercent(row.efficiency_pct)}</td>
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
            <th>Source</th>
            <th>Target</th>
            <th>Spell</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          ${timeline.map(event => `
            <tr>
              <td>${escapeHtml(event.time || "—")}</td>
              <td>${escapeHtml(event.type || "Event")}</td>
              <td>${event.source ? renderPlayerName(event.source, playerLookup) : "—"}</td>
              <td>${event.target ? renderPlayerName(event.target, playerLookup) : "—"}</td>
              <td>${escapeHtml(event.spell_name || "—")}</td>
              <td>${escapeHtml(event.summary || "Unknown event")}</td>
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


function renderBenchmarkGrade(comparison) {
  const grade = comparison.grade || "N/A";

  const needsDisclaimer =
    comparison.used_relaxed_filters === true;

  const tier =
    comparison.filter_tier_used || "Unknown";

  const matches =
    comparison.filter_match_count ?? "N/A";

  return `
    <span
      class="pill grade-${escapeHtml(grade)} benchmark-grade"
      title="${
        needsDisclaimer
          ? `Benchmark filters broadened. Tier: ${tier}. Matches: ${matches}.`
          : "Strict benchmark filters used."
      }"
    >
      ${escapeHtml(grade)}
      ${
        needsDisclaimer
          ? '<span class="benchmark-asterisk">*</span>'
          : ""
      }
    </span>
  `;
}

function hasRelaxedBenchmarkFilters(benchmarkEntries) {
  return benchmarkEntries.some(([, comparison]) => {
    return comparison.used_relaxed_filters === true;
  });
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
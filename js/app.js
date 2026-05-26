let currentJobId = null;
let pollTimer = null;
let currentReportData = null;
let selectedAnalysisIndex = 0;
let selectedTab = "scorecard";
let currentShareUrl = "";
let currentUserWebhook = "";
let offlineMode = false;
let benchmarkSelectedPlayer = null;
let benchmarkComparisonMode = "high_performer";


function setOfflineMode(enabled) {
  offlineMode = enabled;

  const banner = document.getElementById("offlineBanner");

  if (!banner) {
    return;
  }

  banner.classList.toggle("hidden", !enabled);
}

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
      updateAddressBar();
    });
  });

  // Player Coach Drawer Close Triggers
  const closeBtn = document.getElementById("closeCoachDrawer");
  if (closeBtn) closeBtn.addEventListener("click", closePlayerCoachCard);
  
  const overlay = document.getElementById("coachDrawerOverlay");
  if (overlay) overlay.addEventListener("click", closePlayerCoachCard);

  // Settings Drawer Close Triggers
  const settingsCloseBtn = document.getElementById("closeSettingsDrawer");
  if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", closeSettingsDrawer);
  
  const settingsOverlay = document.getElementById("settingsDrawerOverlay");
  if (settingsOverlay) settingsOverlay.addEventListener("click", closeSettingsDrawer);

  // Death Recap Drawer Close Triggers
  const deathCloseBtn = document.getElementById("closeDeathRecap");
  if (deathCloseBtn) deathCloseBtn.addEventListener("click", closeDeathRecap);

  const deathOverlay = document.getElementById("deathRecapOverlay");
  if (deathOverlay) deathOverlay.addEventListener("click", closeDeathRecap);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePlayerCoachCard();
      closeSettingsDrawer();
      closeDeathRecap();
    }
  });

  // Settings Save & Test Triggers
  const saveWebhookBtn = document.getElementById("saveWebhookButton");
  if (saveWebhookBtn) saveWebhookBtn.addEventListener("click", saveWebhookSettings);

  const testWebhookBtn = document.getElementById("testWebhookButton");
  if (testWebhookBtn) testWebhookBtn.addEventListener("click", testWebhookSettings);

  // Post to Discord Trigger
  const postDiscordBtn = document.getElementById("postDiscordButton");
  if (postDiscordBtn) postDiscordBtn.addEventListener("click", postActiveReportToDiscord);

  checkUserSession(); // Query session on page load
  loadSharedJobFromUrl();

  const builderLink = document.querySelector(".builder-link");
  if (builderLink) {
    builderLink.addEventListener("click", (e) => {
      e.preventDefault();
      initVisualBuilder();
    });
  }

  if (window.location.pathname === "/builder") {
    initVisualBuilder();
  }

  // Guild Logs Hub Collapse Trigger
  const guildHeader = document.getElementById("guildHubHeader");
  if (guildHeader) {
    guildHeader.addEventListener("click", () => {
      const container = document.getElementById("guildHubContent");
      const isCurrentlyCollapsed = container ? container.style.display === "none" : false;
      toggleGuildHub(!isCurrentlyCollapsed);
    });
  }
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

      if (response.status >= 500) {

        setOfflineMode(true);

    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Server Offline",
      logs: [
        {
          time: new Date().toISOString(),
          level: "error",
          message:
            "ShortParse backend is currently offline or restarting."
        }
      ]
    });

    button.disabled = false;
    return;
  }

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
    setOfflineMode(true);

    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Server Offline",
      logs: [
          {
            time: new Date().toISOString(),
            level: "error",
            message:
                "Unable to reach the ShortParse API server."
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

  if (response.status >= 500) {

    setOfflineMode(true);

    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Server Offline",
      logs: [
        {
          time: new Date().toISOString(),
          level: "error",
          message:
            "ShortParse backend is currently offline or restarting."
        }
      ]
    });

    button.disabled = false;
    return;
  }

  throw new Error(`Failed to create job: ${response.status}`);
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
    setOfflineMode(true);

    renderAnalysisConsole({
      status: "failed",
      progress: 100,
      current_step: "Server Offline",
      logs: [
          {
            time: new Date().toISOString(),
            level: "error",
            message:
                "Unable to reach the ShortParse API server."
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

function normalizeTabName(tab) {
  if (!tab) return "scorecard";
  const t = tab.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (t === "scorecard") return "scorecard";
  if (t === "raidcoach" || t === "coach") return "raidCoach";
  if (t === "progression" || t === "wipes" || t === "wipeprogression") return "progression";
  if (t === "benchmarks" || t === "benchmark" || t === "benchmarkcomparisons") return "benchmarks";
  if (t === "playermetrics" || t === "metrics") return "playerMetrics";
  if (t === "mechanics" || t === "mechanic") return "mechanics";
  if (t === "cooldowns" || t === "cooldown") return "cooldowns";
  if (t === "timeline") return "timeline";
  if (t === "issues" || t === "topissues") return "issues";
  if (t === "raw" || t === "rawjson" || t === "json") return "raw";

  return "scorecard";
}

function updateAddressBar() {
  if (currentJobId) {
    let path = `/report/${currentJobId}`;
    if (selectedAnalysisIndex > 0 || selectedTab !== "scorecard") {
      path += `/${selectedAnalysisIndex}`;
    }
    if (selectedTab !== "scorecard") {
      path += `/${selectedTab}`;
    }
    window.history.replaceState({}, "", path);
    currentShareUrl = `${window.location.origin}${path}`;
  }
}

async function loadSharedJobFromUrl() {
  let jobId = null;
  let bossIndex = 0;
  let tabName = "scorecard";

  // 1. Try clean path routing (e.g. /report/UUID/bossIndex/tabName)
  const pathParts = window.location.pathname.split("/");
  const reportIndex = pathParts.findIndex(part => part === "report" || part === "reports");
  if (reportIndex !== -1 && pathParts[reportIndex + 1]) {
    jobId = pathParts[reportIndex + 1];

    if (pathParts[reportIndex + 2]) {
      const parsedIdx = parseInt(pathParts[reportIndex + 2], 10);
      if (!Number.isNaN(parsedIdx)) {
        bossIndex = parsedIdx;
      }
    }

    if (pathParts[reportIndex + 3]) {
      tabName = normalizeTabName(pathParts[reportIndex + 3]);
    }
  }

  // 2. Try query parameter fallback (e.g. ?job=UUID) for backward compatibility
  if (!jobId) {
    const params = new URLSearchParams(window.location.search);
    jobId = params.get("job");
  }

  if (!jobId) {
    return;
  }

  // Validate UUID format before trying to fetch
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return;
  }

  currentJobId = jobId;

  statusCard().classList.remove("hidden");

  const status = document.getElementById("status");
  status.textContent = "Loading shared report...";

  try {
    const response = await fetch(`/api/jobs/${jobId}/result`);

    if (!response.ok) {
      if (response.status >= 500) {
        setOfflineMode(true);
        renderAnalysisConsole({
          status: "failed",
          progress: 100,
          current_step: "Server Offline",
          logs: [
            {
              time: new Date().toISOString(),
              level: "error",
              message: "ShortParse backend is currently offline or restarting."
            }
          ]
        });

        const button = document.getElementById("analyzeButton");
        if (button) button.disabled = false;
        return;
      }

      throw new Error(`Failed to load shared report: ${response.status}`);
    }

    const analysis = await response.json();

    currentReportData = analysis;
    selectedAnalysisIndex = Math.min(Math.max(0, bossIndex), (analysis.analyses || []).length - 1);
    selectedTab = tabName;

    enterReportMode(jobId);
    renderReport(analysis);
  } catch (error) {
    status.textContent = error.message;
  }
}

function enterReportMode(jobId) {
  updateAddressBar();

  analyzeCard().classList.add("hidden");
  statusCard().classList.add("hidden");
  headerActions().classList.remove("hidden");
  
  toggleGuildHub(true); // Collapse Guild Logs Hub when looking at a report
}

function resetToAnalyzeMode() {
  clearRenderedResults();

  currentJobId = null;
  currentShareUrl = "";

  analyzeCard().classList.remove("hidden");
  statusCard().classList.remove("hidden");
  headerActions().classList.add("hidden");
  
  toggleGuildHub(false); // Expand Guild Logs Hub when NOT looking at a report

  statusCard().innerHTML = `
    <div class="section-header">
      <div>
        <h2>Status</h2>
        <p id="status" class="status">Waiting for report...</p>
      </div>
    </div>
  `;

  document.getElementById("analyzeButton").disabled = false;

  // Revert address bar URL to clean root path
  window.history.replaceState({}, "", "/");
}

async function copyShareLink() {
  updateAddressBar();

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
    3: "Normal",
    4: "Heroic",
    5: "Mythic",
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
  updateAddressBar();

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

  try {
    if (selectedTab === "scorecard") {
      renderScorecardTab(analysis.scorecard || [], playerLookup, analysis);
      return;
    }

    if (selectedTab === "raidCoach") {
      renderRaidCoachTab(analysis.raid_coach || {});
      return;
    }

    if (selectedTab === "progression") {
      renderProgressionTab(analysis.progression || {});
      return;
    }

    if (selectedTab === "benchmarks") {
      renderBenchmarksTab(analysis, playerLookup);
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
  } catch (error) {
    console.error("Error rendering active tab:", error);
    renderEmptyTab("Error Loading Tab", `An unexpected error occurred while loading this tab: ${error.message}`);
  }
}

function renderSummary(data, analysis, playerLookup) {
  const report = data.report || {};
  const fight = analysis.fight || {};
  const raid = analysis.raid || {};
  const scorecard = analysis.scorecard || [];
  const issues = analysis.issues || [];
  const worstPlayer = scorecard[0];

  const timeline = analysis.timeline || [];
  const deathsCount = timeline.filter(e => e.type === "death").length;
  const mechanicsCount = timeline.filter(e => e.type === "mechanic").length;
  const cooldownsCount = timeline.filter(e => e.type === "cooldown").length;

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
    ["Deaths", String(deathsCount)],
    ["Mechanics", String(mechanicsCount)],
    ["Cooldowns", String(cooldownsCount)]
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

function renderScorecardTab(scorecard, playerLookup, analysis) {
  if (!scorecard.length) {
    renderEmptyTab("Scorecard", "No scorecard data available.");
    return;
  }

  const gradeMap = {
    "S": "Elite",
    "A": "Master",
    "B": "Expert",
    "C": "Adequate",
    "D": "Fair",
    "F": "Optimizing"
  };

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Roster Optimization Scorecard</h2>
    <p class="tab-panel-description">Roster review sorted by primary coaching priority (highest issue score first).</p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Class</th>
            <th>Spec</th>
            <th>Role</th>
            <th>Deaths</th>
            <th>Comparative Efficiency</th>
            <th>Issue Penalty</th>
            <th>Major Errors</th>
            <th>Warnings</th>
            <th>Primary Coaching Area</th>
          </tr>
        </thead>
        <tbody>
          ${scorecard.map(row => {
            const player = playerLookup[row.player] || {};
            const playerMetrics = analysis?.player_metrics || {};
            const playerMetric = playerMetrics[row.player] || {};
            const performance = playerMetric.performance || {};
            const deathCount = performance.deaths || 0;

            let deathsCell = "";
            if (deathCount > 0) {
              deathsCell = `
                <button type="button" class="death-recap-trigger-cell" onclick="showPlayerDeathsRecap('${escapeHtml(row.player)}')">
                  ${deathCount} <span style="font-size: 10px;">☠</span>
                </button>
              `;
            } else {
              deathsCell = `<span style="color: var(--muted); opacity: 0.35;">0</span>`;
            }

            const displayGrade = gradeMap[row.grade] || row.grade || "Optimizing";

            return `
              <tr>
                <td>${renderPlayerName(row.player, playerLookup)}</td>
                <td>${escapeHtml(player.className || "Unknown")}</td>
                <td>${escapeHtml(player.spec || "Unknown")}</td>
                <td>${escapeHtml(player.role || "Unknown")}</td>
                <td>${deathsCell}</td>
                <td><span class="pill grade-${escapeHtml(row.grade)}">${escapeHtml(displayGrade)}</span></td>
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

function renderBenchmarksTab(analysis, playerLookup) {
  const benchmarks = analysis.benchmarks || {};
  const benchmarkEntries = Object.entries(benchmarks);
  const fight = analysis.fight || {};
  const playerMetrics = analysis.player_metrics || {};

  if (!benchmarkEntries.length) {
    renderEmptyTab("Benchmark Comparisons", "No benchmark data available.");
    return;
  }

  // Count Tanks, Healers, and DPS
  let tanksCount = 0;
  let healersCount = 0;
  let dpsCount = 0;
  
  for (const playerVal of Object.values(playerMetrics)) {
    const role = playerVal.identity?.role;
    if (role === "Tank") tanksCount++;
    else if (role === "Healer") healersCount++;
    else if (role === "DPS") dpsCount++;
  }

  const rsi = calculateRsi(analysis);
  const isProgression = rsi >= 50;

  // Handle selected player fallback
  const playersList = Object.keys(benchmarks);
  if (!benchmarkSelectedPlayer || !benchmarks[benchmarkSelectedPlayer]) {
    benchmarkSelectedPlayer = playersList[0];
  }

  const selectedPlayerName = benchmarkSelectedPlayer;
  const comparison = benchmarks[selectedPlayerName] || {};
  const benchmark = comparison.benchmark || {};
  const playerValue = comparison.player_value || 0;
  const rawMetric = comparison.metric || "dps";
  const metricUpper = rawMetric.toUpperCase();
  const playerMetricsData = playerMetrics[selectedPlayerName] || {};
  const identity = playerMetricsData.identity || {};
  const role = identity.role || "DPS";

  // Identifiers for Top DPS and Top Healer
  let topDpsName = "—";
  let maxDps = 0;
  let topHealerName = "—";
  let maxHps = 0;

  for (const [pName, pVal] of Object.entries(playerMetrics)) {
    const pRole = pVal.identity?.role;
    const perf = pVal.performance || {};

    if (pRole === "DPS") {
      const dps = perf.dps || 0;
      if (dps > maxDps) {
        maxDps = dps;
        topDpsName = pName;
      }
    } else if (pRole === "Healer") {
      const hps = perf.hps || 0;
      if (hps > maxHps) {
        maxHps = hps;
        topHealerName = pName;
      }
    }
  }

  const displayTopDps = topDpsName !== "—" ? getPlayerDisplayName(topDpsName, playerLookup) : "—";
  const displayTopHealer = topHealerName !== "—" ? getPlayerDisplayName(topHealerName, playerLookup) : "—";

  // Benchmarks setup
  const top1Val = benchmark.top_1 ? benchmark.top_1.value : 0;
  const top5Val = benchmark.top_5 ? benchmark.top_5.value : 0;
  const top10Val = benchmark.top_10 ? benchmark.top_10.value : 0;
  const avgVal = benchmark.average_baseline || 0;
  
  // Median baseline calculation: typically around 70-75% of optimized high performers (top 10)
  const medianVal = Math.round(avgVal * 0.72);

  // Set comparison target based on mode
  let activeBaselineVal = top10Val;
  let activePercent = comparison.percent_of_top_10 || 0;
  let baselineModeLabel = "Similar High Performers (Top 10%)";
  let baselineModeDesc = "Comparing against optimized peer characters under similar conditions.";

  if (benchmarkComparisonMode === "elite") {
    activeBaselineVal = top1Val;
    activePercent = comparison.percent_of_top_1 || 0;
    baselineModeLabel = "Elite Players (Top 1%)";
    baselineModeDesc = "Comparing against world-class speedkills and heavily optimized parsed logs.";
  } else if (benchmarkComparisonMode === "median") {
    activeBaselineVal = medianVal;
    activePercent = activeBaselineVal > 0 ? (playerValue / activeBaselineVal) * 100 : 0;
    baselineModeLabel = "Median Players (Typical)";
    baselineModeDesc = "Comparing against typical, standard parsed logs under similar raid conditions.";
  }

  // WCL Percentile estimation
  let estimatedPercentile = 50;
  if (playerValue >= top1Val) {
    estimatedPercentile = 99;
  } else if (playerValue >= top10Val) {
    const range = top1Val - top10Val;
    const offset = playerValue - top10Val;
    estimatedPercentile = range > 0 ? Math.round(90 + (offset / range) * 9) : 90;
  } else if (playerValue >= medianVal) {
    const range = top10Val - medianVal;
    const offset = playerValue - medianVal;
    estimatedPercentile = range > 0 ? Math.round(50 + (offset / range) * 40) : 50;
  } else {
    const range = medianVal;
    const offset = playerValue;
    estimatedPercentile = range > 0 ? Math.max(1, Math.round((offset / range) * 50)) : 10;
  }

  // WCL Percentile color mapping matching official Warcraft Logs hex values
  let percentileColor = "#666666";
  if (estimatedPercentile >= 100) percentileColor = "#e5cc80";
  else if (estimatedPercentile >= 99) percentileColor = "#e268a8";
  else if (estimatedPercentile >= 95) percentileColor = "#ff8000";
  else if (estimatedPercentile >= 75) percentileColor = "#a335ee";
  else if (estimatedPercentile >= 50) percentileColor = "#0070ff";
  else if (estimatedPercentile >= 25) percentileColor = "#1eff00";

  // Healer zero-sum calibrations
  const raidSize = tanksCount + healersCount + dpsCount || 20;
  const healerRatio = raidSize > 0 ? (healersCount / raidSize) : 0.20;
  const totalAvoidableDamage = Object.values(playerMetrics).reduce((sum, p) => sum + (p.performance?.avoidable_damage_taken || 0), 0);
  const avgAvoidableDamage = totalAvoidableDamage / (raidSize || 20);
  const isOverhealed = role === "Healer" && (healerRatio >= 0.24 || avgAvoidableDamage < 1000000);

  // Optimization / Execution score mapping
  const executionScore = Math.min(100, Math.round(activePercent));
  let alignmentRating = "Uptime Optimization Needed";
  let alignmentDesc = "Rotational gaps or defensive inefficiencies are impacting your performance. Review target casts.";
  
  if (executionScore >= 95) {
    alignmentRating = "Outstanding Execution";
    alignmentDesc = "Performing at an elite level, demonstrating optimal rotational uptime and superb mechanical control.";
  } else if (executionScore >= 80) {
    alignmentRating = "Solid Efficiency";
    alignmentDesc = "Executing core rotational priorities correctly with reliable survival habits and stable outputs.";
  } else if (executionScore >= 60) {
    alignmentRating = "Tactical Improvements Needed";
    alignmentDesc = "Moderate rotational pauses and mechanic handling are lowering your execution score. Uptime is key.";
  }

  // Setup callbacks
  window.selectBenchmarkPlayer = function(playerName) {
    benchmarkSelectedPlayer = playerName;
    renderActiveTab();
  };

  window.selectBenchmarkComparisonMode = function(mode) {
    benchmarkComparisonMode = mode;
    renderActiveTab();
  };

  // Build horizontal scroll pills HTML
  const rosterPillsHtml = playersList.map(playerName => {
    const pInfo = playerLookup[playerName] || {};
    const classColor = getClassColor(pInfo.className);
    const isActive = playerName === selectedPlayerName;
    const spec = pInfo.spec || "Unknown";
    return `
      <button 
        class="roster-nav-pill ${isActive ? 'active' : ''}" 
        style="border-left: 3px solid ${classColor};" 
        onclick="selectBenchmarkPlayer('${escapeHtml(playerName)}')"
      >
        <span>${escapeHtml(playerName)}</span>
        <span class="pill-spec-icon">${escapeHtml(spec)}</span>
      </button>
    `;
  }).join("");

  // Build dynamic detailed deltas comparison
  const performance = playerMetricsData.performance || {};
  const activity = playerMetricsData.activity || {};
  
  // Dynamic casting uptime delta
  const playerUptime = activity.active_time_pct || 0;
  let baselineUptime = 87.5; // High performer default
  if (benchmarkComparisonMode === "elite") baselineUptime = 91.0;
  else if (benchmarkComparisonMode === "median") baselineUptime = 81.5;
  const uptimeDelta = playerUptime - baselineUptime;

  // Avoidable damage delta
  const playerDamage = performance.avoidable_damage_taken || 0;
  let baselineDamage = 1800000; // High performer default (1.8M)
  if (benchmarkComparisonMode === "elite") baselineDamage = 600000; // 600k
  else if (benchmarkComparisonMode === "median") baselineDamage = 3500000; // 3.5M
  const damageDelta = playerDamage - baselineDamage;

  // Let's create an array of actionable deltas
  const deltas = [
    {
      name: `Throughput Output (${metricUpper})`,
      subtitle: role === "Healer" ? "Healing per second" : "Damage per second",
      player: formatNumber(playerValue),
      baseline: isOverhealed ? "Capped" : formatNumber(activeBaselineVal),
      delta: isOverhealed ? 0 : (playerValue - activeBaselineVal),
      isLargerBetter: true,
      unit: isOverhealed ? "" : ` ${metricUpper}`,
      isOverhealedCalibrated: isOverhealed
    },
    {
      name: "Rotational Casting Uptime",
      subtitle: "Active time percentage during encounter",
      player: `${playerUptime.toFixed(1)}%`,
      baseline: `${baselineUptime.toFixed(1)}%`,
      delta: uptimeDelta,
      isLargerBetter: true,
      unit: "%"
    },
    {
      name: "Avoidable Damage Taken",
      subtitle: "Net damage from failed mechanical checks",
      player: formatDamageMillions(playerDamage),
      baseline: formatDamageMillions(baselineDamage),
      delta: -damageDelta, // positive delta is good here, so flip it
      isLargerBetter: true, // we flipped the delta to positive = good
      unit: ""
    }
  ];

  // Cooldowns cast deltas
  const cooldowns = playerMetricsData.cooldowns || {};
  Object.entries(cooldowns).forEach(([cdName, cdData]) => {
    const casts = cdData.casts || 0;
    const expected = cdData.possible_casts || 0;
    let baselineCasts = expected; // Elite expects full
    if (benchmarkComparisonMode === "median") {
      baselineCasts = Math.max(1, Math.round(expected * 0.6));
    } else if (benchmarkComparisonMode === "high_performer") {
      baselineCasts = Math.max(1, Math.round(expected * 0.85));
    }
    const cdDelta = casts - baselineCasts;
    deltas.push({
      name: cdName,
      subtitle: `Raid ${cdData.category || "defensive"} cooldown`,
      player: `${casts} casts`,
      baseline: `${baselineCasts} casts`,
      delta: cdDelta,
      isLargerBetter: true,
      unit: " casts"
    });
  });

  // Dynamic coaching recommendations block generator
  const recs = [];
  if (isOverhealed) {
    recs.push({
      type: "rec-positive",
      text: `🛡️ **Calibrated Coaching Active:** Since the raid took extremely low avoidable damage or ran a very safe healer ratio, HPS benchmark targets are paused. Great job maintaining high utility/dispels and conserving mana!`
    });
  } else if (playerValue < activeBaselineVal * 0.85) {
    recs.push({
      type: "rec-warning",
      text: `Your raw ${metricUpper} throughput is currently **${formatNumber(activeBaselineVal - playerValue)} ${metricUpper} below** the ${baselineModeLabel} baseline. Prioritize minimizing rotational down-time.`
    });
  } else {
    recs.push({
      type: "rec-positive",
      text: `Outstanding output! Your ${metricUpper} is matching or exceeding the standard ${baselineModeLabel} comparative benchmark.`
    });
  }

  if (uptimeDelta < -2.0) {
    recs.push({
      type: "rec-critical",
      text: `Rotational casting uptime is at **${playerUptime.toFixed(1)}%** vs the target **${baselineUptime.toFixed(1)}%**. This indicates rotational hesitation. Keep casting!`
    });
  }

  if (damageDelta > 1000000) {
    if (isProgression) {
      recs.push({
        type: "rec-critical",
        text: `You took **${formatDamageMillions(damageDelta)} more avoidable damage** than optimized peers. Dodge ground swirlies and positional breath cones to reduce healer stress under progression conditions.`
      });
    } else {
      recs.push({
        type: "rec-warning",
        text: `Avoidable damage is **${formatDamageMillions(damageDelta)} higher** than benchmark. (Note: Mechanical checking is relaxed in Farm Mode, but dodging elements still helps optimization score!)`
      });
    }
  }

  // Extract cooldown cast advice
  Object.entries(cooldowns).forEach(([cdName, cdData]) => {
    const casts = cdData.casts || 0;
    const expected = cdData.possible_casts || 0;
    if (expected > 1 && casts <= expected / 2) {
      recs.push({
        type: "rec-critical",
        text: `Underutilized **${cdName}**: Used only **${casts}/${expected} times**. Target casting your defensive and throughput cooldowns on cooldown or during major mechanics.`
      });
    }
  });

  if (recs.length === 0) {
    recs.push({
      type: "rec-positive",
      text: `Perfect mechanical alignment! No critical deltas detected compared to ${baselineModeLabel}. Keep up this stellar gameplay.`
    });
  }

  const healerDisclaimer = role === "Healer" ? `
    <div style="font-size: 12px; color: var(--muted); margin-top: 10px; background: rgba(56, 189, 248, 0.03); border: 1px solid rgba(56, 189, 248, 0.1); padding: 8px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 8px;">
      💚 <strong>Healer Comparative Logic Active:</strong> This baseline dynamically adapts HPS metrics against raid size and healer counts to prevent unfair speedkill or over-healed parsing biases.
    </div>
  ` : "";

  const rsiBadgeHtml = isProgression 
    ? `<span class="rsi-badge progression">🔥 Progression Run (RSI: ${rsi})</span>` 
    : `<span class="rsi-badge farm">🌾 Farm Run (RSI: ${rsi})</span>`;

  document.getElementById("tabContent").innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div style="flex: 1; min-width: 280px;">
        <h2 class="tab-panel-title" style="margin-bottom: 4px;">Benchmark Comparisons & Contextual Coaching</h2>
        <p class="tab-panel-description" style="margin-bottom: 0;">
          ShortParse reviews tactical optimization, rotational casting deltas, and avoidable mechanical errors scoped against realistic peer conditions.
        </p>
      </div>
      <div>
        ${rsiBadgeHtml}
      </div>
    </div>

    <!-- Roster Pills Selection Row -->
    <div class="roster-search-bar">
      <span style="font-size: 13px; font-weight: 750; color: var(--muted); text-transform: uppercase;">Select Player:</span>
      <div class="roster-nav-bar" style="flex: 1; margin-bottom: 0;">
        ${rosterPillsHtml}
      </div>
    </div>

    <!-- Executive Comparison Cards Grid -->
    <div class="benchmark-executive-grid">
      
      <!-- Section 1: WCL Raw Performance -->
      <div class="coach-score-card performance">
        <div class="card-title-row">
          <h3>Warcraft Logs Raw Performance</h3>
          <span class="card-tag">GLOBAL VIEW</span>
        </div>
        <div class="executive-metric-wrapper">
          <div class="executive-main-metric">${formatNumber(playerValue)}<span style="font-size: 16px; font-weight: 600; color: var(--muted);"> ${metricUpper}</span></div>
          <div class="executive-sub-metric">Estimated Global Percentile: <strong style="color: ${percentileColor}; text-shadow: 0 0 10px ${percentileColor}44;">${estimatedPercentile}%</strong></div>
        </div>
        <div class="executive-messaging">
          This compares your absolute raw output globally against the entire logged raiding population for this spec and class.
          <div class="filter-pills-list" style="margin-top: 10px;">
            <span class="filter-pill-item" style="background: rgba(163, 53, 238, 0.06); border-color: rgba(163, 53, 238, 0.15); color: #a335ee;">Historical Locked 🔒</span>
          </div>
        </div>
      </div>

      <!-- Section 2: ShortParse Optimization Score -->
      <div class="coach-score-card optimization">
        <div class="card-title-row">
          <h3>ShortParse Optimization Analysis</h3>
          ${isOverhealed ? `<span class="card-tag" style="background: rgba(56, 189, 248, 0.1); color: var(--blue); font-weight: 750;">Capacity Capped 🛡️</span>` : `<span class="card-tag" style="background: rgba(74, 222, 128, 0.1); color: var(--green);">COACHING MATRIX</span>`}
        </div>
        <div class="executive-metric-wrapper">
          <div class="executive-main-metric">${executionScore}%</div>
          <div class="executive-sub-metric" style="color: var(--green); font-weight: 700;">${alignmentRating}</div>
        </div>
        <div class="executive-messaging">
          Peer Comparative Efficiency. Evaluates rotation activity and defensive uptime strictly mapped to:
          <div class="filter-pills-list">
            <span class="filter-pill-item">ILVL +/- 2</span>
            <span class="filter-pill-item">Duration +/- 10s</span>
            <span class="filter-pill-item">Status: ${fight.kill ? 'Kill' : 'Wipe'}</span>
            <span class="filter-pill-item">Size: ${playersList.length} Roster</span>
          </div>
          ${isOverhealed ? `
            <div style="font-size: 11.5px; margin-top: 10px; color: var(--blue); background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); padding: 8px 12px; border-radius: 8px; line-height: 1.4;">
              ⚠️ <strong>Healing Capacity Capped:</strong> Low raid damage taken or safe healer ratios naturally limited your throughput. Optimization focus is automatically shifted to defensive survival and active casting efficiency.
            </div>
          ` : ""}
          ${healerDisclaimer}
        </div>
      </div>
      
    </div>

    <!-- Comparison Context Toggles -->
    <div class="comparison-toggle-container">
      <div class="comparison-toggle-bar">
        <button 
          class="comparison-toggle-btn elite ${benchmarkComparisonMode === 'elite' ? 'active' : ''}" 
          onclick="selectBenchmarkComparisonMode('elite')"
        >
          🌟 Elite Players
        </button>
        <button 
          class="comparison-toggle-btn high ${benchmarkComparisonMode === 'high_performer' ? 'active' : ''}" 
          onclick="selectBenchmarkComparisonMode('high_performer')"
        >
          🎯 Similar High Performers
        </button>
        <button 
          class="comparison-toggle-btn median ${benchmarkComparisonMode === 'median' ? 'active' : ''}" 
          onclick="selectBenchmarkComparisonMode('median')"
        >
          👥 Median Players
        </button>
      </div>
      <p class="comparison-desc-text">
        <strong>Active Pool:</strong> ${baselineModeDesc}
      </p>
    </div>

    <!-- Rotational and Performance Deltas -->
    <div class="benchmarks-deltas-container">
      <h3 class="coaching-section-title">
        <svg style="width: 20px; height: 20px; color: var(--blue);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        Rotational & Cooldown Actionable Deltas
      </h3>
      
      <div class="table-wrapper">
        <table class="delta-comparison-table">
          <thead>
            <tr>
              <th>Optimization Metric</th>
              <th>Your Performance</th>
              <th>Target Peer Baseline</th>
              <th style="text-align: center;">Uptime/Casts Delta</th>
            </tr>
          </thead>
          <tbody>
            ${deltas.map(d => {
              let badgeClass = "neutral";
              let badgePrefix = "";
              if (d.delta > 0) {
                badgeClass = d.isLargerBetter ? "positive" : "negative";
                badgePrefix = "+";
              } else if (d.delta < 0) {
                badgeClass = d.isLargerBetter ? "negative" : "positive";
              }

              const formattedDelta = Math.abs(d.delta).toLocaleString(undefined, { maximumFractionDigits: 1 });
              let displayDelta = d.delta === 0 ? "—" : `${badgePrefix}${formattedDelta}${d.unit}`;

              if (d.isOverhealedCalibrated) {
                displayDelta = `<span class="delta-badge positive" style="background: rgba(56, 189, 248, 0.1); color: var(--blue); border-color: rgba(56, 189, 248, 0.3); font-weight: 750;">Calibrated 🛡️</span>`;
              } else {
                displayDelta = `<span class="delta-badge ${badgeClass}">${displayDelta}</span>`;
              }

              return `
                <tr>
                  <td>
                    <div class="delta-item-name">${escapeHtml(d.name)}</div>
                    <div class="delta-item-sub">${escapeHtml(d.subtitle)}</div>
                  </td>
                  <td class="numeric-val">${d.player}</td>
                  <td class="numeric-val" style="color: var(--muted);">${d.baseline}</td>
                  <td style="text-align: center;">
                    ${displayDelta}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Interactive Coaching Recommendations Pane -->
    <div class="coaching-recommendations-wrapper">
      <div class="recommendations-box-title">
        <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.7a1 1 0 0 0-.224.61v1.89H10.5v-1.89a1 1 0 0 0-.224-.61l-.548-.7z"></path>
        </svg>
        Tactical Optimization Recommendations
      </div>
      <ul class="recommendations-list">
        ${recs.map(r => `
          <li class="${r.type}">${r.text}</li>
        `).join("")}
      </ul>
    </div>

    <!-- Macro Roster distribution chart at the bottom -->
    <div style="margin-top: 36px;">
      <h3 class="coaching-section-title" style="margin-bottom: 6px;">Roster Wide View</h3>
      <div id="rosterChartContainer" class="chart-container" style="margin-top: 0;"></div>
    </div>
  `;

  // Draw the roster wide chart below
  drawRosterDistributionChart(benchmarks, playerLookup);
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

    <div id="avoidableDamageChartContainer" class="chart-container"></div>

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

            const deathsCount = performance.deaths || 0;
            const deathsContent = deathsCount > 0
              ? `<button class="death-trigger-btn" type="button" onclick="showPlayerDeathsRecap('${escapeHtml(playerName)}')">☠ ${deathsCount}</button>`
              : "0";

            return `
              <tr>
                <td>${renderPlayerName(playerName, playerLookup)}</td>
                <td>${escapeHtml(identity.role || "Unknown")}</td>
                <td>${formatNumber(performance.dps)}</td>
                <td>${formatNumber(performance.hps)}</td>
                <td>${formatNumber(performance.dtps)}</td>
                <td>${deathsContent}</td>
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

  drawAvoidableDamageChart(playerMetrics, playerLookup);
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

                <td>${data.worst_player ? renderPlayerName(data.worst_player, playerLookup) : "—"}</td>

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
  // Initialize filter defaults
  window.cooldownRoleFilter = window.cooldownRoleFilter || "all";
  window.cooldownCategoryFilter = window.cooldownCategoryFilter || "all";
  window.cooldownViewMode = window.cooldownViewMode || "player";
  window.cooldownWeightFilter = window.cooldownWeightFilter || "high_med";
  window.cooldownSearchQuery = window.cooldownSearchQuery || "";

  const analysis = currentReportData?.analyses?.[selectedAnalysisIndex];
  const fight = analysis?.fight || {};
  const startTime = fight.start_time || 0;

  const tabContentEl = document.getElementById("tabContent");
  if (!tabContentEl) return;

  function calculateRaidCDStats(playerMetrics, playerLookup) {
    let totalCasts = 0;
    let sumEfficiency = 0;
    let countEfficiency = 0;
    const missedAlerts = [];
    let earliestHasteTime = null;

    // Haste spell names
    const hasteSpells = ["Bloodlust", "Heroism", "Time Warp", "Primal Rage", "Fury of the Aspects"];

    for (const [playerName, data] of Object.entries(playerMetrics || {})) {
      const playerInfo = playerLookup?.[playerName] || {};
      const pClass = playerInfo.className || "Unknown Class";
      const pRole = (playerInfo.role || "UNKNOWN").toUpperCase();

      const cooldowns = data.cooldowns || {};
      for (const [cooldownName, cooldownData] of Object.entries(cooldowns)) {
        const casts = cooldownData.casts ?? 0;
        const expected = cooldownData.possible_casts ?? 0;
        const weight = cooldownData.weight || "medium";
        const efficiency = cooldownData.efficiency_pct ?? 0;
        const timestamps = cooldownData.timestamps || [];

        totalCasts += casts;

        if (expected > 0 && (weight === "high" || weight === "medium")) {
          sumEfficiency += efficiency;
          countEfficiency++;
        }

        // Missed high-priority CD alert
        if (weight === "high" && expected > 0 && casts === 0) {
          missedAlerts.push({
            playerName,
            spellName: cooldownName,
            pClass,
            pRole,
            expected
          });
        }

        // Check for haste spells
        if (hasteSpells.includes(cooldownName) && timestamps.length > 0) {
          const firstCast = timestamps[0];
          if (earliestHasteTime === null || firstCast < earliestHasteTime) {
            earliestHasteTime = firstCast;
          }
        }
      }
    }

    // Format Haste coverage text
    let hasteText = "Missed";
    let hasteClass = "fail-state";
    if (earliestHasteTime !== null) {
      const elapsedSec = (earliestHasteTime - startTime) / 1000;
      hasteText = `Cast at ${formatTimelineTime(elapsedSec)}`;
      hasteClass = "success-state";
    }

    const missedCount = missedAlerts.length;
    const missedClass = missedCount > 0 ? "fail-state" : "success-state";
    const avgEfficiency = countEfficiency > 0 ? Math.round(sumEfficiency / countEfficiency) : 0;

    return {
      totalCasts,
      avgEfficiency,
      missedCount,
      missedClass,
      missedAlerts,
      hasteText,
      hasteClass
    };
  }

  function getFilteredHTML() {
    const roleF = window.cooldownRoleFilter;
    const catF = window.cooldownCategoryFilter;
    const viewF = window.cooldownViewMode;
    const weightF = window.cooldownWeightFilter;
    const searchF = window.cooldownSearchQuery.toLowerCase().trim();

    // Group by Spell Rendering Mode
    if (viewF === "spell") {
      const spellGroups = {};

      for (const [playerName, data] of Object.entries(playerMetrics || {})) {
        const playerInfo = playerLookup?.[playerName] || {};
        const pRole = (playerInfo.role || "UNKNOWN").toUpperCase();
        const pSpec = playerInfo.spec || "Unknown Spec";
        const pClass = playerInfo.className || "Unknown Class";

        // Apply role filter
        if (roleF !== "all") {
          if (roleF === "tanks" && pRole !== "TANK") continue;
          if (roleF === "healers" && pRole !== "HEALER") continue;
          if (roleF === "dps" && pRole !== "DPS") continue;
        }

        const cooldowns = data.cooldowns || {};
        for (const [cooldownName, cooldownData] of Object.entries(cooldowns)) {
          const cat = cooldownData.category;
          const weight = cooldownData.weight || "medium";

          // Apply category filter
          if (catF !== "all") {
            if (catF === "raid_defensive" && (cat !== "raid_defensive" && cat !== "raid_healing")) continue;
            if (catF === "personal_defensive" && (cat !== "personal_defensive" && cat !== "personal_immunity")) continue;
            if (catF === "external_defensive" && cat !== "external_defensive") continue;
            if (catF === "raid_movement" && cat !== "raid_movement") continue;
            if (catF === "raid_utility" && cat !== "raid_utility") continue;
          }

          // Apply weight filter
          if (weightF === "high" && weight !== "high") continue;
          if (weightF === "high_med" && weight === "low") continue;

          // Apply search filter
          if (searchF) {
            const matchesPlayer = playerName.toLowerCase().includes(searchF);
            const matchesSpell = cooldownName.toLowerCase().includes(searchF);
            const matchesSpec = pSpec.toLowerCase().includes(searchF);
            if (!matchesPlayer && !matchesSpell && !matchesSpec) continue;
          }

          if (!spellGroups[cooldownName]) {
            spellGroups[cooldownName] = {
              name: cooldownName,
              category: cat,
              weight: weight,
              players: []
            };
          }

          spellGroups[cooldownName].players.push({
            playerName,
            pClass,
            pSpec,
            pRole,
            ...cooldownData
          });
        }
      }

      const spellList = Object.values(spellGroups);
      if (spellList.length === 0) {
        return `
          <div class="cooldown-empty-state">
            No spells matched the active filters or search criteria.
          </div>
        `;
      }

      // Sort spells: high weight first, then alphabetically
      spellList.sort((a, b) => {
        if (a.weight === "high" && b.weight !== "high") return -1;
        if (a.weight !== "high" && b.weight === "high") return 1;
        return a.name.localeCompare(b.name);
      });

      return `
        <div class="cooldowns-spell-view-grid">
          ${spellList.map(spell => {
            const cat = spell.category || "unknown";
            let catIcon = "🛡️";
            let catLabel = "Personal";
            let catClass = "badge-personal";

            if (cat === "raid_defensive" || cat === "raid_healing") {
              catIcon = "⭐";
              catLabel = "Raid CD";
              catClass = "badge-raid";
            } else if (cat === "external_defensive") {
              catIcon = "💖";
              catLabel = "External";
              catClass = "badge-external";
            } else if (cat === "raid_movement") {
              catIcon = "🏃";
              catLabel = "Movement";
              catClass = "badge-movement";
            } else if (cat === "raid_utility") {
              catIcon = "⚡";
              catLabel = "Utility";
              catClass = "badge-utility";
            } else if (cat === "personal_immunity") {
              catIcon = "💎";
              catLabel = "Immune";
              catClass = "badge-immune";
            } else if (cat === "tank_defensive") {
              catIcon = "🧱";
              catLabel = "Tank CD";
              catClass = "badge-tank";
            }

            const weightClass = spell.weight === "high" ? "badge-weight-high" : spell.weight === "medium" ? "badge-weight-med" : "badge-weight-low";
            const weightLabel = spell.weight.toUpperCase();

            // Sort players inside each spell by name
            spell.players.sort((a, b) => a.playerName.localeCompare(b.playerName));

            return `
              <div class="cooldown-spell-group-card">
                <div class="spell-group-header">
                  <div class="spell-group-title-row">
                    <span class="spell-group-icon">${catIcon}</span>
                    <span class="spell-group-name">${escapeHtml(spell.name)}</span>
                  </div>
                  <div class="spell-group-badges">
                    <span class="cooldown-spell-badge ${catClass}">${catLabel}</span>
                    <span class="cooldown-weight-badge ${weightClass}">${weightLabel}</span>
                  </div>
                </div>

                <div class="spell-group-players-list">
                  ${spell.players.map(p => {
                    const casts = p.casts ?? 0;
                    const expected = p.possible_casts ?? 0;
                    const efficiency = p.efficiency_pct ?? 0;
                    const classColor = getClassColor(p.pClass);
                    const timestamps = p.timestamps || [];

                    let castClass = "neutral";
                    if (expected > 0) {
                      if (casts >= expected) castClass = "success";
                      else if (casts > 0) castClass = "partial";
                      else castClass = "fail";
                    } else if (casts > 0) {
                      castClass = "success";
                    }

                    let progressColor = "var(--blue)";
                    if (efficiency >= 80) progressColor = "var(--green)";
                    else if (efficiency >= 45) progressColor = "var(--yellow)";
                    else if (casts === 0 && expected > 0) progressColor = "var(--red)";

                    const timeBadgesHtml = timestamps.length > 0 
                      ? timestamps.map(t => {
                          const elapsedSec = (t - startTime) / 1000;
                          return `<span class="cooldown-spell-time-badge">${formatTimelineTime(elapsedSec)}</span>`;
                        }).join("")
                      : `<span class="cooldown-spell-time-badge none red-alert">Never Cast</span>`;

                    return `
                      <div class="spell-player-row ${casts === 0 && expected > 0 ? "player-missed-cd" : ""}">
                        <div class="spell-player-info">
                          <span class="spell-player-name" style="color: ${classColor}" onclick="showPlayerCoachCard('${escapeHtml(p.playerName)}')">${escapeHtml(p.playerName)}</span>
                          <span class="spell-player-spec">${escapeHtml(p.pSpec)}</span>
                        </div>
                        
                        <div class="spell-player-stats">
                          <span class="cooldown-spell-casts ${castClass}">${casts} / ${expected || "—"}</span>
                          ${expected > 0 ? `
                            <div class="spell-player-efficiency-mini" title="${efficiency}% efficiency">
                              <div class="efficiency-mini-bar" style="width: ${efficiency}%; background-color: ${progressColor};"></div>
                            </div>
                          ` : ""}
                        </div>

                        <div class="spell-player-timeline">
                          ${timeBadgesHtml}
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // Default: Group by Player Rendering Mode
    let playersHtml = "";
    let matchedPlayersCount = 0;

    for (const [playerName, data] of Object.entries(playerMetrics || {})) {
      const playerInfo = playerLookup?.[playerName] || {};
      const pRole = (playerInfo.role || "UNKNOWN").toUpperCase();
      const pSpec = playerInfo.spec || "Unknown Spec";
      const pClass = playerInfo.className || "Unknown Class";

      // Apply role filter
      if (roleF !== "all") {
        if (roleF === "tanks" && pRole !== "TANK") continue;
        if (roleF === "healers" && pRole !== "HEALER") continue;
        if (roleF === "dps" && pRole !== "DPS") continue;
      }

      const cooldowns = data.cooldowns || {};
      const filteredCooldownsList = [];

      for (const [cooldownName, cooldownData] of Object.entries(cooldowns)) {
        const cat = cooldownData.category;
        const weight = cooldownData.weight || "medium";

        // Apply category filter
        if (catF !== "all") {
          if (catF === "raid_defensive" && (cat !== "raid_defensive" && cat !== "raid_healing")) continue;
          if (catF === "personal_defensive" && (cat !== "personal_defensive" && cat !== "personal_immunity")) continue;
          if (catF === "external_defensive" && cat !== "external_defensive") continue;
          if (catF === "raid_movement" && cat !== "raid_movement") continue;
          if (catF === "raid_utility" && cat !== "raid_utility") continue;
        }

        // Apply weight filter
        if (weightF === "high" && weight !== "high") continue;
        if (weightF === "high_med" && weight === "low") continue;

        // Apply search filter
        if (searchF) {
          const matchesPlayer = playerName.toLowerCase().includes(searchF);
          const matchesSpell = cooldownName.toLowerCase().includes(searchF);
          const matchesSpec = pSpec.toLowerCase().includes(searchF);
          if (!matchesPlayer && !matchesSpell && !matchesSpec) continue;
        }

        filteredCooldownsList.push({
          cooldownName,
          ...cooldownData
        });
      }

      if (filteredCooldownsList.length === 0) {
        continue;
      }

      matchedPlayersCount++;
      const classColor = getClassColor(pClass);

      // Sort player's cooldown spells: high weight first, then alphabetically
      filteredCooldownsList.sort((a, b) => {
        const aW = a.weight || "medium";
        const bW = b.weight || "medium";
        if (aW === "high" && bW !== "high") return -1;
        if (aW !== "high" && bW === "high") return 1;
        return a.cooldownName.localeCompare(b.cooldownName);
      });

      const spellsHtml = filteredCooldownsList.map(spell => {
        const casts = spell.casts ?? 0;
        const expected = spell.possible_casts ?? 0;
        const efficiency = spell.efficiency_pct ?? 0;
        const cat = spell.category || "unknown";
        const weight = spell.weight || "medium";

        let catIcon = "🛡️";
        let catLabel = "Personal";
        let catClass = "badge-personal";

        if (cat === "raid_defensive" || cat === "raid_healing") {
          catIcon = "⭐";
          catLabel = "Raid CD";
          catClass = "badge-raid";
        } else if (cat === "external_defensive") {
          catIcon = "💖";
          catLabel = "External";
          catClass = "badge-external";
        } else if (cat === "raid_movement") {
          catIcon = "🏃";
          catLabel = "Movement";
          catClass = "badge-movement";
        } else if (cat === "raid_utility") {
          catIcon = "⚡";
          catLabel = "Utility";
          catClass = "badge-utility";
        } else if (cat === "personal_immunity") {
          catIcon = "💎";
          catLabel = "Immune";
          catClass = "badge-immune";
        } else if (cat === "tank_defensive") {
          catIcon = "🧱";
          catLabel = "Tank CD";
          catClass = "badge-tank";
        }

        const weightClass = weight === "high" ? "badge-weight-high" : weight === "medium" ? "badge-weight-med" : "badge-weight-low";
        const weightLabel = weight.toUpperCase();

        let castClass = "neutral";
        if (expected > 0) {
          if (casts >= expected) castClass = "success";
          else if (casts > 0) castClass = "partial";
          else castClass = "fail";
        } else if (casts > 0) {
          castClass = "success";
        }

        let progressColor = "var(--blue)";
        if (efficiency >= 80) progressColor = "var(--green)";
        else if (efficiency >= 45) progressColor = "var(--yellow)";
        else if (casts === 0 && expected > 0) progressColor = "var(--red)";

        const timestamps = spell.timestamps || [];
        const timeBadgesHtml = timestamps.length > 0 
          ? timestamps.map(t => {
              const elapsedSec = (t - startTime) / 1000;
              return `<span class="cooldown-spell-time-badge">${formatTimelineTime(elapsedSec)}</span>`;
            }).join("")
          : `<span class="cooldown-spell-time-badge none ${expected > 0 ? "red-alert" : ""}">Never Cast</span>`;

        return `
          <div class="cooldown-spell-card ${casts === 0 && expected > 0 ? "missed-spell-card" : ""}">
            <div class="cooldown-spell-row">
              <div class="cooldown-spell-left">
                <span class="cooldown-spell-icon">${catIcon}</span>
                <span class="cooldown-spell-name">${escapeHtml(spell.cooldownName)}</span>
                <span class="cooldown-spell-badge ${catClass}">${catLabel}</span>
                <span class="cooldown-weight-badge ${weightClass}">${weightLabel}</span>
              </div>
              <span class="cooldown-spell-casts ${castClass}">${casts} / ${expected || "—"}</span>
            </div>
            
            <div class="cooldown-spell-timeline">
              ${timeBadgesHtml}
            </div>

            ${expected > 0 ? `
              <div class="cooldown-efficiency-bar-container">
                <div class="cooldown-efficiency-bar">
                  <div class="cooldown-efficiency-progress" style="width: ${efficiency}%; background-color: ${progressColor};"></div>
                </div>
                <span class="cooldown-efficiency-text">${efficiency}% efficiency</span>
              </div>
            ` : ""}
          </div>
        `;
      }).join("");

      playersHtml += `
        <div class="cooldown-player-card">
          <div class="cooldown-player-header">
            <div>
              <span class="cooldown-player-name" style="color: ${classColor}" onclick="showPlayerCoachCard('${escapeHtml(playerName)}')">${escapeHtml(playerName)}</span>
              <span class="cooldown-player-badge">${escapeHtml(pSpec)}</span>
            </div>
            <span class="cooldown-player-role-tag">${pRole === "TANK" ? "🛡️ Tank" : pRole === "HEALER" ? "💚 Healer" : "⚔️ DPS"}</span>
          </div>
          <div class="cooldown-player-spells">
            ${spellsHtml}
          </div>
        </div>
      `;
    }

    if (matchedPlayersCount === 0) {
      return `
        <div class="cooldown-empty-state">
          No cooldown data matched the active filters. Try broadening your criteria.
        </div>
      `;
    }

    return `
      <div class="cooldowns-grid">
        ${playersHtml}
      </div>
    `;
  }

  window.setCooldownRoleFilter = function(role) {
    window.cooldownRoleFilter = role;
    renderAll();
  };

  window.setCooldownCategoryFilter = function(cat) {
    window.cooldownCategoryFilter = cat;
    renderAll();
  };

  window.setCooldownViewMode = function(mode) {
    window.cooldownViewMode = mode;
    renderAll();
  };

  window.setCooldownWeightFilter = function(weight) {
    window.cooldownWeightFilter = weight;
    renderAll();
  };

  window.setCooldownSearchQuery = function(query) {
    window.cooldownSearchQuery = query;
    renderGridOnly();
  };

  function renderGridOnly() {
    const gridContainer = document.getElementById("cooldownsGridContainer");
    if (gridContainer) {
      gridContainer.innerHTML = getFilteredHTML();
    }
  }

  function renderAll() {
    const roleF = window.cooldownRoleFilter;
    const catF = window.cooldownCategoryFilter;
    const viewF = window.cooldownViewMode;
    const weightF = window.cooldownWeightFilter;
    const searchF = window.cooldownSearchQuery;

    const stats = calculateRaidCDStats(playerMetrics, playerLookup);

    tabContentEl.innerHTML = `
      <h2 class="tab-panel-title">Cooldowns Dashboard</h2>
      <p class="tab-panel-description">
        Defensive, offensive, and utility cooldown usage detected during the selected fight. Use filters below to drill down.
      </p>

      <!-- Executive Header -->
      <div class="cooldown-dashboard-header">
        <!-- Scorecard -->
        <div class="cooldown-scorecard">
          <div class="scorecard-stat">
            <span class="stat-label">Haste Coverage</span>
            <span class="stat-value ${stats.hasteClass}">${stats.hasteText}</span>
          </div>
          <div class="scorecard-stat">
            <span class="stat-label">Key CDs Missed</span>
            <span class="stat-value ${stats.missedClass}">${stats.missedCount}</span>
          </div>
          <div class="scorecard-stat">
            <span class="stat-label">Avg CD Efficiency</span>
            <span class="stat-value">${stats.avgEfficiency}%</span>
          </div>
          <div class="scorecard-stat">
            <span class="stat-label">Total CD Casts</span>
            <span class="stat-value">${stats.totalCasts}</span>
          </div>
        </div>

        <!-- Critical Failures Alerts -->
        ${stats.missedCount > 0 ? `
          <div class="cooldown-alerts-panel">
            <div class="alerts-panel-title">
              <span class="alert-icon">⚠️</span> Critical Cooldown Failures
            </div>
            <div class="alerts-list">
              ${stats.missedAlerts.map(alert => {
                const classColor = getClassColor(alert.pClass);
                return `
                  <div class="cooldown-alert-item">
                    <span class="alert-player" style="color: ${classColor}">${escapeHtml(alert.playerName)}</span>
                    <span class="alert-action">failed to cast</span>
                    <span class="alert-spell font-bold">${escapeHtml(alert.spellName)}</span>
                    <span class="alert-meta">(${alert.expected} expected)</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : `
          <div class="cooldown-alerts-panel success">
            <div class="alerts-panel-title">
              <span class="alert-icon">✨</span> Perfect Key Cooldown Execution!
            </div>
            <div class="alerts-panel-body">
              All high-priority defensive and utility raid cooldowns were cast at least once. Outstanding!
            </div>
          </div>
        `}
      </div>

      <!-- Controls and Filters Bar -->
      <div class="cooldown-controls-bar">
        <!-- Search -->
        <div class="cooldown-search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="cooldownSearchInput" placeholder="Search players, specs, or spells..." value="${escapeHtml(searchF)}" oninput="setCooldownSearchQuery(this.value)">
        </div>

        <!-- View Mode Toggle -->
        <div class="cooldown-view-toggle">
          <button class="cooldown-toggle-btn ${viewF === "player" ? "active" : ""}" onclick="setCooldownViewMode('player')">👤 Player View</button>
          <button class="cooldown-toggle-btn ${viewF === "spell" ? "active" : ""}" onclick="setCooldownViewMode('spell')">🔮 Spell View</button>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="cooldown-filters-container">
        <!-- Role Filters -->
        <div class="cooldown-filter-group">
          <span class="filter-group-label">Roster Role</span>
          <div class="filter-pills">
            <button class="cooldown-filter-pill ${roleF === "all" ? "active" : ""}" onclick="setCooldownRoleFilter('all')">All</button>
            <button class="cooldown-filter-pill ${roleF === "tanks" ? "active" : ""}" onclick="setCooldownRoleFilter('tanks')">Tanks</button>
            <button class="cooldown-filter-pill ${roleF === "healers" ? "active" : ""}" onclick="setCooldownRoleFilter('healers')">Healers</button>
            <button class="cooldown-filter-pill ${roleF === "dps" ? "active" : ""}" onclick="setCooldownRoleFilter('dps')">DPS</button>
          </div>
        </div>

        <!-- Category Filters -->
        <div class="cooldown-filter-group">
          <span class="filter-group-label">Spell Category</span>
          <div class="filter-pills">
            <button class="cooldown-filter-pill ${catF === "all" ? "active" : ""}" onclick="setCooldownCategoryFilter('all')">All</button>
            <button class="cooldown-filter-pill ${catF === "raid_defensive" ? "active" : ""}" onclick="setCooldownCategoryFilter('raid_defensive')">Raid CDs</button>
            <button class="cooldown-filter-pill ${catF === "personal_defensive" ? "active" : ""}" onclick="setCooldownCategoryFilter('personal_defensive')">Personals</button>
            <button class="cooldown-filter-pill ${catF === "external_defensive" ? "active" : ""}" onclick="setCooldownCategoryFilter('external_defensive')">Externals</button>
            <button class="cooldown-filter-pill ${catF === "raid_movement" ? "active" : ""}" onclick="setCooldownCategoryFilter('raid_movement')">Movement</button>
            <button class="cooldown-filter-pill ${catF === "raid_utility" ? "active" : ""}" onclick="setCooldownCategoryFilter('raid_utility')">Utility</button>
          </div>
        </div>

        <!-- Importance/Weight Filters -->
        <div class="cooldown-filter-group">
          <span class="filter-group-label">Importance</span>
          <div class="filter-pills">
            <button class="cooldown-filter-pill ${weightF === "high_med" ? "active" : ""}" onclick="setCooldownWeightFilter('high_med')">High & Med Only</button>
            <button class="cooldown-filter-pill ${weightF === "high" ? "active" : ""}" onclick="setCooldownWeightFilter('high')">High Only</button>
            <button class="cooldown-filter-pill ${weightF === "all" ? "active" : ""}" onclick="setCooldownWeightFilter('all')">All Weights</button>
          </div>
        </div>
      </div>

      <div id="cooldownsGridContainer">
        ${getFilteredHTML()}
      </div>
    `;
  }

  renderAll();
}


function renderTimelineTab(timeline, playerLookup) {
  if (!timeline || !timeline.length) {
    renderEmptyTab("Timeline", "No timeline data available.");
    return;
  }

  const analysis = currentReportData?.analyses?.[selectedAnalysisIndex];
  const fight = analysis?.fight || {};
  const duration = fight.duration_seconds || 1;
  const startTime = fight.start_time || 0;

  // Let's create visual ruler ticks and nodes
  const width = 1000;
  const height = 80;
  const margin = { left: 40, right: 40 };
  const graphWidth = width - margin.left - margin.right;
  const lineY = height / 2 - 10;

  // 1. Draw Minute Ticks
  const numMinutes = Math.ceil(duration / 60);
  const ticksHtml = [];
  for (let i = 0; i <= numMinutes; i++) {
    const minutesSeconds = i * 60;
    const pct = Math.min(1, minutesSeconds / duration);
    const x = margin.left + pct * graphWidth;
    ticksHtml.push(`
      <line x1="${x}" y1="${lineY - 6}" x2="${x}" y2="${lineY + 6}" class="timeline-svg-tick" />
      <text x="${x}" y="${lineY + 22}" class="timeline-svg-tick-text">${i}:00</text>
    `);
  }

  // 2. Draw Event Nodes (Cooldowns, Deaths, Avoidable Mechanics)
  const nodesHtml = timeline.map((event, idx) => {
    const offsetMs = event.timestamp - startTime;
    const pct = Math.max(0, Math.min(1, offsetMs / (duration * 1000)));
    const x = margin.left + pct * graphWidth;

    let nodeClass = "node-mechanic";
    let r = 5.5;

    if (event.type === "death") {
      nodeClass = "node-death";
      r = 7.5;
    } else if (event.type === "cooldown") {
      nodeClass = "node-cooldown";
      r = 5.5;
    }

    let hoverAction = `onmouseenter="showTimelineNodeTooltip(event, ${idx})" onmousemove="moveTooltip(event)" onmouseleave="hideTooltip()"`;
    let clickAction = "";
    if (event.type === "death") {
      clickAction = `onclick="showPlayerDeathsRecap('${escapeHtml(event.target)}')"`;
    }

    return `
      <circle
        cx="${x}"
        cy="${lineY}"
        r="${r}"
        class="timeline-svg-node ${nodeClass}"
        ${hoverAction}
        ${clickAction}
      />
    `;
  }).join("");

  // Setup window-level tooltip helper for SVG timeline
  window.showTimelineNodeTooltip = (e, index) => {
    const ev = timeline[index];
    const typeLabel = ev.type.toUpperCase();
    const spellLabel = ev.spell_name || "—";
    
    let tooltipTitle = `${ev.time} · ${typeLabel}`;
    let tooltipFields = [
      { label: "Details", value: ev.summary }
    ];

    if (ev.type === "death") {
      tooltipTitle = `☠ Death: ${ev.target}`;
      tooltipFields = [
        { label: "Time", value: ev.time },
        { label: "Action", value: "Click to open Death Recap! ☠" }
      ];
    } else if (ev.type === "cooldown") {
      tooltipTitle = `🛡️ Cooldown: ${spellLabel}`;
      tooltipFields = [
        { label: "Cast By", value: ev.source },
        { label: "Time", value: ev.time }
      ];
    } else if (ev.type === "mechanic") {
      tooltipTitle = `⚠️ Mechanic: ${spellLabel}`;
      tooltipFields = [
        { label: "Target", value: ev.target },
        { label: "Amount", value: `${formatNumber(ev.amount)} dmg` },
        { label: "Hits Aggregated", value: String(ev.hits || 1) },
        { label: "Time", value: ev.time }
      ];
    }

    showTooltip(e, tooltipTitle, tooltipFields);
  };

  const svgHtml = `
    <div class="timeline-visual-ruler-card">
      <div class="timeline-visual-ruler-title">Combat Timeline Visualizer</div>
      <div class="timeline-visual-ruler-subtitle">Visual overview of key fight events. Hover dots for details; click skulls (☠) to view Death Recaps.</div>
      
      <div class="timeline-svg-container">
        <svg viewBox="0 0 ${width} ${height}" class="timeline-svg">
          <line x1="${margin.left}" y1="${lineY}" x2="${width - margin.right}" y2="${lineY}" class="timeline-svg-line" />
          ${ticksHtml.join("")}
          ${nodesHtml}
        </svg>
      </div>
    </div>
  `;

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Timeline</h2>
    <p class="tab-panel-description">
      Important fight events detected during the selected boss encounter.
    </p>

    ${svgHtml}

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
          ${timeline.map(event => {
            const summaryContent = event.type === "death"
              ? `<button class="death-trigger-btn" type="button" onclick="showDeathRecap('${escapeHtml(event.target)}', ${event.timestamp})">☠ Died (Recap)</button>`
              : escapeHtml(event.summary || "Unknown event");

            return `
              <tr>
                <td>${escapeHtml(event.time || "—")}</td>
                <td>${escapeHtml(event.type || "Event")}</td>
                <td>${event.source ? renderPlayerName(event.source, playerLookup) : "—"}</td>
                <td>${event.target ? renderPlayerName(event.target, playerLookup) : "—"}</td>
                <td>${escapeHtml(event.spell_name || "—")}</td>
                <td>${summaryContent}</td>
              </tr>
            `;
          }).join("")}
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

const ENCOUNTER_TRANSITIONS = {
  "Midnight Falls": [
    { start: 200, end: 228, name: "Obelisk Stun Transition" }
  ]
};

function calculateRsi(analysis) {
  if (!analysis) return 50;
  
  const pulls = analysis.progression?.pulls || [];
  const wipesCount = pulls.filter(p => !p.kill).length;
  
  const timeline = analysis.timeline || [];
  const deathsCount = timeline.filter(e => e.type === "death").length;
  
  const playerMetrics = analysis.player_metrics || {};
  let tanksCount = 0;
  let healersCount = 0;
  let dpsCount = 0;
  
  for (const playerVal of Object.values(playerMetrics)) {
    const role = playerVal.identity?.role;
    if (role === "Tank") tanksCount++;
    else if (role === "Healer") healersCount++;
    else if (role === "DPS") dpsCount++;
  }
  
  const raidSize = tanksCount + healersCount + dpsCount || 20;
  const healerRatio = raidSize > 0 ? (healersCount / raidSize) : 0.20;
  
  const duration = analysis.fight?.duration_seconds || 300;
  
  let baseRsi = 30;
  
  // Wipes impact (max 30)
  baseRsi += Math.min(30, wipesCount * 5);
  
  // Deaths impact (max 30)
  baseRsi += Math.min(30, deathsCount * 4);
  
  // Healer ratio impact
  if (healerRatio < 0.18) {
    baseRsi -= 15;
  } else if (healerRatio >= 0.25) {
    baseRsi += 15;
  }
  
  // Speed / Duration impact
  if (duration < 210) {
    baseRsi -= 15;
  } else if (duration > 420) {
    baseRsi += 15;
  }
  
  return Math.max(10, Math.min(100, Math.round(baseRsi)));
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
  if (!playerName) return "—";
  const player = playerLookup?.[playerName];
  const color = getClassColor(player?.className);

  return `
    <button type="button" class="player-name-btn" style="color: ${color}" onclick="showPlayerCoachCard(this.innerText.trim())">
      ${escapeHtml(playerName)}
    </button>
  `;
}

function showPlayerCoachCard(playerName) {
  if (!currentReportData) return;
  const analysis = currentReportData.analyses[selectedAnalysisIndex];
  if (!analysis) return;

  const playerLookup = buildPlayerLookup(analysis);
  const player = playerLookup[playerName] || {};
  const data = (analysis.player_metrics || {})[playerName] || {};

  const rsi = calculateRsi(analysis);
  const isProgression = rsi >= 50;

  // 1. Title and Spec Details
  const nameEl = document.getElementById("coachPlayerName");
  if (nameEl) {
    nameEl.textContent = playerName;
    nameEl.style.color = getClassColor(player.className);
  }

  const subEl = document.getElementById("coachPlayerSub");
  if (subEl) {
    const spec = player.spec || "Unknown Spec";
    const className = player.className || "Player";
    const role = player.role || "Role";
    subEl.textContent = `${spec} ${className} · ${role}`;
  }

  // 2. Performance Alignment & Tier Mapping Setup
  const scorecardEntry = (analysis.scorecard || []).find(row => row.player === playerName) || {};
  const grade = scorecardEntry.grade || "-";

  const gradeMap = {
    "S": "Elite",
    "A": "Master",
    "B": "Expert",
    "C": "Adequate",
    "D": "Fair",
    "F": "Optimizing",
    "-": "Optimizing"
  };
  const displayGrade = gradeMap[grade] || grade;

  const gradeEl = document.getElementById("coachPlayerGrade");
  if (gradeEl) {
    gradeEl.textContent = displayGrade;
    if (displayGrade.length > 5) {
      gradeEl.style.fontSize = "16px";
    } else {
      gradeEl.style.fontSize = "";
    }
    
    let gradeColor = "#FFFFFF";
    if (grade === "S") gradeColor = "#ffd700";      // Elite Gold
    else if (grade === "A") gradeColor = "#4ade80"; // Bright Green
    else if (grade === "B") gradeColor = "#bef264"; // Lime Green
    else if (grade === "C") gradeColor = "#facc15"; // Yellow
    else if (grade === "D") gradeColor = "#fb923c"; // Orange
    else if (grade === "F") gradeColor = "#fb7185"; // Red
    
    gradeEl.style.color = gradeColor;
  }

  const titleEl = document.getElementById("coachGradeTitle");
  const descEl = document.getElementById("coachGradeDesc");

  let tierClass = "tier-df";
  let gradeTitle = "Coaching Session Initialized";
  let gradeDesc = "Review priority targets and rotational uptime to optimize performance.";

  if (grade === "S" || grade === "A") {
    tierClass = "tier-sa";
    gradeTitle = "Outstanding Execution";
    gradeDesc = isProgression 
      ? "Performing at an elite level. Demonstrates optimal rotational uptime and superb mechanic handling under progression pressure."
      : "Outstanding Farm Run! Demolishing output targets with highly optimized rotational execution.";
  } else if (grade === "B" || grade === "C") {
    tierClass = "tier-bc";
    gradeTitle = "Solid Efficiency";
    gradeDesc = isProgression
      ? "Executing core rotational priorities correctly. Reliable survival habits and stable outputs during progression."
      : "Stable farm performance. Good rotation throughput, with minor optimization opportunities.";
  } else if (grade === "D" || grade === "F") {
    tierClass = "tier-df";
    gradeTitle = "Rotational Gaps Detected";
    gradeDesc = isProgression
      ? "Mechanical stress or rotational gaps are lowering your uptime. Review defensive usage and priority actions to stabilize progression pulls."
      : "Rotational uptime or execution gaps detected. Focus on limit-testing your rotation uptime to optimize farm speed.";
  }

  if (titleEl) titleEl.textContent = gradeTitle;
  if (descEl) descEl.textContent = gradeDesc;

  const drawer = document.getElementById("playerCoachDrawer");
  if (drawer) {
    drawer.className = "coach-drawer"; // reset classes
    if (tierClass) drawer.className = `coach-drawer ${tierClass}`;
  }

  // 3. Action Items Extraction & Zero-Sum Healer Calibration
  const timeline = analysis.timeline || [];
  const deathsCount = timeline.filter(e => e.type === "death").length;
  const role = player.role || "Role";
  
  let playerIssues = (analysis.issues || []).filter(issue => issue.player === playerName);

  // Healer Zero-Sum Emergency Cooldown Calibrations
  if (role === "Healer" && deathsCount === 0) {
    const cooldownKeywords = ["unused", "cooldown", "life cocoon", "guardian spirit", "pain suppression", "lay on hands", "ironbark", "blessing of protection", "tranquility", "divine hymn", "revival", "healing tide"];
    playerIssues = playerIssues.filter(issue => {
      const msgLower = (issue.message || "").toLowerCase();
      const isCdIssue = cooldownKeywords.some(keyword => msgLower.includes(keyword));
      return !isCdIssue; // Suspend penalty if CD was unused but 0 deaths occurred!
    });
  }

  const coachActionItems = document.getElementById("coachActionItems");
  if (coachActionItems) {
    if (playerIssues.length === 0) {
      coachActionItems.innerHTML = `
        <div class="coach-perfect-play">
          <div class="coach-perfect-icon">🛡️</div>
          <div class="coach-perfect-title">Perfect Mechanical Run</div>
          <div class="coach-perfect-desc">Flawless performance! Zero rotational or mechanical issues detected in this fight.</div>
        </div>
      `;
    } else {
      const displayWeights = {
        "Critical": 4,
        "Major": 3,
        "Warning": 2,
        "Info": 1
      };

      const sortedIssues = [...playerIssues].sort((a, b) => {
        return (displayWeights[b.severity] || 0) - (displayWeights[a.severity] || 0);
      });

      const topIssues = sortedIssues.slice(0, 3);

      coachActionItems.innerHTML = topIssues.map(issue => {
        const sevClass = (issue.severity || "warning").toLowerCase();
        let icon = "✦";
        if (issue.severity === "Critical") icon = "☠";
        else if (issue.severity === "Major") icon = "⚠";
        else if (issue.severity === "Info") icon = "ℹ";

        return `
          <div class="coach-action-item ${sevClass}">
            <div class="coach-action-icon">${icon}</div>
            <div class="coach-action-content">
              <div class="coach-action-label">${escapeHtml(issue.severity)}</div>
              <div class="coach-action-msg">${escapeHtml(issue.message)}</div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // 3.5. Transparent Scorecard Ledger (Opening the "Black Box")
  const ledgerContainer = document.getElementById("coachScoreLedger");
  if (ledgerContainer) {
    const severityWeights = isProgression ? {
      "Critical": 80,
      "Major": 45,
      "Warning": 25,
      "Info": 5
    } : {
      "Critical": 80,
      "Major": 45,
      "Warning": 10, // Relaxed on farm!
      "Info": 0      // Ignored on farm!
    };

    const ledgerHtml = `
      <div class="coach-ledger-card">
        <div class="coach-ledger-title">Transparent Score Ledger ${!isProgression ? `<span style="color: var(--blue); font-size: 10px; margin-left: 6px; text-transform: none; font-weight: 500;">(Farm Mode: Warning & Info Relaxed)</span>` : ""}</div>
        <div class="coach-ledger-list">
          ${playerIssues.length === 0 ? `
            <div class="coach-ledger-item" style="color: var(--muted); font-size: 12.5px; font-style: italic; padding: 4px 0;">
              🟢 No active mechanical or rotational penalties.
            </div>
          ` : playerIssues.map(issue => {
            const score = severityWeights[issue.severity] || 0;
            let sevClass = (issue.severity || "info").toLowerCase();
            let icon = "✦";
            if (issue.severity === "Critical") icon = "☠";
            else if (issue.severity === "Major") icon = "⚠";
            else if (issue.severity === "Info") icon = "ℹ";

            let mathText = `${issue.severity} × ${score}`;
            if (!isProgression && issue.severity === "Warning") mathText = `Warning × 10 (Relaxed)`;
            else if (!isProgression && issue.severity === "Info") mathText = `Info × 0 (Ignored)`;

            return `
              <div class="coach-ledger-item">
                <div class="coach-ledger-item-label">
                  <span class="item-icon ${sevClass}" style="margin-right: 4px; font-weight: bold;">${icon}</span>
                  <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px;" title="${escapeHtml(issue.message)}">${escapeHtml(issue.message)}</span>
                  <span class="coach-ledger-item-math">(${mathText})</span>
                </div>
                <span class="coach-ledger-item-value ${sevClass === "critical" ? "critical" : "penalty"}">${score > 0 ? `+${score}` : "0"}</span>
              </div>
            `;
          }).join("")}
        </div>
        <div class="coach-ledger-total-row">
          <span class="coach-ledger-total-label">Total Issue Penalty</span>
          <span class="coach-ledger-total-value">${playerIssues.reduce((sum, issue) => sum + (severityWeights[issue.severity] || 0), 0)} pts</span>
        </div>
      </div>
    `;
    ledgerContainer.innerHTML = ledgerHtml;
  }

  // 4. Comparative Optimization Progression Targets
  const coachProgressionCard = document.getElementById("coachProgressionCard");
  if (coachProgressionCard) {
    const benchmarkComparison = (analysis.benchmarks || {})[playerName] || {};
    const benchmark = benchmarkComparison.benchmark || {};

    const playerVal = benchmarkComparison.player_value || 0;
    const top10Val = benchmark.top_10 ? benchmark.top_10.value : 0;
    const avgVal = benchmark.average_baseline || 0;
    const rawMetric = benchmarkComparison.metric || "DPS";
    const metric = rawMetric.toUpperCase();

    if (!playerVal && !top10Val) {
      coachProgressionCard.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--muted); font-size: 13px;">
          No progression benchmark targets available for this spec/role.
        </div>
      `;
    } else if (playerVal >= top10Val) {
      coachProgressionCard.innerHTML = `
        <div class="coach-progression-row">
          <span class="coach-progression-label">Current Performance</span>
          <span class="coach-progression-value">${formatNumber(playerVal)} ${metric}</span>
        </div>
        <div style="text-align: center; padding: 16px; background: rgba(254, 240, 138, 0.03); border: 1px solid rgba(254, 240, 138, 0.15); border-radius: 12px; display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <span style="font-size: 24px;">👑</span>
          <strong style="color: var(--yellow); font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Peak Performance Level</strong>
          <p style="margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5;">You are currently matching or exceeding the high-performing Top 10% benchmark of active players globally. Sensational effort!</p>
        </div>
      `;
    } else {
      const diffToTop10 = top10Val - playerVal;
      let progressPct = 0;
      if (top10Val > avgVal) {
        progressPct = Math.max(0, Math.min(100, ((playerVal - avgVal) / (top10Val - avgVal)) * 100));
      }

      coachProgressionCard.innerHTML = `
        <div class="coach-progression-row">
          <span class="coach-progression-label">Current Performance</span>
          <span class="coach-progression-value">${formatNumber(playerVal)} ${metric}</span>
        </div>
        
        <div class="coach-progression-row">
          <span class="coach-progression-label">Top 10 High Performer Target</span>
          <span class="coach-progression-value">${formatNumber(top10Val)} ${metric}</span>
        </div>

        <div class="coach-progression-progress-bar">
          <div class="coach-progression-progress-fill" style="width: ${progressPct}%"></div>
        </div>
        
        <p class="coach-progression-milestone">
          You are currently <strong>${formatNumber(diffToTop10)} ${metric}</strong> away from reaching the **Top 10 High Performer** baseline. Focus on reducing downtime and maximizing cast counts to bridge the gap.
        </p>
      `;
    }
  }

  // 4.5. Casting Uptime & Inactivity Gaps (Encounter-Aware Transition pauses)
  const coachInactivityCard = document.getElementById("coachInactivityCard");
  if (coachInactivityCard) {
    const activity = data.activity || {};
    const uptimePct = activity.active_time_pct || 0.0;
    const gaps = activity.gaps || [];

    const fightName = analysis.fight?.name || "";
    const transitions = ENCOUNTER_TRANSITIONS[fightName] || [];

    // Filter out gaps overlapping with stuns or intermissions
    const filteredGaps = gaps.filter(gap => {
      const gapStart = gap.start_seconds;
      const gapEnd = gapStart + gap.duration_seconds;
      const overlaps = transitions.some(t => {
        return (gapStart <= t.end && gapEnd >= t.start);
      });
      return !overlaps;
    });

    // Calculate adjusted casting activity percentage
    let adjustedUptimePct = uptimePct;
    if (transitions.length > 0 && analysis.fight?.duration_seconds > 0) {
      let overlapSeconds = 0;
      gaps.forEach(gap => {
        const gapStart = gap.start_seconds;
        const gapEnd = gapStart + gap.duration_seconds;
        transitions.some(t => {
          if (gapStart <= t.end && gapEnd >= t.start) {
            const oStart = Math.max(gapStart, t.start);
            const oEnd = Math.min(gapEnd, t.end);
            overlapSeconds += Math.max(0, oEnd - oStart);
            return true;
          }
          return false;
        });
      });
      
      if (overlapSeconds > 0) {
        const currentActiveSeconds = (uptimePct / 100) * analysis.fight.duration_seconds;
        const adjustedActiveSeconds = Math.min(analysis.fight.duration_seconds, currentActiveSeconds + overlapSeconds);
        adjustedUptimePct = (adjustedActiveSeconds / analysis.fight.duration_seconds) * 100;
      }
    }

    let uptimeClass = "uptime-low";
    if (adjustedUptimePct >= 90) {
      uptimeClass = "uptime-high";
    } else if (adjustedUptimePct >= 80) {
      uptimeClass = "uptime-medium";
    }

    let gapsHtml = "";
    if (filteredGaps.length === 0) {
      gapsHtml = `
        <li class="inactivity-gap-item" style="color: var(--green); font-weight: 600;">
          🟢 Flawless casting rotation! No inactivity gaps recorded.
        </li>
      `;
    } else {
      gapsHtml = filteredGaps.slice(0, 5).map(gap => {
        const mins = Math.floor(gap.start_seconds / 60);
        const secs = Math.floor(gap.start_seconds % 60);
        const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
        return `
          <li class="inactivity-gap-item">
            <span class="inactivity-gap-dot"></span>
            <strong>${gap.duration_seconds}s</strong> inactivity gap detected at <strong>${timeStr}</strong> into fight
          </li>
        `;
      }).join("");

      if (filteredGaps.length > 5) {
        gapsHtml += `
          <li class="inactivity-gap-item" style="color: var(--muted); font-size: 11px; margin-top: 4px;">
            ... and ${filteredGaps.length - 5} more rotational gaps detected.
          </li>
        `;
      }
    }

    // Add badge if any gaps were paused/filtered
    const gapsFilteredCount = gaps.length - filteredGaps.length;
    if (gapsFilteredCount > 0) {
      gapsHtml += `
        <li class="inactivity-gap-item" style="color: var(--blue); font-weight: 650; display: flex; align-items: center; gap: 6px;">
          🛡️ Paused ${gapsFilteredCount} gap(s) overlapping with global boss intermissions.
        </li>
      `;
    }

    coachInactivityCard.innerHTML = `
      <div class="coach-inactivity-wrapper">
        <div class="coach-inactivity-header">
          <span class="coach-inactivity-title" style="color: var(--muted)">Casting Activity</span>
          <strong style="font-size: 14px; font-family: monospace;">${adjustedUptimePct.toFixed(1)}% ${gapsFilteredCount > 0 ? `<span style="font-size: 10px; color: var(--blue);">(Calibrated)</span>` : ""}</strong>
        </div>
        <div class="coach-inactivity-bar-container">
          <div class="coach-inactivity-bar ${uptimeClass}" style="width: ${adjustedUptimePct}%"></div>
        </div>
        <p style="font-size: 11px; color: var(--muted); margin: 0 0 12px 0; line-height: 1.4;">
          Target a casting uptime of <strong>90%+</strong>. Gaps occur when you go 5+ seconds without casting any offensive, defensive, or utility spells. Global intermissions are automatically calibrated out.
        </p>
        <ul class="inactivity-gap-list">
          ${gapsHtml}
        </ul>
      </div>
    `;
  }

  // 5. Visual Smooth Open
  if (drawer) {
    drawer.classList.remove("hidden");
    drawer.offsetHeight;
    drawer.classList.add("active");
  }
}

function closePlayerCoachCard() {
  const drawer = document.getElementById("playerCoachDrawer");
  if (!drawer) return;

  drawer.classList.remove("active");
  setTimeout(() => {
    if (!drawer.classList.contains("active")) {
      drawer.classList.add("hidden");
    }
  }, 300);
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

async function checkUserSession() {
  const container = document.getElementById("authContainer");
  if (!container) return;

  try {
    const response = await fetch("/api/auth/me");
    if (response.ok) {
      const user = await response.json();
      const firstLetter = user.username ? user.username.charAt(0) : "U";
      const tierLabel = user.is_premium ? (user.premium_tier || "Premium") : "Free Account";
      const tierClass = user.is_premium ? "" : "free";

      currentUserWebhook = user.discord_webhook_url || "";

      container.innerHTML = `
        <div class="user-profile-widget">
          <div class="user-avatar">${firstLetter}</div>
          <div class="user-meta">
            <span class="user-name">${escapeHtml(user.username)}</span>
            <span class="user-tier ${tierClass}">${escapeHtml(tierLabel)}</span>
          </div>
          <button id="settingsButton" class="settings-button" type="button">Settings</button>
          <button id="logoutButton" class="logout-button" type="button">Log Out</button>
        </div>
      `;

      document.getElementById("settingsButton").addEventListener("click", openSettingsDrawer);
      document.getElementById("logoutButton").addEventListener("click", logoutUser);
      loadGuildDashboard();
    } else {
      renderLoginButton();
      hideGuildDashboard();
    }
  } catch (error) {
    console.error("Failed to query user authentication status:", error);
    renderLoginButton();
    hideGuildDashboard();
  }
}

function renderLoginButton() {
  const container = document.getElementById("authContainer");
  if (!container) return;
  
  container.innerHTML = `
    <a id="loginButton" class="login-button" href="/api/auth/warcraftlogs/login">
      <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      Log In with Warcraft Logs
    </a>
  `;
}

async function logoutUser() {
  const button = document.getElementById("logoutButton");
  if (button) button.disabled = true;

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });
    if (response.ok) {
      renderLoginButton();
      hideGuildDashboard();
    } else {
      console.error("Failed to log out:", response.status);
      if (button) button.disabled = false;
    }
  } catch (error) {
    console.error("Logout request failed:", error);
    if (button) button.disabled = false;
  }
}

function hideGuildDashboard() {
  const card = document.getElementById("guildDashboardCard");
  if (card) card.classList.add("hidden");
}

function toggleGuildHub(collapsed) {
  const container = document.getElementById("guildHubContent");
  const arrow = document.getElementById("guildHubArrow");
  const desc = document.getElementById("guildHubDesc");
  const header = document.getElementById("guildHubHeader");

  if (!container || !arrow || !desc || !header) return;

  if (collapsed) {
    container.style.display = "none";
    desc.style.display = "none";
    arrow.style.transform = "rotate(-90deg)";
  } else {
    container.style.display = "block";
    desc.style.display = "block";
    arrow.style.transform = "rotate(0deg)";
  }
}

async function loadGuildDashboard() {
  const dashboardCard = document.getElementById("guildDashboardCard");
  const tabContainer = document.getElementById("guildTabContainer");
  const reportsContainer = document.getElementById("guildReportsContainer");

  if (!dashboardCard || !tabContainer || !reportsContainer) return;

  // Render skeleton tabs and grid first to give an extremely fast premium loading feel!
  tabContainer.innerHTML = `<div class="guild-tab-button" style="width: 120px; height: 38px; animation: skeletonShimmer 1.5s infinite; background: rgba(255,255,255,0.01); border: 1px solid var(--border);"></div>`;
  renderReportsSkeleton();
  dashboardCard.classList.remove("hidden");
  
  toggleGuildHub(!!currentJobId); // Collapse on load if viewing a report, otherwise expand

  try {
    const response = await fetch("/api/auth/guilds");
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Failed to load guilds: ${response.status} - ${errData.detail || "Unknown Error"}`);
    }

    const data = await response.json();
    const guilds = data.guilds || [];

    if (guilds.length === 0) {
      tabContainer.innerHTML = "";
      reportsContainer.innerHTML = `
        <div class="no-guilds-msg">
          No guilds associated with your Warcraft Logs characters were found. Make sure your characters are linked in your Warcraft Logs profile.
        </div>
      `;
      return;
    }

    renderGuildTabs(guilds);
  } catch (error) {
    console.error("Error loading Guild Dashboard:", error);
    tabContainer.innerHTML = "";
    reportsContainer.innerHTML = `
      <div class="no-guilds-msg" style="color: var(--red); border-color: rgba(251, 113, 133, 0.2);">
        Failed to fetch your guilds from Warcraft Logs. Please try refreshing or reconnecting your account.
      </div>
    `;
  }
}

function renderReportsSkeleton() {
  const reportsContainer = document.getElementById("guildReportsContainer");
  if (!reportsContainer) return;

  let skeletonHtml = "";
  for (let i = 0; i < 3; i++) {
    skeletonHtml += `
      <div class="guild-skeleton-card">
        <div class="guild-report-info">
          <div class="guild-skeleton-line guild-skeleton-title"></div>
          <div class="guild-skeleton-line guild-skeleton-meta1"></div>
          <div class="guild-skeleton-line guild-skeleton-meta2"></div>
        </div>
        <div class="guild-skeleton-line guild-skeleton-button"></div>
      </div>
    `;
  }
  reportsContainer.innerHTML = skeletonHtml;
}

function renderGuildTabs(guilds) {
  const tabContainer = document.getElementById("guildTabContainer");
  if (!tabContainer) return;

  tabContainer.innerHTML = "";

  guilds.forEach((guild, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "guild-tab-button";
    
    // Alliance = Faction 1, Horde = Faction 2. Assign classes for faction colors!
    const factionId = guild.faction ? guild.faction.id : 0;
    if (factionId === 1) {
      btn.classList.add("alliance");
    } else if (factionId === 2) {
      btn.classList.add("horde");
    }

    // Shield/faction emblem indicators
    const shieldSvg = factionId === 1 
      ? `<svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
      : `<svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 5l6.5 11H5.5L12 7z"/></svg>`;

    btn.innerHTML = `
      ${shieldSvg}
      <span>${escapeHtml(guild.name)}</span>
      <span style="font-size: 11px; opacity: 0.5;">(${escapeHtml(guild.region ? guild.region.compact : "")}-${escapeHtml(guild.server ? guild.server.name : "")})</span>
    `;

    btn.addEventListener("click", () => {
      document.querySelectorAll(".guild-tab-button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadGuildReports(guild.id);
    });

    tabContainer.appendChild(btn);

    // Auto-select first guild on load
    if (idx === 0) {
      btn.classList.add("active");
      loadGuildReports(guild.id);
    }
  });
}

async function loadGuildReports(guildId) {
  renderReportsSkeleton();

  const reportsContainer = document.getElementById("guildReportsContainer");
  if (!reportsContainer) return;

  try {
    const response = await fetch(`/api/auth/guilds/${guildId}/reports?limit=6`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Failed to load reports: ${response.status} - ${errData.detail || "Unknown Error"}`);
    }

    const data = await response.json();
    const reports = data.reports || [];

    if (reports.length === 0) {
      reportsContainer.innerHTML = `
        <div class="no-reports-msg">
          No combat log reports have been uploaded for this guild yet.
        </div>
      `;
      return;
    }

    reportsContainer.innerHTML = "";
    reports.forEach(report => {
      const card = document.createElement("div");
      card.className = "guild-report-card";

      // Formatted Date
      const dateText = report.startTime 
        ? new Date(report.startTime).toLocaleDateString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : "Unknown Date";

      card.innerHTML = `
        <div class="guild-report-info">
          <h3 class="guild-report-title">${escapeHtml(report.title || "Raid Report")}</h3>
          <div class="guild-report-meta">
            <div class="guild-report-time">
              <svg style="width: 14px; height: 14px; opacity: 0.6;" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              ${escapeHtml(dateText)}
            </div>
            <div class="guild-report-owner">
              <svg style="width: 14px; height: 14px; opacity: 0.6;" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <span>${escapeHtml(report.owner ? report.owner.name : "Unknown")}</span>
            </div>
          </div>
        </div>
        <button class="guild-analyze-btn" type="button" data-code="${escapeHtml(report.code)}">
          <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Analyze Report
        </button>
      `;

      card.querySelector(".guild-analyze-btn").addEventListener("click", () => {
        analyzeReportFromHub(report.code);
      });

      reportsContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading guild reports:", error);
    reportsContainer.innerHTML = `
      <div class="no-reports-msg" style="color: var(--red); border-color: rgba(251, 113, 133, 0.2);">
        Failed to load combat reports. Please try again.
      </div>
    `;
  }
}

function analyzeReportFromHub(code) {
  const urlInput = document.getElementById("reportUrl");
  const analyzeBtn = document.getElementById("analyzeButton");

  if (!urlInput || !analyzeBtn) return;

  // Populate input row
  urlInput.value = `https://www.warcraftlogs.com/reports/${code}`;

  // Scroll to analyze section smoothly
  const analyzeSection = document.getElementById("analyzeCard");
  if (analyzeSection) {
    analyzeSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Trigger analysis immediately
  startAnalysis();
}

/* =============================================================================
   Interactive Performance Charts Drawing & Tooltip Engine
   ============================================================================= */

function getOrCreateTooltip() {
  let tooltip = document.getElementById("chartTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chartTooltip";
    tooltip.className = "chart-tooltip";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showTooltip(e, title, rows) {
  const tooltip = getOrCreateTooltip();
  
  const rowsHtml = rows.map(r => `
    <div class="tooltip-row">
      <span class="tooltip-label">${escapeHtml(r.label)}</span>
      <span class="tooltip-value">${escapeHtml(r.value)}</span>
    </div>
  `).join("");
  
  tooltip.innerHTML = `
    <div class="tooltip-title">${escapeHtml(title)}</div>
    ${rowsHtml}
  `;
  
  tooltip.classList.add("active");
  tooltip.style.left = `${e.pageX}px`;
  tooltip.style.top = `${e.pageY}px`;
}

function moveTooltip(e) {
  const tooltip = document.getElementById("chartTooltip");
  if (tooltip) {
    tooltip.style.left = `${e.pageX}px`;
    tooltip.style.top = `${e.pageY}px`;
  }
}

function hideTooltip() {
  const tooltip = document.getElementById("chartTooltip");
  if (tooltip) {
    tooltip.classList.remove("active");
  }
}

function drawRosterDistributionChart(benchmarks, playerLookup) {
  const container = document.getElementById("rosterChartContainer");
  if (!container) return;

  const sortedPlayers = Object.entries(benchmarks || {})
    .map(([name, comp]) => {
      const benchmark = comp.benchmark || {};
      return {
        name,
        value: comp.player_value || 0,
        metric: (comp.metric || "DPS").toUpperCase(),
        grade: comp.grade || "N/A",
        top1: benchmark.top_1 ? benchmark.top_1.value : 0,
        top10: benchmark.top_10 ? benchmark.top_10.value : 0,
        avg: benchmark.average_baseline || 0,
        classColor: getClassColor(playerLookup[name]?.className)
      };
    })
    .sort((a, b) => b.value - a.value);

  if (sortedPlayers.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 30px;">No roster benchmark comparisons recorded.</div>`;
    return;
  }

  const margin = { top: 30, right: 30, bottom: 80, left: 60 };
  const width = 1000;
  const height = 300;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const ref = sortedPlayers[0];
  const metricLabel = ref.metric;

  // Find scale ceilings based strictly on plotted bars and drawn reference thresholds
  const maxPlottedValue = Math.max(...sortedPlayers.map(p => p.value));
  const maxThresholdValue = Math.max(ref.top1, ref.top10, ref.avg);
  const maxVal = Math.max(maxPlottedValue, maxThresholdValue) * 1.05 || 100000;

  const yToSvg = (val) => chartHeight - (val / maxVal) * chartHeight + margin.top;

  const numPlayers = sortedPlayers.length;
  const barGapPct = 0.25;
  const totalBarSpace = chartWidth / numPlayers;
  const barWidth = totalBarSpace * (1 - barGapPct);
  const barGap = totalBarSpace * barGapPct;

  const top1Y = yToSvg(ref.top1);
  const top10Y = yToSvg(ref.top10);
  const avgY = yToSvg(ref.avg);

  // Horizontal Grid Lines
  const gridTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const gridLinesHtml = gridTicks.map(tick => {
    const y = yToSvg(tick);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid-line" />
      <text x="${margin.left - 10}" y="${y + 4}" class="chart-axis-text" text-anchor="end">${formatNumber(tick)}</text>
    `;
  }).join("");

  const barsHtml = sortedPlayers.map((player, idx) => {
    const x = margin.left + idx * totalBarSpace + barGap / 2;
    const y = yToSvg(player.value);
    const rectHeight = Math.max(2, chartHeight - (player.value / maxVal) * chartHeight);

    return `
      <g>
        <rect
          x="${x}"
          y="${y}"
          width="${barWidth}"
          height="${rectHeight}"
          fill="${player.classColor}"
          fill-opacity="0.8"
          class="chart-bar"
          onclick="showPlayerCoachCard('${escapeHtml(player.name)}')"
          onmouseenter="showRosterTooltip(event, ${idx})"
          onmousemove="moveTooltip(event)"
          onmouseleave="hideTooltip()"
        />
        <text
          x="${x + barWidth / 2}"
          y="${chartHeight + margin.top + 10}"
          transform="rotate(45, ${x + barWidth / 2}, ${chartHeight + margin.top + 10})"
          class="chart-axis-text"
          text-anchor="end"
        >${escapeHtml(player.name.substring(0, 10))}</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <div class="chart-header">
      <div>
        <h3 class="chart-title">Roster Throughput Distribution</h3>
        <div class="chart-subtitle">Direct HPS/DPS comparison. Horizontal lines mark WCL global targets. Click bar to inspect.</div>
      </div>
    </div>
    <div class="chart-svg-wrapper">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        ${gridLinesHtml}

        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${chartHeight + margin.top}" class="chart-axis-line" />
        <line x1="${margin.left}" y1="${chartHeight + margin.top}" x2="${width - margin.right}" y2="${chartHeight + margin.top}" class="chart-axis-line" />

        <line x1="${margin.left}" y1="${top1Y}" x2="${width - margin.right}" y2="${top1Y}" class="chart-threshold-line" stroke="#ffd700" stroke-opacity="0.65" />
        <text x="${width - margin.right}" y="${top1Y - 6}" class="chart-axis-text" fill="#ffd700" text-anchor="end">Top 1% Global (${formatNumber(ref.top1)})</text>

        <line x1="${margin.left}" y1="${top10Y}" x2="${width - margin.right}" y2="${top10Y}" class="chart-threshold-line" stroke="#38bdf8" stroke-opacity="0.65" />
        <text x="${(width - margin.left - margin.right) / 2 + margin.left}" y="${top10Y - 6}" class="chart-axis-text" fill="#38bdf8" text-anchor="middle">Top 10% (Grade A: ${formatNumber(ref.top10)})</text>

        <line x1="${margin.left}" y1="${avgY}" x2="${width - margin.right}" y2="${avgY}" class="chart-threshold-line" stroke="#9ca3af" stroke-opacity="0.65" />
        <text x="${margin.left + 10}" y="${avgY - 6}" class="chart-axis-text" fill="#9ca3af" text-anchor="start">Average Baseline (${formatNumber(ref.avg)})</text>

        ${barsHtml}
      </svg>
    </div>
  `;

  window.showRosterTooltip = (e, index) => {
    const p = sortedPlayers[index];
    showTooltip(e, p.name, [
      { label: "Grade", value: p.grade },
      { label: `Throughput (${metricLabel})`, value: formatNumber(p.value) },
      { label: "Top 10% target", value: formatNumber(p.top10) },
      { label: "vs Average Baseline", value: `${p.avg > 0 ? ((p.value - p.avg) / p.avg * 100).toFixed(1) : 0}%` }
    ]);
  };
}

function drawAvoidableDamageChart(playerMetrics, playerLookup) {
  const container = document.getElementById("avoidableDamageChartContainer");
  if (!container) return;

  const activePlayers = Object.entries(playerMetrics || {}).map(([name, data]) => {
    const performance = data.performance || {};
    const identity = data.identity || {};
    const output = Math.max(performance.dps || 0, performance.hps || 0);
    const avoidableDamage = performance.avoidable_damage_taken || 0;
    const rawMetric = performance.dps > performance.hps ? "DPS" : "HPS";
    return {
      name,
      output,
      avoidableDamage,
      metric: rawMetric,
      role: identity.role || "DPS",
      classColor: getClassColor(playerLookup[name]?.className)
    };
  });

  if (activePlayers.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 30px;">No visual metrics recorded.</div>`;
    return;
  }

  const margin = { top: 30, right: 30, bottom: 40, left: 60 };
  const width = 1000;
  const height = 280;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const maxOutput = Math.max(...activePlayers.map(p => p.output)) * 1.1 || 100000;
  const maxAvoidable = Math.max(...activePlayers.map(p => p.avoidableDamage)) * 1.15 || 5000000;

  const xToSvg = (val) => margin.left + (val / maxAvoidable) * chartWidth;
  const yToSvg = (val) => chartHeight - (val / maxOutput) * chartHeight + margin.top;

  // Split calculations based on dynamic roster averages
  const avgAvoidable = activePlayers.reduce((sum, p) => sum + p.avoidableDamage, 0) / activePlayers.length || (maxAvoidable / 2);
  const avgOutput = activePlayers.reduce((sum, p) => sum + p.output, 0) / activePlayers.length || (maxOutput / 2);

  const splitX = xToSvg(avgAvoidable);
  const splitY = yToSvg(avgOutput);

  // Y Grid
  const yGridTicks = [0, maxOutput * 0.25, maxOutput * 0.5, maxOutput * 0.75, maxOutput];
  const yGridHtml = yGridTicks.map(tick => {
    const y = yToSvg(tick);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid-line" />
      <text x="${margin.left - 10}" y="${y + 4}" class="chart-axis-text" text-anchor="end">${formatNumber(tick)}</text>
    `;
  }).join("");

  // X Grid
  const xGridTicks = [0, maxAvoidable * 0.25, maxAvoidable * 0.5, maxAvoidable * 0.75, maxAvoidable];
  const xGridHtml = xGridTicks.map(tick => {
    const x = xToSvg(tick);
    return `
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${chartHeight + margin.top}" class="chart-grid-line" />
      <text x="${x}" y="${chartHeight + margin.top + 16}" class="chart-axis-text" text-anchor="middle">${formatDamageMillions(tick)}</text>
    `;
  }).join("");

  const nodesHtml = activePlayers.map((player, idx) => {
    const cx = xToSvg(player.avoidableDamage);
    const cy = yToSvg(player.output);

    return `
      <circle
        cx="${cx}"
        cy="${cy}"
        r="6"
        fill="${player.classColor}"
        fill-opacity="0.85"
        stroke="#ffffff"
        stroke-width="1.5"
        class="chart-node"
        onclick="showPlayerCoachCard('${escapeHtml(player.name)}')"
        onmouseenter="showScatterTooltip(event, ${idx})"
        onmousemove="moveTooltip(event)"
        onmouseleave="hideTooltip()"
      />
    `;
  }).join("");

  container.innerHTML = `
    <div class="chart-header">
      <div>
        <h3 class="chart-title">Avoidable Damage vs. Throughput Quadrants</h3>
        <div class="chart-subtitle">Mapping survival vs performance. Dividers represent roster averages. Click node to inspect.</div>
      </div>
    </div>
    <div class="chart-svg-wrapper">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        ${yGridHtml}
        ${xGridHtml}

        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${chartHeight + margin.top}" class="chart-axis-line" />
        <line x1="${margin.left}" y1="${chartHeight + margin.top}" x2="${width - margin.right}" y2="${chartHeight + margin.top}" class="chart-axis-line" />

        <!-- Quadrant Dividers -->
        <line x1="${splitX}" y1="${margin.top}" x2="${splitX}" y2="${chartHeight + margin.top}" class="chart-quadrant-divider" />
        <line x1="${margin.left}" y1="${splitY}" x2="${width - margin.right}" y2="${splitY}" class="chart-quadrant-divider" />

        <!-- Quadrant Labels -->
        <text x="${margin.left + 15}" y="${margin.top + 20}" class="chart-quadrant-label quadrant-tl">Perfect Execution</text>
        <text x="${width - margin.right - 15}" y="${margin.top + 20}" class="chart-quadrant-label quadrant-tr" text-anchor="end">Glass Cannons</text>
        <text x="${margin.left + 15}" y="${chartHeight + margin.top - 15}" class="chart-quadrant-label quadrant-bl">Passive Survival</text>
        <text x="${width - margin.right - 15}" y="${chartHeight + margin.top - 15}" class="chart-quadrant-label quadrant-br" text-anchor="end">High Risk Zone</text>

        ${nodesHtml}
      </svg>
    </div>
  `;

  window.showScatterTooltip = (e, index) => {
    const p = activePlayers[index];
    showTooltip(e, p.name, [
      { label: "Role", value: p.role },
      { label: `Throughput (${p.metric})`, value: formatNumber(p.output) },
      { label: "Avoidable Damage Taken", value: formatNumber(p.avoidableDamage) }
    ]);
  };
}

function formatDamageMillions(val) {
  if (val === 0) return "0";
  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(1)}M`;
  }
  return `${(val / 1000).toFixed(0)}K`;
}


function renderProgressionTab(progression) {
  const pulls = progression.pulls || [];

  if (!pulls.length) {
    renderEmptyTab("Wipe Progression", "No wipe progression data recorded for this encounter.");
    return;
  }

  // Calculate Progression Metrics
  const totalAttempts = pulls.length;
  
  let totalSeconds = 0;
  let bestHp = 100.0;
  let hasKill = false;

  pulls.forEach(p => {
    totalSeconds += p.duration_seconds || 0;
    if (p.kill) {
      hasKill = true;
      bestHp = 0.0;
    } else if (p.boss_percentage !== null && p.boss_percentage < bestHp) {
      bestHp = p.boss_percentage;
    }
  });

  const avgSurvivalSeconds = totalAttempts > 0 ? (totalSeconds / totalAttempts) : 0;

  // Formatting utilities
  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.round(sec % 60);
    return `${mins}:${String(rem).padStart(2, "0")}`;
  };

  const formatHrsTime = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const rem = Math.round(sec % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${rem}s`;
    }
    return `${mins}m ${rem}s`;
  };

  const avgSurvivalText = formatTime(avgSurvivalSeconds);
  const totalProgressionTimeText = formatHrsTime(totalSeconds);
  const bestHpText = bestHp === 0.0 ? "Kill 🏆" : `${bestHp.toFixed(1)}% HP`;

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Wipe Progression Tracker</h2>
    <p class="progression-summary-desc">
      Analyze pull-over-pull improvement. Visual area indicates boss health remaining (lower is better), and dashed red line shows your survived time (higher is better).
    </p>

    <div class="progression-grid">
      <div class="stat">
        <div class="stat-label">Total Attempts</div>
        <div class="stat-value">${totalAttempts}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Best Progress</div>
        <div class="stat-value" style="color: ${bestHp === 0.0 ? "var(--green)" : "var(--yellow)"}">${bestHpText}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Avg Survival Time</div>
        <div class="stat-value">${avgSurvivalText}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Progression Time</div>
        <div class="stat-value">${totalProgressionTimeText}</div>
      </div>
    </div>

    <div id="progressionChartContainer" class="chart-container"></div>

    <div class="table-wrapper">
      <table class="progression-table">
        <thead>
          <tr>
            <th>Pull</th>
            <th>Result</th>
            <th>HP Left</th>
            <th>Survival Time</th>
            <th>Phase Reached</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${pulls.map(p => {
            const pullClass = p.kill ? "kill" : "wipe";
            const resultLabel = p.kill ? "Kill" : "Wipe";
            const hpText = p.kill ? "0.0%" : (p.boss_percentage !== null ? `${p.boss_percentage.toFixed(1)}%` : "—");
            
            const attemptTime = p.start_time
              ? new Date(p.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              : "—";

            return `
              <tr class="pull-row ${pullClass}">
                <td><strong>Pull ${p.pull_number}</strong></td>
                <td>
                  <span class="pill ${p.kill ? "grade-A" : "grade-F"}" style="border-radius: 6px; padding: 3px 8px; font-size: 11px;">
                    ${resultLabel}
                  </span>
                </td>
                <td>${hpText}</td>
                <td>${formatTime(p.duration_seconds)}</td>
                <td>Phase ${p.last_phase || 1}</td>
                <td>${attemptTime}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  drawProgressionChart(pulls);
}

function drawProgressionChart(pulls) {
  const container = document.getElementById("progressionChartContainer");
  if (!container) return;

  const margin = { top: 30, right: 60, bottom: 40, left: 60 };
  const width = 1000;
  const height = 300;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Max calculations
  const maxDuration = Math.max(...pulls.map(p => p.duration_seconds)) * 1.1 || 60;
  const numPulls = pulls.length;

  const xToSvg = (idx) => {
    if (numPulls <= 1) return margin.left + chartWidth / 2;
    return margin.left + (idx / (numPulls - 1)) * chartWidth;
  };

  const hpToSvg = (pct) => {
    const val = pct === null ? 100.0 : Number(pct);
    return margin.top + (val / 100.0) * chartHeight;
  };

  const durationToSvg = (sec) => {
    return chartHeight - (sec / maxDuration) * chartHeight + margin.top;
  };

  // Horizontal Grid Lines (HP %)
  const hpTicks = [0, 25, 50, 75, 100];
  const yGridHtml = hpTicks.map(tick => {
    const y = hpToSvg(tick);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid-line" />
      <text x="${margin.left - 10}" y="${y + 4}" class="chart-axis-text" text-anchor="end">${tick}%</text>
    `;
  }).join("");

  // Vertical Grid Lines (Attempts)
  const xGridHtml = pulls.map((p, idx) => {
    const x = xToSvg(idx);
    return `
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${chartHeight + margin.top}" class="chart-grid-line" />
      <text x="${x}" y="${chartHeight + margin.top + 18}" class="chart-axis-text" text-anchor="middle">P${p.pull_number}</text>
    `;
  }).join("");

  // Generate SVG Path for Area & Line HP
  let hpAreaPoints = `${margin.left},${chartHeight + margin.top} `;
  let hpLinePoints = "";
  let durationLinePoints = "";

  pulls.forEach((p, idx) => {
    const x = xToSvg(idx);
    const yHp = hpToSvg(p.kill ? 0.0 : (p.boss_percentage ?? 100.0));
    const yDur = durationToSvg(p.duration_seconds);

    hpAreaPoints += `${x},${yHp} `;
    hpLinePoints += `${x},${yHp} `;
    durationLinePoints += `${x},${yDur} `;
  });

  hpAreaPoints += `${xToSvg(numPulls - 1)},${chartHeight + margin.top}`;

  // Interactive nodes html
  const nodesHtml = pulls.map((p, idx) => {
    const x = xToSvg(idx);
    const yHp = hpToSvg(p.kill ? 0.0 : (p.boss_percentage ?? 100.0));
    const nodeClass = p.kill ? "chart-node-kill" : "chart-node-wipe";
    const radius = p.kill ? 8 : 5;

    return `
      <circle
        cx="${x}"
        cy="${yHp}"
        r="${radius}"
        class="${nodeClass}"
        onmouseenter="showPullTooltip(event, ${idx})"
        onmousemove="moveTooltip(event)"
        onmouseleave="hideTooltip()"
      />
    `;
  }).join("");

  // Time ticks on right axis
  const timeTicks = [0, maxDuration * 0.25, maxDuration * 0.5, maxDuration * 0.75, maxDuration];
  const formatTimeMinutes = (sec) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.round(sec % 60);
    return `${mins}:${String(rem).padStart(2, "0")}`;
  };
  const rightAxisHtml = timeTicks.map(tick => {
    const y = durationToSvg(tick);
    return `
      <text x="${width - margin.right + 10}" y="${y + 4}" class="chart-axis-text" text-anchor="start">${formatTimeMinutes(tick)}</text>
    `;
  }).join("");

  container.innerHTML = `
    <div class="chart-header">
      <div>
        <h3 class="chart-title">Boss HP & Survival Curves</h3>
        <div class="chart-subtitle">Green area represents boss HP (lower is better). Dashed red line shows attempt duration (higher is better). Hover nodes for details.</div>
      </div>
    </div>
    <div class="chart-svg-wrapper">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        <defs>
          <linearGradient id="hpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#4ade80" stop-opacity="0.02"/>
          </linearGradient>
        </defs>

        ${yGridHtml}
        ${xGridHtml}
        ${rightAxisHtml}

        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${chartHeight + margin.top}" class="chart-axis-line" />
        <line x1="${width - margin.right}" y1="${margin.top}" x2="${width - margin.right}" y2="${chartHeight + margin.top}" class="chart-axis-line" />
        <line x1="${margin.left}" y1="${chartHeight + margin.top}" x2="${width - margin.right}" y2="${chartHeight + margin.top}" class="chart-axis-line" />

        <!-- Dual-Axis Titles -->
        <text x="${margin.left - 45}" y="${margin.top - 10}" class="chart-axis-label" text-anchor="start">Boss HP %</text>
        <text x="${width - margin.right + 45}" y="${margin.top - 10}" class="chart-axis-label" text-anchor="end">Survival Time</text>

        <!-- Area and Line Curves -->
        <polygon points="${hpAreaPoints}" class="chart-area-hp" />
        <path d="M ${hpLinePoints.trim()}" class="chart-line-hp" />
        <path d="M ${durationLinePoints.trim()}" class="chart-line-duration" />

        ${nodesHtml}
      </svg>
    </div>
  `;

  window.showPullTooltip = (e, index) => {
    const p = pulls[index];
    const mins = Math.floor(p.duration_seconds / 60);
    const rem = p.duration_seconds % 60;
    const durationText = `${mins}:${String(rem).padStart(2, "0")}`;
    const resultLabel = p.kill ? "Kill 🏆" : "Wipe";
    const hpText = p.kill ? "0.0%" : (p.boss_percentage !== null ? `${p.boss_percentage.toFixed(1)}%` : "—");

    showTooltip(e, `Attempt #${p.pull_number} (${resultLabel})`, [
      { label: "Boss HP Left", value: hpText },
      { label: "Survived For", value: durationText },
      { label: "Phase Reached", value: `Phase ${p.last_phase || 1}` }
    ]);
  };
}


/* =============================================================================
   Control Panel, Settings, and Discord Webhook Integrations
   ============================================================================= */

function openSettingsDrawer() {
  const drawer = document.getElementById("settingsDrawer");
  const webhookInput = document.getElementById("discordWebhookInput");
  const statusMsg = document.getElementById("webhookStatusMessage");

  if (!drawer) return;

  if (webhookInput) {
    webhookInput.value = currentUserWebhook;
  }

  if (statusMsg) {
    statusMsg.classList.add("hidden");
    statusMsg.className = "";
  }

  drawer.classList.remove("hidden");
  drawer.offsetHeight; // force layout reflow
  drawer.classList.add("active");
}

function closeSettingsDrawer() {
  const drawer = document.getElementById("settingsDrawer");
  if (!drawer) return;

  drawer.classList.remove("active");
  setTimeout(() => {
    if (!drawer.classList.contains("active")) {
      drawer.classList.add("hidden");
    }
  }, 300);
}

async function saveWebhookSettings() {
  const webhookInput = document.getElementById("discordWebhookInput");
  const saveBtn = document.getElementById("saveWebhookButton");
  const statusMsg = document.getElementById("webhookStatusMessage");

  if (!webhookInput || !saveBtn || !statusMsg) return;

  const url = webhookInput.value.trim();

  statusMsg.classList.add("hidden");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch("/api/auth/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ discord_webhook_url: url || null })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to update webhook settings.");
    }

    const data = await response.json();
    currentUserWebhook = data.discord_webhook_url || "";
    webhookInput.value = currentUserWebhook;

    statusMsg.textContent = "Webhook saved successfully!";
    statusMsg.className = "status-msg-success";
    statusMsg.classList.remove("hidden");
  } catch (error) {
    statusMsg.textContent = error.message;
    statusMsg.className = "status-msg-error";
    statusMsg.classList.remove("hidden");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Webhook";
  }
}

async function testWebhookSettings() {
  const webhookInput = document.getElementById("discordWebhookInput");
  const testBtn = document.getElementById("testWebhookButton");
  const statusMsg = document.getElementById("webhookStatusMessage");

  if (!webhookInput || !testBtn || !statusMsg) return;

  const url = webhookInput.value.trim();

  statusMsg.classList.add("hidden");
  testBtn.disabled = true;
  testBtn.textContent = "Testing...";

  try {
    const response = await fetch("/api/auth/settings/test-discord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ discord_webhook_url: url || null })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to send test webhook.");
    }

    statusMsg.textContent = "Test message posted successfully in Discord! 🚀";
    statusMsg.className = "status-msg-success";
    statusMsg.classList.remove("hidden");
  } catch (error) {
    statusMsg.textContent = error.message;
    statusMsg.className = "status-msg-error";
    statusMsg.classList.remove("hidden");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Link";
  }
}

async function postActiveReportToDiscord() {
  const postBtn = document.getElementById("postDiscordButton");
  if (!postBtn || !currentJobId) return;

  if (!currentUserWebhook) {
    openSettingsDrawer();
    const statusMsg = document.getElementById("webhookStatusMessage");
    if (statusMsg) {
      statusMsg.textContent = "Please configure and save your Discord Webhook URL first.";
      statusMsg.className = "status-msg-error";
      statusMsg.classList.remove("hidden");
    }
    return;
  }

  postBtn.disabled = true;
  postBtn.textContent = "Posting...";

  try {
    const response = await fetch(`/api/jobs/${currentJobId}/discord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ analysis_index: selectedAnalysisIndex })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to post report to Discord.");
    }

    postBtn.textContent = "Posted! 🚀";
    postBtn.style.background = "var(--green)";
    postBtn.style.color = "#0f1218";

    setTimeout(() => {
      postBtn.disabled = false;
      postBtn.textContent = "Post to Discord";
      postBtn.style.background = "";
      postBtn.style.color = "";
    }, 2500);
  } catch (error) {
    alert(`Failed to share to Discord: ${error.message}`);
    postBtn.disabled = false;
    postBtn.textContent = "Post to Discord";
  }
}


/* =============================================================================
   Visual "Death Recaps" Timeline Orchestration
   ============================================================================= */

function showDeathRecap(playerName, timestamp) {
  const analysis = currentReportData?.analyses?.[selectedAnalysisIndex];
  if (!analysis) return;

  const playerMetrics = analysis.player_metrics || {};
  const data = playerMetrics[playerName];
  if (!data || !data.performance) return;

  const deathEvents = data.performance.death_events || [];
  // Find the exact death event by timestamp or closest match
  const deathEvent = deathEvents.find(d => Math.abs(d.timestamp - timestamp) < 1000) || deathEvents[0];
  if (!deathEvent) return;

  const recap = deathEvent.recap || [];
  const drawer = document.getElementById("deathRecapDrawer");
  const playerEl = document.getElementById("deathRecapPlayer");
  const metaEl = document.getElementById("deathRecapMeta");
  const eventsEl = document.getElementById("deathTimelineEvents");

  if (!drawer || !playerEl || !metaEl || !eventsEl) return;

  // Render header values
  playerEl.innerText = `☠ Death Recap: ${playerName}`;
  
  const mins = Math.floor(deathEvent.seconds_into_fight / 60);
  const secs = Math.floor(deathEvent.seconds_into_fight % 60);
  const formattedTime = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  metaEl.innerHTML = `<div>Died at ${formattedTime} into the fight</div>`;
  if (deathEvent.recap_analysis && deathEvent.recap_analysis.summary) {
    metaEl.innerHTML += `
      <div class="death-recap-summary-card">
        <span class="warning-icon">⚠️</span>
        <span class="summary-text">${escapeHtml(deathEvent.recap_analysis.summary)}</span>
      </div>
    `;
  }

  // Draw chronological events timeline nodes
  if (recap.length === 0) {
    eventsEl.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 24px;">No events recorded in final 8 seconds.</div>`;
  } else {
    eventsEl.innerHTML = recap.map(e => {
      let cardClass = "";
      let eventTitle = "";
      let amountText = "";
      let sourceText = "";

      if (e.type === "damage") {
        cardClass = "damage";
        eventTitle = e.ability_name;
        amountText = `<span class="death-event-amount damage-text">-${formatNumber(e.amount)}</span>`;
        if (e.avoidable) {
          amountText += `<span class="death-event-amount overkill-text" style="color: var(--yellow); margin-left: 6px;">Avoidable ⚠️</span>`;
        }
        if (e.overkill > 0) {
          amountText += `<span class="death-event-amount overkill-text">Overkill</span>`;
        }
        sourceText = `from ${escapeHtml(e.source_name)}`;
      } else if (e.type === "heal") {
        cardClass = "heal";
        eventTitle = e.ability_name;
        amountText = `<span class="death-event-amount heal-text">+${formatNumber(e.amount)}</span>`;
        if (e.overheal > 0) {
          amountText += `<span style="font-size: 10px; color: var(--muted); margin-left: 4px;">(${formatNumber(e.overheal)} overheal)</span>`;
        }
        sourceText = `from ${escapeHtml(e.source_name)}`;
      } else if (e.type === "applybuff") {
        cardClass = "defensive-apply";
        eventTitle = `Gained ${e.ability_name}`;
        amountText = `<span style="font-size: 11px; color: var(--blue); font-weight: 700; text-transform: uppercase;">Defensive Active</span>`;
        sourceText = `applied by ${escapeHtml(e.source_name)}`;
      } else if (e.type === "removebuff") {
        cardClass = "defensive-remove";
        eventTitle = `Lost ${e.ability_name}`;
        amountText = `<span style="font-size: 11px; color: #a855f7; font-weight: 700; text-transform: uppercase;">Expired</span>`;
        sourceText = `removed`;
      }

      const offsetText = e.seconds_offset === 0.0 ? "0.0s (Death)" : `${e.seconds_offset.toFixed(2)}s`;

      return `
        <div class="death-event-card ${cardClass}">
          <div class="death-event-node"></div>
          <div class="death-event-header">
            <span class="death-event-spell">${escapeHtml(eventTitle)}</span>
            <span class="death-event-time">${offsetText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <span class="death-event-source">${sourceText}</span>
            ${amountText}
          </div>
        </div>
      `;
    }).join("");
  }

  // Open drawer
  drawer.classList.remove("hidden");
  drawer.offsetHeight; // trigger reflow
  drawer.classList.add("active");
}

function showPlayerDeathsRecap(playerName) {
  const tennis = currentReportData?.analyses?.[selectedAnalysisIndex];
  if (!tennis) return;

  const playerMetrics = tennis.player_metrics || {};
  const data = playerMetrics[playerName];
  if (!data || !data.performance) return;

  const deathEvents = data.performance.death_events || [];
  if (!deathEvents.length) return;

  // Open the first death event (most common)
  showDeathRecap(playerName, deathEvents[0].timestamp);
}

function closeDeathRecap() {
  const drawer = document.getElementById("deathRecapDrawer");
  if (!drawer) return;

  drawer.classList.remove("active");
  setTimeout(() => {
    if (!drawer.classList.contains("active")) {
      drawer.classList.add("hidden");
    }
  }, 300);
}

/* ==============================================================================
   Visual Encounter Config Builder Orchestrator & Helpers
   ============================================================================== */
let builderData = []; // Local cache of raids, bosses, and mechanics

function initVisualBuilder() {
  // Hide all standard cards
  document.getElementById("analyzeCard").classList.add("hidden");
  document.getElementById("statusCard").classList.add("hidden");
  
  const dashboard = document.getElementById("guildDashboardCard");
  if (dashboard) dashboard.classList.add("hidden");
  
  const resultCard = document.getElementById("resultCard");
  if (resultCard) resultCard.classList.add("hidden");
  
  const bossTilesCard = document.getElementById("bossTilesCard");
  if (bossTilesCard) bossTilesCard.classList.add("hidden");
  
  const detailsCard = document.getElementById("detailsCard");
  if (detailsCard) detailsCard.classList.add("hidden");

  // Show builder card
  const builderCard = document.getElementById("builderCard");
  if (builderCard) {
    builderCard.classList.remove("hidden");
    builderCard.scrollIntoView({ behavior: "smooth" });
  }

  // Update address bar
  if (window.location.pathname !== "/builder") {
    window.history.pushState({}, "", "/builder");
  }

  // Bind close buttons
  const closeBtn = document.getElementById("builderCloseButton");
  if (closeBtn) {
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    document.getElementById("builderCloseButton").addEventListener("click", () => {
      window.history.pushState({}, "", "/");
      document.getElementById("builderCard").classList.add("hidden");
      document.getElementById("analyzeCard").classList.remove("hidden");
      document.getElementById("statusCard").classList.remove("hidden");
      if (dashboard) dashboard.classList.remove("hidden");
    });
  }

  // Bind event listeners to dropdowns
  const raidSelect = document.getElementById("builderRaidSelect");
  const bossSelect = document.getElementById("builderBossSelect");
  const mechSelect = document.getElementById("builderMechanicSelect");

  // Prevent duplicate handlers on re-init
  raidSelect.replaceWith(raidSelect.cloneNode(true));
  bossSelect.replaceWith(bossSelect.cloneNode(true));
  mechSelect.replaceWith(mechSelect.cloneNode(true));

  document.getElementById("builderRaidSelect").addEventListener("change", handleRaidChange);
  document.getElementById("builderBossSelect").addEventListener("change", handleBossChange);
  document.getElementById("builderMechanicSelect").addEventListener("change", handleMechanicChange);

  // Bind event listeners to form inputs for live regeneration
  const formFields = [
    "mechVariable", "mechName", "mechSeverity", "mechAppliesTo",
    "mechAvoidable", "mechCountsAsFailure", "mechCategory", "mechFailureType",
    "mechMaxHits", "mechScoreHit", "mechSpellIds", "mechWclType",
    "mechMinSoakers", "mechNote", "mechRec"
  ];

  formFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.replaceWith(el.cloneNode(true));
      const newEl = document.getElementById(id);
      newEl.addEventListener("input", updateBoilerplatePreviews);
      newEl.addEventListener("change", updateBoilerplatePreviews);
    }
  });

  // Intel auto-suggest score per hit based on severity changes
  const severitySelect = document.getElementById("mechSeverity");
  severitySelect.addEventListener("change", () => {
    const scoreInput = document.getElementById("mechScoreHit");
    switch (severitySelect.value) {
      case "Critical":
        scoreInput.value = 80;
        break;
      case "Major":
        scoreInput.value = 45;
        break;
      case "Warning":
        scoreInput.value = 25;
        break;
      case "Info":
        scoreInput.value = 5;
        break;
    }
    updateBoilerplatePreviews();
  });

  // Toggle min soakers row based on category/failure_type
  const categorySelect = document.getElementById("mechCategory");
  const failureTypeSelect = document.getElementById("mechFailureType");
  const toggleMinSoakers = () => {
    const isSoak = categorySelect.value.includes("soak") || 
                   categorySelect.value.includes("stack") ||
                   failureTypeSelect.value.includes("soak") ||
                   failureTypeSelect.value.includes("stack");
    const minSoakersGroup = document.getElementById("minSoakersGroup");
    if (minSoakersGroup) {
      minSoakersGroup.classList.toggle("hidden", !isSoak);
    }
  };
  categorySelect.addEventListener("change", toggleMinSoakers);
  failureTypeSelect.addEventListener("change", toggleMinSoakers);

  // Bind copy button
  const copyBtn = document.getElementById("copyDiscordButton");
  if (copyBtn) {
    copyBtn.replaceWith(copyBtn.cloneNode(true));
    document.getElementById("copyDiscordButton").addEventListener("click", copyBoilerplateToDiscord);
  }

  // Fetch API encounters
  fetchEncountersData();
}

function fetchEncountersData() {
  fetch("/api/encounters")
    .then(res => {
      if (!res.ok) throw new Error("Failed to load encounter database");
      return res.json();
    })
    .then(data => {
      builderData = data;
      populateRaidSelect();
    })
    .catch(err => {
      console.error(err);
      alert("Error fetching encounter data from backend. Make sure your ShortParse server is running.");
    });
}

function populateRaidSelect() {
  const select = document.getElementById("builderRaidSelect");
  select.innerHTML = '<option value="" disabled selected>Select a Raid Zone...</option>';
  
  builderData.forEach(raid => {
    const opt = document.createElement("option");
    opt.value = raid.id;
    opt.textContent = raid.name;
    select.appendChild(opt);
  });

  // Reset boss and mechanic selectors
  const bossSelect = document.getElementById("builderBossSelect");
  bossSelect.innerHTML = '<option value="" disabled selected>Select a Boss...</option>';
  bossSelect.disabled = true;

  const mechSelect = document.getElementById("builderMechanicSelect");
  mechSelect.innerHTML = '<option value="" disabled selected>Select a Mechanic...</option>';
  mechSelect.disabled = true;
}

function handleRaidChange() {
  const raidId = document.getElementById("builderRaidSelect").value;
  const raid = builderData.find(r => r.id === raidId);
  if (!raid) return;

  const bossSelect = document.getElementById("builderBossSelect");
  bossSelect.innerHTML = '<option value="" disabled selected>Select a Boss Encounter...</option>';
  bossSelect.disabled = false;

  raid.bosses.forEach(boss => {
    const opt = document.createElement("option");
    opt.value = boss.id;
    opt.textContent = boss.name;
    bossSelect.appendChild(opt);
  });

  // Reset mechanic selector
  const mechSelect = document.getElementById("builderMechanicSelect");
  mechSelect.innerHTML = '<option value="" disabled selected>Select a Mechanic...</option>';
  mechSelect.disabled = true;

  updateBoilerplatePreviews();
}

function handleBossChange() {
  const raidId = document.getElementById("builderRaidSelect").value;
  const bossId = parseInt(document.getElementById("builderBossSelect").value);
  
  const raid = builderData.find(r => r.id === raidId);
  if (!raid) return;
  
  const boss = raid.bosses.find(b => b.id === bossId);
  if (!boss) return;

  const mechSelect = document.getElementById("builderMechanicSelect");
  mechSelect.innerHTML = `
    <option value="" disabled selected>Select a Mechanic...</option>
    <option value="__NEW__">[ Create New Mechanic ]</option>
  `;
  mechSelect.disabled = false;

  boss.mechanics.forEach(mech => {
    const opt = document.createElement("option");
    opt.value = mech.variable_name;
    opt.textContent = `${mech.name} (${mech.variable_name})`;
    mechSelect.appendChild(opt);
  });

  // Select NEW by default when changing bosses
  mechSelect.value = "__NEW__";
  handleMechanicChange();
}

function handleMechanicChange() {
  const raidId = document.getElementById("builderRaidSelect").value;
  const bossId = parseInt(document.getElementById("builderBossSelect").value);
  const mechVarName = document.getElementById("builderMechanicSelect").value;

  if (mechVarName === "__NEW__") {
    // Reset form for new mechanic
    document.getElementById("mechanicForm").reset();
    document.getElementById("mechVariable").value = "NEW_MECHANIC";
    document.getElementById("mechName").value = "New Mechanic";
    document.getElementById("mechSeverity").value = "Major";
    document.getElementById("mechAppliesTo").value = "ALL_ROLES";
    document.getElementById("mechAvoidable").checked = true;
    document.getElementById("mechCountsAsFailure").checked = true;
    document.getElementById("mechCategory").value = "avoidable_damage";
    document.getElementById("mechFailureType").value = "avoidable_damage";
    document.getElementById("mechMaxHits").value = "1";
    document.getElementById("mechScoreHit").value = "45";
    document.getElementById("mechSpellIds").value = "";
    document.getElementById("mechWclType").value = "damage_taken";
    document.getElementById("mechMinSoakers").value = "2";
    document.getElementById("mechNote").value = "";
    document.getElementById("mechRec").value = "";
  } else {
    // Load existing mechanic
    const raid = builderData.find(r => r.id === raidId);
    if (!raid) return;
    const boss = raid.bosses.find(b => b.id === bossId);
    if (!boss) return;
    const mech = boss.mechanics.find(m => m.variable_name === mechVarName);
    if (!mech) return;

    // Map to form
    document.getElementById("mechVariable").value = mech.variable_name;
    document.getElementById("mechName").value = mech.name;
    document.getElementById("mechSeverity").value = mech.severity;
    
    // Map applies_to list to select value
    const roles = mech.applies_to || [];
    let rolesConst = "ALL_ROLES";
    if (roles.length === 3) rolesConst = "ALL_ROLES";
    else if (roles.length === 2 && roles.includes("DPS") && roles.includes("Healer")) rolesConst = "NON_TANK_ROLES";
    else if (roles.length === 1 && roles[0] === "DPS") rolesConst = "DPS_ONLY";
    else if (roles.length === 1 && roles[0] === "Healer") rolesConst = "HEALER_ONLY";
    else if (roles.length === 1 && roles[0] === "Tank") rolesConst = "TANK_ONLY";
    document.getElementById("mechAppliesTo").value = rolesConst;

    document.getElementById("mechAvoidable").checked = mech.avoidable;
    document.getElementById("mechCountsAsFailure").checked = mech.counts_as_failure;
    document.getElementById("mechCategory").value = mech.category;
    document.getElementById("mechFailureType").value = mech.failure_type;
    document.getElementById("mechMaxHits").value = mech.max_reasonable_hits;
    document.getElementById("mechScoreHit").value = mech.score_per_hit;
    document.getElementById("mechSpellIds").value = (mech.spell_ids || []).join(", ");
    document.getElementById("mechWclType").value = mech.wcl_type || "damage_taken";
    document.getElementById("mechMinSoakers").value = mech.minimum_soakers || "2";
    document.getElementById("mechNote").value = mech.note || "";
    document.getElementById("mechRec").value = mech.recommendation || "";
  }

  // Trigger elements updates
  const categorySelect = document.getElementById("mechCategory");
  const event = new Event("change");
  categorySelect.dispatchEvent(event);

  updateBoilerplatePreviews();
}

function formatPythonString(str) {
  if (!str) return '(\n        ""\n    )';
  const lines = str.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return '(\n        ""\n    )';
  }
  const formatted = lines.map(line => `        "${line.replace(/"/g, '\\"')}"`).join("\n");
  return `(\n${formatted}\n    )`;
}

function updateBoilerplatePreviews() {
  const varInput = document.getElementById("mechVariable");
  let varName = varInput.value.replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
  if (!varName) varName = "NEW_MECHANIC";
  
  if (varInput.value !== varName) {
    varInput.value = varName;
  }

  const name = document.getElementById("mechName").value || "Unnamed Mechanic";
  const severity = document.getElementById("mechSeverity").value;
  const avoidable = document.getElementById("mechAvoidable").checked ? "True" : "False";
  const countsAsFailure = document.getElementById("mechCountsAsFailure").checked ? "True" : "False";
  const category = document.getElementById("mechCategory").value;
  const failureType = document.getElementById("mechFailureType").value;
  const maxHits = parseInt(document.getElementById("mechMaxHits").value) || 0;
  const score = parseInt(document.getElementById("mechScoreHit").value) || 0;
  const appliesTo = document.getElementById("mechAppliesTo").value;
  const wclType = document.getElementById("mechWclType").value || "damage_taken";
  
  const note = document.getElementById("mechNote").value;
  const rec = document.getElementById("mechRec").value;

  const spellIdsStr = document.getElementById("mechSpellIds").value || "";
  const spellIds = spellIdsStr.split(",")
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));

  const isSoak = category.includes("soak") || category.includes("stack") || failureType.includes("soak") || failureType.includes("stack");
  const minSoakers = parseInt(document.getElementById("mechMinSoakers").value) || 2;
  const minSoakersLine = isSoak ? `\n    "minimum_soakers": ${minSoakers},` : "";

  let code = `${varName}: Mechanic = {
    "name": "${name.replace(/"/g, '\\"')}",
    "severity": "${severity}",
    "avoidable": ${avoidable},
    "category": "${category}",
    "failure_type": "${failureType}",
    "counts_as_failure": ${countsAsFailure},
    "max_reasonable_hits": ${maxHits},
    "score_per_hit": ${score},
    "applies_to": ${appliesTo},
    "spell_ids": [${spellIds.join(", ")}],${minSoakersLine}
    "note": ${formatPythonString(note)},
    "recommendation": ${formatPythonString(rec)},
    "wcl_type": "${wclType.replace(/"/g, '\\"')}",
}`;

  document.getElementById("mechanicBlockPreview").textContent = code;

  const aliasCode = `    **mechanic_aliases([${spellIds.join(", ")}], ${varName}),`;
  document.getElementById("aliasBlockPreview").textContent = aliasCode;
}

function copyBoilerplateToDiscord() {
  const mechCode = document.getElementById("mechanicBlockPreview").textContent;
  const aliasCode = document.getElementById("aliasBlockPreview").textContent;

  const combined = `\`\`\`python\n${mechCode}\n\n\n${aliasCode}\n\`\`\``;

  navigator.clipboard.writeText(combined)
    .then(() => {
      const btn = document.getElementById("copyDiscordButton");
      const originalText = btn.innerHTML;
      btn.innerHTML = "Copied! ✓";
      btn.classList.add("copied");

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove("copied");
      }, 2000);
    })
    .catch(err => {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy snippet automatically. Please copy the code manually.");
    });
}
let currentJobId = null;
let pollTimer = null;
let currentReportData = null;
let selectedAnalysisIndex = 0;
let selectedTab = "scorecard";
let currentShareUrl = "";
let currentUserWebhook = "";
let currentUserAutoPost = false;
let offlineMode = false;
let benchmarkSelectedPlayer = null;
let benchmarkComparisonMode = "high_performer";
let currentCoachPlayerName = null;
let isPatreonLinked = false;
let isPremium = false;
let premiumTier = null;
let priorityQueueEnabled = false;


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

  // Hide Warnings Toggle Trigger
  const warningsToggle = document.getElementById("coachHideWarningsToggle");
  if (warningsToggle) {
    warningsToggle.addEventListener("change", () => {
      if (currentCoachPlayerName) {
        showPlayerCoachCard(currentCoachPlayerName);
      }
    });
  }

  // Patreon Subscription Sync Trigger
  const syncPatreonBtn = document.getElementById("syncPatreonButton");
  if (syncPatreonBtn) syncPatreonBtn.addEventListener("click", syncPatreonSubscription);

  // Unlock Webhook Patreon Click Listener
  const unlockWebhookBtn = document.getElementById("unlockWebhookPatreonButton");
  if (unlockWebhookBtn) {
    unlockWebhookBtn.addEventListener("click", () => {
      const patreonUnlinked = document.getElementById("patreonUnlinkedBlock");
      const patreonLinked = document.getElementById("patreonLinkedBlock");
      const target = (patreonUnlinked && !patreonUnlinked.classList.contains("hidden")) ? patreonUnlinked : patreonLinked;
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Primary Dashboard Navigation Triggers
  const navPersonal = document.getElementById("navPersonalBtn");
  const navGuildSuite = document.getElementById("navGuildSuiteBtn");
  if (navPersonal) navPersonal.addEventListener("click", switchToPersonalAnalyzer);
  if (navGuildSuite) navGuildSuite.addEventListener("click", switchToGuildSuite);

  // Guild Suite Post Ledger to Discord trigger
  const postLedgerBtn = document.getElementById("postGuildLedgerButton");
  if (postLedgerBtn) postLedgerBtn.addEventListener("click", postGuildLedgerToDiscord);

  checkUserSession(); // Query session on page load
  loadSharedJobFromUrl();

  if (window.location.pathname === "/guild") {
    switchToGuildSuite();
  }

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

function restoreAnalyzeAndGuildCards() {
  const analyzeCardEl = document.getElementById("analyzeCard");
  if (analyzeCardEl) analyzeCardEl.classList.remove("hidden");
  
  const guildDashboardCardEl = document.getElementById("guildDashboardCard");
  if (guildDashboardCardEl && isPatreonLinked) {
    guildDashboardCardEl.classList.remove("hidden");
  }
}

function hideAnalyzeAndGuildCards() {
  const analyzeCardEl = document.getElementById("analyzeCard");
  if (analyzeCardEl) analyzeCardEl.classList.add("hidden");
  
  const guildDashboardCardEl = document.getElementById("guildDashboardCard");
  if (guildDashboardCardEl) guildDashboardCardEl.classList.add("hidden");
}

function headerActions() {
  return document.getElementById("headerActions");
}

async function startAnalysis() {
  const reportUrl = document.getElementById("reportUrl").value.trim();
  const button = document.getElementById("analyzeButton");

  if (!reportUrl) {
    statusCard().classList.remove("hidden");
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

  statusCard().classList.remove("hidden");

  // Hide the search and guild dashboard hub cards to prevent double clicking/actions during run
  hideAnalyzeAndGuildCards();

  clearRenderedResults();

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
        restoreAnalyzeAndGuildCards();
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
    restoreAnalyzeAndGuildCards();
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
        restoreAnalyzeAndGuildCards();
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
      restoreAnalyzeAndGuildCards();
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
    restoreAnalyzeAndGuildCards();
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

  // Determine queue status badge
  let queueBadgeHtml = "";
  if (priorityQueueEnabled) {
    if (isPremium) {
      queueBadgeHtml = `<span class="priority-badge active" style="margin-top: 4px;">⭐ Premium Priority</span>`;
    } else {
      queueBadgeHtml = `<span class="priority-badge standard" style="margin-top: 4px;">Standard Queue</span>`;
    }
  }

  statusCard.innerHTML = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
      <div>
        <h2>Analysis Console</h2>
        <p class="section-description">
          ShortParse is working through the report. This updates live while the job runs.
        </p>
      </div>
      <div>
        ${queueBadgeHtml}
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

  const guildDashboardCardEl = document.getElementById("guildDashboardCard");
  if (guildDashboardCardEl && isPatreonLinked) {
    guildDashboardCardEl.classList.remove("hidden");
  }
}

function resetToAnalyzeMode() {
  clearRenderedResults();

  currentJobId = null;
  currentShareUrl = "";

  analyzeCard().classList.remove("hidden");
  statusCard().classList.remove("hidden");
  headerActions().classList.add("hidden");
  
  toggleGuildHub(false); // Expand Guild Logs Hub when NOT looking at a report

  const guildDashboardCardEl = document.getElementById("guildDashboardCard");
  if (guildDashboardCardEl && isPatreonLinked) {
    guildDashboardCardEl.classList.remove("hidden");
  }

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

    if (selectedTab === "calibrator") {
      renderCalibratorTab(analysis.defensive_calibrator || {}, playerLookup);
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
    "F": "Needs Focus"
  };

  // ==========================================
  // DYNAMIC STAR PERFORMER SCANNER
  // ==========================================
  let mvpName = "—";
  let mvpValue = "";
  let mvpClass = "";
  let maxOutput = 0;

  let survivorName = "—";
  let survivorDamage = Infinity;
  let survivorClass = "";

  let mechMasterNames = [];
  let coachingFocusName = "—";
  let coachingFocusScore = 0;
  let coachingFocusClass = "";
  let coachingFocusIssue = "";

  const playerMetrics = analysis?.player_metrics || {};

  for (const [name, metric] of Object.entries(playerMetrics)) {
    const perf = metric.performance || {};
    const identity = metric.identity || {};
    const deaths = perf.deaths || 0;
    const role = identity.role;
    const output = role === "Healer" ? (perf.hps || 0) : (perf.dps || 0);

    // MVP: highest output among survivors
    if (deaths === 0) {
      if (output > maxOutput) {
        maxOutput = output;
        mvpName = name;
        mvpClass = identity.class;
        mvpValue = `${formatNumber(output)} ${role === "Healer" ? 'HPS' : 'DPS'}`;
      }
    }

    // Survival Star: lowest avoidable damage among survivors
    if (deaths === 0) {
      const avoidableDamage = perf.avoidable_damage_taken || 0;
      if (avoidableDamage < survivorDamage) {
        survivorDamage = avoidableDamage;
        survivorName = name;
        survivorClass = identity.class;
      }
    }

    // Mechanical Master: 0 avoidable hits
    const hits = perf.avoidable_hit_count || 0;
    if (hits === 0) {
      mechMasterNames.push(name);
    }
  }

  // Coaching Focus: first player in scorecard (highest issue score player)
  if (scorecard.length > 0) {
    const worst = scorecard[0];
    const metric = playerMetrics[worst.player] || {};
    const identity = metric.identity || {};
    coachingFocusName = worst.player;
    coachingFocusScore = worst.issue_score;
    coachingFocusClass = identity.class || "";
    coachingFocusIssue = worst.top_issue || "Standing in avoidable mechanics";
  }

  document.getElementById("tabContent").innerHTML = `
    <!-- Jargon-Free Glossary Banner -->
    <div class="glossary-banner" style="background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 24px; padding: 14px 20px; font-family: inherit;">
      <div id="glossaryToggle" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
        <span style="font-weight: 600; color: var(--blue); font-size: 14px; display: flex; align-items: center; gap: 8px;">
          📖 Understanding the Terms & Numbers (Jargon-Free Glossary)
        </span>
        <span id="glossaryChevron" style="font-size: 14px; opacity: 0.6; transition: transform 0.2s;">▶</span>
      </div>
      <div id="glossaryContent" style="display: none; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12.5px; line-height: 1.5;">
        <div>
          <strong style="color: #f1f5f9;">🛡️ Performance Level (Grade):</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">How well this player did compared to players worldwide wearing the **exact same gear level**. It rates output (damage/healing) and ignores unhelpful stats.</p>
        </div>
        <div>
          <strong style="color: #f1f5f9;">⚠️ Issue Penalty:</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">Points added when a player stands in avoidable damage, forgets to interrupt a spell, or dies early. **Lower is better (0 is perfect).**</p>
        </div>
        <div>
          <strong style="color: #f1f5f9;">🔥 DPS (Damage):</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">"Damage Per Second" — How fast this player hits the boss. Higher DPS means the boss dies faster before healers run out of mana.</p>
        </div>
        <div>
          <strong style="color: #f1f5f9;">💚 HPS (Healing):</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">"Healing Per Second" — How fast this player saves teammates from dying. We adjust this based on the healer size so it stays fair.</p>
        </div>
        <div>
          <strong style="color: #f1f5f9;">💥 Avoidable Damage (Mistakes):</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">Damage taken from standing in glowing ground fire, swirls, cones, or mechanics that are 100% dodgeable.</p>
        </div>
        <div>
          <strong style="color: #f1f5f9;">🌀 RSI (Raid Stress Index):</strong>
          <p style="color: var(--muted); margin: 4px 0 0 0;">Raid Stress Index. Measures how close your raid came to wiping based on unavoidable spikes and player positioning stress.</p>
        </div>
      </div>
    </div>

    <!-- Star Performer Trophies Shelf -->
    <h2 class="tab-panel-title" style="margin-top: 10px;">Encounter Performers & Star Awards</h2>
    <p class="tab-panel-description">Special visual trophies awarded to raid members who excelled in output or mechanics.</p>
    
    <div class="trophy-shelf" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 14px 0 28px 0;">
      <!-- MVP Card -->
      <div class="trophy-card" style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 12px; padding: 16px; text-align: center; position: relative; transition: transform 0.2s;">
        <div class="trophy-icon" style="font-size: 28px; margin-bottom: 8px;">🏆</div>
        <div class="trophy-title" style="font-size: 12px; text-transform: uppercase; color: var(--blue); font-weight: 700; letter-spacing: 0.05em;">Raid MVP</div>
        <div class="trophy-winner" style="font-size: 17px; font-weight: 700; margin: 6px 0; color: ${getClassColor(mvpClass) || '#fff'};">${escapeHtml(mvpName)}</div>
        <div class="trophy-sub" style="font-size: 11px; color: var(--muted);">${mvpName !== '—' ? `Survived with ${mvpValue}` : 'No survivors'}</div>
      </div>
      
      <!-- Survival Star Card -->
      <div class="trophy-card" style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.15); border-radius: 12px; padding: 16px; text-align: center; position: relative; transition: transform 0.2s;">
        <div class="trophy-icon" style="font-size: 28px; margin-bottom: 8px;">🛡️</div>
        <div class="trophy-title" style="font-size: 12px; text-transform: uppercase; color: var(--green); font-weight: 700; letter-spacing: 0.05em;">Survival Star</div>
        <div class="trophy-winner" style="font-size: 17px; font-weight: 700; margin: 6px 0; color: ${getClassColor(survivorClass) || '#fff'};">${escapeHtml(survivorName)}</div>
        <div class="trophy-sub" style="font-size: 11px; color: var(--muted);">${survivorName !== '—' ? `Cleanest run: ${formatNumber(survivorDamage)} avoidable dmg` : 'No survivors'}</div>
      </div>

      <!-- Mechanical Mastery Card -->
      <div class="trophy-card" style="background: rgba(234, 179, 8, 0.05); border: 1px solid rgba(234, 179, 8, 0.15); border-radius: 12px; padding: 16px; text-align: center; position: relative; transition: transform 0.2s;">
        <div class="trophy-icon" style="font-size: 28px; margin-bottom: 8px;">⚡</div>
        <div class="trophy-title" style="font-size: 12px; text-transform: uppercase; color: #eab308; font-weight: 700; letter-spacing: 0.05em;">Mechanical Master</div>
        <div class="trophy-winner" style="font-size: 17px; font-weight: 700; margin: 6px 0; color: #fff;">${mechMasterNames.length > 0 ? `${mechMasterNames.length} Players` : '—'}</div>
        <div class="trophy-sub" style="font-size: 11px; color: var(--muted);">${mechMasterNames.length > 0 ? 'Took 0 avoidable damage hits!' : 'Every player took avoidable damage'}</div>
      </div>

      <!-- Coaching Focus Card -->
      <div class="trophy-card" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 12px; padding: 16px; text-align: center; position: relative; transition: transform 0.2s;">
        <div class="trophy-icon" style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
        <div class="trophy-title" style="font-size: 12px; text-transform: uppercase; color: var(--red); font-weight: 700; letter-spacing: 0.05em;">Needs Coaching</div>
        <div class="trophy-winner" style="font-size: 17px; font-weight: 700; margin: 6px 0; color: ${getClassColor(coachingFocusClass) || '#fff'};">${escapeHtml(coachingFocusName)}</div>
        <div class="trophy-sub" style="font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Score: ${coachingFocusScore} • ${escapeHtml(coachingFocusIssue)}</div>
      </div>
    </div>

    <!-- Tactical Raid Coaching read columns -->
    <div class="raid-coach-grid-cols" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 28px;">
      <!-- Raid Coach Quick Read -->
      <div class="coaching-column-card" style="background: rgba(30, 41, 59, 0.15); border: 1px solid var(--border); border-radius: 12px; padding: 18px;">
        <h3 style="font-size: 14.5px; margin-top: 0; margin-bottom: 12px; color: var(--blue); font-weight: 600; display: flex; align-items: center; gap: 8px;">📋 Tactical Coaching Read</h3>
        <p style="font-size: 13px; line-height: 1.6; color: #f1f5f9; margin-bottom: 14px;">
          ${escapeHtml(analysis.raid_coach?.overall_read || "No overall coaching summary generated yet.")}
        </p>
        <ul style="padding-left: 20px; font-size: 12.5px; color: var(--muted); line-height: 1.8; margin-bottom: 0;">
          ${(analysis.raid_coach?.top_priorities || []).slice(0, 3).map(p => `
            <li style="margin-bottom: 6px;">${escapeHtml(p)}</li>
          `).join("")}
        </ul>
      </div>

      <!-- Action Items Checklist -->
      <div class="coaching-column-card" style="background: rgba(30, 41, 59, 0.15); border: 1px solid var(--border); border-radius: 12px; padding: 18px;">
        <h3 style="font-size: 14.5px; margin-top: 0; margin-bottom: 12px; color: var(--orange); font-weight: 600; display: flex; align-items: center; gap: 8px;">🎯 Pull Focus & Recommendations</h3>
        <ul style="padding-left: 20px; font-size: 12.5px; color: #f1f5f9; line-height: 1.8; margin-bottom: 0;">
          ${(analysis.raid_coach?.next_pull_focus || []).map(focus => `
            <li style="margin-bottom: 8px; list-style-type: '🔸 ';">${escapeHtml(focus)}</li>
          `).join("")}
        </ul>
      </div>
    </div>

    <!-- Scorecard Roster Table Section -->
    <h2 class="tab-panel-title">Roster Performance Scorecard</h2>
    <p class="tab-panel-description">Roster review sorted by primary coaching priority (highest issue score first). Click a name to open their personal Coach Drawer.</p>

    <div class="table-wrapper" style="margin-top: 14px;">
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

            const displayGrade = gradeMap[row.grade] || row.grade || "Needs Focus";

            return `
              <tr>
                <td>
                  <button type="button" class="player-name-coaching-trigger" onclick="showPlayerCoachCard('${escapeHtml(row.player)}')" style="background: none; border: none; font-weight: 600; color: ${getClassColor(player.className) || '#fff'}; cursor: pointer; text-align: left; padding: 0; font-family: inherit; font-size: inherit; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.15);">
                    ${escapeHtml(row.player)}
                  </button>
                </td>
                <td>${escapeHtml(player.className || "Unknown")}</td>
                <td>${escapeHtml(player.spec || "Unknown")}</td>
                <td>${escapeHtml(player.role || "Unknown")}</td>
                <td>${deathsCell}</td>
                <td><span class="pill grade-${escapeHtml(row.grade)}">${escapeHtml(displayGrade)}</span></td>
                <td>${escapeHtml(row.issue_score)}</td>
                <td>${escapeHtml(row.major_count)}</td>
                <td>${escapeHtml(row.warning_count)}</td>
                <td>${escapeHtml(row.top_issue || "None")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Attach interactive glossary toggle handler
  setTimeout(() => {
    const toggle = document.getElementById("glossaryToggle");
    const content = document.getElementById("glossaryContent");
    const chevron = document.getElementById("glossaryChevron");
    if (toggle && content && chevron) {
      toggle.addEventListener("click", () => {
        const isHidden = content.style.display === "none" || content.style.display === "";
        content.style.display = isHidden ? "grid" : "none";
        chevron.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
        toggle.style.background = isHidden ? "rgba(255,255,255,0.02)" : "none";
      });
    }
  }, 50);
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

  // Co-Healer Synergy carry checks
  let maxOtherHealerName = "";
  let maxOtherHealerHps = 0;
  if (role === "Healer") {
    for (const [pName, pVal] of Object.entries(playerMetrics)) {
      if (pName !== selectedPlayerName && pVal.identity?.role === "Healer") {
        const hps = pVal.performance?.hps || 0;
        if (hps > maxOtherHealerHps) {
          maxOtherHealerHps = hps;
          maxOtherHealerName = pName;
        }
      }
    }
  }
  const isCoHealerCarry = role === "Healer" && maxOtherHealerHps > playerValue * 1.35;

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
          ${isCoHealerCarry ? `
            <div class="cohealer-synergy-panel">
              🤝 <strong>Co-Healer Synergy Active:</strong> Co-healer ${escapeHtml(maxOtherHealerName)} absorbed exceptionally high throughput (${formatNumber(maxOtherHealerHps)} HPS) in this fight, naturally limiting your healing opportunities. Your HPS reflects solid coordination, survival focus, and mana efficiency!
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

function renderIssueActionItemMarkup(issue) {
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
}

window.toggleRotationalGapTooltip = function(event) {
  event.stopPropagation();
  const box = document.getElementById("rotationalGapTooltip");
  if (box) {
    box.classList.toggle("hidden");
  }
};

function showPlayerCoachCard(playerName) {
  if (!currentReportData) return;
  const analysis = currentReportData.analyses[selectedAnalysisIndex];
  if (!analysis) return;

  currentCoachPlayerName = playerName;

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
    "F": "Needs Focus",
    "-": "Needs Focus"
  };
  const displayGrade = gradeMap[grade] || grade;

  const gradeEl = document.getElementById("coachPlayerGrade");
  if (gradeEl) {
    gradeEl.textContent = displayGrade;
    if (displayGrade.length > 5) {
      gradeEl.style.fontSize = "11.5px";
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

    const badgeEl = document.getElementById("coachGradeBadge");
    if (badgeEl) {
      badgeEl.style.borderColor = gradeColor + "40"; // 25% opacity border
      badgeEl.style.boxShadow = `0 0 16px ${gradeColor}1c, 0 4px 12px rgba(0, 0, 0, 0.25)`;
    }
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

  // "Hide Warnings" Toggle Calibration
  const hideWarnings = document.getElementById("coachHideWarningsToggle")?.checked || false;
  if (hideWarnings) {
    playerIssues = playerIssues.filter(issue => issue.severity === "Critical" || issue.severity === "Major");
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
      // Hide collapsible controls
      const toggleBtn = document.getElementById("toggleAllIssuesBtn");
      const expandedDiv = document.getElementById("coachExpandedIssues");
      if (toggleBtn) toggleBtn.classList.add("hidden");
      if (expandedDiv) {
        expandedDiv.classList.add("hidden");
        expandedDiv.innerHTML = "";
      }
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
      coachActionItems.innerHTML = topIssues.map(issue => renderIssueActionItemMarkup(issue)).join("");

      // Collapsible Expander implementation
      const toggleBtn = document.getElementById("toggleAllIssuesBtn");
      const expandedDiv = document.getElementById("coachExpandedIssues");
      if (toggleBtn && expandedDiv) {
        if (sortedIssues.length > 3) {
          toggleBtn.classList.remove("hidden");
          toggleBtn.textContent = `Show All Detected Issues (+${sortedIssues.length - 3})`;
          
          toggleBtn.onclick = function() {
            const isHidden = expandedDiv.classList.contains("hidden");
            if (isHidden) {
              expandedDiv.classList.remove("hidden");
              toggleBtn.textContent = "Hide Extra Issues";
            } else {
              expandedDiv.classList.add("hidden");
              toggleBtn.textContent = `Show All Detected Issues (+${sortedIssues.length - 3})`;
            }
          };
          
          expandedDiv.classList.add("hidden");
          expandedDiv.innerHTML = sortedIssues.slice(3).map(issue => renderIssueActionItemMarkup(issue)).join("");
        } else {
          toggleBtn.classList.add("hidden");
          expandedDiv.classList.add("hidden");
          expandedDiv.innerHTML = "";
        }
      }
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
      <div class="coach-inactivity-wrapper" style="position: relative;">
        <div class="coach-inactivity-header">
          <span class="coach-inactivity-title" style="color: var(--muted); display: inline-flex; align-items: center;">
            Casting Activity
            <span class="coaching-tooltip-icon" onclick="toggleRotationalGapTooltip(event)">ℹ</span>
          </span>
          <strong style="font-size: 14px; font-family: monospace;">${adjustedUptimePct.toFixed(1)}% ${gapsFilteredCount > 0 ? `<span style="font-size: 10px; color: var(--blue);">(Calibrated)</span>` : ""}</strong>
        </div>
        <div id="rotationalGapTooltip" class="coaching-tooltip-box hidden" style="position: absolute; z-index: 100; left: 0; right: 0; top: 30px;">
          <strong>What are Rotational Gaps?</strong><br>
          ShortParse tracks a gap whenever you go <strong>5+ seconds</strong> without casting any spells (offensive, defensive, or utility). Global intermissions are automatically calibrated out.
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
      isPremium = user.is_premium || false;
      premiumTier = user.premium_tier || null;
      isPatreonLinked = user.is_patreon_linked || false;
      priorityQueueEnabled = user.priority_queue_enabled || false;

      const firstLetter = user.username ? user.username.charAt(0) : "U";
      const tierLabel = isPremium ? (premiumTier || "Premium") : "Free Account";
      const tierClass = isPremium ? "premium" : "free";

      currentUserWebhook = user.discord_webhook_url || "";
      currentUserAutoPost = user.discord_auto_post || false;
      updateDiscordWebhookUI();

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
      
      const primaryNavbar = document.getElementById("primaryNavbar");
      if (primaryNavbar) primaryNavbar.classList.remove("hidden");
      
      loadGuildDashboard();
    } else {
      renderLoginButton();
      hideGuildDashboard();
      
      const primaryNavbar = document.getElementById("primaryNavbar");
      if (primaryNavbar) primaryNavbar.classList.add("hidden");
    }
  } catch (error) {
    console.error("Failed to query user authentication status:", error);
    renderLoginButton();
    hideGuildDashboard();
    
    const primaryNavbar = document.getElementById("primaryNavbar");
    if (primaryNavbar) primaryNavbar.classList.add("hidden");
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

function updateDiscordWebhookUI() {
  const controls = document.getElementById("discordWebhookControls");
  const premiumLock = document.getElementById("discordWebhookPremiumLock");
  const postDiscordBtn = document.getElementById("postDiscordButton");

  if (isPremium) {
    if (controls) controls.classList.remove("hidden");
    if (premiumLock) premiumLock.classList.add("hidden");
    if (postDiscordBtn) {
      postDiscordBtn.textContent = "Post to Discord";
      postDiscordBtn.classList.remove("premium-locked");
    }
  } else {
    if (controls) controls.classList.add("hidden");
    if (premiumLock) premiumLock.classList.remove("hidden");
    if (postDiscordBtn) {
      postDiscordBtn.textContent = "Post to Discord 🔒";
      postDiscordBtn.classList.add("premium-locked");
    }
  }
}

function openSettingsDrawer() {
  const drawer = document.getElementById("settingsDrawer");
  const webhookInput = document.getElementById("discordWebhookInput");
  const statusMsg = document.getElementById("webhookStatusMessage");

  if (!drawer) return;

  if (webhookInput) {
    webhookInput.value = currentUserWebhook;
  }

  const autoPostToggle = document.getElementById("discordAutoPostToggle");
  if (autoPostToggle) {
    autoPostToggle.checked = currentUserAutoPost;
  }

  if (statusMsg) {
    statusMsg.classList.add("hidden");
    statusMsg.className = "";
  }

  updateDiscordWebhookUI();

  // Toggle settings priority queue promo card
  const promoCard = document.getElementById("priorityQueuePromoCard");
  if (promoCard) {
    if (priorityQueueEnabled && !isPremium) {
      promoCard.classList.remove("hidden");
    } else {
      promoCard.classList.add("hidden");
    }
  }

  // Update Patreon integration UI elements
  const unlinkedBlock = document.getElementById("patreonUnlinkedBlock");
  const linkedBlock = document.getElementById("patreonLinkedBlock");
  const tierBadge = document.getElementById("patreonTierBadge");
  const accountName = document.getElementById("patreonAccountName");
  const patreonStatusMsg = document.getElementById("patreonStatusMessage");

  if (patreonStatusMsg) {
    patreonStatusMsg.classList.add("hidden");
    patreonStatusMsg.className = "";
  }

  if (unlinkedBlock && linkedBlock) {
    if (isPatreonLinked) {
      unlinkedBlock.classList.add("hidden");
      linkedBlock.classList.remove("hidden");
      if (tierBadge) {
        tierBadge.textContent = isPremium ? `${premiumTier || "Premium Patron"}` : "Patreon Connected";
        tierBadge.parentElement.style.background = isPremium ? "rgba(74, 222, 128, 0.08)" : "rgba(251, 113, 133, 0.08)";
        tierBadge.parentElement.style.borderColor = isPremium ? "rgba(74, 222, 128, 0.3)" : "rgba(251, 113, 133, 0.3)";
        tierBadge.style.color = isPremium ? "var(--green)" : "var(--red)";
      }
      if (accountName) {
        accountName.textContent = isPremium ? "ShortParse Premium tier active! ⭐" : "Patreon linked, but no active campaign tier detected.";
      }
    } else {
      unlinkedBlock.classList.remove("hidden");
      linkedBlock.classList.add("hidden");
    }
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
  const autoPostToggle = document.getElementById("discordAutoPostToggle");
  const autoPost = autoPostToggle ? autoPostToggle.checked : false;

  statusMsg.classList.add("hidden");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch("/api/auth/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        discord_webhook_url: url || null,
        discord_auto_post: autoPost
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to update webhook settings.");
    }

    const data = await response.json();
    currentUserWebhook = data.discord_webhook_url || "";
    currentUserAutoPost = data.discord_auto_post || false;
    webhookInput.value = currentUserWebhook;
    if (autoPostToggle) {
      autoPostToggle.checked = currentUserAutoPost;
    }

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

async function syncPatreonSubscription() {
  const syncBtn = document.getElementById("syncPatreonButton");
  const statusMsg = document.getElementById("patreonStatusMessage");
  const tierBadge = document.getElementById("patreonTierBadge");
  const accountName = document.getElementById("patreonAccountName");

  if (!syncBtn || !statusMsg) return;

  syncBtn.disabled = true;
  syncBtn.textContent = "Syncing...";
  statusMsg.classList.add("hidden");

  try {
    const response = await fetch("/api/auth/patreon/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to synchronize Patreon status.");
    }

    const data = await response.json();
    isPremium = data.is_premium;
    premiumTier = data.premium_tier;
    priorityQueueEnabled = data.priority_queue_enabled || false;
    updateDiscordWebhookUI();

    // Toggle settings priority queue promo card
    const promoCard = document.getElementById("priorityQueuePromoCard");
    if (promoCard) {
      if (priorityQueueEnabled && !isPremium) {
        promoCard.classList.remove("hidden");
      } else {
        promoCard.classList.add("hidden");
      }
    }

    if (tierBadge) {
      tierBadge.textContent = isPremium ? `${premiumTier || "Premium Patron"}` : "Patreon Connected";
      tierBadge.parentElement.style.background = isPremium ? "rgba(74, 222, 128, 0.08)" : "rgba(251, 113, 133, 0.08)";
      tierBadge.parentElement.style.borderColor = isPremium ? "rgba(74, 222, 128, 0.3)" : "rgba(251, 113, 133, 0.3)";
      tierBadge.style.color = isPremium ? "var(--green)" : "var(--red)";
    }
    
    if (accountName) {
      accountName.textContent = isPremium ? "ShortParse Premium tier active! ⭐" : "Patreon linked, but no active campaign tier detected.";
    }

    statusMsg.textContent = "Subscription synced successfully!";
    statusMsg.className = "status-msg-success";
    statusMsg.classList.remove("hidden");

    // Also update main user profile widget
    const userTierWidget = document.querySelector(".user-profile-widget .user-tier");
    if (userTierWidget) {
      userTierWidget.textContent = isPremium ? (premiumTier || "Premium") : "Free Account";
      userTierWidget.className = `user-tier ${isPremium ? "" : "free"}`;
    }
  } catch (error) {
    statusMsg.textContent = error.message;
    statusMsg.className = "status-msg-error";
    statusMsg.classList.remove("hidden");
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync";
  }
}

async function postActiveReportToDiscord() {
  const postBtn = document.getElementById("postDiscordButton");
  if (!postBtn || !currentJobId) return;

  if (!isPremium) {
    alert("⭐ Discord Webhook integration is a Premium feature. Support us on Patreon to automatically dispatch high-fidelity raid summaries directly to your guild channels!");
    openSettingsDrawer();
    const patreonSection = document.getElementById("patreonUnlinkedBlock") || document.getElementById("patreonLinkedBlock");
    if (patreonSection) {
      setTimeout(() => patreonSection.scrollIntoView({ behavior: "smooth" }), 350);
    }
    return;
  }

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
      postBtn.textContent = isPremium ? "Post to Discord" : "Post to Discord 🔒";
      postBtn.style.background = "";
      postBtn.style.color = "";
    }, 2500);
  } catch (error) {
    alert(`Failed to share to Discord: ${error.message}`);
    postBtn.disabled = false;
    postBtn.textContent = isPremium ? "Post to Discord" : "Post to Discord 🔒";
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


function renderCalibratorTab(calibrator, playerLookup) {
  const timeline = calibrator.timeline || [];
  const spikes = calibrator.spikes || [];
  const casts = calibrator.casts || [];

  if (!timeline.length) {
    renderEmptyTab("Defensive Calibrator", "No raid-wide damage data available to calibrate.");
    return;
  }

  const duration = timeline.length;
  const maxVal = Math.max(...timeline, 200000);

  const width = 1000;
  const height = 280;
  const margin = { top: 30, right: 30, bottom: 40, left: 60 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  // 1. Calculate SVG Line Coordinates
  const points = [];
  for (let t = 0; t < timeline.length; t++) {
    const val = timeline[t];
    const x = margin.left + (t / duration) * graphWidth;
    const y = height - margin.bottom - (val / maxVal) * graphHeight;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const pointsStr = points.join(" ");

  // 2. Generate Shaded Cooldown Areas
  const cdAreas = casts.map(cast => {
    const startX = margin.left + (cast.start_seconds / duration) * graphWidth;
    const endX = margin.left + ((cast.start_seconds + cast.duration) / duration) * graphWidth;
    const w = Math.max(2, endX - startX);

    return `
      <rect x="${startX}" y="${margin.top}" width="${w}" height="${graphHeight}" class="calibrator-svg-cd-rect" />
      <text x="${startX + 4}" y="${margin.top + 14}" class="calibrator-svg-cd-text">${escapeHtml(cast.spell_name)}</text>
    `;
  }).join("");

  // 3. Generate Spike Nodes
  const spikeNodes = spikes.map(spike => {
    const x = margin.left + (spike.seconds / duration) * graphWidth;
    const val = timeline[spike.seconds] || 0;
    const y = height - margin.bottom - (val / maxVal) * graphHeight;

    const colorClass = spike.covered ? "covered" : "unmitigated";
    const icon = spike.covered ? "🛡️" : "⚠️";

    return `
      <g class="calibrator-svg-spike-group" style="cursor: pointer;" onmouseenter="showCalibratorSpikeTooltip(event, '${escapeHtml(spike.time)}', '${escapeHtml(spike.spell_name)}', ${spike.amount}, ${spike.covered})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
        <circle cx="${x}" cy="${y}" r="12" class="calibrator-svg-spike-circle ${colorClass}" />
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11px">${icon}</text>
      </g>
    `;
  }).join("");

  // 4. Generate Y-axis labels (Ticks)
  const yTicks = [];
  const numYTicks = 5;
  for (let i = 0; i <= numYTicks; i++) {
    const val = (maxVal / numYTicks) * i;
    const y = height - margin.bottom - (val / maxVal) * graphHeight;
    const label = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}k`;
    yTicks.push(`
      <line x1="${margin.left - 6}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="var(--border)" stroke-width="1.5" />
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.02)" stroke-dasharray="4 4" />
      <text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" class="calibrator-svg-tick-text">${label}</text>
    `);
  }

  // 5. Generate X-axis time labels (Ticks)
  const xTicks = [];
  const numXTicks = 6;
  for (let i = 0; i <= numXTicks; i++) {
    const elapsedSeconds = (duration / numXTicks) * i;
    const pct = elapsedSeconds / duration;
    const x = margin.left + pct * graphWidth;

    const mins = Math.floor(elapsedSeconds / 60);
    const secs = Math.floor(elapsedSeconds % 60);
    const label = `${mins}:${String(secs).padStart(2, "0")}`;

    xTicks.push(`
      <line x1="${x}" y1="${height - margin.bottom}" x2="${x}" y2="${height - margin.bottom + 6}" stroke="var(--border)" stroke-width="1.5" />
      <text x="${x}" y="${height - margin.bottom + 20}" text-anchor="middle" class="calibrator-svg-tick-text">${label}</text>
    `);
  }

  // 6. Split Spikes into Covered and Unmitigated lists for dynamic Cards layout
  const coveredSpikes = spikes.filter(s => s.covered);
  const unmitigatedSpikes = spikes.filter(s => !s.covered);

  const coveredHtml = coveredSpikes.length === 0 
    ? `<div class="calibrator-empty-card">No covered spikes recorded.</div>`
    : coveredSpikes.map(spike => {
        const cdList = spike.active_cooldowns.map(cd => `<strong>${escapeHtml(cd.player)}</strong> (${escapeHtml(cd.spell_name)})`).join(", ");
        return `
          <div class="calibrator-spike-card covered">
            <div class="card-icon">🛡️</div>
            <div class="card-body">
              <div class="card-meta">${escapeHtml(spike.time)} · COVERED SPIKE</div>
              <div class="card-title">${escapeHtml(spike.spell_name)}</div>
              <div class="card-desc">Mitigated successfully by: ${cdList}.</div>
              <div class="card-amount">+${formatNumber(spike.amount)} raw damage</div>
            </div>
          </div>
        `;
      }).join("");

  const unmitigatedHtml = unmitigatedSpikes.length === 0
    ? `
      <div class="calibrator-perfect-mitigation">
        <div class="perfect-icon">👑</div>
        <div class="perfect-title">Perfect Defensive Coverage!</div>
        <div class="perfect-desc">Sensational execution! Every single massive damage spike during this encounter was mitigated by at least one major defensive cooldown.</div>
      </div>
    `
    : unmitigatedSpikes.map(spike => {
        return `
          <div class="calibrator-spike-card unmitigated">
            <div class="card-icon">⚠️</div>
            <div class="card-body">
              <div class="card-meta">${escapeHtml(spike.time)} · UNMITIGATED SPIKE</div>
              <div class="card-title">${escapeHtml(spike.spell_name)}</div>
              <div class="card-desc">Zero healer or tank raid defensive cooldowns were active during this peak damage window!</div>
              <div class="card-amount">${formatNumber(spike.amount)} unmitigated damage</div>
            </div>
          </div>
        `;
      }).join("");

  document.getElementById("tabContent").innerHTML = `
    <h2 class="tab-panel-title">Zero-Downtime Defensive Calibrator</h2>
    <p class="tab-panel-description">
      Cross-references boss damage spikes with healer/tank raid defensive CD windows. Review active coverage (shaded bands) and identify critical gaps.
    </p>

    <!-- Calibrator SVG chart -->
    <div class="calibrator-chart-card">
      <div class="calibrator-chart-title">Raid Damage & Cooldown Overlay Timeline</div>
      <div class="calibrator-svg-container">
        <svg viewBox="0 0 ${width} ${height}" class="calibrator-svg">
          <!-- X & Y Axes -->
          <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="var(--border)" stroke-width="1.5" />
          <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="var(--border)" stroke-width="1.5" />

          ${cdAreas}
          ${yTicks}
          ${xTicks}

          <!-- Damage Line Path -->
          <polyline fill="none" stroke="url(#calibratorGlow)" stroke-width="2.5" points="${pointsStr}" />
          ${spikeNodes}

          <!-- Glowing Line Gradient -->
          <defs>
            <linearGradient id="calibratorGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="var(--blue)" />
              <stop offset="50%" stop-color="#a855f7" />
              <stop offset="100%" stop-color="var(--red)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>

    <!-- Covered and Unmitigated Grid columns -->
    <div class="calibrator-grid">
      <!-- Unmitigated Spikes (Raid concerns) -->
      <div class="calibrator-column warning-col">
        <h3 class="column-title">⚠️ Mitigation Gaps (Critical Gaps)</h3>
        <p class="column-desc">Spikes where the raid took heavy damage with no major defensives running. Plan cooldowns here.</p>
        <div class="calibrator-cards-list">
          ${unmitigatedHtml}
        </div>
      </div>

      <!-- Covered Spikes -->
      <div class="calibrator-column success-col">
        <h3 class="column-title">🛡️ Successful Mitigations</h3>
        <p class="column-desc">Raid damage spikes that were correctly covered by healer/tank defensive rotations.</p>
        <div class="calibrator-cards-list">
          ${coveredHtml}
        </div>
      </div>
    </div>
  `;
}

window.showCalibratorSpikeTooltip = (e, time, spellName, amount, covered) => {
  const title = `${time} · ${covered ? "🛡️ Covered Spike" : "⚠️ Mitigation Gap"}`;
  const fields = [
    { label: "Boss Ability", value: spellName },
    { label: "Raid Damage Taken", value: `${formatNumber(amount)} total` },
    { label: "Coverage Status", value: covered ? "🛡️ Mitigated successfully" : "❌ Zero active raid defensives" }
  ];
  showTooltip(e, title, fields);
};

/* ==============================================================================
   Patreon Premium Guild Suite - Phase 2 Frontend Core Features
   ============================================================================== */
let currentGuildOverviewData = null;
let plottedPlayers = [];

function switchToPersonalAnalyzer() {
  const guildSuiteCard = document.getElementById("guildSuiteCard");
  if (guildSuiteCard) guildSuiteCard.classList.add("hidden");
  
  document.getElementById("analyzeCard").classList.remove("hidden");
  document.getElementById("statusCard").classList.remove("hidden");
  
  const dashboardCard = document.getElementById("guildDashboardCard");
  if (dashboardCard && isPatreonLinked) {
    dashboardCard.classList.remove("hidden");
  }
  
  if (currentJobId) {
    const resultCard = document.getElementById("resultCard");
    const bossTilesCard = document.getElementById("bossTilesCard");
    const detailsCard = document.getElementById("detailsCard");
    if (resultCard) resultCard.classList.remove("hidden");
    if (bossTilesCard) bossTilesCard.classList.remove("hidden");
    if (detailsCard) detailsCard.classList.remove("hidden");
  }
  
  const personalBtn = document.getElementById("navPersonalBtn");
  const guildBtn = document.getElementById("navGuildSuiteBtn");
  if (personalBtn) personalBtn.classList.add("active");
  if (guildBtn) guildBtn.classList.remove("active");
  
  if (window.location.pathname === "/guild") {
    window.history.pushState(null, "", "/");
  }
}

async function switchToGuildSuite() {
  document.getElementById("analyzeCard").classList.add("hidden");
  document.getElementById("statusCard").classList.add("hidden");
  
  const dashboardCard = document.getElementById("guildDashboardCard");
  if (dashboardCard) dashboardCard.classList.add("hidden");
  
  const resultCard = document.getElementById("resultCard");
  const bossTilesCard = document.getElementById("bossTilesCard");
  const detailsCard = document.getElementById("detailsCard");
  const builderCard = document.getElementById("builderCard");
  
  if (resultCard) resultCard.classList.add("hidden");
  if (bossTilesCard) bossTilesCard.classList.add("hidden");
  if (detailsCard) detailsCard.classList.add("hidden");
  if (builderCard) builderCard.classList.add("hidden");
  
  const guildSuiteCard = document.getElementById("guildSuiteCard");
  if (guildSuiteCard) guildSuiteCard.classList.remove("hidden");
  
  const personalBtn = document.getElementById("navPersonalBtn");
  const guildBtn = document.getElementById("navGuildSuiteBtn");
  if (personalBtn) personalBtn.classList.remove("active");
  if (guildBtn) guildBtn.classList.add("active");
  
  window.history.pushState(null, "", "/guild");
  
  await loadGuildSuiteOverview();
}

async function loadGuildSuiteOverview() {
  const statsFights = document.getElementById("guildSuiteTotalFights");
  const statsAvoidable = document.getElementById("guildSuiteAvgAvoidable");
  const lockScreen = document.getElementById("guildSuitePremiumLock");
  const contentArea = document.getElementById("guildSuiteContentArea");
  
  if (statsFights) statsFights.innerText = "...";
  if (statsAvoidable) statsAvoidable.innerText = "...";
  
  try {
    const response = await fetch("/api/guild/overview");
    
    if (response.status === 401 || response.status === 403) {
      if (lockScreen) lockScreen.classList.remove("hidden");
      if (contentArea) contentArea.classList.add("premium-blur");
      
      const mockPlayers = {
        "TankyMcTank": { spec: "Protection", role: "Tank", fights_count: 8, avg_grade: "S", avg_avoidable_damage: 2500, avg_dps: 18000, avg_hps: 4000, total_deaths: 0, survival_score: 98, panic_healthstone_pct: 100, gold_debt: 0, class: "Warrior" },
        "DpsGoBrrr": { spec: "Fire", role: "DPS", fights_count: 8, avg_grade: "B", avg_avoidable_damage: 48000, avg_dps: 94000, avg_hps: 0, total_deaths: 3, survival_score: 72, panic_healthstone_pct: 33, gold_debt: 4, class: "Mage" },
        "SwirlyCatcher": { spec: "Shadow", role: "DPS", fights_count: 8, avg_grade: "D", avg_avoidable_damage: 185000, avg_dps: 55000, avg_hps: 0, total_deaths: 7, survival_score: 25, panic_healthstone_pct: 0, gold_debt: 18, class: "Priest" },
        "GreenBeamEnjoyer": { spec: "Restoration", role: "Healer", fights_count: 8, avg_grade: "A", avg_avoidable_damage: 18000, avg_dps: 2000, avg_hps: 82000, total_deaths: 1, survival_score: 92, panic_healthstone_pct: 100, gold_debt: 1, class: "Druid" }
      };
      const mockBuffs = {
        active: ["Battle Shout (5% Attack Power)", "Arcane Intellect (5% Intellect)", "Mark of the Wild (3% Versatility)"],
        missing: ["Chaos Brand", "Mystic Touch", "Power Word: Fortitude"],
        suggestions: [
          { class: "Demon Hunter", benefit: "Chaos Brand which increases roster magic damage taken by 5%." }
        ]
      };
      const mockWipeAnalytics = {
        "Midnight Falls": {
          "total_wipes": 12,
          "avg_boss_hp": 48.5,
          "phase_distribution": {
            "Phase 1": 2,
            "Phase 2": 8,
            "Phase 3": 2
          },
          "hp_distribution": {
            "100_80": 2,
            "80_50": 3,
            "50_20": 5,
            "20_0": 2
          },
          "catalyst_players": [
            { "player": "SwirlyCatcher", "count": 5, "class": "Priest" },
            { "player": "DpsGoBrrr", "count": 3, "class": "Mage" },
            { "player": "TankyMcTank", "count": 1, "class": "Warrior" }
          ],
          "catalyst_abilities": [
            { "ability": "Void Eruption", "count": 6 },
            { "ability": "Shadow Spike", "count": 4 }
          ],
          "death_timestamps": [48, 92, 115, 120, 142, 180, 210, 245]
        },
        "The Voidspire": {
          "total_wipes": 6,
          "avg_boss_hp": 32.4,
          "phase_distribution": {
            "Phase 1": 1,
            "Phase 2": 2,
            "Phase 3": 3
          },
          "hp_distribution": {
            "100_80": 1,
            "80_50": 1,
            "50_20": 2,
            "20_0": 2
          },
          "catalyst_players": [
            { "player": "DpsGoBrrr", "count": 3, "class": "Mage" },
            { "player": "SwirlyCatcher", "count": 2, "class": "Priest" }
          ],
          "catalyst_abilities": [
            { "ability": "Void Eruption", "count": 4 },
            { "ability": "Ground Smash", "count": 2 }
          ],
          "death_timestamps": [60, 110, 150, 195, 230]
        }
      };
      
      if (statsFights) statsFights.innerText = "8";
      if (statsAvoidable) statsAvoidable.innerText = "52,400";
      
      const mockFights = [
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 285000, avg_grade: "D", created_at: 1716800000000, duration_seconds: 180 },
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 242000, avg_grade: "D", created_at: 1716801000000, duration_seconds: 210 },
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 195000, avg_grade: "C", created_at: 1716802000000, duration_seconds: 240 },
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 168000, avg_grade: "C", created_at: 1716803000000, duration_seconds: 220 },
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 120000, avg_grade: "B", created_at: 1716804000000, duration_seconds: 260 },
        { boss_name: "Midnight Falls", is_kill: false, avoidable_damage: 98000, avg_grade: "B", created_at: 1716805000000, duration_seconds: 250 },
        { boss_name: "Midnight Falls", is_kill: true, avoidable_damage: 42000, avg_grade: "A", created_at: 1716806000000, duration_seconds: 242 },
        { boss_name: "The Voidspire", is_kill: false, avoidable_damage: 310000, avg_grade: "F", created_at: 1716807000000, duration_seconds: 140 },
        { boss_name: "The Voidspire", is_kill: false, avoidable_damage: 220000, avg_grade: "D", created_at: 1716808000000, duration_seconds: 195 },
        { boss_name: "The Voidspire", is_kill: false, avoidable_damage: 180000, avg_grade: "C", created_at: 1716809000000, duration_seconds: 230 },
        { boss_name: "The Voidspire", is_kill: true, avoidable_damage: 55000, avg_grade: "A", created_at: 1716810000000, duration_seconds: 214 }
      ];

      drawRosterMatrix(mockPlayers);
      drawTrendsChart(mockFights);
      renderBuffSynergy(mockBuffs);
      renderPanicAudit(mockPlayers);
      renderGoldLedger(mockPlayers);
      renderWipeDiagnoser(mockWipeAnalytics);
      return;
    }
    
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }
    
    const data = await response.json();
    currentGuildOverviewData = data;
    
    if (lockScreen) lockScreen.classList.add("hidden");
    if (contentArea) contentArea.classList.remove("premium-blur");
    
    if (statsFights) statsFights.innerText = data.guild_averages.total_fights_analyzed.toString();
    if (statsAvoidable) statsAvoidable.innerText = formatNumber(data.guild_averages.average_avoidable_damage);
    
    drawRosterMatrix(data.players_history || {});
    drawTrendsChart(data.fights_history || []);
    renderBuffSynergy(data.synergy_buffs || { active: [], missing: [], suggestions: [] });
    renderPanicAudit(data.players_history || {});
    renderGoldLedger(data.players_history || {});
    renderWipeDiagnoser(data.wipe_analytics || {});
    
  } catch (error) {
    console.error("Failed to load premium Guild Suite overview:", error);
    if (statsFights) statsFights.innerText = "Error";
    if (statsAvoidable) statsAvoidable.innerText = "Error";
  }
}

function drawRosterMatrix(players) {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 400 * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = 400;
  
  ctx.clearRect(0, 0, width, height);
  
  const margin = { top: 40, right: 40, bottom: 50, left: 60 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;
  
  ctx.fillStyle = "rgba(59, 130, 246, 0.02)";
  ctx.fillRect(margin.left, margin.top, graphWidth / 2, graphHeight / 2);
  
  ctx.fillStyle = "rgba(52, 211, 153, 0.02)";
  ctx.fillRect(margin.left + graphWidth / 2, margin.top, graphWidth / 2, graphHeight / 2);
  
  ctx.fillStyle = "rgba(248, 113, 113, 0.02)";
  ctx.fillRect(margin.left, margin.top + graphHeight / 2, graphWidth / 2, graphHeight / 2);
  
  ctx.fillStyle = "rgba(251, 191, 36, 0.02)";
  ctx.fillRect(margin.left + graphWidth / 2, margin.top + graphHeight / 2, graphWidth / 2, graphHeight / 2);
  
  ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 4; i++) {
    const yVal = i * 25;
    const yPix = margin.top + graphHeight - (yVal / 100) * graphHeight;
    ctx.beginPath();
    ctx.moveTo(margin.left, yPix);
    ctx.lineTo(margin.left + graphWidth, yPix);
    ctx.stroke();
    
    ctx.fillStyle = "var(--muted)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(yVal + "%", margin.left - 10, yPix + 3);
  }
  
  for (let i = 0; i <= 4; i++) {
    const xVal = i * 25;
    const xPix = margin.left + (xVal / 100) * graphWidth;
    ctx.beginPath();
    ctx.moveTo(xPix, margin.top);
    ctx.lineTo(xPix, margin.top + graphHeight);
    ctx.stroke();
    
    ctx.fillStyle = "var(--muted)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xVal + "%", xPix, margin.top + graphHeight + 16);
  }
  
  ctx.fillStyle = "var(--muted)";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Active Output Rate (Relative DPS/HPS)", margin.left + graphWidth / 2, margin.top + graphHeight + 36);
  
  ctx.save();
  ctx.translate(16, margin.top + graphHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Mechanics Dodged (Survival Score)", 0, 0);
  ctx.restore();
  
  ctx.font = "bold 10px sans-serif";
  ctx.textBaseline = "top";
  
  ctx.fillStyle = "#60a5fa";
  ctx.textAlign = "left";
  ctx.fillText("Progression Heroes", margin.left + 10, margin.top + 10);
  
  ctx.fillStyle = "#34d399";
  ctx.textAlign = "right";
  ctx.fillText("Elite Carries", margin.left + graphWidth - 10, margin.top + 10);
  
  ctx.fillStyle = "#f87171";
  ctx.textAlign = "left";
  ctx.fillText("Liabilities", margin.left + 10, margin.top + graphHeight - 20);
  
  ctx.fillStyle = "#fbbf24";
  ctx.textAlign = "right";
  ctx.fillText("Glass Cannons", margin.left + graphWidth - 10, margin.top + graphHeight - 20);
  
  let maxOutput = 1;
  Object.values(players).forEach(p => {
    const val = Math.max(p.avg_dps || 0, p.avg_hps || 0);
    if (val > maxOutput) maxOutput = val;
  });
  
  plottedPlayers = [];
  
  Object.entries(players).forEach(([name, p]) => {
    const output = Math.max(p.avg_dps || 0, p.avg_hps || 0);
    const xPct = maxOutput > 0 ? (output / maxOutput) * 100 : 0;
    const yPct = p.survival_score || 0;
    
    const xPix = margin.left + (xPct / 100) * graphWidth;
    const yPix = margin.top + graphHeight - (yPct / 100) * graphHeight;
    
    plottedPlayers.push({
      name,
      x: xPix,
      y: yPix,
      class: p.class || p.spec || "Unknown",
      role: p.role || "DPS",
      avg_avoidable: p.avg_avoidable_damage,
      avg_dps: p.avg_dps,
      avg_hps: p.avg_hps,
      total_deaths: p.total_deaths,
      survival_score: yPct,
      output_pct: Math.round(xPct)
    });
  });
  
  plottedPlayers.forEach(p => {
    let color = "var(--text)";
    const cleanClass = p.class.replace(/\s+/g, "");
    if (CLASS_COLORS[p.class]) color = CLASS_COLORS[p.class];
    else if (CLASS_COLORS[cleanClass]) color = CLASS_COLORS[cleanClass];
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  
  if (!canvas.dataset.hoverBound) {
    canvas.dataset.hoverBound = "true";
    
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let hoverTarget = null;
      let minDistance = 12;
      
      plottedPlayers.forEach(p => {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          hoverTarget = p;
        }
      });
      
      showMatrixTooltip(e, hoverTarget, canvas);
    });
    
    canvas.addEventListener("mouseleave", () => {
      showMatrixTooltip(null, null);
    });
  }
}

function showMatrixTooltip(e, p, canvas) {
  const tooltip = document.getElementById("matrixTooltip");
  if (!tooltip) return;
  
  if (!p) {
    tooltip.classList.add("hidden");
    return;
  }
  
  let quadrant = "Liability";
  let quadClass = "liability";
  if (p.output_pct >= 50 && p.survival_score >= 50) {
    quadrant = "Elite Carry";
    quadClass = "carry";
  } else if (p.output_pct < 50 && p.survival_score >= 50) {
    quadrant = "Progression Hero";
    quadClass = "hero";
  } else if (p.output_pct >= 50 && p.survival_score < 50) {
    quadrant = "Glass Cannon";
    quadClass = "cannon";
  }
  
  let classColor = "var(--text)";
  const cleanClass = p.class.replace(/\s+/g, "");
  if (CLASS_COLORS[p.class]) classColor = CLASS_COLORS[p.class];
  else if (CLASS_COLORS[cleanClass]) classColor = CLASS_COLORS[cleanClass];

  tooltip.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-name" style="color: ${classColor}; font-weight: 800;">${escapeHtml(p.name)}</span>
      <span class="tooltip-quadrant ${quadClass}">${quadrant}</span>
    </div>
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      <div><strong>Role:</strong> ${escapeHtml(p.role)}</div>
      <div><strong>Survival Rate:</strong> ${p.survival_score}%</div>
      <div><strong>Avg Avoidable:</strong> ${formatNumber(p.avg_avoidable)}</div>
      <div><strong>Relative Output:</strong> ${p.output_pct}%</div>
      <div><strong>DPS:</strong> ${formatNumber(p.avg_dps || 0)} | <strong>HPS:</strong> ${formatNumber(p.avg_hps || 0)}</div>
      <div style="border-top: 1px solid rgba(255,255,255,0.06); margin-top: 6px; padding-top: 4px; font-size: 11px; color: var(--muted);">
        <strong>Coaching:</strong> ${p.survival_score < 50 ? "Avoids mechanics poorly. Bench or coach." : "Excellent mechanic dodger!"}
      </div>
    </div>
  `;
  
  const canvasRect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - canvasRect.left;
  const mouseY = e.clientY - canvasRect.top;
  
  tooltip.style.left = (mouseX + 15) + "px";
  tooltip.style.top = (mouseY - 20) + "px";
  tooltip.classList.remove("hidden");
}

let plottedFights = [];

function drawTrendsChart(fights) {
  const canvas = document.getElementById("trendsCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 280 * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = 280;

  ctx.clearRect(0, 0, width, height);

  if (!fights || fights.length === 0) {
    ctx.fillStyle = "var(--muted)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No historical fights available yet.", width / 2, height / 2);
    return;
  }

  const margin = { top: 40, right: 40, bottom: 50, left: 65 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  // Find max avoidable damage to scale Y axis (baseline is always 0)
  let maxAvoidable = 100000; // minimum scale of 100k
  fights.forEach(f => {
    if (f.avoidable_damage > maxAvoidable) maxAvoidable = f.avoidable_damage;
  });

  // Round maxAvoidable to a clean number
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxAvoidable)));
  const roundedMax = Math.ceil(maxAvoidable / (magnitude / 2)) * (magnitude / 2);

  // Draw Y-axis gridlines and labels
  ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
  ctx.lineWidth = 1;
  const divisions = 4;
  for (let i = 0; i <= divisions; i++) {
    const ratio = i / divisions;
    const yVal = ratio * roundedMax;
    const yPix = margin.top + graphHeight - ratio * graphHeight;

    ctx.beginPath();
    ctx.moveTo(margin.left, yPix);
    ctx.lineTo(margin.left + graphWidth, yPix);
    ctx.stroke();

    // Format label in thousands or millions
    let label = "0";
    if (yVal >= 1000000) {
      label = (yVal / 1000000).toFixed(1) + "M";
    } else if (yVal >= 1000) {
      label = Math.round(yVal / 1000) + "k";
    } else {
      label = Math.round(yVal).toString();
    }

    ctx.fillStyle = "var(--muted)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(label, margin.left - 10, yPix + 3.5);
  }

  // Calculate coordinates for each fight point
  plottedFights = [];
  const pointCount = fights.length;
  fights.forEach((f, idx) => {
    const xRatio = pointCount > 1 ? idx / (pointCount - 1) : 0.5;
    const xPix = margin.left + xRatio * graphWidth;

    const yRatio = roundedMax > 0 ? f.avoidable_damage / roundedMax : 0;
    const yPix = margin.top + graphHeight - yRatio * graphHeight;

    plottedFights.push({
      ...f,
      x: xPix,
      y: yPix
    });
  });

  // 1. Draw glowing gradient line
  if (plottedFights.length > 0) {
    ctx.save();
    
    // Draw fill area under the line
    ctx.beginPath();
    ctx.moveTo(plottedFights[0].x, margin.top + graphHeight);
    plottedFights.forEach(p => {
      ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(plottedFights[plottedFights.length - 1].x, margin.top + graphHeight);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, margin.top, 0, margin.top + graphHeight);
    fillGrad.addColorStop(0, "rgba(96, 165, 250, 0.15)");
    fillGrad.addColorStop(1, "rgba(96, 165, 250, 0.0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Draw the main line with neon glow
    ctx.beginPath();
    ctx.moveTo(plottedFights[0].x, plottedFights[0].y);
    for (let i = 1; i < plottedFights.length; i++) {
      ctx.lineTo(plottedFights[i].x, plottedFights[i].y);
    }
    
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#3b82f6";
    ctx.shadowBlur = 8;
    ctx.stroke();
    
    ctx.restore();
  }

  // 2. Draw fight points (Green for Kills, Red for Wipes)
  plottedFights.forEach((p, idx) => {
    const dotColor = p.is_kill ? "#34d399" : "#f87171";
    
    // Outer glow halo
    ctx.save();
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner solid core
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // X-axis label for major milestones (e.g. Kills or labels at intervals)
    if (pointCount <= 12 || idx === 0 || idx === pointCount - 1 || p.is_kill || idx % Math.ceil(pointCount / 6) === 0) {
      ctx.save();
      ctx.fillStyle = "var(--muted)";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.boss_name, p.x, margin.top + graphHeight + 16);
      
      const resultLabel = p.is_kill ? "Kill" : "Wipe";
      ctx.fillStyle = p.is_kill ? "#34d399" : "#f87171";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText(resultLabel, p.x, margin.top + graphHeight + 28);
      ctx.restore();
    }
  });

  // Bind mouse interaction listeners if not already bound
  if (!canvas.dataset.hoverBound) {
    canvas.dataset.hoverBound = "true";

    canvas.addEventListener("mousemove", (e) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      let hoverTarget = null;
      let minDistance = 10;

      plottedFights.forEach(p => {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          hoverTarget = p;
        }
      });

      showTrendsTooltip(e, hoverTarget, canvas);
    });

    canvas.addEventListener("mouseleave", () => {
      showTrendsTooltip(null, null);
    });
  }
}

function showTrendsTooltip(e, f, canvas) {
  const tooltip = document.getElementById("trendsTooltip");
  if (!tooltip) return;

  if (!f) {
    tooltip.classList.add("hidden");
    return;
  }

  const resultColor = f.is_kill ? "#34d399" : "#f87171";
  const resultText = f.is_kill ? "Kill Pull" : "Wipe Pull";
  
  // Format date elegantly if created_at timestamp is present
  let dateText = "";
  if (f.created_at) {
    try {
      const date = new Date(f.created_at);
      dateText = `<div style="font-size: 11px; color: var(--muted); margin-top: 4px;">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>`;
    } catch(err) {}
  }

  tooltip.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-name" style="color: var(--blue); font-weight: 800;">${escapeHtml(f.boss_name)}</span>
      <span class="tooltip-quadrant" style="background: rgba(${f.is_kill ? "52,211,153" : "248,113,113"}, 0.15); color: ${resultColor}; border: 1px solid rgba(${f.is_kill ? "52,211,153" : "248,113,113"}, 0.3); font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">${resultText}</span>
    </div>
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text);">
      <div><strong>Avoidable Damage:</strong> <span style="color: #fbbf24; font-weight: bold;">${formatNumber(f.avoidable_damage)}</span> taken</div>
      <div><strong>Roster Average Grade:</strong> <span style="font-weight: bold;">${escapeHtml(f.avg_grade)}</span></div>
      <div><strong>Duration:</strong> ${Math.floor(f.duration_seconds / 60)}m ${f.duration_seconds % 60}s</div>
      ${dateText}
    </div>
  `;

  const canvasRect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - canvasRect.left;
  const mouseY = e.clientY - canvasRect.top;

  tooltip.style.left = (mouseX + 15) + "px";
  tooltip.style.top = (mouseY - 20) + "px";
  tooltip.classList.remove("hidden");
}

function renderBuffSynergy(synergyData) {
  const grid = document.getElementById("synergyBuffsGrid");
  const suggestions = document.getElementById("synergySuggestions");
  if (!grid || !suggestions) return;
  
  if (!synergyData) {
    grid.innerHTML = "No synergy data available.";
    suggestions.innerHTML = "";
    return;
  }
  
  const active = synergyData.active || [];
  const recs = synergyData.suggestions || [];
  
  let gridHtml = "";
  
  const buffKeys = [
    { name: "Battle Shout", active: active.some(b => b.includes("Battle Shout")), desc: "5% Attack Power" },
    { name: "Arcane Intellect", active: active.some(b => b.includes("Arcane Intellect")), desc: "5% Intellect" },
    { name: "Mark of the Wild", active: active.some(b => b.includes("Mark of the Wild")), desc: "3% Versatility" },
    { name: "Chaos Brand", active: active.some(b => b.includes("Chaos Brand")), desc: "5% Magic Dmg" },
    { name: "Mystic Touch", active: active.some(b => b.includes("Mystic Touch")), desc: "5% Physical Dmg" },
    { name: "Power Word: Fortitude", active: active.some(b => b.includes("Fortitude")), desc: "5% Stamina" }
  ];
  
  buffKeys.forEach(b => {
    const stateClass = b.active ? "active" : "missing";
    const indicator = b.active ? "✔" : "✖";
    gridHtml += `
      <div class="synergy-item ${stateClass}">
        <span>${escapeHtml(b.name)} <span style="font-size: 9px; opacity: 0.7; font-weight: normal;">(${b.desc})</span></span>
        <span class="synergy-indicator">${indicator}</span>
      </div>
    `;
  });
  grid.innerHTML = gridHtml;
  
  if (recs.length === 0) {
    suggestions.innerHTML = "🏆 Perfect Synergy! Your raid roster contains all vital class utility buffs.";
  } else {
    let recsHtml = `<div style="font-weight: 700; color: #fbbf24; margin-bottom: 6px;">Utility Suggestions:</div>`;
    recs.forEach(r => {
      recsHtml += `
        <div style="margin-bottom: 4px;">
          • <strong style="color: var(--text);">${escapeHtml(r.class)}</strong> missing: ${r.benefit}
        </div>
      `;
    });
    suggestions.innerHTML = recsHtml;
  }
}

function renderPanicAudit(players) {
  const container = document.getElementById("panicAuditList");
  if (!container) return;
  
  const sorted = Object.entries(players)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total_deaths - a.total_deaths);
    
  let html = "";
  
  if (sorted.length === 0) {
    container.innerHTML = "No player data available.";
    return;
  }
  
  sorted.forEach(p => {
    if (p.total_deaths === 0) return;
    
    let classColor = "var(--text)";
    const cleanClass = p.class ? p.class.replace(/\s+/g, "") : p.spec.replace(/\s+/g, "");
    if (CLASS_COLORS[p.class]) classColor = CLASS_COLORS[p.class];
    else if (CLASS_COLORS[p.spec]) classColor = CLASS_COLORS[p.spec];
    else if (CLASS_COLORS[cleanClass]) classColor = CLASS_COLORS[cleanClass];
    
    html += `
      <div class="panic-audit-row">
        <div class="panic-meta">
          <span style="color: ${classColor};">${escapeHtml(p.name)}</span>
          <span style="color: var(--muted); font-size: 11px;">Deaths: ${p.total_deaths} | Panic Rate: <strong style="color: ${p.panic_healthstone_pct < 40 ? "var(--red)" : "var(--green)"};">${p.panic_healthstone_pct}%</strong></span>
        </div>
        <div class="panic-progress-bar">
          <div class="panic-progress-fill" style="width: ${p.panic_healthstone_pct}%; background: ${p.panic_healthstone_pct < 40 ? "var(--red)" : "var(--green)"};"></div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html || `<div style="text-align: center; color: var(--green); padding: 10px;">🛡️ Clean Raid Survival! Zero roster deaths recorded in these fights.</div>`;
}

function renderGoldLedger(players) {
  const body = document.getElementById("guildLedgerBody");
  if (!body) return;
  
  const sorted = Object.entries(players)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.gold_debt - a.gold_debt);
    
  let html = "";
  
  if (sorted.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 20px;">No ledger entries found.</td></tr>`;
    return;
  }
  
  sorted.forEach(p => {
    let classColor = "var(--text)";
    const cleanClass = p.class ? p.class.replace(/\s+/g, "") : p.spec.replace(/\s+/g, "");
    if (CLASS_COLORS[p.class]) classColor = CLASS_COLORS[p.class];
    else if (CLASS_COLORS[p.spec]) classColor = CLASS_COLORS[p.spec];
    else if (CLASS_COLORS[cleanClass]) classColor = CLASS_COLORS[cleanClass];
    
    let coinHtml = "0g";
    if (p.gold_debt > 0) {
      coinHtml = `
        <span class="coin-token">
          <span>${formatNumber(p.gold_debt)}</span>
          <span class="coin-icon gold"></span>
        </span>
      `;
    } else {
      coinHtml = `<span style="color: var(--green); font-weight: 700;">Clean (0g)</span>`;
    }
    
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 12px 16px; font-weight: bold; color: ${classColor};">${escapeHtml(p.name)}</td>
        <td style="padding: 12px 16px; color: var(--muted);">${escapeHtml(p.role)}</td>
        <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${p.fights_count}</td>
        <td style="padding: 12px 16px; text-align: right; color: var(--red); font-weight: 600;">${formatNumber(p.avg_avoidable_damage)}</td>
        <td style="padding: 12px 16px; text-align: right;"><span class="badge badge-grade grade-${p.avg_grade || "C"}" style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${p.avg_grade}</span></td>
        <td style="padding: 12px 16px; text-align: right;">${coinHtml}</td>
      </tr>
    `;
  });
  
  body.innerHTML = html;
}

let activeWipeBoss = null;

function renderWipeDiagnoser(wipeAnalytics) {
  const sidebar = document.getElementById("wipeBossSidebar");
  const panel = document.getElementById("wipeDashboardPanel");
  if (!sidebar || !panel) return;
  
  sidebar.innerHTML = "";
  panel.innerHTML = "";
  
  const encounters = Object.entries(wipeAnalytics || {});
  
  if (encounters.length === 0) {
    sidebar.innerHTML = `<div style="color: var(--muted); font-size: 13px; font-weight: 600; padding: 12px; text-align: center; width: 100%;">No progression wipes recorded.</div>`;
    panel.innerHTML = `
      <div style="text-align: center; color: var(--green); padding: 32px; border: 1px dashed var(--border); border-radius: var(--radius); background: rgba(52,211,153,0.02);">
        <div style="font-size: 32px; margin-bottom: 12px;">🎉</div>
        <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--green); margin-bottom: 6px;">Zero Progression Wipes!</div>
        <p style="font-size: 13px; color: var(--muted); margin: 0; max-width: 320px; line-height: 1.6; display: inline-block;">All analyzed boss fights in this historical dataset resulted in clean boss kills.</p>
      </div>
    `;
    return;
  }
  
  // Set default active boss if not set or not in current dataset
  if (!activeWipeBoss || !wipeAnalytics[activeWipeBoss]) {
    activeWipeBoss = encounters[0][0];
  }
  
  // 1. Render Sidebar buttons
  encounters.forEach(([bossName, data]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `wipe-boss-btn ${bossName === activeWipeBoss ? "active" : ""}`;
    btn.innerHTML = `
      <span>${escapeHtml(bossName)}</span>
      <span class="wipe-boss-badge">${data.total_wipes}</span>
    `;
    btn.onclick = () => {
      activeWipeBoss = bossName;
      renderWipeDiagnoser(wipeAnalytics);
    };
    sidebar.appendChild(btn);
  });
  
  // 2. Render Panel for Active Boss
  const activeData = wipeAnalytics[activeWipeBoss];
  
  // A. Stats Row HTML
  const statsHtml = `
    <div class="wipe-stats-grid">
      <div class="wipe-stat-card">
        <span class="wipe-stat-label">Total Pulls Audited</span>
        <span class="wipe-stat-value">${activeData.total_wipes} Wipes</span>
      </div>
      <div class="wipe-stat-card">
        <span class="wipe-stat-label">Average Wipe HP</span>
        <span class="wipe-stat-value" style="color: var(--red);">${activeData.avg_boss_hp}% HP</span>
      </div>
    </div>
  `;
  
  // B. Distributions HTML
  // Phase Distribution progress bars
  let phaseHtml = "";
  const phases = Object.entries(activeData.phase_distribution || {}).sort((a, b) => b[1] - a[1]);
  if (phases.length === 0) {
    phaseHtml = `<div style="color: var(--muted); font-size: 13px; padding-top: 10px;">No phase breakdown data.</div>`;
  } else {
    phases.forEach(([phaseName, count]) => {
      const pct = Math.round((count / activeData.total_wipes) * 100);
      phaseHtml += `
        <div class="distribution-row">
          <div class="distribution-meta">
            <span>${escapeHtml(phaseName)}</span>
            <span>${count} wipes (${pct}%)</span>
          </div>
          <div class="distribution-progress">
            <div class="distribution-fill phase" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });
  }
  
  // HP Distribution progress bars
  let hpDistHtml = "";
  const hpBrackets = [
    { key: "100_80", label: "100% - 80% HP (Early Wipe)" },
    { key: "80_50", label: "80% - 50% HP (Mid Phase)" },
    { key: "50_20", label: "50% - 20% HP (Late Phase)" },
    { key: "20_0", label: "Under 20% HP (Heartbreakers)" }
  ];
  
  hpBrackets.forEach(b => {
    const count = activeData.hp_distribution[b.key] || 0;
    const pct = Math.round((count / activeData.total_wipes) * 100);
    hpDistHtml += `
      <div class="distribution-row">
        <div class="distribution-meta">
          <span>${b.label}</span>
          <span>${count} wipes (${pct}%)</span>
        </div>
        <div class="distribution-progress">
          <div class="distribution-fill hp" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  });
  
  const distributionsHtml = `
    <div class="wipe-distribution-section">
      <div class="distribution-card">
        <h4 style="font-size: 13.5px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--blue);">📈 Pull HP progression distribution</h4>
        ${hpDistHtml}
      </div>
      <div class="distribution-card">
        <h4 style="font-size: 13.5px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--blue);">🛡️ Bottleneck Phase audits</h4>
        ${phaseHtml}
      </div>
    </div>
  `;
  
  // C. Accolades (Catalysts lists) HTML
  let playerListHtml = "";
  const topPlayers = activeData.catalyst_players || [];
  if (topPlayers.length === 0) {
    playerListHtml = `<div style="color: var(--muted); font-size: 13px; padding: 12px; text-align: center;">No player deaths recorded.</div>`;
  } else {
    topPlayers.slice(0, 3).forEach(p => {
      // Find class color if player spec exists (free/live lookup compatibility)
      let classColor = "var(--text)";
      if (typeof p.class === "string" && CLASS_COLORS[p.class]) {
        classColor = CLASS_COLORS[p.class];
      }
      playerListHtml += `
        <div class="accolade-item">
          <span class="accolade-item-name" style="color: ${classColor};"><span style="font-size: 12px; margin-right: 4px;">👤</span> ${escapeHtml(p.player)}</span>
          <span class="accolade-item-count">${p.count} Wipes</span>
        </div>
      `;
    });
  }
  
  let abilityListHtml = "";
  const topAbilities = activeData.catalyst_abilities || [];
  if (topAbilities.length === 0) {
    abilityListHtml = `<div style="color: var(--muted); font-size: 13px; padding: 12px; text-align: center;">No catalyst spells recorded.</div>`;
  } else {
    topAbilities.slice(0, 3).forEach(a => {
      abilityListHtml += `
        <div class="accolade-item">
          <span class="accolade-item-name" style="color: var(--red);"><span style="font-size: 12px; margin-right: 4px;">⚔️</span> ${escapeHtml(a.ability)}</span>
          <span class="accolade-item-count">${a.count} Wipes</span>
        </div>
      `;
    });
  }
  
  const accoladesHtml = `
    <div class="wipe-accolades-section">
      <div class="accolades-pane">
        <h4 style="font-size: 14px; margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 16px;">🩸</span> Wipe Catalyst Leaders</h4>
        <p class="card-desc">Players who died first, triggering the initial raid failure check.</p>
        <div class="accolade-list">
          ${playerListHtml}
        </div>
      </div>
      
      <div class="accolades-pane">
        <h4 style="font-size: 14px; margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 16px;">⚡</span> Top Wipe Trigger Abilities</h4>
        <p class="card-desc">Mechanical abilities causing the first raid death most frequently.</p>
        <div class="accolade-list">
          ${abilityListHtml}
        </div>
      </div>
    </div>
  `;
  
  // D. Timeline Heatmap and Recommendations
  // Map timestamps to progress markers along the bar (assume max display range is 360 seconds/6 mins for the visual timeline display)
  const timestamps = activeData.death_timestamps || [];
  let markersHtml = "";
  let recText = "Great defensive discipline! No first death timestamps recorded on these pulls.";
  
  if (timestamps.length > 0) {
    timestamps.forEach(t => {
      const pct = Math.max(2, Math.min(98, (t / 360) * 100));
      markersHtml += `<div class="heatmap-marker" style="left: ${pct}%;"></div>`;
    });
    
    // Compute recommendation recommendation based on dense clusters
    const early = timestamps.filter(t => t < 90).length;
    const mid = timestamps.filter(t => t >= 90 && t < 180).length;
    const late = timestamps.filter(t => t >= 180).length;
    
    if (early >= mid && early >= late) {
      recText = `🚨 **Early encounter check failure:** Most pull failures are triggered in the **first 90 seconds**. This points to rotational gaps, unmitigated initial tank-busters, or standing in early swirls. Assign basic mechanics focus.`;
    } else if (mid >= early && mid >= late) {
      recText = `⚠️ **Mid-fight cooldown bottleneck:** Failures cluster heavily between **1:30 and 3:00**. This is typically when high-damage mechanics overlap and healer cooldowns run dry. Review Healer CD sheets and assign major survivals here.`;
    } else {
      recText = `💔 **Endgame execution exhaustion:** Wipes cluster consistently in **late-fight/execute phases**. Rotations and mechanical errors are clean early, but healer mana or player fatigue is causing wipes. Prioritize DPS potions/execution uptime.`;
    }
  }
  
  const heatmapHtml = `
    <div class="wipe-heatmap-section">
      <h4 style="font-size: 13.5px; margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">⏱️ Wipe Catalyst Timeline Heatmap</h4>
      <p class="card-desc">Visual density of when the first deaths occur during pull timelines (Max display: 6 mins).</p>
      <div class="heatmap-bar-container">
        <div class="heatmap-track">
          ${markersHtml}
        </div>
        <div class="heatmap-axis-labels">
          <span>0:00 (Pull)</span>
          <span>1:30</span>
          <span>3:00</span>
          <span>4:30</span>
          <span>6:00 (Execute)</span>
        </div>
      </div>
      
      <!-- Tactician coaching card -->
      <div class="wipe-rec-drawer">
        <span class="wipe-rec-icon" style="margin-right: 8px;">💡</span>
        <div class="wipe-rec-text">${recText}</div>
      </div>
    </div>
  `;
  
  panel.innerHTML = `
    <h3 style="font-size: 15px; font-weight: 800; color: var(--text); border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Encounter Analysis: ${escapeHtml(activeWipeBoss)}</h3>
    ${statsHtml}
    ${distributionsHtml}
    ${accoladesHtml}
    ${heatmapHtml}
  `;
}

async function postGuildLedgerToDiscord() {
  const postBtn = document.getElementById("postGuildLedgerButton");
  if (!postBtn || !currentGuildOverviewData) return;
  
  if (!isPremium) {
    alert("⭐ The Guild Suite is a Patreon Premium feature. Support us on Patreon to unlock the Guild Command Center!");
    return;
  }
  
  if (!currentUserWebhook) {
    alert("Please configure and save your Discord Webhook URL in your Settings drawer first.");
    openSettingsDrawer();
    return;
  }
  
  postBtn.disabled = true;
  postBtn.textContent = "Posting...";
  
  const players = currentGuildOverviewData.players_history || {};
  const sorted = Object.entries(players)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.gold_debt - a.gold_debt);
    
  let leaderboardText = "";
  sorted.slice(0, 10).forEach((p, idx) => {
    leaderboardText += `${idx + 1}. **${p.name}** (${p.role}) — **${p.gold_debt} gold** debt (${formatNumber(p.avg_avoidable_damage)} avg avoidable)\n`;
  });
  
  if (!leaderboardText) leaderboardText = "Zero repair debt recorded!";
  
  const discordPayload = {
    username: "ShortParse",
    avatar_url: "https://raw.githubusercontent.com/ShortParse/ShortParse-Web/main/images/apple-touch-icon.png",
    embeds: [
      {
        title: "🛡️ ShortParse Roster Repair Debt Ledger",
        description: "Weekly projected gold repair bills computed based on avoidable mechanic damage taken.",
        color: 16478597,
        fields: [
          {
            name: "💰 Roster Repair Leaderboard (Top Avoidable Damage)",
            value: leaderboardText
          },
          {
            name: "📊 Guild Raid Averages",
            value: `• **Total Fights Audited:** ${currentGuildOverviewData.guild_averages.total_fights_analyzed}\n• **Average Avoidable Damage:** ${formatNumber(currentGuildOverviewData.guild_averages.average_avoidable_damage)} taken per fight`
          }
        ],
        footer: {
          text: "ShortParse Guild Suite - Gamified Accountability & Banter"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  try {
    const response = await fetch(currentUserWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(discordPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Discord API returned status ${response.status}`);
    }
    
    postBtn.textContent = "Posted! 🚀";
    postBtn.style.background = "var(--green)";
    postBtn.style.color = "#0f1218";
    
    setTimeout(() => {
      postBtn.disabled = false;
      postBtn.textContent = "Post Ledger to Discord";
      postBtn.style.background = "";
      postBtn.style.color = "";
    }, 2500);
  } catch (error) {
    alert(`Failed to share ledger to Discord: ${error.message}`);
    postBtn.disabled = false;
    postBtn.textContent = "Post Ledger to Discord";
  }
}


// ==============================================================================
// Patreon Premium Blockbuster Features JS Implementation
// ==============================================================================

// Global variables for premium features
let isRaidCoachTyping = false;

// 1. Subtab Switching Event Registration
document.addEventListener("DOMContentLoaded", () => {
  // Bind subtabs
  const subtabs = [
    { btn: "subtabRosterBtn", area: "subtabRosterArea" },
    { btn: "subtabHealerAuditorBtn", area: "subtabHealerAuditorArea" },
    { btn: "subtabCooldownNotesBtn", area: "subtabCooldownNotesArea" },
    { btn: "subtabSpecFlexBtn", area: "subtabSpecFlexArea" }
  ];

  subtabs.forEach((tab) => {
    const btnEl = document.getElementById(tab.btn);
    if (btnEl) {
      btnEl.addEventListener("click", () => {
        // Toggle active classes on buttons
        subtabs.forEach(t => {
          const b = document.getElementById(t.btn);
          if (b) {
            b.classList.toggle("active", t.btn === tab.btn);
            b.style.color = (t.btn === tab.btn) ? "var(--foreground)" : "var(--muted)";
          }
          const a = document.getElementById(t.area);
          if (a) {
            a.classList.toggle("hidden", t.area !== tab.area);
          }
        });

        // Run tab-specific loading/rendering functions
        if (tab.btn === "subtabHealerAuditorBtn") {
          renderHealerAuditorPanel();
        } else if (tab.btn === "subtabCooldownNotesBtn") {
          initializeCooldownNotesTab();
        } else if (tab.btn === "subtabSpecFlexBtn") {
          renderSpecFlexTab();
        }
      });
    }
  });

  // Bind Raid Coach trigger floating button & drawer
  const triggerCoachBtn = document.getElementById("triggerRaidCoachBtn");
  if (triggerCoachBtn) {
    triggerCoachBtn.addEventListener("click", openRaidCoachDrawer);
  }

  const closeCoachBtn = document.getElementById("closeRaidCoachBtn");
  if (closeCoachBtn) {
    closeCoachBtn.addEventListener("click", closeRaidCoachDrawer);
  }

  const coachOverlay = document.getElementById("raidCoachOverlay");
  if (coachOverlay) {
    coachOverlay.addEventListener("click", closeRaidCoachDrawer);
  }

  // Send message button in coach
  const sendCoachMsgBtn = document.getElementById("sendCoachMessageBtn");
  if (sendCoachMsgBtn) {
    sendCoachMsgBtn.addEventListener("click", sendCoachMessage);
  }

  const coachInput = document.getElementById("coachChatInput");
  if (coachInput) {
    coachInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendCoachMessage();
      }
    });
  }

  // Preset chips event listener
  document.querySelectorAll("#raidCoachDrawer .preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        submitCoachQuery(prompt);
      }
    });
  });
});

// Update the float coach button visibility based on which tab/suite is active
function updateRaidCoachBtnVisibility() {
  const triggerCoachBtn = document.getElementById("triggerRaidCoachBtn");
  if (!triggerCoachBtn) return;

  const guildSuiteCard = document.getElementById("guildSuiteCard");
  const isGuildSuiteVisible = guildSuiteCard && !guildSuiteCard.classList.contains("hidden");

  // Show only if in Guild Command Center and premium status is active (or lock overlay is hidden)
  const lockScreen = document.getElementById("guildSuitePremiumLock");
  const isLocked = lockScreen && !lockScreen.classList.contains("hidden");

  if (isGuildSuiteVisible && !isLocked) {
    triggerCoachBtn.classList.remove("hidden");
  } else {
    triggerCoachBtn.classList.add("hidden");
  }
}

// Intercept original route views to update coach floating button visibility
const originalRenderGuildSuite = renderGuildSuite;
renderGuildSuite = async function(guildId) {
  if (originalRenderGuildSuite) {
    await originalRenderGuildSuite(guildId);
  }
  updateRaidCoachBtnVisibility();
};

const originalShowGuildSuiteCard = showGuildSuiteCard;
showGuildSuiteCard = async function() {
  if (originalShowGuildSuiteCard) {
    await originalShowGuildSuiteCard();
  }
  updateRaidCoachBtnVisibility();
};

// 2. Healer Cooldown & "Dry Spell" Auditor Renderer
function renderHealerAuditorPanel() {
  const overlapsContainer = document.getElementById("healerOverlapsContainer");
  const drySpellsContainer = document.getElementById("healerDrySpellsContainer");
  const adviceList = document.getElementById("healerOfficerAdvice");

  if (!overlapsContainer || !drySpellsContainer || !adviceList) return;

  // Clear existing content
  overlapsContainer.innerHTML = "";
  drySpellsContainer.innerHTML = "";
  adviceList.innerHTML = "";

  // A. Check if live fight analysis report is loaded
  let overlaps = [];
  let drySpells = [];
  let advice = [];
  let fightName = "";

  if (currentReportData && currentReportData.analyses && currentReportData.analyses[selectedAnalysisIndex]) {
    const analysis = currentReportData.analyses[selectedAnalysisIndex];
    fightName = analysis.fight.name;
    const calibrator = analysis.defensive_calibrator || {};
    overlaps = calibrator.overlaps || [];
    drySpells = calibrator.dry_spells || [];
    advice = calibrator.officer_advice || ["No direct officer advice compiled for this pull."];
  } else if (currentGuildOverviewData && currentGuildOverviewData.healer_audit) {
    // Pull from weekly guild summary aggregates
    overlaps = currentGuildOverviewData.healer_audit.recent_overlaps || [];
    drySpells = currentGuildOverviewData.healer_audit.recent_dry_spells || [];
    advice = [
      `Aggregate overlaps logged: ${currentGuildOverviewData.healer_audit.total_overlaps} wasteful overlaps.`,
      `Aggregate dry spell gaps logged: ${currentGuildOverviewData.healer_audit.total_dry_spells} vulnerable periods.`,
      "Review the Cooldown Notes tab to adjust rosters and mitigate these spikes."
    ];
    fightName = "Raid Progression";
  } else {
    // Premium Lock Mock preview
    overlaps = [
      { summary: "Wasteful Overlap: SwirlyCatcher's Divine Hymn and RestoGuy's Tranquility were active concurrently.", time_range: "01:18 - 01:26", overhealing_pct: 82 },
      { summary: "Wasteful Overlap: Tanky's Rallying Cry and Bubbles' Aura Mastery were active concurrently.", time_range: "03:15 - 03:25", overhealing_pct: 75 }
    ];
    drySpells = [
      { summary: "Defensive Dry Spell: The raid took 1,240,000 damage over 8 seconds with no active raid cooldowns!", time_range: "02:30 - 02:38", damage_taken: 1240000 }
    ];
    advice = [
      "Move RestoGuy's Tranquility at 01:18 to cover the dry spell damage spike at 02:30.",
      "Alternate Rallying Cry and Aura Mastery at 03:15 to increase uptime efficiency."
    ];
    fightName = "Boss Demo Pull";
  }

  // Populate Overlaps
  if (overlaps.length === 0) {
    overlapsContainer.innerHTML = `<div style="color: var(--green); font-size: 13px; font-style: italic; padding: 10px;">🌟 Zero concurrent healer overlaps logged! co-healers rotated perfectly.</div>`;
  } else {
    overlaps.forEach((o) => {
      const card = document.createElement("div");
      card.className = "overlap-card";
      card.innerHTML = `
        <div class="audit-card-title">
          <span>${o.summary}</span>
          <span class="audit-card-time">${o.time_range}</span>
        </div>
        <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
          Estimated Overhealing: <strong style="color: #ef4444;">${o.overhealing_pct || 80}%</strong> (wasted mana & output)
        </div>
      `;
      overlapsContainer.appendChild(card);
    });
  }

  // Populate Dry Spells
  if (drySpells.length === 0) {
    drySpellsContainer.innerHTML = `<div style="color: var(--green); font-size: 13px; font-style: italic; padding: 10px;">🌟 Zero dry spell gaps logged! heavy damage was always covered.</div>`;
  } else {
    drySpells.forEach((d) => {
      const card = document.createElement("div");
      card.className = "dryspell-card";
      card.innerHTML = `
        <div class="audit-card-title">
          <span>${d.summary}</span>
          <span class="audit-card-time">${d.time_range}</span>
        </div>
        <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
          Raid Damage Vulnerability: <strong style="color: #f59e0b;">${(d.damage_taken || 0).toLocaleString()} taken</strong> with 0 active CDs.
        </div>
      `;
      drySpellsContainer.appendChild(card);
    });
  }

  // Populate Advice
  advice.forEach((line) => {
    const li = document.createElement("li");
    li.innerHTML = `🛡️ ${line}`;
    adviceList.appendChild(li);
  });
}

// 3. Cooldown Notes generator
function initializeCooldownNotesTab() {
  const mrtBossSelect = document.getElementById("mrtBossSelect");
  const mrtNotesOutput = document.getElementById("mrtNotesOutput");
  const mrtRosterDefensives = document.getElementById("mrtRosterDefensives");

  if (!mrtBossSelect || !mrtNotesOutput || !mrtRosterDefensives) return;

  // Clear and populate Boss Selector based on history
  mrtBossSelect.innerHTML = "";
  
  let bosses = [];
  if (currentGuildOverviewData && currentGuildOverviewData.wipe_analytics) {
    bosses = Object.keys(currentGuildOverviewData.wipe_analytics);
  }

  if (bosses.length === 0) {
    // Fallback Mock selection
    bosses = ["Midnight Falls", "The Voidspire"];
  }

  bosses.forEach((bossName) => {
    const opt = document.createElement("option");
    opt.value = bossName;
    opt.innerText = bossName;
    mrtBossSelect.appendChild(opt);
  });

  // Handle boss change
  mrtBossSelect.onchange = async () => {
    const selectedBoss = mrtBossSelect.value;
    await loadMrtNotesForBoss(selectedBoss);
  };

  // Populate Roster Defensives mapping
  mrtRosterDefensives.innerHTML = "";
  let roster = [];
  if (currentReportData && currentReportData.analyses && currentReportData.analyses[selectedAnalysisIndex]) {
    roster = currentReportData.analyses[selectedAnalysisIndex].roster || [];
  } else {
    // Mock preview roster
    roster = [
      { name: "SwirlyCatcher", class: "Priest", spec: "Holy" },
      { name: "RestoGuy", class: "Druid", spec: "Restoration" },
      { name: "TankyMcTank", class: "Warrior", spec: "Protection" }
    ];
  }

  // Defensives registration
  const cooldownSpells = {
    "Priest": "Divine Hymn / Power Word: Barrier",
    "Druid": "Tranquility",
    "Shaman": "Spirit Link / Healing Tide",
    "Paladin": "Aura Mastery",
    "Monk": "Revival",
    "Warrior": "Rallying Cry",
    "Death Knight": "Anti-Magic Zone",
    "Demon Hunter": "Darkness"
  };

  let foundAny = false;
  roster.forEach((player) => {
    const cls = player.class || "";
    if (cooldownSpells[cls]) {
      foundAny = true;
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justify = "space-between";
      row.style.padding = "6px 8px";
      row.style.background = "rgba(255,255,255,0.02)";
      row.style.border = "1px solid rgba(255,255,255,0.04)";
      row.style.borderRadius = "4px";
      
      const classColor = CLASS_COLORS[cls] || "var(--foreground)";
      row.innerHTML = `
        <span style="color: ${classColor}; font-weight: 600;">${player.name}</span>
        <span style="color: var(--muted); font-size: 11.5px;">${cooldownSpells[cls]}</span>
      `;
      mrtRosterDefensives.appendChild(row);
    }
  });

  if (!foundAny) {
    mrtRosterDefensives.innerHTML = `<div style="color: var(--muted); font-style: italic; padding: 10px;">No major healer/utility CD holders found in active roster.</div>`;
  }

  // Load notes for first boss
  if (bosses.length > 0) {
    loadMrtNotesForBoss(bosses[0]);
  }

  // Copy notes event
  const copyBtn = document.getElementById("copyMrtNotesBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const code = document.getElementById("mrtNotesOutput").innerText;
      navigator.clipboard.writeText(code).then(() => {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "Copied! 📋";
        copyBtn.style.background = "var(--green)";
        copyBtn.style.color = "#0f1218";
        setTimeout(() => {
          copyBtn.textContent = oldText;
          copyBtn.style.background = "";
          copyBtn.style.color = "";
        }, 1500);
      });
    };
  }
}

async function loadMrtNotesForBoss(bossName) {
  const outputEl = document.getElementById("mrtNotesOutput");
  if (!outputEl) return;

  outputEl.innerText = "// Compiling cooldown notes timeline...";

  // Check if we are premium or using locked mock view
  const lockScreen = document.getElementById("guildSuitePremiumLock");
  const isLocked = lockScreen && !lockScreen.classList.contains("hidden");

  if (isLocked) {
    // Generate beautiful preview mock MRT note
    setTimeout(() => {
      outputEl.innerText = `; --- ShortParse Premium Preview Notes for ${bossName} ---
; Copy and paste this directly into Method Raid Tools / Angry Assignments

{time:01:15} -- Void Eruption Spike --
{time:01:15}   TankyMcTank (Rallying Cry)
{time:01:18}   SwirlyCatcher (Divine Hymn)

{time:02:30} -- Shadow Pulse Waves --
{time:02:30}   RestoGuy (Tranquility)

{time:03:45} -- Deep Void Devourer --
{time:03:45}   [Assign Cooldown Here!]
`;
    }, 400);
    return;
  }

  try {
    // Call API
    const response = await fetch(`/api/guild/mrt-notes?job_id=${currentJobId}&analysis_index=${selectedAnalysisIndex}`);
    if (response.ok) {
      const data = await response.json();
      outputEl.innerText = data.notes;
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to load MRT notes:", error);
    outputEl.innerText = `// Failed to compile live MRT notes automatically: ${error.message}
// Fallback manual planning note compiled:

{time:01:15} -- Boss Damage Spike --
{time:01:15}   [Assign Rallying Cry]
{time:02:30} -- Boss Damage Spike --
{time:02:30}   [Assign Tranquility]
`;
  }
}

// 4. Smart Spec-Flex Finder & Bench leaderboard
async function renderSpecFlexTab() {
  const resultsContainer = document.getElementById("flexFinderResults");
  const leaderboardBody = document.getElementById("specFlexLeaderboardBody");

  if (!resultsContainer || !leaderboardBody) return;

  resultsContainer.innerHTML = `<div style="color: var(--muted); font-size: 13px;">Analyzing roster specs...</div>`;
  leaderboardBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--muted);">Analyzing consistency data...</td></tr>`;

  // Check if we are premium or locked
  const lockScreen = document.getElementById("guildSuitePremiumLock");
  const isLocked = lockScreen && !lockScreen.classList.contains("hidden");

  if (isLocked) {
    // Generate beautiful preview mock cards
    setTimeout(() => {
      resultsContainer.innerHTML = `
        <div class="flex-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #60a5fa; font-size: 14px;">SwirlyCatcher</strong>
            <span class="flex-badge">Flex Active</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            Class: <strong style="color: white;">Priest</strong> | Specs Played: <strong style="color: #34d399;">Holy, Shadow</strong>
          </div>
          <div style="font-size: 11.5px; line-height: 1.4; color: var(--text); border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px; margin-top: 4px;">
            💬 <strong>Flex Recommendation:</strong> Excellent Shadow DPS, but flexes to Holy Healer with 88% Uptime rating when raid is healer-starved.
          </div>
        </div>
        <div class="flex-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #f48cba; font-size: 14px;">PaladinGuy</strong>
            <span class="flex-badge potential">Potential Flex</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            Class: <strong style="color: white;">Paladin</strong> | Spec Played: <strong style="color: #fbbf24;">Retribution</strong>
          </div>
          <div style="font-size: 11.5px; line-height: 1.4; color: var(--text); border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px; margin-top: 4px;">
            💬 <strong>Flex Recommendation:</strong> Dual spec identified in logs! Can flex to Protection Tank if extra tank support is required.
          </div>
        </div>
      `;

      leaderboardBody.innerHTML = `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px 14px; font-weight: 600; color: #ff7c0a;">GreenBeamEnjoyer</td>
          <td style="padding: 12px 14px;">Restoration Druid</td>
          <td style="padding: 12px 14px; text-align: right;">8 fights</td>
          <td style="padding: 12px 14px; text-align: right; color: var(--green); font-weight: 700;">100%</td>
          <td style="padding: 12px 14px; text-align: right; color: var(--green); font-weight: 700;">92 (Grade A)</td>
          <td style="padding: 12px 14px; text-align: center;"><span class="flex-badge" style="background: rgba(255,255,255,0.03); color: var(--muted);">Stable Healer</span></td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px 14px; font-weight: 600; color: #c69b6d;">TankyMcTank</td>
          <td style="padding: 12px 14px;">Protection Warrior</td>
          <td style="padding: 12px 14px; text-align: right;">8 fights</td>
          <td style="padding: 12px 14px; text-align: right; color: var(--green); font-weight: 700;">98%</td>
          <td style="padding: 12px 14px; text-align: right; color: var(--green); font-weight: 700;">98 (Grade S)</td>
          <td style="padding: 12px 14px; text-align: center;"><span class="flex-badge" style="background: rgba(255,255,255,0.03); color: var(--muted);">Main Tank</span></td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px 14px; font-weight: 600; color: #ffffff;">SwirlyCatcher</td>
          <td style="padding: 12px 14px;">Shadow Priest</td>
          <td style="padding: 12px 14px; text-align: right;">8 fights</td>
          <td style="padding: 12px 14px; text-align: right; color: #ef4444; font-weight: 700;">33%</td>
          <td style="padding: 12px 14px; text-align: right; color: #ef4444; font-weight: 700;">25 (Grade D)</td>
          <td style="padding: 12px 14px; text-align: center;"><span class="flex-badge">Flex DPS/Heal</span></td>
        </tr>
      `;
    }, 400);
    return;
  }

  try {
    const response = await fetch("/api/guild/roster-calibrator");
    if (response.ok) {
      const data = await response.json();
      
      // Populate Recommendations Cards
      resultsContainer.innerHTML = "";
      if (data.flex_recommendations.length === 0) {
        resultsContainer.innerHTML = `<div style="color: var(--muted); font-size: 13px; font-style: italic; grid-column: 1 / -1;">No multi-spec flex options parsed yet. Check back after more logs are analyzed.</div>`;
      } else {
        data.flex_recommendations.forEach((rec) => {
          const card = document.createElement("div");
          card.className = "flex-card";
          
          const classColor = CLASS_COLORS[rec.class] || "var(--foreground)";
          const badgeText = rec.specs_played.length > 1 ? "Flex Active" : "Potential Flex";
          const badgeClass = rec.specs_played.length > 1 ? "flex-badge" : "flex-badge potential";
          
          const potSpecText = rec.potential_specs.length > 0 ? rec.potential_specs.join(", ") : "None";

          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: ${classColor}; font-size: 14.5px;">${rec.player}</strong>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
              Class: <strong style="color: white;">${rec.class}</strong> | Active Spec: <strong style="color: #60a5fa;">${rec.current_spec}</strong>
            </div>
            <div style="font-size: 11.5px; line-height: 1.4; color: var(--text); border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px; margin-top: 4px;">
              💬 <strong>Specs History:</strong> Played: ${rec.specs_played.join(", ") || "None"} | Potential Specs: ${potSpecText}
            </div>
            <div style="font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; margin-top: 4px;">
              <span>URS Survival: <strong>${rec.urs}%</strong></span>
              <span>SPI Index: <strong>${rec.spi}/100</strong></span>
            </div>
          `;
          resultsContainer.appendChild(card);
        });
      }

      // Populate Bench Leaderboard Table
      leaderboardBody.innerHTML = "";
      const grades = data.roster_bench_grades || {};
      const playerNames = Object.keys(grades);
      
      if (playerNames.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--muted);">No player records compiled.</td></tr>`;
      } else {
        // Sort players by URS (survival)
        const sortedPlayers = Object.entries(grades).sort((a, b) => b[1].urs - a[1].urs);
        
        sortedPlayers.forEach(([name, p]) => {
          const row = document.createElement("tr");
          row.style.borderBottom = "1px solid var(--border)";
          
          const classColor = CLASS_COLORS[p.spec.split(" ").pop()] || "var(--foreground)";
          
          // Color code URS and SPI
          const ursColor = p.urs >= 80 ? "var(--green)" : (p.urs >= 50 ? "#fbbf24" : "#ef4444");
          const spiColor = p.spi >= 80 ? "var(--green)" : (p.spi >= 50 ? "#fbbf24" : "#ef4444");

          row.innerHTML = `
            <td style="padding: 12px 14px; font-weight: 600; color: ${classColor};">${name}</td>
            <td style="padding: 12px 14px;">${p.spec} (${p.role})</td>
            <td style="padding: 12px 14px; text-align: right;">${p.fights_count} pulls</td>
            <td style="padding: 12px 14px; text-align: right; color: ${ursColor}; font-weight: 700;">${p.urs}%</td>
            <td style="padding: 12px 14px; text-align: right; color: ${spiColor}; font-weight: 700;">${p.spi} (Grade ${p.avg_grade})</td>
            <td style="padding: 12px 14px; text-align: center;">
              <span class="flex-badge ${p.is_flex ? '' : 'potential'}" style="${p.is_flex ? '' : 'background: rgba(255,255,255,0.03); color: var(--muted); border: 1px solid rgba(255,255,255,0.05);'}">
                ${p.is_flex ? 'Flex Active' : 'Single Spec'}
              </span>
            </td>
          `;
          leaderboardBody.appendChild(row);
        });
      }

    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to load Spec-Flex calibrator:", error);
    resultsContainer.innerHTML = `<div style="color: #ef4444; font-size: 13px;">Error loading Spec-Flex finder data.</div>`;
    leaderboardBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">Error fetching roster consistency database records.</td></tr>`;
  }
}

// 5. "Raid Coach" Conversational Chat Drawer (Gemini AI Client)
function openRaidCoachDrawer() {
  const drawer = document.getElementById("raidCoachDrawer");
  const metaText = document.getElementById("coachActiveEncounterName");
  
  if (!drawer) return;
  
  drawer.classList.remove("hidden");
  setTimeout(() => drawer.classList.add("active"), 10);
  
  // Identify active fight boss
  if (currentReportData && currentReportData.analyses && currentReportData.analyses[selectedAnalysisIndex]) {
    const analysis = currentReportData.analyses[selectedAnalysisIndex];
    if (metaText) {
      metaText.innerText = `${analysis.fight.name} (${analysis.fight.kill ? 'Kill' : 'Wipe pull'})`;
    }
  } else {
    if (metaText) metaText.innerText = "Weekly Guild Raid Overview (Mock pull)";
  }
}

function closeRaidCoachDrawer() {
  const drawer = document.getElementById("raidCoachDrawer");
  if (!drawer) return;
  
  drawer.classList.remove("active");
  setTimeout(() => drawer.classList.add("hidden"), 250);
}

function appendCoachBubble(sender, text) {
  const container = document.getElementById("coachChatMessages");
  if (!container) return;
  
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  
  // Support formatting for code blocks or bold tags
  // Replace newlines with <br> and wrap markdown style code in code fencing style
  let formattedText = text
    .replace(/\*\*(.*?)\*\"/g, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
    
  bubble.innerHTML = formattedText;
  container.appendChild(bubble);
  
  // Auto-scroll chat area
  container.scrollTop = container.scrollHeight;
}

function showCoachTypingIndicator() {
  const container = document.getElementById("coachChatMessages");
  if (!container || isRaidCoachTyping) return;
  
  isRaidCoachTyping = true;
  
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble coach typing-bubble";
  bubble.id = "coachTypingIndicator";
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function removeCoachTypingIndicator() {
  const indicator = document.getElementById("coachTypingIndicator");
  if (indicator) {
    indicator.remove();
  }
  isRaidCoachTyping = false;
}

async function sendCoachMessage() {
  const input = document.getElementById("coachChatInput");
  if (!input) return;
  
  const query = input.value.trim();
  if (!query) return;
  
  input.value = "";
  await submitCoachQuery(query);
}

async function submitCoachQuery(queryText) {
  if (isRaidCoachTyping) return;
  
  // 1. Append user bubble
  appendCoachBubble("user", queryText);
  
  // 2. Show AI typing animation
  showCoachTypingIndicator();
  
  // 3. Check if premium lock is active
  const lockScreen = document.getElementById("guildSuitePremiumLock");
  const isLocked = lockScreen && !lockScreen.classList.contains("hidden");

  if (isLocked) {
    // Generate beautiful preview mock query response after 1.2s delay
    setTimeout(() => {
      removeCoachTypingIndicator();
      
      let mockReply = "";
      const q = queryText.toLowerCase();
      if (q.includes("wipe") || q.includes("why")) {
        mockReply = "**Raid Coach Analysis:** On our **Midnight Falls** pull, the wipe was caused by avoidable mechanic failures during Phase 2. Players stood inside the *Void Eruption* circles, taking unmitigated ticks. **SwirlyCatcher** died first, which caused a snowball DPS deficit.\n\nWe need to dodge those swirls and make sure a defensive CD is running!";
      } else if (q.includes("heal") || q.includes("cooldown") || q.includes("overlap")) {
        mockReply = "**Raid Coach Healer Audit:** I reviewed the healing cooldown rotation for this pull. We had a wasteful concurrent overlap of **Divine Hymn** and **Tranquility** at 01:18, leading to 82% overhealing. We also had a 1.2M damage dry spell starvation at 02:30. Spreading these out will easily keep the raid healthy!";
      } else {
        mockReply = "**Raid Coach:** Welcome to the Patreon Premium preview! To query live combat logs dynamically using Gemini AI Studio, unlock the full Command Center using settings or our Patreon connection.";
      }
      appendCoachBubble("coach", mockReply);
    }, 1200);
    return;
  }

  try {
    // Premium query backend endpoint
    const response = await fetch("/api/guild/coach-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        job_id: currentJobId,
        analysis_index: selectedAnalysisIndex,
        message: queryText
      })
    });

    removeCoachTypingIndicator();

    if (response.ok) {
      const data = await response.json();
      appendCoachBubble("coach", data.reply);
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    removeCoachTypingIndicator();
    console.error("Failed to query Raid Coach:", error);
    appendCoachBubble("coach", `**Raid Coach System Error:** I couldn't reach the AI analysis servers to review this pull: ${error.message}. Please check your connection or GEMINI_API_KEY settings.`);
  }
}


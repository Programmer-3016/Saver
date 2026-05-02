// Saver App — Onboarding + section routing.
// Manages the multi-step onboarding wizard and live preview panel.

// ── Mode configurations ──────────────────────────────────────────
const modeConfig = {
  fixed: {
    label: "Fixed Income",
    note: "Regular monthly salary ya stipend ko ek realistic daily spend number me convert karo.",
    incomeLabel: "Monthly income",
    fixedLabel: "Must-pay monthly expenses",
    reserveLabel: "Monthly savings target",
    cycle: "monthly",
    cycleLocked: true,
  },
  irregular: {
    label: "Irregular Income",
    note: "Jo paisa currently available hai usko runway aur safe daily spend me tod do.",
    incomeLabel: "Money available right now",
    fixedLabel: "Committed essentials",
    reserveLabel: "Reserve / safety buffer",
    cycle: "weekly",
    cycleLocked: false,
  },
  allowance: {
    label: "Allowance",
    note: "Pocket money ko controlled spending aur small savings habit me badlo.",
    incomeLabel: "Pocket money amount",
    fixedLabel: "Expected needs",
    reserveLabel: "Savings goal for this cycle",
    cycle: "weekly",
    cycleLocked: false,
  },
};

const stepMeta = {
  1: {
    title: "How do you usually receive money?",
    subtitle: "Choose the mode that best describes your income pattern.",
  },
  2: {
    title: "Set up your real money picture",
    subtitle: "Enter your numbers — we\u2019ll calculate your safe daily spend.",
  },
  3: {
    title: "Give your savings a name",
    subtitle: "Pick a goal and a target amount to start saving toward.",
  },
  4: {
    title: "You\u2019re all set!",
    subtitle: "",
  },
};

// ── State ─────────────────────────────────────────────────────────
const state = {
  step: 1,
  mode: "",
  cycle: "monthly",
  income: 0,
  fixed: 0,
  reserve: 0,
  goalName: "Emergency Buffer",
  goalTarget: 0,
  goalReason: "",
};

// ── DOM refs ──────────────────────────────────────────────────────
function $(sel) {
  return document.querySelector(sel);
}
function $$(sel) {
  return [...document.querySelectorAll(sel)];
}

const dom = {
  stepCount: $("#step-count"),
  stepTitle: $("#step-title"),
  stepSubtitle: $("#step-subtitle"),
  progressFill: $("#progress-fill"),
  stepPanels: $$(".step-panel"),
  stepNav: $("#step-nav"),
  modeCards: $$(".mode-card"),
  incomeLabel: $("#income-label"),
  fixedLabel: $("#fixed-label"),
  reserveLabel: $("#reserve-label"),
  setupNote: $("#setup-note"),
  incomeInput: $("#income-input"),
  fixedInput: $("#fixed-input"),
  reserveInput: $("#reserve-input"),
  cycleButtons: $$(".cycle-btn"),
  goalChips: $$(".goal-chip"),
  goalTargetInput: $("#goal-target-input"),
  goalReasonInput: $("#goal-reason-input"),
  backBtn: $("#back-btn"),
  nextBtn: $("#next-btn"),
  // Desktop preview
  previewDaily: $("#preview-daily"),
  previewCaption: $("#preview-caption"),
  previewMode: $("#preview-mode"),
  previewFreeBudget: $("#preview-free-budget"),
  previewReserve: $("#preview-reserve"),
  previewCycle: $("#preview-cycle"),
  previewGoalName: $("#preview-goal-name"),
  previewGoalMeta: $("#preview-goal-meta"),
  previewInsight: $("#preview-insight"),
  // Mobile preview
  mobilePreviewDaily: $("#mobile-preview-daily"),
  mobilePreviewMode: $("#mobile-preview-mode"),
  mobilePreviewFree: $("#mobile-preview-free"),
  mobilePreviewReserve: $("#mobile-preview-reserve"),
  mobilePreviewInsight: $("#mobile-preview-insight"),
  // Completion
  finalDaily: $("#final-daily"),
  finalCaption: $("#final-caption"),
  finalSummary: $("#final-summary"),
  startDashboardBtn: $("#start-dashboard-btn"),
};

// ── Helpers ───────────────────────────────────────────────────────
function formatCurrency(value) {
  const num = Number.isFinite(value) ? value : 0;
  return "\u20B9" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
}

function computePreview() {
  const freeBudget = Math.max(state.income - state.fixed - state.reserve, 0);
  const cycleDays = state.cycle === "monthly" ? 30 : 7;
  const safeDaily = freeBudget / cycleDays;

  let caption = "Choose a money mode to begin.";
  let insight =
    "Saver ka core job bas record rakhna nahi hai. Yeh batana hai ki tum aaj kitna safely spend kar sakte ho.";

  if (state.mode) {
    caption = `${formatCurrency(freeBudget)} flexible money after essentials and reserve.`;

    if (freeBudget === 0 && state.income > 0) {
      insight = "Almost all money is committed. Dashboard will show low-balance guidance.";
    } else if (safeDaily <= 120 && freeBudget > 0) {
      insight = "Daily safe spend tight hai — small spends clearly visible honge.";
    } else if (state.mode === "allowance") {
      insight = "Weekly rhythm important hai. Dashboard me quick glance aur goal nudges strong rahenge.";
    } else if (state.mode === "fixed") {
      insight = "Fixed income ke liye salary cycle framing useful hoti hai. Next-payday clarity dikhayenge.";
    } else {
      insight = "Irregular income ke liye runway clarity sabse important hai.";
    }
  }

  let goalMeta = "Add a target to estimate progress.";
  if (state.goalTarget > 0 && state.reserve > 0) {
    const cyclesNeeded = Math.ceil(state.goalTarget / Math.max(state.reserve, 1));
    const unit = state.cycle === "monthly" ? "month" : "week";
    goalMeta = `At this pace, ~${cyclesNeeded} ${unit}${cyclesNeeded > 1 ? "s" : ""}.`;
  }

  return { freeBudget, safeDaily, caption, insight, goalMeta };
}

// ── Sync functions ────────────────────────────────────────────────
function syncPreview() {
  const config = state.mode ? modeConfig[state.mode] : null;
  const p = computePreview();

  // Desktop
  if (dom.previewDaily) dom.previewDaily.textContent = formatCurrency(p.safeDaily);
  if (dom.previewCaption) dom.previewCaption.textContent = p.caption;
  if (dom.previewMode) dom.previewMode.textContent = config ? config.label : "Not selected";
  if (dom.previewFreeBudget) dom.previewFreeBudget.textContent = formatCurrency(p.freeBudget);
  if (dom.previewReserve) dom.previewReserve.textContent = formatCurrency(state.reserve);
  if (dom.previewCycle)
    dom.previewCycle.textContent = state.cycle.charAt(0).toUpperCase() + state.cycle.slice(1);
  if (dom.previewGoalName) dom.previewGoalName.textContent = state.goalName;
  if (dom.previewGoalMeta) dom.previewGoalMeta.textContent = p.goalMeta;
  if (dom.previewInsight) dom.previewInsight.textContent = p.insight;

  // Mobile
  if (dom.mobilePreviewDaily) dom.mobilePreviewDaily.textContent = formatCurrency(p.safeDaily) + "/day";
  if (dom.mobilePreviewMode) dom.mobilePreviewMode.textContent = config ? config.label : "Not selected";
  if (dom.mobilePreviewFree) dom.mobilePreviewFree.textContent = formatCurrency(p.freeBudget);
  if (dom.mobilePreviewReserve) dom.mobilePreviewReserve.textContent = formatCurrency(state.reserve);
  if (dom.mobilePreviewInsight) dom.mobilePreviewInsight.textContent = p.insight;
}

function syncStep() {
  // Toggle panels
  dom.stepPanels.forEach((panel) => {
    const stepNum = Number(panel.dataset.step);
    panel.classList.toggle("is-active", stepNum === state.step);
  });

  // Header
  const meta = stepMeta[state.step];
  dom.stepCount.textContent = String(Math.min(state.step, 3));
  dom.stepTitle.textContent = meta.title;
  dom.stepSubtitle.textContent = meta.subtitle;

  // Progress bar
  const pct = state.step === 4 ? 100 : (state.step / 3) * 100;
  dom.progressFill.style.width = pct + "%";

  // Back button
  dom.backBtn.disabled = state.step === 1;
  dom.backBtn.hidden = state.step === 4;

  // Next button
  if (state.step === 1) {
    dom.nextBtn.textContent = "Continue";
    dom.nextBtn.disabled = !state.mode;
  } else if (state.step === 2) {
    dom.nextBtn.textContent = "Continue";
    dom.nextBtn.disabled = state.income <= 0;
  } else if (state.step === 3) {
    dom.nextBtn.textContent = "Finish Setup";
    dom.nextBtn.disabled = false;
  } else {
    dom.nextBtn.hidden = true;
  }

  if (state.step !== 4) {
    dom.nextBtn.hidden = false;
  }

  // Hide step nav on completion
  dom.stepNav.style.display = state.step === 4 ? "none" : "";
}

function applyModeConfig() {
  const config = state.mode ? modeConfig[state.mode] : null;
  if (!config) return;

  state.cycle = config.cycle;

  dom.incomeLabel.textContent = config.incomeLabel;
  dom.fixedLabel.textContent = config.fixedLabel;
  dom.reserveLabel.textContent = config.reserveLabel;
  dom.setupNote.textContent = config.note;

  dom.cycleButtons.forEach((btn) => {
    const locked = config.cycleLocked && btn.dataset.cycle !== config.cycle;
    btn.disabled = locked;
    btn.style.opacity = locked ? "0.4" : "1";
    btn.classList.toggle("is-selected", btn.dataset.cycle === state.cycle);
  });

  syncPreview();
}

function syncFinalSummary() {
  const p = computePreview();
  const modeLabel = state.mode ? modeConfig[state.mode].label : "this mode";

  dom.finalDaily.textContent = formatCurrency(p.safeDaily);
  dom.finalCaption.textContent = p.caption;
  dom.finalSummary.textContent = `${modeLabel} setup ke basis par ${formatCurrency(p.safeDaily)} per day safe spend dikhega. Dashboard me transactions, goals, aur spending insights milenge.`;
}

// ── Event handlers ────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  dom.modeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.mode === mode);
  });
  applyModeConfig();
  syncStep();
}

function updateNumber(input, key) {
  // Strip non-numeric chars
  const clean = input.value.replace(/[^0-9]/g, "");
  input.value = clean;
  state[key] = Number(clean) || 0;
  syncPreview();
  syncStep();
}

function goNext() {
  if (state.step >= 4) return;
  if (state.step === 1 && !state.mode) return;

  state.step += 1;

  if (state.step === 4) {
    syncFinalSummary();
    saveState();
  }

  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack() {
  if (state.step <= 1) return;
  state.step -= 1;
  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Persistence ───────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem("saver_onboarding", JSON.stringify(state));
  } catch (_) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem("saver_onboarding");
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
      return true;
    }
  } catch (_) {}
  return false;
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  const hadState = loadState();

  // Bind mode cards
  dom.modeCards.forEach((card) => {
    card.addEventListener("click", () => setMode(card.dataset.mode));
  });

  // Bind cycle buttons
  dom.cycleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const config = state.mode ? modeConfig[state.mode] : null;
      if (config?.cycleLocked) return;

      state.cycle = btn.dataset.cycle;
      dom.cycleButtons.forEach((b) => {
        b.classList.toggle("is-selected", b === btn);
      });
      syncPreview();
    });
  });

  // Bind goal chips
  dom.goalChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.goalName = chip.dataset.goal;
      dom.goalChips.forEach((c) => {
        c.classList.toggle("is-selected", c === chip);
      });
      syncPreview();
    });
  });

  // Bind number inputs
  dom.incomeInput.addEventListener("input", () => updateNumber(dom.incomeInput, "income"));
  dom.fixedInput.addEventListener("input", () => updateNumber(dom.fixedInput, "fixed"));
  dom.reserveInput.addEventListener("input", () => updateNumber(dom.reserveInput, "reserve"));

  dom.goalTargetInput.addEventListener("input", () => {
    const clean = dom.goalTargetInput.value.replace(/[^0-9]/g, "");
    dom.goalTargetInput.value = clean;
    state.goalTarget = Number(clean) || 0;
    syncPreview();
  });

  dom.goalReasonInput.addEventListener("input", () => {
    state.goalReason = dom.goalReasonInput.value.trim();
  });

  // Bind nav
  dom.backBtn.addEventListener("click", goBack);
  dom.nextBtn.addEventListener("click", goNext);

  // Start dashboard button
  dom.startDashboardBtn.addEventListener("click", () => {
    saveState();
    // Future: switch to dashboard section
    alert("Dashboard coming soon! Your setup is saved.");
  });

  // Restore state if saved
  if (hadState && state.mode) {
    // Restore mode card selection
    dom.modeCards.forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.mode === state.mode);
    });

    // Restore inputs
    if (state.income) dom.incomeInput.value = state.income;
    if (state.fixed) dom.fixedInput.value = state.fixed;
    if (state.reserve) dom.reserveInput.value = state.reserve;
    if (state.goalTarget) dom.goalTargetInput.value = state.goalTarget;
    if (state.goalReason) dom.goalReasonInput.value = state.goalReason;

    // Restore goal chip
    dom.goalChips.forEach((c) => {
      c.classList.toggle("is-selected", c.dataset.goal === state.goalName);
    });

    applyModeConfig();

    if (state.step === 4) {
      syncFinalSummary();
    }
  }

  syncStep();
  syncPreview();
}

init();

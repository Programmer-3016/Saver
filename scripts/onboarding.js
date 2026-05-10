/**
 * Saver — Onboarding Wizard
 *
 * Powers the multi-step onboarding wizard in onboarding.html.
 * Manages step transitions, user state, the live preview panel,
 * and persists progress to localStorage so users can resume later.
 *
 * Flow: Step 1 (Mode) → Step 2 (Money) → Step 3 (Goal) → Step 4 (Done) → dashboard.html
 *
 * Depends on: shared.js (must be loaded first)
 */

// ── Mode Configurations ──────────────────────────────────────────
// Each income type has a label and contextual note shown in Step 2.
// These notes help the user understand how Saver will use their data.

const modeConfig = {
  fixed: {
    label: "Fixed Income",
    note: "Your salary or stipend will be used to calculate free spending money.",
  },
  irregular: {
    label: "Irregular Income",
    note: "We'll work with whatever money you currently have available.",
  },
  allowance: {
    label: "Allowance",
    note: "Track your pocket money or travel savings clearly and efficiently.",
  },
};

// ── Step Metadata ────────────────────────────────────────────────
// Title and subtitle for each step, displayed in the header area.
// Step 4 is the completion screen — subtitle is empty by design.

const stepMeta = {
  1: {
    title: "How does money come to you?",
    subtitle: "Choose the mode that best describes your situation.",
  },
  2: {
    title: "Set your money",
    subtitle: "Tell us how much you have and how much you want to save.",
  },
  3: {
    title: "Why do you want to save?",
    subtitle: "Saving for something specific or building a safety net — your call.",
  },
  4: {
    title: "You're all set!",
    subtitle: "",
  },
};

// ── DOM References ───────────────────────────────────────────────
// All DOM elements cached once at startup to avoid repeated lookups.
// Grouped by the step/section they belong to for readability.

const dom = {
  // Header
  stepLabelText: $("#step-label-text"),
  stepTitle: $("#step-title"),
  stepSubtitle: $("#step-subtitle"),

  // Segmented progress bar (circles + connectors)
  stepNodes: $$("[data-step-node]"),
  stepConnectors: $$(".step-connector"),

  // Step panels (the actual form content for each step)
  stepPanels: $$(".step-panel"),
  stepContainer: $(".step-panel")?.parentElement,
  stepNav: $("#step-nav"),

  // Step 1 — Mode selection cards
  modeCards: $$(".mode-card"),

  // Step 2 — Money inputs and save mode
  totalMoneyInput: $("#total-money-input"),
  saveModeCards: $$(".save-mode-card"),
  customSaveSection: $("#custom-save-section"),
  customSaveInput: $("#custom-save-input"),
  smartSaveSection: $("#smart-save-section"),
  smartSaveAmount: $("#smart-save-amount"),
  setupNote: $("#setup-note"),

  // Step 3 — Goal type and specific item fields
  goalTypeCards: $$(".goal-type-card"),
  specificGoalSection: $("#specific-goal-section"),
  safetyGoalSection: $("#safety-goal-section"),
  goalItemInput: $("#goal-item-input"),
  goalPriceInput: $("#goal-price-input"),
  safetyPlanText: $("#safety-plan-text"),

  // Navigation buttons (Back / Continue)
  backBtn: $("#back-btn"),
  nextBtn: $("#next-btn"),

  // Desktop live preview panel (right side on large screens)
  previewFree: $("#preview-free"),
  previewCaption: $("#preview-caption"),
  previewMode: $("#preview-mode"),
  previewTotal: $("#preview-total"),
  previewSaving: $("#preview-saving"),
  previewFreeAmount: $("#preview-free-amount"),
  previewGoalIcon: $("#preview-goal-icon"),
  previewGoalName: $("#preview-goal-name"),
  previewGoalMeta: $("#preview-goal-meta"),
  previewInsight: $("#preview-insight"),

  // Mobile preview strip (shown on small screens below the form)
  mobilePreviewDaily: $("#mobile-preview-daily"),
  mobilePreviewMode: $("#mobile-preview-mode"),
  mobilePreviewFree: $("#mobile-preview-free"),
  mobilePreviewReserve: $("#mobile-preview-reserve"),
  mobilePreviewInsight: $("#mobile-preview-insight"),

  // Step 4 — Completion screen elements
  finalFree: $("#final-free"),
  finalCaption: $("#final-caption"),
  finalSummary: $("#final-summary"),
  startDashboardBtn: $("#start-dashboard-btn"),
};

// ═══════════════════════════════════════════════════════════════════
//  PROGRESS INDICATOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Updates the segmented step progress bar (1 Mode → 2 Money → 3 Goal).
 *
 * - Current step gets "is-active" (green circle with glow)
 * - Completed steps get "is-done" (green circle with checkmark)
 * - Connector lines between completed steps fill up
 * - Header label updates to "Step X of 3" or "Complete!"
 */

function syncStepProgress(step) {
  const clampedStep = Math.min(step, 3);

  // Mark each step circle as active, done, or default

  dom.stepNodes.forEach((node) => {
    const num = Number(node.dataset.stepNode);
    node.classList.remove("is-active", "is-done");
    if (num === clampedStep) node.classList.add("is-active");
    else if (num < clampedStep) node.classList.add("is-done");
  });

  // Fill connector lines between completed steps
  // connector[0] = between step 1→2, connector[1] = between step 2→3

  dom.stepConnectors.forEach((conn, i) => {
    const afterStep = i + 1;
    conn.classList.toggle("is-filled", clampedStep > afterStep);
  });

  // Update "Step X of 3" text in the header

  if (dom.stepLabelText) {
    dom.stepLabelText.textContent = step >= 4 ? "Complete!" : `Step ${clampedStep} of 3`;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PREVIEW COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculates all preview values from the current state.
 *
 * Returns an object with:
 * - effectiveSave: how much money is being saved
 * - freeMoney: how much is left to spend freely
 * - caption, insight: contextual text for the preview panel
 * - goalName, goalMeta, goalIcon: saving goal display info
 *
 * This is a pure function — it reads state but doesn't modify the DOM.
 */

function computePreview() {
  // Calculate effective save amount based on mode (smart = 30% auto)

  const effectiveSave =
    state.saveMode === "smart" ? Math.round(state.totalMoney * 0.3) : state.saveAmount;

  const freeMoney = Math.max(state.totalMoney - effectiveSave, 0);

  // Generate contextual messages based on the user's numbers

  let caption = "Enter your available money to get started.";
  let insight = "Saver shows you clearly how much you can freely spend and how much stays safe.";

  if (state.totalMoney > 0) {
    caption = `${formatCurrency(effectiveSave)} saved, ${formatCurrency(freeMoney)} free to spend.`;

    if (freeMoney === 0) {
      insight = "All money is going to savings — keep some flexibility to avoid frustration.";
    } else if (effectiveSave === 0) {
      insight =
        "Nothing is being saved. Even a small amount set aside makes a difference over time.";
    } else if (state.mode === "allowance") {
      insight = "Saving from pocket money is tough, but small consistent savings add up fast.";
    } else {
      insight = "Good balance — you can spend comfortably while building your savings.";
    }
  }

  // Goal-related preview info (Step 3)

  let goalName = "Choose your saving goal";
  let goalMeta = "Pick a goal type in Step 3.";
  let goalIcon = "savings";

  if (state.goalType === "specific") {
    goalIcon = "shopping_bag";
    goalName = state.goalItem || "Specific item";

    if (state.goalPrice > 0 && effectiveSave > 0) {
      const cyclesNeeded = Math.ceil(state.goalPrice / effectiveSave);
      goalMeta = `Save ${formatCurrency(effectiveSave)}/cycle → ~${cyclesNeeded} cycle${cyclesNeeded > 1 ? "s" : ""} to reach your goal.`;
    } else {
      goalMeta = "Enter the price — Saver will estimate the timeline.";
    }
  } else if (state.goalType === "safety") {
    goalIcon = "shield";
    goalName = "Safety Buffer";

    if (effectiveSave > 0) {
      const monthsFor5k = Math.ceil(5000 / effectiveSave);
      goalMeta = `${formatCurrency(effectiveSave)}/cycle → ~${monthsFor5k} cycles to build a ₹5,000 buffer.`;
    } else {
      goalMeta = "Set a saving amount — Saver will estimate the timeline.";
    }
  }

  return { effectiveSave, freeMoney, caption, insight, goalName, goalMeta, goalIcon };
}

// ═══════════════════════════════════════════════════════════════════
//  SYNC FUNCTIONS — Keep DOM in sync with state
// ═══════════════════════════════════════════════════════════════════

/**
 * Updates the live preview panel (both desktop and mobile) with
 * the latest calculated values. Called whenever state changes.
 */

function syncPreview() {
  const config = state.mode ? modeConfig[state.mode] : null;
  const p = computePreview();

  // Desktop preview panel (right sidebar on large screens)

  if (dom.previewFree) animateValue(dom.previewFree, formatCurrency(p.freeMoney));
  if (dom.previewCaption) dom.previewCaption.textContent = p.caption;
  if (dom.previewMode) dom.previewMode.textContent = config ? config.label : "Not selected";
  if (dom.previewTotal) animateValue(dom.previewTotal, formatCurrency(state.totalMoney));
  if (dom.previewSaving) animateValue(dom.previewSaving, formatCurrency(p.effectiveSave));
  if (dom.previewFreeAmount) animateValue(dom.previewFreeAmount, formatCurrency(p.freeMoney));
  if (dom.previewGoalIcon) dom.previewGoalIcon.textContent = p.goalIcon;
  if (dom.previewGoalName) dom.previewGoalName.textContent = p.goalName;
  if (dom.previewGoalMeta) dom.previewGoalMeta.textContent = p.goalMeta;
  if (dom.previewInsight) dom.previewInsight.textContent = p.insight;

  // Mobile preview strip (visible on small screens)

  if (dom.mobilePreviewDaily)
    dom.mobilePreviewDaily.textContent = formatCurrency(p.freeMoney) + " free";
  if (dom.mobilePreviewMode)
    dom.mobilePreviewMode.textContent = config ? config.label : "Not selected";
  if (dom.mobilePreviewFree) dom.mobilePreviewFree.textContent = formatCurrency(p.freeMoney);
  if (dom.mobilePreviewReserve)
    dom.mobilePreviewReserve.textContent = formatCurrency(p.effectiveSave);
  if (dom.mobilePreviewInsight) dom.mobilePreviewInsight.textContent = p.insight;

  // Smart suggestion display — shows recommended 30% save amount

  if (dom.smartSaveAmount && state.totalMoney > 0) {
    const smartAmount = Math.round(state.totalMoney * 0.3);
    dom.smartSaveAmount.textContent = `Save ${formatCurrency(smartAmount)}`;
  }

  // Safety plan text — calculates how long to build a ₹5,000 buffer

  if (dom.safetyPlanText && state.goalType === "safety") {
    if (p.effectiveSave > 0) {
      const months = Math.ceil(5000 / p.effectiveSave);
      dom.safetyPlanText.textContent = `Saving ${formatCurrency(p.effectiveSave)} per cycle builds a ₹5,000 safety net in ~${months} cycles. Saver will track your progress automatically.`;
    }
  }
}

/**
 * Synchronizes the entire step UI:
 * - Shows/hides the correct step panel
 * - Updates the header title and subtitle
 * - Updates the progress indicator
 * - Manages Back/Next button states and labels
 */

function syncStep() {
  // Show only the active step panel, hide others

  dom.stepPanels.forEach((panel) => {
    const stepNum = Number(panel.dataset.step);
    panel.classList.toggle("is-active", stepNum === state.step);
  });

  // Update header text from stepMeta

  const meta = stepMeta[state.step];
  dom.stepTitle.textContent = meta.title;
  dom.stepSubtitle.textContent = meta.subtitle;

  // Update the segmented progress bar circles + connectors

  syncStepProgress(state.step);

  // Back button — disabled on step 1, hidden on completion

  dom.backBtn.disabled = state.step === 1;
  dom.backBtn.hidden = state.step === 4;

  // Next button — label and disabled state depend on the current step

  if (state.step === 1) {
    dom.nextBtn.textContent = "Continue";
    dom.nextBtn.disabled = !state.mode;
  } else if (state.step === 2) {
    dom.nextBtn.textContent = "Continue";
    dom.nextBtn.disabled = state.totalMoney <= 0 || !state.saveMode;
  } else if (state.step === 3) {
    dom.nextBtn.textContent = "Finish Setup";
    dom.nextBtn.disabled = !state.goalType;
  } else {
    dom.nextBtn.hidden = true;
  }

  // Re-add the arrow icon if it was removed (happens when text changes)

  if (state.step !== 4) {
    dom.nextBtn.hidden = false;
    if (!dom.nextBtn.querySelector(".material-symbols-outlined")) {
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined text-lg";
      icon.textContent = "arrow_forward";
      dom.nextBtn.appendChild(icon);
    }
  }

  // Hide the entire nav bar on the completion screen

  dom.stepNav.style.display = state.step === 4 ? "none" : "";
}

/**
 * Populates the Step 4 completion screen with a personalized summary.
 * Shows the final "Free to Spend" amount and a text explanation.
 */

function syncFinalSummary() {
  const p = computePreview();
  const modeLabel = state.mode ? modeConfig[state.mode].label : "your setup";

  dom.finalFree.textContent = formatCurrency(p.freeMoney);
  dom.finalCaption.textContent = `${formatCurrency(p.effectiveSave)} is safely set aside.`;
  dom.finalSummary.textContent = `Based on your ${modeLabel} setup, you have ${formatCurrency(p.freeMoney)} to spend freely. Saver will help you track spending on your dashboard.`;
}

// ═══════════════════════════════════════════════════════════════════
//  EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

// Step 1 — Selects the user's income mode (fixed, irregular, allowance).
// Highlights the chosen card and shows a contextual note in Step 2.

function setMode(mode) {
  state.mode = mode;

  dom.modeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.mode === mode);
  });

  // Show the mode-specific note (e.g., "Your salary will be used to...")

  if (dom.setupNote && modeConfig[mode]) {
    dom.setupNote.textContent = modeConfig[mode].note;
  }

  syncStep();
  syncPreview();
}

// Step 2 — Selects save mode (custom amount vs smart 30% recommendation).
// Toggles visibility of the custom input or smart suggestion section.

function setSaveMode(mode) {
  state.saveMode = mode;

  dom.saveModeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.saveMode === mode);
  });

  // Show the matching input section, hide the other

  dom.customSaveSection.classList.toggle("hidden", mode !== "custom");
  dom.smartSaveSection.classList.toggle("hidden", mode !== "smart");

  // Auto-calculate 30% when smart mode is selected

  if (mode === "smart") {
    state.saveAmount = Math.round(state.totalMoney * 0.3);
  }

  syncStep();
  syncPreview();
}

// Step 3 — Selects goal type (specific item or safety buffer).
// Shows item name/price fields or the safety plan text accordingly.

function setGoalType(type) {
  state.goalType = type;

  dom.goalTypeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.goalType === type);
  });

  // Show the matching goal detail section

  dom.specificGoalSection.classList.toggle("hidden", type !== "specific");
  dom.safetyGoalSection.classList.toggle("hidden", type !== "safety");

  syncStep();
  syncPreview();
}

/**
 * Advances to the next step.
 *
 * Validates that the current step's required fields are filled before
 * allowing progression. Sets the slide direction for CSS animation.
 * On reaching Step 4, saves state and generates the final summary.
 */

function goNext() {
  if (state.step >= 4) return;
  if (state.step === 1 && !state.mode) return;
  if (state.step === 2 && (state.totalMoney <= 0 || !state.saveMode)) return;
  if (state.step === 3 && !state.goalType) return;

  // Tell CSS to slide the new panel in from the right (forward direction)

  dom.stepContainer?.setAttribute("data-direction", "forward");

  state.step += 1;

  // On completion, save progress and show the final summary

  if (state.step === 4) {
    syncFinalSummary();
    saveState();
  }

  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Goes back to the previous step.
 * Sets the slide direction so the panel animates in from the left.
 */

function goBack() {
  if (state.step <= 1) return;

  // Tell CSS to slide the panel in from the left (backward direction)

  dom.stepContainer?.setAttribute("data-direction", "backward");

  state.step -= 1;
  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ═══════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Boots the onboarding wizard:
 * 1. Loads any saved progress from localStorage
 * 2. If already completed, redirects to dashboard.html
 * 3. Binds click/input event listeners to all interactive elements
 * 4. Restores UI state to match the loaded data
 * 5. Runs initial sync to render the correct step
 */

function init() {
  const hadState = loadState();

  // If onboarding was already completed, go straight to dashboard

  if (hadState && state.onboardingComplete) {
    window.location.replace("dashboard.html");
    return;
  }

  // Step 1 — Mode card click handlers

  dom.modeCards.forEach((card) => {
    card.addEventListener("click", () => setMode(card.dataset.mode));
  });

  // Step 2 — Total money input

  dom.totalMoneyInput.addEventListener("input", () => {
    dom.totalMoneyInput.value = dom.totalMoneyInput.value.replace(/[^0-9]/g, "");
    state.totalMoney = Number(dom.totalMoneyInput.value) || 0;

    // Recalculate smart suggestion if smart mode is active

    if (state.saveMode === "smart") {
      state.saveAmount = Math.round(state.totalMoney * 0.3);
    }

    syncStep();
    syncPreview();
  });

  // Step 2 — Save mode card selection (custom vs smart)

  dom.saveModeCards.forEach((card) => {
    card.addEventListener("click", () => setSaveMode(card.dataset.saveMode));
  });

  // Step 2 — Custom save amount input

  dom.customSaveInput.addEventListener("input", () => {
    dom.customSaveInput.value = dom.customSaveInput.value.replace(/[^0-9]/g, "");
    state.saveAmount = Number(dom.customSaveInput.value) || 0;
    syncPreview();
  });

  // Step 3 — Goal type card selection

  dom.goalTypeCards.forEach((card) => {
    card.addEventListener("click", () => setGoalType(card.dataset.goalType));
  });

  // Step 3 — Goal item name input (for specific goal)

  dom.goalItemInput.addEventListener("input", () => {
    state.goalItem = dom.goalItemInput.value.trim();
    syncPreview();
  });

  // Step 3 — Goal price input (for specific goal)

  dom.goalPriceInput.addEventListener("input", () => {
    dom.goalPriceInput.value = dom.goalPriceInput.value.replace(/[^0-9]/g, "");
    state.goalPrice = Number(dom.goalPriceInput.value) || 0;
    syncPreview();
  });

  // Navigation — Next button advances the step

  dom.nextBtn.addEventListener("click", () => {
    goNext();
    saveState();
  });

  // Navigation — Back button returns to the previous step

  dom.backBtn.addEventListener("click", () => {
    goBack();
    saveState();
  });

  // Completion — Start Dashboard button redirects to dashboard

  dom.startDashboardBtn.addEventListener("click", () => {
    state.onboardingComplete = true;
    saveState();
    window.location.href = "dashboard.html";
  });

  // ── Restore saved state to UI ──────────────────────────────────
  // If the user previously completed some steps, re-apply their
  // selections so the UI matches what they see in the progress bar.

  if (hadState && state.mode) {
    // Restore mode card selection

    dom.modeCards.forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.mode === state.mode);
    });

    // Restore money + save mode

    if (state.totalMoney) dom.totalMoneyInput.value = state.totalMoney;
    if (state.saveMode) {
      setSaveMode(state.saveMode);
      if (state.saveMode === "custom" && state.saveAmount) {
        dom.customSaveInput.value = state.saveAmount;
      }
    }

    // Restore goal selections

    if (state.goalType) {
      setGoalType(state.goalType);
      if (state.goalType === "specific") {
        if (state.goalItem) dom.goalItemInput.value = state.goalItem;
        if (state.goalPrice) dom.goalPriceInput.value = state.goalPrice;
      }
    }

    // If they completed the wizard, show the final summary

    if (state.step === 4) {
      syncFinalSummary();
    }
  }

  // Initial render — show the correct step and preview values

  syncStep();
  syncPreview();
}

// ── Start the wizard ─────────────────────────────────────────────

init();

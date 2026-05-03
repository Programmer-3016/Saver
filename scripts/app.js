// Saver App — Onboarding + section routing.
// Manages the multi-step onboarding wizard and live preview panel.

// ── Mode configurations ──────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────
const state = {
  step: 1,
  mode: "",           // fixed, irregular, allowance
  totalMoney: 0,      // how much money is available
  saveMode: "",       // custom, smart
  saveAmount: 0,      // how much to save
  goalType: "",       // specific, safety
  goalItem: "",       // what to buy (if specific)
  goalPrice: 0,       // target price (if specific)
};

// ── DOM refs ──────────────────────────────────────────────────────
function $(sel) {
  return document.querySelector(sel);
}
function $$(sel) {
  return [...document.querySelectorAll(sel)];
}

const dom = {
  stepLabelText: $("#step-label-text"),
  stepTitle: $("#step-title"),
  stepSubtitle: $("#step-subtitle"),
  stepNodes: $$("[data-step-node]"),
  stepConnectors: $$(".step-connector"),
  stepPanels: $$(".step-panel"),
  stepNav: $("#step-nav"),
  modeCards: $$(".mode-card"),
  // Step 2
  totalMoneyInput: $("#total-money-input"),
  saveModeCards: $$(".save-mode-card"),
  customSaveSection: $("#custom-save-section"),
  customSaveInput: $("#custom-save-input"),
  smartSaveSection: $("#smart-save-section"),
  smartSaveAmount: $("#smart-save-amount"),
  setupNote: $("#setup-note"),
  // Step 3
  goalTypeCards: $$(".goal-type-card"),
  specificGoalSection: $("#specific-goal-section"),
  safetyGoalSection: $("#safety-goal-section"),
  goalItemInput: $("#goal-item-input"),
  goalPriceInput: $("#goal-price-input"),
  safetyPlanText: $("#safety-plan-text"),
  // Nav
  backBtn: $("#back-btn"),
  nextBtn: $("#next-btn"),
  // Preview
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
  // Mobile preview
  mobilePreviewDaily: $("#mobile-preview-daily"),
  mobilePreviewMode: $("#mobile-preview-mode"),
  mobilePreviewFree: $("#mobile-preview-free"),
  mobilePreviewReserve: $("#mobile-preview-reserve"),
  mobilePreviewInsight: $("#mobile-preview-insight"),
  // Completion
  finalFree: $("#final-free"),
  finalCaption: $("#final-caption"),
  finalSummary: $("#final-summary"),
  startDashboardBtn: $("#start-dashboard-btn"),
};

// ── Helpers ───────────────────────────────────────────────────────
function formatCurrency(value) {
  const num = Number.isFinite(value) ? value : 0;
  return "\u20B9" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
}

// Animates a text update with a pop effect
function animateValue(el, text) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("number-updated");
  // Trigger reflow to restart animation
  void el.offsetWidth;
  el.classList.add("number-updated");
}

/**
 * Updates the segmented step progress indicator.
 * Each step node gets is-active (current) or is-done (completed).
 * Connectors between completed steps get filled.
 */
function syncStepProgress(step) {
  const clampedStep = Math.min(step, 3);

  // Update step nodes
  dom.stepNodes.forEach((node) => {
    const num = Number(node.dataset.stepNode);
    node.classList.remove("is-active", "is-done");
    if (num === clampedStep) node.classList.add("is-active");
    else if (num < clampedStep) node.classList.add("is-done");
  });

  // Update connectors: connector[0] is between step 1→2, connector[1] is between step 2→3
  dom.stepConnectors.forEach((conn, i) => {
    const afterStep = i + 1; // connector after step 1, 2...
    conn.classList.toggle("is-filled", clampedStep > afterStep);
  });

  // Update header label
  if (dom.stepLabelText) {
    dom.stepLabelText.textContent = step >= 4 ? "Complete!" : `Step ${clampedStep} of 3`;
  }
}

function computePreview() {
  const effectiveSave = state.saveMode === "smart"
    ? Math.round(state.totalMoney * 0.3)
    : state.saveAmount;

  const freeMoney = Math.max(state.totalMoney - effectiveSave, 0);

  let caption = "Enter your available money to get started.";
  let insight = "Saver shows you clearly how much you can freely spend and how much stays safe.";

  if (state.totalMoney > 0) {
    caption = `${formatCurrency(effectiveSave)} saved, ${formatCurrency(freeMoney)} free to spend.`;

    if (freeMoney === 0) {
      insight = "All money is going to savings — keep some flexibility to avoid frustration.";
    } else if (effectiveSave === 0) {
      insight = "Nothing is being saved. Even a small amount set aside makes a difference over time.";
    } else if (state.mode === "allowance") {
      insight = "Saving from pocket money is tough, but small consistent savings add up fast.";
    } else {
      insight = "Good balance — you can spend comfortably while building your savings.";
    }
  }

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

// ── Sync functions ────────────────────────────────────────────────
function syncPreview() {
  const config = state.mode ? modeConfig[state.mode] : null;
  const p = computePreview();

  // Desktop preview
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

  // Mobile preview
  if (dom.mobilePreviewDaily) dom.mobilePreviewDaily.textContent = formatCurrency(p.freeMoney) + " free";
  if (dom.mobilePreviewMode) dom.mobilePreviewMode.textContent = config ? config.label : "Not selected";
  if (dom.mobilePreviewFree) dom.mobilePreviewFree.textContent = formatCurrency(p.freeMoney);
  if (dom.mobilePreviewReserve) dom.mobilePreviewReserve.textContent = formatCurrency(p.effectiveSave);
  if (dom.mobilePreviewInsight) dom.mobilePreviewInsight.textContent = p.insight;

  // Smart suggestion amount update
  if (dom.smartSaveAmount && state.totalMoney > 0) {
    const smartAmount = Math.round(state.totalMoney * 0.3);
    dom.smartSaveAmount.textContent = `Save ${formatCurrency(smartAmount)}`;
  }

  // Safety plan text
  if (dom.safetyPlanText && state.goalType === "safety") {
    const effectiveSave = state.saveMode === "smart"
      ? Math.round(state.totalMoney * 0.3)
      : state.saveAmount;
    if (effectiveSave > 0) {
      const months = Math.ceil(5000 / effectiveSave);
      dom.safetyPlanText.textContent =
        `Saving ${formatCurrency(effectiveSave)} per cycle builds a ₹5,000 safety net in ~${months} cycles. Saver will track your progress automatically.`;
    }
  }
}

function syncStep() {
  // Toggle panels
  dom.stepPanels.forEach((panel) => {
    const stepNum = Number(panel.dataset.step);
    panel.classList.toggle("is-active", stepNum === state.step);
  });

  // Header
  const meta = stepMeta[state.step];
  dom.stepTitle.textContent = meta.title;
  dom.stepSubtitle.textContent = meta.subtitle;

  // Step progress indicator
  syncStepProgress(state.step);

  // Back button
  dom.backBtn.disabled = state.step === 1;
  dom.backBtn.hidden = state.step === 4;

  // Next button logic
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

  if (state.step !== 4) {
    dom.nextBtn.hidden = false;
    // Re-add arrow icon if missing
    if (!dom.nextBtn.querySelector(".material-symbols-outlined")) {
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined text-lg";
      icon.textContent = "arrow_forward";
      dom.nextBtn.appendChild(icon);
    }
  }

  // Hide step nav on completion
  dom.stepNav.style.display = state.step === 4 ? "none" : "";
}

function syncFinalSummary() {
  const p = computePreview();
  const modeLabel = state.mode ? modeConfig[state.mode].label : "your setup";

  dom.finalFree.textContent = formatCurrency(p.freeMoney);
  dom.finalCaption.textContent = `${formatCurrency(p.effectiveSave)} is safely set aside.`;
  dom.finalSummary.textContent = `Based on your ${modeLabel} setup, you have ${formatCurrency(p.freeMoney)} to spend freely. Saver will help you track spending on your dashboard.`;
}

// ── Event handlers ────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  dom.modeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.mode === mode);
  });

  // Update setup note
  if (dom.setupNote && modeConfig[mode]) {
    dom.setupNote.textContent = modeConfig[mode].note;
  }

  syncStep();
  syncPreview();
}

function setSaveMode(mode) {
  state.saveMode = mode;
  dom.saveModeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.saveMode === mode);
  });

  // Toggle sections
  dom.customSaveSection.classList.toggle("hidden", mode !== "custom");
  dom.smartSaveSection.classList.toggle("hidden", mode !== "smart");

  // If smart, auto-calculate
  if (mode === "smart") {
    state.saveAmount = Math.round(state.totalMoney * 0.3);
  }

  syncStep();
  syncPreview();
}

function setGoalType(type) {
  state.goalType = type;
  dom.goalTypeCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.goalType === type);
  });

  // Toggle sections
  dom.specificGoalSection.classList.toggle("hidden", type !== "specific");
  dom.safetyGoalSection.classList.toggle("hidden", type !== "safety");

  syncStep();
  syncPreview();
}

function goNext() {
  if (state.step >= 4) return;
  if (state.step === 1 && !state.mode) return;
  if (state.step === 2 && (state.totalMoney <= 0 || !state.saveMode)) return;
  if (state.step === 3 && !state.goalType) return;

  // Set slide direction for animation
  dom.stepPanels[0]?.closest("div")?.parentElement?.setAttribute("data-direction", "forward");

  state.step += 1;

  if (state.step === 4) {
    syncFinalSummary();
    saveState();
    // Trigger confetti celebration after a short delay
    setTimeout(launchConfetti, 400);
  }

  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack() {
  if (state.step <= 1) return;

  // Set slide direction for animation
  dom.stepPanels[0]?.closest("div")?.parentElement?.setAttribute("data-direction", "backward");

  state.step -= 1;
  syncStep();
  syncPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Lightweight canvas confetti burst for the completion step.
 * Creates colorful particles that fall with gravity and fade out.
 */
function launchConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const colors = ["#0a4d3c", "#16a34a", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];
  const particles = [];

  // Create particles from multiple burst points
  for (let i = 0; i < 120; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      life: 1,
      decay: 0.008 + Math.random() * 0.008,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach((p) => {
      if (p.life <= 0) return;
      alive = true;

      p.x += p.vx;
      p.vy += 0.18; // gravity
      p.y += p.vy;
      p.vx *= 0.99; // air resistance
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (alive) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(animate);
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

  // Bind mode cards (Step 1)
  dom.modeCards.forEach((card) => {
    card.addEventListener("click", () => setMode(card.dataset.mode));
  });

  // Bind save mode cards (Step 2)
  dom.saveModeCards.forEach((card) => {
    card.addEventListener("click", () => setSaveMode(card.dataset.saveMode));
  });

  // Bind total money input
  dom.totalMoneyInput.addEventListener("input", () => {
    const clean = dom.totalMoneyInput.value.replace(/[^0-9]/g, "");
    dom.totalMoneyInput.value = clean;
    state.totalMoney = Number(clean) || 0;

    // Auto-update smart suggestion
    if (state.saveMode === "smart") {
      state.saveAmount = Math.round(state.totalMoney * 0.3);
    }

    syncPreview();
    syncStep();
  });

  // Bind custom save input
  dom.customSaveInput.addEventListener("input", () => {
    const clean = dom.customSaveInput.value.replace(/[^0-9]/g, "");
    dom.customSaveInput.value = clean;
    state.saveAmount = Number(clean) || 0;
    syncPreview();
    syncStep();
  });

  // Bind goal type cards (Step 3)
  dom.goalTypeCards.forEach((card) => {
    card.addEventListener("click", () => setGoalType(card.dataset.goalType));
  });

  // Bind goal item input
  dom.goalItemInput.addEventListener("input", () => {
    state.goalItem = dom.goalItemInput.value.trim();
    syncPreview();
  });

  // Bind goal price input
  dom.goalPriceInput.addEventListener("input", () => {
    const clean = dom.goalPriceInput.value.replace(/[^0-9]/g, "");
    dom.goalPriceInput.value = clean;
    state.goalPrice = Number(clean) || 0;
    syncPreview();
  });

  // Bind nav
  dom.backBtn.addEventListener("click", goBack);
  dom.nextBtn.addEventListener("click", goNext);

  // Start dashboard button
  dom.startDashboardBtn.addEventListener("click", () => {
    saveState();
    alert("Dashboard coming soon! Your setup has been saved.");
  });

  // Restore state if saved
  if (hadState && state.mode) {
    dom.modeCards.forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.mode === state.mode);
    });

    if (state.totalMoney) dom.totalMoneyInput.value = state.totalMoney;
    if (state.saveMode) {
      setSaveMode(state.saveMode);
      if (state.saveMode === "custom" && state.saveAmount) {
        dom.customSaveInput.value = state.saveAmount;
      }
    }

    if (state.goalType) {
      setGoalType(state.goalType);
      if (state.goalType === "specific") {
        if (state.goalItem) dom.goalItemInput.value = state.goalItem;
        if (state.goalPrice) dom.goalPriceInput.value = state.goalPrice;
      }
    }

    if (state.step === 4) {
      syncFinalSummary();
    }
  }

  syncStep();
  syncPreview();
}

init();

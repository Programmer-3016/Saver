/**
 * Saver — Dashboard
 *
 * Powers the premium bento-grid dashboard in dashboard.html.
 * Handles hero stats, spending chart, budget pulse, quick log,
 * category breakdown, tab switching, expense modal, and goal tracking.
 *
 * Depends on: shared.js (must be loaded first)
 */

// ── Category Config ──────────────────────────────────────────────
// Label + icon mapping for each expense/income category.

const categoryConfig = {
  food: { label: "Food", icon: "restaurant", color: "#1b4332" },
  transport: { label: "Transport", icon: "commute", color: "#3f6653" },
  entertainment: { label: "Fun", icon: "movie", color: "#a5d0b9" },
  shopping: { label: "Shopping", icon: "shopping_bag", color: "#c1ecd4" },
  bills: { label: "Bills", icon: "bolt", color: "#5a302f" },
  other: { label: "Other", icon: "receipt_long", color: "#e8e8e5" },
  income: { label: "Income", icon: "payments", color: "#059669" },
};

// ── Relative Date Label ──────────────────────────────────────────

function relativeDate(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// ── Date Helpers ─────────────────────────────────────────────────

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayName(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

// ═══════════════════════════════════════════════════════════════════
//  POPULATE DASHBOARD
// ═══════════════════════════════════════════════════════════════════

// Reads onboarding state + transactions to fill all dashboard elements.

function populateDashboard() {
  const txns = loadTransactions();

  // Compute effective save (same logic as onboarding)

  const effectiveSave =
    state.saveMode === "smart" ? Math.round(state.totalMoney * 0.3) : state.saveAmount;

  // Free to spend = total money minus savings

  const freeToSpend = state.totalMoney - effectiveSave;

  // Cycle length (default 30 days) and daily limit

  const cycleLength = 30;
  const dailyLimit = Math.round(freeToSpend / cycleLength);

  // Today's spending

  const today = startOfDay(new Date());
  const todaySpent = txns
    .filter((t) => t.category !== "income" && startOfDay(t.ts).getTime() === today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);
  const todayLeft = Math.max(dailyLimit - todaySpent, 0);

  // Days elapsed in cycle (simplified: days since first transaction or 1)

  const cycleStart = txns.length > 0 ? startOfDay(txns[0].ts) : today;
  const daysElapsed = Math.min(
    Math.floor((today - cycleStart) / 86400000) + 1,
    cycleLength
  );
  const daysLeft = cycleLength - daysElapsed;

  // ── Hero Cards ───────────────────────────────────────────────

  populateHeroCards(dailyLimit, todaySpent, todayLeft, freeToSpend, daysElapsed, cycleLength);

  // ── Spending Chart ───────────────────────────────────────────

  populateSpendingChart(txns, dailyLimit);

  // ── Budget Pulse ─────────────────────────────────────────────

  populateBudgetPulse(txns, dailyLimit, todaySpent);

  // ── Category Breakdown ───────────────────────────────────────

  populateCategoryBreakdown(txns);

  // ── Awareness Nudge ──────────────────────────────────────────

  populateNudge(todaySpent, dailyLimit, todayLeft, daysLeft);

  // ── Goals Tab ────────────────────────────────────────────────

  populateGoalCard(effectiveSave);

  // ── Transactions Tab ─────────────────────────────────────────

  renderAllTransactions(txns);

  // ── Avatar ───────────────────────────────────────────────────

  const avatar = $("#dash-avatar");

  if (avatar && state.mode) {
    avatar.textContent = state.mode === "salary" ? "S" : "F";
  }
}

// ═══════════════════════════════════════════════════════════════════
//  HERO CARDS
// ═══════════════════════════════════════════════════════════════════

function populateHeroCards(dailyLimit, todaySpent, todayLeft, freeToSpend, daysElapsed, cycleLength) {

  // Card 1: Today's Limit

  const limitEl = $("#hero-daily-limit");
  const spentEl = $("#hero-spent");
  const leftEl = $("#hero-left");

  if (limitEl) limitEl.textContent = formatCurrency(dailyLimit);
  if (spentEl) spentEl.textContent = `${formatCurrency(todaySpent)} spent`;
  if (leftEl) leftEl.textContent = `${formatCurrency(todayLeft)} left`;

  // Card 2: Free to Spend

  const ftsEl = $("#hero-free-to-spend");

  if (ftsEl) ftsEl.textContent = formatCurrency(freeToSpend);

  // Card 3: Days Left

  const daysTextEl = $("#hero-days-text");
  const daysBarEl = $("#hero-days-bar");
  const progress = Math.round((daysElapsed / cycleLength) * 100);

  if (daysTextEl) daysTextEl.textContent = `${daysElapsed} of ${cycleLength}`;
  if (daysBarEl) daysBarEl.style.width = `${progress}%`;
}

// ═══════════════════════════════════════════════════════════════════
//  SPENDING CHART
// ═══════════════════════════════════════════════════════════════════

function populateSpendingChart(txns, dailyLimit) {
  const container = $("#spending-chart");
  if (!container) return;

  // Build last 7 days of spending

  const days = [];
  const today = startOfDay(new Date());

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = startOfDay(d).getTime();

    const daySpent = txns
      .filter((t) => t.category !== "income" && startOfDay(t.ts).getTime() === dayStart)
      .reduce((sum, t) => sum + t.amount, 0);

    days.push({ date: d, spent: daySpent, name: getDayName(d) });
  }

  // Find max for scaling (at least dailyLimit so bars don't overflow)

  const maxSpent = Math.max(...days.map((d) => d.spent), dailyLimit, 1);

  // Clear old bars and re-draw the daily limit reference line

  container.innerHTML = "";

  const limitLineWrapper = document.createElement("div");
  limitLineWrapper.className =
    "absolute left-0 w-full border-t border-dashed border-outline-variant flex items-center";
  limitLineWrapper.style.top = `${Math.round((1 - dailyLimit / maxSpent) * 100)}%`;
  limitLineWrapper.innerHTML =
    '<span class="absolute right-0 -top-6 text-xs text-on-surface-variant bg-white px-2">Daily Limit</span>';
  container.appendChild(limitLineWrapper);

  // Generate bars

  days.forEach((day) => {
    const heightPercent = maxSpent > 0 ? Math.round((day.spent / maxSpent) * 100) : 0;
    const isOverLimit = day.spent > dailyLimit;
    const isToday = day.date.getTime() === today.getTime();

    const bar = document.createElement("div");
    bar.className = "flex-1 chart-bar relative group";
    bar.style.height = `${Math.max(heightPercent, 2)}%`;

    if (isOverLimit) {
      bar.style.backgroundColor = "#ba1a1a";
      bar.style.opacity = "0.8";
    } else if (isToday) {
      bar.style.backgroundColor = "#1b4332";
    } else {
      bar.style.backgroundColor = "#e8e8e5";
    }

    // Tooltip

    const tooltip = document.createElement("div");
    tooltip.className =
      "absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-inverse-surface text-inverse-on-surface text-xs py-1 px-2 rounded whitespace-nowrap z-10";
    tooltip.textContent = formatCurrency(day.spent);
    bar.appendChild(tooltip);

    container.appendChild(bar);
  });

  // Update labels

  const labelsEl = $("#spending-chart-labels");

  if (labelsEl) {
    labelsEl.innerHTML = days.map((d) => `<span>${d.name}</span>`).join("");
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BUDGET PULSE
// ═══════════════════════════════════════════════════════════════════

function populateBudgetPulse(txns, dailyLimit, todaySpent) {
  const statusEl = $("#budget-pulse-status");
  const streakEl = $("#budget-pulse-streak");
  const tipEl = $("#budget-pulse-tip");

  if (!statusEl) return;

  // Calculate streak: consecutive days ending today where spending <= dailyLimit

  const today = startOfDay(new Date());
  let streak = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = startOfDay(d).getTime();

    const daySpent = txns
      .filter((t) => t.category !== "income" && startOfDay(t.ts).getTime() === dayStart)
      .reduce((sum, t) => sum + t.amount, 0);

    if (daySpent > dailyLimit) break;
    if (daySpent > 0 || i === 0) streak++;
  }

  const isUnder = todaySpent <= dailyLimit;

  // Populate

  statusEl.textContent = isUnder ? "Under Limit ✓" : "Over Limit ✗";
  if (streakEl) streakEl.textContent = streak > 0 ? `${streak} day streak` : "";

  if (tipEl) {
    if (txns.length === 0) {
      tipEl.textContent = "Start logging expenses to see your streak!";
    } else if (isUnder) {
      const avgSaved = Math.round(dailyLimit - todaySpent);
      tipEl.textContent = `Keep it up! You're saving ~${formatCurrency(avgSaved)} today.`;
    } else {
      tipEl.textContent = `You're ${formatCurrency(todaySpent - dailyLimit)} over today. Try to balance tomorrow.`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  CATEGORY BREAKDOWN
// ═══════════════════════════════════════════════════════════════════

function populateCategoryBreakdown(txns) {
  const barEl = $("#category-stacked-bar");
  const chipsEl = $("#category-chips");

  if (!barEl || !chipsEl) return;

  // Sum spending by category (exclude income)

  const totals = {};
  let grandTotal = 0;

  txns.forEach((t) => {
    if (t.category === "income") return;
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    grandTotal += t.amount;
  });

  if (grandTotal === 0) {
    barEl.innerHTML = '<div class="bg-surface-container-high h-full w-full"></div>';
    chipsEl.innerHTML =
      '<span class="text-sm text-on-surface-variant">No spending data yet. Log your first expense!</span>';
    return;
  }

  // Sort categories by amount descending

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  // Stacked bar

  barEl.innerHTML = sorted
    .map(([cat, amt]) => {
      const pct = Math.round((amt / grandTotal) * 100);
      const color = categoryConfig[cat]?.color || "#717973";
      return `<div class="h-full" style="width:${pct}%;background:${color}"></div>`;
    })
    .join("");

  // Category chips

  chipsEl.innerHTML = sorted
    .map(([cat, amt]) => {
      const pct = Math.round((amt / grandTotal) * 100);
      const color = categoryConfig[cat]?.color || "#717973";
      const label = categoryConfig[cat]?.label || cat;
      return `
        <div class="bg-[#f5f3ee] px-3 py-2 rounded-lg flex items-center gap-2 min-w-[120px]">
          <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
          <div class="flex flex-col">
            <span class="text-xs text-on-surface-variant">${label}</span>
            <span class="font-body-md text-body-md font-medium text-on-background">${pct}%</span>
          </div>
        </div>`;
    })
    .join("");
}

// ═══════════════════════════════════════════════════════════════════
//  AWARENESS NUDGE
// ═══════════════════════════════════════════════════════════════════

function populateNudge(todaySpent, dailyLimit, todayLeft, daysLeft) {
  const titleEl = $("#nudge-title");
  const textEl = $("#nudge-text");

  if (!titleEl || !textEl) return;

  if (todaySpent === 0) {
    titleEl.textContent = "Fresh start!";
    textEl.textContent = "No spending logged today yet. Enjoy your day wisely!";
  } else if (todaySpent <= dailyLimit) {
    titleEl.textContent = "Good pace!";
    textEl.textContent = `You are ${formatCurrency(todayLeft)} under today's limit. Keep it up!`;
  } else {
    titleEl.textContent = "Heads up!";
    textEl.textContent = `You're ${formatCurrency(todaySpent - dailyLimit)} over today's limit. Try to cut back tomorrow.`;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GOAL CARD
// ═══════════════════════════════════════════════════════════════════

function populateGoalCard(effectiveSave) {
  const isSpecific = state.goalType === "specific";
  const goalName = isSpecific ? state.goalItem || "Your Item" : "Safety Buffer";
  const goalIcon = isSpecific ? "shopping_bag" : "shield";
  const goalTypeLabel = isSpecific ? "SPECIFIC ITEM" : "SAFETY BUFFER";
  const goalTarget = isSpecific ? state.goalPrice : 5000;
  const progress =
    goalTarget > 0 ? Math.min(Math.round((effectiveSave / goalTarget) * 100), 100) : 0;
  const cyclesNeeded = effectiveSave > 0 ? Math.ceil(goalTarget / effectiveSave) : 0;

  // Goals tab — these IDs exist in dashboard.html

  const gIds = [
    "goals-tab-icon",
    "goals-tab-name",
    "goals-tab-type",
    "goals-tab-progress",
    "goals-tab-percent",
    "goals-tab-bar",
    "goals-tab-meta",
  ];
  const gEls = gIds.map((id) => $(`#${id}`));

  if (gEls[0]) gEls[0].textContent = goalIcon;
  if (gEls[1]) gEls[1].textContent = goalName;
  if (gEls[2]) gEls[2].textContent = goalTypeLabel;
  if (gEls[3]) gEls[3].textContent = `${formatCurrency(effectiveSave)} saved per cycle`;
  if (gEls[4]) gEls[4].textContent = `${progress}%`;
  if (gEls[5]) gEls[5].style.width = `${progress}%`;
  if (gEls[6])
    gEls[6].textContent =
      cyclesNeeded > 0
        ? `At ${formatCurrency(effectiveSave)}/cycle, you'll reach ${formatCurrency(goalTarget)} in ~${cyclesNeeded} cycle${cyclesNeeded > 1 ? "s" : ""}. Keep going! 💪`
        : "Complete onboarding to set your saving goal.";
}

// ═══════════════════════════════════════════════════════════════════
//  TRANSACTION RENDERING
// ═══════════════════════════════════════════════════════════════════

function buildTransactionHTML(t, index) {
  const cat = categoryConfig[t.category] || categoryConfig.other;
  const isIncome = t.category === "income";

  // Alternating icon background for visual rhythm

  const isEven = index % 2 === 0;
  const iconBg = isIncome ? "bg-primary-fixed" : isEven ? "bg-[#F9F7F2]" : "bg-primary-fixed";
  const iconColor = isIncome
    ? "text-primary-container"
    : isEven
      ? "text-primary"
      : "text-primary-container";

  const amountPrefix = isIncome ? "+" : "-";
  const amountColor = isIncome ? "text-emerald-600" : "text-primary-container";
  const categoryColor = isIncome
    ? "text-emerald-600 uppercase tracking-wider"
    : "text-slate-500 uppercase tracking-wider";

  return `
    <div class="flex items-center justify-between group hover:bg-surface-container-low p-2 -m-2 rounded-xl transition-colors">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 ${iconBg} rounded-full flex items-center justify-center ${iconColor}">
          <span class="material-symbols-outlined">${cat.icon}</span>
        </div>
        <div>
          <p class="font-bold text-primary-container">${t.desc || cat.label}</p>
          <p class="text-xs ${categoryColor}">${cat.label}</p>
        </div>
      </div>
      <div class="text-right">
        <p class="font-bold ${amountColor}">${amountPrefix}${formatCurrency(t.amount)}</p>
        <p class="text-xs text-slate-400">${relativeDate(t.ts)}</p>
      </div>
    </div>`;
}

function renderAllTransactions(txns) {
  const container = $("#all-transactions-list");
  if (!container) return;

  if (txns.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-stone-300" style="font-size:32px">receipt_long</span>
        </div>
        <p class="text-stone-400 font-body-md text-[15px] mb-2">No transactions yet</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="space-y-6">${txns
    .slice()
    .reverse()
    .map((t, i) => buildTransactionHTML(t, i))
    .join("")}</div>`;
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD EVENTS
// ═══════════════════════════════════════════════════════════════════

// Binds all dashboard-specific event listeners. Called once on init.

function initDashboardEvents() {

  // Nav pill switching (top bar)

  $$(".nav-pill").forEach((pill) => {
    pill.addEventListener("click", () => switchTab(pill.dataset.tab));
  });

  // Mobile bottom nav tab switching

  $$(".mobile-nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Other [data-tab] elements (e.g., "Review Goals" button)

  $$("[data-tab]").forEach((btn) => {
    if (btn.classList.contains("nav-pill") || btn.classList.contains("mobile-nav-tab")) return;
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // FAB — opens the expense modal (desktop)

  const fab = $("#fab-add-expense");

  if (fab) fab.addEventListener("click", () => openExpenseModal());

  // Mobile bottom nav + button — opens the expense modal

  const mobileAdd = $("#mobile-add-expense");

  if (mobileAdd) mobileAdd.addEventListener("click", () => openExpenseModal());

  // Add Expense button (transactions tab)

  const addBtnAlt = $("#add-expense-btn-alt");

  if (addBtnAlt) addBtnAlt.addEventListener("click", () => openExpenseModal());

  // Quick Log category buttons — open modal with category pre-selected

  $$("[data-quick-cat]").forEach((btn) => {
    btn.addEventListener("click", () => openExpenseModal(btn.dataset.quickCat));
  });

  // Modal close

  const closeBtn = $("#expense-modal-close");
  const backdrop = $("#expense-modal-backdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeExpenseModal);
  if (backdrop) backdrop.addEventListener("click", closeExpenseModal);

  // Modal category chips

  $$("[data-modal-cat]").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$("[data-modal-cat]").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      modalState.category = chip.dataset.modalCat;
      validateExpenseForm();
    });
  });

  // Payment source selection (radio-style toggle)

  $$(".payment-source").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".payment-source").forEach((b) => {
        const isThis = b === btn;
        b.classList.toggle("is-active", isThis);
        b.classList.toggle("bg-surface-container-high", isThis);
        b.classList.toggle("border-outline-variant/30", isThis);
        b.classList.toggle("bg-surface-container-low", !isThis);
        b.classList.toggle("border-transparent", !isThis);
        b.querySelector(".source-check")?.classList.toggle("hidden", !isThis);
      });
      modalState.source = btn.dataset.source;
    });
  });

  // Modal inputs

  const amtInput = $("#expense-amount-input");
  const descInput = $("#expense-desc-input");

  if (amtInput)
    amtInput.addEventListener("input", () => {
      amtInput.value = amtInput.value.replace(/[^0-9]/g, "");
      modalState.amount = Number(amtInput.value) || 0;
      validateExpenseForm();
    });
  if (descInput)
    descInput.addEventListener("input", () => {
      modalState.desc = descInput.value.trim();
    });

  // Submit expense

  const submitBtn = $("#expense-submit-btn");

  if (submitBtn) submitBtn.addEventListener("click", submitExpense);
}

// ── Tab Switching ────────────────────────────────────────────────

function switchTab(tabName) {

  // Update desktop nav pills

  $$(".nav-pill").forEach((p) => p.classList.toggle("is-active", p.dataset.tab === tabName));

  // Update mobile bottom nav tabs

  $$(".mobile-nav-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabName));

  // Update panels

  $$(".dash-panel").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.panel === tabName);
  });
}

// ── Expense Modal ────────────────────────────────────────────────

const modalState = { amount: 0, desc: "", category: "", source: "savings" };

// Saved scroll position — used to restore after closing the modal

let savedScrollY = 0;

function lockBodyScroll() {
  savedScrollY = window.scrollY;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, savedScrollY);
}

function openExpenseModal(preCategory) {
  const modal = $("#expense-modal");
  if (!modal) return;

  // Reset form

  modalState.amount = 0;
  modalState.desc = "";
  modalState.category = preCategory || "";
  modalState.source = "savings";
  const amtInput = $("#expense-amount-input");
  const descInput = $("#expense-desc-input");

  if (amtInput) amtInput.value = "";
  if (descInput) descInput.value = "";

  // Pre-select category if provided

  $$("[data-modal-cat]").forEach((c) => {
    c.classList.toggle("is-active", c.dataset.modalCat === preCategory);
  });

  // Reset payment source selection

  $$(".payment-source").forEach((btn) => {
    const isDefault = btn.dataset.source === "savings";
    btn.classList.toggle("is-active", isDefault);
    btn.classList.toggle("bg-surface-container-high", isDefault);
    btn.classList.toggle("border-outline-variant/30", isDefault);
    btn.classList.toggle("bg-surface-container-low", !isDefault);
    btn.classList.toggle("border-transparent", !isDefault);
    btn.querySelector(".source-check")?.classList.toggle("hidden", !isDefault);
  });

  validateExpenseForm();
  modal.classList.remove("hidden");
  lockBodyScroll();
  if (amtInput) setTimeout(() => amtInput.focus(), 100);
}

function closeExpenseModal() {
  const modal = $("#expense-modal");

  if (modal) modal.classList.add("hidden");
  unlockBodyScroll();
}

function validateExpenseForm() {
  const btn = $("#expense-submit-btn");

  if (btn) btn.disabled = !(modalState.amount > 0 && modalState.category);
}

function submitExpense() {
  if (modalState.amount <= 0 || !modalState.category) return;

  const txns = loadTransactions();

  txns.push({
    amount: modalState.amount,
    desc: modalState.desc || categoryConfig[modalState.category]?.label || "Expense",
    category: modalState.category,
    source: modalState.source,
    ts: Date.now(),
  });

  saveTransactions(txns);
  closeExpenseModal();
  populateDashboard();
}

// ═══════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Boots the dashboard:
 * 1. Loads onboarding state from localStorage
 * 2. If not onboarded, redirects to onboarding.html
 * 3. Populates all dashboard data
 * 4. Binds event listeners
 */

function init() {
  const hadState = loadState();

  // If not onboarded yet, redirect to onboarding

  if (!hadState || !state.onboardingComplete) {
    window.location.replace("onboarding.html");
    return;
  }

  populateDashboard();
  initDashboardEvents();
}

// ── Start the dashboard ──────────────────────────────────────────

init();

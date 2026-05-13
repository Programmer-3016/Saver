/**
 * Saver — Dashboard
 *
 * Powers the premium bento-grid dashboard.
 * Handles hero stats, spending chart, budget pulse,
 * category breakdown, tab switching, expense modal, and goal tracking.
 *
 * Depends on: shared.js (must be loaded first)
 */

// Category config
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

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appRoute(pageName) {
  return window.saverSupabase?.pageUrl?.(pageName) || pageName;
}

// Relative date label
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

// Date helpers
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayName(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

// Populate dashboard
// Reads onboarding state + transactions to fill all dashboard elements.

function populateDashboard() {
  const txns = loadTransactions();

  // Compute effective save (mode-specific percentages)

  const smartPercent = state.mode === "allowance" ? 0.2 : 0.3;
  let baseMoney = state.totalMoney;

  if (state.mode === "fixed") baseMoney = state.salary || state.totalMoney;
  else if (state.mode === "allowance") baseMoney = state.allowanceAmount || state.totalMoney;

  const effectiveSave =
    state.saveMode === "smart" ? Math.round(baseMoney * smartPercent) : state.saveAmount;

  // Free to spend — mode-specific deductions

  let freeToSpend;
  if (state.mode === "fixed") {
    freeToSpend = baseMoney - (state.fixedExpenses || 0) - effectiveSave;
  } else {
    freeToSpend = baseMoney - effectiveSave;
  }
  freeToSpend = Math.max(freeToSpend, 0);

  // Cycle length — mode-specific durations

  let cycleLength = 30;
  if (state.mode === "irregular") cycleLength = state.cycleLength || 30;
  else if (state.mode === "allowance") cycleLength = state.cycleLength || 30;

  const dailyLimit = Math.round(freeToSpend / cycleLength);

  // Days elapsed in cycle

  const today = startOfDay(new Date());
  const cycleStart = txns.length > 0 ? startOfDay(txns[0].ts) : today;
  const daysElapsed = Math.min(Math.floor((today - cycleStart) / 86400000) + 1, cycleLength);

  // Total spent in entire cycle (for health ring + rollover)

  const totalSpentInCycle = txns
    .filter((t) => t.category !== "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const remainingBudget = Math.max(freeToSpend - totalSpentInCycle, 0);
  const daysRemaining = Math.max(cycleLength - daysElapsed, 1);

  // Rollover-adjusted daily limit — redistributes remaining budget across remaining days

  const rolloverDailyLimit = Math.round(remainingBudget / daysRemaining);

  // Today's spending

  const todaySpent = txns
    .filter((t) => t.category !== "income" && startOfDay(t.ts).getTime() === today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);
  const todayLeft = Math.max(rolloverDailyLimit - todaySpent, 0);

  // Hero cards
  populateHeroCards(rolloverDailyLimit, dailyLimit, todaySpent, todayLeft, freeToSpend, daysElapsed, cycleLength, remainingBudget);

  // Spending chart (uses base dailyLimit for reference line)
  populateSpendingChart(txns, dailyLimit);

  // Budget pulse (uses rollover limit for streak accuracy)
  populateBudgetPulse(txns, rolloverDailyLimit, todaySpent);

  // Category breakdown
  populateCategoryBreakdown(txns);

  // Awareness nudge
  populateNudge(todaySpent, rolloverDailyLimit, todayLeft, daysRemaining);

  // Goals tab
  populateGoalCard(effectiveSave);

  // Transactions tab
  renderAllTransactions(txns);

  // Avatar
  const avatar = $("#dash-avatar");

  if (avatar && state.mode) {
    const initials = { fixed: "F", irregular: "I", allowance: "A" };
    avatar.textContent = initials[state.mode] || "S";
  }

  // Profile tab
  populateProfileTab(txns, effectiveSave);
}

// Hero cards
function populateHeroCards(
  rolloverDailyLimit,
  baseDailyLimit,
  todaySpent,
  todayLeft,
  freeToSpend,
  daysElapsed,
  cycleLength,
  remainingBudget,
) {
  // Card 1: Today's Limit (rollover-adjusted)

  const limitEl = $("#hero-daily-limit");
  const spentEl = $("#hero-spent");
  const leftEl = $("#hero-left");

  if (limitEl) limitEl.textContent = formatCurrency(rolloverDailyLimit);
  if (spentEl) spentEl.textContent = `${formatCurrency(todaySpent)} spent`;
  if (leftEl) leftEl.textContent = `${formatCurrency(todayLeft)} left`;

  // Card 2: Free to Spend

  const ftsEl = $("#hero-free-to-spend");

  if (ftsEl) ftsEl.textContent = formatCurrency(freeToSpend);

  // Card 3: Budget Health Ring

  const ringArc = $("#health-ring-arc");
  const ringPct = $("#health-ring-pct");
  const ringAmount = $("#health-ring-amount");
  const ringDays = $("#health-ring-days");

  const healthPct = freeToSpend > 0 ? Math.round((remainingBudget / freeToSpend) * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - healthPct / 100);

  // Ring color based on health: green > 60%, amber 30-60%, red < 30%

  let ringColor = "#1b4332";
  if (healthPct <= 30) ringColor = "#ba1a1a";
  else if (healthPct <= 60) ringColor = "#e6a817";

  if (ringArc) {
    ringArc.style.strokeDashoffset = offset;
    ringArc.style.stroke = ringColor;
  }
  if (ringPct) {
    ringPct.textContent = `${healthPct}%`;
    ringPct.style.color = ringColor;
  }
  if (ringAmount) ringAmount.textContent = `${formatCurrency(remainingBudget)} left`;
  if (ringDays) ringDays.textContent = `Day ${daysElapsed} of ${cycleLength}`;
}

// Spending chart
// Holds the Chart.js instance so it can be destroyed on re-render

let spendingChartInstance = null;

function populateSpendingChart(txns, dailyLimit) {
  const canvas = $("#spending-chart");
  if (!canvas) return;

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

  // Destroy old chart before creating a new one

  if (spendingChartInstance) {
    spendingChartInstance.destroy();
    spendingChartInstance = null;
  }

  // Bar colors: over-limit = red, today = dark green, past = light

  const barColors = days.map((day) => {
    const isToday = day.date.getTime() === today.getTime();
    if (day.spent > dailyLimit) return "rgba(186, 26, 26, 0.8)";
    if (isToday) return "#1b4332";
    return "#e8e8e5";
  });

  const hoverColors = days.map(() => "#1b4332");

  // Create Chart.js bar chart

  spendingChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: days.map((d) => d.name),
      datasets: [
        {
          label: "Spending",
          data: days.map((d) => d.spent),
          backgroundColor: barColors,
          hoverBackgroundColor: hoverColors,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1b1c19",
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
          bodyFont: { family: "'Inter', sans-serif", size: 12, weight: 600 },
          padding: { x: 10, y: 6 },
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: () => "",
            label: (ctx) => formatCurrency(ctx.raw),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { family: "'Inter', sans-serif", size: 11 },
            color: "#9c9789",
          },
        },
        y: {
          display: false,
          beginAtZero: true,
          suggestedMax: Math.max(...days.map((d) => d.spent), dailyLimit) * 1.15,
        },
      },
    },

    // Draw the daily limit dashed line as a custom plugin

    plugins: [
      {
        id: "dailyLimitLine",
        afterDraw(chart) {
          const yScale = chart.scales.y;
          const ctx = chart.ctx;
          const yPos = yScale.getPixelForValue(dailyLimit);

          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "#c4c0b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(chart.chartArea.left, yPos);
          ctx.lineTo(chart.chartArea.right, yPos);
          ctx.stroke();

          // "Daily Limit" label

          ctx.setLineDash([]);
          ctx.font = "500 11px 'Inter', sans-serif";
          ctx.fillStyle = "#9c9789";
          ctx.textAlign = "right";
          ctx.fillText("Daily Limit", chart.chartArea.right, yPos - 6);
          ctx.restore();
        },
      },
    ],
  });
}

// Budget pulse
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

// Category breakdown
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
      const label = escapeHTML(categoryConfig[cat]?.label || cat);
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

// Awareness nudge
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

// Goal card
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

// Transaction rendering
function buildTransactionHTML(t, index) {
  const cat = categoryConfig[t.category] || categoryConfig.other;
  const isIncome = t.category === "income";
  const description = escapeHTML(t.desc || cat.label);
  const categoryLabel = escapeHTML(cat.label);
  const categoryIcon = escapeHTML(cat.icon);

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
          <span class="material-symbols-outlined">${categoryIcon}</span>
        </div>
        <div>
          <p class="font-bold text-primary-container">${description}</p>
          <p class="text-xs ${categoryColor}">${categoryLabel}</p>
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

// Profile tab
function populateProfileTab(txns, effectiveSave) {
  // Avatar initial

  const profileAvatar = $("#profile-avatar");

  if (profileAvatar && state.mode) {
    const initials = { fixed: "F", irregular: "I", allowance: "A" };
    profileAvatar.textContent = initials[state.mode] || "S";
  }

  // Mode badge

  const modeBadge = $("#profile-mode-badge");

  if (modeBadge && state.mode) {
    const modes = {
      fixed: { icon: "account_balance_wallet", label: "Fixed Income" },
      irregular: { icon: "work", label: "Irregular Income" },
      allowance: { icon: "school", label: "Allowance Mode" },
    };
    const m = modes[state.mode] || modes.fixed;
    modeBadge.innerHTML = `<span class="material-symbols-outlined text-sm">${m.icon}</span>${m.label}`;
  }

  // Stats

  const totalSpent = txns
    .filter((t) => t.category !== "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const savedEl = $("#profile-total-saved");
  const spentEl = $("#profile-total-spent");
  const countEl = $("#profile-txn-count");

  if (savedEl) savedEl.textContent = formatCurrency(effectiveSave);
  if (spentEl) spentEl.textContent = formatCurrency(totalSpent);
  if (countEl) countEl.textContent = txns.filter((t) => t.category !== "income").length;
}

// Dashboard events
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

  // Profile — Edit Profile (re-run onboarding)

  const editBtn = $("#profile-edit-btn");

  if (editBtn)
    editBtn.addEventListener("click", () => {
      window.location.href = appRoute("onboarding.html");
    });

  // Profile — Reset All Data

  const resetBtn = $("#profile-reset-btn");

  if (resetBtn)
    resetBtn.addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure? This will clear ALL your data — transactions, goals, and settings. This cannot be undone.",
        )
      ) {
        try {
          await resetDashboardData(window.currentSaverSession || null);
        } catch (error) {
          console.error("Could not reset profile data", error);
          clearSaverLocalData();
        }
        window.location.href = appRoute("onboarding.html");
      }
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

  // Success screen — Return to Dashboard

  const returnBtn = $("#success-return-btn");

  if (returnBtn)
    returnBtn.addEventListener("click", () => {
      closeExpenseModal();
      populateDashboard();
    });

  // Success screen — Add Another expense

  const addAnotherBtn = $("#success-add-another-btn");

  if (addAnotherBtn)
    addAnotherBtn.addEventListener("click", () => {
      showExpenseFormView();
      openExpenseModal();
    });
}

// Tab switching
function switchTab(tabName) {
  // Update desktop nav pills

  $$(".nav-pill").forEach((p) => {
    const isActive = p.dataset.tab === tabName;
    p.classList.toggle("is-active", isActive);
    p.setAttribute("aria-pressed", String(isActive));
  });

  // Update mobile bottom nav tabs

  $$(".mobile-nav-tab").forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle("is-active", isActive);
    t.setAttribute("aria-pressed", String(isActive));
  });

  // Update panels

  $$(".dash-panel").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.panel === tabName);
  });
}

// Expense modal
const modalState = { amount: 0, desc: "", category: "", source: "savings" };

// Saved scroll position — used to restore after closing the modal

let savedScrollY = 0;

function lockBodyScroll() {
  savedScrollY = window.scrollY;

  // Compensate for disappearing scrollbar to prevent layout shift

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = `${scrollbarWidth}px`;
  document.body.style.top = `-${savedScrollY}px`;

  // CSS class with !important (primary lock)

  document.documentElement.classList.add("scroll-locked");

  // Inline styles as fallback in case CSS is cached

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  document.documentElement.classList.remove("scroll-locked");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";
  document.body.style.top = "";
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
  lockBodyScroll();
  requestAnimationFrame(() => modal.classList.remove("hidden"));

  if (amtInput && window.matchMedia("(min-width: 640px)").matches) {
    setTimeout(() => amtInput.focus(), 120);
  }
}

function closeExpenseModal() {
  const modal = $("#expense-modal");

  if (modal) modal.classList.add("hidden");
  unlockBodyScroll();
  showExpenseFormView();
  populateDashboard();
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

  // Show success screen instead of closing

  showExpenseSuccessView();
}

// Success view helpers
const sourceLabels = {
  savings: "Savings Account",
  credit: "Credit Card",
  cash: "Cash",
};

/**
 * Switches the modal from the form to the success summary.
 * Populates all summary fields with the just-submitted data.
 */

function showExpenseSuccessView() {
  const formView = $("#expense-form-view");
  const successView = $("#expense-success-view");

  if (!formView || !successView) return;

  // Populate summary card

  const amountEl = $("#success-amount");
  const iconEl = $("#success-icon");
  const categoryEl = $("#success-category");
  const sourceEl = $("#success-source");
  const timeEl = $("#success-time");
  const cat = categoryConfig[modalState.category] || categoryConfig.other;

  if (amountEl) amountEl.textContent = formatCurrency(modalState.amount);
  if (iconEl) iconEl.textContent = cat.icon;
  if (categoryEl) categoryEl.textContent = cat.label;
  if (sourceEl) sourceEl.textContent = sourceLabels[modalState.source] || modalState.source;

  if (timeEl) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    timeEl.textContent = `Today, ${time}`;
  }

  // Toggle views

  formView.classList.add("hidden");
  successView.classList.remove("hidden");
  successView.classList.add("flex");
}

/**
 * Resets the modal back to the form view.
 */

function showExpenseFormView() {
  const formView = $("#expense-form-view");
  const successView = $("#expense-success-view");

  if (!formView || !successView) return;

  successView.classList.add("hidden");
  successView.classList.remove("flex");
  formView.classList.remove("hidden");
}

async function loadDashboardState(session) {
  if (window.saverSupabase?.isConfigured && window.saverSupabase?.loadOnboarding) {
    try {
      const remoteState = await window.saverSupabase.loadOnboarding(session);
      if (remoteState) {
        applyStateSnapshot(remoteState);
        saveState();
        return true;
      }
    } catch (error) {
      console.error("Could not load dashboard profile", error);
    }
  }

  return loadState();
}

async function resetDashboardData(session) {
  if (window.saverSupabase?.isConfigured && window.saverSupabase?.resetOnboarding) {
    await window.saverSupabase.resetOnboarding(session);
  }

  clearSaverLocalData();
}

// Initialization
/**
 * Boots the dashboard:
 * 1. Loads onboarding state from Supabase with local cache fallback
 * 2. If not onboarded, redirects to onboarding
 * 3. Populates all dashboard data
 * 4. Binds event listeners
 */

async function init() {
  let authSession = null;

  if (window.saverSupabase?.requireSession) {
    const session = await window.saverSupabase.requireSession();
    if (!session) return;
    authSession = session === true ? null : session;
    window.currentSaverSession = authSession;
  }

  const hadState = await loadDashboardState(authSession);

  // If not onboarded yet, redirect to onboarding

  if (!hadState || !state.onboardingComplete) {
    window.location.replace(appRoute("onboarding.html"));
    return;
  }

  populateDashboard();
  initDashboardEvents();
}

// Start the dashboard
init();

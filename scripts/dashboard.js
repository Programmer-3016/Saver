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

const transactionFilters = {
  query: "",
  type: "all",
  category: "all",
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

function cleanProfileText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function storedProfileValue(key) {
  try {
    return cleanProfileText(localStorage.getItem(key));
  } catch (_) {
    return "";
  }
}

function emailDisplayName(email) {
  const prefix = cleanProfileText(email).split("@")[0] || "";
  return prefix.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function profileDisplayName() {
  const email = cleanProfileText(state.profileEmail) || storedProfileValue("saverUserEmail");

  return (
    cleanProfileText(state.profileName) ||
    storedProfileValue("saverUserName") ||
    emailDisplayName(email) ||
    "Saver User"
  );
}

function profileInitial(name, email) {
  const source = cleanProfileText(name) || emailDisplayName(email) || "Saver";
  return source.charAt(0).toUpperCase() || "S";
}

function isIncomeTransaction(transaction) {
  return transaction?.kind === "income" || transaction?.category === "income";
}

function isExpenseTransaction(transaction) {
  return transaction && !isIncomeTransaction(transaction);
}

function transactionKind(transaction) {
  return isIncomeTransaction(transaction) ? "income" : "expense";
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

  const cycleIncome = txns.filter(isIncomeTransaction).reduce((sum, t) => sum + t.amount, 0);
  const currentMoney = baseMoney + cycleIncome;

  const effectiveSave =
    state.saveMode === "smart" ? Math.round(baseMoney * smartPercent) : state.saveAmount;

  // Free to spend — mode-specific deductions

  let freeToSpend;
  if (state.mode === "fixed") {
    freeToSpend = currentMoney - (state.fixedExpenses || 0) - effectiveSave;
  } else {
    freeToSpend = currentMoney - effectiveSave;
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
    .filter(isExpenseTransaction)
    .reduce((sum, t) => sum + t.amount, 0);
  const remainingBudget = Math.max(freeToSpend - totalSpentInCycle, 0);
  const daysRemaining = Math.max(cycleLength - daysElapsed, 1);

  // Rollover-adjusted daily limit — redistributes remaining budget across remaining days

  const rolloverDailyLimit = Math.round(remainingBudget / daysRemaining);

  state.dailyBudget = dailyLimit;
  state.freeToSpendAmount = freeToSpend;
  state.rolloverDailyLimit = rolloverDailyLimit;

  // Today's spending

  const todaySpent = txns
    .filter((t) => isExpenseTransaction(t) && startOfDay(t.ts).getTime() === today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);
  const todayLeft = Math.max(rolloverDailyLimit - todaySpent, 0);

  // Hero cards
  populateHeroCards(rolloverDailyLimit, todaySpent, todayLeft, freeToSpend, daysElapsed, cycleLength, remainingBudget);

  // Spending chart (uses base dailyLimit for reference line)
  populateSpendingChart(txns, dailyLimit);

  // Budget pulse (uses rollover limit for streak accuracy)
  populateBudgetPulse(txns, rolloverDailyLimit, todaySpent);

  // Category breakdown
  populateCategoryBreakdown(txns);

  // Weekly report card
  populateWeeklyReport(txns, dailyLimit);

  // Evening check-in (shows after 7 PM)
  populateEveningCheckin(todaySpent, rolloverDailyLimit);

  // Goals tab
  populateGoalCard(effectiveSave);

  // Transactions tab
  renderAllTransactions(txns);

  // Avatar
  const avatar = $("#dash-avatar");

  if (avatar) {
    avatar.textContent = profileInitial(
      profileDisplayName(),
      cleanProfileText(state.profileEmail) || storedProfileValue("saverUserEmail"),
    );
  }

  // Profile tab
  populateProfileTab(txns, effectiveSave);
}

// Hero cards

function populateHeroCards(
  rolloverDailyLimit,
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
      .filter((t) => isExpenseTransaction(t) && startOfDay(t.ts).getTime() === dayStart)
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

// Budget pulse — enhanced streak system

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
      .filter((t) => isExpenseTransaction(t) && startOfDay(t.ts).getTime() === dayStart)
      .reduce((sum, t) => sum + t.amount, 0);

    if (daySpent > dailyLimit) break;
    if (daySpent > 0 || i === 0) streak++;
  }

  const isUnder = todaySpent <= dailyLimit;

  // Streak fire levels

  let fireIcon = "🔥";
  let streakLabel = "streak";
  if (streak >= 30) { fireIcon = "🏆"; streakLabel = "LEGENDARY streak"; }
  else if (streak >= 14) { fireIcon = "🔥🔥🔥"; streakLabel = "fire streak"; }
  else if (streak >= 7) { fireIcon = "🔥🔥"; streakLabel = "hot streak"; }
  else if (streak >= 3) { fireIcon = "🔥"; streakLabel = "streak"; }

  // Populate status

  statusEl.textContent = isUnder ? "Under Limit ✓" : "Over Limit ✗";

  if (streakEl) {
    streakEl.textContent = streak > 0 ? `${fireIcon} ${streak} day ${streakLabel}` : "";
  }

  // Contextual tips based on streak milestones

  if (tipEl) {
    if (txns.length === 0) {
      tipEl.textContent = "Start logging expenses to see your streak!";
    } else if (!isUnder) {
      tipEl.textContent = `You're ${formatCurrency(todaySpent - dailyLimit)} over today. Try to balance tomorrow.`;
    } else if (streak >= 14) {
      tipEl.textContent = `${streak} days strong! You're building real financial discipline.`;
    } else if (streak >= 7) {
      tipEl.textContent = `A full week under budget! Keep this momentum going.`;
    } else if (streak >= 3) {
      tipEl.textContent = `${streak} days in a row — a habit is forming!`;
    } else {
      const avgSaved = Math.round(dailyLimit - todaySpent);
      tipEl.textContent = `Keep it up! You're saving ~${formatCurrency(avgSaved)} today.`;
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
    if (!isExpenseTransaction(t)) return;
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

// Weekly report card

function populateWeeklyReport(txns, dailyLimit) {
  const gradeEl = $("#report-grade");
  const gradeBg = $("#report-grade-bg");
  const subtitleEl = $("#report-subtitle");
  const daysPill = $("#report-days-pill");
  const spendPill = $("#report-spend-pill");

  if (!gradeEl) return;

  // Calculate last 7 days performance

  const today = startOfDay(new Date());
  let daysUnder = 0;
  let weeklySpend = 0;
  let activeDays = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = startOfDay(d).getTime();

    const daySpent = txns
      .filter((t) => isExpenseTransaction(t) && startOfDay(t.ts).getTime() === dayStart)
      .reduce((sum, t) => sum + t.amount, 0);

    weeklySpend += daySpent;
    if (daySpent > 0 || i === 0) activeDays++;
    if (daySpent <= dailyLimit) daysUnder++;
  }

  // Assign grade based on days under budget

  let grade, gradeColor, subtitle;

  if (activeDays === 0) {
    grade = "—";
    gradeColor = "#717973";
    subtitle = "Log expenses to see your grade";
  } else if (daysUnder === 7) {
    grade = "A+";
    gradeColor = "#1b4332";
    subtitle = "Perfect week! You're a budgeting pro 🌟";
  } else if (daysUnder >= 6) {
    grade = "A";
    gradeColor = "#1b4332";
    subtitle = "Excellent discipline this week!";
  } else if (daysUnder >= 5) {
    grade = "B";
    gradeColor = "#3f6653";
    subtitle = "Good week — small room to improve";
  } else if (daysUnder >= 4) {
    grade = "C";
    gradeColor = "#e6a817";
    subtitle = "Average week — let's tighten up!";
  } else if (daysUnder >= 2) {
    grade = "D";
    gradeColor = "#ba1a1a";
    subtitle = "Tough week — tomorrow is a fresh start";
  } else {
    grade = "F";
    gradeColor = "#ba1a1a";
    subtitle = "Over budget most days — time to reset";
  }

  // Populate

  gradeEl.textContent = grade;
  gradeEl.style.color = gradeColor;
  if (gradeBg) gradeBg.style.backgroundColor = `${gradeColor}10`;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  if (daysPill) {
    daysPill.childNodes[daysPill.childNodes.length - 1].textContent = ` ${daysUnder}/7 under budget`;
  }

  if (spendPill) {
    spendPill.childNodes[spendPill.childNodes.length - 1].textContent = ` ${formatCurrency(weeklySpend)} this week`;
  }
}

// Evening check-in — shows after 7 PM

function populateEveningCheckin(todaySpent, dailyLimit) {
  const checkinEl = $("#evening-checkin");
  const titleEl = $("#checkin-title");
  const summaryEl = $("#checkin-summary");
  const dismissBtn = $("#checkin-dismiss");

  if (!checkinEl) return;

  const hour = new Date().getHours();
  const todayKey = `checkin-dismissed-${new Date().toDateString()}`;

  // Only show after 7 PM and if not dismissed today

  if (hour < 19 || sessionStorage.getItem(todayKey)) {
    checkinEl.classList.add("hidden");
    return;
  }

  checkinEl.classList.remove("hidden");

  // Contextual title based on time

  if (hour >= 22) {
    titleEl.textContent = "Late night check! 🌙";
  } else if (hour >= 19) {
    titleEl.textContent = "Good evening! Here's your day ✨";
  }

  // Summary

  const saved = Math.max(dailyLimit - todaySpent, 0);

  if (todaySpent === 0) {
    summaryEl.textContent = "No expenses logged today — nothing spent!";
  } else if (todaySpent <= dailyLimit) {
    summaryEl.textContent = `You spent ${formatCurrency(todaySpent)} today — ${formatCurrency(saved)} saved! 🎉`;
  } else {
    const over = todaySpent - dailyLimit;
    summaryEl.textContent = `You spent ${formatCurrency(todaySpent)} today — ${formatCurrency(over)} over budget.`;
  }

  // Dismiss handler

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      checkinEl.classList.add("hidden");
      sessionStorage.setItem(todayKey, "1");
    }, { once: true });
  }
}

// Goal card

const goalTypeConfig = {
  custom: { label: "CUSTOM GOAL", icon: "savings", title: "Saving goal" },
  specific: { label: "SPECIFIC ITEM", icon: "shopping_bag", title: "Specific item" },
  safety: { label: "SAFETY BUFFER", icon: "shield", title: "Safety Buffer" },
};

const allowedDashboardGoalTypes = new Set(Object.keys(goalTypeConfig));

function createClientGoalId() {
  try {
    if (window.crypto?.randomUUID) return `goal_${window.crypto.randomUUID()}`;
  } catch (_) {}

  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanGoalType(type) {
  return allowedDashboardGoalTypes.has(type) ? type : "custom";
}

function normalizeGoal(goal = {}) {
  if (!goal || typeof goal !== "object") return null;

  const remoteId = cleanProfileText(goal.remoteId);
  const rawId = cleanProfileText(goal.id);
  const clientGoalId = cleanProfileText(goal.clientGoalId) || (!remoteId ? rawId : "");
  const id = rawId || remoteId || clientGoalId || createClientGoalId();
  const type = cleanGoalType(goal.type || goal.goalType);
  const title = cleanProfileText(goal.title || goal.goalItem) || goalTypeConfig[type].title;
  const targetAmount = Math.max(Number(goal.targetAmount ?? goal.goalPrice) || 0, 0);
  const savedAmount = Math.max(Number(goal.savedAmount ?? goal.saveAmount) || 0, 0);

  return {
    ...goal,
    id,
    remoteId,
    clientGoalId,
    type,
    title,
    targetAmount,
    savedAmount: Math.min(savedAmount, targetAmount || savedAmount),
    targetDate: cleanProfileText(goal.targetDate),
    isActive: goal.isActive !== false,
    syncStatus: remoteId ? "synced" : goal.syncStatus || "pending",
  };
}

function goalLookupKey(goal) {
  return cleanProfileText(goal?.remoteId || goal?.clientGoalId || goal?.id);
}

function goalsFromState() {
  return Array.isArray(state.savingsGoals)
    ? state.savingsGoals.map(normalizeGoal).filter(Boolean)
    : [];
}

function activeGoalFromState() {
  const goals = goalsFromState();
  const activeId = cleanProfileText(state.activeSavingsGoalId);
  const activeGoal = activeId
    ? goals.find((goal) => [goal.remoteId, goal.clientGoalId, goal.id].includes(activeId))
    : null;

  return activeGoal || goals.find((goal) => goal.isActive) || goals[0] || null;
}

function fallbackGoalFromOnboarding(effectiveSave) {
  const type = cleanGoalType(state.goalType || "safety");
  const isSpecific = type === "specific";
  const targetAmount = isSpecific
    ? Number(state.goalPrice) || Math.max(Number(state.saveAmount) * 3, 5000)
    : Math.max(Number(state.saveAmount) * 3, 5000);

  return {
    id: "onboarding-goal",
    clientGoalId: "onboarding-goal",
    type,
    title: isSpecific ? cleanProfileText(state.goalItem) || "Your Item" : goalTypeConfig[type].title,
    targetAmount,
    savedAmount: Math.max(Number(state.activeSavingsGoalSavedAmount) || effectiveSave || 0, 0),
    targetDate: "",
    isActive: true,
    isFallback: true,
    syncStatus: "local",
  };
}

function setSavingsGoals(nextGoals = []) {
  const normalized = nextGoals.map(normalizeGoal).filter(Boolean);
  const active = normalized.find((goal) => goal.isActive) || normalized[0] || null;

  state.savingsGoals = normalized;
  state.activeSavingsGoalId = active ? goalLookupKey(active) : null;
  state.goalType = active?.type || "";
  state.goalItem = active?.title || "";
  state.goalPrice = active?.targetAmount || 0;
  state.activeSavingsGoalSavedAmount = active?.savedAmount || 0;
  saveState();
}

function goalProgress(goal) {
  const target = Number(goal?.targetAmount) || 0;
  const saved = Math.max(Number(goal?.savedAmount) || 0, 0);
  const percent = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;

  return {
    target,
    saved,
    remaining: Math.max(target - saved, 0),
    percent,
  };
}

function goalCyclesNeeded(goal, effectiveSave) {
  const { remaining } = goalProgress(goal);
  const cycleSaving = Math.max(Number(effectiveSave) || Number(state.saveAmount) || 0, 0);

  return remaining > 0 && cycleSaving > 0 ? Math.ceil(remaining / cycleSaving) : 0;
}

function renderGoalsList(goals, activeGoal) {
  const list = $("#goals-list");
  if (!list) return;

  const visibleGoals = goals.filter((goal) => !goal.isFallback);

  if (!visibleGoals.length) {
    list.innerHTML =
      '<p class="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">Create a goal to track it here.</p>';
    return;
  }

  const activeKey = goalLookupKey(activeGoal);

  list.innerHTML = visibleGoals
    .map((goal) => {
      const key = goalLookupKey(goal);
      const progressData = goalProgress(goal);
      const isActive = key === activeKey;
      const syncBadge =
        goal.syncStatus === "failed"
          ? '<span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-error">Sync failed</span>'
          : goal.syncStatus === "pending"
            ? '<span class="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">Local</span>'
            : "";

      return `
        <div class="bg-white border ${isActive ? "border-emerald-700/30 shadow-soft-green bg-emerald-50/10" : "border-outline-variant/20 bg-white"} rounded-3xl p-5 flex flex-col gap-4" data-goal-row="${escapeHTML(key)}">
          <div class="flex items-start justify-between gap-3">
            <button type="button" class="min-w-0 flex-1 text-left flex items-center gap-3.5" data-goal-action="activate" data-goal-key="${escapeHTML(key)}">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-container-high text-on-surface-variant'}">
                <span class="material-symbols-outlined text-[20px]">${goalTypeConfig[goal.type]?.icon || 'savings'}</span>
              </div>
              <div class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-primary-container">${escapeHTML(goal.title)}</span>
                <span class="mt-0.5 block text-xs text-on-surface-variant font-medium">${formatCurrency(progressData.saved)} of ${formatCurrency(progressData.target)} saved</span>
              </div>
            </button>
            <div class="flex shrink-0 items-center gap-1.5">
              ${syncBadge}
              <button type="button" class="grid h-8 w-8 place-items-center rounded-full bg-surface-container-low text-primary-container transition hover:bg-surface-container-high" data-goal-action="edit" data-goal-key="${escapeHTML(key)}" aria-label="Edit ${escapeHTML(goal.title)}">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button type="button" class="grid h-8 w-8 place-items-center rounded-full bg-surface-container-low text-error transition hover:bg-red-50" data-goal-action="delete" data-goal-key="${escapeHTML(key)}" aria-label="Delete ${escapeHTML(goal.title)}">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${progressData.percent}%; background-color: #0a4d3c;"></div>
          </div>
        </div>`;
    })
    .join("");
}

function setGoalActionState(hasStoredGoal) {
  ["goal-edit-btn", "goal-delete-btn"].forEach((id) => {
    const btn = $(`#${id}`);
    if (!btn) return;

    btn.disabled = !hasStoredGoal;
    btn.classList.toggle("opacity-40", !hasStoredGoal);
    btn.classList.toggle("pointer-events-none", !hasStoredGoal);
  });
}

function populateGoalCard(effectiveSave) {
  const storedGoals = goalsFromState();
  const storedActiveGoal = activeGoalFromState();
  const activeGoal = storedActiveGoal || fallbackGoalFromOnboarding(effectiveSave);
  const progressData = goalProgress(activeGoal);
  const config = goalTypeConfig[activeGoal.type] || goalTypeConfig.custom;
  const cyclesNeeded = goalCyclesNeeded(activeGoal, effectiveSave);

  // Update total saved in quick stats header
  const totalSavedEl = $("#goals-total-saved");
  if (totalSavedEl) {
    const totalSaved = storedGoals.filter(g => !g.isFallback).reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0) || progressData.saved;
    totalSavedEl.textContent = formatCurrency(totalSaved);
  }

  // Update savings rate in quick stats header
  const savingsRateEl = $("#goals-savings-rate");
  if (savingsRateEl) {
    let incomeForRate = Number(state.salary) || Number(state.avgIncome) || Number(state.allowanceAmount) || Number(state.totalMoney) || 1;
    if (incomeForRate <= 0) incomeForRate = 1;
    const savingsRate = Math.min(Math.round((effectiveSave / incomeForRate) * 100), 100);
    savingsRateEl.textContent = `${savingsRate}%`;
  }

  // Goals tab elements
  const gIds = [
    "goals-tab-icon",
    "goals-tab-name",
    "goals-tab-type",
    "goals-tab-progress",
    "goals-tab-percent",
    "goals-tab-meta"
  ];
  const gEls = gIds.map((id) => $(`#${id}`));

  if (gEls[0]) gEls[0].textContent = config.icon;
  if (gEls[1]) gEls[1].textContent = activeGoal.title;
  if (gEls[2]) gEls[2].textContent = config.label;
  if (gEls[3]) {
    gEls[3].innerHTML = progressData.target > 0
      ? `${formatCurrency(progressData.saved)} <span class="text-on-surface-variant font-body-md text-base">/ ${formatCurrency(progressData.target)}</span>`
      : "₹0 <span class=\"text-on-surface-variant font-body-md text-base\">/ ₹0</span>";
  }
  if (gEls[4]) gEls[4].textContent = `${progressData.percent}%`;
  if (gEls[5]) {
    if (progressData.remaining <= 0 && progressData.target > 0) {
      gEls[5].textContent = "Spectacular! You have fully reached your savings goal.";
    } else if (cyclesNeeded > 0) {
      gEls[5].textContent = `~${cyclesNeeded} cycle${cyclesNeeded > 1 ? "s" : ""} to save remaining ${formatCurrency(progressData.remaining)}`;
    } else {
      gEls[5].textContent = "Add funds or edit target anytime to start milestone tracking.";
    }
  }

  // Status badge update
  const statusBadge = $("#goals-tab-status-badge");
  if (statusBadge) {
    statusBadge.classList.remove("hidden");
    if (progressData.percent >= 100) {
      statusBadge.textContent = "ACHIEVED";
      statusBadge.className = "mt-1 self-center sm:self-start bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider";
    } else {
      statusBadge.textContent = "ACTIVE";
      statusBadge.className = "mt-1 self-center sm:self-start bg-primary-container text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider";
    }
  }

  // Dynamic milestone timeline rendering
  const timelineContainer = $("#goal-timeline");
  if (timelineContainer) {
    const percent = progressData.percent;
    const target = progressData.target;
    timelineContainer.innerHTML = `
      <div class="relative flex items-center justify-between mt-8 mb-4">
        <!-- Background Track -->
        <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-surface-container-high rounded-full -z-10">
          <div class="h-full bg-primary-container transition-all duration-500" style="width: ${percent}%;"></div>
        </div>
        
        <!-- Node: Started -->
        <div class="flex flex-col items-center gap-1.5 bg-white px-1 relative z-10">
          <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${percent >= 0 ? 'bg-primary-container border-primary-container text-white' : 'bg-white border-outline-variant text-on-surface-variant'}">
            <span class="material-symbols-outlined text-[16px]">${percent > 0 ? 'check' : 'circle'}</span>
          </div>
          <span class="text-[10px] font-bold text-primary-container">Started</span>
          <span class="text-[9px] text-on-surface-variant">₹0</span>
        </div>

        <!-- Node: Midway -->
        <div class="flex flex-col items-center gap-1.5 bg-white px-1 relative z-10">
          <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${percent >= 50 ? 'bg-primary-container border-primary-container text-white' : 'bg-white border-outline-variant text-on-surface-variant'}">
            <span class="material-symbols-outlined text-[16px]">${percent >= 50 ? 'check' : 'flag'}</span>
          </div>
          <span class="text-[10px] font-bold ${percent >= 50 ? 'text-primary-container' : 'text-on-surface-variant'}">Midway</span>
          <span class="text-[9px] text-on-surface-variant">${formatCurrency(target * 0.5)}</span>
        </div>

        <!-- Node: Last Stretch -->
        <div class="flex flex-col items-center gap-1.5 bg-white px-1 relative z-10">
          <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${percent >= 75 ? 'bg-primary-container border-primary-container text-white' : 'bg-white border-outline-variant text-on-surface-variant'}">
            <span class="material-symbols-outlined text-[16px]">${percent >= 75 ? 'check' : 'trending_up'}</span>
          </div>
          <span class="text-[10px] font-bold ${percent >= 75 ? 'text-primary-container' : 'text-on-surface-variant'}">Last Stretch</span>
          <span class="text-[9px] text-on-surface-variant">${formatCurrency(target * 0.75)}</span>
        </div>

        <!-- Node: Target -->
        <div class="flex flex-col items-center gap-1.5 bg-white px-1 relative z-10">
          <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${percent >= 100 ? 'bg-primary-container border-primary-container text-white' : 'bg-white border-outline-variant text-on-surface-variant'}">
            <span class="material-symbols-outlined text-[16px]">${percent >= 100 ? 'emoji_events' : 'sports_score'}</span>
          </div>
          <span class="text-[10px] font-bold ${percent >= 100 ? 'text-primary-container' : 'text-on-surface-variant'}">Target</span>
          <span class="text-[9px] text-on-surface-variant">${formatCurrency(target)}</span>
        </div>
      </div>
    `;
  }



  // Dynamic bar projection graphic based on percent
  const chartGraphic = $("#goals-chart-graphic");
  if (chartGraphic) {
    const bars = chartGraphic.children;
    if (bars && bars.length >= 7) {
      const currentPercent = progressData.percent;
      // Scale heights based on percent, representing growing projection
      bars[0].style.height = `${Math.max(10, Math.min(currentPercent, 30))}%`;
      bars[1].style.height = `${Math.max(15, Math.min(currentPercent, 45))}%`;
      bars[2].style.height = `${Math.max(20, Math.min(currentPercent, 55))}%`;
      bars[3].style.height = `${Math.max(25, Math.min(currentPercent, 70))}%`;
      bars[4].style.height = `${Math.max(30, Math.min(currentPercent, 65))}%`;
      bars[5].style.height = `${Math.max(40, Math.min(currentPercent + 10, 85))}%`;
      bars[6].style.height = `${Math.max(50, Math.min(currentPercent + 20, 95))}%`;
    }
  }

  // Goal progress ring
  const goalRingArc = $("#goal-ring-arc");
  if (goalRingArc) {
    const circumference = 2 * Math.PI * 40;
    goalRingArc.style.strokeDasharray = `${circumference}`;
    goalRingArc.style.strokeDashoffset = circumference * (1 - progressData.percent / 100);
  }

  renderGoalsList(storedGoals, activeGoal);
  setGoalActionState(Boolean(storedActiveGoal && !storedActiveGoal.isFallback));

  // Monthly summary
  populateMonthlySummary(effectiveSave);
}

// Monthly summary

function populateMonthlySummary(effectiveSave) {
  const txns = loadTransactions();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filter this month's transactions

  const monthTxns = txns.filter((t) => t.ts >= monthStart);
  const expenses = monthTxns.filter(isExpenseTransaction);

  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Top category

  const catTotals = {};
  expenses.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const topCatLabel = topCat ? (categoryConfig[topCat[0]]?.label || topCat[0]) : "—";

  // Populate

  const spentEl = $("#monthly-total-spent");
  const savedEl = $("#monthly-total-saved");
  const catEl = $("#monthly-top-cat");
  const countEl = $("#monthly-txn-count");

  if (spentEl) spentEl.textContent = formatCurrency(totalSpent);
  if (savedEl) savedEl.textContent = formatCurrency(effectiveSave);
  if (catEl) catEl.textContent = topCatLabel;
  if (countEl) countEl.textContent = expenses.length;
}

// Transaction rendering

function buildTransactionHTML(t, index) {
  const cat = categoryConfig[t.category] || categoryConfig.other;
  const isIncome = isIncomeTransaction(t);
  const description = escapeHTML(t.desc || cat.label);
  const categoryLabel = escapeHTML(cat.label);
  const categoryIcon = escapeHTML(cat.icon);
  const transactionId = escapeHTML(transactionLookupKey(t));
  const syncBadge = t.syncStatus === "failed"
    ? '<span class="text-[10px] font-semibold uppercase tracking-wider text-red-600">Sync pending</span>'
    : "";

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
    <div class="flex items-center justify-between gap-3 group hover:bg-surface-container-low p-2 -m-2 rounded-xl transition-colors">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 ${iconBg} rounded-full flex items-center justify-center ${iconColor}">
          <span class="material-symbols-outlined">${categoryIcon}</span>
        </div>
        <div>
          <p class="font-bold text-primary-container">${description}</p>
          <p class="text-xs ${categoryColor}">${categoryLabel}</p>
          ${syncBadge}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-right">
          <p class="font-bold ${amountColor}">${amountPrefix}${formatCurrency(t.amount)}</p>
          <p class="text-xs text-slate-400">${relativeDate(t.ts)}</p>
        </div>
        <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          <button
            class="w-9 h-9 rounded-full border border-outline-variant/40 text-primary-container hover:bg-primary-fixed flex items-center justify-center"
            type="button"
            aria-label="Edit transaction"
            data-transaction-action="edit"
            data-transaction-id="${transactionId}"
          >
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button
            class="w-9 h-9 rounded-full border border-red-100 text-red-600 hover:bg-red-50 flex items-center justify-center"
            type="button"
            aria-label="Delete transaction"
            data-transaction-action="delete"
            data-transaction-id="${transactionId}"
          >
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    </div>`;
}

function transactionLookupKey(transaction) {
  if (!transaction) return "";
  return transaction.remoteId || transaction.clientTxnId || transaction.id || transactionContentKey(transaction);
}

function transactionContentKey(transaction) {
  return [
    "content",
    transaction.ts || "",
    transaction.amount || "",
    transaction.kind || "",
    transaction.category || "",
    transaction.source || "",
    transaction.desc || "",
  ].join(":");
}

function findTransactionIndex(txns, lookupKey) {
  if (!lookupKey) return -1;
  return txns.findIndex((txn) => transactionLookupKey(txn) === lookupKey);
}

function filterTransactions(txns) {
  const query = transactionFilters.query.toLowerCase();

  return txns.filter((txn) => {
    const kind = transactionKind(txn);
    const category = isIncomeTransaction(txn) ? "income" : txn.category || "other";

    if (transactionFilters.type !== "all" && transactionFilters.type !== kind) return false;
    if (transactionFilters.category !== "all" && transactionFilters.category !== category) return false;

    if (!query) return true;

    const cat = categoryConfig[category] || categoryConfig.other;
    const searchable = [txn.desc, cat.label, txn.source, kind].join(" ").toLowerCase();
    return searchable.includes(query);
  });
}

function updateTransactionSummary(visibleTxns) {
  const spentEl = $("#txn-summary-spent");
  const incomeEl = $("#txn-summary-income");
  const countEl = $("#txn-summary-count");

  const spent = visibleTxns.filter(isExpenseTransaction).reduce((sum, txn) => sum + txn.amount, 0);
  const income = visibleTxns.filter(isIncomeTransaction).reduce((sum, txn) => sum + txn.amount, 0);

  if (spentEl) spentEl.textContent = formatCurrency(spent);
  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (countEl) countEl.textContent = String(visibleTxns.length);
}

function renderAllTransactions(txns) {
  const container = $("#all-transactions-list");
  if (!container) return;

  const visibleTxns = filterTransactions(txns);
  updateTransactionSummary(visibleTxns);

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

  if (visibleTxns.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-stone-300" style="font-size:32px">search_off</span>
        </div>
        <p class="text-stone-400 font-body-md text-[15px] mb-2">No matching transactions</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="space-y-6">${visibleTxns
    .slice()
    .reverse()
    .map((t, i) => buildTransactionHTML(t, i))
    .join("")}</div>`;
}

function findTransactionByKey(lookupKey) {
  const txns = loadTransactions();
  const index = findTransactionIndex(txns, lookupKey);

  if (index < 0) return { txns, index, transaction: null };

  return { txns, index, transaction: txns[index] };
}

function editTransactionByKey(lookupKey) {
  const { transaction } = findTransactionByKey(lookupKey);

  if (!transaction) {
    alert("This transaction could not be found. Please refresh and try again.");
    return;
  }

  openExpenseModal(null, { transaction });
}

async function deleteTransactionByKey(lookupKey) {
  const { txns, index, transaction } = findTransactionByKey(lookupKey);

  if (!transaction || index < 0) {
    alert("This transaction could not be found. Please refresh and try again.");
    return;
  }

  if (!confirm("Delete this transaction? This cannot be undone.")) return;

  const canDeleteRemote = Boolean(transaction.remoteId || transaction.clientTxnId);

  if (canDeleteRemote && window.saverSupabase?.isConfigured && window.saverSupabase?.deleteTransaction) {
    try {
      const deleted = await window.saverSupabase.deleteTransaction(
        transaction,
        window.currentSaverSession || null,
      );

      if (!deleted) {
        alert("We could not delete this transaction online. Please try again.");
        return;
      }
    } catch (error) {
      console.error("Could not delete transaction remotely", error);
      alert("We could not delete this transaction online. Please try again.");
      return;
    }
  }

  txns.splice(index, 1);
  saveTransactions(txns);
  populateDashboard();
}

function handleTransactionAction(event) {
  const actionBtn = event.target.closest("[data-transaction-action]");

  if (!actionBtn) return;

  const action = actionBtn.dataset.transactionAction;
  const transactionId = actionBtn.dataset.transactionId || "";

  event.preventDefault();
  event.stopPropagation();

  if (action === "edit") {
    editTransactionByKey(transactionId);
  } else if (action === "delete") {
    deleteTransactionByKey(transactionId);
  }
}

// Profile tab

function populateProfileTab(txns, effectiveSave) {
  // Profile identity

  const displayName = profileDisplayName();
  const displayEmail = cleanProfileText(state.profileEmail) || storedProfileValue("saverUserEmail");
  const profileName = $("#profile-name");
  const profileAvatar = $("#profile-avatar");

  if (profileName) profileName.textContent = displayName;
  if (profileAvatar) profileAvatar.textContent = profileInitial(displayName, displayEmail);

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
  } else if (modeBadge) {
    modeBadge.innerHTML = '<span class="material-symbols-outlined text-sm">account_circle</span>Setup Pending';
  }

  // Stats

  const totalSpent = txns
    .filter(isExpenseTransaction)
    .reduce((sum, t) => sum + t.amount, 0);

  const savedEl = $("#profile-total-saved");
  const spentEl = $("#profile-total-spent");
  const countEl = $("#profile-txn-count");

  if (savedEl) savedEl.textContent = formatCurrency(effectiveSave);
  if (spentEl) spentEl.textContent = formatCurrency(totalSpent);
  if (countEl) countEl.textContent = txns.filter(isExpenseTransaction).length;
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

  // Profile - Reset All Data

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

  // Profile — Export Data (CSV download)

  const exportBtn = $("#profile-export-btn");

  if (exportBtn)
    exportBtn.addEventListener("click", () => {
      const txns = loadTransactions();

      if (!txns.length) {
        alert("No transactions to export yet.");
        return;
      }

      const header = "Date,Type,Amount,Category,Source,Note";

      const rows = txns.map((t) => {
        const date = new Date(t.ts).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const desc = (t.desc || "").replace(/"/g, '""');
        return `${date},${transactionKind(t)},${t.amount},${t.category},${t.source},"${desc}"`;
      });

      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `saver-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });

  // Profile — Log Out

  const logoutBtn = $("#profile-logout-btn");

  if (logoutBtn)
    logoutBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to log out?")) return;

      try {
        const supa = window.saverSupabase;

        if (supa?.client) {
          await supa.client.auth.signOut();
        }
      } catch (err) {
        console.error("Sign-out error:", err);
      }

      // Clear session-related storage but keep preferences

      localStorage.removeItem("saverUserEmail");
      localStorage.removeItem("saverUserName");
      sessionStorage.clear();

      window.location.replace(appRoute("login.html"));
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

  const transactionSearch = $("#transaction-search-input");
  const transactionTypeFilter = $("#transaction-type-filter");
  const transactionCategoryFilter = $("#transaction-category-filter");

  if (transactionSearch) {
    transactionSearch.addEventListener("input", () => {
      transactionFilters.query = transactionSearch.value.trim();
      renderAllTransactions(loadTransactions());
    });
  }

  if (transactionTypeFilter) {
    transactionTypeFilter.addEventListener("change", () => {
      transactionFilters.type = transactionTypeFilter.value;
      renderAllTransactions(loadTransactions());
    });
  }

  if (transactionCategoryFilter) {
    transactionCategoryFilter.addEventListener("change", () => {
      transactionFilters.category = transactionCategoryFilter.value;
      renderAllTransactions(loadTransactions());
    });
  }

  $("#all-transactions-list")?.addEventListener("click", handleTransactionAction);

  $("#goal-edit-btn")?.addEventListener("click", () => {
    const goal = activeGoalFromState();
    if (goal && !goal.isFallback) openGoalModal(goal);
  });

  $("#goal-delete-btn")?.addEventListener("click", () => {
    const goal = activeGoalFromState();
    if (goal && !goal.isFallback) deleteGoalByKey(goalLookupKey(goal));
  });





  $("#goals-list")?.addEventListener("click", handleGoalListAction);
  $("#goal-modal-close")?.addEventListener("click", closeGoalModal);
  $("#goal-modal-backdrop")?.addEventListener("click", closeGoalModal);
  $("#goal-cancel-btn")?.addEventListener("click", closeGoalModal);
  $("#goal-save-btn")?.addEventListener("click", submitGoal);

  $$("[data-goal-type-choice]").forEach((btn) => {
    btn.addEventListener("click", () => setGoalType(btn.dataset.goalTypeChoice));
  });

  ["goal-title-input", "goal-target-input", "goal-saved-input", "goal-date-input"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", validateGoalForm);
  });

  // Share Achievement button

  const shareBtn = $("#share-achievement-btn");

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const grade = $("#report-grade")?.textContent || "—";
      const streak = $("#budget-pulse-streak")?.textContent || "";
      const daysPill = $("#report-days-pill")?.textContent?.trim() || "";

      const shareText = `📊 My Saver Weekly Report Card\n\n🏅 Grade: ${grade}\n📅 ${daysPill}\n${streak ? `${streak}\n` : ""}\nTracking my budget with Saver — one day at a time! 💪`;

      try {
        if (navigator.share) {
          await navigator.share({ title: "Saver Report Card", text: shareText });
        } else {
          await navigator.clipboard.writeText(shareText);
          shareBtn.textContent = "Copied!";
          setTimeout(() => {
            shareBtn.innerHTML = '<span class="material-symbols-outlined text-sm">share</span> Share';
          }, 2000);
        }
      } catch (err) {
        // User cancelled or error
      }
    });
  }

  // Modal close

  const closeBtn = $("#expense-modal-close");
  const backdrop = $("#expense-modal-backdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeExpenseModal);
  if (backdrop) backdrop.addEventListener("click", closeExpenseModal);

  $("[data-transaction-kind='expense']")?.classList.add("is-active");

  $$("[data-transaction-kind]").forEach((btn) => {
    btn.addEventListener("click", () => setTransactionKind(btn.dataset.transactionKind));
  });

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
      checkImpulseGuard();
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
const modalState = {
  amount: 0,
  desc: "",
  kind: "expense",
  category: "",
  source: "savings",
  dailyLimit: 0,
  mode: "create",
  editingKey: "",
  originalTransaction: null,
  isAddingGoalFunds: false,
};

const goalModalState = {
  mode: "create",
  editingKey: "",
  type: "custom",
  originalGoal: null,
};

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

function setGoalModalError(message) {
  const errorEl = $("#goal-modal-error");
  if (!errorEl) return;

  errorEl.textContent = message || "";
  errorEl.classList.toggle("hidden", !message);
}

function setGoalType(type) {
  goalModalState.type = cleanGoalType(type);

  $$("[data-goal-type-choice]").forEach((btn) => {
    const isActive = btn.dataset.goalTypeChoice === goalModalState.type;
    btn.classList.toggle("border-primary-container", isActive);
    btn.classList.toggle("bg-primary-container", isActive);
    btn.classList.toggle("text-white", isActive);
    btn.classList.toggle("border-outline-variant/40", !isActive);
    btn.classList.toggle("bg-surface-container-low", !isActive);
    btn.classList.toggle("text-on-background", !isActive);
    btn.querySelector(".material-symbols-outlined")?.classList.toggle("text-white", isActive);
    btn.querySelector(".material-symbols-outlined")?.classList.toggle("text-primary-container", !isActive);
  });

  validateGoalForm();
}

function validateGoalForm() {
  const title = cleanProfileText($("#goal-title-input")?.value);
  const target = Number($("#goal-target-input")?.value) || 0;
  const saved = Number($("#goal-saved-input")?.value) || 0;
  const btn = $("#goal-save-btn");
  let message = "";

  if (saved > target && target > 0) message = "Saved amount cannot be higher than target.";

  const isValid = Boolean(title) && target > 0 && saved >= 0 && !message;

  if (btn) btn.disabled = !isValid;
  setGoalModalError(message);
  return isValid;
}

function openGoalModal(goal = null) {
  const modal = $("#goal-modal");
  if (!modal) return;

  const normalizedGoal = normalizeGoal(goal);
  const titleEl = $("#goal-modal-title");
  const titleInput = $("#goal-title-input");
  const targetInput = $("#goal-target-input");
  const savedInput = $("#goal-saved-input");
  const dateInput = $("#goal-date-input");

  goalModalState.mode = normalizedGoal ? "edit" : "create";
  goalModalState.editingKey = normalizedGoal ? goalLookupKey(normalizedGoal) : "";
  goalModalState.originalGoal = normalizedGoal;
  goalModalState.type = normalizedGoal?.type || "custom";

  if (titleEl) titleEl.textContent = normalizedGoal ? "Edit Goal" : "Create Goal";
  if (titleInput) titleInput.value = normalizedGoal?.title || "";
  if (targetInput) {
    targetInput.value = normalizedGoal?.targetAmount ? String(Math.round(normalizedGoal.targetAmount)) : "";
  }
  if (savedInput) savedInput.value = normalizedGoal?.savedAmount ? String(Math.round(normalizedGoal.savedAmount)) : "0";
  if (dateInput) dateInput.value = normalizedGoal?.targetDate || "";

  setGoalModalError("");
  setGoalType(goalModalState.type);
  lockBodyScroll();
  requestAnimationFrame(() => modal.classList.remove("hidden"));
  titleInput?.focus();
}

function closeGoalModal() {
  const modal = $("#goal-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  unlockBodyScroll();
  setGoalModalError("");
  goalModalState.mode = "create";
  goalModalState.editingKey = "";
  goalModalState.originalGoal = null;
}

function readGoalDraft() {
  return {
    ...(goalModalState.originalGoal || {}),
    type: cleanGoalType(goalModalState.type),
    title: cleanProfileText($("#goal-title-input")?.value),
    targetAmount: Math.max(Number($("#goal-target-input")?.value) || 0, 0),
    savedAmount: Math.max(Number($("#goal-saved-input")?.value) || 0, 0),
    targetDate: cleanProfileText($("#goal-date-input")?.value),
    isActive: true,
  };
}

async function submitGoal() {
  if (!validateGoalForm()) return;

  const submitBtn = $("#goal-save-btn");
  const originalText = submitBtn?.textContent || "Save goal";
  const existingGoals = goalsFromState();
  const draft = readGoalDraft();
  const generatedId = draft.id || createClientGoalId();
  const localGoal = normalizeGoal({
    ...draft,
    id: generatedId,
    clientGoalId: draft.clientGoalId || (!draft.remoteId ? generatedId : ""),
    syncStatus: window.saverSupabase?.isConfigured ? "pending" : "local",
  });

  if (!localGoal) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    let savedGoal = null;

    if (window.saverSupabase?.isConfigured && window.saverSupabase?.saveSavingsGoal) {
      savedGoal = await window.saverSupabase.saveSavingsGoal(localGoal, window.currentSaverSession || null);
    }

    const finalGoal = normalizeGoal(savedGoal ? { ...localGoal, ...savedGoal } : localGoal);
    const editingIndex = existingGoals.findIndex((goal) => goalLookupKey(goal) === goalModalState.editingKey);
    const nextGoals = existingGoals.map((goal) => ({ ...goal, isActive: false }));

    if (editingIndex >= 0) {
      nextGoals[editingIndex] = { ...nextGoals[editingIndex], ...finalGoal, isActive: true };
    } else {
      nextGoals.unshift({ ...finalGoal, isActive: true });
    }

    setSavingsGoals(nextGoals);
    closeGoalModal();
    populateDashboard();
  } catch (error) {
    console.error("Could not save savings goal", error);
    setGoalModalError(error?.message || "Could not save this goal. Try again.");
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      validateGoalForm();
    }
  }
}

async function activateGoalByKey(key) {
  const goals = goalsFromState();
  const selectedGoal = goals.find((goal) => goalLookupKey(goal) === key);
  if (!selectedGoal) return;

  const nextGoals = goals.map((goal) => ({ ...goal, isActive: goalLookupKey(goal) === key }));
  setSavingsGoals(nextGoals);
  populateDashboard();

  if (window.saverSupabase?.isConfigured && window.saverSupabase?.saveSavingsGoal) {
    try {
      const remoteGoal = await window.saverSupabase.saveSavingsGoal(
        { ...selectedGoal, isActive: true },
        window.currentSaverSession || null,
      );

      if (remoteGoal) {
        setSavingsGoals(
          nextGoals.map((goal) =>
            goalLookupKey(goal) === key ? { ...goal, ...remoteGoal, isActive: true } : goal,
          ),
        );
        populateDashboard();
      }
    } catch (error) {
      console.error("Could not activate savings goal", error);
    }
  }
}

async function deleteGoalByKey(key) {
  const goals = goalsFromState();
  const goal = goals.find((item) => goalLookupKey(item) === key);
  if (!goal) return;
  if (!confirm(`Delete "${goal.title}"?`)) return;

  try {
    if (window.saverSupabase?.isConfigured && window.saverSupabase?.deleteSavingsGoal) {
      await window.saverSupabase.deleteSavingsGoal(goal, window.currentSaverSession || null);
    }
  } catch (error) {
    console.error("Could not delete savings goal", error);
    alert(error?.message || "Could not delete this goal. Try again.");
    return;
  }

  const nextGoals = goals.filter((item) => goalLookupKey(item) !== key);

  if (!nextGoals.some((item) => item.isActive) && nextGoals[0]) {
    nextGoals[0].isActive = true;

    if (window.saverSupabase?.isConfigured && window.saverSupabase?.saveSavingsGoal) {
      try {
        const remoteGoal = await window.saverSupabase.saveSavingsGoal(nextGoals[0], window.currentSaverSession || null);
        if (remoteGoal) Object.assign(nextGoals[0], remoteGoal, { isActive: true });
      } catch (error) {
        console.error("Could not activate fallback savings goal", error);
      }
    }
  }

  setSavingsGoals(nextGoals);
  populateDashboard();
}

function handleGoalListAction(event) {
  const btn = event.target.closest("[data-goal-action]");
  if (!btn) return;

  const key = cleanProfileText(btn.dataset.goalKey);
  const action = btn.dataset.goalAction;
  const goal = goalsFromState().find((item) => goalLookupKey(item) === key);

  if (!goal) return;
  if (action === "activate") activateGoalByKey(key);
  if (action === "edit") openGoalModal(goal);
  if (action === "delete") deleteGoalByKey(key);
}


function setTransactionKind(kind) {
  modalState.kind = kind === "income" ? "income" : "expense";

  const isIncome = modalState.kind === "income";
  if (isIncome) {
    modalState.category = "income";
    $$("[data-modal-cat]").forEach((c) => c.classList.remove("is-active"));
  } else if (modalState.category === "income") {
    modalState.category = "";
  }

  $$("[data-transaction-kind]").forEach((btn) => {
    const isActive = btn.dataset.transactionKind === modalState.kind;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  const title = $("#expense-modal-title");
  const submitBtn = $("#expense-submit-btn");
  const categorySection = $("#expense-category-section");
  const descInput = $("#expense-desc-input");

  const actionLabel = modalState.mode === "edit" ? "Save" : "Add";

  if (title) {
    title.textContent = modalState.mode === "edit"
      ? `Edit ${isIncome ? "Income" : "Expense"}`
      : `Log ${isIncome ? "Income" : "Expense"}`;
  }
  if (submitBtn) submitBtn.textContent = `${actionLabel} ${isIncome ? "Income" : "Expense"}`;
  if (categorySection) categorySection.classList.toggle("hidden", isIncome);
  if (descInput) descInput.placeholder = isIncome ? "Where did this come from?" : "What was this for?";

  checkImpulseGuard();
  validateExpenseForm();
}

function openExpenseModal(preCategory, options = {}) {
  const modal = $("#expense-modal");
  if (!modal) return;

  const editingTransaction = options.transaction || null;

  modalState.mode = editingTransaction ? "edit" : "create";
  modalState.editingKey = editingTransaction ? transactionLookupKey(editingTransaction) : "";
  modalState.originalTransaction = editingTransaction ? { ...editingTransaction } : null;
  modalState.amount = editingTransaction ? Number(editingTransaction.amount) || 0 : 0;
  modalState.desc = editingTransaction?.desc || "";
  modalState.kind = editingTransaction
    ? transactionKind(editingTransaction)
    : preCategory === "income"
      ? "income"
      : "expense";
  modalState.category = editingTransaction
    ? editingTransaction.category || (modalState.kind === "income" ? "income" : "")
    : modalState.kind === "income"
      ? "income"
      : preCategory || "";
  modalState.source = editingTransaction?.source || "savings";
  modalState.isAddingGoalFunds = options.isAddingGoalFunds || false;

  // Cache current rollover daily limit for impulse guard

  const limitText = $("#hero-daily-limit")?.textContent?.replace(/[^0-9]/g, "") || "0";
  modalState.dailyLimit = parseInt(limitText) || 0;

  const amtInput = $("#expense-amount-input");
  const descInput = $("#expense-desc-input");

  if (amtInput) amtInput.value = modalState.amount ? String(Math.round(modalState.amount)) : "";
  if (descInput) descInput.value = modalState.desc;

  // Pre-select category if provided

  $$("[data-modal-cat]").forEach((c) => {
    c.classList.toggle(
      "is-active",
      modalState.kind === "expense" && c.dataset.modalCat === modalState.category,
    );
  });

  // Reset payment source selection

  $$(".payment-source").forEach((btn) => {
    const isDefault = btn.dataset.source === modalState.source;
    btn.classList.toggle("is-active", isDefault);
    btn.classList.toggle("bg-surface-container-high", isDefault);
    btn.classList.toggle("border-outline-variant/30", isDefault);
    btn.classList.toggle("bg-surface-container-low", !isDefault);
    btn.classList.toggle("border-transparent", !isDefault);
    btn.querySelector(".source-check")?.classList.toggle("hidden", !isDefault);
  });

  setTransactionKind(modalState.kind);
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
  modalState.mode = "create";
  modalState.editingKey = "";
  modalState.originalTransaction = null;
  populateDashboard();
}

function checkImpulseGuard() {
  const guardEl = $("#impulse-guard");
  const guardText = $("#impulse-guard-text");

  if (!guardEl) return;

  const currentDailyLimit = modalState.dailyLimit;

  // Show or hide warning

  if (modalState.kind === "income") {
    guardEl.classList.add("hidden");
  } else if (modalState.amount > currentDailyLimit && currentDailyLimit > 0) {
    const daysWorth = Math.round(modalState.amount / currentDailyLimit * 10) / 10;
    guardEl.classList.remove("hidden");

    if (daysWorth >= 3) {
      guardText.textContent = `⚠️ This is ${daysWorth} days of your budget! Are you sure?`;
    } else if (daysWorth >= 2) {
      guardText.textContent = `This costs ${daysWorth} days of budget. Think twice!`;
    } else {
      guardText.textContent = `This exceeds today's limit of ${formatCurrency(currentDailyLimit)}.`;
    }
  } else {
    guardEl.classList.add("hidden");
  }
}

function validateExpenseForm() {
  const btn = $("#expense-submit-btn");
  const hasCategory = modalState.kind === "income" || Boolean(modalState.category);

  if (btn) btn.disabled = !(modalState.amount > 0 && hasCategory);
}

async function submitExpense() {
  const kind = modalState.kind === "income" ? "income" : "expense";
  const category = kind === "income" ? "income" : modalState.category;

  if (modalState.amount <= 0 || !category) return;

  const submitBtn = $("#expense-submit-btn");
  const actionLabel = modalState.mode === "edit" ? "Save" : "Add";
  const originalSubmitText = submitBtn?.textContent || `${actionLabel} ${kind === "income" ? "Income" : "Expense"}`;
  const catConfig = categoryConfig[category] || categoryConfig.other;
  const originalTxn = modalState.originalTransaction || {};
  const generatedClientTxnId =
    typeof createClientTxnId === "function"
      ? createClientTxnId()
      : `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const clientTxnId = originalTxn.clientTxnId || originalTxn.id || generatedClientTxnId;
  const localTxn = {
    id: originalTxn.id || clientTxnId,
    clientTxnId,
    remoteId: originalTxn.remoteId,
    amount: modalState.amount,
    desc: modalState.desc || catConfig.label || (kind === "income" ? "Income" : "Expense"),
    kind,
    category,
    source: modalState.source,
    ts: originalTxn.ts || Date.now(),
    budgetCycleId: originalTxn.budgetCycleId || state.activeBudgetCycleId || null,
    syncStatus: originalTxn.remoteId ? "synced" : "pending",
  };

  if (!localTxn.remoteId) delete localTxn.remoteId;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    let savedTxn = localTxn;

    if (
      modalState.mode === "edit" &&
      window.saverSupabase?.isConfigured &&
      window.saverSupabase?.updateTransaction
    ) {
      try {
        const remoteTxn = await window.saverSupabase.updateTransaction(
          localTxn,
          window.currentSaverSession || null,
          state.activeBudgetCycleId || null,
        );

        if (remoteTxn) {
          savedTxn = {
            ...localTxn,
            ...remoteTxn,
            clientTxnId: remoteTxn.clientTxnId || localTxn.clientTxnId,
            syncStatus: "synced",
          };
        } else {
          savedTxn = {
            ...localTxn,
            syncStatus: "failed",
            syncError: "Remote update did not return a transaction",
          };
        }
      } catch (error) {
        console.error("Could not update transaction immediately", error);
        savedTxn = {
          ...localTxn,
          syncStatus: "failed",
          syncError: error?.message || "Remote update failed",
        };
      }
    } else if (window.saverSupabase?.isConfigured && window.saverSupabase?.addTransaction) {
      try {
        const remoteTxn = await window.saverSupabase.addTransaction(
          localTxn,
          window.currentSaverSession || null,
          state.activeBudgetCycleId || null,
        );
        if (remoteTxn) {
          savedTxn = {
            ...localTxn,
            ...remoteTxn,
            clientTxnId: remoteTxn.clientTxnId || localTxn.clientTxnId,
            syncStatus: "synced",
          };
        }
      } catch (error) {
        console.error("Could not sync transaction immediately", error);
        savedTxn = {
          ...localTxn,
          syncStatus: "failed",
          syncError: error?.message || "Remote sync failed",
        };
      }
    }

    if (savedTxn.budgetCycleId && savedTxn.budgetCycleId !== state.activeBudgetCycleId) {
      state.activeBudgetCycleId = savedTxn.budgetCycleId;
      saveState();
    }

    const txns = loadTransactions();
    if (modalState.mode === "edit") {
      const editIndex = findTransactionIndex(txns, modalState.editingKey);

      if (editIndex >= 0) {
        txns[editIndex] = savedTxn;
      } else {
        txns.push(savedTxn);
      }
    } else {
      txns.push(savedTxn);
    }

    saveTransactions(txns);

    if (modalState.isAddingGoalFunds && modalState.mode !== "edit") {
      const storedGoals = goalsFromState();
      const storedActiveGoal = activeGoalFromState();
      const smartPercent = state.mode === "allowance" ? 0.2 : 0.3;
      let baseMoney = state.totalMoney;
      if (state.mode === "fixed") baseMoney = state.salary || state.totalMoney;
      else if (state.mode === "allowance") baseMoney = state.allowanceAmount || state.totalMoney;
      const effectiveSave = state.saveMode === "smart" ? Math.round(baseMoney * smartPercent) : state.saveAmount;
      const activeGoal = storedActiveGoal || fallbackGoalFromOnboarding(effectiveSave);

      if (activeGoal) {
        const key = goalLookupKey(activeGoal);
        const amount = modalState.amount;
        if (activeGoal.isFallback) {
          const target = activeGoal.targetAmount;
          const currentSaved = Math.min(activeGoal.savedAmount + amount, target);
          const newGoal = normalizeGoal({
            id: createClientGoalId(),
            type: activeGoal.type,
            title: activeGoal.title,
            targetAmount: target,
            savedAmount: currentSaved,
            isActive: true,
            syncStatus: window.saverSupabase?.isConfigured ? "pending" : "local",
          });

          const nextGoals = [newGoal, ...storedGoals.map(g => ({ ...g, isActive: false }))];
          setSavingsGoals(nextGoals);

          if (window.saverSupabase?.isConfigured && window.saverSupabase?.saveSavingsGoal) {
            try {
              const savedGoal = await window.saverSupabase.saveSavingsGoal(newGoal, window.currentSaverSession || null);
              if (savedGoal) {
                setSavingsGoals([normalizeGoal(savedGoal), ...storedGoals.map(g => ({ ...g, isActive: false }))]);
              }
            } catch (e) {
              console.error("Could not sync added funds remote", e);
            }
          }
        } else {
          const nextGoals = storedGoals.map(g => {
            if (goalLookupKey(g) === key) {
              const updatedSaved = (Number(g.savedAmount) || 0) + amount;
              return {
                ...g,
                savedAmount: Math.min(updatedSaved, g.targetAmount),
                syncStatus: window.saverSupabase?.isConfigured ? "pending" : "local"
              };
            }
            return g;
          });
          const updatedGoal = nextGoals.find(g => goalLookupKey(g) === key);
          setSavingsGoals(nextGoals);

          if (window.saverSupabase?.isConfigured && window.saverSupabase?.saveSavingsGoal && updatedGoal) {
            try {
              const savedGoal = await window.saverSupabase.saveSavingsGoal(updatedGoal, window.currentSaverSession || null);
              if (savedGoal) {
                setSavingsGoals(nextGoals.map(g => goalLookupKey(g) === key ? normalizeGoal(savedGoal) : g));
              }
            } catch (e) {
              console.error("Could not sync updated funds remote", e);
            }
          }
        }
      }
    }

    // Check for overspend alert after saving

    if (modalState.mode !== "edit" && isExpenseTransaction(savedTxn)) {
      const today = startOfDay(new Date());

      const todayTotal = txns
        .filter((t) => isExpenseTransaction(t) && t.ts >= today.getTime())
        .reduce((sum, t) => sum + t.amount, 0);

      const dailyLimit = state.rolloverDailyLimit || state.dailyBudget || 0;

      triggerOverspendAlert(todayTotal, dailyLimit);
    }

    // Show success screen instead of closing

    if (modalState.mode === "edit") {
      closeExpenseModal();
      populateDashboard();
    } else {
      showExpenseSuccessView();
    }
  } catch (error) {
    console.error("Could not save transaction", error);
    alert("We could not save this transaction. Please try again.");
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalSubmitText;
      validateExpenseForm();
    }
  }
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
  const titleEl = $("#expense-success-title");
  const copyEl = $("#expense-success-copy");
  const isIncome = modalState.kind === "income";
  const cat = categoryConfig[modalState.category] || categoryConfig.other;

  if (titleEl) titleEl.textContent = isIncome ? "Income Added" : "Expense Logged";
  if (copyEl) {
    copyEl.textContent = isIncome
      ? "Your available money has been updated."
      : "Your records have been updated.";
  }
  if (amountEl) amountEl.textContent = `${isIncome ? "+" : "-"}${formatCurrency(modalState.amount)}`;
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

function mergeTransactionLists(remoteTransactions = [], localTransactions = []) {
  if (window.saverSupabase?.mergeTransactions) {
    return window.saverSupabase.mergeTransactions(remoteTransactions, localTransactions);
  }

  const merged = [];
  const seen = new Set();

  [...remoteTransactions, ...localTransactions].forEach((transaction) => {
    if (!transaction) return;

    const contentKey = [
      "content",
      transaction.ts || "",
      transaction.amount || "",
      transaction.kind || "",
      transaction.category || "",
      transaction.source || "",
      transaction.desc || "",
    ].join(":");
    const keys = [
      transaction.remoteId ? `remote:${transaction.remoteId}` : "",
      transaction.clientTxnId ? `client:${transaction.clientTxnId}` : "",
      !transaction.remoteId && transaction.id ? `local:${transaction.id}` : "",
      contentKey,
    ].filter(Boolean);

    if (keys.some((key) => seen.has(key))) return;
    keys.forEach((key) => seen.add(key));
    merged.push(transaction);
  });

  return merged.sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
}

async function loadDashboardState(session) {
  if (window.saverSupabase?.isConfigured && window.saverSupabase?.loadAppData) {
    try {
      const appData = await window.saverSupabase.loadAppData(session);
      if (appData?.state) {
        const localTransactions = loadTransactions();

        applyStateSnapshot(appData.state);
        if (Array.isArray(appData.savingsGoals)) {
          state.savingsGoals = appData.savingsGoals.map(normalizeGoal).filter(Boolean);
        }
        saveState();

        let dashboardTransactions = Array.isArray(appData.transactions) ? appData.transactions : [];
        const hasUnsyncedLocalTransactions = localTransactions.some((transaction) => transaction && !transaction.remoteId);

        if (hasUnsyncedLocalTransactions && window.saverSupabase?.syncLocalTransactions) {
          const syncResult = await window.saverSupabase.syncLocalTransactions(
            localTransactions,
            session,
            state.activeBudgetCycleId || appData.budgetCycle?.id || null,
          );
          dashboardTransactions = mergeTransactionLists(dashboardTransactions, syncResult.transactions || []);
        } else {
          dashboardTransactions = mergeTransactionLists(dashboardTransactions, localTransactions);
        }

        saveTransactions(dashboardTransactions);
        return true;
      }
    } catch (error) {
      console.error("Could not load dashboard app data", error);
    }
  }

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
// ─── Notification System ────────────────────────────────────────

const NOTIF_PREFS_KEY = "saver-notif-prefs";
const NOTIF_HISTORY_KEY = "saver-notif-history";
const MAX_HISTORY = 15;

// Default preferences

function loadNotifPrefs() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)) || {
      morning: true,
      evening: true,
      overspend: true,
    };
  } catch (_) {
    return { morning: true, evening: true, overspend: true };
  }
}

function saveNotifPrefs(prefs) {
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
}

// Notification history

function loadNotifHistory() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_HISTORY_KEY)) || [];
  } catch (_) {
    return [];
  }
}

function saveNotifToHistory(notif) {
  const history = loadNotifHistory();

  history.unshift({
    title: notif.title,
    body: notif.body,
    icon: notif.icon || "notifications",
    ts: Date.now(),
  });

  // Keep only the most recent entries

  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(history));
}

// Render notification history in the panel

function renderNotifHistory() {
  const container = $("#notif-history-list");
  const emptyState = $("#notif-empty-state");
  const history = loadNotifHistory();

  if (!container) return;

  // Clear existing items (keep empty state)

  container.querySelectorAll(".notif-history-item").forEach((el) => el.remove());

  if (history.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  history.forEach((item) => {
    const iconColors = {
      wb_sunny: "bg-amber-100 text-amber-700",
      bedtime: "bg-indigo-100 text-indigo-700",
      warning: "bg-red-100 text-red-700",
      notifications: "bg-stone-100 text-stone-600",
    };
    const colorClass = iconColors[item.icon] || iconColors.notifications;

    const el = document.createElement("div");
    el.className = "notif-history-item flex items-start gap-3 p-3 rounded-2xl bg-surface-container-low/50";
    el.innerHTML = `
      <div class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shrink-0 mt-0.5">
        <span class="material-symbols-outlined text-base">${escapeHTML(item.icon)}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-on-surface">${escapeHTML(item.title)}</p>
        <p class="text-xs text-on-surface-variant">${escapeHTML(item.body)}</p>
        <p class="text-[10px] text-on-surface-variant/50 mt-1">${relativeDate(item.ts)}</p>
      </div>
    `;
    container.appendChild(el);
  });
}

// Update notification dot badge

function updateNotifDot() {
  const dot = $("#notif-dot");

  if (!dot) return;

  const history = loadNotifHistory();
  const lastSeen = Number(localStorage.getItem("saver-notif-last-seen") || 0);
  const hasUnread = history.some((n) => n.ts > lastSeen);

  dot.classList.toggle("hidden", !hasUnread);
}

// Send a browser notification + save to history

function sendSaverNotification(title, body, icon) {
  const notifData = { title, body, icon: icon || "notifications" };

  // Save to history regardless of permission

  saveNotifToHistory(notifData);
  updateNotifDot();
  renderNotifHistory();

  // Send browser notification if permitted

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        tag: `saver-${icon || "general"}`,
        renotify: true,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (_) {
      // Fallback: notification via service worker

      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          body,
          icon: "/icons/icon-192.svg",
        });
      }
    }
  }
}

// Smart notification triggers

function triggerMorningBudget() {
  const prefs = loadNotifPrefs();

  if (!prefs.morning) return;

  const hour = new Date().getHours();

  if (hour < 6 || hour >= 10) return;

  const todayKey = `saver-notif-morning-${new Date().toDateString()}`;

  if (sessionStorage.getItem(todayKey)) return;

  sessionStorage.setItem(todayKey, "1");

  const dailyLimit = state.rolloverDailyLimit || state.dailyBudget || 0;

  if (dailyLimit <= 0) return;

  sendSaverNotification(
    "Good morning! ☀️",
    `Your budget today is ${formatCurrency(dailyLimit)}. Spend wisely! 💚`,
    "wb_sunny",
  );
}

function triggerEveningSummary() {
  const prefs = loadNotifPrefs();

  if (!prefs.evening) return;

  const hour = new Date().getHours();

  if (hour < 19) return;

  const todayKey = `saver-notif-evening-${new Date().toDateString()}`;

  if (sessionStorage.getItem(todayKey)) return;

  sessionStorage.setItem(todayKey, "1");

  const txns = loadTransactions();
  const today = startOfDay(new Date());

  const todaySpent = txns
    .filter((t) => isExpenseTransaction(t) && t.ts >= today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);

  const dailyLimit = state.rolloverDailyLimit || state.dailyBudget || 0;
  const saved = Math.max(dailyLimit - todaySpent, 0);

  let body;

  if (todaySpent === 0) {
    body = "No spending today — perfect saving day! 🎯";
  } else if (todaySpent <= dailyLimit) {
    body = `Spent ${formatCurrency(todaySpent)}, saved ${formatCurrency(saved)} today. Great job! 🎉`;
  } else {
    const over = todaySpent - dailyLimit;
    body = `Spent ${formatCurrency(todaySpent)} — ${formatCurrency(over)} over budget today.`;
  }

  sendSaverNotification("Evening Summary 🌙", body, "bedtime");
}

function triggerOverspendAlert(newTotal, dailyLimit) {
  const prefs = loadNotifPrefs();

  if (!prefs.overspend) return;

  if (newTotal <= dailyLimit || dailyLimit <= 0) return;

  const todayKey = `saver-notif-overspend-${new Date().toDateString()}`;

  if (sessionStorage.getItem(todayKey)) return;

  sessionStorage.setItem(todayKey, "1");

  const over = newTotal - dailyLimit;

  sendSaverNotification(
    "Budget Alert 🚨",
    `You've crossed today's ${formatCurrency(dailyLimit)} budget by ${formatCurrency(over)}.`,
    "warning",
  );
}

// Notification Center panel

function openNotifPanel() {
  const panel = $("#notif-panel");

  if (!panel) return;

  panel.classList.remove("hidden");
  lockBodyScroll();

  // Mark all as seen

  localStorage.setItem("saver-notif-last-seen", String(Date.now()));
  updateNotifDot();

  // Update permission cards

  updateNotifPermissionUI();

  // Load toggle states from prefs

  const prefs = loadNotifPrefs();
  const morningToggle = $("#notif-toggle-morning");
  const eveningToggle = $("#notif-toggle-evening");
  const overspendToggle = $("#notif-toggle-overspend");

  if (morningToggle) morningToggle.checked = prefs.morning;
  if (eveningToggle) eveningToggle.checked = prefs.evening;
  if (overspendToggle) overspendToggle.checked = prefs.overspend;

  // Render history

  renderNotifHistory();
}

function closeNotifPanel() {
  const panel = $("#notif-panel");

  if (!panel) return;

  panel.classList.add("hidden");
  unlockBodyScroll();
}

function updateNotifPermissionUI() {
  const permCard = $("#notif-permission-card");
  const deniedCard = $("#notif-denied-card");

  if (!("Notification" in window)) {
    // Browser doesn't support notifications

    if (permCard) permCard.classList.add("hidden");
    if (deniedCard) deniedCard.classList.add("hidden");
    return;
  }

  const perm = Notification.permission;

  if (permCard) permCard.classList.toggle("hidden", perm !== "default");
  if (deniedCard) deniedCard.classList.toggle("hidden", perm !== "denied");
}

function initNotificationCenter() {

  // Bell button

  const bellBtn = $("#notif-bell-btn");

  if (bellBtn) bellBtn.addEventListener("click", openNotifPanel);

  // Profile notification button

  const profileNotifBtn = $("#profile-notif-btn");

  if (profileNotifBtn) profileNotifBtn.addEventListener("click", openNotifPanel);

  // Close panel

  const closeBtn = $("#notif-panel-close");
  const backdrop = $("#notif-panel-backdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeNotifPanel);
  if (backdrop) backdrop.addEventListener("click", closeNotifPanel);

  // Enable notifications button

  const enableBtn = $("#notif-enable-btn");

  if (enableBtn) {
    enableBtn.addEventListener("click", async () => {
      if (!("Notification" in window)) return;

      const result = await Notification.requestPermission();

      updateNotifPermissionUI();

      if (result === "granted") {
        sendSaverNotification(
          "Notifications Enabled! 🔔",
          "You'll now receive budget reminders and spending alerts.",
          "notifications",
        );
      }
    });
  }

  // Toggle switches — persist to localStorage

  const morningToggle = $("#notif-toggle-morning");
  const eveningToggle = $("#notif-toggle-evening");
  const overspendToggle = $("#notif-toggle-overspend");

  function onToggleChange() {
    saveNotifPrefs({
      morning: morningToggle?.checked ?? true,
      evening: eveningToggle?.checked ?? true,
      overspend: overspendToggle?.checked ?? true,
    });
  }

  if (morningToggle) morningToggle.addEventListener("change", onToggleChange);
  if (eveningToggle) eveningToggle.addEventListener("change", onToggleChange);
  if (overspendToggle) overspendToggle.addEventListener("change", onToggleChange);

  // Initial dot update

  updateNotifDot();
}

// ─── End Notification System ────────────────────────────────────

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
  initNotificationCenter();

  // Fire time-based smart notifications

  triggerMorningBudget();
  triggerEveningSummary();
}

// Start the dashboard
init();

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

function populateGoalCard(effectiveSave) {
  const isSpecific = state.goalType === "specific";
  const goalName = isSpecific ? state.goalItem || "Your Item" : "Safety Buffer";
  const goalIcon = isSpecific ? "shopping_bag" : "shield";
  const goalTypeLabel = isSpecific ? "SPECIFIC ITEM" : "SAFETY BUFFER";
  const goalTarget = isSpecific ? state.goalPrice : 5000;
  const progress =
    goalTarget > 0 ? Math.min(Math.round((effectiveSave / goalTarget) * 100), 100) : 0;
  const cyclesNeeded = effectiveSave > 0 ? Math.ceil(goalTarget / effectiveSave) : 0;

  // Goals tab elements

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
        ? `~${cyclesNeeded} cycle${cyclesNeeded > 1 ? "s" : ""} to reach ${formatCurrency(goalTarget)} 💪`
        : "Complete onboarding to set your saving goal.";

  // Goal progress ring

  const goalRingArc = $("#goal-ring-arc");

  if (goalRingArc) {
    const circumference = 2 * Math.PI * 42;
    const offset = circumference * (1 - progress / 100);
    goalRingArc.style.strokeDashoffset = offset;
  }

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

  if (title) title.textContent = isIncome ? "Log Income" : "Log Expense";
  if (submitBtn) submitBtn.textContent = isIncome ? "Add Income" : "Add Expense";
  if (categorySection) categorySection.classList.toggle("hidden", isIncome);
  if (descInput) descInput.placeholder = isIncome ? "Where did this come from?" : "What was this for?";

  checkImpulseGuard();
  validateExpenseForm();
}

function openExpenseModal(preCategory) {
  const modal = $("#expense-modal");
  if (!modal) return;

  // Reset form

  modalState.amount = 0;
  modalState.desc = "";
  modalState.kind = preCategory === "income" ? "income" : "expense";
  modalState.category = modalState.kind === "income" ? "income" : preCategory || "";
  modalState.source = "savings";

  // Cache current rollover daily limit for impulse guard

  const limitText = $("#hero-daily-limit")?.textContent?.replace(/[^0-9]/g, "") || "0";
  modalState.dailyLimit = parseInt(limitText) || 0;

  const amtInput = $("#expense-amount-input");
  const descInput = $("#expense-desc-input");

  if (amtInput) amtInput.value = "";
  if (descInput) descInput.value = "";

  // Pre-select category if provided

  $$("[data-modal-cat]").forEach((c) => {
    c.classList.toggle(
      "is-active",
      modalState.kind === "expense" && c.dataset.modalCat === preCategory,
    );
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
  const originalSubmitText = submitBtn?.textContent || (kind === "income" ? "Add Income" : "Add Expense");
  const catConfig = categoryConfig[category] || categoryConfig.other;
  const localTxn = {
    amount: modalState.amount,
    desc: modalState.desc || catConfig.label || (kind === "income" ? "Income" : "Expense"),
    kind,
    category,
    source: modalState.source,
    ts: Date.now(),
    budgetCycleId: state.activeBudgetCycleId || null,
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    let savedTxn = localTxn;

    if (window.saverSupabase?.isConfigured && window.saverSupabase?.addTransaction) {
      const remoteTxn = await window.saverSupabase.addTransaction(
        localTxn,
        window.currentSaverSession || null,
        state.activeBudgetCycleId || null,
      );
      if (remoteTxn) savedTxn = { ...localTxn, ...remoteTxn };
    }

    if (savedTxn.budgetCycleId && savedTxn.budgetCycleId !== state.activeBudgetCycleId) {
      state.activeBudgetCycleId = savedTxn.budgetCycleId;
      saveState();
    }

    const txns = loadTransactions();
    txns.push(savedTxn);

    saveTransactions(txns);

    // Check for overspend alert after saving

    if (isExpenseTransaction(savedTxn)) {
      const today = startOfDay(new Date());

      const todayTotal = txns
        .filter((t) => isExpenseTransaction(t) && t.ts >= today.getTime())
        .reduce((sum, t) => sum + t.amount, 0);

      const dailyLimit = state.rolloverDailyLimit || state.dailyBudget || 0;

      triggerOverspendAlert(todayTotal, dailyLimit);
    }

    // Show success screen instead of closing

    showExpenseSuccessView();
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

    const key =
      transaction.remoteId ||
      transaction.id ||
      [
        transaction.ts,
        transaction.amount,
        transaction.kind || "",
        transaction.category,
        transaction.source,
        transaction.desc,
      ].join(":");

    if (seen.has(key)) return;
    seen.add(key);
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

/**
 * Saver — Shared Utilities
 *
 * Common functions used by both onboarding.js and dashboard.js.
 * Loaded first in every authenticated page's <script> tags.
 */

// ── DOM Shorthand ────────────────────────────────────────────────
// $ = single element, $$ = array of elements.
// Keeps DOM queries at the top so they're easy to find and update.

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return [...document.querySelectorAll(sel)];
}

// ── Currency Formatting ──────────────────────────────────────────
// Formats a number as Indian Rupee currency (₹1,500).
// Returns ₹0 for invalid values to prevent NaN in the UI.

function formatCurrency(value) {
  const num = Number.isFinite(value) ? value : 0;
  return "\u20B9" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
}

// ── Value Animation ──────────────────────────────────────────────
// Applies a pop animation when a displayed value changes.
// Prevents re-triggering if the text hasn't actually changed.

function animateValue(el, text) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("number-updated");

  // Force browser reflow so the animation class restarts from scratch

  void el.offsetWidth;

  el.classList.add("number-updated");
}

// ── Onboarding State ─────────────────────────────────────────────
// Central state object that tracks every user choice during onboarding.
// Persisted to localStorage so progress survives page refreshes.

const state = {
  step: 1,
  mode: "", // "fixed" | "irregular" | "allowance"
  totalMoney: 0, // how much money the user currently has
  saveMode: "", // "custom" | "smart"
  saveAmount: 0, // how much they want to save per cycle
  goalType: "", // "specific" | "safety"
  goalItem: "", // what they want to buy (only for "specific")
  goalPrice: 0, // target price (only for "specific")
};

// ── State Persistence ────────────────────────────────────────────
// Saves/loads onboarding progress to localStorage.
// Users can close the tab and resume exactly where they left off.

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

// ── Transaction Storage ──────────────────────────────────────────
// Expenses/income are stored in localStorage as an array of objects.

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem("saver_transactions") || "[]");
  } catch (_) {
    return [];
  }
}

function saveTransactions(txns) {
  try {
    localStorage.setItem("saver_transactions", JSON.stringify(txns));
  } catch (_) {}
}

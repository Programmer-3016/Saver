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

const defaultState = {
  step: 1,
  mode: "", // "fixed" | "irregular" | "allowance"
  totalMoney: 0, // how much money the user currently has
  saveMode: "", // "custom" | "smart"
  saveAmount: 0, // how much they want to save per cycle
  goalType: "", // "specific" | "safety"
  goalItem: "", // what they want to buy (only for "specific")
  goalPrice: 0, // target price (only for "specific")
  onboardingComplete: false, // true after completing all onboarding steps
};

const state = { ...defaultState };

// ── State Persistence ────────────────────────────────────────────
// Saves/loads onboarding progress to localStorage.
// Authenticated users get user-scoped keys so one account cannot inherit
// another account's setup state from the same browser.

let saverStorageOwnerId = "";

function setSaverStorageOwner(ownerId) {
  saverStorageOwnerId = ownerId || "";
}

function saverStorageKey(baseKey) {
  return saverStorageOwnerId ? `${baseKey}:${saverStorageOwnerId}` : baseKey;
}

function applyStateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  Object.assign(state, defaultState, snapshot);
  return true;
}

function saveState() {
  try {
    localStorage.setItem(saverStorageKey("saver_onboarding"), JSON.stringify(state));
  } catch (_) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem(saverStorageKey("saver_onboarding"));
    if (saved) {
      const parsed = JSON.parse(saved);
      return applyStateSnapshot(parsed);
    }
  } catch (_) {}
  return false;
}

function clearSaverLocalData() {
  try {
    ["saver_onboarding", "saver_transactions"].forEach((baseKey) => {
      localStorage.removeItem(saverStorageKey(baseKey));
      localStorage.removeItem(baseKey);
    });

    ["saverUserEmail", "saverUserName", "saverAuthProvider"].forEach((key) =>
      localStorage.removeItem(key),
    );
  } catch (_) {}
}

// ── Transaction Storage ──────────────────────────────────────────
// Expenses/income are stored in localStorage as an array of objects.

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(saverStorageKey("saver_transactions")) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((txn) => {
        if (!txn || typeof txn !== "object") return null;

        const amount = Number(txn.amount);
        const ts = Number(txn.ts);
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(ts)) return null;

        return {
          amount,
          desc: typeof txn.desc === "string" ? txn.desc : "",
          category: typeof txn.category === "string" ? txn.category : "other",
          source: typeof txn.source === "string" ? txn.source : "savings",
          ts,
        };
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function saveTransactions(txns) {
  try {
    localStorage.setItem(saverStorageKey("saver_transactions"), JSON.stringify(txns));
  } catch (_) {}
}

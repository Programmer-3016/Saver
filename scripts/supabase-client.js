// Supabase client bootstrap for the static Saver app.

(function () {
  const config = window.saverSupabaseConfig || {};
  const projectUrl = config.url || "";
  const anonKey = config.anonKey || "";

  const isConfigured =
    projectUrl.startsWith("https://") &&
    projectUrl.includes(".supabase.co") &&
    !projectUrl.includes("YOUR_PROJECT_REF") &&
    anonKey &&
    anonKey !== "YOUR_SUPABASE_ANON_KEY";

  const cleanRoutes = {
    "register.html": "/register",
    "login.html": "/login",
    "onboarding.html": "/onboarding",
    "dashboard.html": "/dashboard",
    "reset-password.html": "/reset-password",
  };
  const allowedMoneyModes = new Set(["fixed", "irregular", "allowance"]);
  const transactionSelectColumns =
    "id, budget_cycle_id, kind, amount, category, description, payment_source, occurred_at, client_txn_id";
  const legacyTransactionSelectColumns =
    "id, budget_cycle_id, kind, amount, category, description, payment_source, occurred_at";

  function shouldUseCleanRoutes() {
    return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  }

  function pageUrl(pageName) {
    const routeName = pageName.replace(/^\/?(pages\/)?/, "");

    if (shouldUseCleanRoutes() && cleanRoutes[routeName]) {
      return new URL(cleanRoutes[routeName], window.location.origin).href;
    }

    const normalizedPath = pageName.startsWith("/") ? pageName : `/pages/${pageName}`;
    return new URL(normalizedPath, window.location.origin).href;
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

  function fullNameFromUser(user) {
    return cleanProfileText(
      user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.user_metadata?.display_name ||
        "",
    );
  }

  function profileEmailFromRow(profile, user) {
    return cleanProfileText(profile?.email || user?.email || storedProfileValue("saverUserEmail"));
  }

  function profileNameFromRow(profile, user) {
    const email = profileEmailFromRow(profile, user);

    return (
      cleanProfileText(profile?.full_name) ||
      fullNameFromUser(user) ||
      storedProfileValue("saverUserName") ||
      emailDisplayName(email) ||
      "Saver User"
    );
  }

  function profileStateFromRow(profile, user) {
    const profileEmail = profileEmailFromRow(profile, user);
    const profileName = profileNameFromRow(profile, user);

    if (profileEmail) localStorage.setItem("saverUserEmail", profileEmail);
    if (profileName && profileName !== "Saver User") {
      localStorage.setItem("saverUserName", profileName);
    }

    return {
      profileName,
      profileEmail,
    };
  }

  function persistUserProfile(user) {
    if (!user) return;

    const email = user.email;
    const fullName = fullNameFromUser(user);

    if (email) localStorage.setItem("saverUserEmail", email);
    if (fullName) localStorage.setItem("saverUserName", fullName);
    if (window.setSaverStorageOwner) window.setSaverStorageOwner(user.id);
  }

  function isMissingAppSchema(error) {
    return error?.code === "42P01" || error?.code === "PGRST205";
  }

  function isMissingClientTxnColumn(error) {
    const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
    return error?.code === "42703" || error?.code === "PGRST204" || message.includes("client_txn_id");
  }

  function cleanClientTxnId(value) {
    return cleanProfileText(value).slice(0, 120);
  }

  function generatedClientTxnId() {
    if (window.createClientTxnId) return window.createClientTxnId();
    return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function withClientTxnId(transaction = {}) {
    const existingClientTxnId = cleanClientTxnId(transaction.clientTxnId || transaction.id);
    const clientTxnId = existingClientTxnId || generatedClientTxnId();

    return {
      ...transaction,
      id: transaction.id || clientTxnId,
      clientTxnId,
    };
  }

  function numericValue(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(num, 0) : 0;
  }

  function hasCompleteSetup(onboardingState = {}) {
    if (!onboardingState?.onboardingComplete) return false;
    if (!allowedMoneyModes.has(onboardingState.mode)) return false;

    const availableMoney = Math.max(
      numericValue(onboardingState.totalMoney),
      numericValue(onboardingState.salary),
      numericValue(onboardingState.allowanceAmount),
      numericValue(onboardingState.avgIncome)
    );

    return availableMoney > 0;
  }

  function setupSource(options = {}) {
    return options.source || "onboarding";
  }

  function needsAppSetupBackfill(onboardingState, budgetCycle, savingsGoal) {
    return hasCompleteSetup(onboardingState) && (!budgetCycle?.id || !savingsGoal?.id);
  }

  function localDateString(date) {
    const copy = new Date(date);
    copy.setHours(12, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  }

  function computeSetupSnapshot(onboardingState = {}) {
    const mode = onboardingState.mode || "";
    const smartPercent = mode === "allowance" ? 0.2 : 0.3;
    const cycleLength = Math.max(numericValue(onboardingState.cycleLength) || 30, 1);
    const fixedExpenses = mode === "fixed" ? numericValue(onboardingState.fixedExpenses) : 0;

    let baseMoney = numericValue(onboardingState.totalMoney);
    let incomeAmount = numericValue(onboardingState.avgIncome);

    if (mode === "fixed") {
      incomeAmount = numericValue(onboardingState.salary);
      baseMoney = incomeAmount || baseMoney;
    } else if (mode === "allowance") {
      incomeAmount = numericValue(onboardingState.allowanceAmount);
      baseMoney = incomeAmount || baseMoney;
    } else if (mode === "irregular") {
      incomeAmount = numericValue(onboardingState.avgIncome) || baseMoney;
    }

    const savingTarget =
      onboardingState.saveMode === "smart"
        ? Math.round(baseMoney * smartPercent)
        : numericValue(onboardingState.saveAmount);
    const freeToSpend = Math.max(baseMoney - fixedExpenses - savingTarget, 0);
    const dailyLimit = Math.round(freeToSpend / cycleLength);
    const cycleStart = new Date();
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + cycleLength - 1);

    return {
      mode,
      cycleLength,
      baseMoney,
      incomeAmount,
      fixedExpenses,
      savingTarget,
      freeToSpend,
      dailyLimit,
      cycleStart: localDateString(cycleStart),
      cycleEnd: localDateString(cycleEnd),
    };
  }

  function buildBudgetPayload(userId, onboardingState, options = {}) {
    const snapshot = computeSetupSnapshot(onboardingState);

    return {
      payload: {
        user_id: userId,
        money_mode: snapshot.mode,
        currency: "INR",
        cycle_start: snapshot.cycleStart,
        cycle_end: snapshot.cycleEnd,
        starting_balance: snapshot.baseMoney,
        income_amount: snapshot.incomeAmount,
        fixed_expenses_amount: snapshot.fixedExpenses,
        saving_target_amount: snapshot.savingTarget,
        free_to_spend_amount: snapshot.freeToSpend,
        daily_limit_amount: snapshot.dailyLimit,
        is_active: true,
        settings: {
          saveMode: onboardingState.saveMode || "",
          payDay: numericValue(onboardingState.payDay) || 1,
          cycleLength: snapshot.cycleLength,
          allowanceFrequency: onboardingState.allowanceFrequency || "monthly",
          setupSource: setupSource(options),
          onboardingState,
        },
      },
      snapshot,
    };
  }

  function buildGoalPayload(userId, onboardingState, snapshot, options = {}) {
    const isSpecific = onboardingState.goalType === "specific";
    const goalType = isSpecific ? "specific" : onboardingState.goalType === "safety" ? "safety" : "custom";
    const fallbackTarget = Math.max(snapshot.savingTarget * 3, 5000);
    const targetAmount = isSpecific ? numericValue(onboardingState.goalPrice) || fallbackTarget : fallbackTarget;

    return {
      user_id: userId,
      goal_type: goalType,
      title: isSpecific ? onboardingState.goalItem || "Saving goal" : "Safety Buffer",
      target_amount: targetAmount,
      saved_amount: snapshot.savingTarget,
      is_active: true,
      metadata: {
        saveMode: onboardingState.saveMode || "",
        cycleSavingAmount: snapshot.savingTarget,
        setupSource: setupSource(options),
      },
    };
  }

  function stateFromAppRows(budgetCycle, savingsGoal) {
    const appState = {};

    if (budgetCycle?.id) {
      appState.activeBudgetCycleId = budgetCycle.id;
      appState.dailyBudget = numericValue(budgetCycle.daily_limit_amount);
      appState.freeToSpendAmount = numericValue(budgetCycle.free_to_spend_amount);
    }

    if (savingsGoal?.id) {
      appState.activeSavingsGoalId = savingsGoal.id;
    }

    return appState;
  }

  function rowToTransaction(row) {
    const occurredAt = row?.occurred_at ? new Date(row.occurred_at).getTime() : Date.now();
    const kind = row?.kind === "income" ? "income" : "expense";
    const category = kind === "income" ? "income" : row?.category || "other";
    const clientTxnId = cleanClientTxnId(row?.client_txn_id);

    const transaction = {
      remoteId: row.id,
      id: row.id,
      budgetCycleId: row.budget_cycle_id || null,
      amount: numericValue(row.amount),
      desc: row.description || "",
      kind,
      category,
      source: row.payment_source || "savings",
      ts: Number.isFinite(occurredAt) ? occurredAt : Date.now(),
      syncStatus: "synced",
    };

    if (clientTxnId) transaction.clientTxnId = clientTxnId;

    return transaction;
  }

  function transactionToRow(userId, transaction, budgetCycleId) {
    const kind =
      transaction.kind === "income" || transaction.category === "income" ? "income" : "expense";
    const category = kind === "income" ? "income" : transaction.category || "other";
    const clientTxnId = cleanClientTxnId(
      transaction.clientTxnId || (!transaction.remoteId ? transaction.id : ""),
    );

    const payload = {
      user_id: userId,
      budget_cycle_id: budgetCycleId || transaction.budgetCycleId || null,
      kind,
      amount: numericValue(transaction.amount),
      category,
      description: transaction.desc || "",
      payment_source: transaction.source || "savings",
      occurred_at: new Date(transaction.ts || Date.now()).toISOString(),
      metadata: {
        source: "saver_dashboard",
      },
    };

    if (clientTxnId) {
      payload.client_txn_id = clientTxnId;
      payload.metadata.clientTxnId = clientTxnId;
    }

    return payload;
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

  function transactionKeys(transaction) {
    if (!transaction) return [];

    const keys = [];
    if (transaction.remoteId) keys.push(`remote:${transaction.remoteId}`);
    if (transaction.clientTxnId) keys.push(`client:${transaction.clientTxnId}`);
    if (!transaction.remoteId && transaction.id) keys.push(`local:${transaction.id}`);
    keys.push(transactionContentKey(transaction));
    return keys;
  }

  function mergeTransactions(primary = [], secondary = []) {
    const merged = [];
    const seen = new Set();

    [...primary, ...secondary].forEach((transaction) => {
      const keys = transactionKeys(transaction);
      if (keys.length === 0 || keys.some((key) => seen.has(key))) return;

      keys.forEach((key) => seen.add(key));
      merged.push(transaction);
    });

    return merged.sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
  }

  const api = {
    client: null,
    isConfigured,
    pageUrl,
    getSession: async () => null,
    requireSession: async () => true,
    ensureProfile: async () => null,
    loadOnboarding: async () => null,
    saveOnboarding: async () => null,
    resetOnboarding: async () => null,
    loadAppData: async () => null,
    saveAppSetup: async () => null,
    loadTransactions: async () => [],
    addTransaction: async () => null,
    updateTransaction: async () => null,
    deleteTransaction: async () => false,
    syncLocalTransactions: async (transactions = []) => ({ transactions, synced: false, failed: 0 }),
    mergeTransactions,
    resetAppData: async () => null,
  };

  if (!isConfigured || !window.supabase?.createClient) {
    window.saverSupabase = api;
    return;
  }

  api.client = window.supabase.createClient(projectUrl, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  api.getSession = async function () {
    const {
      data: { session },
      error,
    } = await api.client.auth.getSession();

    if (error) throw error;
    if (session?.user) persistUserProfile(session.user);
    return session || null;
  };

  api.requireSession = async function () {
    let session = null;

    try {
      session = await api.getSession();
    } catch (_) {
      session = null;
    }

    if (!session) {
      window.location.replace(api.pageUrl("login.html"));
      return null;
    }

    return session;
  };

  api.ensureProfile = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);

    const payload = {
      id: user.id,
      email: user.email || null,
    };

    const fullName = fullNameFromUser(user);
    if (fullName) payload.full_name = fullName;

    const { data, error } = await api.client
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, email, full_name, onboarding_completed, onboarding_data")
      .maybeSingle();

    if (error) {
      if (isMissingAppSchema(error)) return null;
      throw error;
    }

    return data;
  };

  async function getActiveBudgetCycle(userId) {
    const { data, error } = await api.client
      .from("budget_cycles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingAppSchema(error)) return null;
      throw error;
    }

    return data || null;
  }

  async function getActiveSavingsGoal(userId) {
    const { data, error } = await api.client
      .from("savings_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingAppSchema(error)) return null;
      throw error;
    }

    return data || null;
  }

  api.loadOnboarding = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    const profile = await api.ensureProfile(activeSession);

    if (!profile) return null;

    return {
      ...(profile.onboarding_data || {}),
      ...profileStateFromRow(profile, user),
      onboardingComplete: Boolean(profile.onboarding_completed),
    };
  };

  api.loadTransactions = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return [];

    persistUserProfile(user);

    let { data, error } = await api.client
      .from("transactions")
      .select(transactionSelectColumns)
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: true })
      .limit(500);

    if (error && isMissingClientTxnColumn(error)) {
      ({ data, error } = await api.client
        .from("transactions")
        .select(legacyTransactionSelectColumns)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: true })
        .limit(500));
    }

    if (error) {
      if (isMissingAppSchema(error)) return [];
      throw error;
    }

    return (data || []).map(rowToTransaction);
  };

  api.loadAppData = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);

    const profileState = await api.loadOnboarding(activeSession);
    let [budgetCycle, savingsGoal, transactions] = await Promise.all([
      getActiveBudgetCycle(user.id),
      getActiveSavingsGoal(user.id),
      api.loadTransactions(activeSession),
    ]);
    let backfilled = false;

    if (needsAppSetupBackfill(profileState, budgetCycle, savingsGoal)) {
      const appSetup = await api.saveAppSetup(profileState, activeSession, { source: "profile_backfill" });
      budgetCycle = appSetup?.budgetCycle || budgetCycle;
      savingsGoal = appSetup?.savingsGoal || savingsGoal;
      backfilled = Boolean(appSetup?.state);
    }

    return {
      state: {
        ...(profileState || {}),
        ...stateFromAppRows(budgetCycle, savingsGoal),
        onboardingComplete: Boolean(profileState?.onboardingComplete || budgetCycle),
      },
      budgetCycle,
      savingsGoal,
      backfilled,
      transactions,
    };
  };

  api.saveAppSetup = async function (onboardingState, session, options = {}) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);
    if (!hasCompleteSetup(onboardingState)) return null;

    const { payload, snapshot } = buildBudgetPayload(user.id, onboardingState || {}, options);
    const existingBudgetCycle = await getActiveBudgetCycle(user.id);
    const budgetBuilder = existingBudgetCycle?.id
      ? api.client.from("budget_cycles").update(payload).eq("id", existingBudgetCycle.id)
      : api.client.from("budget_cycles").insert(payload);

    const { data: budgetCycle, error: budgetError } = await budgetBuilder
      .select("id, daily_limit_amount, free_to_spend_amount")
      .maybeSingle();

    if (budgetError) {
      if (isMissingAppSchema(budgetError)) return null;
      throw budgetError;
    }

    const savedBudgetCycle = budgetCycle || existingBudgetCycle;
    const goalPayload = buildGoalPayload(user.id, onboardingState || {}, snapshot, options);
    const existingSavingsGoal = await getActiveSavingsGoal(user.id);
    const goalBuilder = existingSavingsGoal?.id
      ? api.client.from("savings_goals").update(goalPayload).eq("id", existingSavingsGoal.id)
      : api.client.from("savings_goals").insert(goalPayload);

    const { data: savingsGoal, error: goalError } = await goalBuilder
      .select("id, target_amount, saved_amount")
      .maybeSingle();

    if (goalError) {
      if (isMissingAppSchema(goalError)) return null;
      throw goalError;
    }

    return {
      budgetCycle: savedBudgetCycle,
      savingsGoal: savingsGoal || existingSavingsGoal,
      state: {
        ...stateFromAppRows(savedBudgetCycle, savingsGoal || existingSavingsGoal),
        dailyBudget: snapshot.dailyLimit,
        freeToSpendAmount: snapshot.freeToSpend,
      },
    };
  };

  async function findTransactionByClientId(userId, clientTxnId) {
    if (!clientTxnId) return null;

    const { data, error } = await api.client
      .from("transactions")
      .select(transactionSelectColumns)
      .eq("user_id", userId)
      .eq("client_txn_id", clientTxnId)
      .maybeSingle();

    if (error) {
      if (isMissingAppSchema(error) || isMissingClientTxnColumn(error)) return null;
      throw error;
    }

    return data ? rowToTransaction(data) : null;
  }

  api.addTransaction = async function (transaction, session, budgetCycleId) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);

    let activeBudgetCycleId = budgetCycleId || (await getActiveBudgetCycle(user.id))?.id || null;

    if (!activeBudgetCycleId) {
      const profileState = await api.loadOnboarding(activeSession);

      if (hasCompleteSetup(profileState)) {
        const appSetup = await api.saveAppSetup(profileState, activeSession, { source: "transaction_backfill" });
        activeBudgetCycleId = appSetup?.budgetCycle?.id || null;
      }
    }

    const transactionDraft = transaction?.remoteId ? transaction || {} : withClientTxnId(transaction || {});
    const payload = transactionToRow(user.id, transactionDraft, activeBudgetCycleId);
    const existingTransaction = await findTransactionByClientId(user.id, payload.client_txn_id);

    if (existingTransaction) return existingTransaction;

    let { data, error } = await api.client
      .from("transactions")
      .insert(payload)
      .select(transactionSelectColumns)
      .maybeSingle();

    if (error?.code === "23505" && payload.client_txn_id) {
      const existingAfterConflict = await findTransactionByClientId(user.id, payload.client_txn_id);
      if (existingAfterConflict) return existingAfterConflict;
    }

    if (error && isMissingClientTxnColumn(error)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.client_txn_id;

      ({ data, error } = await api.client
        .from("transactions")
        .insert(legacyPayload)
        .select(legacyTransactionSelectColumns)
        .maybeSingle());
    }

    if (error) {
      if (isMissingAppSchema(error)) return null;
      throw error;
    }

    const savedTransaction = data ? rowToTransaction(data) : null;
    if (savedTransaction && payload.client_txn_id && !savedTransaction.clientTxnId) {
      savedTransaction.clientTxnId = payload.client_txn_id;
    }

    return savedTransaction;
  };

  function filterTransactionMutation(query, userId, transaction) {
    if (transaction?.remoteId) {
      return query.eq("user_id", userId).eq("id", transaction.remoteId);
    }

    if (transaction?.clientTxnId) {
      return query.eq("user_id", userId).eq("client_txn_id", transaction.clientTxnId);
    }

    return null;
  }

  api.updateTransaction = async function (transaction, session, budgetCycleId) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id || !transaction) return null;

    persistUserProfile(user);

    const activeBudgetCycleId =
      budgetCycleId || transaction.budgetCycleId || (await getActiveBudgetCycle(user.id))?.id || null;
    const payload = transactionToRow(user.id, transaction, activeBudgetCycleId);
    const canMutate = Boolean(transaction.remoteId || transaction.clientTxnId);

    if (!canMutate) return null;

    delete payload.id;
    delete payload.user_id;

    let { data, error } = await filterTransactionMutation(
      api.client.from("transactions").update(payload),
      user.id,
      transaction,
    )
      .select(transactionSelectColumns)
      .maybeSingle();

    if (error && isMissingClientTxnColumn(error)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.client_txn_id;

      ({ data, error } = await filterTransactionMutation(
        api.client.from("transactions").update(legacyPayload),
        user.id,
        transaction,
      )
        .select(legacyTransactionSelectColumns)
        .maybeSingle());
    }

    if (error) {
      if (isMissingAppSchema(error)) return null;
      throw error;
    }

    const savedTransaction = data ? rowToTransaction(data) : null;
    if (savedTransaction && transaction.clientTxnId && !savedTransaction.clientTxnId) {
      savedTransaction.clientTxnId = transaction.clientTxnId;
    }

    return savedTransaction;
  };

  api.deleteTransaction = async function (transaction, session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id || !transaction) return false;

    persistUserProfile(user);

    const canMutate = Boolean(transaction.remoteId || transaction.clientTxnId);
    if (!canMutate) return false;

    const { error } = await filterTransactionMutation(
      api.client.from("transactions").delete(),
      user.id,
      transaction,
    );

    if (error) {
      if (isMissingAppSchema(error)) return false;
      throw error;
    }

    return true;
  };

  api.syncLocalTransactions = async function (transactions = [], session, budgetCycleId) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id || !Array.isArray(transactions) || transactions.length === 0) {
      return { transactions: Array.isArray(transactions) ? transactions : [], synced: false };
    }

    persistUserProfile(user);

    const syncedTransactions = [];
    let changed = false;
    let failed = 0;

    for (const transaction of transactions) {
      if (!transaction || transaction.remoteId) {
        syncedTransactions.push(transaction ? { ...transaction, syncStatus: "synced" } : transaction);
        continue;
      }

      const syncCandidate = withClientTxnId({ ...transaction, syncStatus: "pending" });
      if (
        syncCandidate.id !== transaction.id ||
        syncCandidate.clientTxnId !== transaction.clientTxnId ||
        syncCandidate.syncStatus !== transaction.syncStatus
      ) {
        changed = true;
      }

      try {
        const remoteTransaction = await api.addTransaction(syncCandidate, activeSession, budgetCycleId);

        if (remoteTransaction) {
          syncedTransactions.push({
            ...syncCandidate,
            ...remoteTransaction,
            clientTxnId: remoteTransaction.clientTxnId || syncCandidate.clientTxnId,
            syncStatus: "synced",
          });
          changed = true;
        } else {
          syncedTransactions.push(syncCandidate);
        }
      } catch (error) {
        if (isMissingAppSchema(error)) return { transactions, synced: false };

        failed += 1;
        console.error("Could not sync local transaction", error);
        syncedTransactions.push({
          ...syncCandidate,
          syncStatus: "failed",
          syncError: error?.message || "Remote sync failed",
        });
      }
    }

    return { transactions: syncedTransactions, synced: changed, failed };
  };

  api.resetAppData = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);

    const transactionResult = await api.client.from("transactions").delete().eq("user_id", user.id);
    if (transactionResult.error && !isMissingAppSchema(transactionResult.error)) {
      throw transactionResult.error;
    }

    const budgetResult = await api.client
      .from("budget_cycles")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (budgetResult.error && !isMissingAppSchema(budgetResult.error)) {
      throw budgetResult.error;
    }

    const goalResult = await api.client
      .from("savings_goals")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (goalResult.error && !isMissingAppSchema(goalResult.error)) {
      throw goalResult.error;
    }

    return true;
  };

  api.saveOnboarding = async function (onboardingState, session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    persistUserProfile(user);

    const payload = {
      id: user.id,
      email: user.email || null,
      onboarding_completed: Boolean(onboardingState?.onboardingComplete),
      onboarding_data: onboardingState || {},
    };

    const fullName = fullNameFromUser(user);
    if (fullName) payload.full_name = fullName;

    const { data, error } = await api.client
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, email, full_name, onboarding_completed, onboarding_data")
      .maybeSingle();

    if (error) throw error;

    const appData = onboardingState?.onboardingComplete
      ? await api.saveAppSetup(onboardingState, activeSession)
      : null;

    return { ...(data || {}), ...profileStateFromRow(data, user), appData };
  };

  api.resetOnboarding = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    const { data, error } = await api.client
      .from("profiles")
      .update({
        onboarding_completed: false,
        onboarding_data: {},
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    await api.resetAppData(activeSession);
    return data;
  };

  window.saverSupabase = api;
})();

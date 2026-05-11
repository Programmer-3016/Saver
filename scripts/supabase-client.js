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

  function fullNameFromUser(user) {
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.display_name ||
      ""
    );
  }

  function persistUserProfile(user) {
    if (!user) return;

    const email = user.email;
    const fullName = fullNameFromUser(user);

    if (email) localStorage.setItem("saverUserEmail", email);
    if (fullName) localStorage.setItem("saverUserName", fullName);
    if (window.setSaverStorageOwner) window.setSaverStorageOwner(user.id);
  }

  function isMissingProfilesTable(error) {
    return error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST204";
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
      if (isMissingProfilesTable(error)) return null;
      throw error;
    }

    return data;
  };

  api.loadOnboarding = async function (session) {
    const activeSession = session || (await api.getSession());
    const user = activeSession?.user;

    if (!user?.id) return null;

    await api.ensureProfile(activeSession);

    const { data, error } = await api.client
      .from("profiles")
      .select("onboarding_completed, onboarding_data")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      if (isMissingProfilesTable(error)) return null;
      throw error;
    }

    if (!data) return null;

    return {
      ...(data.onboarding_data || {}),
      onboardingComplete: Boolean(data.onboarding_completed),
    };
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
      .select("id, onboarding_completed, onboarding_data")
      .maybeSingle();

    if (error) throw error;
    return data;
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
    return data;
  };

  window.saverSupabase = api;
})();

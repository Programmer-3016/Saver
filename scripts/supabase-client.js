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

  function pageUrl(pageName) {
    return new URL(pageName, window.location.href).href;
  }

  const api = {
    client: null,
    isConfigured,
    pageUrl,
    requireSession: async () => true,
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

  api.requireSession = async function () {
    const {
      data: { session },
      error,
    } = await api.client.auth.getSession();

    if (error || !session) {
      window.location.replace(api.pageUrl("login.html"));
      return false;
    }

    const email = session.user?.email;
    const fullName =
      session.user?.user_metadata?.full_name ||
      session.user?.user_metadata?.name ||
      session.user?.user_metadata?.display_name;

    if (email) localStorage.setItem("saverUserEmail", email);
    if (fullName) localStorage.setItem("saverUserName", fullName);

    return true;
  };

  window.saverSupabase = api;
})();

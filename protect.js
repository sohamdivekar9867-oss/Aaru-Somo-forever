/* Shared login guard for every private page. */
(function () {
  const AUTH_SUPABASE_URL = "https://swqaakxywwajesuajflz.supabase.co";
  const AUTH_SUPABASE_KEY = "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";

  if (!window.supabase) {
    console.error("Supabase library did not load.");
    return;
  }

  // Reuse auth.js's client when it has loaded. If this page doesn't load
  // auth.js, create the same sessionStorage-backed client so the login guard
  // still runs instead of silently allowing access to a private page.
  const authClient = window.appSupabaseClient || window.supabase.createClient(
    AUTH_SUPABASE_URL,
    AUTH_SUPABASE_KEY,
    {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  authClient.auth.getSession().then(({ data, error }) => {
    if (error || !data.session) {
      const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

      window.location.replace(
        `login.html?redirect=${encodeURIComponent(currentPage)}`
      );
    }
  }).catch((error) => {
    console.error("Could not verify website login:", error);
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    window.location.replace(`login.html?redirect=${encodeURIComponent(currentPage)}`);
  });
})();

/* Shared login guard for every private page. */
(function () {
  if (!window.supabase) {
    console.error("Supabase library did not load.");
    return;
  }

  // Reuse auth.js's client to avoid multiple GoTrueClient instances
  // competing over the same sessionStorage key.
  const authClient = window.appSupabaseClient;
  if (!authClient) {
    console.error("Shared Supabase client is unavailable. Ensure auth.js loads before protect.js.");
    return;
  }

  authClient.auth.getSession().then(({ data, error }) => {
    if (error || !data.session) {
      const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

      window.location.replace(
        `login.html?redirect=${encodeURIComponent(currentPage)}`
      );
    }
  });
})();

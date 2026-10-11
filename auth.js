const SUPABASE_URL = "https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";

// Use sessionStorage instead of localStorage so the login is temporary.
// The session normally disappears when the browser tab/session is closed.
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return user;
}

const ACTIVITY_SESSION_KEY = "somdaWebsiteActivitySession";

async function markActivityLogout() {
  const id = window.sessionStorage.getItem(ACTIVITY_SESSION_KEY);
  if (!id) return;
  try {
    const user = await getCurrentUser();
    if (user) {
      await supabaseClient.from("website_activity_sessions")
        .update({ ended_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id);
    }
  } catch (_) {}
  window.sessionStorage.removeItem(ACTIVITY_SESSION_KEY);
}

async function startWebsiteActivityTracking() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    let id = window.sessionStorage.getItem(ACTIVITY_SESSION_KEY);
    if (id) {
      const { data } = await supabaseClient.from("website_activity_sessions")
        .select("id,user_id,ended_at").eq("id", id).maybeSingle();
      if (!data || data.user_id !== user.id || data.ended_at) id = null;
    }
    if (!id) {
      id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error } = await supabaseClient.from("website_activity_sessions").insert({
        id, user_id: user.id, started_at: now, last_seen_at: now
      });
      if (error) return; // Tracking is optional until TABLET_SETUP.sql has been run.
      window.sessionStorage.setItem(ACTIVITY_SESSION_KEY, id);
    }
    const heartbeat = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      await supabaseClient.from("website_activity_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", currentUser.id).is("ended_at", null);
    };
    await heartbeat();
    if (!window.__websiteActivityHeartbeat) {
      window.__websiteActivityHeartbeat = setInterval(heartbeat, 30000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") heartbeat();
      });
      window.addEventListener("pagehide", () => {
        // A page close is not a confirmed logout; the dashboard uses last_seen_at as an estimate.
      });
    }
  } catch (_) {}
}

async function logout() {
  await markActivityLogout();
  await supabaseClient.auth.signOut();
  window.location.replace("login.html");
}

// Add a small logout control to every protected page.
document.addEventListener("DOMContentLoaded", () => {
  startWebsiteActivityTracking();
  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  if (currentFile === "login.html") return;
  if (document.getElementById("siteLogoutButton")) return;

  const button = document.createElement("button");
  button.id = "siteLogoutButton";
  button.type = "button";
  button.textContent = "Log out";
  button.setAttribute("aria-label", "Log out of our little world");
  button.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 9999;
    border: 1px solid rgba(255, 210, 220, .45);
    border-radius: 999px;
    padding: 9px 15px;
    background: rgba(35, 12, 27, .82);
    color: #f8dce5;
    font: 12px/1.2 'DM Mono', monospace;
    letter-spacing: .04em;
    cursor: pointer;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 18px rgba(0,0,0,.16);
  `;
  button.addEventListener("mouseenter", () => {
    button.style.background = "rgba(110, 42, 70, .92)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "rgba(35, 12, 27, .82)";
  });
  button.addEventListener("click", logout);
  document.body.appendChild(button);
});

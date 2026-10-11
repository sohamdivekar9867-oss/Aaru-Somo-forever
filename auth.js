const SUPABASE_URL = "https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";

// One shared Supabase client for this page. Other scripts should reuse it.
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
window.appSupabaseClient = supabaseClient;

async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error("[activity tracker] Could not read current user:", error.message);
    return null;
  }
  return user;
}

const ACTIVITY_SESSION_KEY = "somdaWebsiteActivitySession";
let activityHeartbeatTimer = null;
let activityStartInProgress = false;

async function markActivityLogout() {
  const id = window.sessionStorage.getItem(ACTIVITY_SESSION_KEY);
  if (!id) return;
  const user = await getCurrentUser();
  if (user) {
    const now = new Date().toISOString();
    const { error } = await supabaseClient.from("website_activity_sessions")
      .update({ ended_at: now, last_seen_at: now })
      .eq("id", id).eq("user_id", user.id);
    if (error) console.error("[activity tracker] Could not mark logout:", error.message);
  }
  window.sessionStorage.removeItem(ACTIVITY_SESSION_KEY);
}

async function startWebsiteActivityTracking() {
  if (activityStartInProgress) return;
  activityStartInProgress = true;
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.info("[activity tracker] No signed-in user yet; waiting for successful login.");
      return;
    }

    let id = window.sessionStorage.getItem(ACTIVITY_SESSION_KEY);
    if (id) {
      const { data, error } = await supabaseClient.from("website_activity_sessions")
        .select("id,user_id,ended_at").eq("id", id).maybeSingle();
      if (error) console.error("[activity tracker] Could not check existing session:", error.message);
      if (!data || data.user_id !== user.id || data.ended_at) id = null;
    }

    if (!id) {
      id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error } = await supabaseClient.from("website_activity_sessions").insert({
        id,
        user_id: user.id,
        user_email: (user.email || "").toLowerCase(),
        started_at: now,
        last_seen_at: now
      });
      if (error) {
        console.error("[activity tracker] SESSION INSERT FAILED:", error.message, error.details || "", error.hint || "");
        return;
      }
      window.sessionStorage.setItem(ACTIVITY_SESSION_KEY, id);
      console.info("[activity tracker] Session created:", { email: user.email, started_at: now });
    } else {
      console.info("[activity tracker] Continuing existing session:", { email: user.email, id });
    }

    const activeId = id;
    const heartbeat = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      const now = new Date().toISOString();
      const { error } = await supabaseClient.from("website_activity_sessions")
        .update({ last_seen_at: now })
        .eq("id", activeId).eq("user_id", currentUser.id).is("ended_at", null);
      if (error) console.error("[activity tracker] HEARTBEAT FAILED:", error.message);
    };
    await heartbeat();
    if (!activityHeartbeatTimer) {
      activityHeartbeatTimer = setInterval(heartbeat, 30000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") heartbeat();
      });
    }
  } catch (error) {
    console.error("[activity tracker] Unexpected error:", error);
  } finally {
    activityStartInProgress = false;
  }
}

async function logout() {
  await markActivityLogout();
  await supabaseClient.auth.signOut();
  window.location.replace("login.html");
}

// Start on existing sessions AND immediately after the login event.
// Scheduling work outside the auth callback avoids Supabase auth-lock deadlocks.
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
    if (session?.user) setTimeout(() => startWebsiteActivityTracking(), 0);
  }
  if (event === "SIGNED_OUT") {
    window.sessionStorage.removeItem(ACTIVITY_SESSION_KEY);
  }
});

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

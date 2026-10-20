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

const ACTIVITY_EVENT_QUEUE_KEY = "somdaWebsiteActivityEventQueue";

function currentSectionName() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  const knownSections = {
    "index.html": "First Room",
    "bedroom.html": "Bedroom",
    "tablet.html": "Tablet",
    "radio.html": "Background Radio",
    "music.html": "Our Music",
    "reels.html": "Reels to Try",
    "login.html": "Login"
  };
  return knownSections[file] || file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function queueWebsiteActivity(eventType, section) {
  const safeSection = String(section || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!safeSection) return;
  try {
    const queue = JSON.parse(window.sessionStorage.getItem(ACTIVITY_EVENT_QUEUE_KEY) || "[]");
    queue.push({
      id: crypto.randomUUID(),
      event_type: eventType,
      section: safeSection,
      page_path: window.location.pathname.slice(0, 200),
      created_at: new Date().toISOString()
    });
    window.sessionStorage.setItem(ACTIVITY_EVENT_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch (error) {
    console.warn("[activity tracker] Could not queue section activity:", error);
  }
}

let activityEventFlushInProgress = false;
let activityEventFlushRequested = false;
async function flushWebsiteActivityQueue() {
  if (activityEventFlushInProgress) {
    activityEventFlushRequested = true;
    return;
  }
  activityEventFlushInProgress = true;
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const queue = JSON.parse(window.sessionStorage.getItem(ACTIVITY_EVENT_QUEUE_KEY) || "[]");
    if (!queue.length) return;
    const rows = queue.map(event => ({
      ...event,
      user_id: user.id,
      user_email: (user.email || "").toLowerCase()
    }));
    const { error } = await supabaseClient.from("website_activity_events")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.warn("[activity tracker] Could not save section activity:", error.message);
      return;
    }
    window.sessionStorage.removeItem(ACTIVITY_EVENT_QUEUE_KEY);
  } catch (error) {
    console.warn("[activity tracker] Could not flush section activity:", error);
  } finally {
    activityEventFlushInProgress = false;
    if (activityEventFlushRequested) {
      activityEventFlushRequested = false;
      setTimeout(flushWebsiteActivityQueue, 0);
    }
  }
}

window.trackWebsiteActivity = (eventType, section) => {
  if (!["section_view", "section_click"].includes(eventType)) return;
  queueWebsiteActivity(eventType, section);
  return flushWebsiteActivityQueue();
};

function installSectionActivityTracking() {
  queueWebsiteActivity("section_view", currentSectionName());
  flushWebsiteActivityQueue();

  document.addEventListener("click", event => {
    const target = event.composedPath().find(node => {
      if (!(node instanceof Element)) return false;
      if (node.matches("a[href]")) {
        try { return new URL(node.href, window.location.href).origin === window.location.origin; }
        catch { return false; }
      }
      return node.matches("button[data-title], button[data-link], button[data-home], button.app-icon, button.hotspot, [role=link][aria-label]");
    });
    if (!target) return;

    const label = target.dataset.title || target.dataset.link || target.getAttribute("aria-label") ||
      target.getAttribute("title") || target.textContent;
    if (label) {
      queueWebsiteActivity("section_click", label);
      setTimeout(flushWebsiteActivityQueue, 0);
    }
  }, true);
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
    window.sessionStorage.removeItem(ACTIVITY_EVENT_QUEUE_KEY);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  startWebsiteActivityTracking();
  installSectionActivityTracking();

  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  if (currentFile === "login.html") return;
  let button = document.getElementById("siteLogoutButton");
  if (!button) {
    button = document.createElement("button");
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
    document.body.appendChild(button);
  }
  button.addEventListener("click", logout);
});


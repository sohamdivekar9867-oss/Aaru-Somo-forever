/* Tablet apps. Replace SOMO_EMAIL with the email used by Somo's website account. */
const SOMO_EMAIL = "sohamdivekar9867@gmail.com";
const AARU_EMAIL = "aaru.saru090901@gmail.com";
const tabletClient = window.appSupabaseClient || window.supabase?.createClient(
  "https://swqaakxywwajesuajflz.supabase.co",
  "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G",
  { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const homeScreen = document.getElementById('homeScreen');
const userApp = document.getElementById('userApp');
const notesApp = document.getElementById('notesApp');
const journalApp = document.getElementById('journalApp');
function showApp(app) {
  [homeScreen, userApp, notesApp, journalApp].forEach(el => el.hidden = el !== app);
}
document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => showApp(homeScreen)));
document.getElementById('openUserApp').addEventListener('click', () => showApp(userApp));
document.getElementById('openNotesApp').addEventListener('click', async () => {
  showApp(notesApp);
  await window.openSomoNotes?.();
});
document.getElementById('openJournalApp').addEventListener('click', async () => {
  showApp(journalApp);
  await window.openSomoJournal?.();
});
const clockEl = document.getElementById('tabletClock');
function updateClock() {
  clockEl.textContent = new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata', weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:true}).format(new Date());
}
updateClock(); setInterval(updateClock, 30000);

const tabletWallpaperImage = document.getElementById('tabletWallpaperImage');
const tabletWallpaperUpload = document.getElementById('tabletWallpaperUpload');
const tabletWallpaperInput = document.getElementById('tabletWallpaperInput');
const tabletWallpaperStatus = document.getElementById('tabletWallpaperStatus');
let tabletWallpaperUser = null;

async function loadTabletWallpaper() {
  try {
    const {data, error} = await tabletClient.from('tablet_wallpapers')
      .select('storage_path').eq('id', true).maybeSingle();
    if (error) throw error;
    if (!data?.storage_path) return;
    const {data:signed, error:signError} = await tabletClient.storage
      .from('tablet-wallpapers').createSignedUrl(data.storage_path, 3600);
    if (signError) throw signError;
    tabletWallpaperImage.src = signed.signedUrl;
    tabletWallpaperImage.hidden = false;
    tabletWallpaperImage.onerror = () => {
      tabletWallpaperImage.hidden = true;
      tabletWallpaperStatus.textContent = 'Could not display the tablet wallpaper.';
    };
    tabletWallpaperStatus.textContent = '';
  } catch (error) {
    console.error('Tablet wallpaper load error:', error);
    tabletWallpaperStatus.textContent = 'Wallpaper storage is not ready. Check TABLET_WALLPAPER_SETUP.sql.';
  }
}

async function uploadTabletWallpaper(file) {
  if (!file) return;
  if (tabletWallpaperUser?.email?.toLowerCase() !== SOMO_EMAIL.toLowerCase()) {
    tabletWallpaperStatus.textContent = 'Only Somo can change the tablet wallpaper.';
    return;
  }
  if (!file.type.startsWith('image/')) {
    tabletWallpaperStatus.textContent = 'Choose an image file for the wallpaper.';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    tabletWallpaperStatus.textContent = 'Choose an image smaller than 15 MB.';
    return;
  }
  tabletWallpaperInput.disabled = true;
  tabletWallpaperStatus.textContent = 'Saving wallpaper…';
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'wallpaper';
  const path = `${tabletWallpaperUser.id}/${crypto.randomUUID()}-${safeName}`;
  try {
    const {error:uploadError} = await tabletClient.storage.from('tablet-wallpapers')
      .upload(path, file, {cacheControl:'3600', upsert:false, contentType:file.type});
    if (uploadError) throw uploadError;
    const {data:previous, error:readError} = await tabletClient.from('tablet_wallpapers')
      .select('storage_path').eq('id', true).maybeSingle();
    if (readError) throw readError;
    const {error:saveError} = await tabletClient.from('tablet_wallpapers').upsert({
      id:true, storage_path:path, uploaded_by:tabletWallpaperUser.id, updated_at:new Date().toISOString()
    }, {onConflict:'id'});
    if (saveError) throw saveError;
    await loadTabletWallpaper();
    if (previous?.storage_path) {
      const {error:cleanupError} = await tabletClient.storage.from('tablet-wallpapers').remove([previous.storage_path]);
      if (cleanupError) console.warn('Old tablet wallpaper cleanup failed:', cleanupError);
    }
    tabletWallpaperStatus.textContent = 'Tablet wallpaper saved.';
  } catch (error) {
    console.error('Tablet wallpaper upload error:', error);
    await tabletClient.storage.from('tablet-wallpapers').remove([path]);
    tabletWallpaperStatus.textContent = `Could not save wallpaper: ${error.message || 'Please try again.'}`;
  } finally {
    tabletWallpaperInput.disabled = false;
    tabletWallpaperInput.value = '';
  }
}

async function initTabletWallpaper() {
  if (!tabletClient) return;
  try {
    // Use the shared client and local session so a temporary auth network check
    // cannot leave Somo's wallpaper control hidden.
    const {data:{session}, error} = await tabletClient.auth.getSession();
    if (error) throw error;
    const user = session?.user;
    if (!user) {
      tabletWallpaperStatus.textContent = 'Sign in again to manage the tablet wallpaper.';
      return;
    }
    tabletWallpaperUser = user;
    const isSomo = user.email?.trim().toLowerCase() === SOMO_EMAIL.toLowerCase();
    tabletWallpaperUpload.hidden = !isSomo;
    if (!isSomo) tabletWallpaperStatus.textContent = 'Only Somo can change the tablet wallpaper.';
    await loadTabletWallpaper();
  } catch (error) {
    console.error('Tablet wallpaper setup error:', error);
    tabletWallpaperStatus.textContent = 'Could not confirm your account. Refresh the page or sign in again.';
  }
}
if (tabletWallpaperInput) tabletWallpaperInput.addEventListener('change', () => uploadTabletWallpaper(tabletWallpaperInput.files?.[0]));
initTabletWallpaper();



const unlockForm = document.getElementById('unlockForm');
const unlockMessage = document.getElementById('unlockMessage');
const userLock = document.getElementById('userLock');
const dashboard = document.getElementById('activityDashboard');
let unlockedUser = null;
unlockForm.addEventListener('submit', async event => {
  event.preventDefault();
  unlockMessage.textContent = 'Checking your password…';
  const {data:{user}, error:userError} = await tabletClient.auth.getUser();
  if (userError || !user) { unlockMessage.textContent = 'Please sign in to the website first.'; return; }
  if (!SOMO_EMAIL.includes('@') || user.email?.toLowerCase() !== SOMO_EMAIL.toLowerCase()) {
    unlockMessage.textContent = 'This private app is only available to Somo’s account. Sign in with Somo’s configured website account.';
    return;
  }
  const password = document.getElementById('unlockPassword').value;
  const {error} = await tabletClient.auth.signInWithPassword({email:user.email, password});
  if (error) { unlockMessage.textContent = 'That password did not match your website account.'; return; }
  unlockedUser = user;
  userLock.hidden = true;
  dashboard.hidden = false;
  document.getElementById('unlockPassword').value = '';
  await loadActivity();
});
document.getElementById('refreshActivity').addEventListener('click', loadActivity);

function formatDate(value, opts={weekday:'short',day:'2-digit',month:'short'}) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',...opts}).format(new Date(value));
}
function formatTime(value) {
  return value ? new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(value)) : '—';
}
function duration(start,end) {
  if (!start || !end) return '—';
  const mins=Math.max(0,Math.round((new Date(end)-new Date(start))/60000));
  if(mins<1) return '<1 min';
  const hours=Math.floor(mins/60), rest=mins%60;
  return hours ? `${hours}h ${rest}m` : `${rest} min`;
}
async function loadActivity() {
  const message=document.getElementById('activityMessage');
  const rows=document.getElementById('activityRows');
  if(!unlockedUser) return;
  message.textContent='Refreshing…';
  const since=new Date(Date.now()-3*24*60*60*1000).toISOString();
  const {data,error}=await tabletClient.from('website_activity_sessions')
    .select('id,user_id,user_email,started_at,last_seen_at,ended_at')
    .gte('started_at',since).order('started_at',{ascending:false}).limit(250);
  if(error) {
    rows.innerHTML='<tr><td colspan="4" class="empty-row">Activity table is not ready. Run TABLET_SETUP.sql in the Supabase SQL Editor.</td></tr>';
    message.textContent='Could not load activity. Check the setup SQL and account email policy.';
    document.getElementById('sessionCount').textContent='—';
    document.getElementById('lastOpened').textContent='—';
    return;
  }
  const sessions=(data||[]).filter(row=>String(row.user_email||'').toLowerCase()===AARU_EMAIL.toLowerCase());
  document.getElementById('sessionCount').textContent=String(sessions.length);
  document.getElementById('lastOpened').textContent=sessions.length ? formatTime(sessions[0].started_at) : '—';
  if(!sessions.length) {
    rows.innerHTML='<tr><td colspan="4" class="empty-row">No Aaru sessions recorded in the last 3 days. Sessions are tracked from the time the updated tracker is deployed.</td></tr>';
  } else {
    rows.innerHTML=sessions.map(row=>{
      const end=row.ended_at||row.last_seen_at;
      const endLabel=row.ended_at ? formatTime(row.ended_at) : `${formatTime(row.last_seen_at)} · last seen`;
      return `<tr><td>${formatDate(row.started_at)}</td><td>${formatTime(row.started_at)}</td><td>${duration(row.started_at,end)}</td><td>${endLabel}</td></tr>`;
    }).join('');
  }
  const eventRows=document.getElementById('sectionEventRows');
  const {data:eventData,error:eventError}=await tabletClient.from('website_activity_events')
    .select('id,user_email,event_type,section,page_path,created_at')
    .eq('user_email',AARU_EMAIL.toLowerCase()).gte('created_at',since).order('created_at',{ascending:false}).limit(250);
  if(eventError) {
    document.getElementById('sectionEventCount').textContent='—';
    eventRows.innerHTML='<tr><td colspan="3" class="empty-row">Run the updated TABLET_SETUP.sql to enable section activity.</td></tr>';
    message.textContent='Sessions are available. Section activity needs the updated TABLET_SETUP.sql.';
    return;
  }
  const events=(eventData||[]).filter(row=>String(row.user_email||'').toLowerCase()===AARU_EMAIL.toLowerCase());
  document.getElementById('sectionEventCount').textContent=String(events.length);
  if(!events.length) {
    eventRows.innerHTML='<tr><td colspan="3" class="empty-row">No section visits or changes recorded in the last 3 days.</td></tr>';
  } else {
    const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const labels={section_view:'Opened',section_click:'Clicked',create:'Created',update:'Updated',delete:'Deleted'};
    eventRows.innerHTML=events.map(row=>`<tr><td>${escapeHtml(formatDate(row.created_at,{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}))}</td><td>${escapeHtml(row.section)}</td><td>${escapeHtml(labels[row.event_type]||row.event_type)}</td></tr>`).join('');
  }
  message.textContent='Showing Aaru’s sessions and section activity from the last 3 days.';
}


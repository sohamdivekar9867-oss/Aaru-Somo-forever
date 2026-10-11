/* Tablet apps. Replace SOMO_EMAIL with the email used by Somo's website account. */
const SOMO_EMAIL = "sohamdivekar9867@gmail.com";
const AARU_EMAIL = "aaru.saru090901@gmail.com";
const tabletClient = window.supabase?.createClient(
  "https://swqaakxywwajesuajflz.supabase.co",
  "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G",
  { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const homeScreen = document.getElementById('homeScreen');
const userApp = document.getElementById('userApp');
const notesApp = document.getElementById('notesApp');
function showApp(app) {
  [homeScreen, userApp, notesApp].forEach(el => el.hidden = el !== app);
}
document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => showApp(homeScreen)));
document.getElementById('openUserApp').addEventListener('click', () => showApp(userApp));
document.getElementById('openNotesApp').addEventListener('click', async () => {
  showApp(notesApp);
  await loadNote();
});
const clockEl = document.getElementById('tabletClock');
function updateClock() {
  clockEl.textContent = new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata', weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:true}).format(new Date());
}
updateClock(); setInterval(updateClock, 30000);

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

const noteTitle=document.getElementById('noteTitle');
const noteBody=document.getElementById('noteBody');
const saveState=document.getElementById('saveState');
const notesMessage=document.getElementById('notesMessage');
const localNoteKey='somo-notes-draft-v1';
let noteUser=null;
let noteLoadDone=false;
async function loadNote() {
  if(noteLoadDone) return;
  const local=JSON.parse(localStorage.getItem(localNoteKey)||'{}');
  noteTitle.value=local.title||'';
  noteBody.value=local.body||'';
  const {data:{user}}=await tabletClient.auth.getUser();
  noteUser=user||null;
  if(user && SOMO_EMAIL.includes('@') && user.email?.toLowerCase()===SOMO_EMAIL.toLowerCase()) {
    const {data,error}=await tabletClient.from('somo_notes').select('title,body,updated_at').eq('user_id',user.id).maybeSingle();
    if(!error && data) {
      noteTitle.value=data.title||'';
      noteBody.value=data.body||'';
      notesMessage.textContent=`Saved to your private account · ${formatTime(data.updated_at)}`;
    } else if(error) notesMessage.textContent='Cloud notes need setup. Your draft is still saved on this device.';
  } else {
    notesMessage.textContent='Draft saved on this device. Set your Somo account email to enable private cloud saving.';
  }
  noteLoadDone=true;
}
async function saveNote() {
  const draft={title:noteTitle.value,body:noteBody.value,updated_at:new Date().toISOString()};
  localStorage.setItem(localNoteKey,JSON.stringify(draft));
  saveState.textContent='Saving…';
  const {data:{user}}=await tabletClient.auth.getUser();
  if(user && SOMO_EMAIL.includes('@') && user.email?.toLowerCase()===SOMO_EMAIL.toLowerCase()) {
    const {error}=await tabletClient.from('somo_notes').upsert({user_id:user.id,title:draft.title,body:draft.body,updated_at:draft.updated_at},{onConflict:'user_id'});
    if(error) {
      saveState.textContent='Saved on device';
      notesMessage.textContent='Cloud save failed; your draft is saved on this device. Check TABLET_SETUP.sql.';
      return;
    }
    saveState.textContent='Saved';
    notesMessage.textContent='Saved securely to your account.';
  } else {
    saveState.textContent='Saved locally';
    notesMessage.textContent='Saved on this device. Cloud sync is available after configuring Somo’s account email and SQL policies.';
  }
}
document.getElementById('saveNote').addEventListener('click',saveNote);
let autosaveTimer;
[noteTitle,noteBody].forEach(el=>el.addEventListener('input',()=>{
  saveState.textContent='Unsaved changes';
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(saveNote,1200);
}));

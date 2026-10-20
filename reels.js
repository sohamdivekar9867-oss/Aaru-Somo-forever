const SUPABASE_URL="https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_KEY="sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const grid=document.getElementById('reelGrid');
const status=document.getElementById('reelStatus');
const reelModal=document.getElementById('reelModal');
const memoryModal=document.getElementById('memoryModal');
const reelForm=document.getElementById('reelForm');
const reelName=document.getElementById('reelName');
const reelUrl=document.getElementById('reelUrl');
const saveReel=document.getElementById('saveReel');
const formStatus=document.getElementById('formStatus');
const videoInput=document.getElementById('videoInput');
const photoInput=document.getElementById('photoInput');
const memoryPreview=document.getElementById('memoryPreview');
const saveMemory=document.getElementById('saveMemory');
const memoryStatus=document.getElementById('memoryStatus');
const memoryTitle=document.getElementById('memoryModalTitle');
const completionDateModal=document.getElementById('completionDateModal');
const completionDateForm=document.getElementById('completionDateForm');
let user=null,author=null,reels=[],memories={},filter='to_try',editingId=null,currentReel=null,completionDateReelId=null,selectedVideo=null,selectedPhotos=[];

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function completedDateLabel(value){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'});}
function completionDateInputValue(value){if(!value)return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=type=>parts.find(part=>part.type===type)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;}
function setStatus(v=''){status.textContent=v;}
function validInstagram(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname.toLowerCase())&&(/\/reel\//i.test(u.pathname)||/\/p\//i.test(u.pathname));}catch{return false;}}
function openModal(el){el.classList.add('open');el.setAttribute('aria-hidden','false');}
function closeModal(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');}
function authorFromUser(u){const email=(u.email||'').toLowerCase();return email==='aaru.saru090901@gmail.com'?'Aaru':email==='sohamdivekar@gmail.com'?'Somo':email==='sohamdivekar9867@gmail.com'?'Somo':null;}

async function init(){
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){setStatus('Please log in again.');return;}
  user=data.user;author=authorFromUser(user);
  if(!author){setStatus('This little reel book is private to Aaru and Somo.');return;}
  await load();
}

async function load(){
  setStatus('Loading our reel book…');
  const {data,error}=await client.from('couple_reels').select('*').order('created_at',{ascending:false});
  if(error){setStatus('Could not load reels. Run REELS_SETUP.sql in Supabase first.');return;}
  reels=data||[];
  await loadMemories();
  render();
  setStatus('');
}

async function loadMemories(){
  memories={};
  if(!reels.length)return;
  const {data,error}=await client.from('reel_memories').select('*').in('reel_id',reels.map(r=>r.id)).order('created_at',{ascending:true});
  if(error){console.warn(error);return;}
  const rows=data||[];
  for(const m of rows){(memories[m.reel_id]??=[]).push(m);}
}

function visibleReels(){return reels.filter(r=>filter==='all'||(filter==='done'?r.status==='done':r.status!=='done'));}
function memoryCount(id){return (memories[id]||[]).length;}
function canEdit(r){return r.created_by===user?.id && !r.delete_approved_by;}
function isOther(r){return r.created_by!==user?.id;}

function render(){
  const items=visibleReels();
  if(!items.length){grid.innerHTML='<div class="empty-reels">No reels here yet. Save the first little trend you want us to try. ♡</div>';return;}
  grid.innerHTML=items.map(r=>{
    const ms=memories[r.id]||[];
    const pending=r.delete_requested_by&&!r.delete_approved_by;
    const approved=!!r.delete_approved_by;
    let actions='';
    if(r.status!=='done') actions+=`<button class="complete" data-complete="${esc(r.id)}">✨ We did it</button>`;
    else actions+=`<button data-undo-done="${esc(r.id)}">↩ Undo — back to To try</button><button data-completion-date="${esc(r.id)}">${r.completed_at?'Edit completion date':'Add completion date'}</button>`;
    actions+=`<button class="memory-button" data-memory="${esc(r.id)}">📸 Add our version</button>`;
    if(canEdit(r)) actions+=`<button data-edit="${esc(r.id)}">Edit</button>`;
    if(r.created_by===user?.id&&!pending&&!approved) actions+=`<button data-request-delete="${esc(r.id)}">Request delete</button>`;
    if(isOther(r)&&pending) actions+=`<button class="complete" data-approve-delete="${esc(r.id)}">Approve delete</button>`;
    if(approved) actions+=`<button data-final-delete="${esc(r.id)}">Delete together</button>`;
    const videoMemory=ms.find(m=>m.media_type==='video');
    const photoMemories=ms.filter(m=>m.media_type==='photo').slice(0,5);
    const preview=videoMemory
      ? `<div class="reel-preview our-video-preview"><video controls playsinline preload="metadata" data-preview-video-path="${esc(videoMemory.storage_path)}"></video><div class="reel-preview-label">OUR VERSION · VIDEO</div></div>`
      : `<div class="reel-preview ${r.status==='done'?'done':''}"><div class="reel-preview-icon">▶</div><div class="reel-preview-label">INSTAGRAM REEL</div><div class="reel-preview-shine"></div></div>`;
    return `<article class="reel-card ${r.status==='done'?'done':''}">
      <div class="reel-post-head"><div class="reel-post-avatar">A♡S</div><div><strong>Aaru & Somo</strong><span>${r.status==='done'?'our memory':'saved a reel to try'}</span></div><span class="reel-dots">•••</span></div>
      ${preview}
      <div class="reel-card-top"><div class="reel-badge ${r.status==='done'?'done':''}">${r.status==='done'?'✓ done together':'to try'}</div><span class="reel-meta">♡ ${memoryCount(r.id)} memories</span></div>
      <h2 class="reel-title">${esc(r.title)}</h2>
      <div class="reel-meta">added by ${esc(r.added_by==='Somda'?'Somo':r.added_by)}</div>
      ${r.status==='done'&&r.completed_at?`<div class="reel-completed-date">Completed on ${esc(completedDateLabel(r.completed_at))}</div>`:''}
      <a class="reel-link" href="${esc(r.instagram_url)}" target="_blank" rel="noopener noreferrer">View original Reel ↗</a>
      ${photoMemories.length?`<div class="memory-strip">${photoMemories.map(m=>`<button class="memory-thumb photo-memory" type="button" data-open-memory="${esc(m.storage_path)}" title="Open photo"><img data-memory-path="${esc(m.storage_path)}" alt="Our reel memory"></button>`).join('')}</div>`:''}
      <div class="reel-actions">${actions}</div>
      ${pending?`<div class="delete-status">Delete requested. Aaru or Somo still needs to approve it.</div>`:''}
      ${approved?`<div class="delete-status">Both sides approved. Final delete is ready.</div>`:''}
    </article>`;
  }).join('');
  hydrateMemoryImages();
}

async function hydrateMemoryImages(){
  const nodes=[...document.querySelectorAll('[data-memory-path],[data-preview-video-path]')];
  for(const node of nodes){
    const path=node.dataset.memoryPath||node.dataset.previewVideoPath;
    const {data,error}=await client.storage.from('reel-memories').createSignedUrl(path,60*60);
    if(error||!data?.signedUrl)continue;
    if(node.tagName==='VIDEO') node.src=data.signedUrl;
    else node.src=data.signedUrl;
  }
}

function startEdit(r){editingId=r.id;reelName.value=r.title;reelUrl.value=r.instagram_url;document.getElementById('reelModalTitle').textContent='Edit a reel';saveReel.textContent='Save changes ♡';formStatus.textContent='';openModal(reelModal);reelName.focus();}
function resetReelForm(){editingId=null;reelForm.reset();document.getElementById('reelModalTitle').textContent='Add a reel to try';saveReel.textContent='Save to our list ♡';formStatus.textContent='';}

reelForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const title=reelName.value.trim(),url=reelUrl.value.trim();
  if(!title||!validInstagram(url)){formStatus.textContent='Please enter a trend name and a valid Instagram Reel link.';return;}
  saveReel.disabled=true;formStatus.textContent=editingId?'Saving changes…':'Saving your reel…';
  try{
    if(editingId){const r=reels.find(x=>x.id===editingId);if(!r||!canEdit(r))throw new Error('You can edit only the reels you added.');const {error}=await client.from('couple_reels').update({title,instagram_url:url,updated_at:new Date().toISOString()}).eq('id',editingId).eq('created_by',user.id);if(error)throw error;}
    else{const {error}=await client.from('couple_reels').insert({title,instagram_url:url,added_by:author,created_by:user.id});if(error)throw error;}
    closeModal(reelModal);resetReelForm();await load();
  }catch(err){formStatus.textContent=err.message||'Could not save this reel.';}finally{saveReel.disabled=false;}
});

document.getElementById('openAddReel').addEventListener('click',()=>{resetReelForm();openModal(reelModal);reelName.focus();});
document.getElementById('closeReelModal').addEventListener('click',()=>closeModal(reelModal));
document.querySelector('[data-close-modal]').addEventListener('click',()=>closeModal(reelModal));
function openCompletionDate(r){completionDateReelId=r.id;document.getElementById('completionDateTitle').textContent=`When did we try “${r.title}”?`;document.getElementById('completionDateInput').value=completionDateInputValue(r.completed_at);document.getElementById('completionDateStatus').textContent='';openModal(completionDateModal);}
function closeCompletionDate(){closeModal(completionDateModal);completionDateReelId=null;}
document.getElementById('closeCompletionDate').addEventListener('click',closeCompletionDate);
document.querySelector('[data-close-completion-date]').addEventListener('click',closeCompletionDate);
completionDateForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!completionDateReelId)return;
  const button=document.getElementById('saveCompletionDate');
  const message=document.getElementById('completionDateStatus');
  button.disabled=true;message.textContent='Saving the date…';
  const {error}=await client.rpc('set_reel_completion_date',{p_reel_id:completionDateReelId,p_completion_date:document.getElementById('completionDateInput').value});
  button.disabled=false;
  if(error){message.textContent='Could not save the completion date. Run REELS_COMPLETION_DATE_SETUP.sql in Supabase first.';return;}
  closeCompletionDate();await load();
});
document.getElementById('closeMemoryModal').addEventListener('click',()=>closeModal(memoryModal));
document.querySelector('[data-close-memory]').addEventListener('click',()=>closeModal(memoryModal));

document.querySelectorAll('.reel-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.reel-tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');filter=btn.dataset.filter;render();}));

const mediaViewer=document.getElementById('mediaViewer');
const mediaViewerImage=document.getElementById('mediaViewerImage');
const closeMediaViewer=document.getElementById('closeMediaViewer');

function openPhotoViewer(url){
  if(!mediaViewer)return;
  mediaViewerImage.src=url;
  mediaViewer.classList.add('open');
  mediaViewer.setAttribute('aria-hidden','false');
}
function closePhotoViewer(){
  if(!mediaViewer)return;
  mediaViewer.classList.remove('open');
  mediaViewer.setAttribute('aria-hidden','true');
  mediaViewerImage.src='';
}

closeMediaViewer?.addEventListener('click',closePhotoViewer);
mediaViewer?.querySelector('[data-close-media-viewer]')?.addEventListener('click',closePhotoViewer);

document.addEventListener('click',async e=>{
  const photo=e.target.closest('[data-open-memory]');
  if(photo){
    const {data,error}=await client.storage.from('reel-memories').createSignedUrl(photo.dataset.openMemory,60*60);
    if(!error&&data?.signedUrl)openPhotoViewer(data.signedUrl);
    return;
  }

  const edit=e.target.closest('[data-edit]');
  const complete=e.target.closest('[data-complete]');
  const memory=e.target.closest('[data-memory]');
  const request=e.target.closest('[data-request-delete]');
  const approve=e.target.closest('[data-approve-delete]');
  const final=e.target.closest('[data-final-delete]');
  const undo=e.target.closest('[data-undo-done]');
  const completionDate=e.target.closest('[data-completion-date]');
  if(edit){const r=reels.find(x=>x.id===edit.dataset.edit);if(r&&canEdit(r))startEdit(r);return;}
  if(complete){const r=reels.find(x=>x.id===complete.dataset.complete);if(r){await markDone(r);return;}}
  if(memory){const r=reels.find(x=>x.id===memory.dataset.memory);if(r)openMemory(r);return;}
  if(request){await requestDelete(request.dataset.requestDelete);return;}
  if(approve){await approveDelete(approve.dataset.approveDelete);return;}
  if(final){await finalDelete(final.dataset.finalDelete);return;}
  if(undo){await undoDone(undo.dataset.undoDone);return;}
  if(completionDate){const r=reels.find(x=>x.id===completionDate.dataset.completionDate);if(r&&r.status==='done')openCompletionDate(r);return;}
});

async function undoDone(id){
  const r=reels.find(x=>x.id===id);
  if(!r||r.status!=='done')return;
  if(!window.confirm('Move this reel back to To try? Your saved photos/videos will stay attached.'))return;
  setStatus('Moving it back to To try…');
  const {error}=await client.rpc('mark_reel_to_try',{p_reel_id:id});
  if(error){setStatus(error.message);return;}
  await load();
}

async function markDone(r, openAfter=true){
  setStatus('Marking it as done…');
  const {error}=await client.rpc('mark_reel_done',{p_reel_id:r.id});
  if(error){setStatus(error.message);return false;}
  await load();
  if(openAfter) openMemory(reels.find(x=>x.id===r.id));
  return true;
}

function openMemory(r){currentReel=r;selectedVideo=null;selectedPhotos=[];videoInput.value='';photoInput.value='';memoryPreview.innerHTML='';memoryTitle.textContent=r.title;memoryStatus.textContent='';openModal(memoryModal);}
function renderPreview(){
  memoryPreview.innerHTML='';
  if(selectedVideo){const u=URL.createObjectURL(selectedVideo);const d=document.createElement('div');d.className='preview-item';d.innerHTML=`<video src="${u}" muted></video><span>video</span>`;memoryPreview.appendChild(d);}
  for(const f of selectedPhotos){const u=URL.createObjectURL(f);const d=document.createElement('div');d.className='preview-item';d.innerHTML=`<img src="${u}" alt="Preview">`;memoryPreview.appendChild(d);}
}
videoInput.addEventListener('change',()=>{selectedVideo=videoInput.files?.[0]||null;renderPreview();});
photoInput.addEventListener('change',()=>{selectedPhotos=[...(photoInput.files||[])].slice(0,5);renderPreview();if((photoInput.files||[]).length>5)memoryStatus.textContent='Only the first 5 photos will be saved.';});

async function uploadOne(file,type){
  const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await client.storage.from('reel-memories').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw error;
  const {error:dbError}=await client.from('reel_memories').insert({reel_id:currentReel.id,uploaded_by:user.id,media_type:type,storage_path:path});
  if(dbError){await client.storage.from('reel-memories').remove([path]);throw dbError;}
}

saveMemory.addEventListener('click',async()=>{
  if(!currentReel)return;
  if(!selectedVideo&&!selectedPhotos.length){memoryStatus.textContent='Add a video or at least one photo first. ♡';return;}
  saveMemory.disabled=true;memoryStatus.textContent='Saving our little memories…';
  try{
    if(currentReel.status!=='done'){
      const completed=await markDone(currentReel,false);
      if(!completed)throw new Error('Could not mark this reel as done yet.');
      currentReel={...currentReel,status:'done'};
    }
    if(selectedVideo)await uploadOne(selectedVideo,'video');
    for(const f of selectedPhotos)await uploadOne(f,'photo');
    await load();closeModal(memoryModal);currentReel=null;
  }catch(err){memoryStatus.textContent=err.message||'Could not save the memories.';}finally{saveMemory.disabled=false;}
});

async function requestDelete(id){
  const r=reels.find(x=>x.id===id);if(!r||r.created_by!==user.id)return;
  if(!window.confirm('Ask Aaru/Somo to approve deleting this reel?'))return;
  setStatus('Sending delete request…');
  const {error}=await client.rpc('request_reel_delete',{p_reel_id:id});
  if(error){setStatus(error.message);return;}await load();
}
async function approveDelete(id){
  const r=reels.find(x=>x.id===id);if(!r||r.created_by===user.id)return;
  if(!window.confirm('Approve deleting this reel for both of us?'))return;
  setStatus('Recording both-person approval…');
  const {error}=await client.rpc('approve_reel_delete',{p_reel_id:id});
  if(error){setStatus(error.message);return;}await load();
}
async function finalDelete(id){
  const r=reels.find(x=>x.id===id);if(!r||!r.delete_approved_by)return;
  if(!window.confirm('Both of you approved this. Delete the reel and its saved memories?'))return;
  setStatus('Removing the reel…');
  const ms=memories[id]||[];
  const paths=ms.map(m=>m.storage_path);
  if(paths.length){const {error:storageError}=await client.storage.from('reel-memories').remove(paths);if(storageError){setStatus(storageError.message);return;}}
  const {error}=await client.from('couple_reels').delete().eq('id',id);
  if(error){setStatus(error.message);return;}await load();
}

init();


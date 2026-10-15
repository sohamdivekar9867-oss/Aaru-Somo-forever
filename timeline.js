const SUPABASE_URL="https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_KEY="sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";
const API=`${SUPABASE_URL}/rest/v1/date_entries`;
const dataClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const STORAGE_BUCKET="date-photos";

let dates=[];let editing=false;let editingId=null;
const PHOTO_LIMIT=10;
const photoInput=document.getElementById('photosInput');
const photoHelp=document.getElementById('photoHelp');
const photoSelectionStatus=document.getElementById('photoSelectionStatus');
const timeline=document.getElementById('timeline');
const addButton=document.getElementById('addDateButton');
const editButton=document.getElementById('editDatesButton');
const modal=document.getElementById('dateModal');
const form=document.getElementById('dateForm');
function escapeHTML(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function formatDate(v){if(!v)return '';return new Date(`${v}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
function datePhotoPath(value){try{const raw=String(value||'');const marker='/storage/v1/object/public/date-photos/';const signedMarker='/storage/v1/object/sign/date-photos/';const markerIndex=raw.indexOf(marker);const signedIndex=raw.indexOf(signedMarker);const path=markerIndex>=0?raw.slice(markerIndex+marker.length):signedIndex>=0?raw.slice(signedIndex+signedMarker.length):raw;return decodeURIComponent(path.split('?')[0])}catch{return ''}}
function updatePhotoHelp(message=''){const saved=dates.find(x=>x.id===editingId)?.photo_urls;const existing=Array.isArray(saved)?saved.length:0;const remaining=Math.max(0,PHOTO_LIMIT-existing);photoInput.disabled=remaining===0;photoHelp.textContent=message||`${existing} saved photo${existing===1?'':'s'}; you can add ${remaining} more (up to ${PHOTO_LIMIT} total).`;photoSelectionStatus.textContent=photoInput.files.length?`${photoInput.files.length} selected`:''}
function openModal(item=null){editingId=item?.id||null;document.getElementById('dateModalTitle').textContent=item?'Edit date':'Add a date';document.getElementById('locationInput').value=item?.location||'';document.getElementById('occasionInput').value=item?.occasion||'';document.getElementById('dateInput').value=item?.date||'';document.getElementById('descriptionInput').value=item?.description||'';document.getElementById('detailInput').value=item?.detail||'';document.getElementById('favouriteInput').value=item?.favourite_moment||'';photoInput.value='';document.getElementById('formStatus').textContent='';updatePhotoHelp();modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');form.reset();editingId=null}
async function loadDates(){try{const {data,error}=await dataClient.from('date_entries').select('*').order('date',{ascending:true}).order('created_at',{ascending:true});if(error)throw error;dates=data||[];render()}catch(e){timeline.innerHTML=`<div class="empty-state">Our memories couldn't be loaded right now.<br><small>${escapeHTML(e.message)}</small></div>`}}
function render(){if(!dates.length){timeline.innerHTML='<div class="empty-state">Our garden is waiting for its first date. ✿<br>Unlock editing to add a memory.</div>';return}timeline.classList.toggle('editing',editing);timeline.innerHTML=dates.map(item=>`<article class="timeline-item"><a class="timeline-card" href="date-detail.html?id=${encodeURIComponent(item.id)}"><div class="timeline-location">${escapeHTML(item.location)}</div><div class="timeline-date">${formatDate(item.date)}</div></a><div class="timeline-edit"><button class="mini-button edit-date" data-id="${item.id}">Edit</button><button class="mini-button delete-date" data-id="${item.id}">Delete</button></div></article>`).join('');document.querySelectorAll('.edit-date').forEach(b=>b.addEventListener('click',()=>openModal(dates.find(x=>x.id===b.dataset.id))));document.querySelectorAll('.delete-date').forEach(b=>b.addEventListener('click',()=>deleteDate(b.dataset.id)))}
async function deleteDate(id){if(!confirm('Delete this date memory?'))return;const item=dates.find(x=>x.id===id);const {error}=await dataClient.from('date_entries').delete().eq('id',id);if(error){alert(`Could not delete this memory: ${error.message}`);return}dates=dates.filter(x=>x.id!==id);render();const paths=(Array.isArray(item?.photo_urls)?item.photo_urls:[]).map(datePhotoPath).filter(Boolean);if(paths.length){const {error:storageError}=await dataClient.storage.from(STORAGE_BUCKET).remove(paths);if(storageError)console.error('Date deleted, but photo cleanup failed:',storageError)}}
async function uploadPhotos(dateId,remainingSlots){const files=[...photoInput.files];if(files.length>remainingSlots)throw new Error(`You can add only ${remainingSlots} more photo${remainingSlots===1?'':'s'} to this date.`);if(!files.length)return[];const paths=[];try{for(let i=0;i<files.length;i++){const file=files[i];if(!file.type.startsWith('image/'))throw new Error('Please select image files only.');if(file.size>8*1024*1024)throw new Error('Each photo must be below 8 MB.');const safe=file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-');const path=`${dateId}/${Date.now()}-${i}-${safe}`;const {error}=await dataClient.storage.from(STORAGE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;paths.push(path)}return paths}catch(error){if(paths.length){const {error:cleanupError}=await dataClient.storage.from(STORAGE_BUCKET).remove(paths);if(cleanupError)console.error('Could not clean up partially uploaded Date photos:',cleanupError)}throw error}}

photoInput.addEventListener('change',()=>{const saved=dates.find(x=>x.id===editingId)?.photo_urls;const remaining=Math.max(0,PHOTO_LIMIT-(Array.isArray(saved)?saved.length:0));if(photoInput.files.length>remaining){photoInput.value='';updatePhotoHelp(`Only ${remaining} more photo${remaining===1?'':'s'} can be added to this date.`);return}updatePhotoHelp()});

form.addEventListener('submit',async e=>{e.preventDefault();const status=document.getElementById('formStatus'),save=document.getElementById('saveDateButton');const payload={location:document.getElementById('locationInput').value.trim(),occasion:document.getElementById('occasionInput').value.trim()||null,date:document.getElementById('dateInput').value,description:document.getElementById('descriptionInput').value.trim()||null,detail:document.getElementById('detailInput').value.trim()||null,favourite_moment:document.getElementById('favouriteInput').value.trim()||null,updated_at:new Date().toISOString()};if(!payload.location||!payload.date)return;save.disabled=true;status.textContent='Saving our memory…';let uploadedPaths=[];try{let id=editingId;const savedPhotos=dates.find(x=>x.id===id)?.photo_urls;const previousPhotos=Array.isArray(savedPhotos)?savedPhotos:[];const remainingSlots=Math.max(0,PHOTO_LIMIT-previousPhotos.length);if(photoInput.files.length>remainingSlots)throw new Error(`This date can have up to ${PHOTO_LIMIT} photos.`);if(id){const {error}=await dataClient.from('date_entries').update(payload).eq('id',id);if(error)throw error}else{payload.display_order=dates.length;const {data:created,error}=await dataClient.from('date_entries').insert(payload).select().single();if(error)throw error;id=created.id}const newUrls=await uploadPhotos(id,remainingSlots);uploadedPaths=newUrls;
      // Adding photos appends to the existing list and never removes saved photos.
      if(newUrls.length){
        const {error}=await dataClient.from('date_entries').update({photo_urls:[...previousPhotos,...newUrls].slice(0,PHOTO_LIMIT),updated_at:new Date().toISOString()}).eq('id',id);
        if(error)throw error;
      }
      uploadedPaths=[];closeModal();await loadDates()}catch(err){if(uploadedPaths.length){const {error:cleanupError}=await dataClient.storage.from(STORAGE_BUCKET).remove(uploadedPaths);if(cleanupError)console.error('Could not clean up unsaved Date photos:',cleanupError)}status.textContent='Could not save: '+err.message}finally{save.disabled=false}});
editButton.addEventListener('click',()=>{if(editing){editing=false;addButton.hidden=true;editButton.textContent='Edit dates';render();return}editing=true;addButton.hidden=false;editButton.textContent='Lock editing';render()});addButton.addEventListener('click',()=>openModal());document.querySelectorAll('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});loadDates();

// Date Cat planned quests are shared through Supabase so both Aaru and Somo see them.
const PLANNED_QUESTS_API=`${SUPABASE_URL}/rest/v1/planned_date_quests`;
async function renderPlannedQuests(){
  const box=document.getElementById('plannedQuests');
  if(!box)return;
  try{
    const {data:planned,error}=await dataClient.from('planned_date_quests').select('*').order('date',{ascending:true}).order('created_at',{ascending:false});
    if(error)throw error;
    if(!planned.length){box.hidden=true;return;}
    box.hidden=false;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    box.innerHTML=`<h2>Planned Little Adventures ♡</h2><p class="planned-sub">Date Cat's ideas that are waiting to become memories.</p><div class="planned-grid">${planned.map(x=>{const completed=x.status==='completed';return `<article class="planned-card${completed?' is-completed':''}"><div class="planned-label">🐱 DATE CAT QUEST</div><span class="planned-status">${completed?'COMPLETED':'PLANNED'}</span><h3>${esc(x.title)}</h3><p>📅 ${esc(x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : 'Date not set')}</p><p>📍 ${esc(x.location)}</p><p>🎯 ${esc(x.activity)}</p><p>⏱️ ${esc(x.duration)}</p><p>💰 ${esc(x.budget)}</p><p>💕 ${'❤️'.repeat(Number(x.romance)||3)}${'♡'.repeat(5-(Number(x.romance)||3))}</p><div class="planned-actions"><button data-toggle-planned="${esc(x.id)}">${completed?'Mark planned':'Mark completed'}</button><button data-remove-planned="${esc(x.id)}">Remove plan</button></div></article>`}).join('')}</div>`;
    box.querySelectorAll('[data-toggle-planned]').forEach(btn=>btn.addEventListener('click',async()=>{
      const quest=planned.find(x=>String(x.id)===btn.dataset.togglePlanned);
      if(!quest)return;
      btn.disabled=true;
      const {error}=await dataClient.from('planned_date_quests').update({status:quest.status==='completed'?'planned':'completed'}).eq('id',quest.id);
      if(error){btn.disabled=false;alert(`Could not update this planned date: ${error.message}`);return;}
      renderPlannedQuests();
    }));
    box.querySelectorAll('[data-remove-planned]').forEach(btn=>btn.addEventListener('click',async()=>{
      const id=btn.dataset.removePlanned;
      if(!confirm('Remove this planned date?'))return;
      const {error}=await dataClient.from('planned_date_quests').delete().eq('id',id);
      if(error){alert(`Could not remove this planned date: ${error.message}`);return;}
      renderPlannedQuests();
    }));
  }catch(e){
    console.error('Could not load planned Date Cat quests:',e);
    box.hidden=false;
    box.innerHTML='<h2>Planned Little Adventures ♡</h2><p class="planned-sub">Date Cat plans could not be loaded. Make sure the planned-date table has been created in Supabase.</p>';
  }
}
renderPlannedQuests();

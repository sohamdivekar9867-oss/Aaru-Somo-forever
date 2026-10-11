const SUPABASE_URL="https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_KEY="sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";
const API=`${SUPABASE_URL}/rest/v1/date_entries`;
const dataClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const STORAGE_BUCKET="date-photos";

let dates=[];let editing=false;let editingId=null;
const timeline=document.getElementById('timeline');
const addButton=document.getElementById('addDateButton');
const editButton=document.getElementById('editDatesButton');
const modal=document.getElementById('dateModal');
const form=document.getElementById('dateForm');
function escapeHTML(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function formatDate(v){if(!v)return '';return new Date(`${v}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
function openModal(item=null){editingId=item?.id||null;document.getElementById('dateModalTitle').textContent=item?'Edit date':'Add a date';document.getElementById('locationInput').value=item?.location||'';document.getElementById('occasionInput').value=item?.occasion||'';document.getElementById('dateInput').value=item?.date||'';document.getElementById('descriptionInput').value=item?.description||'';document.getElementById('detailInput').value=item?.detail||'';document.getElementById('favouriteInput').value=item?.favourite_moment||'';document.querySelectorAll('.photo-input').forEach(x=>x.value='');document.getElementById('formStatus').textContent='';modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');form.reset();editingId=null}
async function loadDates(){try{const {data,error}=await dataClient.from('date_entries').select('*').order('date',{ascending:true}).order('created_at',{ascending:true});if(error)throw error;dates=data||[];render()}catch(e){timeline.innerHTML=`<div class="empty-state">Our memories couldn't be loaded right now.<br><small>${escapeHTML(e.message)}</small></div>`}}
function render(){if(!dates.length){timeline.innerHTML='<div class="empty-state">Our garden is waiting for its first date. ✿<br>Unlock editing to add a memory.</div>';return}timeline.classList.toggle('editing',editing);timeline.innerHTML=dates.map(item=>`<article class="timeline-item"><a class="timeline-card" href="date-detail.html?id=${encodeURIComponent(item.id)}"><div class="timeline-location">${escapeHTML(item.location)}</div><div class="timeline-date">${formatDate(item.date)}</div></a><div class="timeline-edit"><button class="mini-button edit-date" data-id="${item.id}">Edit</button><button class="mini-button delete-date" data-id="${item.id}">Delete</button></div></article>`).join('');document.querySelectorAll('.edit-date').forEach(b=>b.addEventListener('click',()=>openModal(dates.find(x=>x.id===b.dataset.id))));document.querySelectorAll('.delete-date').forEach(b=>b.addEventListener('click',()=>deleteDate(b.dataset.id)))}
async function deleteDate(id){if(!confirm('Delete this date memory?'))return;const {error}=await dataClient.from('date_entries').delete().eq('id',id);if(error){alert(`Could not delete this memory: ${error.message}`);return}dates=dates.filter(x=>x.id!==id);render()}
async function uploadPhotos(dateId){const files=[...document.querySelectorAll('.photo-input')].map(x=>x.files[0]).filter(Boolean);if(!files.length)return[];const urls=[];for(let i=0;i<files.length&&i<5;i++){const file=files[i];if(!file.type.startsWith('image/'))throw new Error('Please select image files only.');if(file.size>8*1024*1024)throw new Error('Each photo must be below 8 MB.');const safe=file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-');const path=`${dateId}/${Date.now()}-${i}-${safe}`;const {error}=await dataClient.storage.from(STORAGE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const {data}=dataClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);urls.push(data.publicUrl)}return urls}

form.addEventListener('submit',async e=>{e.preventDefault();const status=document.getElementById('formStatus'),save=document.getElementById('saveDateButton');const payload={location:document.getElementById('locationInput').value.trim(),occasion:document.getElementById('occasionInput').value.trim()||null,date:document.getElementById('dateInput').value,description:document.getElementById('descriptionInput').value.trim()||null,detail:document.getElementById('detailInput').value.trim()||null,favourite_moment:document.getElementById('favouriteInput').value.trim()||null,updated_at:new Date().toISOString()};if(!payload.location||!payload.date)return;save.disabled=true;status.textContent='Saving our memory…';try{let id=editingId;if(id){const {error}=await dataClient.from('date_entries').update(payload).eq('id',id);if(error)throw error}else{payload.display_order=dates.length;const {data:created,error}=await dataClient.from('date_entries').insert(payload).select().single();if(error)throw error;id=created.id}const newUrls=await uploadPhotos(id);
      // New photos replace the previous set during editing.
      if(newUrls.length){
        const {error}=await dataClient.from('date_entries').update({photo_urls:newUrls.slice(0,5),updated_at:new Date().toISOString()}).eq('id',id);
        if(error)throw error;
      }
      closeModal();await loadDates()}catch(err){status.textContent='Could not save: '+err.message}finally{save.disabled=false}});
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
    box.innerHTML=`<h2>Planned Little Adventures ♡</h2><p class="planned-sub">Date Cat's ideas that are waiting to become memories.</p><div class="planned-grid">${planned.map(x=>`<article class="planned-card"><div class="planned-label">🐱 DATE CAT QUEST</div><h3>${esc(x.title)}</h3><p>📅 ${esc(x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : 'Date not set')}</p><p>📍 ${esc(x.location)}</p><p>🎯 ${esc(x.activity)}</p><p>⏱️ ${esc(x.duration)}</p><p>💰 ${esc(x.budget)}</p><p>💕 ${'❤️'.repeat(Number(x.romance)||3)}${'♡'.repeat(5-(Number(x.romance)||3))}</p><button data-remove-planned="${esc(x.id)}">Remove plan</button></article>`).join('')}</div>`;
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

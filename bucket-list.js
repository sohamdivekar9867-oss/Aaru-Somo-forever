const SUPABASE_URL="https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_KEY="sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";
const API=`${SUPABASE_URL}/rest/v1/bucket_list`;
const dataClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

let items=[];
let editing=false;
let editingId=null;
const colours=["red","green","blue","yellow"];
const grid=document.getElementById("notesGrid");
const addButton=document.getElementById("addButton");
const editButton=document.getElementById("editButton");
const modal=document.getElementById("itemModal");
const form=document.getElementById("itemForm");

function escapeHTML(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function formatDate(value){if(!value)return "Not decided yet";const d=new Date(`${value}T00:00:00`);return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
function today(){return new Date().toISOString().slice(0,10)}

async function loadItems(){
  try{
    const {data,error}=await dataClient.from("bucket_list").select("*").order("display_order",{ascending:true}).order("created_at",{ascending:true});
    if(error)throw error;
    items=data||[];
    render();
  }catch(error){
    grid.innerHTML=`<div class="empty-state">Our stars couldn't be loaded right now.<br><small>${escapeHTML(error.message)}</small></div>`;
  }
}

function render(){
  const completed=items.filter(i=>i.completed).length;
  document.getElementById("totalCount").textContent=items.length;
  document.getElementById("completedCount").textContent=completed;
  document.getElementById("waitingCount").textContent=items.length-completed;
  const percent=items.length?Math.round(completed/items.length*100):0;
  document.getElementById("progressBar").style.width=`${percent}%`;
  document.getElementById("progressText").textContent=`${percent}% of our dreams completed`;
  if(!items.length){grid.innerHTML='<div class="empty-state">Our universe is waiting for its first dream. ✦<br>Unlock editing to add one.</div>';return}
  grid.innerHTML=items.map((item,index)=>{
    const colour=colours[index%4];
    return `<article class="note ${colour} ${item.completed?"completed":""}" style="--rotation:${[-1.7,1.2,-.8,1.8][index%4]}deg" data-id="${item.id}">
      ${item.completed?'<div class="heart-stamp" title="Completed">♥</div>':''}
      <div class="note-text">${escapeHTML(item.item)}</div>
      <div class="note-meta">
        <div><b>Expected:</b> ${formatDate(item.expected_date)}</div>
        ${item.completed?`<div><b>❤️ Completed:</b> ${formatDate(item.completion_date)}</div>`:'<div><b>Status:</b> Still waiting for us ✦</div>'}
      </div>
      <div class="note-controls">
        <label>Dream
          <input class="edit-text" type="text" value="${escapeHTML(item.item)}" maxlength="180">
        </label>
        <label>Expected date
          <input class="edit-expected" type="date" value="${item.expected_date||""}">
        </label>
        <label class="check-row"><input class="edit-completed" type="checkbox" ${item.completed?"checked":""}> Mark as completed</label>
        <label>Completion date
          <input class="edit-completion" type="date" value="${item.completion_date||""}" ${item.completed?"":"disabled"}>
        </label>
        <div class="control-actions">
          <button class="mini-button save-note">Save</button>
          <button class="mini-button delete-note">Delete</button>
        </div>
      </div>
    </article>`
  }).join("");
  if(editing)grid.classList.add("editing");else grid.classList.remove("editing");
  bindNoteControls();
}
function bindNoteControls(){
  grid.querySelectorAll(".edit-completed").forEach(box=>{
    box.addEventListener("change",e=>{
      const note=e.target.closest(".note");
      const date=note.querySelector(".edit-completion");
      date.disabled=!e.target.checked;
      if(e.target.checked&&!date.value)date.value=today();
      if(!e.target.checked)date.value="";
    });
  });
  grid.querySelectorAll(".save-note").forEach(btn=>btn.addEventListener("click",async e=>{
    const note=e.target.closest(".note"),id=note.dataset.id;
    const completed=note.querySelector(".edit-completed").checked;
    const payload={
      item:note.querySelector(".edit-text").value.trim(),
      expected_date:note.querySelector(".edit-expected").value||null,
      completed,
      completion_date:completed?(note.querySelector(".edit-completion").value||today()):null,
      updated_at:new Date().toISOString()
    };
    if(!payload.item){alert("Please add a dream first.");return}
    e.target.disabled=true;
    const {error}=await dataClient.from("bucket_list").update(payload).eq("id",id);
    if(error){alert(`Couldn't save this dream: ${error.message}`);e.target.disabled=false;return}
    await loadItems();
  }));
  grid.querySelectorAll(".delete-note").forEach(btn=>btn.addEventListener("click",async e=>{
    const note=e.target.closest(".note"),id=note.dataset.id;
    if(!confirm("Delete this dream from our bucket list?"))return;
    e.target.disabled=true;
    const {error}=await dataClient.from("bucket_list").delete().eq("id",id);
    if(error){alert(`Couldn't delete this dream: ${error.message}`);e.target.disabled=false;return}
    items=items.filter(i=>i.id!==id);render();
  }));
}
editButton.addEventListener("click",()=>{
  if(editing){editing=false;addButton.hidden=true;editButton.textContent="Edit list";render();return}
  editing=true;addButton.hidden=false;editButton.textContent="Lock editing";render();
});
function openModal(){modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.getElementById("itemText").focus()}
function closeModal(){modal.classList.remove("open");modal.setAttribute("aria-hidden","true");form.reset()}
addButton.addEventListener("click",openModal);
document.querySelectorAll("[data-close-modal]").forEach(el=>el.addEventListener("click",closeModal));
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const item=document.getElementById("itemText").value.trim();
  if(!item)return;
  const payload={item,expected_date:document.getElementById("expectedDate").value||null,completed:false,completion_date:null,display_order:items.length};
  const {error}=await dataClient.from("bucket_list").insert(payload);
  if(error){alert(`Couldn't add the dream: ${error.message}`);return}
  closeModal();await loadItems();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
loadItems();

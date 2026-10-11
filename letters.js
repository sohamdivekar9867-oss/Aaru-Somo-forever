const SUPABASE_URL = 'https://swqaakxywwajesuajflz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

let currentUser = null;
let currentPerson = '';
let recipientPerson = '';

function personFromEmail(email = '') {
  const e = email.toLowerCase();
  if (e.includes('aaru')) return 'Aaru';
  if (e.includes('soham')) return 'Somo';
  return '';
}

async function loadCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data?.user || null;
  currentPerson = personFromEmail(currentUser?.email || '');
  recipientPerson = currentPerson === 'Aaru' ? 'Somo' : currentPerson === 'Somo' ? 'Aaru' : '';
  if (recipientPerson) document.getElementById('recipientInput').value = recipientPerson;
}

let editingUnlocked = false;
let letters = [];
const collection = document.getElementById('lettersCollection');
const editToggle = document.getElementById('editToggle');
const addButton = document.getElementById('addLetterButton');
const formPanel = document.getElementById('letterFormPanel');

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
}

function renderLetters() {
  collection.innerHTML = '';
  if (!letters.length) {
    collection.innerHTML = '<p class="empty-letters">No letters yet. Add one when you are ready. ♡</p>';
    return;
  }
  letters.forEach(letter => collection.appendChild(makeCard(letter, false)));
}

function makeCard(letter, isStatic) {
  const card = document.createElement('article');
  card.className = `letter-card${isStatic ? ' static-letter' : ''}`;
  card.innerHTML = `
    <div class="letter-recipient">Dear ${escapeHtml(letter.recipient || '')},</div>
    <div class="letter-content">${escapeHtml(letter.content || '')}</div>
    <div class="letter-signature">${escapeHtml(letter.signature || '')}</div>
    ${!isStatic && letter.sender ? `<div class="letter-meta">From ${escapeHtml(letter.sender)}${letter.read_at ? ' · Read' : ' · Waiting to be read'}</div>` : ''}
    ${!isStatic && editingUnlocked ? `
      <div class="letter-actions">
        <button class="small-button" data-action="edit" data-id="${letter.id}">Edit</button>
        <button class="small-button delete" data-action="delete" data-id="${letter.id}">Delete</button>
      </div>` : ''}
  `;
  return card;
}

async function loadLetters() {
  const { data, error } = await supabaseClient
    .from('love_letters')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    alert('The letters could not be loaded. Please check the Supabase table setup.');
    return;
  }
  letters = data || [];
  renderLetters();
}

function unlockOrLock() {
  if (editingUnlocked) {
    editingUnlocked = false;
    formPanel.classList.add('hidden');
    addButton.classList.add('hidden');
    editToggle.textContent = 'Edit Letters';
    renderLetters();
    return;
  }
  editingUnlocked = true;
  editToggle.textContent = 'Lock editing';
  addButton.classList.remove('hidden');
  renderLetters();
}

function openForm() {
  formPanel.classList.remove('hidden');
  document.getElementById('recipientInput').focus();
}
function closeForm() {
  formPanel.classList.add('hidden');
  document.getElementById('recipientInput').value = '';
  document.getElementById('contentInput').value = '';
  document.getElementById('signatureInput').value = '';
}

async function createLetter() {
  const recipient = document.getElementById('recipientInput').value.trim();
  const content = document.getElementById('contentInput').value.trim();
  const signature = document.getElementById('signatureInput').value.trim();
  if (!recipient || !content || !signature) return alert('Please fill in all three fields.');
  const { error } = await supabaseClient.from('love_letters').insert({
    recipient, content, signature, display_order: letters.length + 1,
    sender: currentPerson || signature,
    read_at: null
  });
  if (error) return alert(`Could not create the letter: ${error.message}`);
  closeForm();
  await loadCurrentUser().then(loadLetters);
}

async function editLetter(id) {
  const letter = letters.find(item => String(item.id) === String(id));
  if (!letter) return;
  const recipient = prompt('Dear...', letter.recipient || '');
  if (recipient === null) return;
  const content = prompt('Letter content:', letter.content || '');
  if (content === null) return;
  const signature = prompt('Signed by:', letter.signature || '');
  if (signature === null) return;
  const { error } = await supabaseClient.from('love_letters').update({ recipient, content, signature, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return alert(`Could not save the letter: ${error.message}`);
  await loadCurrentUser().then(loadLetters);
}

async function deleteLetter(id) {
  if (!confirm('Delete this entire letter?')) return;
  const { error } = await supabaseClient.from('love_letters').delete().eq('id', id);
  if (error) return alert(`Could not delete the letter: ${error.message}`);
  await loadCurrentUser().then(loadLetters);
}

editToggle.addEventListener('click', unlockOrLock);
addButton.addEventListener('click', openForm);
document.getElementById('cancelLetterButton').addEventListener('click', closeForm);
document.getElementById('createLetterButton').addEventListener('click', createLetter);
collection.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'edit') editLetter(button.dataset.id);
  if (button.dataset.action === 'delete') deleteLetter(button.dataset.id);
});
loadCurrentUser().then(loadLetters);

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

const staticLetter = {
  recipient: 'Aaru',
  content: `I don't think I will ever find words big enough to explain
what you mean to me, but I want to spend a lifetime trying.

I love you because of the way you make me feel, not just
when we're laughing together or having a beautiful day, but even in the quiet
moments, when I simply know that you are mine and I am yours. You have brought
a kind of warmth into my life that I didn't know I was missing. Somehow,
ordinary days feel more special because you are a part of them.

I love your sweetness, your little quirks, your thoughts,
your smile, and the person you are when you let your guard down with me. I love
the way you care, the way you make me feel seen, and the way you pout when mad.
But more than all of that, I love you.

You mean so much more to me than a girlfriend, more than
someone I get to call when I miss her. You are someone whose happiness
genuinely matters to me. I want to know how your day went, what made you smile,
what bothered you, what you're dreaming about, and what you don't always say
out loud. I want to be someone you can turn to, someone who makes life feel a
little softer and love feel a little safer.

And God, I love you passionately. I love the thought of
holding you close, kissing you, looking at you and knowing that this beautiful
person is the one I get to love. I love missing you when we're apart and
looking forward to the next moment I get to be beside you. I love that you can
make my heart feel so full just by being yourself.

You have become such a precious part of my life, Aaru. My
happiness has your smile in it. My plans have a place for you. And when I think
about the future, I find myself wishing for more ordinary moments with you: more
conversations, more dates, more laughter, more holding your hand, more days
where I get to remind you how loved you are.

I don't love you because you're perfect. I love you because
you're you, and somehow, that is more than enough to make my heart choose you
again and again.

Thank you for letting me love you. Thank you for being you.
And thank you for making me feel that love can be something so beautiful, so
exciting, and so deeply comforting at the same time.

I love you, Aaru. More than this letter can hold, and in
more ways than I will ever stop discovering.`,
  signature: 'Yours, always. Somo ❤️'
};

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
  collection.appendChild(makeCard(staticLetter, true));
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

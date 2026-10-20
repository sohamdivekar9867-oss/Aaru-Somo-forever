/* Small shared journal: Somda writes, Aaru reads. Supabase RLS is the authority. */
(() => {
  const journalClient = window.appSupabaseClient || window.supabase.createClient(
    'https://swqaakxywwajesuajflz.supabase.co',
    'sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G',
    { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const $ = id => document.getElementById(id);
  const listView = $('journalLibrary'), composeView = $('journalCompose'), readerView = $('journalReader');
  const entriesEl = $('journalEntries'), statusEl = $('journalStatus'), form = $('journalForm');
  const dateInput = $('journalDate'), thoughtInput = $('journalThought'), saveButton = $('saveThought');
  const SOMDA_EMAIL = 'sohamdivekar9867@gmail.com';
  let entries = [], activeEntry = null, canManage = false, dirty = false, busy = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function displayDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return 'Date unavailable';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'long', year:'numeric' }).format(date);
  }
  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', isError);
  }
  function setReaderStatus(message, isError = false) {
    const readerStatus = $('journalReaderStatus');
    readerStatus.textContent = message;
    readerStatus.classList.toggle('is-error', isError);
  }
  function setView(view) {
    listView.hidden = view !== 'list';
    composeView.hidden = view !== 'compose';
    readerView.hidden = view !== 'reader';
  }
  function renderEntries() {
    if (!entries.length) {
      entriesEl.innerHTML = `<div class="journal-empty"><span class="journal-empty-mark">♡</span><strong>A little space for today's thoughts</strong><p>${canManage ? 'Whenever you are ready, write down something you want to remember.' : 'Somo’s saved thoughts will be here.'}</p></div>`;
      return;
    }
    entriesEl.innerHTML = entries.map(entry => `
      <button class="journal-entry-card" type="button" data-journal-open="${escapeHtml(entry.id)}">
        <span class="journal-entry-copy"><span class="journal-entry-date">${escapeHtml(displayDate(entry.entry_date))}</span><span class="journal-entry-preview">${escapeHtml(entry.content)}</span></span>
        <span class="journal-entry-arrow" aria-hidden="true">›</span>
      </button>`).join('');
  }
  async function loadEntries({ quiet = false } = {}) {
    if (!quiet) setStatus('Opening your journal…');
    const { data, error } = await journalClient.from('somo_journal_entries')
      .select('id,entry_date,content,created_at,updated_at')
      .order('entry_date', { ascending:false })
      .order('created_at', { ascending:false })
      .order('id', { ascending:true });
    if (error) {
      setStatus('Could not load the journal. Check that SOMO_JOURNAL_SETUP.sql has been run.', true);
      entriesEl.innerHTML = '<div class="journal-empty"><strong>Your journal could not be opened.</strong><p>Check your connection and the Supabase setup, then reopen this section.</p></div>';
      return false;
    }
    entries = data || [];
    renderEntries();
    if (!quiet) setStatus(entries.length ? (canManage ? 'Your thoughts, saved across your devices.' : 'Read-only journal') : '');
    return true;
  }
  function openReader(entry) {
    if (!entry) return;
    activeEntry = entry;
    $('journalEntryDate').textContent = displayDate(entry.entry_date);
    $('journalEntryContent').textContent = entry.content;
    setReaderStatus('');
    $('journalReaderActions').hidden = !canManage;
    setView('reader');
    setStatus('');
  }
  function openComposer(entry = null) {
    if (!canManage) return;
    activeEntry = entry;
    form.dataset.editId = entry?.id || '';
    dateInput.value = entry?.entry_date || '';
    thoughtInput.value = entry?.content || '';
    $('journalComposeHeading').textContent = entry ? 'Edit this thought' : 'Write a thought';
    saveButton.textContent = entry ? 'Save changes' : 'Save thought';
    $('journalFormError').textContent = '';
    dirty = false;
    setView('compose');
    requestAnimationFrame(() => {
      (entry ? thoughtInput : dateInput).scrollIntoView({ block:'nearest', behavior:'smooth' });
      (entry ? thoughtInput : dateInput).focus({ preventScroll:true });
    });
  }
  async function openJournal() {
    setView('list');
    const { data:{ user }, error:authError } = await journalClient.auth.getUser();
    canManage = !authError && user?.email?.toLowerCase() === SOMDA_EMAIL;
    $('writeThought').hidden = !canManage;
    return loadEntries();
  }
  async function saveEntry(event) {
    event.preventDefault();
    if (!canManage || busy) return;
    const entryDate = dateInput.value;
    const content = thoughtInput.value;
    if (!entryDate) { $('journalFormError').textContent = 'Please choose the date for this thought.'; dateInput.focus(); return; }
    if (!content.trim()) { $('journalFormError').textContent = 'Write a thought before saving.'; thoughtInput.focus(); return; }
    busy = true; saveButton.disabled = true; saveButton.textContent = 'Saving…';
    $('journalFormError').textContent = '';
    const editingId = form.dataset.editId;
    const result = editingId
      ? await journalClient.from('somo_journal_entries').update({ entry_date:entryDate, content }).eq('id', editingId).select('id,entry_date,content,created_at,updated_at').single()
      : await journalClient.from('somo_journal_entries').insert({ entry_date:entryDate, content }).select('id,entry_date,content,created_at,updated_at').single();
    busy = false; saveButton.disabled = false; saveButton.textContent = editingId ? 'Save changes' : 'Save thought';
    if (result.error || !result.data) {
      $('journalFormError').textContent = 'This thought could not be saved. Check your connection and try again.';
      return;
    }
    dirty = false;
    await loadEntries({ quiet:true });
    const saved = entries.find(entry => entry.id === result.data.id) || result.data;
    openReader(saved);
    setReaderStatus(editingId ? 'Changes saved.' : 'Thought saved.');
  }
  function cancelComposer() {
    if (dirty && !confirm('Discard the unsaved changes to this thought?')) return;
    dirty = false;
    setView(activeEntry ? 'reader' : 'list');
    setStatus('');
  }
  async function deleteEntry() {
    if (!canManage || !activeEntry) return;
    if (!confirm(`Delete the thought from ${displayDate(activeEntry.entry_date)}? This cannot be undone.`)) return;
    $('deleteThought').disabled = true;
    const { error } = await journalClient.from('somo_journal_entries').delete().eq('id', activeEntry.id);
    $('deleteThought').disabled = false;
    if (error) { setReaderStatus('Could not delete this thought. Please try again.', true); return; }
    activeEntry = null;
    await loadEntries({ quiet:true });
    setView('list'); setStatus('Thought deleted.');
  }

  window.openSomoJournal = openJournal;
  $('writeThought').addEventListener('click', () => openComposer());
  entriesEl.addEventListener('click', event => {
    const card = event.target.closest('[data-journal-open]');
    if (card) openReader(entries.find(entry => entry.id === card.dataset.journalOpen));
  });
  form.addEventListener('submit', saveEntry);
  form.addEventListener('input', () => { dirty = true; $('journalFormError').textContent = ''; });
  $('cancelThought').addEventListener('click', cancelComposer);
  $('discardThought').addEventListener('click', cancelComposer);
  $('readerBack').addEventListener('click', () => { activeEntry = null; setView('list'); setStatus(''); });
  $('editThought').addEventListener('click', () => openComposer(activeEntry));
  $('deleteThought').addEventListener('click', deleteEntry);
})();


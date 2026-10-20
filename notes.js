/* Somo's Notes: independent journal documents, a continuous rich-text canvas,
   serialized autosave, and read-only access for every non-owner account. */
(() => {
  const client = window.appSupabaseClient || window.supabase.createClient(
    'https://swqaakxywwajesuajflz.supabase.co',
    'sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G',
    { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const $ = id => document.getElementById(id);
  const library = $('notesLibrary'), editor = $('notesEditor'), list = $('documentLibrary');
  const title = $('noteTitle'), body = $('noteBody'), status = $('saveState');
  const types = ['Chapter', 'Personal Journal', 'Random Thoughts', 'Letter'];
  let user = null, owner = false, documents = [], active = null, timer = 0, revision = 0, savedRevision = 0, saving = Promise.resolve();
  let savedRange = null;
  const draftKey = id => `somo-notes-document-${id}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const dateLabel = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : 'Not edited yet';
  const safeHtml = html => {
    const parsed = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const allowed = new Set(['DIV','P','BR','H1','H2','H3','STRONG','B','EM','I','U','UL','OL','LI','BLOCKQUOTE','SPAN','FONT']);
    const clean = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowed.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
          const align = child.getAttribute('align') || (child.style?.textAlign || '');
          const size = child.tagName === 'FONT' ? child.getAttribute('size') : null;
          [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
          if (['left','center','right','justify'].includes(align)) child.setAttribute('align', align);
          if (child.tagName === 'FONT' && /^[1-7]$/.test(size || '')) child.setAttribute('size', size);
          clean(child);
        } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
      });
    };
    clean(parsed.body.firstElementChild);
    return parsed.body.firstElementChild.innerHTML;
  };
  function setStatus(value) { status.textContent = value; }
  function showLibrary() { library.hidden = false; editor.hidden = true; active = null; renderLibrary(); }
  function renderLibrary() {
    const query = $('documentSearch').value.trim().toLocaleLowerCase();
    const ordered = [...documents].filter(d => (d.title || 'Untitled').toLocaleLowerCase().includes(query));
    if ($('documentSort').value === 'title') ordered.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    else ordered.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    if (!ordered.length) {
      list.innerHTML = `<div class="library-empty"><span class="empty-mark">✎</span><h4>${query ? 'No matching documents' : 'A fresh page, whenever you are ready.'}</h4><p>${query ? 'Try another title.' : owner ? 'Create a journal, chapter, letter, or collect a passing thought.' : 'Somo’s writing will appear here.'}</p>${owner && !query ? '<button class="save-note" data-create-first type="button">＋ Create your first document</button>' : ''}</div>`;
      return;
    }
    list.innerHTML = ordered.map(d => `<article class="document-card"><button class="document-open" type="button" data-open="${esc(d.id)}"><span class="document-card-mark">${d.type === 'Chapter' ? '§' : d.type === 'Letter' ? '✉' : '✎'}</span><span class="document-card-copy"><strong>${esc(d.title || 'Untitled')}</strong><span>${esc(d.type || 'Personal Journal')} · ${esc(dateLabel(d.updated_at))}</span><small>${esc((d.plain_text || '').slice(0,120) || 'An empty page, ready for words…')}</small></span><span class="card-arrow">›</span></button></article>`).join('');
  }
  async function refreshDocuments() {
    setStatus('Loading library…');
    const { data, error } = await client.from('somo_documents').select('id,title,type,content,updated_at,plain_text').order('updated_at', { ascending:false });
    if (error) { $('notesMessage').textContent = 'Could not load the cloud library. Run SOMO_NOTES_SETUP.sql in the Supabase SQL Editor, then retry.'; setStatus('Library unavailable'); return; }
    documents = data || []; renderLibrary(); setStatus(owner ? 'Your library' : 'Read only');
  }
  async function openDocument(id) {
    if (revision !== savedRevision && active && !(await flushSave())) return;
    active = documents.find(d => d.id === id);
    if (!active) return;
    library.hidden = true; editor.hidden = false;
    title.value = active.title || ''; body.innerHTML = safeHtml(active.content || '');
    if (owner) {
      try {
        const recovery = JSON.parse(localStorage.getItem(draftKey(active.id)) || 'null');
        if (recovery && confirm('An unsaved browser recovery draft exists for this document. Restore it?')) {
          title.value = recovery.title || title.value; body.innerHTML = safeHtml(recovery.content || ''); revision++; setStatus('Recovered draft · unsaved');
        }
      } catch (_) { /* Ignore malformed local recovery data; the cloud document is intact. */ }
    }
    body.contentEditable = owner ? 'true' : 'false'; title.readOnly = !owner;
    $('documentTypeBadge').textContent = active.type || 'Personal Journal'; $('documentTypeLabel').textContent = (active.type || 'Personal Journal').toUpperCase();
    $('documentEdited').textContent = `Edited ${dateLabel(active.updated_at)}`;
    ['renameDocument','duplicateDocument','deleteDocument','newDocument'].forEach(id => $(id).hidden = !owner);
    $('formatToolbar').hidden = !owner;
    if (!(owner && revision !== savedRevision)) setStatus(owner ? 'Saved' : 'Read only');
    if (owner) body.focus({ preventScroll:true });
  }
  function snapshot() { return { title:title.value.trim() || 'Untitled', content:safeHtml(body.innerHTML), plain_text:body.innerText || '' }; }
  function changed() {
    if (!owner || !active) return;
    revision++; setStatus('Unsaved changes'); clearTimeout(timer); timer = setTimeout(flushSave, 850);
    try { localStorage.setItem(draftKey(active.id), JSON.stringify({ ...snapshot(), revision })); } catch (_) { /* Cloud save remains authoritative. */ }
  }
  function flushSave() {
    clearTimeout(timer);
    if (!owner || !active || revision === savedRevision) return Promise.resolve(true);
    const targetRevision = revision, doc = active, value = snapshot();
    setStatus('Saving…');
    saving = saving.catch(() => {}).then(async () => {
      const { error } = await client.from('somo_documents').update(value).eq('id', doc.id);
      if (error) { setStatus('Save failed · tap to retry'); $('editorMessage').textContent = 'Your latest changes remain in this browser. Tap this message to retry the cloud save.'; return false; }
      savedRevision = Math.max(savedRevision, targetRevision);
      const row = documents.find(d => d.id === doc.id); if (row) Object.assign(row, value, { updated_at:new Date().toISOString() });
      if (active?.id === doc.id) { $('documentEdited').textContent = `Edited ${dateLabel(new Date())}`; setStatus(revision === savedRevision ? 'Saved' : 'Saving…'); }
      $('editorMessage').textContent = 'Saved securely to your journal library.';
      try { localStorage.removeItem(draftKey(doc.id)); } catch (_) {}
      if (revision !== savedRevision && active?.id === doc.id) timer = setTimeout(flushSave, 0);
      return savedRevision >= revision;
    });
    return saving;
  }
  async function createDocument(copy = null) {
    if (!owner) return;
    const chosen = copy ? copy.type : $('newDocumentType').value;
    const type = types.find(item => item.toLowerCase() === chosen.trim().toLowerCase()) || 'Personal Journal';
    const initial = copy ? `${copy.title || 'Untitled'} copy` : '';
    const row = { title:initial, type, content:copy ? safeHtml(copy.content) : '', plain_text:copy?.plain_text || '' };
    setStatus('Creating…');
    const { data, error } = await client.from('somo_documents').insert(row).select('id,title,type,content,plain_text,updated_at').single();
    if (error) { setStatus('Create failed'); $('notesMessage').textContent = 'Could not create that document. Please try again.'; return; }
    documents.unshift(data); $('notesMessage').textContent = ''; await openDocument(data.id);
    if (!copy) { title.focus(); title.select(); }
  }
  async function rename() {
    if (!owner || !active) return;
    const value = prompt('Rename this document', title.value); if (value === null) return;
    const next = value.trim(); if (!next) { alert('A document needs a title.'); return; }
    title.value = next; changed(); await flushSave(); renderLibrary();
  }
  async function removeDocument() {
    if (!owner || !active || !confirm(`Delete “${title.value || 'Untitled'}”? This cannot be undone.`)) return;
    const { error } = await client.from('somo_documents').delete().eq('id', active.id);
    if (error) { $('editorMessage').textContent = 'Delete failed. Please try again.'; return; }
    documents = documents.filter(d => d.id !== active.id); showLibrary(); setStatus('Deleted');
  }
  function command(name, value = null) {
    if (!owner) return;
    body.focus();
    if (savedRange) { const selection = getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); }
    document.execCommand(name, false, value); changed();
  }
  async function initialize() {
    const { data:{ user: current }, error } = await client.auth.getUser(); user = error ? null : current;
    owner = !!user && user.email?.toLowerCase() === 'sohamdivekar9867@gmail.com';
    $('newDocument').hidden = !owner;
    $('newDocumentType').hidden = !owner;
    $('notesMessage').textContent = owner ? 'Saved documents sync securely through your account.' : 'You can read and copy documents here.';
    await refreshDocuments();
  }
  window.openSomoNotes = initialize;
  $('documentLibrary').addEventListener('click', e => { const b=e.target.closest('[data-open]'); if (b) openDocument(b.dataset.open); if (e.target.closest('[data-create-first]')) createDocument(); });
  $('documentSearch').addEventListener('input', renderLibrary); $('documentSort').addEventListener('change', renderLibrary);
  $('newDocument').addEventListener('click', async () => { if (revision !== savedRevision && !(await flushSave())) return; await createDocument(); }); $('backToLibrary').addEventListener('click', async () => { if (revision !== savedRevision && !(await flushSave())) return; showLibrary(); });
  $('renameDocument').addEventListener('click', rename); $('deleteDocument').addEventListener('click', removeDocument); $('duplicateDocument').addEventListener('click', async () => { if (!active) return; if (revision !== savedRevision && !(await flushSave())) return; await createDocument(active); });
  title.addEventListener('input', changed); body.addEventListener('input', changed);
  document.addEventListener('selectionchange', () => {
    const selection = getSelection();
    if (selection?.rangeCount && body.contains(selection.anchorNode) && body.contains(selection.focusNode)) savedRange = selection.getRangeAt(0).cloneRange();
  });
  $('formatToolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('formatToolbar').addEventListener('click', e => { const b=e.target.closest('[data-command]'); if (b) command(b.dataset.command); });
  $('paragraphStyle').addEventListener('change', e => command('formatBlock', e.target.value));
  $('fontSize').addEventListener('change', e => command('fontSize', e.target.value));
  $('editorMessage').addEventListener('click', () => { if (status.textContent.startsWith('Save failed')) flushSave(); });
  window.addEventListener('beforeunload', e => { if (owner && revision !== savedRevision) { e.preventDefault(); e.returnValue = ''; } });
})();

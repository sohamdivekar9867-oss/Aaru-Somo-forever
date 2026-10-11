(() => {
  'use strict';

  const client = window.appSupabaseClient;
  const bucket = 'background-radio';
  const maxBytes = 50 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  const form = $('radioUploadForm');
  const fileInput = $('radioFile');
  const titleInput = $('radioTitle');
  const fileName = $('fileName');
  const uploadButton = $('uploadButton');
  const message = $('radioMessage');
  const trackList = $('trackList');
  const trackCount = $('trackCount');
  const cassette = $('cassetteDeck');
  const activeTitle = $('activeTrackTitle');
  const activeStatus = $('activeTrackStatus');
  let currentUser = null;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  }
  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
  }
  function cleanFileTitle(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) || 'Untitled song';
  }
  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function formatDate(value) {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
  }

  async function loadTracks() {
    if (!client) {
      trackList.innerHTML = '<p class="empty-library">The music service is unavailable. Refresh this page and try again.</p>';
      showMessage('Supabase did not load.', true);
      return;
    }
    trackList.innerHTML = '<p class="empty-library">Finding our songs…</p>';
    const { data, error } = await client.from('background_radio_tracks')
      .select('id,title,storage_path,mime_type,file_size,uploaded_by,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Background Radio] Could not list tracks:', error);
      trackList.innerHTML = '<p class="empty-library">The radio library is not ready.</p>';
      showMessage('Run BACKGROUND_RADIO_SETUP.sql in Supabase, then refresh.', true);
      return;
    }

    const entries = await Promise.all((data || []).map(async row => {
      const { data: signed, error: signError } = await client.storage.from(bucket).createSignedUrl(row.storage_path, 3600);
      return signError || !signed?.signedUrl ? null : { ...row, url: signed.signedUrl };
    }));
    const tracks = entries.filter(Boolean);
    trackCount.textContent = tracks.length + (tracks.length === 1 ? ' track' : ' tracks');
    if (!tracks.length) {
      trackList.innerHTML = '<p class="empty-library">No songs saved yet. Add our first one above. ♡</p>';
      return;
    }
    trackList.innerHTML = tracks.map(track => {
      const sourceType = escapeHtml(track.mime_type);
      const player = track.mime_type === 'video/mp4'
        ? '<video class="track-player" controls preload="none" playsinline data-radio-player aria-label="Play ' + escapeHtml(track.title) + '"><source src="' + escapeHtml(track.url) + '" type="' + sourceType + '"></video>'
        : '<audio class="track-player" controls preload="none" data-radio-player aria-label="Play ' + escapeHtml(track.title) + '"><source src="' + escapeHtml(track.url) + '" type="' + sourceType + '"></audio>';
      return '<article class="track-card" data-track-title="' + escapeHtml(track.title) + '">' +
        '<div class="track-card-head"><div><h3>' + escapeHtml(track.title) + '</h3><p class="track-meta">' + formatSize(Number(track.file_size)) + ' · added ' + escapeHtml(formatDate(track.created_at)) + '</p></div>' +
        (track.uploaded_by === currentUser?.id ? '<button class="track-delete" type="button" data-delete-track="' + escapeHtml(track.id) + '">Remove</button>' : '') +
        '</div>' + player + '</article>';
    }).join('');

    trackList.querySelectorAll('[data-radio-player]').forEach(player => {
      player.addEventListener('play', () => {
        trackList.querySelectorAll('[data-radio-player]').forEach(other => { if (other !== player) other.pause(); });
        cassette.classList.add('is-playing');
        activeTitle.textContent = player.closest('.track-card')?.dataset.trackTitle || 'OUR SONG';
        activeStatus.textContent = 'NOW PLAYING';
      });
      player.addEventListener('pause', updatePlaybackState);
      player.addEventListener('ended', updatePlaybackState);
    });
  }

  function updatePlaybackState() {
    const playing = Array.from(trackList.querySelectorAll('[data-radio-player]')).some(player => !player.paused && !player.ended);
    if (!playing) {
      cassette.classList.remove('is-playing');
      activeStatus.textContent = 'READY TO PLAY';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file || !currentUser || !client) return showMessage('Choose a song file after signing in.', true);
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['mp4', 'm4a'].includes(extension)) return showMessage('Choose an MP4 or M4A file.', true);
    if (file.size <= 0 || file.size > maxBytes) return showMessage('Each file must be between 1 byte and 50 MB.', true);

    uploadButton.disabled = true;
    showMessage('Saving your song privately…');
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || ('song.' + extension);
    const path = currentUser.id + '/' + crypto.randomUUID() + '-' + safeName;
    const mimeType = ['audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/mp4'].includes(file.type)
      ? file.type
      : extension === 'm4a' ? 'audio/mp4' : 'video/mp4';
    const { error: uploadError } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: mimeType
    });
    if (uploadError) {
      console.error('[Background Radio] Upload failed:', uploadError);
      showMessage('Could not upload this file. Check the setup SQL and file size.', true);
      uploadButton.disabled = false;
      return;
    }

    const title = titleInput.value.trim() || cleanFileTitle(file.name);
    const { error: insertError } = await client.from('background_radio_tracks').insert({
      title, storage_path: path, mime_type: mimeType, file_size: file.size, uploaded_by: currentUser.id
    });
    if (insertError) {
      console.error('[Background Radio] Track record failed:', insertError);
      await client.storage.from(bucket).remove([path]);
      showMessage('The file uploaded but could not be added to the library. Check the setup SQL.', true);
      uploadButton.disabled = false;
      return;
    }

    form.reset();
    fileName.textContent = 'Choose an MP4 or M4A file';
    titleInput.value = '';
    showMessage('Added to our radio. ♡');
    uploadButton.disabled = false;
    await loadTracks();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileName.textContent = file ? file.name : 'Choose an MP4 or M4A file';
    if (!titleInput.value.trim() && file) titleInput.value = cleanFileTitle(file.name);
  });

  trackList.addEventListener('click', async event => {
    const button = event.target.closest('[data-delete-track]');
    if (!button || !currentUser) return;
    if (!window.confirm('Remove this song from Background Radio?')) return;
    button.disabled = true;
    const id = button.dataset.deleteTrack;
    const { data: row, error: lookupError } = await client.from('background_radio_tracks')
      .select('id,storage_path').eq('id', id).eq('uploaded_by', currentUser.id).maybeSingle();
    if (lookupError || !row) {
      showMessage('You can remove only songs you uploaded.', true);
      button.disabled = false;
      return;
    }
    const { error: deleteError } = await client.from('background_radio_tracks')
      .delete().eq('id', id).eq('uploaded_by', currentUser.id);
    if (deleteError) {
      console.error('[Background Radio] Remove failed:', deleteError);
      showMessage('Could not remove this song.', true);
      button.disabled = false;
      return;
    }
    const { error: storageError } = await client.storage.from(bucket).remove([row.storage_path]);
    if (storageError) console.error('[Background Radio] Removed library row but could not remove its file:', storageError);
    showMessage('Song removed from the radio.');
    await loadTracks();
  });

  async function initialize() {
    if (!client) return;
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      showMessage('Please sign in to use Background Radio.', true);
      return;
    }
    currentUser = data.user;
    await loadTracks();
  }
  initialize();
})();

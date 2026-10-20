(() => {
  'use strict';

  const PHONE_SUPABASE_URL = 'https://swqaakxywwajesuajflz.supabase.co';
  const PHONE_SUPABASE_KEY = 'sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G';
  const PROFILE_EMAILS = {
    Aaru: 'aaru.saru090901@gmail.com',
    Somo: 'sohamdivekar9867@gmail.com'
  };

  const phoneClient = window.supabase?.createClient
    ? window.supabase.createClient(PHONE_SUPABASE_URL, PHONE_SUPABASE_KEY, {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  let currentUser = null;
  let myProfile = '';
  let selectedProfile = '';
  let photos = [];
  let photoLoadRequestId = 0;
  let viewerIndex = -1;

  const $ = id => document.getElementById(id);
  const chooser = $('profileChooser');
  const wallpaperView = $('wallpaperView');
  const wallpaperImage = $('phoneWallpaperImage');
  const phoneScreen = document.querySelector('.phone-screen');
  const wallpaperPlaceholder = $('wallpaperPlaceholder');
  const wallpaperStatus = $('wallpaperStatus');
  const wallpaperUploadWrap = $('wallpaperUploadWrap');
  const wallpaperInput = $('wallpaperInput');
  const enterPhone = $('enterPhone');
  const wallpaperBack = $('wallpaperBack');
  const galleryView = $('galleryView');
  const galleryBack = $('galleryBack');
  const galleryTitle = $('galleryTitle');
  const galleryCount = $('galleryCount');
  const grid = $('photoGrid');
  const input = $('photoInput');
  const uploadLabel = $('uploadLabel');
  const statusEl = $('uploadStatus');
  const viewer = $('photoViewer');
  const viewerClose = $('viewerClose');
  const viewerImage = $('viewerImage');
  const viewerCaption = $('viewerCaption');
  const viewerPrev = $('viewerPrev');
  const viewerNext = $('viewerNext');
  const viewerDeleteWrap = $('viewerDeleteWrap');
  const phoneTime = $('phoneTime');

  function setStatus(message = '') { if (statusEl) statusEl.textContent = message; }
  function updatePhoneTime() {
    if (phoneTime) phoneTime.textContent = new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    }).format(new Date());
  }
  updatePhoneTime();
  setInterval(updatePhoneTime, 1000);

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function showChooser() {
    if (wallpaperView) { wallpaperView.hidden = false; wallpaperView.style.display = 'block'; }
    if (galleryView) { galleryView.hidden = true; galleryView.style.display = 'none'; }
    if (chooser) { chooser.hidden = false; chooser.style.display = 'flex'; }
    selectedProfile = '';
    photoLoadRequestId += 1;
    setStatus('');
  }

  function showWallpaper() {
    if (chooser) { chooser.hidden = true; chooser.style.display = 'none'; }
    if (galleryView) { galleryView.hidden = true; galleryView.style.display = 'none'; }
    if (wallpaperView) { wallpaperView.hidden = false; wallpaperView.style.display = 'block'; }
    selectedProfile = '';
    photoLoadRequestId += 1;
  }

  async function loadWallpaper() {
    if (!phoneClient) {
      if (wallpaperStatus) wallpaperStatus.textContent = 'Wallpaper storage is unavailable.';
      return;
    }
    try {
      const { data, error } = await phoneClient.from('phone_wallpapers')
        .select('storage_path').eq('id', true).maybeSingle();
      if (error) throw error;
      if (!data?.storage_path) {
        wallpaperImage.hidden = true;
        wallpaperPlaceholder.hidden = false;
        return;
      }
      const { data: signed, error: signError } = await phoneClient.storage
        .from('phone-wallpapers').createSignedUrl(data.storage_path, 3600);
      if (signError) throw signError;
      wallpaperImage.src = signed.signedUrl;
      phoneScreen?.style.setProperty('--phone-wallpaper-image', `url("${signed.signedUrl}")`);
      wallpaperImage.hidden = false;
      wallpaperPlaceholder.hidden = true;
      wallpaperImage.onerror = () => {
        wallpaperImage.hidden = true;
        wallpaperPlaceholder.hidden = false;
        if (wallpaperStatus) wallpaperStatus.textContent = 'Could not display the wallpaper.';
      };
      if (wallpaperStatus) wallpaperStatus.textContent = '';
    } catch (err) {
      console.error('Phone wallpaper load error:', err);
      if (wallpaperStatus) wallpaperStatus.textContent = 'Could not load wallpaper. Check PHONE_WALLPAPER_SETUP.sql.';
    }
  }

  async function uploadWallpaper(file) {
    if (!file) return;
    if (myProfile !== 'Aaru' || !currentUser) {
      if (wallpaperStatus) wallpaperStatus.textContent = 'Only Aaru can change this wallpaper.';
      return;
    }
    if (!phoneClient) {
      if (wallpaperStatus) wallpaperStatus.textContent = 'Wallpaper storage is unavailable.';
      return;
    }
    if (!file.type.startsWith('image/')) {
      if (wallpaperStatus) wallpaperStatus.textContent = 'Choose an image file for the wallpaper.';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      if (wallpaperStatus) wallpaperStatus.textContent = 'Choose an image smaller than 15 MB.';
      return;
    }
    if (wallpaperStatus) wallpaperStatus.textContent = 'Saving wallpaper…';
    wallpaperInput.disabled = true;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'wallpaper';
    const path = `${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    try {
      const { error: uploadError } = await phoneClient.storage.from('phone-wallpapers')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: previous, error: readError } = await phoneClient.from('phone_wallpapers')
        .select('storage_path').eq('id', true).maybeSingle();
      if (readError) throw readError;
      const { error: saveError } = await phoneClient.from('phone_wallpapers').upsert({
        id: true, storage_path: path, uploaded_by: currentUser.id, updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (saveError) throw saveError;
      await loadWallpaper();
      if (previous?.storage_path) {
        const { error: cleanupError } = await phoneClient.storage.from('phone-wallpapers').remove([previous.storage_path]);
        if (cleanupError) console.warn('Old wallpaper cleanup failed:', cleanupError);
      }
      if (wallpaperStatus) wallpaperStatus.textContent = 'Wallpaper saved.';
    } catch (err) {
      console.error('Phone wallpaper upload error:', err);
      await phoneClient.storage.from('phone-wallpapers').remove([path]);
      if (wallpaperStatus) wallpaperStatus.textContent = `Could not save wallpaper: ${err.message || 'Please try again.'}`;
    } finally {
      wallpaperInput.disabled = false;
      wallpaperInput.value = '';
    }
  }

  window.openPhoneProfile = async function(profile) {
    if (profile !== 'Aaru' && profile !== 'Somo') return;
    selectedProfile = profile;
    if (galleryTitle) galleryTitle.textContent = `${profile}'s Memories`;
    if (uploadLabel) uploadLabel.classList.toggle('is-disabled', profile !== myProfile);
    if (input) input.disabled = profile !== myProfile;
    if (wallpaperView) { wallpaperView.hidden = true; wallpaperView.style.display = 'none'; }
    if (chooser) { chooser.hidden = true; chooser.style.display = 'none'; }
    if (galleryView) { galleryView.hidden = false; galleryView.style.display = 'block'; }
    setStatus(profile === myProfile ? 'Your collection · you can add photos here.' : `${profile}'s collection · view only.`);
    if (!phoneClient) { setStatus('Gallery opened, but Supabase is not available.'); return; }
    await loadPhotos();
  };

  async function resolveMyProfile() {
    const email = String(currentUser?.email || '').trim().toLowerCase();
    if (email === PROFILE_EMAILS.Aaru.toLowerCase()) return 'Aaru';
    if (email === PROFILE_EMAILS.Somo.toLowerCase()) return 'Somo';
    const meta = currentUser?.user_metadata || {};
    const candidate = String(meta.profile_name || meta.profile || meta.name || '').toLowerCase();
    if (candidate === 'aaru') return 'Aaru';
    if (candidate === 'somo' || candidate === 'soham') return 'Somo';
    return '';
  }

  async function loadProfilePictures() {
    if (!phoneClient) return;
    for (const profile of ['Aaru','Somo']) {
      const img = $(`profileAvatar${profile}`);
      const placeholder = $(`profilePlaceholder${profile}`);
      const upload = $(`profileUpload${profile}`);
      if (upload) upload.hidden = profile !== myProfile;
      try {
        const { data, error } = await phoneClient.from('phone_profile_pictures')
          .select('id,profile_name,storage_path,created_at')
          .eq('profile_name', profile).maybeSingle();
        if (error) throw error;
        if (data?.storage_path) {
          const { data: signed, error: signError } = await phoneClient.storage.from('chat-photos').createSignedUrl(data.storage_path, 3600);
          if (signError) throw signError;
          if (signed?.signedUrl) {
            img.src = signed.signedUrl;
            img.hidden = false;
            placeholder.hidden = true;
          }
        } else {
          img.hidden = true;
          placeholder.hidden = false;
        }
      } catch (err) {
        console.error(`Profile picture load error for ${profile}:`, err);
        img.hidden = true;
        placeholder.hidden = false;
      }
    }
  }

  async function uploadProfilePicture(profile, file) {
    if (!file || !phoneClient || !currentUser) return;
    if (profile !== myProfile) {
      alert(`You are logged in as ${myProfile}. You can only change your own profile picture.`);
      return;
    }
    if (!file.type.startsWith('image/')) { alert('Please choose an image.'); return; }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'profile';
    const path = `profiles/${profile}/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    const { data: existing, error: existingError } = await phoneClient.from('phone_profile_pictures')
      .select('id,storage_path').eq('profile_name', profile).maybeSingle();
    if (existingError) { alert(existingError.message); return; }
    const { error: storageError } = await phoneClient.storage.from('chat-photos').upload(path, file, { cacheControl:'31536000', upsert:false, contentType:file.type });
    if (storageError) { alert(`Could not upload profile picture: ${storageError.message}`); return; }
    if (existing?.storage_path) await phoneClient.storage.from('chat-photos').remove([existing.storage_path]);
    const payload = { profile_name: profile, storage_path: path, updated_by: currentUser.id };
    let dbError;
    if (existing?.id) {
      ({ error: dbError } = await phoneClient.from('phone_profile_pictures').update(payload).eq('id', existing.id));
    } else {
      ({ error: dbError } = await phoneClient.from('phone_profile_pictures').insert(payload));
    }
    if (dbError) {
      await phoneClient.storage.from('chat-photos').remove([path]);
      alert(`Could not save profile picture: ${dbError.message}`);
      return;
    }
    await loadProfilePictures();
  }

  window.__loadPhoneProfile = function(profile) { return window.openPhoneProfile(profile); };

  async function loadPhotos() {
    if (!grid) return;
    const requestId = ++photoLoadRequestId;
    const requestedProfile = selectedProfile;
    grid.innerHTML = '<div class="photo-empty">Opening memories…</div>';
    if (!phoneClient) {
      grid.innerHTML = '<div class="photo-empty">The photo service is unavailable.<small>Please refresh the page.</small></div>';
      return;
    }
    const { data, error } = await phoneClient.from('chat_photos')
      .select('id,profile_name,storage_path,original_name,mime_type,created_by,created_at')
      .eq('profile_name', requestedProfile).order('created_at', { ascending: false });
    if (requestId !== photoLoadRequestId || requestedProfile !== selectedProfile) return;
    if (error) {
      console.error('chat_photos load error:', error);
      grid.innerHTML = `<div class="photo-empty">Could not open this gallery. ❤️<small>${escapeHtml(error.message || 'Check PHONE_PHOTOS_SETUP.sql')}</small></div>`;
      return;
    }
    const loadedPhotos = [];
    for (const row of data || []) {
      const { data: signed, error: signError } = await phoneClient.storage.from('chat-photos').createSignedUrl(row.storage_path, 3600);
      if (requestId !== photoLoadRequestId || requestedProfile !== selectedProfile) return;
      if (!signError && signed?.signedUrl) loadedPhotos.push({...row, url: signed.signedUrl});
    }
    if (requestId !== photoLoadRequestId || requestedProfile !== selectedProfile) return;
    photos = loadedPhotos;
    if (galleryCount) galleryCount.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    renderPhotos();
  }

  function renderPhotos() {
    if (!grid) return;
    if (!photos.length) {
      grid.innerHTML = `<div class="photo-empty">No screenshots here yet. ❤️<small>${selectedProfile === myProfile ? 'Tap ＋ to save your first memory.' : 'Nothing has been saved here yet.'}</small></div>`;
      return;
    }
    grid.innerHTML = photos.map((photo,index) => `<article class="photo-card" data-index="${index}" tabindex="0" role="button">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.original_name || 'Chat memory')}" loading="lazy">
      ${photo.created_by === currentUser?.id ? `<button class="photo-delete" type="button" data-delete-id="${escapeHtml(photo.id)}" aria-label="Delete photo">×</button>` : ''}
    </article>`).join('');
  }

  async function uploadPhotos(files) {
    if (!files.length || !phoneClient || !currentUser) return;
    if (selectedProfile !== myProfile) { alert(`You are logged in as ${myProfile}. You can only add photos to your own collection.`); return; }
    setStatus(`Saving ${files.length} photo${files.length === 1 ? '' : 's'}…`);
    let uploaded = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'photo';
      const path = `${myProfile}/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await phoneClient.storage.from('chat-photos').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});
      if (storageError) { alert(`Could not upload ${file.name}: ${storageError.message}`); continue; }
      const { error: dbError } = await phoneClient.from('chat_photos').insert({profile_name:myProfile,storage_path:path,original_name:file.name,mime_type:file.type,created_by:currentUser.id});
      if (dbError) { await phoneClient.storage.from('chat-photos').remove([path]); alert(`Could not save ${file.name}: ${dbError.message}`); continue; }
      uploaded++;
    }
    input.value='';
    setStatus(`${uploaded} photo${uploaded===1?'':'s'} saved. ❤️`);
    await loadPhotos();
  }

  async function deletePhoto(id) {
    // Delete only the selected gallery row. Multiple rows can reference the same
    // storage_path, so deleting the Storage object here makes every such card vanish.
    const photo = photos.find(p => String(p.id) === String(id));
    if (!photo || photo.created_by !== currentUser?.id) return;
    if (!confirm('Delete this screenshot?')) return;

    const { error, data } = await phoneClient.from('chat_photos')
      .delete()
      .eq('id', photo.id)
      .eq('created_by', currentUser.id)
      .select('id');

    if (error) { alert(error.message); return; }
    if (!data || data.length === 0) {
      alert('The photo was not deleted. Please refresh and try again.');
      return;
    }

    // Intentionally do NOT remove photo.storage_path from Supabase Storage.
    // The same object may be referenced by another gallery row.
    closeViewer();
    await loadPhotos();
  }

  function openViewer(index) {
    if (!photos[index]) return;
    viewerIndex=index;
    const photo=photos[index];
    viewerImage.src=photo.url;
    viewerImage.alt=photo.original_name || 'Chat memory';
    viewerCaption.textContent=`${index+1} / ${photos.length}`;
    viewerDeleteWrap.innerHTML=photo.created_by===currentUser?.id ? '<button class="viewer-delete" id="viewerDelete" type="button">Delete this photo</button>' : '';
    const del=$('viewerDelete'); if(del) del.addEventListener('click',()=>deletePhoto(photo.id));
    viewer.classList.add('is-open'); viewer.setAttribute('aria-hidden','false');
  }
  function closeViewer(){ viewer.classList.remove('is-open'); viewer.setAttribute('aria-hidden','true'); viewerImage.src=''; viewerDeleteWrap.innerHTML=''; }
  function stepViewer(direction){ if(!photos.length)return; openViewer((viewerIndex+direction+photos.length)%photos.length); }

  const profileOptions = $('profileOptions');
  if (profileOptions) {
    profileOptions.addEventListener('click', (event) => {
      // Upload controls must never open the gallery.
      if (event.target.closest('.profile-upload')) return;
      const card = event.target.closest('.profile-card');
      if (!card) return;
      const profile = card.dataset.profile;
      if (profile) window.__openPhoneProfileFallback(profile);
    });
  }

  if (galleryBack) galleryBack.addEventListener('click', showChooser);
  if (enterPhone) enterPhone.addEventListener('click', showChooser);
  if (wallpaperBack) wallpaperBack.addEventListener('click', showWallpaper);
  if (wallpaperInput) wallpaperInput.addEventListener('change', () => uploadWallpaper(wallpaperInput.files?.[0]));
  if (input) input.addEventListener('change',()=>uploadPhotos(Array.from(input.files||[])));
  for (const profile of ['Aaru','Somo']) {
    const inputEl = $(`profileInput${profile}`);
    if (inputEl) inputEl.addEventListener('change', () => uploadProfilePicture(profile, inputEl.files?.[0]));
  }
  if (grid) grid.addEventListener('click',e=>{
    const del=e.target.closest('[data-delete-id]');
    if(del){e.stopPropagation();deletePhoto(del.dataset.deleteId);return;}
    const card=e.target.closest('.photo-card'); if(card) openViewer(Number(card.dataset.index));
  });
  if (grid) grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.photo-card')){e.preventDefault();openViewer(Number(e.target.closest('.photo-card').dataset.index));}});
  if (viewerClose) viewerClose.addEventListener('click',closeViewer);
  if (viewerPrev) viewerPrev.addEventListener('click',()=>stepViewer(-1));
  if (viewerNext) viewerNext.addEventListener('click',()=>stepViewer(1));
  document.addEventListener('keydown',e=>{if(!viewer?.classList.contains('is-open'))return;if(e.key==='Escape')closeViewer();if(e.key==='ArrowLeft')stepViewer(-1);if(e.key==='ArrowRight')stepViewer(1);});

  async function init(){
    if (!phoneClient) return;
    try {
      const {data:{user},error}=await phoneClient.auth.getUser();
      if(error||!user){ window.location.replace('login.html'); return; }
      currentUser=user;
      myProfile=await resolveMyProfile();
      if (wallpaperUploadWrap) wallpaperUploadWrap.hidden = myProfile !== 'Aaru';
      await loadWallpaper();
      await loadProfilePictures();
      showWallpaper();
    } catch(err) { console.error('Phone gallery init error:',err); }
  }

  init();
})();


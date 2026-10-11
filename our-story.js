const SUPABASE_URL = "https://swqaakxywwajesuajflz.supabase.co";
const SUPABASE_KEY = "sb_publishable_LfHzOfkinZEd_D8AZpNqCw_075eKf-G";
const storySupabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const PEOPLE = {
  Aaru: "aaru.saru090901@gmail.com",
  Somo: "sohamdivekar9867@gmail.com"
};

let chapters = [];
let readerPages = [];
let currentPage = 0;
let currentUser = null;
const DIARY_AUTHOR = "Aaru";
let flipDirection = "next";
let deleteRequests = [];

const $ = id => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
}

function authorForEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (value === PEOPLE.Aaru) return "Aaru";
  if (value === PEOPLE.Somo) return "Somo";
  return null;
}

function renderContent(content = "") {
  const clean = String(content || "").trim();
  if (!clean) return `<p class="empty-story">This diary page is waiting to be written.</p>`;
  return clean.split(/\n\s*\n/).map(part =>
    `<p>${escapeHtml(part.trim()).replace(/\n/g, "<br>")}</p>`
  ).join("");
}

function textFromEditor(element) {
  return Array.from(element.querySelectorAll("p"))
    .map(p => p.innerText.trim())
    .filter(Boolean)
    .join("\n\n") || element.innerText.trim();
}

function slugify(value) {
  return String(value || "chapter")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `chapter-${Date.now()}`;
}

function getPerspective(chapter, author) {
  return (chapter.perspectives || []).find(p => p.author === author) || null;
}

function canEditPerspective(author) {
  return !!currentUser && !!authorForEmail(currentUser.email) && author === DIARY_AUTHOR;
}

function canEditChapter() {
  return !!currentUser && !!authorForEmail(currentUser.email);
}

function buildDiaryLabel() {
  return `<div class="diary-author-label"><span class="diary-heart">♡</span><span>AARU'S DIARY</span><span class="diary-written-note">written with love</span></div>`;
}

function createStoryPage(chapter, number) {
  const perspective = getPerspective(chapter, DIARY_AUTHOR);
  const editable = canEditPerspective(DIARY_AUTHOR);
  const hasText = !!perspective;
  const page = document.createElement("section");
  const side = number % 2 === 0 ? "left" : "right";
  page.className = `reader-page story-page diary-page diary-page--${side}`;
  page.dataset.chapterId = chapter.id;
  page.dataset.diarySide = side;
  const editorId = `editor-${chapter.id}`;
  const titleId = `title-${chapter.id}`;

  page.innerHTML = `
    <div class="page-inner diary-page-inner">
      <div class="page-top"><span>${String(number - 1).padStart(2, "0")} · AARU'S DIARY</span><span>PRIVATE THOUGHTS & MEMORIES</span></div>
      <div class="story-page-content diary-page-content">
        <div class="story-toolbar diary-toolbar">
          ${buildDiaryLabel()}
          ${canEditChapter() ? `<button class="chapter-edit-button" data-chapter-id="${escapeHtml(chapter.id)}">Edit heading</button>` : ""}
        </div>
        <div class="chapter-heading-wrap">
          <p class="page-eyebrow">Entry ${String(number - 2).padStart(2, "0")}</p>
          <h2 class="chapter-heading" id="${titleId}">${escapeHtml(chapter.title)}</h2>
        </div>
        <div class="page-rule"></div>
        ${hasText ? `
          <div class="editable-content contenteditable-area diary-ruled-content ${editable ? "editing-active" : ""}" id="${editorId}" contenteditable="${editable ? "true" : "false"}" spellcheck="true">${renderContent(perspective.content)}</div>
          ${editable ? `<div class="story-edit-actions"><button class="story-save-button" data-chapter-id="${escapeHtml(chapter.id)}">Save diary entry</button></div>` : ""}
        ` : `
          <div class="perspective-empty diary-empty">
            <p>This page is waiting for a memory.</p>
            ${editable ? `<button class="add-perspective-button" data-chapter-id="${escapeHtml(chapter.id)}">＋ Write this entry</button>` : `<span>Log in with either account to add to Aaru's diary.</span>`}
          </div>
        `}
        <div class="page-quote">“A little moment, kept forever.” <span>♡</span></div>
      </div>
      <div class="page-bottom"><span>Aaru's diary</span><span>${String(number - 1).padStart(2, "0")}</span></div>
    </div>`;
  return page;
}

function buildPages() {
  const container = $("dynamicStoryPages");
  container.innerHTML = "";
  readerPages = [$("indexPage")];

  chapters.forEach((chapter, index) => {
    const page = createStoryPage(chapter, index + 3);
    container.appendChild(page);
    readerPages.push(page);
  });

  bindStoryControls();
  buildIndex();
  showPage(Math.min(currentPage, readerPages.length - 1), false);
}

function makeIndexEntry(chapter, index, overlay = false) {
  const entryClass = overlay ? "overlay-entry" : "index-entry";
  const numberClass = overlay ? "overlay-entry-number" : "index-number";
  const textClass = overlay ? "overlay-entry-text" : "index-entry-text";
  const pageClass = overlay ? "overlay-entry-page" : "index-page-number";
  const number = String(index + 1).padStart(2, "0");
  const pageNumber = String(index + 3).padStart(2, "0");

  return `<button class="${entryClass}" data-target="${escapeHtml(chapter.id)}">
    <span class="${numberClass}">${number}</span>
    <span class="${textClass}"><strong>${escapeHtml(chapter.title)}</strong></span>
    <span class="${pageClass}">${pageNumber}</span>
  </button>`;
}

function buildIndex() {
  const empty = `<div class="index-coming-soon"><span>♡</span> Your first diary entry is waiting to be written.</div>`;
  $("indexList").innerHTML = chapters.length
    ? chapters.map((c, i) => `<div class="index-entry-wrapper">${makeIndexEntry(c, i)}</div>`).join("")
    : empty;
  $("overlayIndexList").innerHTML = chapters.length
    ? chapters.map((c, i) => `<div class="overlay-entry-wrapper">${makeIndexEntry(c, i, true)}</div>`).join("")
    : empty;

  document.querySelectorAll(".index-entry, .overlay-entry").forEach(button => {
    button.addEventListener("click", () => goToChapter(button.dataset.target));
  });
}

function bindStoryControls() {
  document.querySelectorAll(".story-save-button").forEach(button => {
    button.addEventListener("click", () => saveDiaryEntry(button));
  });


  document.querySelectorAll(".add-perspective-button").forEach(button => {
    button.addEventListener("click", () => addDiaryEntry(button.dataset.chapterId));
  });

  document.querySelectorAll(".chapter-edit-button").forEach(button => {
    button.addEventListener("click", () => editHeading(button.dataset.chapterId));
  });
}

async function loadCurrentUser() {
  // Use the active browser session directly. This is more reliable here than
  // calling getUser() during page initialization, especially with the
  // sessionStorage-based login used by this site.
  const { data, error } = await storySupabaseClient.auth.getSession();
  if (error) {
    console.error("Could not read Supabase session:", error);
    currentUser = null;
    return;
  }
  currentUser = data?.session?.user || null;
  console.log("Our Story auth:", currentUser?.email || "no active session");
}

async function loadStories() {
  const { data: chapterData, error: chapterError } = await storySupabaseClient
    .from("story_chapters")
    .select("id,title,display_order,published,created_by,created_at,updated_at")
    .eq("published", true)
    .order("display_order", { ascending: true });

  if (chapterError) {
    console.error(chapterError);
    alert("Could not load the story chapters. Please run STORY_SETUP.sql in Supabase first.");
    return;
  }

  const { data: perspectiveData, error: perspectiveError } = await storySupabaseClient
    .from("story_perspectives")
    .select("id,chapter_id,author,content,created_by,created_at,updated_at");

  if (perspectiveError) {
    console.error(perspectiveError);
    alert("Could not load the story perspectives. Please run STORY_SETUP.sql in Supabase first.");
    return;
  }

  const perspectives = perspectiveData || [];
  chapters = (chapterData || []).map(chapter => ({
    ...chapter,
    perspectives: perspectives.filter(p => p.chapter_id === chapter.id && p.author === DIARY_AUTHOR)
  }));

  await loadDeleteRequests();
  buildPages();
}

async function saveDiaryEntry(button) {
  await loadCurrentUser();
  if (!currentUser) return alert("Please log in first ♡");

  const author = authorForEmail(currentUser.email);
  if (!author) {
    alert("This account is not authorized for Aaru's diary.");
    return;
  }

  const chapter = chapters.find(c => c.id === button.dataset.chapterId);
  const editor = document.getElementById(`editor-${button.dataset.chapterId}`);
  if (!chapter || !editor) return;

  const content = textFromEditor(editor);
  button.disabled = true;
  button.textContent = "Saving...";

  const existing = getPerspective(chapter, DIARY_AUTHOR);
  let result;

  if (existing) {
    result = await storySupabaseClient
      .from("story_perspectives")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    result = await storySupabaseClient
      .from("story_perspectives")
      .insert({ chapter_id: chapter.id, author: DIARY_AUTHOR, content, created_by: currentUser.id })
      .select()
      .single();
  }

  if (result.error) {
    console.error(result.error);
    button.disabled = false;
    button.textContent = "Save failed";
    alert("Could not save this diary entry. Run STORY_DIARY_UPDATE.sql in Supabase, then try again.");
    return;
  }

  if (existing) existing.content = content;
  else chapter.perspectives.push(result.data);

  button.textContent = "Saved ✓";
  setTimeout(() => { button.textContent = "Save diary entry"; button.disabled = false; }, 1600);
}


async function addDiaryEntry(chapterId) {
  await loadCurrentUser();
  if (!currentUser) return alert("Please log in first ♡");
  const author = authorForEmail(currentUser.email);
  if (!author) return alert("This account is not authorized for Aaru's diary.");

  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return;
  if (getPerspective(chapter, DIARY_AUTHOR)) return buildPages();

  const { data, error } = await storySupabaseClient
    .from("story_perspectives")
    .insert({ chapter_id: chapter.id, author: DIARY_AUTHOR, content: "", created_by: currentUser.id })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Could not add this diary entry. Run STORY_DIARY_UPDATE.sql in Supabase, then try again.");
    return;
  }

  chapter.perspectives.push(data);
  buildPagesAndReturn(currentPage);
}

async function createChapter() {
  // Refresh the local auth reference immediately before an insert so a
  // freshly restored/renewed Supabase session is never treated as logged out.
  await loadCurrentUser();
  if (!currentUser || !authorForEmail(currentUser.email)) return alert("Please log in first ♡");

  const title = prompt("Enter the heading for this new chapter:");
  if (!title || !title.trim()) return;
  const cleanTitle = title.trim();

  if (chapters.some(c => c.title.trim().toLowerCase() === cleanTitle.toLowerCase())) {
    alert("A chapter with this heading already exists.");
    return;
  }

  const maxOrder = chapters.reduce((max, c) => Math.max(max, Number(c.display_order) || 0), 0);
  const { data: chapter, error } = await storySupabaseClient
    .from("story_chapters")
    .insert({ title: cleanTitle, display_order: maxOrder + 1, published: true, created_by: currentUser.id })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Could not create the diary entry. Check Supabase RLS and run STORY_DIARY_UPDATE.sql.");
    return;
  }

  const { data: perspective, error: perspectiveError } = await storySupabaseClient
    .from("story_perspectives")
    .insert({ chapter_id: chapter.id, author: DIARY_AUTHOR, content: "", created_by: currentUser.id })
    .select()
    .single();

  if (perspectiveError) {
    console.error(perspectiveError);
    await storySupabaseClient.from("story_chapters").delete().eq("id", chapter.id);
    alert("The entry was created but its diary page could not be added. Run STORY_DIARY_UPDATE.sql in Supabase.");
    return;
  }

  chapter.perspectives = [perspective];
  chapters.push(chapter);
  buildPages();
  goToChapter(chapter.id);
}

async function editHeading(chapterId) {
  await loadCurrentUser();
  if (!canEditChapter()) return;
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const nextTitle = prompt("Edit chapter heading:", chapter.title);
  if (!nextTitle || !nextTitle.trim() || nextTitle.trim() === chapter.title) return;
  const cleanTitle = nextTitle.trim();

  if (chapters.some(c => c.id !== chapterId && c.title.trim().toLowerCase() === cleanTitle.toLowerCase())) {
    alert("A chapter with this heading already exists.");
    return;
  }

  const { error } = await storySupabaseClient
    .from("story_chapters")
    .update({ title: cleanTitle, updated_at: new Date().toISOString() })
    .eq("id", chapterId);

  if (error) {
    console.error(error);
    alert("Could not update the chapter heading.");
    return;
  }

  chapter.title = cleanTitle;
  buildPages();
}

async function loadDeleteRequests() {
  const { data, error } = await storySupabaseClient
    .from("story_chapter_delete_requests")
    .select("id,chapter_id,requester_email,approver_email,status,created_at")
    .eq("status", "pending");
  if (error) {
    console.warn("Could not load deletion requests:", error);
    deleteRequests = [];
    return;
  }
  deleteRequests = data || [];
}

function oppositePerson(author) {
  return author === "Aaru" ? "Somo" : "Aaru";
}

function emailForAuthor(author) {
  return author === "Aaru" ? PEOPLE.Aaru : PEOPLE.Somo;
}

function renderDeleteRequestList() {
  const container = $("deleteRequestList");
  if (!container) return;
  if (!chapters.length) {
    container.innerHTML = `<p class="delete-modal-intro">There are no chapters to delete.</p>`;
    return;
  }

  const myEmail = String(currentUser?.email || "").toLowerCase();
  const myAuthor = authorForEmail(myEmail);

  container.innerHTML = chapters.map(chapter => {
    const request = deleteRequests.find(r => r.chapter_id === chapter.id && r.status === "pending");
    let action = `<button class="delete-request-action primary" data-delete-request="${escapeHtml(chapter.id)}">Request deletion</button>`;
    let meta = "No deletion request";

    if (request) {
      if (String(request.approver_email).toLowerCase() === myEmail) {
        action = `<button class="delete-request-action primary" data-approve-delete="${escapeHtml(request.id)}">Authorize deletion</button>`;
        meta = `Requested by ${escapeHtml(authorForEmail(request.requester_email) || request.requester_email)}`;
      } else if (String(request.requester_email).toLowerCase() === myEmail) {
        action = `<button class="delete-request-action" disabled>Waiting for ${escapeHtml(oppositePerson(myAuthor))}</button>`;
        meta = `Waiting for ${escapeHtml(oppositePerson(myAuthor))} to authorize`;
      } else {
        action = `<button class="delete-request-action" disabled>Pending approval</button>`;
        meta = "Two-person authorization pending";
      }
    }

    return `<div class="delete-request-row">
      <div><div class="delete-request-title">${escapeHtml(chapter.title)}</div><div class="delete-request-meta">${meta}</div></div>
      ${action}
    </div>`;
  }).join("");

  container.querySelectorAll("[data-delete-request]").forEach(button => {
    button.addEventListener("click", () => requestChapterDeletion(button.dataset.deleteRequest));
  });
  container.querySelectorAll("[data-approve-delete]").forEach(button => {
    button.addEventListener("click", () => authorizeChapterDeletion(button.dataset.approveDelete));
  });
}

async function openDeleteModal() {
  await loadCurrentUser();
  if (!currentUser || !authorForEmail(currentUser.email)) {
    alert("Please log in first ♡");
    return;
  }
  await loadDeleteRequests();
  renderDeleteRequestList();
  $("deleteModal").classList.add("open");
  $("deleteModal").setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  $("deleteModal").classList.remove("open");
  $("deleteModal").setAttribute("aria-hidden", "true");
}

async function requestChapterDeletion(chapterId) {
  await loadCurrentUser();
  const requesterEmail = String(currentUser?.email || "").toLowerCase();
  const requester = authorForEmail(requesterEmail);
  if (!requester) return alert("This account is not authorized for Our Story.");

  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const existing = deleteRequests.find(r => r.chapter_id === chapterId && r.status === "pending");
  if (existing) {
    renderDeleteRequestList();
    return;
  }

  const approver = oppositePerson(requester);
  const approverEmail = emailForAuthor(approver);
  if (!confirm(`Request deletion of “${chapter.title}” from Aaru's diary? ${approver} must authorize it before anything is deleted.`)) return;

  const { data, error } = await storySupabaseClient
    .from("story_chapter_delete_requests")
    .insert({
      chapter_id: chapterId,
      requester_id: currentUser.id,
      requester_email: requesterEmail,
      approver_email: approverEmail,
      status: "pending"
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Could not create the deletion request. Please run the latest STORY_SETUP.sql in Supabase.");
    return;
  }

  deleteRequests.push(data);
  renderDeleteRequestList();
}

async function authorizeChapterDeletion(requestId) {
  await loadCurrentUser();
  const approverEmail = String(currentUser?.email || "").toLowerCase();
  if (!authorForEmail(approverEmail)) return alert("This account is not authorized for Our Story.");

  const request = deleteRequests.find(r => r.id === requestId);
  const chapter = request ? chapters.find(c => c.id === request.chapter_id) : null;
  if (!request || !chapter) return;

  if (String(request.approver_email).toLowerCase() !== approverEmail) {
    alert("Only the other person can authorize this deletion.");
    return;
  }

  if (!confirm(`Authorize deletion of “${chapter.title}”? This will permanently remove this diary entry.`)) return;

  const { data, error } = await storySupabaseClient.rpc("authorize_story_chapter_deletion", {
    p_request_id: requestId
  });

  if (error) {
    console.error(error);
    alert("Could not authorize the deletion. Please run the latest STORY_SETUP.sql in Supabase.");
    return;
  }

  closeDeleteModal();
  await loadStories();
  currentPage = 0;
  showPage(0, false);
}

function buildPagesAndReturn(pageIndex) {
  buildPages();
  showPage(Math.max(0, Math.min(pageIndex, readerPages.length - 1)), false);
}

function showPage(index, smooth = true) {
  if (!readerPages.length) return;
  const nextIndex = Math.max(0, Math.min(index, readerPages.length - 1));
  const changedPage = nextIndex !== currentPage;
  flipDirection = nextIndex >= currentPage ? "next" : "previous";
  readerPages.forEach((page, i) => {
    page.classList.remove("flip-in-next", "flip-in-previous");
    page.classList.toggle("active-page", i === nextIndex);
    if (i === nextIndex && smooth && changedPage) {
      page.classList.add(flipDirection === "next" ? "flip-in-next" : "flip-in-previous");
      window.setTimeout(() => page.classList.remove("flip-in-next", "flip-in-previous"), 720);
    }
  });
  currentPage = nextIndex;
  $("pageCounter").textContent = `Page ${currentPage + 2} of ${readerPages.length + 1}`;
  $("prevBtn").disabled = false;
  $("nextBtn").disabled = currentPage === readerPages.length - 1;
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
}

function goToChapter(chapterId) {
  const index = readerPages.findIndex(page => page.dataset.chapterId === chapterId);
  if (index >= 0) showPage(index);
  closeOverlay();
}

function openOverlay() { $("indexOverlay").classList.add("open"); }
function closeOverlay() { $("indexOverlay").classList.remove("open"); }

document.addEventListener("DOMContentLoaded", async () => {
  $("startBookBtn").addEventListener("click", () => {
    $("coverPage").classList.add("cover-opening");
    setTimeout(() => {
      $("coverPage").style.display = "none";
      $("reader").style.display = "block";
      showPage(0, false);
    }, 450);
  });

  $("prevBtn").addEventListener("click", () => {
    if (currentPage === 0) window.location.href = "index.html";
    else showPage(currentPage - 1);
  });
  $("nextBtn").addEventListener("click", () => showPage(currentPage + 1));
  $("bottomIndexBtn").addEventListener("click", () => showPage(0));
  $("indexToggle").addEventListener("click", openOverlay);
  $("closeIndexBtn").addEventListener("click", closeOverlay);
  $("addPageBtn").addEventListener("click", createChapter);
  $("deletePageBtn").addEventListener("click", openDeleteModal);
  $("deleteModalClose").addEventListener("click", closeDeleteModal);
  $("deleteModalBackdrop").addEventListener("click", closeDeleteModal);
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeOverlay(); });

  await loadCurrentUser();
  await loadStories();
});

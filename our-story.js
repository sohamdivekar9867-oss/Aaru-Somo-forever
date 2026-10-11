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
  return `<div class="diary-author-label"><span class="diary-heart">♡</span><span>AARU'S DIARY</span></div>`;
}

// Split text into phone-sized page chunks while keeping paragraphs and words intact.
function paginateDiaryText(content = "") {
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  const charsPerLine = isMobile ? 38 : 52;
  // Keep a generous safety margin: actual browser font wrapping varies by device.
  const linesPerPage = isMobile ? 10 : 12;
  const paragraphs = String(content || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (!paragraphs.length) return [""];
  const pages = [];
  let pageParts = [], usedLines = 0;
  const pushPage = () => { if (pageParts.length) pages.push(pageParts.join("\n\n")); pageParts = []; usedLines = 0; };
  paragraphs.forEach(paragraph => {
    const words = paragraph.split(/\s+/);
    let part = "", partLines = 1;
    words.forEach(word => {
      const candidate = part ? `${part} ${word}` : word;
      const nextLines = Math.max(1, Math.ceil(candidate.length / charsPerLine));
      if (part && nextLines > partLines) {
        if (usedLines + partLines > linesPerPage) pushPage();
        pageParts.push(part); usedLines += partLines; part = word; partLines = Math.max(1, Math.ceil(word.length / charsPerLine));
      } else { part = candidate; partLines = nextLines; }
      if (partLines >= linesPerPage) {
        if (usedLines + partLines > linesPerPage) pushPage();
        pageParts.push(part); usedLines += partLines; part = ""; partLines = 0;
      }
    });
    if (part) {
      if (usedLines + partLines > linesPerPage) pushPage();
      pageParts.push(part); usedLines += partLines;
    }
  });
  pushPage();
  return pages.length ? pages : [""];
}

function createStoryPage(chapter, number, segmentIndex = 0, segments = [""]) {
  const perspective = getPerspective(chapter, DIARY_AUTHOR);
  const editable = canEditPerspective(DIARY_AUTHOR);
  const hasText = !!perspective;
  const page = document.createElement("section");
  const side = number % 2 === 0 ? "left" : "right";
  page.className = `reader-page story-page diary-page diary-page--${side}`;
  page.dataset.chapterId = chapter.id;
  page.dataset.diarySide = side;
  page.dataset.segmentIndex = String(segmentIndex);
  const editorId = `editor-${chapter.id}-${segmentIndex}`;
  const titleId = `title-${chapter.id}-${segmentIndex}`;
  const pageContent = segments[segmentIndex] || "";
  const firstSegment = segmentIndex === 0;
  page.innerHTML = `
    <div class="page-inner diary-page-inner">
      <div class="page-top"><span>${String(number + 1).padStart(2, "0")} · AARU'S DIARY</span><span></span></div>
      <div class="story-page-content diary-page-content">
        ${firstSegment ? `<div class="story-toolbar diary-toolbar"><div></div>${canEditChapter() ? `<button class="chapter-edit-button" data-chapter-id="${escapeHtml(chapter.id)}">Edit heading</button>` : ""}</div>
        <div class="chapter-heading-wrap"><h2 class="chapter-heading" id="${titleId}">${escapeHtml(chapter.title)}</h2></div>
        <div class="page-rule"></div>` : `<div class="chapter-heading-wrap continuation-heading"><h2 class="chapter-heading">${escapeHtml(chapter.title)} <span>(continued)</span></h2></div>`}
        ${hasText ? `
          <div class="editable-content contenteditable-area diary-ruled-content ${editable ? "editing-active" : ""}" id="${editorId}" data-chapter-id="${escapeHtml(chapter.id)}" data-segment-index="${segmentIndex}" contenteditable="${editable ? "true" : "false"}" spellcheck="true">${renderContent(pageContent)}</div>
          ${editable && firstSegment ? `<div class="story-edit-actions"><button class="story-save-button" data-chapter-id="${escapeHtml(chapter.id)}">Save diary entry</button></div>` : ""}
        ` : `
          <div class="perspective-empty diary-empty">
            <p>This page is waiting for a memory.</p>
            ${editable ? `<button class="add-perspective-button" data-chapter-id="${escapeHtml(chapter.id)}">＋ Write this entry</button>` : `<span>Log in with either account to add to Aaru's diary.</span>`}
          </div>
        `}
      </div>
      <div class="page-bottom"><span></span><span>${String(number + 1).padStart(2, "0")}</span></div>
    </div>`;
  return page;
}

function buildPages() {
  const container = $("dynamicStoryPages");
  container.innerHTML = "";
  readerPages = [];
  const isMobileLayout = window.matchMedia("(max-width: 700px)").matches;
  const indexEntriesPerPage = isMobileLayout ? 8 : 6;
  const firstIndexCapacity = isMobileLayout ? 5 : 4;
  const indexChunks = [];
  if (!chapters.length) indexChunks.push([]);
  else {
    indexChunks.push(chapters.slice(0, firstIndexCapacity));
    for (let i = firstIndexCapacity; i < chapters.length; i += indexEntriesPerPage) indexChunks.push(chapters.slice(i, i + indexEntriesPerPage));
  }

  const baseIndex = $("indexPage");
  const indexHost = baseIndex.parentElement;
  baseIndex.classList.remove("active-page");
  baseIndex.dataset.readerIndex = "0";
  const indexPages = [baseIndex];
  indexChunks.slice(1).forEach((chunk, idx) => {
    const clone = baseIndex.cloneNode(true);
    clone.id = `indexPage-${idx + 2}`;
    clone.dataset.readerIndex = String(idx + 1);
    clone.classList.remove("active-page");
    indexHost.insertBefore(clone, container);
    indexPages.push(clone);
  });

  // Remove index clones from any prior render before rebuilding their contents.
  document.querySelectorAll("[id^='indexPage-']").forEach((el, i) => { if (!indexPages.includes(el)) el.remove(); });
  indexPages.forEach((page, i) => {
    const chunk = indexChunks[i] || [];
    const list = page.querySelector(".index-list");
    if (list) list.innerHTML = chunk.length ? chunk.map(ch => {
      const originalIndex = chapters.findIndex(c => c.id === ch.id);
      return `<div class="index-entry-wrapper">${makeIndexEntry(ch, originalIndex, false)}</div>`;
    }).join("") : `<div class="index-coming-soon"><span>♡</span> Your first diary entry is waiting to be written.</div>`;
    const heading = page.querySelector(".index-content h2");
    if (heading) heading.textContent = i === 0 ? "Index" : "Index · continued";
    const intro = page.querySelector(".index-intro");
    if (intro) intro.style.display = i === 0 ? "" : "none";
    const controls = page.querySelector(".private-controls");
    if (controls && i !== 0) controls.style.display = "none";
    const top = page.querySelector(".page-top span:last-child");
    const bottom = page.querySelector(".page-bottom span:last-child");
    if (top) top.textContent = String(i + 2).padStart(2, "0");
    if (bottom) bottom.textContent = String(i + 2).padStart(2, "0");
    page.dataset.page = String(i + 2);
    readerPages.push(page);
  });

  const chapterFirstPage = new Map();
  chapters.forEach(chapter => {
    const perspective = getPerspective(chapter, DIARY_AUTHOR);
    const segments = paginateDiaryText(perspective?.content || "");
    chapterFirstPage.set(chapter.id, readerPages.length);
    segments.forEach((segment, segmentIndex) => {
      const page = createStoryPage(chapter, readerPages.length + 1, segmentIndex, segments);
      container.appendChild(page);
      readerPages.push(page);
    });
  });

  // Refresh printed index page references after the final page count is known.
  document.querySelectorAll(".index-entry, .overlay-entry").forEach(button => {
    const targetPage = chapterFirstPage.get(button.dataset.target);
    const number = button.querySelector(".index-page-number, .overlay-entry-page");
    if (number && targetPage !== undefined) number.textContent = String(targetPage + 2).padStart(2, "0");
  });

  bindStoryControls();
  buildIndex(chapterFirstPage, indexPages.length);
  showPage(Math.min(currentPage, readerPages.length - 1), false);
}

function makeIndexEntry(chapter, index, overlay = false, pageNumber = null) {
  const entryClass = overlay ? "overlay-entry" : "index-entry";
  const numberClass = overlay ? "overlay-entry-number" : "index-number";
  const textClass = overlay ? "overlay-entry-text" : "index-entry-text";
  const pageClass = overlay ? "overlay-entry-page" : "index-page-number";
  const number = String(index + 1).padStart(2, "0");
  const shownPage = pageNumber == null ? index + 3 : pageNumber + 2;
  return `<button class="${entryClass}" data-target="${escapeHtml(chapter.id)}">
    <span class="${numberClass}">${number}</span><span class="${textClass}"><strong>${escapeHtml(chapter.title)}</strong></span><span class="${pageClass}">${String(shownPage).padStart(2, "0")}</span>
  </button>`;
}

function buildIndex(chapterFirstPage = new Map(), indexPageCount = 1) {
  const chaptersForOverlay = chapters.map((c, i) => makeIndexEntry(c, i, true, chapterFirstPage.get(c.id) ?? (indexPageCount + i)));
  $("overlayIndexList").innerHTML = chapters.length ? chaptersForOverlay.map(entry => `<div class="overlay-entry-wrapper">${entry}</div>`).join("") : `<div class="index-coming-soon"><span>♡</span> Your first diary entry is waiting to be written.</div>`;
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
  const editors = Array.from(document.querySelectorAll(`.diary-ruled-content[data-chapter-id="${CSS.escape(button.dataset.chapterId)}"]`))
    .sort((a, b) => Number(a.dataset.segmentIndex) - Number(b.dataset.segmentIndex));
  if (!chapter || !editors.length) return;

  const content = editors.map(textFromEditor).filter(Boolean).join("\n\n");
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
  const index = readerPages.findIndex(page => page.dataset.chapterId === chapterId && page.dataset.segmentIndex === "0");
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

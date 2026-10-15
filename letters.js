(function () {
  "use strict";

  const supabaseClient = window.appSupabaseClient;
  const ORIGINAL_RECOVERED_LETTER_ID = "6";
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });

  let currentUser = null;
  let currentPerson = "";
  let recipientPerson = "";
  let editingUnlocked = false;
  let editingLetterId = null;
  let saving = false;
  let letters = [];

  const collection = document.getElementById("lettersCollection");
  const collectionCount = document.getElementById("collectionCount");
  const editToggle = document.getElementById("editToggle");
  const addButton = document.getElementById("addLetterButton");
  const formPanel = document.getElementById("letterFormPanel");
  const form = document.getElementById("letterForm");
  const formHeading = document.getElementById("formHeading");
  const saveButton = document.getElementById("saveLetterButton");
  const pageNotice = document.getElementById("pageNotice");
  const reader = document.getElementById("letterReader");

  const titleInput = document.getElementById("titleInput");
  const recipientInput = document.getElementById("recipientInput");
  const contentInput = document.getElementById("contentInput");
  const signatureInput = document.getElementById("signatureInput");

  function setNotice(message, kind) {
    pageNotice.textContent = message || "";
    pageNotice.classList.toggle("is-error", kind === "error");
    pageNotice.classList.toggle("is-success", kind === "success");
    pageNotice.hidden = !message;
  }

  function personFromEmail(email) {
    const normalized = String(email || "").toLowerCase();
    if (normalized.includes("aaru")) return "Aaru";
    if (normalized.includes("soham")) return "Somo";
    return "";
  }

  async function loadCurrentUser() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
      console.warn("[letters] Could not read current user:", error.message);
      return;
    }
    currentUser = data && data.user ? data.user : null;
    currentPerson = personFromEmail(currentUser && currentUser.email);
    recipientPerson = currentPerson === "Aaru" ? "Somo" : currentPerson === "Somo" ? "Aaru" : "";
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeButton(text, className, action, id) {
    const button = makeElement("button", className, text);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = String(id);
    return button;
  }

  function senderFor(letter) {
    if (letter.sender) return letter.sender;
    if (letter.recipient === "Aaru") return "Somo";
    if (letter.recipient === "Somo") return "Aaru";
    return "Sender unavailable";
  }

  function dateAddedLabel(letter) {
    // This is the original static keepsake restored to Supabase on 15 October 2026.
    // Its database timestamp is the recovery time, not the date it first entered the collection.
    if (String(letter.id) === ORIGINAL_RECOVERED_LETTER_ID) return "Date unavailable";
    if (!letter.created_at) return "Date unavailable";
    const date = new Date(letter.created_at);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return "Added " + dateFormatter.format(date);
  }

  function appendMetaRow(meta, label, value) {
    const row = makeElement("div", "letter-meta-row");
    const caption = makeElement("span", "", label);
    const text = makeElement("strong", "", value || "—");
    row.append(caption, text);
    meta.appendChild(row);
  }

  function makeCard(letter, index) {
    const original = String(letter.id) === ORIGINAL_RECOVERED_LETTER_ID;
    const card = makeElement("article", "letter-card envelope-card envelope-color-" + (index % 4) + (original ? " original-letter" : ""));
    card.style.animationDelay = Math.min(index * 35, 140) + "ms";

    const top = makeElement("div", "card-topline");
    top.appendChild(makeElement("span", "envelope-mark", "✉"));
    if (original) top.appendChild(makeElement("span", "original-badge", "Original keepsake"));
    card.appendChild(top);

    const meta = makeElement("div", "letter-meta");
    appendMetaRow(meta, "Subject", letter.title || "A little letter");
    appendMetaRow(meta, "From", senderFor(letter));
    appendMetaRow(meta, "To", letter.recipient || "Recipient unavailable");
    appendMetaRow(meta, "Date", dateAddedLabel(letter));
    card.appendChild(meta);

    const actions = makeElement("div", "card-actions");
    actions.appendChild(makeButton("Open letter  →", "open-letter-button", "open", letter.id));
    if (editingUnlocked) {
      actions.appendChild(makeButton("Edit", "small-button", "edit", letter.id));
      actions.appendChild(makeButton("Delete", "small-button delete", "delete", letter.id));
    }
    card.appendChild(actions);
    return card;
  }

  function renderLetters() {
    collection.replaceChildren();
    collectionCount.textContent = letters.length + (letters.length === 1 ? " saved letter" : " saved letters");

    if (!letters.length) {
      collection.appendChild(makeElement("p", "empty-letters", "No letters yet. Write the first one when you’re ready. ♡"));
      return;
    }

    letters.forEach(function (letter, index) {
      collection.appendChild(makeCard(letter, index));
    });
  }

  async function loadLetters() {
    if (!supabaseClient) {
      setNotice("The shared letters service is unavailable on this page.", "error");
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from("love_letters")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[letters] Could not load the collection:", error);
        setNotice("We couldn’t load the letters. Please try again in a moment.", "error");
        return;
      }

      letters = data || [];
      setNotice("", "");
      renderLetters();
    } catch (error) {
      console.error("[letters] Could not load the collection:", error);
      setNotice("We couldn’t load the letters. Please try again in a moment.", "error");
    }
  }

  function resetForm() {
    form.reset();
    titleInput.value = "";
    recipientInput.value = recipientPerson;
    contentInput.value = "";
    signatureInput.value = "";
    editingLetterId = null;
    formHeading.textContent = "Write a letter";
    saveButton.textContent = "Save letter";
  }

  function closeForm() {
    formPanel.classList.add("hidden");
    resetForm();
  }

  function openNewLetterForm() {
    resetForm();
    formHeading.textContent = "Write a letter";
    formPanel.classList.remove("hidden");
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus({ preventScroll: true });
  }

  function openEditForm(letter) {
    editingLetterId = String(letter.id);
    formHeading.textContent = "Edit this letter";
    titleInput.value = letter.title || "A little letter";
    recipientInput.value = letter.recipient || "";
    contentInput.value = letter.content || "";
    signatureInput.value = letter.signature || "";
    saveButton.textContent = "Save changes";
    formPanel.classList.remove("hidden");
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus({ preventScroll: true });
  }

  function openLetter(letter) {
    document.getElementById("readerKeepsake").classList.toggle(
      "hidden",
      String(letter.id) !== ORIGINAL_RECOVERED_LETTER_ID
    );
    document.getElementById("readerTitle").textContent = letter.title || "A little letter";
    document.getElementById("readerFrom").textContent = "From " + senderFor(letter);
    document.getElementById("readerTo").textContent = "To " + (letter.recipient || "Recipient unavailable");
    document.getElementById("readerDate").textContent = dateAddedLabel(letter);
    document.getElementById("readerContent").textContent = letter.content || "";
    document.getElementById("readerSignature").textContent = letter.signature || "";
    document.getElementById("readerReadStatus").textContent = letter.read_at ? "Read" : "Waiting to be read";
    document.body.classList.add("reader-open");
    reader.showModal();

    if (currentPerson && letter.recipient === currentPerson && !letter.read_at) {
      markAsRead(letter);
    }
  }

  async function markAsRead(letter) {
    if (!supabaseClient || !currentUser) return;
    const timestamp = new Date().toISOString();
    try {
      const { error } = await supabaseClient
        .from("love_letters")
        .update({ read_at: timestamp })
        .eq("id", letter.id);
      if (error) {
        console.warn("[letters] Could not mark the letter as read:", error.message);
        return;
      }
      letter.read_at = timestamp;
      document.getElementById("readerReadStatus").textContent = "Read";
      renderLetters();
    } catch (error) {
      console.warn("[letters] Could not mark the letter as read:", error);
    }
  }

  async function saveLetter(event) {
    event.preventDefault();
    if (saving) return;

    const title = titleInput.value;
    const recipient = recipientInput.value;
    const content = contentInput.value;
    const signature = signatureInput.value;
    if (!title.trim() || !recipient.trim() || !content.trim() || !signature.trim()) {
      setNotice("Please complete the title, recipient, letter, and signature.", "error");
      return;
    }
    if (!supabaseClient) {
      setNotice("The shared letters service is unavailable on this page.", "error");
      return;
    }

    saving = true;
    saveButton.disabled = true;
    const wasEditing = editingLetterId !== null;
    saveButton.textContent = wasEditing ? "Saving…" : "Saving…";
    setNotice("", "");

    let result;
    try {
      if (wasEditing) {
        result = await supabaseClient
          .from("love_letters")
          .update({
            title: title.trim(),
            recipient: recipient.trim(),
            content: content,
            signature: signature.trim(),
            updated_at: new Date().toISOString()
          })
          .eq("id", editingLetterId);
      } else {
        result = await supabaseClient
          .from("love_letters")
          .insert({
            title: title.trim(),
            recipient: recipient.trim(),
            content: content,
            signature: signature.trim(),
            display_order: letters.length + 1,
            sender: currentPerson || signature.trim(),
            read_at: null
          });
      }
    } catch (error) {
      result = { error: error };
    }

    saving = false;
    saveButton.disabled = false;
    if (result.error) {
      saveButton.textContent = wasEditing ? "Save changes" : "Save letter";
      console.error("[letters] Could not save the letter:", result.error);
      setNotice("We couldn’t save that letter. Your text is still here; please try again.", "error");
      return;
    }

    closeForm();
    await loadLetters();
    setNotice(wasEditing ? "Your changes are saved." : "Your letter is safely tucked away.", "success");
  }

  async function deleteLetter(id) {
    const letter = letters.find(function (item) { return String(item.id) === String(id); });
    if (!letter) return;
    if (!window.confirm("Delete “" + (letter.title || "this letter") + "”? This cannot be undone.")) return;

    let error;
    try {
      ({ error } = await supabaseClient
        .from("love_letters")
        .delete()
        .eq("id", id));
    } catch (requestError) {
      error = requestError;
    }
    if (error) {
      console.error("[letters] Could not delete the letter:", error);
      setNotice("We couldn’t delete that letter. Please try again.", "error");
      return;
    }

    await loadLetters();
    setNotice("The letter was deleted.", "success");
  }

  editToggle.addEventListener("click", function () {
    editingUnlocked = !editingUnlocked;
    editToggle.textContent = editingUnlocked ? "Lock editing" : "Edit letters";
    addButton.hidden = !editingUnlocked;
    if (!editingUnlocked) closeForm();
    renderLetters();
  });

  addButton.addEventListener("click", openNewLetterForm);
  document.getElementById("cancelLetterButton").addEventListener("click", closeForm);
  document.getElementById("closeReader").addEventListener("click", function () { reader.close(); });
  reader.addEventListener("close", function () { document.body.classList.remove("reader-open"); });
  form.addEventListener("submit", saveLetter);

  collection.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const letter = letters.find(function (item) { return String(item.id) === button.dataset.id; });
    if (!letter) return;

    if (button.dataset.action === "open") openLetter(letter);
    if (button.dataset.action === "edit") openEditForm(letter);
    if (button.dataset.action === "delete") deleteLetter(letter.id);
  });

  if (!supabaseClient) {
    setNotice("The shared letters service is unavailable on this page.", "error");
    return;
  }

  loadCurrentUser().then(loadLetters).catch(function (error) {
    console.error("[letters] Initialization failed:", error);
    setNotice("The letters couldn’t be opened. Please refresh the page and try again.", "error");
  });
})();


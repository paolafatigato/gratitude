/* ================================================
   GRATITUDE — MY JOURNAL
   script.js
   ================================================
   MODULE STRUCTURE:
   1.  FIREBASE SETUP       — init, auth, firestore, storage
   2.  CONFIG               — constants and app settings
   3.  SETTINGS SYSTEM      — manage categories via modal
   4.  STORAGE              — read/write localStorage + Firestore
   5.  DATE UTILS           — date formatting and math
   6.  STREAK & POINTS      — calculate streak and score
   7.  RENDER UI            — draw the day form
   8.  PHOTO UPLOAD         — client-side resize + Firebase Storage
   9.  CALENDAR             — mini interactive calendar
   10. AUTH UI              — login modal, auth button state
   11. EVENT LISTENERS      — wire up all DOM events
   12. INIT                 — startup sequence
   ================================================ */


/* ╔══════════════════════════════╗
   ║  1. FIREBASE SETUP           ║
   ╚══════════════════════════════╝ */

import { initializeApp }                                  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, GoogleAuthProvider, signInWithPopup }   from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection,
         getDocs }                                         from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef,
         uploadBytes, getDownloadURL }                     from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCQ1rWGNGfx1IrdRMbjUs_5I-ywDLBVBRg",
  authDomain:        "gratitude-5be80.firebaseapp.com",
  projectId:         "gratitude-5be80",
  storageBucket:     "gratitude-5be80.firebasestorage.app",
  messagingSenderId: "1062077178731",
  appId:             "1:1062077178731:web:630650fb5021694bfc622e"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);
const storage     = getStorage(firebaseApp);
const googleProvider = new GoogleAuthProvider();


/* ╔══════════════════════════════╗
   ║  2. CONFIG                   ║
   ╚══════════════════════════════╝ */

const CONFIG = {
  MIN_ENTRIES:    3,   // minimum valid entries per day
  POINTS_PER_DAY: 10, // points awarded per completed day

  // Default categories (overridden by saved settings)
  DEFAULT_CATEGORIES: [
    { label: 'School',     emoji: '📚', order: 1, active: true },
    { label: 'Love',       emoji: '❤️',  order: 2, active: true },
    { label: 'Sport',      emoji: '⚽', order: 3, active: true },
    { label: 'Friendship', emoji: '🤝', order: 4, active: true },
    { label: 'Work',       emoji: '💼', order: 5, active: true },
    { label: 'Family',     emoji: '🏡', order: 6, active: true },
    { label: 'Health',     emoji: '🌱', order: 7, active: true },
    { label: 'Other',      emoji: '✨', order: 8, active: true },
  ],

  // Emoji per happiness level 1–10
  HAPPINESS_EMOJIS: ['😞','😔','😕','😐','🙂','😊','😄','😁','🤩','🥰'],

  STORAGE_KEY:          'gratitude_data',     // localStorage key for entries
  SETTINGS_STORAGE_KEY: 'gratitudeSettings',  // localStorage key for settings

  // Max photo dimension (px) — images are resized before storing/uploading
  PHOTO_MAX_SIZE: 900,
  PHOTO_QUALITY:  0.75,
};


/* ╔══════════════════════════════╗
   ║  3. SETTINGS SYSTEM          ║
   ╚══════════════════════════════╝ */

// Live settings object — mutated by the settings UI
let settings = {
  categories: [...CONFIG.DEFAULT_CATEGORIES],
  // FUTURE: theme: '', notificationTime: '20:00', etc.
};

/** Save settings to localStorage. */
function saveSettings() {
  localStorage.setItem(CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/** Load settings from localStorage (falls back to defaults). */
function loadSettings() {
  const saved = localStorage.getItem(CONFIG.SETTINGS_STORAGE_KEY);
  if (saved) {
    try { settings = JSON.parse(saved); } catch(e) { /* keep defaults */ }
  }
}

/** Returns active categories sorted by order. */
function getActiveCategories() {
  return settings.categories
    .filter(c => c.active)
    .sort((a, b) => a.order - b.order);
}

/** Re-renders all category dropdowns after settings change. */
function updateCategoryDropdowns() {
  const active  = getActiveCategories();
  const options = ['<option value="">No category</option>',
    ...active.map(c => `<option value="${c.label}">${c.emoji} ${c.label}</option>`)
  ].join('');

  document.querySelectorAll('.entry-category').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = options;
    // Restore selection if still valid
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}

/** Build the settings modal content. */
function renderSettingsUI() {
  const container = document.getElementById('settingsUI');
  container.innerHTML = '';

  // Categories section
  const section = document.createElement('section');
  section.className = 'settings-section';
  section.innerHTML = '<h3>Categories</h3>';

  const list = document.createElement('div');
  list.className = 'settings-cat-list';

  settings.categories
    .sort((a, b) => a.order - b.order)
    .forEach((cat, idx) => {
      const row = document.createElement('div');
      row.className = 'settings-cat-row' + (cat.active ? '' : ' cat-inactive');

      // Emoji input
      const emojiIn = document.createElement('input');
      emojiIn.type = 'text'; emojiIn.value = cat.emoji;
      emojiIn.className = 'cat-emoji-input'; emojiIn.maxLength = 2;
      emojiIn.oninput = () => { cat.emoji = emojiIn.value; saveSettings(); updateCategoryDropdowns(); };

      // Label input
      const labelIn = document.createElement('input');
      labelIn.type = 'text'; labelIn.value = cat.label;
      labelIn.className = 'cat-label-input';
      labelIn.oninput = () => { cat.label = labelIn.value; saveSettings(); updateCategoryDropdowns(); };

      // Active toggle
      const toggle = document.createElement('input');
      toggle.type = 'checkbox'; toggle.checked = cat.active;
      toggle.className = 'cat-active-toggle'; toggle.title = 'Active';
      toggle.onchange = () => {
        cat.active = toggle.checked;
        saveSettings(); updateCategoryDropdowns(); renderSettingsUI();
      };

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'cat-del-btn'; delBtn.textContent = '✕'; delBtn.title = 'Delete';
      delBtn.onclick = () => {
        settings.categories.splice(idx, 1);
        saveSettings(); updateCategoryDropdowns(); renderSettingsUI();
      };

      row.append(emojiIn, labelIn, toggle, delBtn);
      list.appendChild(row);
    });

  // Add new category button
  const addBtn = document.createElement('button');
  addBtn.className = 'cat-add-btn'; addBtn.textContent = '+ Add category';
  addBtn.onclick = () => {
    settings.categories.push({
      label: '', emoji: '✦',
      order: settings.categories.length + 1,
      active: true
    });
    saveSettings(); renderSettingsUI(); updateCategoryDropdowns();
  };

  section.append(list, addBtn);
  container.appendChild(section);
}


/* ╔══════════════════════════════╗
   ║  4. STORAGE                  ║
   ╚══════════════════════════════╝ */

/** Load the full entries map from localStorage. */
function loadAllData() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) {
    console.error('localStorage read error:', e);
    return {};
  }
}

/** Persist the full entries map to localStorage. */
function saveAllData(data) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error('localStorage write error:', e);
  }
}

/**
 * Load data for one day.
 * If logged in → try Firestore first, then fall back to localStorage.
 * @param {string} dateKey  "YYYY-MM-DD"
 * @returns {Promise<Object|null>}
 */
async function loadDay(dateKey) {
  if (auth.currentUser) {
    try {
      const snap = await getDoc(
        doc(db, 'users', auth.currentUser.uid, 'entries', dateKey)
      );
      if (snap.exists()) {
        // Keep localStorage in sync so calcStats() works offline
        const data = snap.data();
        const all  = loadAllData();
        all[dateKey] = data;
        saveAllData(all);
        return data;
      }
    } catch(e) {
      console.warn('Firestore read failed, using localStorage:', e.message);
    }
  }
  // Fallback: localStorage
  return loadAllData()[dateKey] || null;
}

/**
 * Save data for one day.
 * Always writes to localStorage, and to Firestore when logged in.
 * @param {string} dateKey
 * @param {Object} dayData  { gratitudes, happiness, completed, savedAt }
 */
async function saveDay(dateKey, dayData) {
  // Always persist locally
  const all = loadAllData();
  all[dateKey] = dayData;
  saveAllData(all);

  // Sync to Firestore when signed in
  if (auth.currentUser) {
    try {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid, 'entries', dateKey),
        dayData
      );
    } catch(e) {
      console.error('Firestore write failed:', e.message);
    }
  }
}

/**
 * Pull all Firestore entries for the current user into localStorage.
 * Called once after login so stats/calendar reflect cloud data.
 */
async function syncAllFromFirestore() {
  if (!auth.currentUser) return;
  try {
    const snapshot = await getDocs(
      collection(db, 'users', auth.currentUser.uid, 'entries')
    );
    const all = loadAllData();
    snapshot.forEach(docSnap => {
      all[docSnap.id] = docSnap.data();
    });
    saveAllData(all);
    console.log(`Synced ${snapshot.size} entries from Firestore.`);
  } catch(e) {
    console.warn('Firestore sync failed:', e.message);
  }
}


/* ╔══════════════════════════════╗
   ║  5. DATE UTILS               ║
   ╚══════════════════════════════╝ */

/** Convert a JS Date to "YYYY-MM-DD" (local time). */
function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convert "YYYY-MM-DD" back to a local Date. */
function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a date for the UI. Returns { dayName, dateStr, monthYear }. */
function formatDate(date) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return {
    dayName:   days[date.getDay()],
    dateStr:   `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    monthYear: `${months[date.getMonth()]} ${date.getFullYear()}`,
  };
}

/** Add n days to a date (n can be negative). */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Today's date as "YYYY-MM-DD". */
function todayKey() { return dateToKey(new Date()); }


/* ╔══════════════════════════════╗
   ║  6. STREAK & POINTS          ║
   ╚══════════════════════════════╝ */

/**
 * Compute current streak, best streak, and total points
 * from localStorage (which is kept in sync with Firestore).
 * @returns {{ current: number, best: number, points: number }}
 */
function calcStats() {
  const all = loadAllData();

  const completed = Object.keys(all)
    .filter(k => all[k]?.completed)
    .sort(); // "YYYY-MM-DD" sorts lexicographically = chronologically

  if (completed.length === 0) return { current: 0, best: 0, points: 0 };

  const points = completed.length * CONFIG.POINTS_PER_DAY;

  let best = 1, tempStreak = 1;

  for (let i = 1; i < completed.length; i++) {
    const diff = Math.round(
      (keyToDate(completed[i]) - keyToDate(completed[i - 1])) / 86_400_000
    );
    if (diff === 1) { tempStreak++; if (tempStreak > best) best = tempStreak; }
    else            { tempStreak = 1; }
  }

  // Current streak is only alive if it includes today or yesterday
  const last = completed[completed.length - 1];
  const current = (last === todayKey() || last === dateToKey(addDays(new Date(), -1)))
    ? tempStreak : 0;

  return { current, best, points };

  /* FUTURE: check milestones here and unlock themes / badges:
     if (points >= 50)  unlockTheme('forest');
     if (current >= 7)  showBadge('week-warrior');
  */
}

/** Refresh the stats pills in the header. */
function updateStatsUI() {
  const { current, best, points } = calcStats();
  document.getElementById('streak-current').textContent = current;
  document.getElementById('streak-best').textContent    = best;
  document.getElementById('points-total').textContent   = points;
}


/* ╔══════════════════════════════╗
   ║  7. RENDER UI                ║
   ╚══════════════════════════════╝ */

/** Global app state. */
const state = {
  currentDate: new Date(), // date the user is currently viewing
};

/**
 * Build one gratitude-entry DOM element.
 * @param {number}  index     0-based index
 * @param {boolean} removable show the ✕ remove button?
 * @param {Object}  data      existing entry data { text, category, photoUrl }
 * @returns {HTMLElement}
 */
function createEntryElement(index, removable = false, data = null) {
  const div = document.createElement('div');
  div.className  = 'gratitude-entry';
  div.dataset.index = index;

  if (data?.photoUrl) div.dataset.photoUrl = data.photoUrl;

  // Build category options from live settings
  const activeCategories = getActiveCategories();
  const catOptions = [
    '<option value="">No category</option>',
    ...activeCategories.map(c =>
      `<option value="${c.label}" ${data?.category === c.label ? 'selected' : ''}>${c.emoji} ${c.label}</option>`
    )
  ].join('');

  const removeBtn = removable
    ? `<button class="btn-remove" title="Remove entry">✕</button>` : '';

  div.innerHTML = `
    <div class="entry-row">
      <span class="entry-number">${index + 1}.</span>
      <textarea
        class="entry-text"
        placeholder="I'm grateful for…"
        rows="2"
        data-index="${index}"
      >${data?.text || ''}</textarea>
      ${removeBtn}
    </div>
    <div class="entry-actions">
      <select class="entry-category" data-index="${index}">${catOptions}</select>
      <button class="btn-photo" type="button" title="Attach a photo">
        <span class="photo-icon">📷</span> Photo
      </button>
      <!-- Hidden file picker -->
      <input type="file" class="photo-file-input" accept="image/*" style="display:none;" />
    </div>
  `;

  // Show existing photo thumbnail if present
  if (data?.photoUrl) attachPhotoPreview(div, data.photoUrl);

  // Coloring: mark entry filled if it already has text
  if (data?.text?.trim()) div.classList.add('filled');

  // ── Listeners ──

  // Color entry number while typing
  div.querySelector('.entry-text').addEventListener('input', (e) => {
    div.classList.toggle('filled', e.target.value.trim().length > 0);
  });

  // Remove-entry button
  div.querySelector('.btn-remove')?.addEventListener('click', () => {
    div.remove();
    renumberEntries();
  });

  // Photo button → trigger hidden file input
  div.querySelector('.btn-photo').addEventListener('click', () => {
    div.querySelector('.photo-file-input').click();
  });

  // File selected
  div.querySelector('.photo-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePhotoSelected(div, file);
  });

  return div;
}

/** Re-number entries after one is removed. */
function renumberEntries() {
  document.querySelectorAll('.gratitude-entry').forEach((el, i) => {
    el.dataset.index = i;
    el.querySelector('.entry-number').textContent = (i + 1) + '.';
    el.querySelectorAll('[data-index]').forEach(child => { child.dataset.index = i; });
  });
}

/** Read current form data (text + category + photoUrl for each entry). */
function readFormData() {
  const entries = document.querySelectorAll('.gratitude-entry');
  const gratitudes = Array.from(entries).map(el => ({
    text:     el.querySelector('.entry-text').value.trim(),
    category: el.querySelector('.entry-category').value,
    photoUrl: el.dataset.photoUrl || '',
  }));
  const happiness = parseInt(document.getElementById('happiness-slider').value, 10);
  return { gratitudes, happiness };
}

/**
 * Load and render a day's data into the form.
 * @param {string} dateKey  "YYYY-MM-DD"
 */
async function renderDay(dateKey) {
  // Show a subtle loading state on the save button
  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;

  // ── Await data load (Firestore or localStorage) ──
  const data = await loadDay(dateKey);

  const list       = document.getElementById('gratitude-list');
  list.innerHTML   = '';

  const gratitudes = data?.gratitudes || [];
  const count      = Math.max(gratitudes.length, CONFIG.MIN_ENTRIES);

  for (let i = 0; i < count; i++) {
    const removable = i >= CONFIG.MIN_ENTRIES;
    list.appendChild(createEntryElement(i, removable, gratitudes[i] || null));
  }

  // Happiness slider
  const val = data?.happiness ?? 5;
  document.getElementById('happiness-slider').value = val;
  updateHappinessUI(val);

  // Reset save status
  document.getElementById('save-status').textContent = '';

  // Update date header
  const { dayName, dateStr } = formatDate(state.currentDate);
  document.getElementById('display-day').textContent  = dayName;
  document.getElementById('display-date').textContent = dateStr;

  // Disable "next" button when already on today
  document.getElementById('btn-next').disabled =
    dateToKey(state.currentDate) >= todayKey();

  saveBtn.disabled = false;
  updateStatsUI();
}

/** Update the happiness emoji and numeric display. */
function updateHappinessUI(value) {
  document.getElementById('happiness-value').textContent = value;
  const emojiEl = document.getElementById('happiness-emoji');
  emojiEl.textContent  = CONFIG.HAPPINESS_EMOJIS[value - 1];
  emojiEl.style.transform = 'scale(1.2)';
  setTimeout(() => { emojiEl.style.transform = ''; }, 200);
}


/* ╔══════════════════════════════╗
   ║  8. PHOTO UPLOAD             ║
   ╚══════════════════════════════╝ */

/**
 * Resize an image File using Canvas and return a Blob.
 * @param {File}   file
 * @param {number} maxSize  max width/height in px
 * @param {number} quality  JPEG quality 0–1
 * @returns {Promise<Blob>}
 */
function resizeImage(file, maxSize = CONFIG.PHOTO_MAX_SIZE, quality = CONFIG.PHOTO_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Attach a photo preview thumbnail to a gratitude-entry element.
 * Also sets entry.dataset.photoUrl.
 * @param {HTMLElement} entryEl
 * @param {string}      url      data-URL or https URL
 */
function attachPhotoPreview(entryEl, url) {
  // Remove existing preview if any
  entryEl.querySelector('.photo-preview-wrap')?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'photo-preview-wrap';

  const img = document.createElement('img');
  img.src = url; img.className = 'photo-preview'; img.alt = 'Gratitude photo';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove-photo'; removeBtn.title = 'Remove photo';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => {
    wrap.remove();
    delete entryEl.dataset.photoUrl;
  };

  wrap.append(img, removeBtn);
  // Insert after the entry-actions row
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend', wrap);
  entryEl.dataset.photoUrl = url;
}

/**
 * Handle photo file selection: resize, optionally upload, show preview.
 * @param {HTMLElement} entryEl  the .gratitude-entry
 * @param {File}        file
 */
async function handlePhotoSelected(entryEl, file) {
  // Show temporary uploading indicator
  const indicator = document.createElement('p');
  indicator.className = 'photo-uploading';
  indicator.textContent = 'Processing…';
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend', indicator);

  try {
    const resized = await resizeImage(file);

    if (auth.currentUser) {
      // ── Logged in: upload to Firebase Storage ──
      indicator.textContent = 'Uploading…';
      const dateKey   = dateToKey(state.currentDate);
      const entryIdx  = entryEl.dataset.index;
      const path      = `users/${auth.currentUser.uid}/entries/${dateKey}/${entryIdx}_${Date.now()}.jpg`;
      const fileRef   = storageRef(storage, path);

      await uploadBytes(fileRef, resized);
      const downloadURL = await getDownloadURL(fileRef);

      indicator.remove();
      attachPhotoPreview(entryEl, downloadURL);

    } else {
      // ── Logged out: store as base64 in localStorage ──
      const reader = new FileReader();
      reader.onload = (e) => {
        indicator.remove();
        attachPhotoPreview(entryEl, e.target.result);
      };
      reader.onerror = () => { indicator.remove(); };
      reader.readAsDataURL(resized);
    }
  } catch(err) {
    indicator.textContent = '⚠ Photo failed. Try a smaller image.';
    setTimeout(() => indicator.remove(), 4000);
    console.error('Photo upload error:', err);
  }
}


/* ╔══════════════════════════════╗
   ║  9. CALENDAR                 ║
   ╚══════════════════════════════╝ */

const calState = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based
};

/** Draw the mini calendar grid for calState.year/month. */
function renderCalendar() {
  const allData = loadAllData();
  const grid    = document.getElementById('cal-grid');
  const label   = document.getElementById('cal-month-label');
  grid.innerHTML = '';

  const { monthYear } = formatDate(new Date(calState.year, calState.month, 1));
  label.textContent   = monthYear;

  // Day-of-week headers (Monday-first)
  ['M','T','W','T','F','S','S'].forEach(h => {
    const el = document.createElement('div');
    el.className   = 'cal-day-header';
    el.textContent = h;
    grid.appendChild(el);
  });

  // Blank cells before day 1 (Monday = 0)
  let offset = new Date(calState.year, calState.month, 1).getDay() - 1;
  if (offset < 0) offset = 6; // Sunday becomes 6
  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calState.year, calState.month, d);
    const key  = dateToKey(date);
    const el   = document.createElement('div');
    el.className   = 'cal-day';
    el.textContent = d;

    if (key === todayKey())                   el.classList.add('today');
    if (key === dateToKey(state.currentDate)) el.classList.add('selected');
    if (allData[key]?.completed)              el.classList.add('completed');
    if (key > todayKey())                     el.style.opacity = '0.3';

    el.addEventListener('click', async () => {
      if (key > todayKey()) return;
      state.currentDate = date;
      await renderDay(key);
      renderCalendar();
      toggleCalendar(false); // close on mobile after selection
    });

    grid.appendChild(el);
  }
}

/** Open or close the calendar panel. */
function toggleCalendar(forceOpen) {
  const panel  = document.getElementById('calendar-panel');
  const toggle = document.getElementById('calendar-toggle');
  const isOpen = forceOpen !== undefined ? !forceOpen : !panel.hidden;

  panel.hidden = isOpen;
  toggle.textContent = isOpen ? '📅 Open calendar' : '📅 Close calendar';
  toggle.setAttribute('aria-expanded', String(!isOpen));

  if (!isOpen) renderCalendar(); // refresh when opening
}


/* ╔══════════════════════════════╗
   ║  10. AUTH UI                 ║
   ╚══════════════════════════════╝ */

/** Show or hide the login modal. */
function showLoginModal(visible) {
  document.getElementById('login-modal').style.display = visible ? 'flex' : 'none';
  if (visible) {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
  }
}

/** Display an error message inside the login modal. */
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent    = msg;
  el.style.display  = 'block';
}

/**
 * Update the auth button appearance based on login state.
 * @param {import('firebase/auth').User|null} user
 */
function updateAuthUI(user) {
  const icon  = document.getElementById('authIcon');
  const label = document.getElementById('authLabel');

  if (user) {
    icon.textContent  = '👤';
    label.textContent = user.displayName || user.email?.split('@')[0] || 'You';
    label.style.display = 'inline';
  } else {
    icon.textContent    = '🚪';
    label.style.display = 'none';
    label.textContent   = '';
  }
}


/* ╔══════════════════════════════╗
   ║  11. EVENT LISTENERS         ║
   ╚══════════════════════════════╝ */

function initEventListeners() {

  /* ── Date navigation ── */
  document.getElementById('btn-prev').addEventListener('click', async () => {
    state.currentDate = addDays(state.currentDate, -1);
    await renderDay(dateToKey(state.currentDate));
    renderCalendar();
  });

  document.getElementById('btn-next').addEventListener('click', async () => {
    const next = addDays(state.currentDate, 1);
    if (dateToKey(next) <= todayKey()) {
      state.currentDate = next;
      await renderDay(dateToKey(state.currentDate));
      renderCalendar();
    }
  });

  /* ── Add gratitude entry ── */
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    const list  = document.getElementById('gratitude-list');
    const count = list.querySelectorAll('.gratitude-entry').length;
    const entry = createEntryElement(count, true);
    list.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ── Happiness slider ── */
  document.getElementById('happiness-slider').addEventListener('input', (e) => {
    updateHappinessUI(parseInt(e.target.value, 10));
  });

  /* ── Save button ── */
  document.getElementById('btn-save').addEventListener('click', handleSave);

  /* ── Calendar toggle ── */
  document.getElementById('calendar-toggle').addEventListener('click', () => toggleCalendar());

  /* ── Calendar month navigation ── */
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    calState.month--;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    renderCalendar();
  });

  document.getElementById('cal-next-month').addEventListener('click', () => {
    const now = new Date();
    if (calState.year < now.getFullYear() ||
       (calState.year === now.getFullYear() && calState.month < now.getMonth())) {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    }
  });

  /* ── Settings modal ── */
  document.getElementById('settingsBtn').addEventListener('click', () => {
    renderSettingsUI();
    document.getElementById('settingsModal').style.display = 'flex';
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });

  /* ── Auth button ──
     Logged out → open login modal
     Logged in  → sign out
  ── */
  document.getElementById('authBtn').addEventListener('click', () => {
    if (auth.currentUser) {
      signOut(auth);
    } else {
      showLoginModal(true);
    }
  });

  document.getElementById('close-login-modal').addEventListener('click', () => {
    showLoginModal(false);
  });

  /* ── Google Sign-In ── */
  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showLoginModal(false);
    } catch(e) {
      showLoginError(e.message);
    }
  });

  /* ── Email Sign-In ── */
  document.getElementById('btn-email-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showLoginError('Please enter email and password.'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showLoginModal(false);
    } catch(e) {
      showLoginError('Sign-in failed: ' + e.message);
    }
  });

  /* ── Email Sign-Up ── */
  document.getElementById('btn-email-signup').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showLoginError('Please enter email and password.'); return; }
    if (password.length < 6) { showLoginError('Password must be at least 6 characters.'); return; }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showLoginModal(false);
    } catch(e) {
      showLoginError('Sign-up failed: ' + e.message);
    }
  });

  // Close modals when clicking the overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
}

/**
 * Handle the Save button click.
 * Reads the form, saves the day, shows feedback.
 */
async function handleSave() {
  const btn      = document.getElementById('btn-save');
  const statusEl = document.getElementById('save-status');
  btn.disabled   = true;

  const dateKey             = dateToKey(state.currentDate);
  const { gratitudes, happiness } = readFormData();
  const validCount = gratitudes.filter(g => g.text.length > 0).length;
  const completed  = validCount >= CONFIG.MIN_ENTRIES;

  const dayData = {
    gratitudes,
    happiness,
    completed,
    savedAt: new Date().toISOString(),
  };

  await saveDay(dateKey, dayData); // properly awaited

  // Visual feedback
  if (completed) {
    statusEl.textContent = '✓ Day saved! Great work 🌿';
    btn.classList.add('celebrate');
    setTimeout(() => btn.classList.remove('celebrate'), 500);
    /* FUTURE: trigger confetti / unlock animation here */
  } else {
    statusEl.textContent = `⚠ Partial save — ${validCount}/${CONFIG.MIN_ENTRIES} entries needed for the streak`;
  }

  setTimeout(() => { statusEl.textContent = ''; }, 3500);

  btn.disabled = false;
  updateStatsUI();
  renderCalendar();
}


/* ╔══════════════════════════════╗
   ║  12. INIT                    ║
   ╚══════════════════════════════╝ */

/**
 * Main app startup.
 * Called once — by onAuthStateChanged on first auth resolution.
 * @param {import('firebase/auth').User|null} user
 */
async function init(user) {
  loadSettings(); // load saved categories

  state.currentDate = new Date();
  initEventListeners();

  // If user is logged in, pull their entries from the cloud first
  if (user) {
    await syncAllFromFirestore();
  }

  await renderDay(dateToKey(state.currentDate));
  renderCalendar();
  updateStatsUI();

  // Hide loading overlay
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('hidden');
  // Remove from DOM after fade
  setTimeout(() => overlay.remove(), 500);

  console.log('✦ Gratitude — app started', user ? `(${user.email})` : '(guest)');
}

/* ── Auth state listener ──
   Firebase calls this immediately with the current auth state,
   then again on every sign-in / sign-out.
   This is the single entry point for app initialization.
── */
let _initialized = false;

onAuthStateChanged(auth, async (user) => {
  updateAuthUI(user);

  if (!_initialized) {
    // First call: initialize the whole app
    _initialized = true;
    await init(user);
  } else {
    // Subsequent calls (user signed in or out after app was running)
    if (user) {
      // Sync cloud data and re-render
      await syncAllFromFirestore();
    }
    await renderDay(dateToKey(state.currentDate));
    renderCalendar();
    updateStatsUI();
  }
});
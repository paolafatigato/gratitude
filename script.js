/* ================================================
   GRATITUDE — MY JOURNAL  |  script.js
   ================================================
   MODULE STRUCTURE:
   1.  FIREBASE SETUP       — app, auth, firestore, storage
   2.  CONFIG               — constants
   3.  SETTINGS SYSTEM      — categories modal
   4.  STORAGE              — localStorage + Firestore sync
   5.  DATE UTILS           — formatting helpers
   6.  STREAK & POINTS      — calcStats()
   7.  AUTO-SAVE            — debounced save on every change
   8.  RENDER UI            — renderDay(), createEntryElement()
   9.  PHOTO UPLOAD         — resize + Firebase Storage
   10. CALENDAR             — mini calendar widget
   11. STATISTICS MODAL     — full stats + charts
   12. AUTH UI              — login modal
   13. EVENT LISTENERS      — wire everything together
   14. INIT                 — startup sequence
   ================================================ */


/* ╔══════════════════════════════╗
   ║  1. FIREBASE SETUP           ║
   ╚══════════════════════════════╝ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, GoogleAuthProvider, signInWithPopup }
  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs }
  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCQ1rWGNGfx1IrdRMbjUs_5I-ywDLBVBRg",
  authDomain:        "gratitude-5be80.firebaseapp.com",
  projectId:         "gratitude-5be80",
  storageBucket:     "gratitude-5be80.firebasestorage.app",
  messagingSenderId: "1062077178731",
  appId:             "1:1062077178731:web:630650fb5021694bfc622e"
};

const firebaseApp    = initializeApp(firebaseConfig);
const auth           = getAuth(firebaseApp);
const db             = getFirestore(firebaseApp);
const storage        = getStorage(firebaseApp);
const googleProvider = new GoogleAuthProvider();


/* ╔══════════════════════════════╗
   ║  2. CONFIG                   ║
   ╚══════════════════════════════╝ */

const CONFIG = {
  MIN_ENTRIES:    3,
  POINTS_PER_DAY: 10,

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

  HAPPINESS_EMOJIS: ['😞','😔','😕','😐','🙂','😊','😄','😁','🤩','🥰'],

  STORAGE_KEY:          'gratitude_data',
  SETTINGS_STORAGE_KEY: 'gratitudeSettings',

  PHOTO_MAX_SIZE:   900,
  PHOTO_QUALITY:    0.75,
  AUTOSAVE_DELAY_MS: 1400, // ms debounce for text input
};

/** Global app state */
const state = {
  currentDate: new Date(),
};


/* ╔══════════════════════════════╗
   ║  3. SETTINGS SYSTEM          ║
   ╚══════════════════════════════╝ */

let settings = { categories: [...CONFIG.DEFAULT_CATEGORIES] };

function saveSettings() {
  localStorage.setItem(CONFIG.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
function loadSettings() {
  const s = localStorage.getItem(CONFIG.SETTINGS_STORAGE_KEY);
  if (s) { try { settings = JSON.parse(s); } catch(e) {} }
}
function getActiveCategories() {
  return settings.categories.filter(c => c.active).sort((a,b) => a.order - b.order);
}
function updateCategoryDropdowns() {
  const opts = ['<option value="">No category</option>',
    ...getActiveCategories().map(c => `<option value="${c.label}">${c.emoji} ${c.label}</option>`)
  ].join('');
  document.querySelectorAll('.entry-category').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = opts;
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}
function renderSettingsUI() {
  const container = document.getElementById('settingsUI');
  container.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'settings-section';
  section.innerHTML = '<h3>Categories</h3>';
  const list = document.createElement('div');
  list.className = 'settings-cat-list';

  settings.categories.sort((a,b) => a.order - b.order).forEach((cat, idx) => {
    const row = document.createElement('div');
    row.className = 'settings-cat-row' + (cat.active ? '' : ' cat-inactive');

    const emojiIn = document.createElement('input');
    emojiIn.type = 'text'; emojiIn.value = cat.emoji;
    emojiIn.className = 'cat-emoji-input'; emojiIn.maxLength = 2;
    emojiIn.oninput = () => { cat.emoji = emojiIn.value; saveSettings(); updateCategoryDropdowns(); };

    const labelIn = document.createElement('input');
    labelIn.type = 'text'; labelIn.value = cat.label;
    labelIn.className = 'cat-label-input';
    labelIn.oninput = () => { cat.label = labelIn.value; saveSettings(); updateCategoryDropdowns(); };

    const toggle = document.createElement('input');
    toggle.type = 'checkbox'; toggle.checked = cat.active;
    toggle.className = 'cat-active-toggle';
    toggle.onchange = () => { cat.active = toggle.checked; saveSettings(); updateCategoryDropdowns(); renderSettingsUI(); };

    const delBtn = document.createElement('button');
    delBtn.className = 'cat-del-btn'; delBtn.textContent = '✕';
    delBtn.onclick = () => { settings.categories.splice(idx, 1); saveSettings(); updateCategoryDropdowns(); renderSettingsUI(); };

    row.append(emojiIn, labelIn, toggle, delBtn);
    list.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cat-add-btn'; addBtn.textContent = '+ Add category';
  addBtn.onclick = () => {
    settings.categories.push({ label: '', emoji: '✦', order: settings.categories.length + 1, active: true });
    saveSettings(); renderSettingsUI(); updateCategoryDropdowns();
  };

  section.append(list, addBtn);
  container.appendChild(section);
}


/* ╔══════════════════════════════╗
   ║  4. STORAGE                  ║
   ╚══════════════════════════════╝ */

function loadAllData() {
  try { const r = localStorage.getItem(CONFIG.STORAGE_KEY); return r ? JSON.parse(r) : {}; }
  catch(e) { console.error('localStorage read error:', e); return {}; }
}
function saveAllData(data) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data)); }
  catch(e) { console.error('localStorage write error:', e); }
}

async function loadDay(dateKey) {
  if (auth.currentUser) {
    try {
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'entries', dateKey));
      if (snap.exists()) {
        const data = snap.data();
        const all  = loadAllData(); all[dateKey] = data; saveAllData(all);
        return data;
      }
    } catch(e) { console.warn('Firestore read failed:', e.message); }
  }
  return loadAllData()[dateKey] || null;
}

async function saveDay(dateKey, dayData) {
  const all = loadAllData(); all[dateKey] = dayData; saveAllData(all);
  if (auth.currentUser) {
    try { await setDoc(doc(db, 'users', auth.currentUser.uid, 'entries', dateKey), dayData); }
    catch(e) { console.error('Firestore write failed:', e.message); }
  }
}

async function syncAllFromFirestore() {
  if (!auth.currentUser) return;
  try {
    const snapshot = await getDocs(collection(db, 'users', auth.currentUser.uid, 'entries'));
    const all = loadAllData();
    snapshot.forEach(d => { all[d.id] = d.data(); });
    saveAllData(all);
    console.log(`Synced ${snapshot.size} entries from Firestore.`);
  } catch(e) { console.warn('Firestore sync failed:', e.message); }
}


/* ╔══════════════════════════════╗
   ║  5. DATE UTILS               ║
   ╚══════════════════════════════╝ */

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function keyToDate(key) {
  const [y,m,d] = key.split('-').map(Number); return new Date(y, m-1, d);
}
function formatDate(date) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return {
    dayName:   days[date.getDay()],
    dateStr:   `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    monthYear: `${months[date.getMonth()]} ${date.getFullYear()}`,
    monthKey:  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`, // "YYYY-MM"
    monthShort:`${months[date.getMonth()].slice(0,3)} ${date.getFullYear()}`,
  };
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function todayKey() { return dateToKey(new Date()); }


/* ╔══════════════════════════════╗
   ║  6. STREAK & POINTS          ║
   ╚══════════════════════════════╝ */

function calcStats() {
  const all = loadAllData();
  const completed = Object.keys(all).filter(k => all[k]?.completed).sort();
  if (!completed.length) return { current: 0, best: 0, points: 0 };

  const points = completed.length * CONFIG.POINTS_PER_DAY;
  let best = 1, tempStreak = 1;

  for (let i = 1; i < completed.length; i++) {
    const diff = Math.round((keyToDate(completed[i]) - keyToDate(completed[i-1])) / 86_400_000);
    if (diff === 1) { tempStreak++; if (tempStreak > best) best = tempStreak; }
    else { tempStreak = 1; }
  }

  const last = completed[completed.length - 1];
  const current = (last === todayKey() || last === dateToKey(addDays(new Date(), -1)))
    ? tempStreak : 0;

  return { current, best, points };
  /* FUTURE: check milestones — if (points>=50) unlockTheme('forest'); */
}

function updateStatsUI() {
  const { current, points } = calcStats();
  document.getElementById('streak-current').textContent = current;
  document.getElementById('points-total').textContent   = points;
}


/* ╔══════════════════════════════╗
   ║  7. AUTO-SAVE                ║
   ╚══════════════════════════════╝
   No manual save button — every change triggers
   a debounced auto-save. Immediate save on blur.
*/

let _autoSaveTimer = null;

/** Show a message in the autosave status bar. */
function setAutosaveStatus(type, msg) {
  const bar = document.getElementById('autosave-bar');
  bar.textContent = msg;
  bar.className   = `autosave-bar ${type}`;
}

/** Read current form and persist it. Called by the debounce timer. */
async function performSave() {
  const dateKey = dateToKey(state.currentDate);
  const { gratitudes, happiness } = readFormData();
  const validCount = gratitudes.filter(g => g.text.length > 0).length;
  const completed  = validCount >= CONFIG.MIN_ENTRIES;

  const dayData = { gratitudes, happiness, completed, savedAt: new Date().toISOString() };

  setAutosaveStatus('saving', 'Saving…');
  try {
    await saveDay(dateKey, dayData);
    setAutosaveStatus('saved', completed ? '✓ Saved · streak active 🔥' : `✓ Saved · ${validCount}/${CONFIG.MIN_ENTRIES} entries for streak`);
  } catch(e) {
    setAutosaveStatus('error', '⚠ Save failed — check connection');
  }

  updateStatsUI();
  renderCalendar();

  // Fade out status after 3 s
  setTimeout(() => {
    const bar = document.getElementById('autosave-bar');
    if (bar) bar.textContent = '';
  }, 3000);
}

/**
 * Schedule an auto-save after AUTOSAVE_DELAY_MS.
 * Resets the timer on every call (debounce).
 * @param {boolean} immediate  skip debounce (used on blur/change)
 */
function triggerAutoSave(immediate = false) {
  clearTimeout(_autoSaveTimer);
  if (immediate) {
    performSave();
  } else {
    _autoSaveTimer = setTimeout(performSave, CONFIG.AUTOSAVE_DELAY_MS);
  }
}


/* ╔══════════════════════════════╗
   ║  8. RENDER UI                ║
   ╚══════════════════════════════╝ */

function readFormData() {
  const gratitudes = Array.from(document.querySelectorAll('.gratitude-entry')).map(el => ({
    text:     el.querySelector('.entry-text').value.trim(),
    category: el.querySelector('.entry-category').value,
    photoUrl: el.dataset.photoUrl || '',
  }));
  const happiness = parseInt(document.getElementById('happiness-slider').value, 10);
  return { gratitudes, happiness };
}

function createEntryElement(index, removable = false, data = null) {
  const div = document.createElement('div');
  div.className = 'gratitude-entry';
  div.dataset.index = index;
  if (data?.photoUrl) div.dataset.photoUrl = data.photoUrl;

  const catOptions = [
    '<option value="">No category</option>',
    ...getActiveCategories().map(c =>
      `<option value="${c.label}" ${data?.category === c.label ? 'selected' : ''}>${c.emoji} ${c.label}</option>`
    )
  ].join('');

  const removeBtn = removable ? `<button class="btn-remove" title="Remove entry">✕</button>` : '';

  div.innerHTML = `
    <div class="entry-row">
      <span class="entry-number">${index + 1}.</span>
      <textarea class="entry-text" placeholder="I'm grateful for…" rows="2" data-index="${index}">${data?.text || ''}</textarea>
      ${removeBtn}
    </div>
    <div class="entry-actions">
      <select class="entry-category" data-index="${index}">${catOptions}</select>
      <button class="btn-photo" type="button" title="Attach a photo">
        <span class="photo-icon">📷</span> Photo
      </button>
      <input type="file" class="photo-file-input" accept="image/*" style="display:none;" />
    </div>
  `;

  if (data?.photoUrl) attachPhotoPreview(div, data.photoUrl);
  if (data?.text?.trim()) div.classList.add('filled');

  // Text: color number + debounced save
  const textarea = div.querySelector('.entry-text');
  textarea.addEventListener('input', () => {
    div.classList.toggle('filled', textarea.value.trim().length > 0);
    triggerAutoSave(false); // debounced
  });
  textarea.addEventListener('blur', () => triggerAutoSave(true)); // immediate on blur

  // Remove entry button
  div.querySelector('.btn-remove')?.addEventListener('click', () => {
    div.remove(); renumberEntries(); triggerAutoSave(true);
  });

  // Category change → immediate save
  div.querySelector('.entry-category').addEventListener('change', () => triggerAutoSave(true));

  // Photo
  div.querySelector('.btn-photo').addEventListener('click', () => div.querySelector('.photo-file-input').click());
  div.querySelector('.photo-file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) handlePhotoSelected(div, e.target.files[0]);
  });

  return div;
}

function renumberEntries() {
  document.querySelectorAll('.gratitude-entry').forEach((el, i) => {
    el.dataset.index = i;
    el.querySelector('.entry-number').textContent = (i + 1) + '.';
    el.querySelectorAll('[data-index]').forEach(c => { c.dataset.index = i; });
  });
}

async function renderDay(dateKey) {
  const data       = await loadDay(dateKey);
  const list       = document.getElementById('gratitude-list');
  list.innerHTML   = '';

  const gratitudes = data?.gratitudes || [];
  const count      = Math.max(gratitudes.length, CONFIG.MIN_ENTRIES);
  for (let i = 0; i < count; i++) {
    list.appendChild(createEntryElement(i, i >= CONFIG.MIN_ENTRIES, gratitudes[i] || null));
  }

  const val = data?.happiness ?? 5;
  document.getElementById('happiness-slider').value = val;
  updateHappinessUI(val);

  const { dayName, dateStr } = formatDate(state.currentDate);
  document.getElementById('display-day').textContent  = dayName;
  document.getElementById('display-date').textContent = dateStr;
  document.getElementById('btn-next').disabled = dateToKey(state.currentDate) >= todayKey();

  updateStatsUI();
}

function updateHappinessUI(value) {
  document.getElementById('happiness-value').textContent = value;
  const emojiEl = document.getElementById('happiness-emoji');
  emojiEl.textContent = CONFIG.HAPPINESS_EMOJIS[value - 1];
  emojiEl.style.transform = 'scale(1.2)';
  setTimeout(() => { emojiEl.style.transform = ''; }, 200);
}


/* ╔══════════════════════════════╗
   ║  9. PHOTO UPLOAD             ║
   ╚══════════════════════════════╝ */

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        const max = CONFIG.PHOTO_MAX_SIZE;
        if (w > h) { if (w > max) { h = Math.round(h*max/w); w = max; } }
        else       { if (h > max) { w = Math.round(w*max/h); h = max; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(resolve, 'image/jpeg', CONFIG.PHOTO_QUALITY);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function attachPhotoPreview(entryEl, url) {
  entryEl.querySelector('.photo-preview-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'photo-preview-wrap';
  const img = document.createElement('img');
  img.src = url; img.className = 'photo-preview'; img.alt = 'Gratitude photo';
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove-photo'; removeBtn.title = 'Remove photo'; removeBtn.textContent = '✕';
  removeBtn.onclick = () => { wrap.remove(); delete entryEl.dataset.photoUrl; triggerAutoSave(true); };
  wrap.append(img, removeBtn);
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend', wrap);
  entryEl.dataset.photoUrl = url;
}

async function handlePhotoSelected(entryEl, file) {
  const indicator = document.createElement('p');
  indicator.className = 'photo-uploading'; indicator.textContent = 'Processing…';
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend', indicator);
  try {
    const resized = await resizeImage(file);
    if (auth.currentUser) {
      indicator.textContent = 'Uploading…';
      const path    = `users/${auth.currentUser.uid}/entries/${dateToKey(state.currentDate)}/${entryEl.dataset.index}_${Date.now()}.jpg`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, resized);
      const url = await getDownloadURL(fileRef);
      indicator.remove(); attachPhotoPreview(entryEl, url); triggerAutoSave(true);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { indicator.remove(); attachPhotoPreview(entryEl, e.target.result); triggerAutoSave(true); };
      reader.onerror = () => indicator.remove();
      reader.readAsDataURL(resized);
    }
  } catch(err) {
    indicator.textContent = '⚠ Photo failed. Try a smaller image.';
    setTimeout(() => indicator.remove(), 4000);
    console.error('Photo error:', err);
  }
}


/* ╔══════════════════════════════╗
   ║  10. CALENDAR                ║
   ╚══════════════════════════════╝ */

const calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

function renderCalendar() {
  const allData = loadAllData();
  const grid    = document.getElementById('cal-grid');
  const label   = document.getElementById('cal-month-label');
  grid.innerHTML = '';

  label.textContent = formatDate(new Date(calState.year, calState.month, 1)).monthYear;
  ['M','T','W','T','F','S','S'].forEach(h => {
    const el = document.createElement('div'); el.className = 'cal-day-header'; el.textContent = h; grid.appendChild(el);
  });

  let offset = new Date(calState.year, calState.month, 1).getDay() - 1;
  if (offset < 0) offset = 6;
  for (let i = 0; i < offset; i++) { const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el); }

  const days = new Date(calState.year, calState.month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(calState.year, calState.month, d);
    const key  = dateToKey(date);
    const el   = document.createElement('div');
    el.className = 'cal-day'; el.textContent = d;
    if (key === todayKey())                   el.classList.add('today');
    if (key === dateToKey(state.currentDate)) el.classList.add('selected');
    if (allData[key]?.completed)              el.classList.add('completed');
    if (key > todayKey())                     el.style.opacity = '0.3';
    el.addEventListener('click', async () => {
      if (key > todayKey()) return;
      state.currentDate = date;
      await renderDay(key); renderCalendar(); toggleCalendar(false);
    });
    grid.appendChild(el);
  }
}

function toggleCalendar(forceOpen) {
  const panel  = document.getElementById('calendar-panel');
  const toggle = document.getElementById('calendar-toggle');
  const isOpen = forceOpen !== undefined ? !forceOpen : !panel.hidden;
  panel.hidden = isOpen;
  toggle.textContent = isOpen ? '📅 Open calendar' : '📅 Close calendar';
  toggle.setAttribute('aria-expanded', String(!isOpen));
  if (!isOpen) renderCalendar();
}


/* ╔══════════════════════════════╗
   ║  11. STATISTICS MODAL        ║
   ╚══════════════════════════════╝ */

/**
 * Main entry point — build and display the stats modal.
 */
function openStatsModal() {
  renderStatsModal('all'); // default tab: all time
  document.getElementById('statsModal').style.display = 'flex';
}

/**
 * Compute and render the full statistics modal content.
 * @param {string} catRange  'all' | '1' | '3'  (months for category filter)
 */
function renderStatsModal(catRange = 'all') {
  const all = loadAllData();
  const { current, best, points } = calcStats();

  // ── Summary cards ──
  const summaryRow = document.getElementById('stats-summary-row');
  summaryRow.innerHTML = '';
  [
    { icon: '⭐', value: points,  label: 'Total Points' },
    { icon: '🔥', value: current, label: 'Current Streak' },
    { icon: '🏆', value: best,    label: 'Best Streak' },
  ].forEach(({ icon, value, label }) => {
    summaryRow.innerHTML += `
      <div class="stats-card">
        <div class="stats-card-icon">${icon}</div>
        <div class="stats-card-value">${value}</div>
        <div class="stats-card-label">${label}</div>
      </div>`;
  });

  // ── Monthly overview (last 6 months, completed day count) ──
  const monthChart = document.getElementById('stats-monthly-chart');
  monthChart.innerHTML = '';
  const last6 = getLast6Months();
  const maxCompleted = Math.max(1, ...last6.map(m => m.completed));
  if (last6.every(m => m.completed === 0)) {
    monthChart.innerHTML = '<p class="stats-empty">No completed days yet — start your streak! 🌱</p>';
  } else {
    last6.forEach(({ label, completed, total }) => {
      const pct = Math.round((completed / maxCompleted) * 100);
      monthChart.innerHTML += `
        <div class="chart-row">
          <div class="chart-label">${label}</div>
          <div class="chart-bar-wrap">
            <div class="chart-bar" style="width:${pct}%"></div>
          </div>
          <div class="chart-count">${completed}<span style="color:var(--color-border);font-size:.7rem">/${total}</span></div>
        </div>`;
    });
  }

  // ── Category breakdown ──
  renderCategoryChart(all, catRange);

  // ── Average happiness per month ──
  const happyChart = document.getElementById('stats-happiness-chart');
  happyChart.innerHTML = '';
  const happyData = getHappinessByMonth(all, last6.map(m => m.key));
  const maxHappy  = 10;
  if (happyData.every(h => h.avg === 0)) {
    happyChart.innerHTML = '<p class="stats-empty">No happiness data yet.</p>';
  } else {
    happyData.forEach(({ label, avg }) => {
      if (avg === 0) return; // skip months with no data
      const pct = Math.round((avg / maxHappy) * 100);
      happyChart.innerHTML += `
        <div class="chart-row">
          <div class="chart-label">${label}</div>
          <div class="chart-bar-wrap">
            <div class="chart-bar happiness-bar" style="width:${pct}%"></div>
          </div>
          <div class="chart-count">${avg.toFixed(1)}</div>
        </div>`;
    });
  }

  // ── Wire up tab buttons ──
  document.querySelectorAll('.stats-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === catRange);
    btn.onclick = () => {
      document.querySelectorAll('.stats-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCategoryChart(loadAllData(), btn.dataset.range);
    };
  });
}

/**
 * Render the horizontal category bar chart inside #stats-cat-chart.
 * @param {Object} all       full data map
 * @param {string} range     'all' | '1' | '3'
 */
function renderCategoryChart(all, range) {
  const chart = document.getElementById('stats-cat-chart');
  chart.innerHTML = '';

  // Filter entries by date range
  const now       = new Date();
  const cutoffKey = range === 'all' ? '0000-00-00' :
    dateToKey(new Date(now.getFullYear(), now.getMonth() - parseInt(range) + 1, 1));

  // Count category mentions
  const counts = {};
  Object.entries(all).forEach(([key, dayData]) => {
    if (key < cutoffKey) return;
    (dayData.gratitudes || []).forEach(g => {
      if (g.category) counts[g.category] = (counts[g.category] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if (!sorted.length) {
    chart.innerHTML = '<p class="stats-empty">No category data for this period yet.</p>';
    return;
  }

  const maxCount = sorted[0][1];

  // Find emoji for a category label
  const emojiFor = (label) => {
    const cat = settings.categories.find(c => c.label === label);
    return cat ? cat.emoji : '✦';
  };

  sorted.forEach(([label, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    chart.innerHTML += `
      <div class="chart-row">
        <div class="chart-label">${emojiFor(label)} ${label}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="width:${pct}%"></div>
        </div>
        <div class="chart-count">${count}</div>
      </div>`;
  });
}

/**
 * Return an array for the last 6 calendar months.
 * Each element: { key: "YYYY-MM", label: "Jan 2025", completed: n, total: n }
 */
function getLast6Months() {
  const all    = loadAllData();
  const result = [];
  const now    = new Date();
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    // Count only up to today for current month
    const isCurrentMonth = (key === dateToKey(now).slice(0,7));
    const total = isCurrentMonth ? now.getDate() : daysInMonth;

    let completed = 0;
    for (const [entryKey, dayData] of Object.entries(all)) {
      if (entryKey.startsWith(key) && dayData.completed) completed++;
    }
    result.push({ key, label: formatDate(d).monthShort, completed, total });
  }
  return result;
}

/**
 * Return average happiness per month for given monthKeys.
 * @param {Object}   all        full data map
 * @param {string[]} monthKeys  ["YYYY-MM", …]
 */
function getHappinessByMonth(all, monthKeys) {
  return monthKeys.map(key => {
    const entries = Object.entries(all).filter(([k]) => k.startsWith(key));
    const values  = entries.map(([,d]) => d.happiness).filter(v => v != null && v > 0);
    const avg     = values.length ? values.reduce((a,b) => a+b, 0) / values.length : 0;
    return { label: formatDate(keyToDate(key + '-01')).monthShort, avg };
  });
}


/* ╔══════════════════════════════╗
   ║  12. AUTH UI                 ║
   ╚══════════════════════════════╝ */

function showLoginModal(visible) {
  document.getElementById('login-modal').style.display = visible ? 'flex' : 'none';
  if (visible) {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
  }
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
}
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
   ║  13. EVENT LISTENERS         ║
   ╚══════════════════════════════╝ */

function initEventListeners() {

  // Date navigation
  document.getElementById('btn-prev').addEventListener('click', async () => {
    state.currentDate = addDays(state.currentDate, -1);
    await renderDay(dateToKey(state.currentDate)); renderCalendar();
  });
  document.getElementById('btn-next').addEventListener('click', async () => {
    const next = addDays(state.currentDate, 1);
    if (dateToKey(next) <= todayKey()) {
      state.currentDate = next;
      await renderDay(dateToKey(state.currentDate)); renderCalendar();
    }
  });

  // Add gratitude entry
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    const list  = document.getElementById('gratitude-list');
    const count = list.querySelectorAll('.gratitude-entry').length;
    const entry = createEntryElement(count, true);
    list.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Don't auto-save yet — wait for user to type
  });

  // Happiness slider → immediate save on change
  document.getElementById('happiness-slider').addEventListener('input', (e) => {
    updateHappinessUI(parseInt(e.target.value, 10));
    triggerAutoSave(false); // debounced (user might still be dragging)
  });
  document.getElementById('happiness-slider').addEventListener('change', () => {
    triggerAutoSave(true); // immediate when they release
  });

  // Calendar
  document.getElementById('calendar-toggle').addEventListener('click', () => toggleCalendar());
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; } renderCalendar();
  });
  document.getElementById('cal-next-month').addEventListener('click', () => {
    const now = new Date();
    if (calState.year < now.getFullYear() || (calState.year === now.getFullYear() && calState.month < now.getMonth())) {
      calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; } renderCalendar();
    }
  });

  // Settings modal
  document.getElementById('settingsBtn').addEventListener('click', () => {
    renderSettingsUI(); document.getElementById('settingsModal').style.display = 'flex';
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });

  // Stats modal
  document.getElementById('statsBtn').addEventListener('click', openStatsModal);
  document.getElementById('closeStats').addEventListener('click', () => {
    document.getElementById('statsModal').style.display = 'none';
  });

  // Auth
  document.getElementById('authBtn').addEventListener('click', () => {
    if (auth.currentUser) signOut(auth); else showLoginModal(true);
  });
  document.getElementById('close-login-modal').addEventListener('click', () => showLoginModal(false));

  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try { await signInWithPopup(auth, googleProvider); showLoginModal(false); }
    catch(e) { showLoginError(e.message); }
  });
  document.getElementById('btn-email-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    if (!email || !pass) { showLoginError('Please enter email and password.'); return; }
    try { await signInWithEmailAndPassword(auth, email, pass); showLoginModal(false); }
    catch(e) { showLoginError('Sign-in failed: ' + e.message); }
  });
  document.getElementById('btn-email-signup').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    if (!email || !pass) { showLoginError('Please enter email and password.'); return; }
    if (pass.length < 6) { showLoginError('Password must be at least 6 characters.'); return; }
    try { await createUserWithEmailAndPassword(auth, email, pass); showLoginModal(false); }
    catch(e) { showLoginError('Sign-up failed: ' + e.message); }
  });

  // Close any modal when clicking the dim backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
}


/* ╔══════════════════════════════╗
   ║  14. INIT                    ║
   ╚══════════════════════════════╝ */

async function init(user) {
  loadSettings();
  state.currentDate = new Date();
  initEventListeners();

  if (user) await syncAllFromFirestore();

  await renderDay(dateToKey(state.currentDate));
  renderCalendar();
  updateStatsUI();

  // Hide loading overlay
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('hidden');
  setTimeout(() => overlay.remove(), 500);

  console.log('✦ Gratitude — started', user ? `(${user.email})` : '(guest)');
}

let _initialized = false;

onAuthStateChanged(auth, async (user) => {
  updateAuthUI(user);
  if (!_initialized) {
    _initialized = true;
    await init(user);
  } else {
    if (user) await syncAllFromFirestore();
    await renderDay(dateToKey(state.currentDate));
    renderCalendar(); updateStatsUI();
  }
});
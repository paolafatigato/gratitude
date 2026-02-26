/* ================================================
   GRATITUDE — MY JOURNAL  |  script.js
   ================================================
   1.  FIREBASE SETUP
   2.  CONFIG
   3.  SETTINGS SYSTEM
   4.  STORAGE (entries)
   5.  DATE UTILS
   6.  STREAK & POINTS
   7.  AUTO-SAVE
   8.  RENDER UI
   9.  PHOTO UPLOAD
   10. CALENDAR
   11. STATISTICS MODAL
   12. SHOP SYSTEM
   13. PROFILE MODAL      ← new
   14. EVENT LISTENERS
   15. INIT
   ================================================ */


/* ╔══════════════════════════════╗
   ║  1. FIREBASE SETUP           ║
   ╚══════════════════════════════╝ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, GoogleAuthProvider, signInWithPopup, updateProfile }
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
  MIN_ENTRIES:       3,
  POINTS_PER_DAY:    10,
  AUTOSAVE_DELAY_MS: 1400,

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
  SHOP_STORAGE_KEY:     'gratitude_shop',
  PROFILE_STORAGE_KEY:  'gratitude_profile',

  PHOTO_MAX_SIZE: 900,
  PHOTO_QUALITY:  0.75,
};

const state = { currentDate: new Date() };


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
    const prev = sel.value; sel.innerHTML = opts;
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
    emojiIn.type='text'; emojiIn.value=cat.emoji; emojiIn.className='cat-emoji-input'; emojiIn.maxLength=2;
    emojiIn.oninput = () => { cat.emoji=emojiIn.value; saveSettings(); updateCategoryDropdowns(); };
    const labelIn = document.createElement('input');
    labelIn.type='text'; labelIn.value=cat.label; labelIn.className='cat-label-input';
    labelIn.oninput = () => { cat.label=labelIn.value; saveSettings(); updateCategoryDropdowns(); };
    const toggle = document.createElement('input');
    toggle.type='checkbox'; toggle.checked=cat.active; toggle.className='cat-active-toggle';
    toggle.onchange = () => { cat.active=toggle.checked; saveSettings(); updateCategoryDropdowns(); renderSettingsUI(); };
    const delBtn = document.createElement('button');
    delBtn.className='cat-del-btn'; delBtn.textContent='✕';
    delBtn.onclick = () => { settings.categories.splice(idx,1); saveSettings(); updateCategoryDropdowns(); renderSettingsUI(); };
    row.append(emojiIn, labelIn, toggle, delBtn);
    list.appendChild(row);
  });
  const addBtn = document.createElement('button');
  addBtn.className='cat-add-btn'; addBtn.textContent='+ Add category';
  addBtn.onclick = () => {
    settings.categories.push({ label:'', emoji:'✦', order: settings.categories.length+1, active:true });
    saveSettings(); renderSettingsUI(); updateCategoryDropdowns();
  };
  section.append(list, addBtn);
  container.appendChild(section);
}


/* ╔══════════════════════════════╗
   ║  4. STORAGE (entries)        ║
   ╚══════════════════════════════╝ */

function loadAllData() {
  try { const r=localStorage.getItem(CONFIG.STORAGE_KEY); return r ? JSON.parse(r) : {}; }
  catch(e) { return {}; }
}
function saveAllData(data) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}
async function loadDay(dateKey) {
  if (auth.currentUser) {
    try {
      const snap = await getDoc(doc(db,'users',auth.currentUser.uid,'entries',dateKey));
      if (snap.exists()) {
        const data=snap.data(); const all=loadAllData(); all[dateKey]=data; saveAllData(all); return data;
      }
    } catch(e) { console.warn('Firestore read failed:', e.message); }
  }
  return loadAllData()[dateKey] || null;
}
async function saveDay(dateKey, dayData) {
  const all=loadAllData(); all[dateKey]=dayData; saveAllData(all);
  if (auth.currentUser) {
    try { await setDoc(doc(db,'users',auth.currentUser.uid,'entries',dateKey), dayData); }
    catch(e) { console.error('Firestore write failed:', e.message); }
  }
}
async function syncAllFromFirestore() {
  if (!auth.currentUser) return;
  try {
    const snapshot = await getDocs(collection(db,'users',auth.currentUser.uid,'entries'));
    const all = loadAllData();
    snapshot.forEach(d => { all[d.id]=d.data(); });
    saveAllData(all);
  } catch(e) { console.warn('Sync failed:', e.message); }
}


/* ╔══════════════════════════════╗
   ║  5. DATE UTILS               ║
   ╚══════════════════════════════╝ */

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function keyToDate(key) { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d); }
function formatDate(date) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return {
    dayName:    days[date.getDay()],
    dateStr:    `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    monthYear:  `${months[date.getMonth()]} ${date.getFullYear()}`,
    monthKey:   `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,
    monthShort: `${months[date.getMonth()].slice(0,3)} ${date.getFullYear()}`,
  };
}
function addDays(date, n) { const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function todayKey() { return dateToKey(new Date()); }


/* ╔══════════════════════════════╗
   ║  6. STREAK & POINTS          ║
   ╚══════════════════════════════╝ */

function calcStats() {
  const all = loadAllData();
  const completed = Object.keys(all).filter(k => all[k]?.completed).sort();
  if (!completed.length) return { current:0, best:0, earned:0 };
  const earned = completed.length * CONFIG.POINTS_PER_DAY;
  let best=1, temp=1;
  for (let i=1; i<completed.length; i++) {
    const diff = Math.round((keyToDate(completed[i]) - keyToDate(completed[i-1])) / 86_400_000);
    if (diff===1) { temp++; if (temp>best) best=temp; } else temp=1;
  }
  const last = completed[completed.length-1];
  const current = (last===todayKey() || last===dateToKey(addDays(new Date(),-1))) ? temp : 0;
  return { current, best, earned };
}

function getAvailablePoints() {
  const { earned } = calcStats();
  return Math.max(0, earned - getShopState().spent);
}

function updateStatsUI() {
  const { current } = calcStats();
  document.getElementById('streak-current').textContent = current;
  document.getElementById('points-total').textContent   = getAvailablePoints();
}


/* ╔══════════════════════════════╗
   ║  7. AUTO-SAVE                ║
   ╚══════════════════════════════╝ */

let _autoSaveTimer = null;

function setAutosaveStatus(type, msg) {
  const bar = document.getElementById('autosave-bar');
  if (!bar) return;
  bar.textContent = msg;
  bar.className   = `autosave-bar ${type}`;
}

async function performSave() {
  const dateKey = dateToKey(state.currentDate);
  const { gratitudes, happiness } = readFormData();
  const validCount = gratitudes.filter(g => g.text.length > 0).length;
  const completed  = validCount >= CONFIG.MIN_ENTRIES;
  setAutosaveStatus('saving', 'Saving…');
  try {
    await saveDay(dateKey, { gratitudes, happiness, completed, savedAt: new Date().toISOString() });
    setAutosaveStatus('saved', completed
      ? '✓ Saved · streak active 🔥'
      : `✓ Saved · ${validCount}/${CONFIG.MIN_ENTRIES} for streak`);
  } catch(e) {
    setAutosaveStatus('error', '⚠ Save failed — check connection');
  }
  updateStatsUI();
  renderCalendar();
  setTimeout(() => { const b=document.getElementById('autosave-bar'); if(b) b.textContent=''; }, 3000);
}

function triggerAutoSave(immediate=false) {
  clearTimeout(_autoSaveTimer);
  if (immediate) performSave();
  else _autoSaveTimer = setTimeout(performSave, CONFIG.AUTOSAVE_DELAY_MS);
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
  return { gratitudes, happiness: parseInt(document.getElementById('happiness-slider').value, 10) };
}

function createEntryElement(index, removable=false, data=null) {
  const div = document.createElement('div');
  div.className='gratitude-entry'; div.dataset.index=index;
  if (data?.photoUrl) div.dataset.photoUrl=data.photoUrl;
  const catOpts = ['<option value="">No category</option>',
    ...getActiveCategories().map(c =>
      `<option value="${c.label}" ${data?.category===c.label?'selected':''}>${c.emoji} ${c.label}</option>`)
  ].join('');
  const removeBtn = removable ? `<button class="btn-remove" title="Remove">✕</button>` : '';
  div.innerHTML = `
    <div class="entry-row">
      <span class="entry-number">${index+1}.</span>
      <textarea class="entry-text" placeholder="I'm grateful for…" rows="2" data-index="${index}">${data?.text||''}</textarea>
      ${removeBtn}
    </div>
    <div class="entry-actions">
      <select class="entry-category" data-index="${index}">${catOpts}</select>
      <button class="btn-photo" type="button">📷 Photo</button>
      <input type="file" class="photo-file-input" accept="image/*" style="display:none;" />
    </div>`;
  if (data?.photoUrl) attachPhotoPreview(div, data.photoUrl);
  if (data?.text?.trim()) div.classList.add('filled');
  const textarea = div.querySelector('.entry-text');
  textarea.addEventListener('input', () => {
    div.classList.toggle('filled', textarea.value.trim().length > 0);
    triggerAutoSave(false);
  });
  textarea.addEventListener('blur', () => triggerAutoSave(true));
  div.querySelector('.btn-remove')?.addEventListener('click', () => { div.remove(); renumberEntries(); triggerAutoSave(true); });
  div.querySelector('.entry-category').addEventListener('change', () => triggerAutoSave(true));
  div.querySelector('.btn-photo').addEventListener('click', () => div.querySelector('.photo-file-input').click());
  div.querySelector('.photo-file-input').addEventListener('change', e => {
    if (e.target.files[0]) handlePhotoSelected(div, e.target.files[0]);
  });
  return div;
}

function renumberEntries() {
  document.querySelectorAll('.gratitude-entry').forEach((el,i) => {
    el.dataset.index=i;
    el.querySelector('.entry-number').textContent=(i+1)+'.';
    el.querySelectorAll('[data-index]').forEach(c => { c.dataset.index=i; });
  });
}

async function renderDay(dateKey) {
  const data = await loadDay(dateKey);
  const list = document.getElementById('gratitude-list');
  list.innerHTML = '';
  const gratitudes = data?.gratitudes || [];
  const count = Math.max(gratitudes.length, CONFIG.MIN_ENTRIES);
  for (let i=0; i<count; i++) list.appendChild(createEntryElement(i, i>=CONFIG.MIN_ENTRIES, gratitudes[i]||null));
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
  emojiEl.textContent = CONFIG.HAPPINESS_EMOJIS[value-1];
  emojiEl.style.transform = 'scale(1.2)';
  setTimeout(() => { emojiEl.style.transform=''; }, 200);
}


/* ╔══════════════════════════════╗
   ║  9. PHOTO UPLOAD             ║
   ╚══════════════════════════════╝ */

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onerror=reject;
    reader.onload = e => {
      const img = new Image(); img.onerror=reject;
      img.onload = () => {
        let {width:w, height:h} = img; const max=CONFIG.PHOTO_MAX_SIZE;
        if (w>h) { if(w>max){h=Math.round(h*max/w);w=max;} } else { if(h>max){w=Math.round(w*max/h);h=max;} }
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(resolve,'image/jpeg',CONFIG.PHOTO_QUALITY);
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function attachPhotoPreview(entryEl, url) {
  entryEl.querySelector('.photo-preview-wrap')?.remove();
  const wrap=document.createElement('div'); wrap.className='photo-preview-wrap';
  const img=document.createElement('img'); img.src=url; img.className='photo-preview'; img.alt='Gratitude photo';
  const rmBtn=document.createElement('button'); rmBtn.className='btn-remove-photo'; rmBtn.textContent='✕';
  rmBtn.onclick=()=>{ wrap.remove(); delete entryEl.dataset.photoUrl; triggerAutoSave(true); };
  wrap.append(img,rmBtn);
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend',wrap);
  entryEl.dataset.photoUrl=url;
}

async function handlePhotoSelected(entryEl, file) {
  const ind=document.createElement('p'); ind.className='photo-uploading'; ind.textContent='Processing…';
  entryEl.querySelector('.entry-actions').insertAdjacentElement('afterend',ind);
  try {
    const resized=await resizeImage(file);
    if (auth.currentUser) {
      ind.textContent='Uploading…';
      const path=`users/${auth.currentUser.uid}/entries/${dateToKey(state.currentDate)}/${entryEl.dataset.index}_${Date.now()}.jpg`;
      const ref=storageRef(storage,path);
      await uploadBytes(ref,resized);
      const url=await getDownloadURL(ref);
      ind.remove(); attachPhotoPreview(entryEl,url); triggerAutoSave(true);
    } else {
      const reader=new FileReader();
      reader.onload=e=>{ ind.remove(); attachPhotoPreview(entryEl,e.target.result); triggerAutoSave(true); };
      reader.onerror=()=>ind.remove();
      reader.readAsDataURL(resized);
    }
  } catch(err) {
    ind.textContent='⚠ Photo failed.'; setTimeout(()=>ind.remove(),4000);
    console.error('Photo error:', err);
  }
}


/* ╔══════════════════════════════╗
   ║  10. CALENDAR                ║
   ╚══════════════════════════════╝ */

const calState = { year:new Date().getFullYear(), month:new Date().getMonth() };

function renderCalendar() {
  const allData=loadAllData();
  const grid=document.getElementById('cal-grid');
  const label=document.getElementById('cal-month-label');
  grid.innerHTML='';
  label.textContent=formatDate(new Date(calState.year,calState.month,1)).monthYear;
  ['M','T','W','T','F','S','S'].forEach(h => {
    const el=document.createElement('div'); el.className='cal-day-header'; el.textContent=h; grid.appendChild(el);
  });
  let offset=new Date(calState.year,calState.month,1).getDay()-1;
  if (offset<0) offset=6;
  for (let i=0;i<offset;i++) { const el=document.createElement('div'); el.className='cal-day empty'; grid.appendChild(el); }
  const days=new Date(calState.year,calState.month+1,0).getDate();
  for (let d=1;d<=days;d++) {
    const date=new Date(calState.year,calState.month,d); const key=dateToKey(date);
    const el=document.createElement('div'); el.className='cal-day'; el.textContent=d;
    if (key===todayKey()) el.classList.add('today');
    if (key===dateToKey(state.currentDate)) el.classList.add('selected');
    if (allData[key]?.completed) el.classList.add('completed');
    if (key>todayKey()) el.style.opacity='0.3';
    el.addEventListener('click', async () => {
      if (key>todayKey()) return;
      state.currentDate=date; await renderDay(key); renderCalendar(); toggleCalendar(false);
    });
    grid.appendChild(el);
  }
}

function toggleCalendar(forceOpen) {
  const panel=document.getElementById('calendar-panel');
  const toggle=document.getElementById('calendar-toggle');
  const isOpen=forceOpen!==undefined ? !forceOpen : !panel.hidden;
  panel.hidden=isOpen;
  toggle.textContent=isOpen?'📅 Open calendar':'📅 Close calendar';
  toggle.setAttribute('aria-expanded',String(!isOpen));
  if (!isOpen) renderCalendar();
}


/* ╔══════════════════════════════╗
   ║  11. STATISTICS MODAL        ║
   ╚══════════════════════════════╝ */

function openStatsModal() { renderStatsModal('all'); document.getElementById('statsModal').style.display='flex'; }

function renderStatsModal(catRange='all') {
  const all=loadAllData(); const { current, best, earned }=calcStats();
  const available=getAvailablePoints();
  const summaryRow=document.getElementById('stats-summary-row');
  summaryRow.innerHTML='';
  [{ icon:'⭐', value:available, label:'Points Available' },
   { icon:'🔥', value:current,   label:'Current Streak'  },
   { icon:'🏆', value:best,      label:'Best Streak'     }
  ].forEach(({ icon,value,label }) => {
    summaryRow.innerHTML+=`<div class="stats-card"><div class="stats-card-icon">${icon}</div><div class="stats-card-value">${value}</div><div class="stats-card-label">${label}</div></div>`;
  });
  const last6=getLast6Months();
  const monthChart=document.getElementById('stats-monthly-chart'); monthChart.innerHTML='';
  const maxC=Math.max(1,...last6.map(m=>m.completed));
  if (last6.every(m=>m.completed===0)) { monthChart.innerHTML='<p class="stats-empty">No completed days yet 🌱</p>'; }
  else last6.forEach(({ label,completed,total }) => {
    const pct=Math.round((completed/maxC)*100);
    monthChart.innerHTML+=`<div class="chart-row"><div class="chart-label">${label}</div><div class="chart-bar-wrap"><div class="chart-bar" style="width:${pct}%"></div></div><div class="chart-count">${completed}<span style="color:var(--color-border);font-size:.7rem">/${total}</span></div></div>`;
  });
  renderCategoryChart(all,catRange);
  const happyChart=document.getElementById('stats-happiness-chart'); happyChart.innerHTML='';
  getHappinessByMonth(all,last6.map(m=>m.key)).forEach(({ label,avg }) => {
    if (!avg) return;
    const pct=Math.round((avg/10)*100);
    happyChart.innerHTML+=`<div class="chart-row"><div class="chart-label">${label}</div><div class="chart-bar-wrap"><div class="chart-bar happiness-bar" style="width:${pct}%"></div></div><div class="chart-count">${avg.toFixed(1)}</div></div>`;
  });
  document.querySelectorAll('.stats-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range===catRange);
    btn.onclick=()=>{ document.querySelectorAll('.stats-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderCategoryChart(loadAllData(),btn.dataset.range); };
  });
}

function renderCategoryChart(all,range) {
  const chart=document.getElementById('stats-cat-chart'); chart.innerHTML='';
  const now=new Date();
  const cutoffKey=range==='all'?'0000-00-00':dateToKey(new Date(now.getFullYear(),now.getMonth()-parseInt(range)+1,1));
  const counts={};
  Object.entries(all).forEach(([key,dayData]) => {
    if (key<cutoffKey) return;
    (dayData.gratitudes||[]).forEach(g => { if(g.category) counts[g.category]=(counts[g.category]||0)+1; });
  });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if (!sorted.length) { chart.innerHTML='<p class="stats-empty">No category data for this period.</p>'; return; }
  const maxCount=sorted[0][1];
  const emojiFor=l => { const c=settings.categories.find(c=>c.label===l); return c?c.emoji:'✦'; };
  sorted.forEach(([label,count]) => {
    const pct=Math.round((count/maxCount)*100);
    chart.innerHTML+=`<div class="chart-row"><div class="chart-label">${emojiFor(label)} ${label}</div><div class="chart-bar-wrap"><div class="chart-bar" style="width:${pct}%"></div></div><div class="chart-count">${count}</div></div>`;
  });
}

function getLast6Months() {
  const all=loadAllData(); const result=[]; const now=new Date();
  for (let i=5;i>=0;i--) {
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const daysInMonth=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const isCurrent=(key===dateToKey(now).slice(0,7));
    const total=isCurrent?now.getDate():daysInMonth;
    let completed=0;
    Object.entries(all).forEach(([k,v]) => { if(k.startsWith(key)&&v.completed) completed++; });
    result.push({ key, label:formatDate(d).monthShort, completed, total });
  }
  return result;
}

function getHappinessByMonth(all,monthKeys) {
  return monthKeys.map(key => {
    const entries=Object.entries(all).filter(([k])=>k.startsWith(key));
    const values=entries.map(([,d])=>d.happiness).filter(v=>v!=null&&v>0);
    return { label:formatDate(keyToDate(key+'-01')).monthShort, avg:values.length?values.reduce((a,b)=>a+b,0)/values.length:0 };
  });
}


/* ╔══════════════════════════════════════════════════╗
   ║  12. SHOP SYSTEM                                 ║
   ╚══════════════════════════════════════════════════╝ */

/* ── CATALOG ──
   Each theme includes --color-accent-dark and --focus-ring
   so ALL interactive element colors change with the theme. */

const SHOP_CATALOG = {

  themes: [
    {
      id: 'theme_journal', name: 'Warm Cream', desc: 'The cozy default', cost: 0,
      swatches: ['#faf6f0','#c2714f','#8fad88'],
      vars: {} // default — app-overrides stays empty → style.css :root values apply
    },
    {
      id: 'theme_forest', name: 'Forest', desc: 'Deep greens & moss', cost: 30,
      swatches: ['#f0f4ee','#3a7d44','#7db87f'],
      vars: {
        '--color-bg':'#f0f4ee',       '--color-surface':'#f8fbf6',
        '--color-border':'#c5d9c0',   '--color-accent':'#3a7d44',
        '--color-accent-dark':'#2b5e33', '--color-accent-alt':'#7db87f',
        '--color-text':'#1e3320',     '--color-text-muted':'#6a8f6e',
        '--color-highlight':'#daecd8',
        '--focus-ring':'rgba(58,125,68,0.20)', '--shadow-accent':'rgba(58,125,68,0.30)',
      }
    },
    {
      id: 'theme_ocean', name: 'Ocean', desc: 'Deep blue & teal', cost: 30,
      swatches: ['#eef4f8','#2c7da0','#52b2cf'],
      vars: {
        '--color-bg':'#eef4f8',       '--color-surface':'#f5f9fc',
        '--color-border':'#b8d4e4',   '--color-accent':'#2c7da0',
        '--color-accent-dark':'#1d5f7c', '--color-accent-alt':'#52b2cf',
        '--color-text':'#132635',     '--color-text-muted':'#5a8aa4',
        '--color-highlight':'#d4e8f2',
        '--focus-ring':'rgba(44,125,160,0.20)', '--shadow-accent':'rgba(44,125,160,0.30)',
      }
    },
    {
      id: 'theme_lavender', name: 'Lavender', desc: 'Soft purples & lilac', cost: 30,
      swatches: ['#f4f0fb','#7c5cbf','#b89fe0'],
      vars: {
        '--color-bg':'#f4f0fb',       '--color-surface':'#faf8fe',
        '--color-border':'#d5c8f0',   '--color-accent':'#7c5cbf',
        '--color-accent-dark':'#5e3fa0', '--color-accent-alt':'#b89fe0',
        '--color-text':'#2a1f40',     '--color-text-muted':'#8a76b0',
        '--color-highlight':'#ece5f8',
        '--focus-ring':'rgba(124,92,191,0.20)', '--shadow-accent':'rgba(124,92,191,0.30)',
      }
    },
    {
      id: 'theme_rose', name: 'Rosé', desc: 'Blush & warm pinks', cost: 40,
      swatches: ['#fdf0f2','#c25c7a','#e8a0b2'],
      vars: {
        '--color-bg':'#fdf0f2',       '--color-surface':'#fff6f8',
        '--color-border':'#f0c8d4',   '--color-accent':'#c25c7a',
        '--color-accent-dark':'#9e3d5a', '--color-accent-alt':'#e8a0b2',
        '--color-text':'#3a1824',     '--color-text-muted':'#a06878',
        '--color-highlight':'#fbe0e8',
        '--focus-ring':'rgba(194,92,122,0.20)', '--shadow-accent':'rgba(194,92,122,0.30)',
      }
    },
    {
      id: 'theme_sunset', name: 'Sunset', desc: 'Golden hour vibes', cost: 40,
      swatches: ['#fdf5e8','#c47c2b','#e8b46a'],
      vars: {
        '--color-bg':'#fdf5e8',       '--color-surface':'#fffbf2',
        '--color-border':'#f0d8a8',   '--color-accent':'#c47c2b',
        '--color-accent-dark':'#9e5f18', '--color-accent-alt':'#e8b46a',
        '--color-text':'#3a2808',     '--color-text-muted':'#a08040',
        '--color-highlight':'#faefd0',
        '--focus-ring':'rgba(196,124,43,0.20)', '--shadow-accent':'rgba(196,124,43,0.30)',
      }
    },
    {
      id: 'theme_dark', name: 'Night Mode', desc: 'Dark & elegant', cost: 50,
      swatches: ['#1a1612','#c2714f','#8fad88'],
      vars: {
        '--color-bg':'#1a1612',       '--color-surface':'#231e19',
        '--color-border':'#3d3028',   '--color-accent':'#c2714f',
        '--color-accent-dark':'#a05038', '--color-accent-alt':'#8fad88',
        '--color-text':'#f0e8dc',     '--color-text-muted':'#8a7060',
        '--color-highlight':'#2e241e',
        '--focus-ring':'rgba(194,113,79,0.25)', '--shadow-accent':'rgba(194,113,79,0.35)',
        '--shadow-base':'rgba(0,0,0,0.25)', '--shadow-base-md':'rgba(0,0,0,0.35)', '--shadow-base-lg':'rgba(0,0,0,0.45)',
      }
    },
  ],

  fonts: [
    {
      id: 'font_journal', name: 'Journal', desc: 'Handwritten & warm', cost: 0,
      preview: 'Aa', previewStyle: "font-family:'Caveat',cursive",
      vars: { '--font-display':"'Caveat', cursive", '--font-body':"'Lora', Georgia, serif" }
    },
    {
      id: 'font_elegant', name: 'Elegant', desc: 'Timeless & refined', cost: 25,
      preview: 'Aa', previewStyle: "font-family:'Playfair Display',serif",
      vars: { '--font-display':"'Playfair Display', serif", '--font-body':"'Cormorant Garamond', Georgia, serif" }
    },
    {
      id: 'font_modern', name: 'Modern', desc: 'Clean & minimal', cost: 25,
      preview: 'Aa', previewStyle: "font-family:'Syne',sans-serif",
      vars: { '--font-display':"'Syne', sans-serif", '--font-body':"'DM Sans', system-ui, sans-serif" }
    },
    {
      id: 'font_dreamy', name: 'Dreamy', desc: 'Playful & soft', cost: 25,
      preview: 'Aa', previewStyle: "font-family:'Pacifico',cursive",
      vars: { '--font-display':"'Pacifico', cursive", '--font-body':"'Nunito', system-ui, sans-serif" }
    },
  ],

  avatars: [
    /* Free default — the "personcina" */
    { id:'av_person',    emoji:'👤', name:'Me',         desc:'The default you',  cost:0  },
    /* Purchasable */
    { id:'av_sprout',    emoji:'🌱', name:'Sprout',     desc:'First steps',      cost:10 },
    { id:'av_sun',       emoji:'☀️',  name:'Sunshine',   desc:'Bright days',      cost:20 },
    { id:'av_moon',      emoji:'🌙', name:'Moonchild',  desc:'Quiet & reflective',cost:20 },
    { id:'av_star',      emoji:'⭐', name:'Stardust',   desc:'You shine!',        cost:20 },
    { id:'av_butterfly', emoji:'🦋', name:'Butterfly',  desc:'Growth & change',   cost:20 },
    { id:'av_cat',       emoji:'🐱', name:'Kitty',      desc:'Cozy & curious',    cost:30 },
    { id:'av_fox',       emoji:'🦊', name:'Fox',        desc:'Clever & warm',     cost:30 },
    { id:'av_owl',       emoji:'🦉', name:'Owl',        desc:'Wise & patient',    cost:30 },
    { id:'av_bear',      emoji:'🐻', name:'Bear',       desc:'Gentle & strong',   cost:30 },
    { id:'av_dragon',    emoji:'🐉', name:'Dragon',     desc:'Legendary power',   cost:50 },
    { id:'av_unicorn',   emoji:'🦄', name:'Unicorn',    desc:'Pure magic',        cost:50 },
    { id:'av_phoenix',   emoji:'🦅', name:'Phoenix',    desc:'Rise every day',    cost:50 },
  ],
};

/* ── SHOP STATE ── */

function getDefaultShopState() {
  return {
    owned:  ['theme_journal','font_journal','av_person'],
    active: { theme:'theme_journal', font:'font_journal', avatar:'av_person' },
    spent:  0,
  };
}

function getShopState() {
  try {
    const raw = localStorage.getItem(CONFIG.SHOP_STORAGE_KEY);
    if (!raw) return getDefaultShopState();
    const saved = JSON.parse(raw);
    const merged = { ...getDefaultShopState(), ...saved };
    // Always own the free items
    ['theme_journal','font_journal','av_person'].forEach(id => {
      if (!merged.owned.includes(id)) merged.owned.push(id);
    });
    return merged;
  } catch(e) { return getDefaultShopState(); }
}

function saveShopState(shopState) {
  localStorage.setItem(CONFIG.SHOP_STORAGE_KEY, JSON.stringify(shopState));
  if (auth.currentUser) {
    setDoc(doc(db,'users',auth.currentUser.uid,'shop','state'), shopState)
      .catch(e => console.warn('Shop sync failed:', e.message));
  }
}

async function syncShopFromFirestore() {
  if (!auth.currentUser) return;
  try {
    const snap = await getDoc(doc(db,'users',auth.currentUser.uid,'shop','state'));
    if (snap.exists()) {
      const cloud = snap.data();
      const merged = { ...getDefaultShopState(), ...cloud };
      ['theme_journal','font_journal','av_person'].forEach(id => {
        if (!merged.owned.includes(id)) merged.owned.push(id);
      });
      localStorage.setItem(CONFIG.SHOP_STORAGE_KEY, JSON.stringify(merged));
    }
  } catch(e) { console.warn('Shop cloud sync failed:', e.message); }
}

/* ── APPLY ACTIVE ITEMS ──
   Injects CSS variable overrides into #app-overrides (which lives
   AFTER style.css in <head>) and updates every avatar display. */

function applyActiveItems() {
  const { active } = getShopState();
  const theme  = SHOP_CATALOG.themes.find(t => t.id===active.theme)  || SHOP_CATALOG.themes[0];
  const font   = SHOP_CATALOG.fonts.find(f  => f.id===active.font)   || SHOP_CATALOG.fonts[0];
  const avatar = SHOP_CATALOG.avatars.find(a => a.id===active.avatar) || SHOP_CATALOG.avatars[0];

  // Merge theme + font vars and inject into :root override
  const vars = { ...theme.vars, ...font.vars };
  const entries = Object.entries(vars);
  const cssText = entries.length
    ? `:root {\n${entries.map(([k,v]) => `  ${k}: ${v};`).join('\n')}\n}`
    : '';
  document.getElementById('app-overrides').textContent = cssText;

  // Update every place the avatar is shown
  refreshAvatarDisplays(avatar.emoji);
}

/** Update all avatar display elements on the page. */
function refreshAvatarDisplays(emoji) {
  const ids = ['header-avatar-emoji','shop-avatar-big','profile-avatar-display'];
  ids.forEach(id => { const el=document.getElementById(id); if(el) el.textContent=emoji; });
}

/* ── BUY / EQUIP ── */

function buyItem(itemId) {
  const shopState = getShopState();
  if (shopState.owned.includes(itemId)) return false;
  const item = findItemById(itemId);
  if (!item) return false;
  if (getAvailablePoints() < item.cost) return false;
  shopState.owned.push(itemId);
  shopState.spent += item.cost;
  saveShopState(shopState);
  updateStatsUI();
  return true;
}

function equipItem(itemId) {
  const shopState = getShopState();
  if (!shopState.owned.includes(itemId)) return;
  const item = findItemById(itemId);
  if (!item) return;
  shopState.active[item._type] = itemId;
  saveShopState(shopState);
  applyActiveItems();
}

function findItemById(id) {
  for (const [type, list] of Object.entries(SHOP_CATALOG)) {
    const singular = type.replace(/s$/,'');
    const item = list.find(i => i.id===id);
    if (item) return { ...item, _type: singular };
  }
  return null;
}

/* ── SHOP MODAL ── */

let _shopActiveTab = 'themes';

function openShopModal(startTab) {
  renderShopTab(startTab || _shopActiveTab);
  document.getElementById('shopModal').style.display='flex';
}

function renderShopTab(tab) {
  _shopActiveTab = tab;
  const shopState = getShopState();
  const available = getAvailablePoints();
  const { earned } = calcStats();

  const pd=document.getElementById('shop-points-display');
  const ed=document.getElementById('shop-earned-display');
  if(pd) pd.textContent=available;
  if(ed) ed.textContent=earned;

  const bigAv = SHOP_CATALOG.avatars.find(a => a.id===shopState.active.avatar);
  const bigEl = document.getElementById('shop-avatar-big');
  if(bigEl && bigAv) bigEl.textContent=bigAv.emoji;

  document.querySelectorAll('.shop-tab').forEach(btn => btn.classList.toggle('active',btn.dataset.tab===tab));

  const content=document.getElementById('shop-content');
  content.innerHTML='';
  const items=SHOP_CATALOG[tab];
  const singular=tab.replace(/s$/,'');

  items.forEach(item => {
    const owned     = shopState.owned.includes(item.id);
    const active    = shopState.active[singular]===item.id;
    const canAfford = available >= item.cost;

    const card=document.createElement('div');
    card.className=`shop-card${active?' shop-card--active':owned?' shop-card--owned':!canAfford?' shop-card--locked':''}`;

    let previewHTML='';
    if (tab==='themes') {
      const sw=item.swatches.map(c=>`<span class="theme-swatch" style="background:${c}"></span>`).join('');
      previewHTML=`<div class="shop-preview--theme">${sw}</div>`;
    } else if (tab==='fonts') {
      previewHTML=`<div class="shop-preview--font" style="${item.previewStyle}">${item.preview}</div>`;
    } else {
      previewHTML=`<div class="shop-preview--avatar">${item.emoji}</div>`;
    }

    const costLabel = item.cost===0 ? 'Free' : `${item.cost} ⭐`;
    let actionHTML='';
    if (active)       actionHTML=`<div class="shop-badge-active">✓ Equipped</div>`;
    else if (owned)   actionHTML=`<button class="shop-btn shop-btn--equip" data-action="equip" data-id="${item.id}">Equip</button>`;
    else if (canAfford) actionHTML=`<button class="shop-btn shop-btn--buy" data-action="buy" data-id="${item.id}">Buy · ${costLabel}</button>`;
    else              actionHTML=`<button class="shop-btn shop-btn--locked" disabled>Need ${item.cost} ⭐</button>`;

    card.innerHTML=`${previewHTML}<div class="shop-card-name">${item.name}</div><div class="shop-card-sub">${item.desc}</div>${actionHTML}`;

    card.querySelector('[data-action]')?.addEventListener('click', e => {
      const { action, id } = e.currentTarget.dataset;
      if (action==='buy') {
        if (buyItem(id)) { card.classList.add('just-bought'); setTimeout(()=>renderShopTab(_shopActiveTab),400); }
      } else if (action==='equip') {
        equipItem(id); renderShopTab(_shopActiveTab);
      }
    });

    content.appendChild(card);
  });
}


/* ╔══════════════════════════════════════════════════╗
   ║  13. PROFILE MODAL                               ║
   ╚══════════════════════════════════════════════════╝
   Opened by clicking the avatar button in the header.
   Shows: big avatar, editable display name, email,
   logout / login button, shortcut to shop.
*/

const PROFILE_KEY = CONFIG.PROFILE_STORAGE_KEY;

/** Load display name from localStorage (fallback: Firebase displayName or empty). */
function getDisplayName() {
  const local = localStorage.getItem(PROFILE_KEY);
  if (local) return local;
  return auth.currentUser?.displayName || '';
}

/** Persist display name locally and to Firebase Auth + Firestore. */
async function saveDisplayName(name) {
  localStorage.setItem(PROFILE_KEY, name);
  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      await setDoc(doc(db,'users',auth.currentUser.uid,'profile','data'), { displayName: name }, { merge:true });
    } catch(e) { console.warn('Display name sync failed:', e.message); }
  }
}

function openProfileModal() {
  const shopState = getShopState();
  const avatar    = SHOP_CATALOG.avatars.find(a => a.id===shopState.active.avatar) || SHOP_CATALOG.avatars[0];
  const user      = auth.currentUser;
  const name      = getDisplayName();

  // Big avatar
  const bigEl=document.getElementById('profile-avatar-display');
  if(bigEl) { bigEl.textContent=avatar.emoji; }

  // Name input
  const nameInput=document.getElementById('profile-name-input');
  if(nameInput) { nameInput.value=name; }

  // Toast reset
  const toast=document.getElementById('profile-name-saved-toast');
  if(toast) toast.textContent='';

  // Email
  const emailEl=document.getElementById('profile-email');
  if(emailEl) {
    if (user?.email) { emailEl.textContent=user.email; emailEl.style.display='block'; }
    else             { emailEl.style.display='none'; }
  }

  // Actions
  const actionsIn  =document.getElementById('profile-actions-loggedin');
  const actionsOut =document.getElementById('profile-actions-loggedout');
  if(actionsIn)  actionsIn.style.display  = user ? 'block' : 'none';
  if(actionsOut) actionsOut.style.display = user ? 'none'  : 'block';

  document.getElementById('profileModal').style.display='flex';
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display='none';
}


/* ╔══════════════════════════════╗
   ║  14. EVENT LISTENERS         ║
   ╚══════════════════════════════╝ */

function initEventListeners() {

  // Date navigation
  document.getElementById('btn-prev').addEventListener('click', async () => {
    state.currentDate=addDays(state.currentDate,-1);
    await renderDay(dateToKey(state.currentDate)); renderCalendar();
  });
  document.getElementById('btn-next').addEventListener('click', async () => {
    const next=addDays(state.currentDate,1);
    if (dateToKey(next)<=todayKey()) {
      state.currentDate=next; await renderDay(dateToKey(state.currentDate)); renderCalendar();
    }
  });

  // Add entry
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    const list=document.getElementById('gratitude-list');
    const entry=createEntryElement(list.querySelectorAll('.gratitude-entry').length, true);
    list.appendChild(entry); entry.scrollIntoView({ behavior:'smooth', block:'nearest' });
  });

  // Happiness slider
  document.getElementById('happiness-slider').addEventListener('input', e => {
    updateHappinessUI(parseInt(e.target.value,10)); triggerAutoSave(false);
  });
  document.getElementById('happiness-slider').addEventListener('change', () => triggerAutoSave(true));

  // Calendar
  document.getElementById('calendar-toggle').addEventListener('click', () => toggleCalendar());
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    calState.month--; if(calState.month<0){calState.month=11;calState.year--;} renderCalendar();
  });
  document.getElementById('cal-next-month').addEventListener('click', () => {
    const now=new Date();
    if (calState.year<now.getFullYear()||(calState.year===now.getFullYear()&&calState.month<now.getMonth())) {
      calState.month++; if(calState.month>11){calState.month=0;calState.year++;} renderCalendar();
    }
  });

  // Stats
  document.getElementById('statsBtn').addEventListener('click', openStatsModal);
  document.getElementById('closeStats').addEventListener('click', () => document.getElementById('statsModal').style.display='none');

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    renderSettingsUI(); document.getElementById('settingsModal').style.display='flex';
  });
  document.getElementById('closeSettings').addEventListener('click', () => document.getElementById('settingsModal').style.display='none');

  // Shop — points pill
  document.getElementById('points-pill').addEventListener('click', () => openShopModal('themes'));
  document.getElementById('closeShop').addEventListener('click', () => document.getElementById('shopModal').style.display='none');
  document.querySelectorAll('.shop-tab').forEach(btn => btn.addEventListener('click', () => renderShopTab(btn.dataset.tab)));

  // ── Avatar button → Profile modal ──
  document.getElementById('avatarBtn').addEventListener('click', openProfileModal);
  document.getElementById('closeProfile').addEventListener('click', closeProfileModal);

  // Profile: save name
  const nameInput=document.getElementById('profile-name-input');
  const nameSave =document.getElementById('profile-name-save');
  const toast    =document.getElementById('profile-name-saved-toast');

  nameSave.addEventListener('click', async () => {
    const name=nameInput.value.trim();
    await saveDisplayName(name);
    if(toast) { toast.textContent='✓ Name saved!'; setTimeout(()=>{ if(toast) toast.textContent=''; },2500); }
    nameSave.style.opacity='0';
  });
  nameInput.addEventListener('input', () => { if(nameSave) nameSave.style.opacity='1'; });
  nameInput.addEventListener('keydown', e => { if(e.key==='Enter') { e.preventDefault(); nameSave.click(); } });

  // Profile: logout
  document.getElementById('profile-logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    closeProfileModal();
  });

  // Profile: sign in → open login modal
  document.getElementById('profile-signin-btn').addEventListener('click', () => {
    closeProfileModal(); showLoginModal(true);
  });

  // Profile: go to shop avatars tab
  document.getElementById('profile-goto-shop').addEventListener('click', () => {
    closeProfileModal(); openShopModal('avatars');
  });

  // Login modal
  document.getElementById('close-login-modal').addEventListener('click', () => showLoginModal(false));
  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try { await signInWithPopup(auth,googleProvider); showLoginModal(false); }
    catch(e) { showLoginError(e.message); }
  });
  document.getElementById('btn-email-login').addEventListener('click', async () => {
    const email=document.getElementById('login-email').value.trim();
    const pass=document.getElementById('login-password').value;
    if (!email||!pass) { showLoginError('Please enter email and password.'); return; }
    try { await signInWithEmailAndPassword(auth,email,pass); showLoginModal(false); }
    catch(e) { showLoginError('Sign-in failed: '+e.message); }
  });
  document.getElementById('btn-email-signup').addEventListener('click', async () => {
    const email=document.getElementById('login-email').value.trim();
    const pass=document.getElementById('login-password').value;
    if (!email||!pass) { showLoginError('Please enter email and password.'); return; }
    if (pass.length<6) { showLoginError('Password must be at least 6 characters.'); return; }
    try { await createUserWithEmailAndPassword(auth,email,pass); showLoginModal(false); }
    catch(e) { showLoginError('Sign-up failed: '+e.message); }
  });

  // Close any modal by clicking the dim backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.style.display='none'; });
  });
}

/* ── LOGIN MODAL HELPERS ── */
function showLoginModal(visible) {
  document.getElementById('login-modal').style.display=visible?'flex':'none';
  if (visible) {
    document.getElementById('login-error').style.display='none';
    document.getElementById('login-email').value='';
    document.getElementById('login-password').value='';
  }
}
function showLoginError(msg) {
  const el=document.getElementById('login-error'); el.textContent=msg; el.style.display='block';
}


/* ╔══════════════════════════════╗
   ║  15. INIT                    ║
   ╚══════════════════════════════╝ */

async function init(user) {
  loadSettings();
  state.currentDate = new Date();
  initEventListeners();

  if (user) {
    await syncAllFromFirestore();
    await syncShopFromFirestore();
    // Try to load saved display name from Firestore
    try {
      const snap=await getDoc(doc(db,'users',user.uid,'profile','data'));
      if (snap.exists() && snap.data().displayName) {
        localStorage.setItem(PROFILE_KEY, snap.data().displayName);
      }
    } catch(e) {}
  }

  // Apply theme/font/avatar immediately (before first render)
  applyActiveItems();

  await renderDay(dateToKey(state.currentDate));
  renderCalendar();
  updateStatsUI();

  const overlay=document.getElementById('loading-overlay');
  overlay.classList.add('hidden');
  setTimeout(()=>overlay.remove(), 500);

  console.log('✦ Gratitude — started', user ? `(${user.email})` : '(guest)');
}

let _initialized = false;

onAuthStateChanged(auth, async user => {
  if (!_initialized) {
    _initialized = true;
    await init(user);
  } else {
    if (user) { await syncAllFromFirestore(); await syncShopFromFirestore(); }
    applyActiveItems();
    await renderDay(dateToKey(state.currentDate));
    renderCalendar(); updateStatsUI();
  }
});
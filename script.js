// UI handlers for login/logout
window.loginHandler = function() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  login(email, password);
};

window.logoutHandler = function() {
  logout();
};

// Show/hide login and logout UI based on auth state
onAuthStateChanged(auth, (user) => {
  const loginContainer = document.getElementById('login-container');
  const logoutBtn = document.getElementById('logout-btn');
  if (user) {
    loginContainer.style.display = 'none';
    logoutBtn.style.display = 'block';
    // Show app UI
  } else {
    loginContainer.style.display = 'block';
    logoutBtn.style.display = 'none';
    // Hide app UI
  }
});
/* ================================================
   GRATITUDINE — DIARIO DELLA GRATITUDINE
   script.js
   ================================================
   STRUTTURA MODULI:
   1. CONFIG           — costanti e impostazioni globali
   2. STORAGE          — lettura/scrittura dati
   3. DATE UTILS       — gestione e formattazione date
   4. STREAK & PUNTI   — calcolo streak e punteggio
   5. RENDER UI        — disegno interfaccia
   6. CALENDARIO       — mini calendario interattivo
   7. EVENT LISTENERS  — collegamento eventi
   8. INIT             — avvio app
   ================================================ */

// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQ1rWGNGfx1IrdRMbjUs_5I-ywDLBVBRg",
  authDomain: "gratitude-5be80.firebaseapp.com",
  projectId: "gratitude-5be80",
  storageBucket: "gratitude-5be80.firebasestorage.app",
  messagingSenderId: "1062077178731",
  appId: "1:1062077178731:web:630650fb5021694bfc622e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login function
async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful!");
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

// Logout function
function logout() {
  signOut(auth);
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in, load their data
    const userDoc = doc(db, "users", user.uid);
    const userData = await getDoc(userDoc);
    if (userData.exists()) {
      // Use userData.data() to populate app
      console.log("User data:", userData.data());
    } else {
      // Create empty user data
      await setDoc(userDoc, { entries: [] });
    }
    // Show app UI
  } else {
    // Show login UI
    console.log("User not logged in");
  }
});


/* ╔══════════════════════════════╗
   ║  1. CONFIG                   ║
   ╚══════════════════════════════╝ */

const CONFIG = {
  MIN_ENTRIES:    3,     // voci minime per giornata valida
  POINTS_PER_DAY: 10,   // punti per ogni giornata valida

  // Categorie disponibili nelle dropdown
  CATEGORIES: [
    { value: '',          label: 'No category' },
    { value: 'scuola',    label: '📚 School'    },
    { value: 'amore',     label: '❤️  Love'     },
    { value: 'sport',     label: '⚽ Sport'      },
    { value: 'amicizia',  label: '🤝 Friendship'   },
    { value: 'lavoro',    label: '💼 Work'     },
    { value: 'famiglia',  label: '🏡 Family'   },
    { value: 'salute',    label: '🌱 Health'     },
    { value: 'altro',     label: '✨ Other'      },
  ],

  // Emoji felicità in base al valore (1-10)
  HAPPINESS_EMOJIS: ['😞','😔','😕','😐','🙂','😊','😄','😁','🤩','🥰'],

  STORAGE_KEY: 'gratitudine_data', // chiave localStorage

  /* FUTURE: quando integri Firebase, sposta qui la config:
  FIREBASE_CONFIG: {
    apiKey: "...",
    projectId: "...",
    ...
  } */
};


/* ╔══════════════════════════════╗
   ║  2. STORAGE                  ║
   ╚══════════════════════════════╝ */

/**
 * Carica tutti i dati dall'archivio locale.
 * @returns {Object} - dizionario { "YYYY-MM-DD": DayData }
 */
function loadAllData() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Errore lettura localStorage:', e);
    return {};
  }
}

/**
 * Salva tutti i dati nell'archivio locale.
 * @param {Object} data - dizionario completo
 */
function saveAllData(data) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Errore scrittura localStorage:', e);
  }

  /* FUTURE: Sincronizzazione con Firebase.
     Sostituisci (o affianca) il localStorage con:

     import { db } from './firebase.js';
     import { doc, setDoc } from 'firebase/firestore';

     await setDoc(doc(db, 'users', userId, 'entries', dateKey), dayData);
  */
}

/**
 * Legge i dati di un giorno specifico.
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {Object|null}
 */
function loadDay(dateKey) {
  const all = loadAllData();
  return all[dateKey] || null;
}

/**
 * Salva i dati di un giorno specifico.
 * @param {string} dateKey - "YYYY-MM-DD"
 * @param {Object} dayData - { gratitudes, happiness, completed }
 */
function saveDay(dateKey, dayData) {
  const all = loadAllData();
  all[dateKey] = dayData;
  saveAllData(all);
}


/* ╔══════════════════════════════╗
   ║  3. DATE UTILS               ║
   ╚══════════════════════════════╝ */

/**
 * Converte una data JS in stringa "YYYY-MM-DD" (locale, non UTC).
 * @param {Date} date
 * @returns {string}
 */
function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converte "YYYY-MM-DD" in oggetto Date (locale).
 * @param {string} key
 * @returns {Date}
 */
function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formatta una data in inglese per la visualizzazione.
 * @param {Date} date
 * @returns {{ giorno: string, data: string }}
 */
function formatDate(date) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  return {
    giorno: days[date.getDay()],
    data:   `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    meseAnno: `${months[date.getMonth()]} ${date.getFullYear()}`,
  };
}

/**
 * Aggiunge (o sottrae) giorni a una data.
 * @param {Date} date
 * @param {number} n - numero di giorni (positivo o negativo)
 * @returns {Date}
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Ritorna la data di oggi come stringa "YYYY-MM-DD". */
function todayKey() {
  return dateToKey(new Date());
}


/* ╔══════════════════════════════╗
   ║  4. STREAK & PUNTI           ║
   ╚══════════════════════════════╝ */

/**
 * Calcola streak attuale, miglior streak e punti totali.
 * @returns {{ current: number, best: number, points: number }}
 */
function calcStats() {
  const all  = loadAllData();

  // Ottieni tutte le chiavi di giorni completati, ordinate
  const completedDays = Object.keys(all)
    .filter(key => all[key].completed)
    .sort(); // ordine crescente "YYYY-MM-DD" si ordina bene come stringa

  if (completedDays.length === 0) {
    return { current: 0, best: 0, points: 0 };
  }

  const points = completedDays.length * CONFIG.POINTS_PER_DAY;

  // Calcola le streak scorrendo i giorni
  let best    = 1;
  let current = 1;
  let tempStreak = 1;

  for (let i = 1; i < completedDays.length; i++) {
    const prev = keyToDate(completedDays[i - 1]);
    const curr = keyToDate(completedDays[i]);
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      // Giorni consecutivi
      tempStreak++;
      if (tempStreak > best) best = tempStreak;
    } else {
      // Streak interrotta
      tempStreak = 1;
    }
  }

  // Streak "attuale": conta solo se include oggi o ieri
  const todayStr     = todayKey();
  const yesterdayStr = dateToKey(addDays(new Date(), -1));
  const lastDay      = completedDays[completedDays.length - 1];

  if (lastDay === todayStr || lastDay === yesterdayStr) {
    current = tempStreak;
  } else {
    current = 0; // streak interrotta
  }

  return { current, best, points };
}

/**
 * Aggiorna il DOM con le statistiche aggiornate.
 */
function updateStatsUI() {
  const { current, best, points } = calcStats();
  document.getElementById('streak-current').textContent = current;
  document.getElementById('streak-best').textContent    = best;
  document.getElementById('points-total').textContent   = points;

  /* FUTURE: Qui puoi controllare soglie punti e sbloccare temi:
     if (points >= 50)  unlockTheme('forest');
     if (points >= 100) unlockTheme('dark');
     if (points >= 200) showBadge('super-streak');
  */
}


/* ╔══════════════════════════════╗
   ║  5. RENDER UI                ║
   ╚══════════════════════════════╝ */

/** Stato globale dell'app (giorno corrente visualizzato) */
const state = {
  currentDate: new Date(),    // data visualizzata
  today:       new Date(),    // data reale di oggi
};

/**
 * Crea il markup HTML di una singola voce gratitudine.
 * @param {number} index  - indice (0-based)
 * @param {boolean} removable - mostra pulsante rimuovi?
 * @param {Object} data   - dati esistenti { text, category }
 * @returns {HTMLElement}
 */
function createEntryElement(index, removable = false, data = null) {
  const div = document.createElement('div');
  div.className = 'gratitude-entry';
  div.dataset.index = index;

  // Dropdown categorie
  const categoryOptions = CONFIG.CATEGORIES
    .map(c => `<option value="${c.value}" ${data?.category === c.value ? 'selected' : ''}>${c.label}</option>`)
    .join('');

  const removeBtnHTML = removable
    ? `<button class="btn-remove" title="Remove" data-index="${index}">✕</button>`
    : '';

  div.innerHTML = `
    <div class="entry-row">
      <span class="entry-number">${index + 1}.</span>
      <textarea
        class="entry-text"
        placeholder="I'm grateful for…"
        rows="2"
        data-index="${index}"
      >${data?.text || ''}</textarea>
      ${removeBtnHTML}
    </div>
    <select class="entry-category" data-index="${index}">
      ${categoryOptions}
    </select>
  `;

  // Colora il numero se c'è già testo
  if (data?.text) div.classList.add('filled');

  // Listener: colora numero quando l'utente scrive
  const textarea = div.querySelector('.entry-text');
  textarea.addEventListener('input', () => {
    div.classList.toggle('filled', textarea.value.trim().length > 0);
  });

  // Listener: rimuovi voce (solo per voci extra)
  const removeBtn = div.querySelector('.btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      div.remove();
      renumberEntries();
    });
  }

  return div;
}

/**
 * Rinumera le voci dopo una rimozione.
 */
function renumberEntries() {
  const entries = document.querySelectorAll('.gratitude-entry');
  entries.forEach((el, i) => {
    el.dataset.index = i;
    el.querySelector('.entry-number').textContent = (i + 1) + '.';
    el.querySelectorAll('[data-index]').forEach(child => {
      child.dataset.index = i;
    });
  });
}

  // --- SETTINGS SYSTEM ---

  // Oggetto settings base
  let settings = {
    categories: [
      { label: "Study", emoji: "📚", order: 1, active: true },
      { label: "Love", emoji: "❤️", order: 2, active: true },
      { label: "Sport", emoji: "⚽", order: 3, active: true },
      { label: "Friendship", emoji: "🤝", order: 4, active: true },
      { label: "Work", emoji: "💼", order: 5, active: true },
      { label: "Family", emoji: "🏡", order: 6, active: true },
      { label: "Health", emoji: "🌱", order: 7, active: true },
      { label: "Other", emoji: "✨", order: 8, active: true }
    ],
    theme: "",
    streakRequirement: 3
  };

  function openSettings() {
    renderSettingsUI();
    document.getElementById('settingsModal').style.display = 'flex';
  }

  function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  function saveSettings() {
    localStorage.setItem('gratitudeSettings', JSON.stringify(settings));
  }

  function loadSettings() {
    const saved = localStorage.getItem('gratitudeSettings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  }

  function renderSettingsUI() {
    const container = document.getElementById('settingsUI');
    container.innerHTML = '';

    // --- Categorie ---
    const catSection = document.createElement('section');
    catSection.className = 'settings-section';
    catSection.innerHTML = '<h3>Categorie</h3>';

    // Lista categorie
    const catList = document.createElement('div');
    catList.className = 'settings-cat-list';

    settings.categories.sort((a, b) => a.order - b.order);
    settings.categories.forEach((cat, idx) => {
      const row = document.createElement('div');
      row.className = 'settings-cat-row';
      if (!cat.active) row.classList.add('cat-inactive');

      // Emoji
      const emojiInput = document.createElement('input');
      emojiInput.type = 'text';
      emojiInput.value = cat.emoji;
      emojiInput.className = 'cat-emoji-input';
      emojiInput.maxLength = 2;
      emojiInput.title = 'Emoji';
      emojiInput.oninput = () => {
        cat.emoji = emojiInput.value;
        saveSettings();
        updateCategoryDropdown();
      };

      // Label
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = cat.label;
      labelInput.className = 'cat-label-input';
      labelInput.title = 'Nome categoria';
      labelInput.oninput = () => {
        cat.label = labelInput.value;
        saveSettings();
        updateCategoryDropdown();
      };

      // Order
      const orderInput = document.createElement('input');
      orderInput.type = 'number';
      orderInput.value = cat.order;
      orderInput.className = 'cat-order-input';
      orderInput.title = 'Ordine';
      orderInput.min = 1;
      orderInput.onchange = () => {
        cat.order = parseInt(orderInput.value) || idx+1;
        saveSettings();
        renderSettingsUI();
        updateCategoryDropdown();
      };

      // Toggle attivo
      const activeToggle = document.createElement('input');
      activeToggle.type = 'checkbox';
      activeToggle.checked = cat.active;
      activeToggle.className = 'cat-active-toggle';
      activeToggle.title = 'Attiva/disattiva';
      activeToggle.onchange = () => {
        cat.active = activeToggle.checked;
        saveSettings();
        updateCategoryDropdown();
        renderSettingsUI();
      };

      // Bottone X eliminazione
      const delBtn = document.createElement('button');
      delBtn.className = 'cat-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Elimina categoria';
      delBtn.onclick = () => {
        if (cat.active) {
          cat.active = false;
          saveSettings();
          updateCategoryDropdown();
          renderSettingsUI();
        } else {
          settings.categories.splice(idx, 1);
          saveSettings();
          updateCategoryDropdown();
          renderSettingsUI();
        }
      };

      row.appendChild(emojiInput);
      row.appendChild(labelInput);
      row.appendChild(orderInput);
      row.appendChild(activeToggle);
      row.appendChild(delBtn);
      catList.appendChild(row);
    });

    // Bottone aggiungi categoria
    const addBtn = document.createElement('button');
    addBtn.className = 'cat-add-btn';
    addBtn.textContent = '+ Aggiungi categoria';
    addBtn.onclick = () => {
      const newCat = {
        label: '',
        emoji: '',
        order: settings.categories.length + 1,
        active: true
      };
      settings.categories.push(newCat);
      saveSettings();
      renderSettingsUI();
      updateCategoryDropdown();
    };

    catSection.appendChild(catList);
    catSection.appendChild(addBtn);
    container.appendChild(catSection);

    // --- Altre sezioni impostazioni verranno aggiunte qui ---
  }

  function updateCategoryDropdown() {
    // Aggiorna tutti i dropdown delle voci gratitudine
    const dropdowns = document.querySelectorAll('.entry-category');
    dropdowns.forEach(select => {
      const idx = select.dataset.index;
      select.innerHTML = settings.categories
        .filter(cat => cat.active)
        .sort((a, b) => a.order - b.order)
        .map(cat => `<option value="${cat.label}">${cat.emoji} ${cat.label}</option>`)
        .join('');
      // Mantieni selezione precedente se possibile
      if (select.value && settings.categories.some(cat => cat.label === select.value && cat.active)) {
        select.value = select.value;
      }
    });
  }

  // Event listeners per apertura/chiusura settings
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);

  // Carica settings all'avvio
  loadSettings();

/**
 * Legge i dati correnti dai campi del form.
 * @returns {{ gratitudes: Array, happiness: number }}
 */
function readFormData() {
  const entries  = document.querySelectorAll('.gratitude-entry');
  const gratitudes = Array.from(entries).map(el => ({
    text:     el.querySelector('.entry-text').value.trim(),
    category: el.querySelector('.entry-category').value,
  }));

  const happiness = parseInt(document.getElementById('happiness-slider').value, 10);
  return { gratitudes, happiness };
}

/**
 * Carica i dati di un giorno nel form.
 * @param {string} dateKey
 */
function renderDay(dateKey) {
  const data      = loadDay(dateKey);
  const list      = document.getElementById('gratitude-list');
  list.innerHTML  = '';

  const isToday   = dateKey === todayKey();
  const gratitudes = data?.gratitudes || [];

  // Crea almeno 3 voci
  const count = Math.max(gratitudes.length, CONFIG.MIN_ENTRIES);
  for (let i = 0; i < count; i++) {
    const removable = i >= CONFIG.MIN_ENTRIES; // le prime 3 non si possono rimuovere
    const entryData = gratitudes[i] || null;
    list.appendChild(createEntryElement(i, removable, entryData));
  }

  // Slider felicità
  const slider = document.getElementById('happiness-slider');
  const value  = data?.happiness || 5;
  slider.value = value;
  updateHappinessUI(value);

  // Pulsante aggiungi — disabilitato per i giorni passati (opzionale)
  const btnAdd = document.getElementById('btn-add-entry');
  btnAdd.disabled = false; // puoi mettere !isToday per bloccare i passati

  // Nascondi stato salvataggio precedente
  document.getElementById('save-status').textContent = '';

  // Aggiorna header data
  const { giorno, data: dataFormatted } = formatDate(state.currentDate);
  document.getElementById('display-day').textContent  = giorno;
  document.getElementById('display-date').textContent = dataFormatted;

  // Bottone "avanti" disabilitato se siamo già a oggi
  document.getElementById('btn-next').disabled =
    dateToKey(state.currentDate) >= todayKey();

  updateStatsUI();
}

/**
 * Aggiorna emoji e valore visivo dello slider.
 * @param {number} value - 1-10
 */
function updateHappinessUI(value) {
  document.getElementById('happiness-value').textContent = value;
  const emoji  = CONFIG.HAPPINESS_EMOJIS[value - 1];
  const emojiEl = document.getElementById('happiness-emoji');
  emojiEl.textContent = emoji;
  emojiEl.style.transform = 'scale(1.2)';
  setTimeout(() => emojiEl.style.transform = '', 200);
}


/* ╔══════════════════════════════╗
   ║  6. CALENDARIO               ║
   ╚══════════════════════════════╝ */

/** Stato del calendario */
const calState = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based
};

/**
 * Disegna il mini calendario per il mese corrente di calState.
 */
function renderCalendar() {
  const allData   = loadAllData();
  const grid      = document.getElementById('cal-grid');
  const label     = document.getElementById('cal-month-label');
  grid.innerHTML  = '';

  const { meseAnno } = formatDate(new Date(calState.year, calState.month, 1));
  label.textContent  = meseAnno;

  // Intestazione giorni settimana (L M M G V S D)
  const headers = ['L','M','M','G','V','S','D'];
  headers.forEach(h => {
    const el = document.createElement('div');
    el.className     = 'cal-day-header';
    el.textContent   = h;
    grid.appendChild(el);
  });

  // Primo giorno del mese
  const firstDay   = new Date(calState.year, calState.month, 1);
  // Offset: lunedì = 0, domenica = 6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  // Celle vuote prima del 1°
  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // Numero di giorni nel mese
  const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(calState.year, calState.month, d);
    const key     = dateToKey(date);
    const el      = document.createElement('div');
    el.className  = 'cal-day';
    el.textContent = d;

    if (key === todayKey())                  el.classList.add('today');
    if (key === dateToKey(state.currentDate)) el.classList.add('selected');
    if (allData[key]?.completed)             el.classList.add('completed');
    if (key > todayKey())                    el.style.opacity = '0.3'; // giorni futuri

    el.addEventListener('click', () => {
      if (key > todayKey()) return; // non navigare nel futuro
      state.currentDate = date;
      renderDay(key);
      renderCalendar();
      // Chiudi il pannello su mobile
      toggleCalendar(false);
    });

    grid.appendChild(el);
  }
}

/** Apre/chiude il pannello calendario. */
function toggleCalendar(forceOpen) {
  const panel   = document.getElementById('calendar-panel');
  const toggle  = document.getElementById('calendar-toggle');
  const isOpen  = forceOpen !== undefined ? !forceOpen : !panel.hidden;

  panel.hidden              = isOpen;
  toggle.textContent        = isOpen ? '📅 Open calendar' : '📅 Close calendar';
  toggle.setAttribute('aria-expanded', String(!isOpen));

  if (!isOpen) renderCalendar();
}


/* ╔══════════════════════════════╗
   ║  7. EVENT LISTENERS          ║
   ╚══════════════════════════════╝ */

function initEventListeners() {

  /* ── Navigazione data ── */
  document.getElementById('btn-prev').addEventListener('click', () => {
    state.currentDate = addDays(state.currentDate, -1);
    renderDay(dateToKey(state.currentDate));
    renderCalendar();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    const next = addDays(state.currentDate, 1);
    if (dateToKey(next) <= todayKey()) {
      state.currentDate = next;
      renderDay(dateToKey(state.currentDate));
      renderCalendar();
    }
  });

  /* ── Aggiungi voce gratitudine ── */
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    const list  = document.getElementById('gratitude-list');
    const count = list.querySelectorAll('.gratitude-entry').length;
    list.appendChild(createEntryElement(count, true)); // removable = true
    // Scroll alla nuova voce
    list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ── Slider felicità ── */
  document.getElementById('happiness-slider').addEventListener('input', (e) => {
    updateHappinessUI(parseInt(e.target.value, 10));
  });

  /* ── Salva ── */
  document.getElementById('btn-save').addEventListener('click', handleSave);

  /* ── Calendario toggle ── */
  document.getElementById('calendar-toggle').addEventListener('click', () => {
    toggleCalendar();
  });

  /* ── Calendario mese prev/next ── */
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    calState.month--;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    renderCalendar();
  });

  document.getElementById('cal-next-month').addEventListener('click', () => {
    // Non avanzare oltre il mese corrente
    const now = new Date();
    if (calState.year < now.getFullYear() ||
       (calState.year === now.getFullYear() && calState.month < now.getMonth())) {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    }
  });
}

/**
 * Gestisce il salvataggio della giornata.
 */
function handleSave() {
  const dateKey             = dateToKey(state.currentDate);
  const { gratitudes, happiness } = readFormData();

  // Conta le voci con testo non vuoto
  const validEntries = gratitudes.filter(g => g.text.length > 0);
  const completed    = validEntries.length >= CONFIG.MIN_ENTRIES;

  const dayData = {
    gratitudes,
    happiness,
    completed,
    savedAt: new Date().toISOString(),
  };

  saveDay(dateKey, dayData);

  /* ── Feedback visivo ── */
  const btn        = document.getElementById('btn-save');
  const statusEl   = document.getElementById('save-status');

  if (completed) {
    statusEl.textContent = '✓ Day saved! Great job 🌿';

    // Animazione celebrazione
    btn.classList.add('celebrate');
    setTimeout(() => btn.classList.remove('celebrate'), 500);

    /* FUTURE: Qui puoi aggiungere animazioni speciali
       (coriandoli, suoni, glow) in base ai punti. */

  } else {
    statusEl.textContent = `⚠ Partial save (${validEntries.length}/${CONFIG.MIN_ENTRIES} entries required for the streak)`;
  }

  // Nascondi messaggio dopo 3 secondi
  setTimeout(() => { statusEl.textContent = ''; }, 3000);

  // Aggiorna statistiche e calendario
  updateStatsUI();
  renderCalendar();
}


/* ╔══════════════════════════════╗
   ║  8. INIT                     ║
   ╚══════════════════════════════╝ */

/**
 * Avvia l'applicazione.
 */
function init() {
  // Mostra il giorno corrente all'apertura
  state.currentDate = new Date();

  renderDay(dateToKey(state.currentDate));
  initEventListeners();
  updateStatsUI();

  /* FUTURE: Qui puoi inizializzare Firebase e
     sincronizzare i dati dal cloud prima del renderDay:

     await initFirebase();
     const cloudData = await loadFromFirebase(userId);
     mergeWithLocalData(cloudData);
     renderDay(dateToKey(state.currentDate));
  */

  console.log('✦ Gratitudine — App avviata');
}

// Avvia quando il DOM è pronto
document.addEventListener('DOMContentLoaded', init);
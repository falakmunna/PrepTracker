// ============================================================
//  PREP TRACK — app.js
// ============================================================

// ── State ────────────────────────────────────────────────────
let state = {
  subjects: [],     // { id, name, paper, chapters:[], count, chapterDone:{} }
  theme: 'dark',
};

// ── Persistence ──────────────────────────────────────────────
function saveState() {
  localStorage.setItem('preptrack_state', JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem('preptrack_state');
  if (raw) {
    try { state = JSON.parse(raw); } catch (_) {}
  }
}

// ── Utility ──────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Theme ────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  state.theme = theme;
  saveState();
}

// ── Navigation ───────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelector(`.nav-tab[data-page="${pageId}"]`).classList.add('active');
  closePanelImmediate();
}

// ── Overall Progress ─────────────────────────────────────────
function updateOverallProgress() {
  const subjects = state.subjects;
  const totalSubjects = subjects.length;
  let totalChapters = 0;
  let totalDone = 0;

  subjects.forEach(s => {
    totalChapters += s.chapters.length;
    totalDone += Object.values(s.chapterDone || {}).filter(Boolean).length;
  });

  const pct = totalChapters > 0 ? Math.round((totalDone / totalChapters) * 100) : 0;

  // Ring: circumference = 2π×50 ≈ 314.16
  const circumference = 314.16;
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.strokeDashoffset = offset;

  const ringPct = document.getElementById('ring-pct');
  if (ringPct) ringPct.textContent = pct + '%';

  const barFill = document.getElementById('overall-bar-fill');
  if (barFill) barFill.style.width = pct + '%';

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('ostat-subjects', totalSubjects);
  el('ostat-chapters', totalChapters);
  el('ostat-done', totalDone);
}

// ── Dashboard Render ─────────────────────────────────────────
function renderDashboard() {
  const container = document.getElementById('dashboard-subjects');
  const empty = document.getElementById('dashboard-empty');
  container.innerHTML = '';

  updateOverallProgress();

  if (state.subjects.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  state.subjects.forEach(subject => {
    const totalChapters = subject.chapters.length;
    const doneCount = Object.values(subject.chapterDone || {}).filter(Boolean).length;
    const progressPct = totalChapters > 0 ? Math.round((doneCount / totalChapters) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-card-top">
        <button class="subject-btn" data-id="${subject.id}">
          ${escHtml(subject.name)}
          ${subject.paper ? `<span class="subject-paper-tag">${escHtml(subject.paper)}</span>` : ''}
        </button>
        <span class="count-display" id="count-${subject.id}">${subject.count || 0}</span>
        <button class="btn-icon danger" title="Undo (-1)" data-undo="${subject.id}">↩</button>
        <button class="arrow-btn" title="View Chapters" data-arrow="${subject.id}">›</button>
      </div>
      <div class="subject-progress-wrap">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" id="prog-${subject.id}" style="width:${progressPct}%"></div>
        </div>
        <div class="progress-label">${doneCount}/${totalChapters} chapters done</div>
      </div>
    `;
    container.appendChild(card);
  });

  // subject button → increment count
  container.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const subject = state.subjects.find(s => s.id === id);
      if (subject) {
        subject.count = (subject.count || 0) + 1;
        document.getElementById('count-' + id).textContent = subject.count;
        saveState();
        animatePulse('count-' + id);
      }
    });
  });

  // undo button → decrement count (min 0)
  container.querySelectorAll('[data-undo]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.undo;
      const subject = state.subjects.find(s => s.id === id);
      if (subject && subject.count > 0) {
        subject.count--;
        document.getElementById('count-' + id).textContent = subject.count;
        saveState();
      }
    });
  });

  // arrow button → open chapter panel
  container.querySelectorAll('[data-arrow]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openChapterPanel(btn.dataset.arrow);
    });
  });
}

function animatePulse(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.transform = 'scale(1.25)';
  setTimeout(() => { el.style.transform = ''; }, 200);
}

// ── Chapter Panel ────────────────────────────────────────────
let openSubjectId = null;

function openChapterPanel(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  openSubjectId = subjectId;

  document.getElementById('chapter-panel-title').textContent = subject.name + (subject.paper ? ` — ${subject.paper}` : '');

  const body = document.getElementById('chapter-panel-body');
  body.innerHTML = '';

  if (subject.chapters.length === 0) {
    body.innerHTML = '<p class="panel-empty">No chapters added yet.<br>Go to Syllabus to add chapters.</p>';
  } else {
    subject.chapters.forEach(ch => {
      const done = !!(subject.chapterDone && subject.chapterDone[ch.id]);
      const item = document.createElement('div');
      item.className = 'panel-chapter-item';
      item.innerHTML = `
        <input type="checkbox" class="chapter-check" id="chk-${ch.id}" data-chapter-id="${ch.id}" ${done ? 'checked' : ''} />
        <label class="panel-chapter-name" for="chk-${ch.id}">${escHtml(ch.name)}</label>
      `;
      body.appendChild(item);
    });

    body.querySelectorAll('.chapter-check').forEach(chk => {
      chk.addEventListener('change', () => {
        if (!subject.chapterDone) subject.chapterDone = {};
        subject.chapterDone[chk.dataset.chapterId] = chk.checked;
        saveState();
        updateProgressBar(subject);
        updateOverallProgress();
      });
    });
  }

  const overlay = document.getElementById('chapter-overlay');
  overlay.classList.add('open');
}

function updateProgressBar(subject) {
  const total = subject.chapters.length;
  const done = Object.values(subject.chapterDone || {}).filter(Boolean).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('prog-' + subject.id);
  const label = bar && bar.closest('.subject-progress-wrap').querySelector('.progress-label');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `${done}/${total} chapters done`;
}

function closePanelImmediate() {
  document.getElementById('chapter-overlay').classList.remove('open');
  openSubjectId = null;
}

// Tap anywhere outside panel to close
document.getElementById('chapter-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('chapter-overlay')) {
    closePanelImmediate();
  }
});
document.getElementById('close-panel-btn').addEventListener('click', closePanelImmediate);

// ── Syllabus Render ──────────────────────────────────────────
function renderSyllabus() {
  const container = document.getElementById('syllabus-subjects');
  const empty = document.getElementById('syllabus-empty');
  container.innerHTML = '';

  if (state.subjects.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  state.subjects.forEach(subject => {
    const card = document.createElement('div');
    card.className = 'syllabus-subject-card';
    card.innerHTML = `
      <div class="syllabus-subject-header">
        <span class="syllabus-subject-name">${escHtml(subject.name)}</span>
        ${subject.paper ? `<span class="subject-paper-tag">${escHtml(subject.paper)}</span>` : ''}
        <button class="btn-icon danger" title="Remove Subject" data-remove-subject="${subject.id}">🗑</button>
      </div>
      <div class="syllabus-subject-body">
        <div class="chapter-list" id="chap-list-${subject.id}">
          ${renderChapterList(subject)}
        </div>
        <div class="add-chapter-row">
          <input type="text" class="text-input" placeholder="Chapter name or number" id="new-ch-${subject.id}" />
          <button class="btn btn-primary btn-sm" data-add-chapter="${subject.id}">+ Chapter</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // Remove subject
  container.querySelectorAll('[data-remove-subject]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmAction(`Remove subject "${state.subjects.find(s=>s.id===btn.dataset.removeSubject)?.name}"?`, () => {
        state.subjects = state.subjects.filter(s => s.id !== btn.dataset.removeSubject);
        saveState();
        renderSyllabus();
        renderDashboard();
      });
    });
  });

  // Remove chapter
  container.querySelectorAll('[data-remove-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [sid, cid] = btn.dataset.removeChapter.split('::');
      const subject = state.subjects.find(s => s.id === sid);
      if (!subject) return;
      subject.chapters = subject.chapters.filter(c => c.id !== cid);
      if (subject.chapterDone) delete subject.chapterDone[cid];
      saveState();
      document.getElementById('chap-list-' + sid).innerHTML = renderChapterList(subject);
      bindChapterRemove(sid);
      renderDashboard();
    });
  });

  // Add chapter on button click
  container.querySelectorAll('[data-add-chapter]').forEach(btn => {
    btn.addEventListener('click', () => addChapter(btn.dataset.addChapter));
  });

  // Add chapter on Enter key
  container.querySelectorAll('.add-chapter-row .text-input').forEach(input => {
    const sid = input.id.replace('new-ch-', '');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addChapter(sid);
    });
  });
}

function renderChapterList(subject) {
  if (!subject.chapters || subject.chapters.length === 0) return '';
  return subject.chapters.map(ch => `
    <div class="chapter-item">
      <span class="chapter-item-name">${escHtml(ch.name)}</span>
      <button class="chapter-remove-btn" data-remove-chapter="${subject.id}::${ch.id}" title="Remove">✕</button>
    </div>
  `).join('');
}

function bindChapterRemove(subjectId) {
  const list = document.getElementById('chap-list-' + subjectId);
  if (!list) return;
  list.querySelectorAll('[data-remove-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [sid, cid] = btn.dataset.removeChapter.split('::');
      const subject = state.subjects.find(s => s.id === sid);
      if (!subject) return;
      subject.chapters = subject.chapters.filter(c => c.id !== cid);
      if (subject.chapterDone) delete subject.chapterDone[cid];
      saveState();
      document.getElementById('chap-list-' + sid).innerHTML = renderChapterList(subject);
      bindChapterRemove(sid);
      renderDashboard();
    });
  });
}

function addChapter(subjectId) {
  const input = document.getElementById('new-ch-' + subjectId);
  const name = input.value.trim();
  if (!name) return;
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  subject.chapters.push({ id: uid(), name });
  input.value = '';
  saveState();
  document.getElementById('chap-list-' + subjectId).innerHTML = renderChapterList(subject);
  bindChapterRemove(subjectId);
  renderDashboard();
}

// ── Add Subject ──────────────────────────────────────────────
document.getElementById('add-subject-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('subject-name-input');
  const paperSelect = document.getElementById('paper-select');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  state.subjects.push({
    id: uid(),
    name,
    paper: paperSelect.value,
    chapters: [],
    count: 0,
    chapterDone: {},
  });
  nameInput.value = '';
  paperSelect.value = '';
  saveState();
  renderSyllabus();
  renderDashboard();
});

document.getElementById('subject-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-subject-btn').click();
});

// ── Settings ─────────────────────────────────────────────────
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

document.getElementById('reset-btn').addEventListener('click', () => {
  confirmAction('This will delete ALL subjects, chapters, and progress. Are you sure?', () => {
    state.subjects = [];
    saveState();
    renderDashboard();
    renderSyllabus();
  });
});

// ── Navigation Tabs ──────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    showPage(tab.dataset.page);
    if (tab.dataset.page === 'dashboard') renderDashboard();
    if (tab.dataset.page === 'syllabus') renderSyllabus();
  });
});

// ── Confirm Modal ────────────────────────────────────────────
let pendingConfirm = null;

function confirmAction(message, onConfirm) {
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').style.display = 'flex';
  pendingConfirm = onConfirm;
}

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  if (pendingConfirm) { pendingConfirm(); pendingConfirm = null; }
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
  pendingConfirm = null;
});

// ── HTML Escape ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────
loadState();
applyTheme(state.theme || 'dark');
renderDashboard();

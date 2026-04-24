// admin/admin.js — Full admin panel logic

// ── STATE ──────────────────────────────────────────────────
let seriesList = [];
let currentSeriesId = null;
let currentIssues = {};
let editingIssueData = null;

// ── UTILS ──────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── LOGIN ───────────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const input = document.getElementById('password-input').value.trim();
  if (!input) return;

  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'admin_password')
    .single();

  if (error || !data) {
    showLoginError('Could not verify password.');
    return;
  }

  if (data.value === input) {
    sessionStorage.setItem('mags_auth', '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'block';
    initAdmin();
  } else {
    showLoginError('Incorrect password.');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('mags_auth');
  location.reload();
});

// Auto-login if session exists
if (sessionStorage.getItem('mags_auth') === '1') {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  initAdmin();
}

// ── TABS ────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'issues') loadIssuesTab();
    if (btn.dataset.tab === 'others') loadOthers();
  });
});

// ── INIT ────────────────────────────────────────────────────
async function initAdmin() {
  await loadSeriesTab();
}

// ══════════════════════════════════════════════════════════════
// SERIES TAB
// ══════════════════════════════════════════════════════════════
async function loadSeriesTab() {
  const { data, error } = await db
    .from('series')
    .select('*')
    .order('display_order', { ascending: true });

  seriesList = data || [];
  renderSeriesList();
}

function renderSeriesList() {
  const list = document.getElementById('series-list');
  if (seriesList.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px">No series yet. Add your first one.</p>';
    return;
  }
  list.innerHTML = '';
  seriesList.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'series-row';
    row.innerHTML = `
      <div class="order-btns">
        <button class="order-btn" data-id="${s.id}" data-dir="up" title="Move up">▲</button>
        <button class="order-btn" data-id="${s.id}" data-dir="down" title="Move down">▼</button>
      </div>
      <div class="series-row-info">
        <div class="series-row-name">${escapeHtml(s.name)}</div>
        <div class="series-row-meta">${s.year_start || ''}${s.year_end ? ' – ' + s.year_end : s.year_start ? ' – present' : ''}</div>
      </div>
      <div class="series-row-actions">
        <button class="btn btn-edit btn-sm" data-id="${s.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${s.id}">Delete</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.order-btn').forEach(btn => {
    btn.addEventListener('click', () => moveSeriesOrder(btn.dataset.id, btn.dataset.dir));
  });
  list.querySelectorAll('[data-id]').forEach(btn => {
    if (btn.classList.contains('btn-edit')) btn.addEventListener('click', () => openSeriesModal(btn.dataset.id));
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteSeries(btn.dataset.del));
  });
}

async function moveSeriesOrder(id, dir) {
  const idx = seriesList.findIndex(s => s.id === id);
  if (dir === 'up' && idx === 0) return;
  if (dir === 'down' && idx === seriesList.length - 1) return;

  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  [seriesList[idx], seriesList[swapIdx]] = [seriesList[swapIdx], seriesList[idx]];

  await Promise.all(seriesList.map((s, i) =>
    db.from('series').update({ display_order: i }).eq('id', s.id)
  ));
  renderSeriesList();
}

// SERIES MODAL
document.getElementById('add-series-btn').addEventListener('click', () => openSeriesModal(null));
document.getElementById('cancel-series-btn').addEventListener('click', closeSeriesModal);
document.getElementById('save-series-btn').addEventListener('click', saveSeries);

function openSeriesModal(id) {
  const modal = document.getElementById('modal-series');
  const series = id ? seriesList.find(s => s.id === id) : null;
  document.getElementById('modal-series-title').textContent = id ? 'Edit Series' : 'Add Series';
  document.getElementById('series-id-field').value = id || '';
  document.getElementById('series-name').value = series ? series.name : '';
  document.getElementById('series-year-start').value = series ? (series.year_start || '') : '';
  document.getElementById('series-year-end').value = series ? (series.year_end || '') : '';
  document.getElementById('series-notes').value = series ? (series.notes || '') : '';
  modal.classList.add('open');
}

function closeSeriesModal() {
  document.getElementById('modal-series').classList.remove('open');
}

async function saveSeries() {
  const id = document.getElementById('series-id-field').value;
  const name = document.getElementById('series-name').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }

  const payload = {
    name,
    slug: slugify(name),
    year_start: parseInt(document.getElementById('series-year-start').value) || null,
    year_end: parseInt(document.getElementById('series-year-end').value) || null,
    notes: document.getElementById('series-notes').value.trim() || null,
  };

  let error;
  if (id) {
    ({ error } = await db.from('series').update(payload).eq('id', id));
  } else {
    payload.display_order = seriesList.length;
    ({ error } = await db.from('series').insert(payload));
  }

  if (error) { showToast('Error saving: ' + error.message, 'error'); return; }
  showToast(id ? 'Series updated' : 'Series added');
  closeSeriesModal();
  await loadSeriesTab();
}

async function deleteSeries(id) {
  if (!confirm('Delete this series and ALL its issues? This cannot be undone.')) return;
  const { error } = await db.from('series').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Series deleted');
  await loadSeriesTab();
}

// ══════════════════════════════════════════════════════════════
// ISSUES TAB
// ══════════════════════════════════════════════════════════════
async function loadIssuesTab() {
  const selector = document.getElementById('issues-series-selector');
  if (seriesList.length === 0) {
    await loadSeriesTab();
  }
  selector.innerHTML = '';
  seriesList.forEach(s => {
    const pill = document.createElement('button');
    pill.className = 'series-pill' + (s.id === currentSeriesId ? ' active' : '');
    pill.textContent = s.name;
    pill.addEventListener('click', () => selectSeriesForIssues(s.id));
    selector.appendChild(pill);
  });

  if (currentSeriesId) renderIssuesForSeries(currentSeriesId);
  else if (seriesList.length > 0) selectSeriesForIssues(seriesList[0].id);
}

async function selectSeriesForIssues(id) {
  currentSeriesId = id;
  document.querySelectorAll('.series-pill').forEach(p => {
    p.classList.toggle('active', p.textContent === (seriesList.find(s=>s.id===id)||{}).name);
  });
  await renderIssuesForSeries(id);
}

async function renderIssuesForSeries(seriesId) {
  const content = document.getElementById('issues-content');
  content.innerHTML = '<div class="loading">Loading issues...</div>';

  const { data: issues } = await db
    .from('issues')
    .select('*')
    .eq('series_id', seriesId)
    .order('year').order('slot');

  currentIssues = {};
  (issues || []).forEach(i => {
    if (!currentIssues[i.year]) currentIssues[i.year] = {};
    currentIssues[i.year][i.slot] = i;
  });

  const years = Object.keys(currentIssues).map(Number).sort((a,b)=>a-b);

  content.innerHTML = `
    <div class="add-year-row">
      <input type="number" id="new-year-input" placeholder="e.g. 1998" min="1950" max="2099" />
      <button class="btn btn-edit" id="add-year-btn">+ Add Year</button>
    </div>
    <div id="years-blocks"></div>
  `;

  document.getElementById('add-year-btn').addEventListener('click', addYear);

  const blocksEl = document.getElementById('years-blocks');
  years.forEach(year => renderYearBlock(year, blocksEl));
}

function renderYearBlock(year, container) {
  const existing = document.getElementById('year-block-' + year);
  if (existing) existing.remove();

  const block = document.createElement('div');
  block.className = 'admin-year-block';
  block.id = 'year-block-' + year;

  block.innerHTML = `
    <div class="admin-year-header">
      <span class="admin-year-label">${year}</span>
      <button class="btn btn-danger btn-sm" id="del-year-${year}">Delete Year</button>
    </div>
    <div class="admin-covers-grid" id="grid-${year}"></div>
  `;

  const insertBefore = [...(container.querySelectorAll('.admin-year-block'))]
    .find(el => parseInt(el.id.replace('year-block-','')) > year);
  if (insertBefore) container.insertBefore(block, insertBefore);
  else container.appendChild(block);

  block.querySelector('#del-year-' + year).addEventListener('click', () => deleteYear(year));

  const grid = document.getElementById('grid-' + year);
  for (let slot = 1; slot <= 12; slot++) {
    const issue = (currentIssues[year] || {})[slot] || null;
    const slotEl = document.createElement('div');
    slotEl.className = 'admin-cover-slot';

    const thumb = document.createElement('div');
    thumb.className = 'admin-thumb' + (issue && issue.owned ? ' owned-slot' : '');
    thumb.title = `Slot ${slot} — click to edit`;

    if (issue && issue.cover_url) {
      const img = document.createElement('img');
      img.src = issue.cover_url;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      thumb.textContent = '+';
    }

    thumb.addEventListener('click', () => openIssueModal(currentSeriesId, year, slot, issue));
    slotEl.appendChild(thumb);

    const lbl = document.createElement('div');
    lbl.className = 'admin-slot-label';
    lbl.textContent = issue ? (issue.issue_label || `#${slot}`) : `${slot}`;
    slotEl.appendChild(lbl);

    grid.appendChild(slotEl);
  }
}

async function addYear() {
  const input = document.getElementById('new-year-input');
  const year = parseInt(input.value);
  if (!year || year < 1950 || year > 2099) {
    showToast('Enter a valid year', 'error'); return;
  }
  if (currentIssues[year]) {
    showToast('Year already exists', 'error'); return;
  }
  currentIssues[year] = {};
  input.value = '';
  renderYearBlock(year, document.getElementById('years-blocks'));
  showToast(`Year ${year} added`);
}

async function deleteYear(year) {
  if (!confirm(`Delete all slots for ${year}? This removes all issue data for this year.`)) return;
  const ids = Object.values(currentIssues[year] || {}).map(i=>i.id).filter(Boolean);
  if (ids.length > 0) {
    await db.from('issues').delete().in('id', ids);
  }
  delete currentIssues[year];
  const block = document.getElementById('year-block-' + year);
  if (block) block.remove();
  showToast(`Year ${year} deleted`);
}

// ── ISSUE MODAL ─────────────────────────────────────────────
let issueUploadFile = null;

document.getElementById('cancel-issue-btn').addEventListener('click', closeIssueModal);
document.getElementById('save-issue-btn').addEventListener('click', saveIssue);
document.getElementById('delete-issue-btn').addEventListener('click', deleteIssue);

document.getElementById('cover-upload-area').addEventListener('click', () => {
  document.getElementById('cover-file-input').click();
});
document.getElementById('cover-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  issueUploadFile = file;
  const preview = document.getElementById('cover-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('cover-upload-label').textContent = file.name;
});

// Rich text toolbar
document.querySelectorAll('#modal-issue .rich-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    if (cmd === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    document.getElementById('issue-notes-editor').focus();
  });
});

function openIssueModal(seriesId, year, slot, issue) {
  editingIssueData = issue;
  issueUploadFile = null;

  document.getElementById('modal-issue-title').textContent = `${year} — Slot ${slot}`;
  document.getElementById('issue-id-field').value = issue ? issue.id : '';
  document.getElementById('issue-series-id-field').value = seriesId;
  document.getElementById('issue-year-field').value = year;
  document.getElementById('issue-slot-field').value = slot;
  document.getElementById('issue-label').value = issue ? (issue.issue_label || '') : '';
  document.getElementById('issue-owned').checked = issue ? !!issue.owned : false;
  document.getElementById('issue-cd').checked = issue ? !!issue.cd : false;
  document.getElementById('issue-pdf-url').value = issue ? (issue.pdf_url || '') : '';
  document.getElementById('issue-cd-url').value = issue ? (issue.cd_url || '') : '';
  document.getElementById('issue-notes-editor').innerHTML = issue ? (issue.notes || '') : '';
  document.getElementById('issue-cover-url').value = issue ? (issue.cover_url || '') : '';

  const preview = document.getElementById('cover-preview');
  if (issue && issue.cover_url) {
    preview.src = issue.cover_url;
    preview.style.display = 'block';
    document.getElementById('cover-upload-label').textContent = 'Current cover (click to replace)';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    document.getElementById('cover-upload-label').textContent = 'Click to upload cover image';
  }

  document.getElementById('delete-issue-btn').style.display = issue ? 'inline-flex' : 'none';
  document.getElementById('modal-issue').classList.add('open');
}

function closeIssueModal() {
  document.getElementById('modal-issue').classList.remove('open');
  issueUploadFile = null;
}

async function saveIssue() {
  const id = document.getElementById('issue-id-field').value;
  const seriesId = document.getElementById('issue-series-id-field').value;
  const year = parseInt(document.getElementById('issue-year-field').value);
  const slot = parseInt(document.getElementById('issue-slot-field').value);

  let coverUrl = document.getElementById('issue-cover-url').value || null;

  // Upload cover if new file selected
  if (issueUploadFile) {
    const ext = issueUploadFile.name.split('.').pop();
    const filename = `${seriesId}/${year}-${slot}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await db.storage
      .from('covers')
      .upload(filename, issueUploadFile, { upsert: true });

    if (uploadErr) { showToast('Image upload failed: ' + uploadErr.message, 'error'); return; }

    const { data: urlData } = db.storage.from('covers').getPublicUrl(filename);
    coverUrl = urlData.publicUrl;
  }

  const payload = {
    series_id: seriesId,
    year,
    slot,
    issue_label: document.getElementById('issue-label').value.trim() || null,
    owned: document.getElementById('issue-owned').checked,
    cd: document.getElementById('issue-cd').checked,
    pdf_url: document.getElementById('issue-pdf-url').value.trim() || null,
    cd_url: document.getElementById('issue-cd-url').value.trim() || null,
    notes: document.getElementById('issue-notes-editor').innerHTML.trim() || null,
    cover_url: coverUrl,
  };

  let error;
  if (id) {
    ({ error } = await db.from('issues').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('issues').insert(payload));
  }

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Update local state
  if (!currentIssues[year]) currentIssues[year] = {};
  const { data: fresh } = await db.from('issues').select('*')
    .eq('series_id', seriesId).eq('year', year).eq('slot', slot).single();
  currentIssues[year][slot] = fresh;

  renderYearBlock(year, document.getElementById('years-blocks'));
  showToast('Issue saved');
  closeIssueModal();
}

async function deleteIssue() {
  const id = document.getElementById('issue-id-field').value;
  if (!id) return;
  if (!confirm('Delete this issue entry?')) return;
  const year = parseInt(document.getElementById('issue-year-field').value);
  const slot = parseInt(document.getElementById('issue-slot-field').value);
  await db.from('issues').delete().eq('id', id);
  if (currentIssues[year]) delete currentIssues[year][slot];
  renderYearBlock(year, document.getElementById('years-blocks'));
  showToast('Issue deleted');
  closeIssueModal();
}

// ══════════════════════════════════════════════════════════════
// OTHERS TAB
// ══════════════════════════════════════════════════════════════
let otherUploadFile = null;

document.getElementById('add-other-btn').addEventListener('click', () => openOtherModal(null));
document.getElementById('cancel-other-btn').addEventListener('click', closeOtherModal);
document.getElementById('save-other-btn').addEventListener('click', saveOther);
document.getElementById('delete-other-btn').addEventListener('click', deleteOther);

document.getElementById('other-cover-upload-area').addEventListener('click', () => {
  document.getElementById('other-cover-file-input').click();
});
document.getElementById('other-cover-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  otherUploadFile = file;
  const preview = document.getElementById('other-cover-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('other-cover-upload-label').textContent = file.name;
});

document.querySelectorAll('#modal-other .rich-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    if (cmd === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    document.getElementById('other-notes-editor').focus();
  });
});

async function loadOthers() {
  const list = document.getElementById('others-list');
  const { data, error } = await db.from('others').select('*').order('display_order');

  if (error || !data) { list.innerHTML = '<p style="color:var(--muted)">Could not load.</p>'; return; }
  if (data.length === 0) { list.innerHTML = '<p style="color:var(--muted);font-size:14px">No issues yet.</p>'; return; }

  list.innerHTML = '';
  data.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'series-row';
    row.innerHTML = `
      <div class="series-row-info">
        <div class="series-row-name">${escapeHtml(item.title)}</div>
        <div class="series-row-meta">${escapeHtml(item.issue_label || '')}${item.owned ? ' · owned' : ''}</div>
      </div>
      <div class="series-row-actions">
        <button class="btn btn-edit btn-sm" data-id="${item.id}">Edit</button>
      </div>
    `;
    row.querySelector('[data-id]').addEventListener('click', () => openOtherModal(item));
    list.appendChild(row);
  });
}

function openOtherModal(item) {
  otherUploadFile = null;
  document.getElementById('modal-other-title').textContent = item ? 'Edit Issue' : 'Add Issue';
  document.getElementById('other-id-field').value = item ? item.id : '';
  document.getElementById('other-title').value = item ? item.title : '';
  document.getElementById('other-label').value = item ? (item.issue_label || '') : '';
  document.getElementById('other-owned').checked = item ? !!item.owned : false;
  document.getElementById('other-cd').checked = item ? !!item.cd : false;
  document.getElementById('other-pdf-url').value = item ? (item.pdf_url || '') : '';
  document.getElementById('other-cd-url').value = item ? (item.cd_url || '') : '';
  document.getElementById('other-notes-editor').innerHTML = item ? (item.notes || '') : '';
  document.getElementById('other-cover-url').value = item ? (item.cover_url || '') : '';

  const preview = document.getElementById('other-cover-preview');
  if (item && item.cover_url) {
    preview.src = item.cover_url;
    preview.style.display = 'block';
    document.getElementById('other-cover-upload-label').textContent = 'Current cover (click to replace)';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    document.getElementById('other-cover-upload-label').textContent = 'Click to upload cover image';
  }

  document.getElementById('delete-other-btn').style.display = item ? 'inline-flex' : 'none';
  document.getElementById('modal-other').classList.add('open');
}

function closeOtherModal() {
  document.getElementById('modal-other').classList.remove('open');
  otherUploadFile = null;
}

async function saveOther() {
  const id = document.getElementById('other-id-field').value;
  const title = document.getElementById('other-title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }

  let coverUrl = document.getElementById('other-cover-url').value || null;

  if (otherUploadFile) {
    const ext = otherUploadFile.name.split('.').pop();
    const filename = `others/${Date.now()}.${ext}`;
    const { error: uploadErr } = await db.storage
      .from('covers')
      .upload(filename, otherUploadFile, { upsert: true });
    if (uploadErr) { showToast('Upload failed: ' + uploadErr.message, 'error'); return; }
    const { data: urlData } = db.storage.from('covers').getPublicUrl(filename);
    coverUrl = urlData.publicUrl;
  }

  const { data: existing } = await db.from('others').select('display_order').order('display_order', {ascending:false}).limit(1);
  const nextOrder = id ? undefined : ((existing?.[0]?.display_order ?? -1) + 1);

  const payload = {
    title,
    issue_label: document.getElementById('other-label').value.trim() || null,
    owned: document.getElementById('other-owned').checked,
    cd: document.getElementById('other-cd').checked,
    pdf_url: document.getElementById('other-pdf-url').value.trim() || null,
    cd_url: document.getElementById('other-cd-url').value.trim() || null,
    notes: document.getElementById('other-notes-editor').innerHTML.trim() || null,
    cover_url: coverUrl,
    ...(nextOrder !== undefined ? { display_order: nextOrder } : {}),
  };

  let error;
  if (id) {
    ({ error } = await db.from('others').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('others').insert(payload));
  }

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Saved');
  closeOtherModal();
  loadOthers();
}

async function deleteOther() {
  const id = document.getElementById('other-id-field').value;
  if (!id || !confirm('Delete this issue?')) return;
  await db.from('others').delete().eq('id', id);
  showToast('Deleted');
  closeOtherModal();
  loadOthers();
}

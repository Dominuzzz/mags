// js/others.js — others page

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
}

function openNotes(label, html) {
  document.getElementById('notes-title').textContent = label || 'Notes';
  document.getElementById('notes-content').innerHTML = html;
  document.getElementById('notes-popover').classList.add('open');
}

document.getElementById('lightbox-close').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('open');
});
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('lightbox').classList.remove('open');
});
document.getElementById('notes-close').addEventListener('click', () => {
  document.getElementById('notes-popover').classList.remove('open');
});

async function loadOthers() {
  const grid = document.getElementById('others-grid');
  const meta = document.getElementById('others-meta');

  const { data, error } = await db
    .from('others')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    grid.innerHTML = '<p class="empty">Could not load others.</p>';
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="empty">No issues added yet.</p>';
    meta.textContent = 'Scattered issues from various magazines';
    return;
  }

  meta.textContent = `${data.length} issues`;
  grid.innerHTML = '';

  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'other-card';

    // Cover
    const thumb = document.createElement('div');
    thumb.className = 'cover-thumb' + (item.cover_url ? '' : ' empty');
    thumb.style.aspectRatio = '3/4';

    if (item.cover_url) {
      const img = document.createElement('img');
      img.src = item.cover_url;
      img.alt = item.title;
      img.loading = 'lazy';
      thumb.appendChild(img);
      thumb.addEventListener('click', () => openLightbox(item.cover_url));
    } else {
      const icon = document.createElement('span');
      icon.className = 'no-cover-icon';
      icon.textContent = '▭';
      thumb.appendChild(icon);
    }
    card.appendChild(thumb);

    // Title
    const title = document.createElement('div');
    title.className = 'other-title';
    title.textContent = item.title;
    card.appendChild(title);

    // Issue label
    if (item.issue_label) {
      const lbl = document.createElement('div');
      if (item.pdf_url) {
        lbl.className = 'issue-label has-link';
        lbl.textContent = item.issue_label;
        lbl.addEventListener('click', () => window.open(item.pdf_url, '_blank'));
      } else {
        lbl.className = 'issue-label';
        lbl.textContent = item.issue_label;
      }
      card.appendChild(lbl);
    }

    // Badges
    const badges = document.createElement('div');
    badges.className = 'badge-row';

    if (item.owned) {
      const b = document.createElement('span');
      b.className = 'badge badge-owned'; b.textContent = 'owned';
      badges.appendChild(b);
    } else {
      const b = document.createElement('span');
      b.className = 'badge badge-missing'; b.textContent = 'missing';
      badges.appendChild(b);
    }
    if (item.cd) {
      const b = document.createElement('span');
      b.className = item.owned ? 'badge badge-cd' : 'badge badge-cd-missing';
      b.textContent = 'CD';
      if (item.cd_url) b.addEventListener('click', () => window.open(item.cd_url, '_blank'));
      badges.appendChild(b);
    }
    if (item.notes) {
      const b = document.createElement('span');
      b.className = 'badge badge-note'; b.textContent = '✎';
      b.addEventListener('click', () => openNotes(item.title, item.notes));
      badges.appendChild(b);
    }
    card.appendChild(badges);

    grid.appendChild(card);
  });
}

loadOthers();

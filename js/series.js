// js/series.js — series detail page

const params = new URLSearchParams(window.location.search);
const seriesId = params.get('id');

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
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('lightbox').classList.remove('open');
});
document.getElementById('notes-close').addEventListener('click', () => {
  document.getElementById('notes-popover').classList.remove('open');
});

async function loadSeries() {
  if (!seriesId) {
    window.location.href = 'index.html';
    return;
  }

  const { data: series, error: seriesErr } = await db
    .from('series')
    .select('*')
    .eq('id', seriesId)
    .single();

  if (seriesErr || !series) {
    document.getElementById('series-title').textContent = 'Series not found';
    return;
  }

  document.title = `MAGS — ${series.name}`;
  document.getElementById('series-title').textContent = series.name;

  const { data: issues, error: issuesErr } = await db
    .from('issues')
    .select('*')
    .eq('series_id', seriesId)
    .order('year', { ascending: true })
    .order('slot', { ascending: true });

  if (issuesErr) {
    document.getElementById('years-container').innerHTML = '<p class="empty">Could not load issues.</p>';
    return;
  }

  // Group by year
  const byYear = {};
  (issues || []).forEach(issue => {
    if (!byYear[issue.year]) byYear[issue.year] = {};
    byYear[issue.year][issue.slot] = issue;
  });

  // Determine year range to display
  const allYears = Object.keys(byYear).map(Number).sort((a,b) => a-b);

  // Stats
  const total = (issues || []).length;
  const owned = (issues || []).filter(i => i.owned).length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const years = series.year_start
    ? `${series.year_start}${series.year_end ? ' – ' + series.year_end : ' – present'}`
    : '';
  document.getElementById('series-meta').textContent =
    `${years}${years ? ' · ' : ''}${total} issues tracked · ${pct}% owned`;

  const container = document.getElementById('years-container');
  container.innerHTML = '';

  if (allYears.length === 0) {
    container.innerHTML = '<p class="empty">No issues added yet for this series.</p>';
    return;
  }

  allYears.forEach(year => {
    const block = document.createElement('div');
    block.className = 'year-block';
    block.innerHTML = `<div class="year-heading">${year}</div>`;

    const grid = document.createElement('div');
    grid.className = 'covers-grid';

    for (let slot = 1; slot <= 12; slot++) {
      const issue = byYear[year][slot] || null;
      if (!issue) continue; // hide empty slots
      const slot_el = document.createElement('div');
      slot_el.className = 'cover-slot';

      // Cover thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'cover-thumb' + (issue && issue.cover_url ? '' : ' empty');

      if (issue && issue.cover_url) {
        const img = document.createElement('img');
        img.src = issue.cover_url;
        img.alt = issue.issue_label || `Issue ${slot}`;
        img.loading = 'lazy';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => openLightbox(issue.cover_url));
      } else {
        const icon = document.createElement('span');
        icon.className = 'no-cover-icon';
        icon.textContent = '▭';
        thumb.appendChild(icon);
      }
      slot_el.appendChild(thumb);

      // Issue label
      const lbl = document.createElement('div');
      if (issue && issue.issue_label) {
        if (issue.pdf_url) {
          lbl.className = 'issue-label has-link';
          lbl.textContent = issue.issue_label;
          lbl.title = 'Click to open PDF';
          lbl.addEventListener('click', () => window.open(issue.pdf_url, '_blank'));
        } else {
          lbl.className = 'issue-label';
          lbl.textContent = issue.issue_label;
        }
      } else {
        lbl.className = 'issue-label';
        lbl.textContent = `#${slot}`;
      }
      slot_el.appendChild(lbl);

      // Badges
      const badges = document.createElement('div');
      badges.className = 'badge-row';

      if (issue && issue.owned) {
        const b = document.createElement('span');
        b.className = 'badge badge-owned';
        b.textContent = 'owned';
        badges.appendChild(b);
      } else if (issue && !issue.owned) {
        const b = document.createElement('span');
        b.className = 'badge badge-missing';
        b.textContent = 'missing';
        badges.appendChild(b);
      }
      if (issue && issue.cd) {
        const b = document.createElement('span');
        b.className = issue.owned ? 'badge badge-cd' : 'badge badge-cd-missing';
        b.textContent = 'CD';
        b.title = issue.cd_url ? 'Click to open CD link' : 'CD included';
        if (issue.cd_url) b.addEventListener('click', () => window.open(issue.cd_url, '_blank'));
        badges.appendChild(b);
      }
      if (issue && issue.notes) {
        const b = document.createElement('span');
        b.className = 'badge badge-note';
        b.textContent = '✎';
        b.title = 'Has notes';
        b.addEventListener('click', () => openNotes(issue.issue_label || `Slot ${slot}`, issue.notes));
        badges.appendChild(b);
      }

      slot_el.appendChild(badges);
      grid.appendChild(slot_el);
    }

    block.appendChild(grid);
    container.appendChild(block);
  });
}

loadSeries();

// js/main.js — index page logic

async function loadSeries() {
  const grid = document.getElementById('series-grid');
  const summary = document.getElementById('collection-summary');

  const { data: seriesList, error } = await db
    .from('series')
    .select('*')
    .order('display_order', { ascending: true });

  if (error || !seriesList) {
    grid.innerHTML = '<p class="empty">Could not load series.</p>';
    return;
  }

  if (seriesList.length === 0) {
    grid.innerHTML = '<p class="empty">No series added yet. Visit the admin panel to get started.</p>';
    summary.textContent = '0 series';
    return;
  }

  // Load owned counts for all series
  const { data: ownedData } = await db
    .from('issues')
    .select('series_id, owned')
    .eq('owned', true);

  const { data: totalData } = await db
    .from('issues')
    .select('series_id');

  const ownedMap = {};
  const totalMap = {};
  (ownedData || []).forEach(r => {
    ownedMap[r.series_id] = (ownedMap[r.series_id] || 0) + 1;
  });
  (totalData || []).forEach(r => {
    totalMap[r.series_id] = (totalMap[r.series_id] || 0) + 1;
  });

  grid.innerHTML = '';

  seriesList.forEach(s => {
    const total = totalMap[s.id] || 0;
    const owned = ownedMap[s.id] || 0;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

    const years = s.year_start
      ? `${s.year_start}${s.year_end ? ' – ' + s.year_end : ' – present'}`
      : '';

    const card = document.createElement('a');
    card.className = 'series-card';
    card.href = `series.html?id=${s.id}`;
    card.innerHTML = `
      <div class="series-card-name">${escapeHtml(s.name)}</div>
      <div class="series-card-meta">${years}${years && total ? ' · ' : ''}${total ? total + ' issues' : 'No issues yet'}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${total ? pct + '% owned' : ''}</div>
    `;
    grid.appendChild(card);
  });

  summary.textContent = `${seriesList.length} series · ${Object.values(totalMap).reduce((a,b)=>a+b,0)} issues tracked`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadSeries();

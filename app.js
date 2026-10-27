let db = null;
let previousRoute = 'inicio';

const pages = [...document.querySelectorAll('[data-page]')];
const dataStatus = document.getElementById('dataStatus');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

async function loadData() {
  try {
    const response = await fetch('data/base.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Falha ao carregar JSON');
    db = await response.json();
    dataStatus.textContent = `Base: ${db.meta.versao} • atualização ${formatDate(db.meta.atualizado_em)}`;
  } catch (error) {
    db = window.DADOS_PROTOTIPO;
    dataStatus.textContent = 'Base de demonstração carregada localmente';
  }
  renderStages();
  renderResidues();
  handleHash();
}

function formatDate(date) {
  if (!date) return 'não informada';
  const [y,m,d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function navigate(route) {
  previousRoute = currentRoute();
  window.location.hash = route;
}

function currentRoute() {
  return (window.location.hash || '#inicio').slice(1).split('/')[0];
}

function showPage(route) {
  pages.forEach(page => page.classList.toggle('active', page.dataset.page === route));
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  window.scrollTo({top:0, behavior:'instant'});
  document.getElementById('app').focus({preventScroll:true});
}

function handleHash() {
  const hash = (window.location.hash || '#inicio').slice(1);
  const [route, id] = hash.split('/');
  const valid = ['inicio','etapas','residuos','ficha','sobre','como-usar','referencias','contato'];
  showPage(valid.includes(route) ? route : 'inicio');
  if (route === 'ficha' && id) renderSheet(id);
}

function renderStages() {
  const grid = document.getElementById('stageGrid');
  grid.innerHTML = db.etapas.map(stage => {
    const count = db.residuos.filter(r => r.etapas.includes(stage.id)).length;
    return `<button class="stage-card" data-stage="${escapeHTML(stage.id)}">
      <strong>${escapeHTML(stage.nome)}</strong>
      <small>${count} resíduo(s) provisoriamente associado(s)</small>
    </button>`;
  }).join('');

  grid.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => showStageResults(btn.dataset.stage));
  });
}

function showStageResults(stageId) {
  const stage = db.etapas.find(s => s.id === stageId);
  const residues = db.residuos.filter(r => r.etapas.includes(stageId));
  const panel = document.getElementById('stageResults');
  panel.classList.remove('hidden');
  panel.innerHTML = `<h2>${escapeHTML(stage.nome)}</h2>
    <p>${escapeHTML(stage.descricao)}</p>
    ${residues.length ? residues.map(r => residueRow(r)).join('') : '<div class="empty">Nenhum resíduo cadastrado para esta etapa até o momento.</div>'}`;
  panel.querySelectorAll('[data-open-residue]').forEach(btn => {
    btn.addEventListener('click', () => navigate(`ficha/${btn.dataset.openResidue}`));
  });
  panel.scrollIntoView({behavior:'smooth', block:'start'});
}

function residueRow(r) {
  return `<div class="residue-item">
    <div>
      <strong>${escapeHTML(r.nome)}</strong>
      <div class="residue-meta">Classificação: ${escapeHTML(r.classe)} • ${statusLabel(r.status)}</div>
    </div>
    <button data-open-residue="${escapeHTML(r.id)}">Abrir ficha</button>
  </div>`;
}

function renderResidues(query='') {
  const list = document.getElementById('residueList');
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const residues = db.residuos.filter(r => r.nome.toLocaleLowerCase('pt-BR').includes(normalized));
  list.innerHTML = residues.length ? residues.map(r => residueRow(r)).join('') : '<div class="empty">Nenhum resíduo encontrado para essa pesquisa.</div>';
  list.querySelectorAll('[data-open-residue]').forEach(btn => {
    btn.addEventListener('click', () => navigate(`ficha/${btn.dataset.openResidue}`));
  });
}

function statusLabel(status) {
  if (status === 'pendente') return 'informação pendente';
  if (status === 'lacuna') return 'lacuna identificada';
  return 'dado provisório';
}

function statusBadge(status) {
  const cls = status === 'pendente' ? 'pending' : status === 'lacuna' ? 'gap' : '';
  return `<span class="badge ${cls}">${statusLabel(status)}</span>`;
}

function renderSheet(id) {
  const r = db.residuos.find(item => item.id === id);
  const sheet = document.getElementById('residueSheet');
  if (!r) {
    sheet.innerHTML = '<div class="empty">Resíduo não encontrado na base.</div>';
    return;
  }
  const stages = r.etapas.map(id => db.etapas.find(s => s.id === id)?.nome).filter(Boolean);
  const destinations = db.destinos.filter(d => d.residuo_ids.includes(r.id));
  sheet.innerHTML = `
    <div class="sheet-title">
      <div><h1>${escapeHTML(r.nome)}</h1><p class="residue-meta">Código ${escapeHTML(r.id)} • Classe/enquadramento: ${escapeHTML(r.classe)}</p></div>
      ${statusBadge(r.status)}
    </div>
    <div class="notice"><strong>Atenção:</strong> esta ficha pertence ao protótipo. Informações marcadas como provisórias ou pendentes serão revisadas com a matriz consolidada do projeto.</div>
    <div class="sheet-grid">
      ${card('Etapas/atividades associadas', stages.join('\n') || 'Não informado')}
      ${card('Como pode ser gerado', r.geracao)}
      ${card('Segregação', r.segregacao)}
      ${card('Acondicionamento', r.acondicionamento)}
      ${card('Armazenamento temporário', r.armazenamento)}
      ${card('Transporte', r.transporte)}
      ${card('Reutilização / reciclagem', r.reutilizacao)}
      ${card('Destinação aplicável', r.destinacao)}
      <section class="info-card full"><h2>Alternativas de recebimento</h2>${destinations.length ? destinations.map(destinationBlock).join('') : '<p>Nenhuma alternativa cadastrada.</p>'}</section>
      ${card('Fontes', r.fontes.join('\n'), true)}
      ${card('Última verificação', formatDate(r.verificado_em))}
    </div>`;
}

function card(title, text, full=false) {
  return `<section class="info-card ${full ? 'full' : ''}"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(text || 'Pendente de preenchimento')}</p></section>`;
}

function destinationBlock(d) {
  return `<div class="destination-card">
    <strong>${escapeHTML(d.nome)} ${statusBadge(d.status)}</strong>
    <p>${escapeHTML(d.tipo)} • ${escapeHTML(d.abrangencia)}</p>
    <p><b>Condições:</b> ${escapeHTML(d.condicoes)}</p>
    <p><b>Endereço:</b> ${escapeHTML(d.endereco)} • <b>Contato:</b> ${escapeHTML(d.contato)}</p>
    <p><b>Fonte:</b> ${escapeHTML(d.fonte)} • <b>Verificação:</b> ${escapeHTML(formatDate(d.verificado_em))}</p>
  </div>`;
}

document.addEventListener('click', event => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    event.preventDefault();
    navigate(routeTarget.dataset.route);
  }
});

document.getElementById('residueSearch').addEventListener('input', event => renderResidues(event.target.value));
document.getElementById('backFromSheet').addEventListener('click', () => navigate(previousRoute === 'ficha' ? 'inicio' : previousRoute));
menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
window.addEventListener('hashchange', handleHash);

loadData();

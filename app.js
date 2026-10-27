(() => {
  const state = { data:null, lastRoute:'inicio', currentResidue:null };
  const pages = [...document.querySelectorAll('.page')];
  const navLinks = [...document.querySelectorAll('[data-route]')];
  const app = document.getElementById('app');
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  const toast = document.getElementById('toast');

  function showToast(message){
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function route(name, {focus=true} = {}){
    const valid = pages.some(p => p.dataset.page === name) ? name : 'inicio';
    if (valid !== 'ficha') state.lastRoute = valid;
    pages.forEach(p => p.classList.toggle('active', p.dataset.page === valid));
    document.querySelectorAll('.nav a[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === valid));
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded','false');
    location.hash = valid;
    if (focus) {
      window.scrollTo({top:0,behavior:'smooth'});
      setTimeout(() => app.focus({preventScroll:true}), 160);
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-route]');
    if (trigger){
      e.preventDefault();
      route(trigger.dataset.route);
    }
  });

  menuToggle?.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  document.getElementById('globalSearchBtn')?.addEventListener('click', () => {
    route('residuos');
    setTimeout(() => document.getElementById('residueSearch')?.focus(), 220);
  });

  accessibilityToggle?.addEventListener('click', () => {
    const open = accessibilityPanel.hasAttribute('hidden');
    if (open) accessibilityPanel.removeAttribute('hidden'); else accessibilityPanel.setAttribute('hidden','');
    accessibilityToggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.accessibility-wrap') && !accessibilityPanel.hasAttribute('hidden')){
      accessibilityPanel.setAttribute('hidden','');
      accessibilityToggle.setAttribute('aria-expanded','false');
    }
  });

  let fontScale = Number(localStorage.getItem('rcc-font-scale') || '1');
  document.documentElement.style.setProperty('--font-scale', fontScale);
  document.body.classList.toggle('readable', localStorage.getItem('rcc-readable') === '1');
  document.body.classList.toggle('high-contrast', localStorage.getItem('rcc-contrast') === '1');
  document.body.classList.toggle('dark-mode', localStorage.getItem('rcc-dark') === '1');

  document.querySelectorAll('[data-access]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.access;
    if (action === 'font-plus'){
      fontScale = Math.min(1.35, +(fontScale + .08).toFixed(2));
      document.documentElement.style.setProperty('--font-scale',fontScale); localStorage.setItem('rcc-font-scale',fontScale);
    }
    if (action === 'font-minus'){
      fontScale = Math.max(.9, +(fontScale - .08).toFixed(2));
      document.documentElement.style.setProperty('--font-scale',fontScale); localStorage.setItem('rcc-font-scale',fontScale);
    }
    if (action === 'readable'){
      document.body.classList.toggle('readable'); localStorage.setItem('rcc-readable',document.body.classList.contains('readable')?'1':'0');
    }
    if (action === 'contrast'){
      document.body.classList.toggle('high-contrast'); localStorage.setItem('rcc-contrast',document.body.classList.contains('high-contrast')?'1':'0');
    }
    if (action === 'dark'){
      document.body.classList.toggle('dark-mode'); localStorage.setItem('rcc-dark',document.body.classList.contains('dark-mode')?'1':'0');
    }
    if (action === 'speak') speakCurrentPage();
    if (action === 'stop-speak') window.speechSynthesis?.cancel();
    if (action === 'libras'){
      const btnVlibras = window.VLibrasWidget?.initBtn;
      if (btnVlibras && typeof btnVlibras.click === 'function') btnVlibras.click();
      else showToast('O VLibras ainda está carregando. Tente novamente em alguns segundos.');
    }
  }));

  function speakCurrentPage(){
    if (!('speechSynthesis' in window)) return showToast('A leitura em voz alta não está disponível neste navegador.');
    window.speechSynthesis.cancel();
    const active = document.querySelector('.page.active');
    const text = active?.innerText?.replace(/\s+/g,' ').trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = .95;
    window.speechSynthesis.speak(u);
    showToast('Leitura em voz alta iniciada.');
  }

  const statusLabel = s => ({confirmado:'Confirmado',pendente:'Pendente',lacuna:'Lacuna identificada'}[s] || 'Em revisão');

  function renderStages(){
    const grid = document.getElementById('stageGrid');
    if (!grid || !state.data) return;
    grid.innerHTML = state.data.etapas.map(etapa => {
      const count = state.data.residuos.filter(r => r.etapas.includes(etapa.id)).length;
      return `<button class="stage-card" data-stage="${etapa.id}"><strong>${escapeHtml(etapa.nome)}</strong><span>${count} resíduo(s) cadastrado(s) • ${escapeHtml(etapa.descricao)}</span></button>`;
    }).join('');
    grid.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', () => showStage(btn.dataset.stage)));
  }

  function showStage(id){
    const etapa = state.data.etapas.find(e => e.id === id);
    const residuos = state.data.residuos.filter(r => r.etapas.includes(id));
    const panel = document.getElementById('stageResults');
    panel.classList.remove('hidden');
    panel.innerHTML = `<h2>${escapeHtml(etapa?.nome || 'Etapa')}</h2>${residuos.length ? `<div class="residue-list">${residuos.map(residueCard).join('')}</div>` : '<p>Nenhum resíduo cadastrado para esta etapa.</p>'}`;
    panel.querySelectorAll('[data-residue]').forEach(btn => btn.addEventListener('click', () => openResidue(btn.dataset.residue, 'etapas')));
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function residueCard(r){
    return `<button class="residue-card" data-residue="${r.id}"><span class="class-badge">${escapeHtml(r.classe)}</span><span><strong>${escapeHtml(r.nome)}</strong><span>Ver ficha de gerenciamento</span></span><span class="status-pill ${escapeHtml(r.status)}">${statusLabel(r.status)}</span></button>`;
  }

  function renderResidues(filter=''){
    const list = document.getElementById('residueList');
    if (!list || !state.data) return;
    const q = normalize(filter);
    const rows = state.data.residuos.filter(r => normalize(`${r.nome} ${r.classe}`).includes(q));
    list.innerHTML = rows.length ? rows.map(residueCard).join('') : '<p>Nenhum resíduo encontrado para essa pesquisa.</p>';
    list.querySelectorAll('[data-residue]').forEach(btn => btn.addEventListener('click', () => openResidue(btn.dataset.residue, 'residuos')));
  }

  document.getElementById('residueSearch')?.addEventListener('input', e => renderResidues(e.target.value));

  function openResidue(id, from){
    const r = state.data.residuos.find(x => x.id === id); if (!r) return;
    state.currentResidue = r; state.lastRoute = from || state.lastRoute;
    const sheet = document.getElementById('residueSheet');
    const stageNames = r.etapas.map(id => state.data.etapas.find(e => e.id === id)?.nome).filter(Boolean);
    sheet.innerHTML = `
      <header class="sheet-header"><div><h2>${escapeHtml(r.nome)}</h2><p>${escapeHtml(r.origem)}</p><div class="sheet-meta"><span class="meta-chip">${statusLabel(r.status)}</span>${stageNames.map(s=>`<span class="meta-chip">${escapeHtml(s)}</span>`).join('')}</div></div><div class="sheet-class">Classe ${escapeHtml(r.classe)}</div></header>
      <div class="sheet-grid">
        ${sheetSection('Segregação',r.segregacao)}
        ${sheetSection('Acondicionamento',r.acondicionamento)}
        ${sheetSection('Armazenamento temporário',r.armazenamento)}
        ${sheetSection('Transporte',r.transporte)}
        ${sheetSection('Reutilização ou reciclagem',r.reutilizacao)}
        ${sheetSection('Destinação aplicável',r.destinacao)}
        ${sheetSection('Alternativa em Viçosa/MG',r.alternativaLocal,'full')}
        ${sheetSection('Fonte e verificação',`${r.fonte} • Situação: ${r.verificacao}`,'full')}
      </div>`;
    route('ficha');
  }

  function sheetSection(title,text,extra=''){
    return `<section class="sheet-section ${extra}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || 'Informação ainda não cadastrada.')}</p></section>`;
  }

  document.getElementById('backFromSheet')?.addEventListener('click', () => route(state.lastRoute || 'residuos'));

  function normalize(v=''){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}

  async function loadData(){
    let data, source='JSON';
    try{
      const res = await fetch('data/base.json',{cache:'no-store'});
      if (!res.ok) throw new Error('Falha ao carregar base');
      data = await res.json();
    } catch(e){ data = window.RCC_FALLBACK_DATA; source='base de apoio local'; }
    state.data = data;
    const status = document.getElementById('dataStatus');
    if (status) status.textContent = `${data.meta?.versao || 'Protótipo'} • atualização ${data.meta?.atualizacao || 'não informada'} • ${source}`;
    renderStages(); renderResidues();
  }

  const initial = location.hash.replace('#','');
  route(initial || 'inicio',{focus:false});
  loadData();
})();

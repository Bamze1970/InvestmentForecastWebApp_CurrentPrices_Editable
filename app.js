const DATA = {"investments": [{"name": "Gold", "group": "Precious Metals", "current": 67290.709, "low4y": 97786.858, "base4y": 139695.511, "high4y": 181604.165}, {"name": "Silver", "group": "Precious Metals", "current": 7638.109, "low4y": 8618.842, "base4y": 13901.359, "high4y": 19183.875}, {"name": "onemarkets BlackRock Global Equity Dynamic Opportunities", "group": "Funds", "current": 2083.0, "low4y": 26826.446, "base4y": 32405.121, "high4y": 36503.446}, {"name": "onemarkets J.P. Morgan US Equities Fund", "group": "Funds", "current": 2037.0, "low4y": 26777.962, "base4y": 32333.821, "high4y": 36409.33}, {"name": "AMUNDI FUNDS ASIA EQUITY FOCUS - A EUR (C)", "group": "Funds", "current": 3421.0, "low4y": 6293.699, "base4y": 8220.228, "high4y": 10027.746}, {"name": "AMUNDI FUNDS CHINA EQUITY - A EUR (C)", "group": "Funds", "current": 2326.0, "low4y": 4914.7, "base4y": 6522.947, "high4y": 7983.159}, {"name": "AMUNDI FUNDS US PIONEER FUND - A EUR (C)", "group": "Funds", "current": 6093.0, "low4y": 11345.838, "base4y": 15344.173, "high4y": 19134.55}, {"name": "Solana", "group": "Crypto", "current": 10447.0, "low4y": 25575.0, "base4y": 44175.0, "high4y": 80600.0, "special": "solana"}], "solPrices": {"month": {"low": 58.0, "base": 67.4, "high": 88.0}, "q1": {"low": 64.0, "base": 74.0, "high": 98.0}, "q2": {"low": 70.0, "base": 82.0, "high": 115.0}, "q3": {"low": 75.0, "base": 89.0, "high": 130.0}, "q4": {"low": 80.0, "base": 96.0, "high": 145.0}, "y1": {"low": 82.0, "base": 105.0, "high": 165.0}, "y2": {"low": 95.0, "base": 148.0, "high": 240.0}, "y3": {"low": 130.0, "base": 215.0, "high": 360.0}, "y4": {"low": 165.0, "base": 285.0, "high": 520.0}}, "horizons": [{"key": "month", "title": "1 месец"}, {"key": "q1", "title": "Q1"}, {"key": "q2", "title": "Q2"}, {"key": "q3", "title": "Q3"}, {"key": "q4", "title": "Q4"}, {"key": "y1", "title": "1 година"}, {"key": "y2", "title": "2 години"}, {"key": "y3", "title": "3 години"}, {"key": "y4", "title": "4 години"}], "assumption": "При ръчна промяна на текущата стойност на инвестиция приложението пази предишната стойност локално в браузъра, показва стрелка за посока и преизчислява бъдещите хоризонти. За не-Solana активи бъдещите стойности се скалират пропорционално. За Solana редакцията се третира като промяна в ефективната експозиция.", "solanaInvestedCost": 14500.0, "solanaCurrentUnrealizedPL": -4053.0};
const STORAGE_KEY = 'investment-forecast-current-prices-v2';
let currentView = 'dashboard';
let selectedScenario = 'base';

const dashboardView = document.getElementById('dashboardView');
const contentView = document.getElementById('contentView');
const navDashboard = document.getElementById('navDashboard');
const navPrices = document.getElementById('navPrices');
const navHorizons = document.getElementById('navHorizons');
const navSolana = document.getElementById('navSolana');
const resetBtn = document.getElementById('resetBtn');

const fmtEuro = (v) => new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';
const colors = ['#1565C0','#2E7D32','#F9A825','#D32F2F','#6A1B9A','#00838F','#EF6C00','#455A64'];

function defaultStore() {
  const current = Object.fromEntries(DATA.investments.map(i => [i.name, i.current]));
  const previous = Object.fromEntries(DATA.investments.map(i => [i.name, i.current]));
  return { current, previous };
}
function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    return { current: parsed.current || defaultStore().current, previous: parsed.previous || defaultStore().previous };
  } catch { return defaultStore(); }
}
function saveStore(store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function resetStore() { localStorage.removeItem(STORAGE_KEY); }
function currentOf(name) { return getStore().current[name]; }
function previousOf(name) { return getStore().previous[name]; }
function diffOf(name) { return currentOf(name) - previousOf(name); }
function directionOf(name) { const d = diffOf(name); return d > 0 ? 'up' : d < 0 ? 'down' : 'flat'; }
function factor(inv) { return currentOf(inv.name) / (inv.current || 1); }
function totalCurrent() { const st = getStore(); return Object.values(st.current).reduce((a,b)=>a + Number(b || 0), 0); }
function scenarioSlices(horizonKey, scenarioKey) {
  return DATA.investments.map(inv => {
    const f = factor(inv);
    let value = 0;
    if (horizonKey === 'y4') {
      value = inv[scenarioKey + '4y'] * f;
    } else if (inv.special === 'solana') {
      // scaling by effective exposure; base month 67.4 corresponds to original current model
      value = inv.current * f * (DATA.solPrices[horizonKey][scenarioKey] / DATA.solPrices.month.base);
    } else {
      value = inv.current * f;
    }
    return { name: inv.name, group: inv.group, value };
  });
}
function totalFor(horizonKey, scenarioKey) { return scenarioSlices(horizonKey, scenarioKey).reduce((a,b)=>a+b.value,0); }
function pieSvg(slices) {
  const total = slices.reduce((a,b)=>a+b.value,0) || 1;
  const cx = 110, cy = 110, r = 100;
  let angle = -Math.PI / 2;
  const parts = slices.map((s,i) => {
    const frac = s.value / total;
    const next = angle + frac * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * r;
    const y1 = cy + Math.sin(angle) * r;
    const x2 = cx + Math.cos(next) * r;
    const y2 = cy + Math.sin(next) * r;
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
    angle = next;
    return `<path d="${path}" fill="${colors[i % colors.length]}"></path>`;
  }).join('');
  return `<svg class="pie-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
}
function legendMarkup(slices) {
  const total = slices.reduce((a,b)=>a+b.value,0) || 1;
  return slices.map((s,i)=>{
    const pct = (s.value/total)*100;
    return `<div class="legend-item"><span class="swatch" style="background:${colors[i % colors.length]}"></span><div><div>${s.name}</div><div class="note">${fmtEuro(s.value)} • ${pct.toFixed(1)}%</div></div></div>`;
  }).join('');
}
function dirMarkup(name) {
  const dir = directionOf(name);
  if (dir === 'up') return '<span class="dir up">↑</span>';
  if (dir === 'down') return '<span class="dir down">↓</span>';
  return '<span class="dir flat">→</span>';
}
function setNav(active) {
  [navDashboard, navPrices, navHorizons, navSolana].forEach(x => x.classList.remove('active'));
  if (active === 'dashboard') navDashboard.classList.add('active');
  if (active === 'prices') navPrices.classList.add('active');
  if (active === 'horizons') navHorizons.classList.add('active');
  if (active === 'solana') navSolana.classList.add('active');
}
function showDashboard() {
  currentView = 'dashboard'; setNav('dashboard'); dashboardView.classList.remove('hidden'); contentView.classList.add('hidden'); renderDashboard();
}
function showPrices() {
  currentView = 'prices'; setNav('prices'); dashboardView.classList.add('hidden'); contentView.classList.remove('hidden'); renderPrices();
}
function showHorizonsList() {
  currentView = 'horizons'; setNav('horizons'); dashboardView.classList.add('hidden'); contentView.classList.remove('hidden'); renderHorizonsList();
}
function showSolana() {
  currentView = 'solana'; setNav('solana'); dashboardView.classList.add('hidden'); contentView.classList.remove('hidden'); renderSolana();
}
function renderDashboard() {
  dashboardView.innerHTML = `
    <div class="grid" style="gap:16px">
      <section class="card">
        <h2 class="section-title">Dashboard</h2>
        <p class="muted">Актуалните цени се редактират ръчно и се пазят локално в браузъра. След промяна всички хоризонти се преизчисляват автоматично.</p>
        <div class="grid grid-4">
          <div class="metric"><span>Текущ портфейл</span><strong>${fmtEuro(totalCurrent())}</strong></div>
          <div class="metric"><span>4Y Low</span><strong>${fmtEuro(totalFor('y4','low'))}</strong></div>
          <div class="metric"><span>4Y Base</span><strong>${fmtEuro(totalFor('y4','base'))}</strong></div>
          <div class="metric"><span>4Y High</span><strong>${fmtEuro(totalFor('y4','high'))}</strong></div>
        </div>
        <div class="grid grid-2" style="margin-top:12px">
          <button class="quick-btn" id="goPrices"><strong>Актуални цени</strong>Редактирай текущите стойности и виж стрелки / разлики</button>
          <button class="quick-btn" id="goHorizons"><strong>Хоризонти</strong>1 месец, Q1, Q2, Q3, Q4, 1Y, 2Y, 3Y, 4Y</button>
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">Бързи бутони към хоризонтите</h2>
        <div class="quick-grid">
          ${DATA.horizons.map(h => `<button class="quick-btn horizon-quick" data-key="${h.key}"><strong>${h.title}</strong>Base total: ${fmtEuro(totalFor(h.key,'base'))}</button>`).join('')}
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">Логика</h2>
        <p class="note">${DATA.assumption}</p>
      </section>
    </div>`;
  document.getElementById('goPrices').addEventListener('click', showPrices);
  document.getElementById('goHorizons').addEventListener('click', showHorizonsList);
  dashboardView.querySelectorAll('.horizon-quick').forEach(btn => btn.addEventListener('click', () => openHorizon(btn.dataset.key)));
}
function renderPrices() {
  contentView.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <div>
          <h2 class="section-title">Актуални цени</h2>
          <p class="muted">Тук въвеждаш ръчно новата текуща стойност за всяка инвестиция. Приложението пази предишната стойност локално и показва посоката на промяна.</p>
        </div>
        <button class="secondary-btn" id="backDashBtn">Към Dashboard</button>
      </div>
      <div class="table-wrap">
        <div class="price-row head-row" style="background:transparent;border:none;padding:0 12px">
          <div>Инвестиция</div><div>Предишна цена</div><div>Текуща цена</div><div>Разлика</div><div>Посока</div><div>Нова цена</div><div>Действие</div>
        </div>
        ${DATA.investments.map(inv => `
          <div class="price-row">
            <div><strong>${inv.name}</strong><div class="group">${inv.group}</div></div>
            <div><strong>${fmtEuro(previousOf(inv.name))}</strong></div>
            <div><strong>${fmtEuro(currentOf(inv.name))}</strong></div>
            <div><strong class="${diffOf(inv.name) > 0 ? 'pos' : diffOf(inv.name) < 0 ? 'neg' : ''}">${fmtEuro(diffOf(inv.name))}</strong></div>
            <div>${dirMarkup(inv.name)}</div>
            <div><input type="number" step="0.01" min="0" class="price-input" data-name="${inv.name}" placeholder="${currentOf(inv.name).toFixed(2)}" /></div>
            <div><button class="primary apply-btn" data-name="${inv.name}">Запази</button></div>
          </div>`).join('')}
      </div>
      <p class="note" style="margin-top:12px">След запазване предишната цена става старата текуща цена, стрелката се обновява, а всички хоризонти се преизчисляват.</p>
    </section>`;
  document.getElementById('backDashBtn').addEventListener('click', showDashboard);
  contentView.querySelectorAll('.apply-btn').forEach(btn => btn.addEventListener('click', () => applyPrice(btn.dataset.name)));
  contentView.querySelectorAll('.price-input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') applyPrice(inp.dataset.name); }));
}
function applyPrice(name) {
  const input = contentView.querySelector(`.price-input[data-name="${CSS.escape(name)}"]`);
  if (!input) return;
  const newVal = Number(input.value);
  if (!Number.isFinite(newVal) || newVal < 0) return;
  const store = getStore();
  store.previous[name] = store.current[name];
  store.current[name] = newVal;
  saveStore(store);
  renderPrices();
}
function renderHorizonsList() {
  contentView.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <div><h2 class="section-title">Хоризонти</h2><p class="muted">Избери хоризонт. Стойностите вече използват актуалните локално запазени цени.</p></div>
        <button class="secondary-btn" id="backDashBtn">Към Dashboard</button>
      </div>
      <div class="quick-grid">
        ${DATA.horizons.map(h => `<button class="quick-btn horizon-open" data-key="${h.key}"><strong>${h.title}</strong>Base total: ${fmtEuro(totalFor(h.key,'base'))}</button>`).join('')}
      </div>
    </section>`;
  document.getElementById('backDashBtn').addEventListener('click', showDashboard);
  contentView.querySelectorAll('.horizon-open').forEach(btn => btn.addEventListener('click', () => openHorizon(btn.dataset.key)));
}
function renderSolana() {
  const current = currentOf('Solana');
  const previous = previousOf('Solana');
  const monthBase = scenarioSlices('month','base').find(x => x.name === 'Solana').value;
  const y4Base = scenarioSlices('y4','base').find(x => x.name === 'Solana').value;
  contentView.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <div><h2 class="section-title">Solana</h2><p class="muted">Промяната в текущата Solana стойност влияе върху всички бъдещи Solana хоризонти.</p></div>
        <button class="secondary-btn" id="backDashBtn">Към Dashboard</button>
      </div>
      <div class="grid grid-2">
        <div class="list-card">
          <div class="row"><span>Предишна цена</span><strong>${fmtEuro(previous)}</strong></div>
          <div class="row"><span>Текуща цена</span><strong>${fmtEuro(current)}</strong></div>
          <div class="row"><span>Разлика</span><strong class="${diffOf('Solana') > 0 ? 'pos' : diffOf('Solana') < 0 ? 'neg' : ''}">${fmtEuro(diffOf('Solana'))}</strong></div>
          <div class="row"><span>Посока</span><strong>${directionOf('Solana')==='up' ? '↑' : directionOf('Solana')==='down' ? '↓' : '→'}</strong></div>
          <div class="row"><span>1 месец (Base)</span><strong>${fmtEuro(monthBase)}</strong></div>
          <div class="row"><span>4 години (Base)</span><strong>${fmtEuro(y4Base)}</strong></div>
        </div>
        <div class="card" style="background:#0f172a"><div class="note">${DATA.assumption}</div></div>
      </div>
    </section>`;
  document.getElementById('backDashBtn').addEventListener('click', showDashboard);
}
function openHorizon(key) {
  setNav('horizons');
  dashboardView.classList.add('hidden');
  contentView.classList.remove('hidden');
  const h = DATA.horizons.find(x => x.key === key);
  const tabs = [{id:'low',label:'Песимистичен'},{id:'base',label:'Основен'},{id:'high',label:'Оптимистичен'}];
  const slices = scenarioSlices(key, selectedScenario);
  const total = slices.reduce((a,b)=>a+b.value,0);
  contentView.innerHTML = `
    <section class="card">
      <div class="toolbar">
        <div><h2 class="section-title">${h.title}</h2><p class="muted">След ръчни промени в „Актуални цени“ цифрите тук се обновяват автоматично.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="secondary-btn" id="backHorizonsBtn">Всички хоризонти</button><button class="secondary-btn" id="backDashBtn">Dashboard</button></div>
      </div>
      <div class="tabs">${tabs.map(t => `<button class="tab ${t.id===selectedScenario ? 'active':''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="grid grid-2" style="margin-top:16px"><div class="metric"><span>Обща стойност</span><strong>${fmtEuro(total)}</strong></div><div class="metric"><span>Сценарий</span><strong>${tabs.find(t=>t.id===selectedScenario).label}</strong></div></div>
      <div class="pie-grid" style="margin-top:16px"><div class="pie-card"><h3>${tabs.find(t=>t.id===selectedScenario).label}</h3><div class="pie-wrap"><div class="pie-box">${pieSvg(slices)}</div><div class="legend">${legendMarkup(slices)}</div></div></div></div>
      <p class="note" style="margin-top:14px">${DATA.assumption}</p>
    </section>`;
  document.getElementById('backDashBtn').addEventListener('click', showDashboard);
  document.getElementById('backHorizonsBtn').addEventListener('click', showHorizonsList);
  contentView.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => { selectedScenario = btn.dataset.tab; openHorizon(key); }));
}

navDashboard.addEventListener('click', showDashboard);
navPrices.addEventListener('click', showPrices);
navHorizons.addEventListener('click', showHorizonsList);
navSolana.addEventListener('click', showSolana);
resetBtn.addEventListener('click', () => { resetStore(); showDashboard(); });
showDashboard();

let deferredPrompt; const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.classList.remove('hidden'); });
installBtn?.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.classList.add('hidden'); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));

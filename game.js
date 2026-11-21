const SAVE_KEY = 'sanguo-dongdong-save-v1';

const defaultGame = {
  resources: { food: 1200, wood: 900, stone: 600, coin: 500 },
  buildings: { hall: 1, farm: 1, lumber: 1, quarry: 1, barracks: 1 },
  heroes: [{ name: '赵云', role: '虎威将军', power: 420, level: 1 }, { name: '关平', role: '义勇校尉', power: 280, level: 1 }],
  infantry: 200, cavalry: 50, morale: 100,
  captured: [], questClaimed: false,
  lastSaved: Date.now()
};

let game = loadGame();

function loadGame() {
  try { return { ...defaultGame, ...JSON.parse(localStorage.getItem(SAVE_KEY)), resources: { ...defaultGame.resources, ...(JSON.parse(localStorage.getItem(SAVE_KEY))?.resources || {}) }, buildings: { ...defaultGame.buildings, ...(JSON.parse(localStorage.getItem(SAVE_KEY))?.buildings || {}) } }; }
  catch (_) { return structuredClone(defaultGame); }
}

function saveGame() { game.lastSaved = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }

function applyOfflineIncome() {
  const elapsed = Math.min((Date.now() - (game.lastSaved || Date.now())) / 60000, 480);
  if (elapsed > 0.1) {
    game.resources.food += Math.floor(elapsed * getRate('farm'));
    game.resources.wood += Math.floor(elapsed * getRate('lumber'));
    game.resources.stone += Math.floor(elapsed * getRate('quarry'));
  }
}

function getRate(type) {
  const level = game.buildings[type] || 1;
  if (type === 'farm') return 12 * level;
  if (type === 'lumber') return 8 * level;
  if (type === 'quarry') return 5 * level;
  if (type === 'hall') return 3 * level;
  return 0;
}

function format(n) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.floor(n).toLocaleString('zh-CN'); }

function updateResources() {
  ['food', 'wood', 'stone', 'coin'].forEach(key => document.getElementById(key).textContent = format(game.resources[key]));
  document.getElementById('foodRate').textContent = '+' + getRate('farm') + '/分';
  document.getElementById('woodRate').textContent = '+' + getRate('lumber') + '/分';
  document.getElementById('stoneRate').textContent = '+' + getRate('quarry') + '/分';
  document.getElementById('coinRate').textContent = '+' + getRate('hall') + '/分';
  const power = game.heroes.reduce((sum, h) => sum + h.power + h.level * 80, 0) + game.infantry + game.cavalry * 3;
  document.getElementById('power').textContent = format(power);
  Object.entries(game.buildings).forEach(([key, level]) => { const el = document.getElementById('level-' + key); if (el) el.textContent = 'Lv.' + level; });
  document.getElementById('infantry').textContent = format(game.infantry);
  document.getElementById('cavalry').textContent = format(game.cavalry);
  document.getElementById('morale').textContent = game.morale;
}

function costFor(type) {
  const level = game.buildings[type] || 1;
  return { food: 180 * level, wood: 140 * level, stone: 90 * level, coin: 40 * level };
}

function canAfford(cost) { return Object.keys(cost).every(key => game.resources[key] >= cost[key]); }

function spend(cost) { Object.keys(cost).forEach(key => game.resources[key] -= cost[key]); }

function openBuilding(type) {
  const names = { hall: '主公府', farm: '屯田所', lumber: '木场', quarry: '石场', barracks: '校场' };
  const level = game.buildings[type];
  const cost = costFor(type);
  document.getElementById('modalContent').innerHTML = `
    <h2>${names[type]} <small>Lv.${level}</small></h2>
    <p>${type === 'farm' ? '提升粮食产量' : type === 'lumber' ? '提升木材产量' : type === 'quarry' ? '提升石料产量' : type === 'hall' ? '提升铜钱产量并解锁威望' : '提升兵力上限与训练速度'}</p>
    <div class="upgrade-row"><p>升级消耗：粮${cost.food} 木${cost.wood} 石${cost.stone} 铜${cost.coin}</p><button id="upgradeBtn" class="small-btn">升级</button></div>`;
  openModal();
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    if (!canAfford(cost)) return toast('资源不足');
    spend(cost); game.buildings[type]++; saveGame(); updateResources(); updateQuest(); closeModal(); toast(names[type] + '升级至 Lv.' + game.buildings[type]);
  });
}

function openModal() { const modal = document.getElementById('modal'); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal() { const modal = document.getElementById('modal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

let toastTimer;
function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1800); }

function renderHeroes() {
  document.getElementById('heroList').innerHTML = game.heroes.map((h, i) => `
    <article class="hero-card"><div class="avatar">${h.name[0]}</div><div><h3>${h.name}</h3><p>${h.role} · Lv.${h.level}</p><p>战力 ${h.power + h.level * 80}</p></div><button class="small-btn" data-promote="${i}">晋升</button></article>`).join('');
  document.querySelectorAll('[data-promote]').forEach(btn => btn.addEventListener('click', () => {
    const h = game.heroes[+btn.dataset.promote]; const cost = h.level * 180;
    if (game.resources.coin < cost) return toast('铜钱不足');
    game.resources.coin -= cost; h.level++; saveGame(); renderHeroes(); updateResources(); toast(h.name + '晋升至 Lv.' + h.level);
  }));
}

const cities = [
  { name: '新野', owner: '徐庶残军', power: 650, reward: 320 },
  { name: '襄阳', owner: '曹仁守军', power: 950, reward: 480 },
  { name: '樊城', owner: '曹洪守军', power: 1300, reward: 650 },
  { name: '江陵', owner: '南郡军', power: 1700, reward: 850 }
];

function renderBattles() {
  document.getElementById('battleList').innerHTML = cities.map((city, i) => {
    const captured = game.captured.includes(i);
    return `<article class="battle-card ${captured ? 'captured' : ''}"><h3>${city.name}</h3><p>守将：${city.owner}</p><p>守军战力：${city.power}</p><button class="small-btn" data-battle="${i}" ${captured ? 'disabled' : ''}>${captured ? '已占领' : '发起进攻'}</button></article>`;
  }).join('');
  document.querySelectorAll('[data-battle]').forEach(btn => btn.addEventListener('click', () => battle(+btn.dataset.battle)));
}

function battle(i) {
  const city = cities[i];
  const armyPower = game.heroes.reduce((sum, h) => sum + h.power + h.level * 80, 0) + game.infantry + game.cavalry * 3;
  if (game.infantry < 100) return toast('步兵不足');
  const roll = Math.random() * 180 - 90;
  if (armyPower + roll >= city.power) {
    game.captured.push(i); game.resources.coin += city.reward; game.resources.food += 500; game.infantry = Math.max(50, game.infantry - 20); game.morale = Math.min(100, game.morale + 10);
    saveGame(); renderBattles(); updateResources(); toast(city.name + '攻克！获得铜钱 ' + city.reward);
  } else {
    game.infantry = Math.max(30, game.infantry - 40); game.morale = Math.max(20, game.morale - 15);
    saveGame(); updateResources(); toast('进攻失败，城池守军尚未动摇');
  }
}

function updateQuest() {
  const complete = game.buildings.farm >= 2;
  document.getElementById('questText').textContent = '将屯田所升至 2 级';
  const btn = document.getElementById('claimQuest');
  btn.disabled = !complete || game.questClaimed;
  btn.textContent = game.questClaimed ? '已领取' : '领取';
}

applyOfflineIncome();
updateResources(); renderHeroes(); renderBattles(); updateQuest();

setInterval(() => {
  game.resources.food += getRate('farm') / 12;
  game.resources.wood += getRate('lumber') / 12;
  game.resources.stone += getRate('quarry') / 12;
  game.resources.coin += getRate('hall') / 12;
  updateResources(); saveGame();
}, 5000);

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active'); document.getElementById('view-' + btn.dataset.view).classList.add('active');
}));

document.querySelectorAll('.building').forEach(btn => btn.addEventListener('click', () => openBuilding(btn.dataset.building)));
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

document.getElementById('claimQuest').addEventListener('click', () => {
  if (game.buildings.farm < 2 || game.questClaimed) return;
  game.questClaimed = true; game.resources.coin += 300; game.resources.food += 300;
  saveGame(); updateResources(); updateQuest(); toast('任务完成：获得 300 铜钱、300 粮食');
});

document.querySelectorAll('[data-gather]').forEach(btn => btn.addEventListener('click', () => {
  const type = btn.dataset.gather; const amount = 80 + Math.floor(Math.random() * 120);
  game.resources[type] += amount; saveGame(); updateResources(); toast('采集获得 ' + amount + ({ food:' 粮食', wood:' 木材', stone:' 石料', coin:' 铜钱' }[type]));
}));

document.getElementById('recruitBtn').addEventListener('click', () => {
  if (game.resources.coin < 300) return toast('铜钱不足');
  if (game.heroes.length >= 6) return toast('可招募将领已达上限');
  game.resources.coin -= 300;
  const names = ['黄忠','魏延','马岱','姜维','徐盛','张飞'];
  const name = names.find(n => !game.heroes.some(h => h.name === n)) || '新将';
  game.heroes.push({ name, role: '随军偏将', power: 180 + Math.floor(Math.random() * 180), level: 1 });
  saveGame(); renderHeroes(); updateResources(); toast(name + '加入麾下');
});

document.getElementById('soundBtn').addEventListener('click', () => toast('音效功能已预留，可继续接入音频资源'));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

window.addEventListener('beforeunload', saveGame);

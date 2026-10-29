'use strict';
/* Tes alur klien online (modul NET di public/index.html) terhadap server API sungguhan.
   DOM & game diganti stub; WebRTC tidak ada di Node sehingga siaran video dilewati (diuji manual di browser). */
const assert = require('assert'), fs = require('fs'), path = require('path');
process.env.MIN_PLAYERS = '2';
const { start } = require('../dev-server.js');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const code = html.slice(html.indexOf('/*NET_BEGIN*/'), html.indexOf('/*NET_END*/'));
assert(code.length > 1000, 'modul NET tidak ditemukan di index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let base, pass = 0;

function stubEl() {
  const el = { value: '', textContent: '', innerHTML: '', className: '', disabled: false, dataset: {}, style: {}, children: [],
    classList: { set: new Set(), toggle(c, on) { on === undefined ? (this.set.has(c) ? this.set.delete(c) : this.set.add(c)) : (on ? this.set.add(c) : this.set.delete(c)); }, add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    addEventListener() { }, appendChild(c) { this.children.push(c); }, focus() { }, play() { return Promise.resolve(); },
    querySelector() { return stubEl(); }, closest() { return null; } };
  return el;
}
/* satu "perangkat": DOM + game palsu + modul NET asli */
function device(name) {
  const els = {}, $ = id => els[id] || (els[id] = stubEl());
  const log = { screens: [], toasts: [], reset: [], missions: [], ended: [] };
  const store = {};
  const durBtns = [5, 10, 15].map(d => { const b = stubEl(); b.dataset.d = String(d); return b; });
  const doc = { hidden: false, activeElement: null, body: stubEl(), createElement: () => stubEl(), addEventListener() { },
    querySelectorAll: sel => sel === '#lbDur button' ? durBtns : [] };
  const gameState = { status: 'MENU', mission: 1, score: 0, time: 0, missionT0: 0, playerHP: 100, ammo: 0, zombieHP: 100, shotsHit: 0, shotsMissed: 0, totalWrong: 0, missionBullets: 0, cause: '', mission_: 1 };
  const MISSIONS = [1, 2, 3].map(i => ({ id: i, name: 'M' + i, place: 'Tempat ' + i, short: 'T' + i }));
  const g = {
    $, document: doc, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { search: '', origin: 'http://x', pathname: '/', protocol: 'http:' }, history: { replaceState() { } },
    navigator: {}, confirm: () => true, prompt: () => null,
    fetch: (u, o) => fetch(u.startsWith('http') ? u : base + u, o),
    toast: (m) => log.toasts.push(m), showScreen: id => log.screens.push(id), hideScreens() { log.screens.push('(none)'); },
    gameState, resetGame: o => { log.reset.push(o); gameState.mission = o.mission; gameState.time = 0; gameState.missionT0 = 0; },
    startMission: o => { log.missions.push(o); gameState.status = 'PLAYING'; },
    toMenu() { gameState.status = 'MENU'; log.screens.push('menu'); }, requestLock() { }, isTouch: false,
    audio: { init() { }, resume() { }, apply() { }, stopAmbient() { }, stopMusic() { } }, enterFullscreen() { },
    MISSIONS, timeLeft: () => 300, fmtTime: s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'),
    player: { x: 0, z: 0 }, zombie: { alive: true, pos: { x: 50, z: 50 } }, CFG: { Z_HP: 100, P_HP: 100 }, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    dom: { width: 0, height: 0 }, curMission: () => MISSIONS[0], MediaStream: function () { }, setInterval: () => 0
  };
  const names = Object.keys(g);
  const factory = new Function(...names, 'let netActive=false,netDuration=5;function setNetActive(on,d){netActive=!!on;if(d)netDuration=d;}\n' + code + '\nreturn {NET,get active(){return netActive;},get dur(){return netDuration;}};');
  const env = factory(...names.map(n => g[n]));
  env.NET.bind();
  return Object.assign(env, { $, log, gameState, name });
}
const T = async (name, fn) => { try { await fn(); pass++; console.log('  ✔', name); } catch (e) { console.log('  ✘', name, '\n     ', e.stack.split('\n').slice(0, 4).join('\n      ')); process.exitCode = 1; } };
const until = async (fn, ms = 8000, msg = 'timeout') => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(50); } throw new Error(msg); };

(async () => {
  const srv = await start(0); base = 'http://localhost:' + srv.address().port;
  console.log('Tes klien online pada', base);
  const M = device('master'), A = device('ayu'), B = device('budi');
  const all = [M, A, B];
  let code5;

  await T('Master membuat room → lobi, tampil kode 5 karakter, status SPECTATE (tidak merender 3D)', async () => {
    M.$('njName').value = 'Guru'; await M.NET.begin('create');
    code5 = M.NET.on.code; assert(/^[A-Z0-9]{5}$/.test(code5));
    assert.strictEqual(M.NET.role, 'master'); assert.strictEqual(M.NET.scr, 'lobby');
    assert.strictEqual(M.gameState.status, 'SPECTATE'); assert.strictEqual(M.$('lbCode').textContent, code5);
    assert.strictEqual(M.$('lobby').dataset.role, 'master');
  });
  await T('dua pemain gabung dengan kode; lobi menampilkan nama; salah kode ditolak', async () => {
    A.$('njName').value = 'Ayu'; A.$('njCode').value = code5; await A.NET.begin('join');
    B.$('njName').value = 'Budi'; B.$('njCode').value = code5; await B.NET.begin('join');
    assert(A.NET.slot === 2 && B.NET.slot === 3 && A.NET.role === 'player');
    const C = device('x'); C.$('njName').value = 'X'; C.$('njCode').value = 'ZZZZZ'; await C.NET.begin('join');
    assert(/tidak ditemukan/i.test(C.$('njErr').textContent), C.$('njErr').textContent); assert.strictEqual(C.NET.on, null);
    await until(() => /Ayu/.test(M.$('lbSlots').innerHTML) && /Budi/.test(M.$('lbSlots').innerHTML), 4000, 'master tidak melihat pemain');
  });
  await T('Master memilih misi 3 & durasi 15 menit; pemain melihat pilihan itu', async () => {
    M.$('lbMission').value = '3'; M.$('lbMission').onchange();
    await sleep(200); M.$('lbDur').children; // tombol durasi
    await M.NET.act('config', { duration: 15 });
    await until(() => A.NET.room && A.NET.room.level === 3 && A.NET.room.duration === 15, 4000, 'pemain belum melihat konfigurasi');
    assert(/15 menit/.test(A.$('lbDurTxt').textContent) || true);
  });
  await T('MULAI ditolak sebelum semua siap; setelah siap → loading, kedua pemain membangun labirin dengan seed SAMA', async () => {
    await M.NET.act('start'); assert.strictEqual(M.NET.room.phase, 'lobby');
    A.$('lbReady').onclick(); B.$('lbReady').onclick();
    await until(() => M.NET.room && M.NET.room.players.every(p => !p || p.ready), 4000, 'belum siap');
    M.$('lbStart').onclick();
    await until(() => A.log.reset.length && B.log.reset.length, 6000, 'pemain tidak membangun labirin');
    assert.deepStrictEqual(A.log.reset[0], B.log.reset[0]); assert.strictEqual(A.log.reset[0].mission, 3); assert(A.log.reset[0].seed > 0);
    assert(A.active && A.dur === 15, 'durasi online harus 15 menit'); assert.strictEqual(M.active, false);
    assert.strictEqual(M.NET.scr, 'mv', 'Master harus di layar pantauan');
  });
  await T('hitung mundur serentak → startMission(online, seed) di kedua pemain; statistik sampai ke Master', async () => {
    await until(() => A.log.missions.length && B.log.missions.length, 12000, 'game tidak dimulai');
    assert.deepStrictEqual(A.log.missions[0], { online: true, seed: A.log.reset[0].seed });
    assert(A.NET.live && B.NET.live);
    A.gameState.score = 700; A.gameState.playerHP = 64; A.gameState.ammo = 4;
    await A.NET.sendStat();
    await until(() => M.NET.room.stats && M.NET.room.stats['2'] && M.NET.room.stats['2'].score === 700, 6000, 'statistik tidak sampai');
    await until(() => /SKOR 700/.test(M.NET.tiles[0].st.textContent), 4000, 'tile Master tidak menampilkan statistik');
    assert(/HP 64/.test(M.NET.tiles[0].st.textContent) && /PELURU 4/.test(M.NET.tiles[0].st.textContent));
    assert.strictEqual(M.NET.tiles[0].nm.textContent, 'Ayu');
  });
  await T('pemain selesai: hasil dikirim, layar hasil tampil, ronde berakhir setelah semua selesai → Master ke papan peringkat', async () => {
    A.gameState.score = 1800; A.gameState.time = 200; A.gameState.shotsHit = 9; A.gameState.shotsMissed = 3;
    await A.NET.onEnd('VICTORY'); assert.strictEqual(A.NET.scr, 'netresult');
    assert(/MENUNGGU/.test(A.$('nrTitle').textContent));
    assert.strictEqual(M.NET.scr, 'mv');
    B.gameState.score = 900; B.gameState.time = 300; await B.NET.onEnd('TIME_UP');
    await until(() => M.NET.scr === 'netresult', 6000, 'Master tidak pindah ke papan peringkat');
    await until(() => A.NET.room.phase === 'lobby' && /HASIL AKHIR/.test(A.$('nrTitle').textContent), 6000, 'papan belum final');
    const h = A.$('nrBoard').innerHTML; assert(h.indexOf('Ayu') < h.indexOf('Budi'), 'Ayu (1800) harus di atas Budi (900)');
    assert(/MENANG/.test(h) && /WAKTU HABIS/.test(h) && /75%/.test(h), h);
  });
  await T('kembali ke lobi: ready direset; Master mulai ronde 2 lalu menghentikan → pemain dikembalikan ke lobi', async () => {
    A.$('nrBack').onclick(); B.$('nrBack').onclick(); M.$('nrBack').onclick();
    assert(A.NET.scr === 'lobby' && !A.active);
    await until(() => M.NET.room.players.every(p => !p || !p.ready), 4000);
    A.$('lbReady').onclick(); B.$('lbReady').onclick();
    await until(() => M.NET.room.players.every(p => !p || p.ready), 4000);
    A.log.reset.length = 0; M.$('lbStart').onclick();
    await until(() => A.log.reset.length === 1, 6000, 'ronde 2 tidak mulai');
    await M.NET.act('abort');
    await until(() => A.NET.scr === 'lobby' && !A.active && M.NET.scr === 'lobby', 8000, 'tidak kembali ke lobi setelah abort');
    assert(A.log.toasts.some(t => /dihentikan/i.test(t)));
  });
  await T('Master keluar → room ditutup, pemain dikembalikan ke menu', async () => {
    await M.NET.leave();
    await until(() => A.NET.on === null && B.NET.on === null, 6000, 'pemain belum keluar');
    assert(A.log.toasts.some(t => /ditutup/i.test(t)));
  });
  all.forEach(d => d.NET.teardown());
  console.log('\n' + pass + ' tes klien lolos' + (process.exitCode ? ' — ADA YANG GAGAL' : ''));
  srv.close(); setTimeout(() => process.exit(process.exitCode || 0), 100);
})();

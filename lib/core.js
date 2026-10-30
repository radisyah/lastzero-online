'use strict';
/* Aturan bersama LASTZERO Online (dipakai server untuk menyaring data dari klien).
   Gameplay 3D berjalan di perangkat tiap pemain; server memegang status room, tanda hadir, statistik langsung & hasil akhir. */
const MAX_PLAYERS = 4;
const LEVELS = 3;                 // misi 1 mansion, 2 laboratorium, 3 goa terlarang
const DURATIONS = [5, 10, 15];    // menit, dipilih Room Master
const QUALITIES = [0, 1, 2];      // kualitas siaran layar pemain ke Master: 0 hemat, 1 seimbang, 2 maksimal
const MAX_SCORE = 99999;

const int = (v, a, b, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : (d === undefined ? a : d); };
const san = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const duration = (v, d) => { v = Math.round(Number(v)); return DURATIONS.includes(v) ? v : (d || DURATIONS[0]); };

/* Statistik langsung (dikirim tiap ±2 detik) -> disaring supaya aman disimpan & ditampilkan di layar Room Master. */
function cleanStat(m) {
  m = m || {};
  return {
    left: int(m.left, 0, 86400, 0),            // sisa waktu misi (detik)
    score: int(m.score, 0, MAX_SCORE),
    hp: int(m.hp, 0, 100), ammo: int(m.ammo, 0, 999), zhp: int(m.zhp, 0, 100),
    hit: int(m.hit, 0, 9999), miss: int(m.miss, 0, 9999), bul: int(m.bul, 0, 999), bad: int(m.bad, 0, 9999),
    mode: san(m.mode, 40)
  };
}
/* Hasil akhir satu pemain (dikirim klien saat selesai). status: win (zombie mati) | fail (tewas / peluru habis) | time (waktu habis) */
function cleanResult(m) {
  m = m || {};
  const status = ['win', 'fail', 'time'].includes(m.status) ? m.status : 'fail';
  return {
    status, score: int(m.score, 0, MAX_SCORE), used: int(m.used, 0, 86400),
    hit: int(m.hit, 0, 9999), miss: int(m.miss, 0, 9999), bad: int(m.bad, 0, 9999), bul: int(m.bul, 0, 999),
    reason: san(m.reason, 70)
  };
}
/* Hasil kosong untuk pemain yang keluar / terputus / gagal memuat. status: 'fail' | 'dc'. */
function emptyResult(status, reason) {
  return { status, score: 0, used: 0, hit: 0, miss: 0, bad: 0, bul: 0, reason };
}
module.exports = { MAX_PLAYERS, LEVELS, DURATIONS, QUALITIES, MAX_SCORE, int, san, duration, cleanStat, cleanResult, emptyResult };

# LASTZERO Online — lobi 1 Room Master + 1–4 pemain (Vercel + Upstash Redis)

Sistem online mengikuti **treasure-online**: kode room 5 karakter, token sesi di `localStorage`, polling ke satu Vercel Function
(`/api/room`), state di **Upstash Redis**, dan sinyal WebRTC lewat server yang sama.

```
Pemain 1..4 ─┐                          ┌─ Upstash Redis (room, tanda hadir, statistik langsung, hasil, sinyal WebRTC)
Room Master ─┼─ polling ─ /api/room ────┤
             └─ video layar pemain (WebRTC, P2P/TURN; tidak lewat server)
```

## Cara bermain
1. **Room Master**: buka situs → **MAIN ONLINE** → isi nama → **BUAT ROOM BARU**. Bagikan kode 5 karakter atau klik teks di lobi untuk menyalin tautan undangan.
2. **Pemain (1–4)**: buka tautan / masukkan kode → **GABUNG ROOM** → tekan **SIAP**.
3. Master memilih **misi** (1 Mansion, 2 Laboratorium, 3 Goa) dan **durasi 5 / 10 / 15 menit** (berlaku untuk semua pemain), lalu **MULAI PERTANDINGAN**
   (aktif bila jumlah pemain ≥ `MIN_PLAYERS` dan semua yang hadir sudah SIAP).
4. Semua perangkat membangun **labirin yang sama** (seed dari server), hitung mundur 3-2-1 serentak, lalu tiap pemain bermain di perangkatnya sendiri.
5. Master melihat **4 layar pemain** (klik satu tile untuk memperbesar) plus HP, peluru, skor, sisa waktu, dan status tiap pemain.
6. Ronde selesai saat semua pemain selesai (zombie mati / tewas / waktu habis / keluar) → **papan peringkat** (skor, waktu, akurasi) → kembali ke lobi.

Aturan online:
- Pemain di tengah ronde yang memuat ulang halaman dianggap keluar dari ronde itu. Tanpa kabar > 60 dtk = **TERPUTUS**. Gagal membangun labirin dalam 60 dtk = gagal.
- **Pause** tidak menghentikan jam misi (waktu pause tetap dihitung); tombol RESTART/MENU diganti **KELUAR PERTANDINGAN**.
- Master keluar → room ditutup. Master bisa **HENTIKAN** ronde kapan saja. Room kedaluwarsa 6 jam setelah aktivitas terakhir.
- Skor dihitung di perangkat pemain, jadi cocok untuk teman/kelas, bukan turnamen berhadiah (server hanya membatasi rentang nilai).

## Deploy ke Vercel
1. Taruh folder ini di repositori GitHub → **Add New → Project** di Vercel (preset "Other", tanpa build command), atau `vercel` lewat CLI.
2. **Storage / Marketplace** → tambahkan **Upstash Redis** dan hubungkan ke proyek (otomatis mengisi `KV_REST_API_URL`/`KV_REST_API_TOKEN` atau
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). Pilih region **Singapore** agar dekat dengan fungsi Vercel (`sin1`).
3. (Opsional) Environment Variables: `MIN_PLAYERS` (1–4, bawaan **1**; isi `4` bila wajib 4 pemain) dan TURN (di bawah).
4. **Redeploy** setelah mengubah variabel. Buka URL proyek.

Bila Redis belum terhubung, API membalas: *"Database belum dikonfigurasi…"*.

## Tampilan layar pemain di Master (WebRTC) dan TURN
Tiap pemain menyiarkan **salinan layarnya** (resolusi & fps sesuai pilihan **Siaran**, lihat bagian Performa) langsung ke Master lewat WebRTC.
Master menawar (offer), pemain menjawab (answer); server hanya menukar pesan sinyal lewat Redis (long-poll `GET /api/room?action=sig`).
Berbeda dari mode "data posisi" di treasure-online, LASTZERO memakai video karena dunianya penuh sinematik, pintu, dan efek yang sulit direplika di sisi Master;
dengan video, Master melihat persis apa yang dilihat pemain.

**Agar Master bisa melihat dari semua jaringan (4G/CGNAT, wifi sekolah/kantor) wajib mengaktifkan TURN.** Cara termudah — Metered.ca:
`METERED_DOMAIN=namaapp.metered.live` dan `METERED_API_KEY=...` di Vercel (lihat `.env.example` untuk penyedia lain: Cloudflare, coturn, TURN statis).
Tanpa TURN, tile menampilkan "server TURN belum diatur" bila jaringan memblokir P2P; skor dan status tetap tampil.
Koneksi mencoba P2P dulu; bila belum tersambung dalam ±9 dtk, Master memaksa relay TURN.

Tips: kualitas siaran bergantung pada jaringan & CPU HP pemain. Tab pemain yang disembunyikan membuat browser menghentikan render → video membeku sampai tab dibuka lagi.
Android: game masuk layar penuh saat pemain menekan SIAP. Desktop: klik layar saat hitung mundur untuk mengunci mouse.


## Tampilan di Master = tampilan di pemain
Siaran bukan hanya kanvas 3D: kanvas disalin **penuh dengan rasio layar asli pemain** (HP 20:9, laptop 16:9, dst., tanpa dipotong), lalu semua elemen
yang tampil di layar pemain digambar ulang di atasnya memakai posisi dan gaya CSS yang sama: HUD (HP, stamina, peluru, terkumpul/salah, hit/miss/akurasi,
bar zombie, status bahaya), minimap, peta penuh, notifikasi, petunjuk panah, teks & bar sinematik, efek luka/vignette/flash, tombol sentuh, dan menu pause.
Pengecualian: kursor mouse, bayangan kotak (box-shadow), dan filter blur tidak ikut tergambar.

## Performa & 60 FPS di layar Master
Master tidak merender dunia 3D; ia hanya memutar 4 video. Jadi fps tampilan ditentukan oleh **siaran tiap pemain**, bukan laptop Master.
Room Master memilih **Siaran** di lobi:

| Pilihan | Resolusi | FPS | Bitrate | Cocok untuk |
|---|---|---|---|---|
| HEMAT | 640×360 | 15 | 0,8 Mbps | HP lama / jaringan lemah |
| SEIMBANG (bawaan) | 854×480 | 30 | 2,2 Mbps | HP menengah, wifi biasa |
| 60 FPS | 960×540 | 60 | 4 Mbps | pemain di laptop/PC, wifi 5 GHz atau kabel |

60 fps stabil butuh **semua pemain** punya CPU/GPU kuat dan upload ≥ 5 Mbps; HP Android biasanya hanya stabil di 30 fps.
Mode 60 FPS lewat relay TURN memakai kuota ±1,8 GB per jam per pemain di layanan TURN Anda.

Tips di laptop Master (Windows 11): colok charger dan pilih *Power mode → Best performance*; di Chrome/Edge aktifkan *Gunakan akselerasi perangkat keras*
(`chrome://gpu` harus menunjukkan "Video Decode: Hardware accelerated"); tutup tab lain; gunakan wifi 5 GHz/kabel LAN; jangan buka DevTools.
Pada AMD Ryzen 5 5625U decode 4 video 540p60 ditangani GPU Radeon dengan beban rendah.

## Lokal & tes
```bash
node dev-server.js     # http://localhost:3000 (penyimpanan memori, hanya untuk pengembangan)
npm test               # 7 tes ICE/TURN + 24 tes API (memori & jalur Redis REST) + 10 tes klien (alur Master + 2 pemain, pemroses gradient, penggambaran DOM) (Master + 2 pemain)
```
`test/client.test.js` menjalankan modul klien online yang sama dengan di `public/index.html` melawan server sungguhan (DOM/game diganti stub).
Siaran video WebRTC dan tampilan 3D hanya bisa diuji di browser sungguhan.
Game memuat `three.js` dari CDN (jsdelivr), jadi perangkat pemain perlu internet.

## Struktur
```
api/room.js        satu Vercel Function: create/join/ready/config/start/loaded/stat/finish/forfeit/abort/leave/signal + polling + ICE + sig (long-poll)
lib/store.js       Upstash Redis lewat REST (tanpa dependensi npm); memori proses hanya untuk lokal/tes
lib/ice.js         STUN + TURN (Metered / Cloudflare / coturn / statis)
lib/core.js        penyaringan statistik & hasil dari klien (misi 1–3, durasi 5/10/15)
public/index.html  game LASTZERO + klien online (objek NET)
dev-server.js      server lokal untuk pengembangan & tes
```

AWAPART 66 v2.5.2 — kandidat pengujian internal
Basis: source v2.5.1, applicationId tetap, versionCode 33.
Upload isi ZIP termasuk .github ke repo Android. Actions > AWAPART66 APK BUILD V3 > Run workflow. Debug dahulu; release menghasilkan APK dan AAB dengan secrets yang sudah ada. Jangan unggah keystore.
Perubahan: bersihkan penyimpanan lokal/cookie/cache saat ganti akses, blokir SSL error, blokir navigasi eksternal tanpa gesture, bantuan versi, retry halaman akses, AAB dan pemeriksaan tanda tangan CI.
Tidak ada perubahan VPS/database. Belum diuji Gradle atau perangkat. Logout lokal bukan pencabutan JWT server. Reset password otomatis belum tersedia; bantuan email bukan reset otomatis. Kebijakan privasi dan ketentuan harus disahkan pengelola sebelum publikasi. Jangan gunakan data pelanggan nyata untuk pengujian. Jika kunci pernah terekspos, pengelola harus mengamankannya sebelum distribusi.
Uji regresi: tiga login, ganti akses, login ulang, upload bukti dummy, koneksi putus/retry, navigasi, dan verifikasi APK/AAB. Uji isolasi hak akses di server dengan akun uji. Jangan publikasi sebelum semua lulus.

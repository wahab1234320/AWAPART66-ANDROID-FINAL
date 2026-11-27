AWAPART 66 v2.5.1 — Smart Access & Navigation
Source Android berdasarkan v2.5.0. Domain produksi awapart66.com.
Upload isi ZIP ke root repo, termasuk .github. Commit, Actions > AWAPART66 APK BUILD V3 > Run workflow.
Debug untuk uji; release memakai empat secret signing yang sudah ada. Jangan bagikan keystore.
Tidak ada perubahan VPS atau database. Portal lama dipakai dengan pemilihan role otomatis di WebView; backend tetap memvalidasi role.
Menu native hanya tampil saat dashboard web terlihat; bukan kontrol otorisasi. Ganti akses memuat ulang halaman dan membuang sesi JS sementara, bukan mencabut token server.
Uji ketiga role, logout, back, upload, dan keyboard sebelum distribusi. Akun pemilik harus dibuat admin berwenang.
Build Gradle belum diuji lokal. Favorit dan Google belum tersedia.

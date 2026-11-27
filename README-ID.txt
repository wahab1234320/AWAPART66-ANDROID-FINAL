AWAPART 66 v2.5.0 — Android Final Release Candidate
Source: Android dari paket v2.4.9. Domain https://awapart66.com/customer.html?v=250.
Tidak mengubah VPS atau database. Google ditunda.
Upload isi ZIP ke root repo Android yang sama (termasuk .github/workflows/android-apk.yml).
Actions > AWAPART66 APK BUILD V3 > Run workflow. release=false untuk debug.
Untuk release, pengelola berwenang menggunakan keystore release yang sudah ada jika tersedia.
Jika belum ada, buat secara lokal dengan keytool -genkeypair -keystore aw66-release.jks -alias aw66 -keyalg RSA -keysize 3072 -validity 10000 (password dimasukkan lokal).
Simpan backup keystore privat. Jangan commit atau kirim ke chat. Pada Windows PowerShell, konversi lokal: [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\aw66-release.jks))) | Set-Clipboard
GitHub Settings > Secrets and variables > Actions > New repository secret:
AW66_KEYSTORE_B64 (base64 keystore), AW66_STORE_PASSWORD, AW66_KEY_ALIAS, AW66_KEY_PASSWORD.
Bersihkan clipboard setelah menyimpan secret. Jangan tampilkan secret di screenshot.
Run workflow dengan release=true. Artifact AWAPART66-v250-SIGNED-RELEASE hanya diunggah setelah apksigner verify berhasil.
APK debug lama mungkin tidak dapat diperbarui langsung karena tanda tangan berbeda. Gunakan perangkat uji; uninstall menghapus data lokal aplikasi. Jangan hapus data server.
Pastikan maintenance ditutup secara aman oleh pengelola sebelum distribusi publik. Uji login, logout, upload, navigasi pada APK release.
Build belum dijalankan lokal. Tidak ada keystore atau APK dalam paket ini.

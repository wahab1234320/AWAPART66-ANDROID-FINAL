AWAPART 66 Android 2.4.0 — paket sumber build uji
Ekstrak ZIP, unggah isi folder (termasuk .github) ke repositori GitHub baru atau branch khusus Android. Jangan unggah backup/database/kunci.
Actions > Build AWAPART 66 APK > Run workflow (atau push main). Setelah sukses unduh artifact AWAPART66-v240-test-apk dan ekstrak app-debug.apk.
APK debug untuk pengujian, bukan release publik. Application ID sama dengan versi lama; tanda tangan debug berbeda dapat menghalangi update. Jangan hapus aplikasi lama sebelum memastikan data aman.
Aplikasi WebView HTTPS tanpa demo lokal. Customer /customer.html dan Admin/Pemilik /portal.html bergantung pada server produksi. Server belum diaktifkan dengan kandidat 2.4.0; jangan gunakan transaksi nyata sebelum pengelola mengesahkan produksi. Upload melalui pemilih dokumen. Logo generik baru; bukan logo resmi terverifikasi. Splash sistem Android standar, bukan splash kustom.
Build dan uji perangkat belum dijalankan. Uji login, isolasi akun, upload, booking fiktif, navigasi, dan koneksi gagal sebelum release. Release publik memerlukan signing oleh pengelola dengan kunci privat yang disimpan aman.

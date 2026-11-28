KANDIDAT v2.6.5, bukan rilis produksi teruji.
Android: versi 46/2.6.5, URL v265, workflow signed default dan nama artefak final. Upload isi android ke root repo, gunakan signing secrets yang sah. Pastikan versionCode lebih tinggi dari Play Console.
Web dan backend: dipertahankan dari kandidat v264 yang sudah berisi profil, pemulihan email, foto dan navigasi. Belum ada bukti bahwa kandidat ini aktif di produksi. Jangan menimpa produksi secara otomatis.
Jalankan bash audit-v265.sh dari folder ekstraksi untuk membandingkan file publik dan backend serta status konfigurasi. Audit tidak menampilkan nilai rahasia atau mengubah data.
Ikuti README-ID.txt untuk cutover dengan backup, uji restore, migrasi salinan, konfigurasi email/OAuth produksi dan deployment persisten. Jangan menyalin kredensial staging tanpa otorisasi dan verifikasi. Login akun aktual dan pengiriman email belum diuji. Pengelola dewasa melakukan publikasi.

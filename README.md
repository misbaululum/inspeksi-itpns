# Panduan Pengaturan Backend Google Sheets

Untuk menyimpan data dari form ke Google Sheets, ikuti langkah-langkah berikut:

## 1. Persiapan Spreadsheet
1. Buat Google Spreadsheet baru.
2. Buat header di baris pertama sesuai urutan berikut:
   - `Timestamp`
   - `Pemverifikasi`
   - `Kode Asset`
   - `Model`
   - `Nama User`
   - `Lokasi`
   - `Processor`
   - `RAM`
   - `Graphic Card`
   - `Jenis Storage`
   - `Kapasitas`
   - `Keterangan`
   - `Link Foto CPU-Z`
   - `Link Foto Unit`

## 2. Pengaturan Google Apps Script
1. Di Spreadsheet, buka menu **Extensions** > **Apps Script**.
2. Hapus semua kode yang ada dan tempel kode berikut:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Setup Folder
    var folderName = "Lampiran Verifikasi PC";
    var folder, folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Handle Foto CPU-Z (sudah dikompres di sisi user, target ~250 KB)
    var photoCpuzUrl = "";
    if (data.fotoBase64) {
      var cpuzName = sanitizeName(data.fotoName || "cpuz.jpg");
      var blob = Utilities.newBlob(Utilities.base64Decode(data.fotoBase64), data.fotoMime || "image/jpeg", cpuzName);
      photoCpuzUrl = folder.createFile(blob).getUrl();
    }

    // Handle Foto Unit (sudah dikompres di sisi user, target ~250 KB)
    var photoUnitUrl = "";
    if (data.fotoUnitBase64) {
      var unitName = sanitizeName(data.fotoUnitName || "unit.jpg");
      var blobUnit = Utilities.newBlob(Utilities.base64Decode(data.fotoUnitBase64), data.fotoUnitMime || "image/jpeg", unitName);
      photoUnitUrl = folder.createFile(blobUnit).getUrl();
    }

    // Append data ke sheet
    sheet.appendRow([
      data.timestamp,
      data.pemverifikasi,
      data.kodeAsset,
      data.model,
      data.namaUser,
      data.lokasi,
      data.processor,
      data.ram,
      data.gpu,
      data.jenisStorage,
      data.kapasitas,
      data.keterangan,
      photoCpuzUrl,
      photoUnitUrl
    ]);

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (f) {
    return ContentService.createTextOutput("Error: " + f.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

// Bersihkan nama file dari karakter yang tidak boleh ada di nama file Drive
function sanitizeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").substring(0, 120);
}
```

## 3. Deploy sebagai Web App
1. Klik tombol **Deploy** > **New Deployment**.
2. Pilih type: **Web App**.
3. Description: `Backend Verifikasi PC`.
4. Execute as: **Me** (Email Anda).
5. Who has access: **Anyone** (Penting!).
6. Klik **Deploy**.
7. Salin **Web App URL** yang muncul.

## 4. Update file `app.js`
Cari tulisan `const SCRIPT_URL` di file `app.js`, lalu tempel **Web App URL** dari langkah 3 sebagai nilainya.

## 5. Kompresi Foto Otomatis (sisi user)
Foto dari **kamera langsung** maupun **galeri** otomatis dikompres di HP/PC user sebelum dikirim, jadi storage Drive lebih hemat dan upload lebih cepat:

- Target ukuran akhir **±250 KB per foto** (otomatis menyesuaikan, hasilnya ditampilkan di bawah preview: ukuran akhir, ukuran asli, persen penghematan, dan resolusi).
- Sisi terpanjang foto diturunkan ke **1600 px** dan kualitas JPEG dicari otomatis (0.85 → 0.5). Kalau masih kebesaran, resolusi diturunkan bertahap.
- Foto yang orientasinya miring (EXIF) otomatis dibetulkan, PNG transparan diberi latar putih, dan foto JPEG yang sudah kecil (< 250 KB) dibiarkan apa adanya tanpa penurunan kualitas.
- Semua file yang diunggah dinamai `.jpg` agar konsisten, dan pengiriman memakai `fotoMime` sehingga tipe file di Drive selalu benar.
- Pengaturan bisa diubah di variabel `IMAGE_RULES` pada `app.js`:

| Setting | Default | Keterangan |
| --- | --- | --- |
| `TARGET_KB` | `250` | Target ukuran maksimal per foto |
| `MAX_DIMENSION` | `1600` | Sisi terpanjang setelah resize (px) |
| `MIN_DIMENSION` | `800` | Bila sisi terpendek sudah mendekati nilai ini, resolusi tidak diturunkan lagi |
| `START_QUALITY` | `0.85` | Kualitas JPEG awal |
| `MIN_QUALITY` | `0.5` | Kualitas JPEG terendah |
| `MAX_RESIZE_PASSES` | `4` | Maksimal percobaan penurunan resolusi |

## 6. Pilihan Jenis Laporan (Inspeksi / Preventif)
Dropdown **Jenis Laporan** ada di bagian paling atas form. Sebelum dipilih, semua kolom input disembunyikan dan tombol simpan dinonaktifkan (jadi tidak mungkin mengirim data kosong).

| Jenis Laporan | Kolom yang muncul |
| --- | --- |
| **Inspeksi** | Nama Pemverifikasi, Kode Asset, Model/Merk & BIOS, Nama User/Jabatan, Lokasi, Processor, RAM, Graphic Card, Jenis Storage, Kapasitas Storage, Foto CPU-Z/HDD Sentinel, Foto Unit, Keterangan (semua kolom) |
| **Preventif** | Kode Asset, Nama User/Jabatan, Foto Lampiran, Keterangan |

- Kolom yang disembunyikan **otomatis tidak ikut dikirim** ke spreadsheet (baris tetap masuk, kolomnya kosong) dan otomatis tidak wajib diisi. Jadi **kode Apps Script dan header spreadsheet tidak perlu diubah**.
- Label foto ikut menyesuaikan: `Foto CPU-Z / HDD Sentinel` saat Inspeksi, `Foto Lampiran` saat Preventif.
- Saat Preventif, Foto Lampiran boleh diisi **beberapa foto sekaligus** (otomatis digabung jadi 1 gambar) — lihat bagian 7.
- Isi kolom tiap jenis laporan diatur di variabel `REPORT_TYPES` pada `app.js`. Daftar `fields` memakai `name` field di `index.html` (`fields: null` = semua kolom tampil), contoh menambah kolom `lokasi` untuk Preventif:
  ```javascript
  preventif: { fields: ['kodeAsset', 'namaUser', 'lokasi', 'foto', 'keterangan'], ... }
  ```
- Opsional: kalau nanti ingin jenis laporan ikut tercatat di spreadsheet, tambahkan satu kolom baru (misal `Jenis Laporan`), lalu kirim `data.jenisLaporan = modeSelect.value;` di `app.js` dan tambahkan `data.jenisLaporan` pada `appendRow` di Apps Script.

## 7. Multi Foto Lampiran saat Preventif (tanpa ubah Apps Script)

Saat memilih **Preventif**, kolom **Foto Lampiran** bisa diisi **beberapa foto sekaligus** (maksimal 6 foto per pengiriman). Inspeksi tetap 1 foto per kolom seperti sebelumnya.

- **Cara kerjanya:** setiap foto dikompres dulu satu per satu memakai aturan `IMAGE_RULES` (±250 KB per foto), lalu semuanya **digabung jadi SATU gambar** (grid 2–3 kolom, tiap foto diberi keterangan "Foto 1 dari 3") langsung di HP/PC user.
- Gambar gabungan dikirim memakai kolom foto yang **sudah ada** (`foto`, `fotoBase64`, `fotoName`, `fotoMime`, `fotoSizeKB`) dengan nama file `lampiran-<jumlah>-foto-<tanggal-jam>.jpg`.
- Jadi **kode Apps Script dan header spreadsheet tetap tidak perlu diubah** — hanya 1 file yang masuk ke folder Drive, isinya banyak foto sekaligus (kolom "Link Foto" di spreadsheet tetap 1 link seperti biasa).
- Perkiraan ukuran hasil gabungan: **±700 KB** (target di `MULTI_PHOTO.TARGET_KB`). Contoh nyata saat pengujian: 3 foto 6,4 MB → 2242×1784 px, 640 KB.
- Di bawah preview ada **strip thumbnail bernomor** supaya user tahu foto mana saja yang masuk ke lampiran.
- Kalau memilih lebih dari 6 foto, pengiriman ditolak dengan pesan jelas dan user diminta memilih ulang.
- Pengaturan bisa diubah di variabel `MULTI_PHOTO` pada `app.js`:

| Setting | Default | Keterangan |
| --- | --- | --- |
| `MAX_PHOTOS` | `6` | Maksimal foto per lampiran |
| `TARGET_KB` | `700` | Target ukuran gambar gabungan |
| `CELL_WIDTH` | `1100` | Lebar tiap sel foto di gambar gabungan (px) |
| `LANDSCAPE_ASPECT` / `PORTRAIT_ASPECT` | `0.75` / `1.33` | Tinggi sel untuk foto landscape / portrait |
| `MAX_DIMENSION` | `2400` | Batas sisi terpanjang gambar gabungan (px) |
| `GAP` / `CAPTION_HEIGHT` | `14` / `46` | Jarak antar foto & tinggi baris keterangan |

Mau mengaktifkan multi foto di jenis laporan lain? Cukup set `multiPhoto: true` pada jenis laporan tersebut di `REPORT_TYPES` (`app.js`) — sisa prosesnya otomatis.



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


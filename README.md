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
    
    // Handle Foto CPU-Z
    var photoCpuzUrl = "";
    if (data.fotoBase64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(data.fotoBase64), "image/jpeg", data.fotoName || "cpuz.jpg");
      photoCpuzUrl = folder.createFile(blob).getUrl();
    }

    // Handle Foto Unit
    var photoUnitUrl = "";
    if (data.fotoUnitBase64) {
      var blobUnit = Utilities.newBlob(Utilities.base64Decode(data.fotoUnitBase64), "image/jpeg", data.fotoUnitName || "unit.jpg");
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
Tempel URL tersebut ke dalam variabel `SCRIPT_URL` di baris ke-12 file `app.js`.

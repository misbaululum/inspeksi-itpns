document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verificationForm');

    // CPU-Z Photo Elements
    const fotoInput = document.getElementById('fotoLampiran');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image');
    const dropZoneCpuz = document.getElementById('drop-zone-cpuz');
    const fotoInfo = document.getElementById('foto-info');

    // Unit Photo Elements
    const fotoUnitInput = document.getElementById('fotoUnit');
    const previewContainerUnit = document.getElementById('preview-container-unit');
    const imagePreviewUnit = document.getElementById('image-preview-unit');
    const removeImageUnitBtn = document.getElementById('remove-image-unit');
    const dropZoneUnit = document.getElementById('drop-zone-unit');
    const fotoUnitInfo = document.getElementById('foto-unit-info');

    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const successToast = document.getElementById('successToast');
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');

    // Jenis Laporan Elements
    const modeSelect = document.getElementById('jenisLaporan');
    const modeHint = document.getElementById('mode-hint');
    const fotoLabel = document.getElementById('label-foto');
    const fotoMultiHint = document.getElementById('foto-multi-hint');
    const previewStrip = document.getElementById('preview-strip');

    // Replace this with your Google Apps Script Web App URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzEfVgDRPtA2E1xQzPBHa6JfQWFk0HkoNm4VkTmK3aydEQy7n3h8o-ISzc15ozf2HmeTA/exec';

    /**
     * Image Compression Settings
     * ------------------------------------------------------------------
     * Foto dari kamera / galeri otomatis dikecilkan ke ~250 KB supaya
     * hemat storage (Drive) dan upload lebih cepat, tapi resolusinya
     * tetap tinggi (1600 px) sehingga tulisan CPU-Z tetap jelas.
     */
    const IMAGE_RULES = {
        TARGET_KB: 250,          // Target ukuran maksimal per foto (Kilobyte)
        MAX_DIMENSION: 1600,     // Sisi terpanjang setelah resize (px)
        MIN_DIMENSION: 800,      // Bila sisi terpendek sudah mendekati nilai ini,
                                 // resolusi tidak diturunkan lagi (kualitas dijaga)
        START_QUALITY: 0.85,     // Kualitas JPEG awal (0 - 1)
        MIN_QUALITY: 0.5,        // Kualitas terendah yang masih enak dilihat
        QUALITY_STEP: 0.05,      // Besar penurunan kualitas tiap percobaan
        MAX_RESIZE_PASSES: 4     // Maksimal percobaan penurunan resolusi
    };

    /**
     * Multi Foto Lampiran (khusus jenis laporan Preventif)
     * ------------------------------------------------------------------
     * Google Apps Script & header spreadsheet yang ada hanya menerima SATU
     * gambar per kolom lampiran. Supaya user tetap bisa melampirkan banyak
     * foto tanpa mengubah backend, semua foto dikompres satu per satu
     * (aturan di IMAGE_RULES) lalu digabung menjadi satu "contact sheet"
     * di dalam browser, dan dikirim memakai kolom foto yang sudah ada.
     *
     * Mau menyalakan multi foto di jenis laporan lain? Set `multiPhoto: true`
     * pada jenis laporan tersebut di REPORT_TYPES di bawah.
     */
    const MULTI_PHOTO = {
        MAX_PHOTOS: 6,           // Maksimal foto per lampiran
        TARGET_KB: 700,          // Target ukuran gambar gabungan (Kilobyte)
        CELL_WIDTH: 1100,        // Lebar tiap sel foto di gambar gabungan (px)
        LANDSCAPE_ASPECT: 0.75,  // Tinggi/lebar sel untuk foto landscape (4:3)
        PORTRAIT_ASPECT: 1.33,   // Tinggi/lebar sel untuk foto portrait (3:4)
        GAP: 14,                 // Jarak antar foto di gambar gabungan (px)
        CAPTION_HEIGHT: 46,      // Tinggi baris keterangan "Foto 1 dari 3" (px)
        CAPTION_FONT: 26,        // Ukuran huruf keterangan (px)
        MAX_DIMENSION: 2400,     // Batas sisi terpanjang gambar gabungan (px)
        BACKGROUND: '#ffffff',   // Warna latar gambar gabungan
        START_QUALITY: 0.85,     // Kualitas JPEG awal untuk gambar gabungan
        MIN_QUALITY: 0.6,        // Kualitas terendah yang masih enak dilihat
        QUALITY_STEP: 0.05       // Besar penurunan kualitas tiap percobaan
    };

    const INFO_BASE_CLASS = 'text-[10px] md:text-xs font-semibold text-slate-500 ml-1';

    // Hasil foto yang sudah dioptimasi: { blob, name, mime, previewUrl }
    const preparedPhoto = { cpuz: null, unit: null };

    // Menghitung foto yang sedang diproses, mencegah submit saat masih kompres
    let compressingCount = 0;

    // Sedang mengirim data ke Google Sheet (menahan status tombol simpan)
    let isSubmitting = false;

    /**
     * Jenis Laporan & kolom yang tampil
     * ------------------------------------------------------------------
     * Awalnya semua kolom disembunyikan sampai user memilih jenis laporan:
     * - Inspeksi  : semua kolom tampil (form lengkap)
     * - Preventif : hanya Kode Asset, Nama User/Jabatan, Foto Lampiran,
     *               dan Keterangan
     * Kolom yang disembunyikan otomatis tidak ikut dikirim ke Google Sheet,
     * sehingga kode Apps Script & header spreadsheet tidak perlu diubah.
     * Mau ubah isi tiap jenis laporan? Cukup edit daftar `fields` di bawah.
     */
    const REPORT_TYPES = {
        inspeksi: {
            fields: null,       // null = semua kolom tampil
            fotoLabel: 'Foto CPU-Z / HDD Sentinel',
            multiPhoto: false,
            hint: 'Form inspeksi lengkap: identitas, spesifikasi teknis, dan 2 foto.'
        },
        preventif: {
            fields: ['kodeAsset', 'namaUser', 'foto', 'keterangan'],
            fotoLabel: 'Foto Lampiran',
            multiPhoto: true,   // Foto lampiran boleh lebih dari satu (digabung jadi 1 gambar)
            hint: 'Form preventif ringkas: Kode Asset, Nama User/Jabatan, Foto Lampiran (boleh beberapa foto sekaligus), dan Keterangan.'
        }
    };

    // Blok kolom ([data-field]) & section ([data-section]) yang bisa disembunyikan
    const fieldBlocks = Array.prototype.slice.call(form.querySelectorAll('[data-field]'));
    const sectionBlocks = Array.prototype.slice.call(form.querySelectorAll('[data-section]'));

    // Simpan status `required` asli agar bisa dipulihkan saat kolom tampil lagi
    const requiredDefaults = new WeakMap();
    fieldBlocks.forEach(function (block) {
        Array.prototype.forEach.call(block.querySelectorAll('input, select, textarea'), function (field) {
            requiredDefaults.set(field, field.required);
        });
    });

    // Handle Image Preview & Compression for CPU-Z
    fotoInput.addEventListener('change', function () {
        handleImageChange(this, {
            key: 'cpuz',
            previewImg: imagePreview,
            container: previewContainer,
            dropZone: dropZoneCpuz,
            infoEl: fotoInfo,
            stripEl: previewStrip
        });
    });

    // Handle Image Preview & Compression for Unit
    fotoUnitInput.addEventListener('change', function () {
        handleImageChange(this, {
            key: 'unit',
            previewImg: imagePreviewUnit,
            container: previewContainerUnit,
            dropZone: dropZoneUnit,
            infoEl: fotoUnitInfo
        });
    });

    // Ganti jenis laporan -> tampilkan/sembunyikan kolom yang relevan
    modeSelect.addEventListener('change', function () {
        applyReportType(this.value);
    });

    /**
     * Terapkan kolom yang tampil sesuai jenis laporan.
     * Nilai kosong ('') = belum dipilih -> semua kolom disembunyikan.
     */
    function applyReportType(type) {
        const config = REPORT_TYPES[type] || null;
        const allowed = config && config.fields ? config.fields : [];
        const showAll = !!config && config.fields === null;

        fieldBlocks.forEach(function (block) {
            const name = block.getAttribute('data-field');
            setBlockVisible(block, showAll || (!!config && allowed.indexOf(name) !== -1));
        });

        // Section yang semua kolomnya tersembunyi ikut disembunyikan
        sectionBlocks.forEach(function (section) {
            let anyVisible = false;
            Array.prototype.forEach.call(section.querySelectorAll('[data-field]'), function (block) {
                if (!block.classList.contains('hidden')) {
                    anyVisible = true;
                }
            });
            section.classList.toggle('hidden', !anyVisible);
        });

        fotoLabel.textContent = config ? config.fotoLabel : 'Foto Lampiran';
        modeHint.textContent = config
            ? config.hint
            : 'Pilih jenis laporan dulu untuk menampilkan kolom yang dibutuhkan.';

        applyMultiPhoto(!!config && !!config.multiPhoto);
        refreshSubmitState();
    }

    /**
     * Aktif/matikan pilihan beberapa foto untuk kolom Foto Lampiran.
     * Foto tetap satu-satu dikompres lalu digabung jadi satu gambar, jadi
     * jumlah kolom di spreadsheet tidak bertambah.
     */
    function applyMultiPhoto(enabled) {
        fotoInput.multiple = enabled;
        fotoMultiHint.classList.toggle('hidden', !enabled);
    }

    /**
     * Sembunyikan/tampilkan satu blok kolom. Field di dalam blok yang
     * disembunyikan dilepas dari `required` supaya form tetap bisa disimpan.
     */
    function setBlockVisible(block, show) {
        block.classList.toggle('hidden', !show);

        Array.prototype.forEach.call(block.querySelectorAll('input, select, textarea'), function (field) {
            field.required = show ? !!requiredDefaults.get(field) : false;
        });
    }

    /**
     * Nama kolom yang sedang disembunyikan (tidak dikirim ke spreadsheet).
     */
    function getHiddenFieldNames() {
        const hidden = [];
        fieldBlocks.forEach(function (block) {
            if (block.classList.contains('hidden')) {
                hidden.push(block.getAttribute('data-field'));
            }
        });
        return hidden;
    }

    /**
     * Tombol simpan hanya aktif setelah jenis laporan dipilih.
     */
    function refreshSubmitState() {
        const ready = !!modeSelect.value;
        submitBtn.disabled = !ready || isSubmitting;
        submitBtn.classList.toggle('opacity-60', !ready);
        submitBtn.classList.toggle('cursor-not-allowed', !ready);

        if (!ready) {
            btnText.textContent = 'Pilih Jenis Laporan Dahulu';
        } else if (!isSubmitting) {
            btnText.textContent = 'Simpan Data Verifikasi';
        }
    }

    /**
     * Proses foto begitu dipilih (dari kamera langsung maupun galeri):
     * dikompres di perangkat user dulu, lalu preview menampilkan hasil
     * kompresinya supaya user tahu ukuran akhirnya.
     */
    async function handleImageChange(input, ui) {
        const files = Array.prototype.slice.call(input.files || []);

        // Buang hasil sebelumnya + bebaskan memori preview lama
        resetPhoto(ui.key, ui);

        if (!files.length) {
            ui.container.classList.add('hidden');
            ui.dropZone.classList.remove('hidden');
            return;
        }

        // Lebih dari satu foto hanya untuk jenis laporan yang mengizinkannya
        const useMulti = !!input.multiple && files.length > 1;

        if (useMulti && files.length > MULTI_PHOTO.MAX_PHOTOS) {
            input.value = '';
            ui.container.classList.add('hidden');
            ui.dropZone.classList.remove('hidden');
            showToast('error', 'Maksimal ' + MULTI_PHOTO.MAX_PHOTOS + ' foto per lampiran. Silakan pilih ulang.');
            return;
        }

        compressingCount++;
        ui.container.classList.remove('hidden');
        ui.dropZone.classList.add('hidden');
        ui.previewImg.removeAttribute('src');
        ui.infoEl.className = INFO_BASE_CLASS + ' text-slate-400';
        ui.infoEl.textContent = 'Mengoptimalkan foto... (target ' + IMAGE_RULES.TARGET_KB + ' KB)';

        try {
            const result = useMulti
                ? await mergePhotos(files, ui.infoEl)
                : await optimizeImage(files[0]);
            const previewUrl = URL.createObjectURL(result.blob);
            const entry = {
                blob: result.blob,
                name: useMulti ? buildMergedName(files.length) : buildFileName(files[0].name, result),
                mime: result.blob.type || 'image/jpeg',
                previewUrl: previewUrl,
                thumbUrls: []
            };

            preparedPhoto[ui.key] = entry;
            ui.previewImg.src = previewUrl;

            if (useMulti) {
                renderPreviewStrip(ui.stripEl, result.parts, entry);
                renderMergedInfo(ui.infoEl, result);
            } else {
                renderOptimizeInfo(ui.infoEl, files[0].size, result);
            }
        } catch (error) {
            console.error('Optimize error:', error);
            input.value = '';
            ui.container.classList.add('hidden');
            ui.dropZone.classList.remove('hidden');
            showToast('error', error.message || 'Gagal memproses foto. Coba pilih foto lain.');
        } finally {
            compressingCount--;
        }
    }

    /**
     * Bersihkan foto hasil olahan + bebaskan object URL preview.
     */
    function resetPhoto(key, ui) {
        const previous = preparedPhoto[key];
        if (previous) {
            if (previous.previewUrl) {
                URL.revokeObjectURL(previous.previewUrl);
            }
            (previous.thumbUrls || []).forEach(function (url) {
                URL.revokeObjectURL(url);
            });
        }
        preparedPhoto[key] = null;

        if (ui) {
            ui.previewImg.removeAttribute('src');
            renderPreviewStrip(ui.stripEl, null, null);
            if (ui.infoEl) {
                ui.infoEl.className = INFO_BASE_CLASS;
                ui.infoEl.textContent = '';
            }
        }
    }

    // Remove Images
    removeImageBtn.addEventListener('click', () => {
        fotoInput.value = '';
        resetPhoto('cpuz', { previewImg: imagePreview, infoEl: fotoInfo, stripEl: previewStrip });
        previewContainer.classList.add('hidden');
        dropZoneCpuz.classList.remove('hidden');
    });

    removeImageUnitBtn.addEventListener('click', () => {
        fotoUnitInput.value = '';
        resetPhoto('unit', { previewImg: imagePreviewUnit, infoEl: fotoUnitInfo });
        previewContainerUnit.classList.add('hidden');
        dropZoneUnit.classList.remove('hidden');
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            showToast('error', 'Konfigurasi Error: URL Google Apps Script belum diisi di app.js');
            return;
        }

        if (!modeSelect.value) {
            showToast('error', 'Pilih Jenis Laporan terlebih dahulu.');
            return;
        }

        if (compressingCount > 0) {
            showToast('error', 'Foto masih dioptimalkan, tunggu sebentar lalu tekan simpan lagi.');
            return;
        }

        setLoading(true, 'Menyiapkan data...');

        try {
            const formData = new FormData(form);
            const data = {};

            // Kolom yang sedang disembunyikan tidak ikut dikirim ke spreadsheet
            const hiddenFields = getHiddenFieldNames();

            // Map text fields
            formData.forEach((value, key) => {
                const isPhoto = key === 'foto' || key === 'fotoUnit';
                if (!isPhoto && key !== 'jenisLaporan' && hiddenFields.indexOf(key) === -1) {
                    data[key] = value;
                }
            });

            // Foto sudah dikompres saat dipilih -> di sini cukup konversi ke base64
            if (hiddenFields.indexOf('foto') === -1) {
                if (preparedPhoto.cpuz) {
                    setLoading(true, 'Menyiapkan Foto CPU-Z...');
                    data.fotoBase64 = await blobToBase64(preparedPhoto.cpuz.blob);
                    data.fotoName = preparedPhoto.cpuz.name;
                    data.fotoMime = preparedPhoto.cpuz.mime;
                    data.fotoSizeKB = Math.round(preparedPhoto.cpuz.blob.size / 1024);
                } else if (fotoInput.files[0]) {
                    throw new Error('Foto CPU-Z masih diproses. Tunggu sebentar lalu simpan lagi.');
                }
            }

            // Foto Unit
            if (hiddenFields.indexOf('fotoUnit') === -1) {
                if (preparedPhoto.unit) {
                    setLoading(true, 'Menyiapkan Foto Unit...');
                    data.fotoUnitBase64 = await blobToBase64(preparedPhoto.unit.blob);
                    data.fotoUnitName = preparedPhoto.unit.name;
                    data.fotoUnitMime = preparedPhoto.unit.mime;
                    data.fotoUnitSizeKB = Math.round(preparedPhoto.unit.blob.size / 1024);
                } else if (fotoUnitInput.files[0]) {
                    throw new Error('Foto Unit masih diproses. Tunggu sebentar lalu simpan lagi.');
                }
            }

            data.timestamp = new Date().toLocaleString('id-ID');

            // Send to Google Sheets
            setLoading(true, 'Mengirim data...');
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            showToast('success');
            form.reset();
            removeImageBtn.click();
            removeImageUnitBtn.click();
            applyReportType(modeSelect.value);   // kembali ke kondisi awal (kolom disembunyikan)

        } catch (error) {
            console.error('Error:', error);
            showToast('error', 'Gagal mengirim data: ' + error.message);
        } finally {
            setLoading(false);
        }
    });

    /**
     * Kompres foto kamera/galeri sampai masuk target (default 250 KB).
     * Strategi: turunkan kualitas JPEG dulu, kalau masih kebesaran baru
     * turunkan resolusi bertahap supaya detail tulisan tetap terbaca.
     */
    async function optimizeImage(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('File yang dipilih bukan gambar.');
        }

        const targetBytes = IMAGE_RULES.TARGET_KB * 1024;
        const source = await decodeImage(file);
        const originalWidth = source.width;
        const originalHeight = source.height;
        const longestSide = Math.max(originalWidth, originalHeight);

        // Sudah JPEG, sudah di bawah target, dan resolusinya wajar:
        // pakai apa adanya supaya kualitasnya 100% asli (tanpa re-encode).
        if (file.type === 'image/jpeg' && file.size <= targetBytes &&
            longestSide <= IMAGE_RULES.MAX_DIMENSION) {
            closeSource(source);
            return {
                blob: file,
                width: originalWidth,
                height: originalHeight,
                quality: 1,
                skipped: true
            };
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let scale = Math.min(1, IMAGE_RULES.MAX_DIMENSION / longestSide);
        let best = null;

        for (let pass = 0; pass < IMAGE_RULES.MAX_RESIZE_PASSES; pass++) {
            const width = Math.max(1, Math.round(originalWidth * scale));
            const height = Math.max(1, Math.round(originalHeight * scale));

            canvas.width = width;
            canvas.height = height;

            // Latar putih: PNG transparan tidak jadi hitam setelah di-JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(source, 0, 0, width, height);

            let quality = IMAGE_RULES.START_QUALITY;
            let blob = await encodeCanvas(canvas, quality);

            while (blob.size > targetBytes && quality > IMAGE_RULES.MIN_QUALITY) {
                quality = Math.max(IMAGE_RULES.MIN_QUALITY, +(quality - IMAGE_RULES.QUALITY_STEP).toFixed(2));
                blob = await encodeCanvas(canvas, quality);
            }

            if (!best || blob.size < best.blob.size) {
                best = { blob: blob, width: width, height: height, quality: quality };
            }

            if (blob.size <= targetBytes) {
                break;
            }

            // Masih kebesaran walau kualitas sudah minimum -> kecilkan resolusi
            if (Math.min(width, height) <= IMAGE_RULES.MIN_DIMENSION) {
                break;
            }

            const ratio = Math.sqrt(targetBytes / blob.size);
            scale = scale * Math.min(0.85, Math.max(0.6, ratio));
        }

        closeSource(source);

        return {
            blob: best.blob,
            width: best.width,
            height: best.height,
            quality: best.quality,
            skipped: false
        };
    }

    /**
     * Kompres beberapa foto (satu per satu) lalu gabungkan jadi satu gambar.
     * Dipakai jenis laporan yang `multiPhoto: true` (mis. Preventif).
     */
    async function mergePhotos(files, infoEl) {
        const parts = [];
        let originalTotal = 0;

        for (let i = 0; i < files.length; i++) {
            infoEl.className = INFO_BASE_CLASS + ' text-slate-400';
            infoEl.textContent = 'Mengoptimalkan foto ' + (i + 1) + '/' + files.length +
                '... (target ' + IMAGE_RULES.TARGET_KB + ' KB per foto)';
            await nextFrame();

            const optimized = await optimizeImage(files[i]);
            originalTotal += files[i].size;
            parts.push(optimized);
        }

        infoEl.className = INFO_BASE_CLASS + ' text-slate-400';
        infoEl.textContent = 'Menggabungkan ' + parts.length + ' foto jadi 1 gambar...';
        await nextFrame();

        const sheet = await buildPhotoSheet(parts);

        return {
            blob: sheet.blob,
            width: sheet.width,
            height: sheet.height,
            quality: sheet.quality,
            parts: parts,
            originalTotal: originalTotal
        };
    }

    /**
     * Susun foto-foto jadi satu "contact sheet": grid 2-3 kolom, tiap foto
     * diberi keterangan "Foto 1 dari 3" dan jarak supaya rapi. Hasilnya satu
     * gambar, jadi tetap terkirim lewat kolom foto yang sudah ada.
     */
    async function buildPhotoSheet(parts) {
        const count = parts.length;
        const columns = count === 1 ? 1 : (count <= 4 ? 2 : 3);
        const rows = Math.ceil(count / columns);
        const cellWidth = MULTI_PHOTO.CELL_WIDTH;

        // Sel dibuat portrait bila semua fotonya portrait supaya tidak banyak ruang kosong
        const allPortrait = parts.every(function (part) { return part.height > part.width; });
        const cellHeight = Math.round(cellWidth *
            (allPortrait ? MULTI_PHOTO.PORTRAIT_ASPECT : MULTI_PHOTO.LANDSCAPE_ASPECT));

        const gap = MULTI_PHOTO.GAP;
        const caption = MULTI_PHOTO.CAPTION_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = columns * cellWidth + gap * (columns + 1);
        canvas.height = rows * (cellHeight + caption) + gap * (rows + 1);

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = MULTI_PHOTO.BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < count; i++) {
            const cellX = gap + (i % columns) * (cellWidth + gap);
            const cellY = gap + Math.floor(i / columns) * (cellHeight + caption + gap);

            const source = await decodeImage(parts[i].blob);
            // Foto diperkecil pas di dalam sel, sisa ruang dibiarkan putih
            const fit = Math.min(cellWidth / source.width, cellHeight / source.height);
            const drawWidth = Math.max(1, Math.round(source.width * fit));
            const drawHeight = Math.max(1, Math.round(source.height * fit));
            ctx.drawImage(source, cellX + Math.round((cellWidth - drawWidth) / 2),
                cellY + Math.round((cellHeight - drawHeight) / 2), drawWidth, drawHeight);
            closeSource(source);

            ctx.fillStyle = '#475569';
            ctx.font = '600 ' + MULTI_PHOTO.CAPTION_FONT + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
            ctx.fillText('Foto ' + (i + 1) + ' dari ' + count,
                cellX + cellWidth / 2, cellY + cellHeight + caption / 2);
        }

        const sized = fitCanvas(canvas, MULTI_PHOTO.MAX_DIMENSION);
        const encoded = await encodeToTarget(sized, MULTI_PHOTO.TARGET_KB);

        return { blob: encoded.blob, width: sized.width, height: sized.height, quality: encoded.quality };
    }

    /**
     * Perkecil canvas (tetap proporsional) bila sisi terpanjangnya melebihi
     * batas, supaya gambar gabungan tidak terlalu besar.
     */
    function fitCanvas(canvas, maxDimension) {
        const longest = Math.max(canvas.width, canvas.height);
        if (longest <= maxDimension) {
            return canvas;
        }

        const scale = maxDimension / longest;
        const target = document.createElement('canvas');
        target.width = Math.max(1, Math.round(canvas.width * scale));
        target.height = Math.max(1, Math.round(canvas.height * scale));

        const ctx = target.getContext('2d');
        ctx.fillStyle = MULTI_PHOTO.BACKGROUND;
        ctx.fillRect(0, 0, target.width, target.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, target.width, target.height);
        return target;
    }

    /**
     * Encode gambar gabungan sampai masuk target ukuran (default 700 KB):
     * kualitas JPEG diturunkan dulu, kalau masih kebesaran resolusi dikecilkan.
     */
    async function encodeToTarget(canvas, targetKb) {
        const targetBytes = targetKb * 1024;
        let work = canvas;
        let quality = MULTI_PHOTO.START_QUALITY;
        let blob = null;

        for (let pass = 0; pass < 4; pass++) {
            quality = MULTI_PHOTO.START_QUALITY;
            blob = await encodeCanvas(work, quality);

            while (blob.size > targetBytes && quality > MULTI_PHOTO.MIN_QUALITY) {
                quality = Math.max(MULTI_PHOTO.MIN_QUALITY, +(quality - MULTI_PHOTO.QUALITY_STEP).toFixed(2));
                blob = await encodeCanvas(work, quality);
            }

            if (blob.size <= targetBytes || Math.max(work.width, work.height) <= 1200) {
                break;
            }

            work = fitCanvas(work, Math.round(Math.max(work.width, work.height) * 0.8));
        }

        return { blob: blob, quality: quality };
    }

    /**
     * Baca file gambar jadi bitmap. Sekaligus membetulkan orientasi EXIF
     * (foto kamera yang miring/terbalik) lewat imageOrientation.
     */
    async function decodeImage(file) {
        if (typeof createImageBitmap === 'function') {
            try {
                return await createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch (e) {
                // Opsi belum didukung browser, lanjut ke percobaan berikutnya
            }

            try {
                return await createImageBitmap(file);
            } catch (e) {
                // Format tidak didukung (misal HEIC), lanjut ke fallback
            }
        }

        return loadImageElement(file);
    }

    function loadImageElement(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Format foto tidak didukung. Aktifkan opsi "Most Compatible" / JPG di kamera lalu coba lagi.'));
            };
            img.src = url;
        });
    }

    function closeSource(source) {
        if (source && typeof source.close === 'function') {
            source.close();
        }
    }

    /**
     * Encode canvas ke JPEG dengan kualitas tertentu (mengembalikan Blob,
     * lebih hemat memori dibanding base64 saat proses kompresi).
     */
    function encodeCanvas(canvas, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Gagal mengompres gambar.'));
                }
            }, 'image/jpeg', quality);
        });
    }

    /**
     * Ubah Blob hasil kompresi jadi base64 (tanpa prefix data:image/...)
     * untuk dikirim ke Google Apps Script.
     */
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Samakan nama file jadi .jpg (kecuali foto asli yang sudah optimal).
     */
    function buildFileName(originalName, result) {
        if (result && result.skipped) {
            return originalName || 'foto.jpg';
        }
        const base = (originalName || 'foto').replace(/\.[^./\\]+$/, '');
        return base + '.jpg';
    }

    /**
     * Tampilkan info hasil kompresi di bawah preview, contoh:
     * "✓ 248 KB (dari 3,4 MB) • Hemat 93% • 1600x1200"
     */
    function renderOptimizeInfo(infoEl, originalSize, result) {
        const targetBytes = IMAGE_RULES.TARGET_KB * 1024;
        const finalSize = result.blob.size;
        const savedPercent = originalSize > 0
            ? Math.max(0, Math.round((1 - finalSize / originalSize) * 100))
            : 0;
        const isOptimal = result.skipped || finalSize >= originalSize;
        const status = isOptimal ? 'Sudah optimal' : 'Hemat ' + savedPercent + '%';
        const icon = finalSize <= targetBytes ? '✓ ' : '⚠ ';

        infoEl.className = INFO_BASE_CLASS +
            (isOptimal ? '' : (finalSize <= targetBytes ? ' text-emerald-600' : ' text-amber-600'));
        infoEl.textContent = icon + formatBytes(finalSize) +
            ' (dari ' + formatBytes(originalSize) + ') • ' + status +
            ' • ' + result.width + 'x' + result.height;
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) {
            return '-';
        }
        if (bytes < 1024) {
            return bytes + ' B';
        }
        const kb = bytes / 1024;
        if (kb < 1024) {
            return Math.round(kb) + ' KB';
        }
        return (kb / 1024).toFixed(1).replace('.', ',') + ' MB';
    }

    /**
     * Nama file hasil gabungan, contoh: lampiran-3-foto-20261014153000.jpg
     */
    function buildMergedName(count) {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        return 'lampiran-' + count + '-foto-' + stamp + '.jpg';
    }

    /**
     * Info hasil gabungan beberapa foto, contoh:
     * "✓ 3 foto digabung jadi 1 gambar 612 KB (dari 5,2 MB) • Hemat 88% • 2214x1666"
     */
    function renderMergedInfo(infoEl, result) {
        const targetBytes = MULTI_PHOTO.TARGET_KB * 1024;
        const savedPercent = result.originalTotal > 0
            ? Math.max(0, Math.round((1 - result.blob.size / result.originalTotal) * 100))
            : 0;
        const withinTarget = result.blob.size <= targetBytes;

        infoEl.className = INFO_BASE_CLASS + (withinTarget ? ' text-emerald-600' : ' text-amber-600');
        infoEl.textContent = (withinTarget ? '✓ ' : '⚠ ') +
            result.parts.length + ' foto digabung jadi 1 gambar ' + formatBytes(result.blob.size) +
            ' (dari ' + formatBytes(result.originalTotal) + ') • Hemat ' + savedPercent + '% • ' +
            result.width + 'x' + result.height;
    }

    /**
     * Tampilkan thumbnail bernomor dari tiap foto yang digabung, supaya user
     * tahu foto mana saja yang masuk ke lampiran.
     */
    function renderPreviewStrip(container, parts, entry) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!parts || parts.length < 2 || !entry) {
            container.classList.add('hidden');
            return;
        }

        parts.forEach(function (part, index) {
            const url = URL.createObjectURL(part.blob);
            entry.thumbUrls.push(url);

            const thumb = document.createElement('div');
            thumb.className = 'relative w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl overflow-hidden border border-slate-200 shadow-sm';

            const img = document.createElement('img');
            img.className = 'w-full h-full object-cover';
            img.alt = 'Foto ' + (index + 1);
            img.src = url;

            const badge = document.createElement('span');
            badge.className = 'absolute bottom-0 right-0 px-1 text-[9px] font-bold text-white bg-slate-900/70';
            badge.textContent = String(index + 1);

            thumb.appendChild(img);
            thumb.appendChild(badge);
            container.appendChild(thumb);
        });

        container.classList.remove('hidden');
    }

    /**
     * Beri kesempatan browser menggambar ulang layar (progress kompresi
     * banyak foto tetap terlihat bergerak).
     */
    function nextFrame() {
        return new Promise(function (resolve) {
            requestAnimationFrame(function () { resolve(); });
        });
    }

    function showToast(type, message = '') {
        const toast = type === 'success' ? successToast : errorToast;
        if (type === 'error' && message) {
            errorMessage.textContent = message;
        }

        toast.classList.remove('translate-y-40', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
            toast.classList.add('translate-y-40', 'opacity-0');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }, 5000);
    }

    function setLoading(isLoading, message = '') {
        isSubmitting = isLoading;

        if (isLoading) {
            submitBtn.disabled = true;
            if (message) {
                btnText.textContent = message;
            }
            btnLoader.classList.remove('hidden');
            submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
        } else {
            btnLoader.classList.add('hidden');
            submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
            refreshSubmitState();
        }
    }

    // Kondisi awal: belum ada jenis laporan dipilih -> semua kolom disembunyikan
    applyReportType(modeSelect.value);
});

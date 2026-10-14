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

    const INFO_BASE_CLASS = 'text-[10px] md:text-xs font-semibold text-slate-500 ml-1';

    // Hasil foto yang sudah dioptimasi: { blob, name, mime, previewUrl }
    const preparedPhoto = { cpuz: null, unit: null };

    // Menghitung foto yang sedang diproses, mencegah submit saat masih kompres
    let compressingCount = 0;

    // Handle Image Preview & Compression for CPU-Z
    fotoInput.addEventListener('change', function () {
        handleImageChange(this, {
            key: 'cpuz',
            previewImg: imagePreview,
            container: previewContainer,
            dropZone: dropZoneCpuz,
            infoEl: fotoInfo
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

    /**
     * Proses foto begitu dipilih (dari kamera langsung maupun galeri):
     * dikompres di perangkat user dulu, lalu preview menampilkan hasil
     * kompresinya supaya user tahu ukuran akhirnya.
     */
    async function handleImageChange(input, ui) {
        const file = input.files[0];

        // Buang hasil sebelumnya + bebaskan memori preview lama
        resetPhoto(ui.key, ui);

        if (!file) {
            ui.container.classList.add('hidden');
            ui.dropZone.classList.remove('hidden');
            return;
        }

        compressingCount++;
        ui.container.classList.remove('hidden');
        ui.dropZone.classList.add('hidden');
        ui.previewImg.removeAttribute('src');
        ui.infoEl.className = INFO_BASE_CLASS + ' text-slate-400';
        ui.infoEl.textContent = 'Mengoptimalkan foto... (target ' + IMAGE_RULES.TARGET_KB + ' KB)';

        try {
            const result = await optimizeImage(file);
            const previewUrl = URL.createObjectURL(result.blob);

            preparedPhoto[ui.key] = {
                blob: result.blob,
                name: buildFileName(file.name, result),
                mime: result.blob.type || 'image/jpeg',
                previewUrl: previewUrl
            };

            ui.previewImg.src = previewUrl;
            renderOptimizeInfo(ui.infoEl, file.size, result);
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
        if (previous && previous.previewUrl) {
            URL.revokeObjectURL(previous.previewUrl);
        }
        preparedPhoto[key] = null;

        if (ui) {
            ui.previewImg.removeAttribute('src');
            if (ui.infoEl) {
                ui.infoEl.className = INFO_BASE_CLASS;
                ui.infoEl.textContent = '';
            }
        }
    }

    // Remove Images
    removeImageBtn.addEventListener('click', () => {
        fotoInput.value = '';
        resetPhoto('cpuz', { previewImg: imagePreview, infoEl: fotoInfo });
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

        if (compressingCount > 0) {
            showToast('error', 'Foto masih dioptimalkan, tunggu sebentar lalu tekan simpan lagi.');
            return;
        }

        setLoading(true, 'Menyiapkan data...');

        try {
            const formData = new FormData(form);
            const data = {};

            // Map text fields
            formData.forEach((value, key) => {
                if (key !== 'foto' && key !== 'fotoUnit') {
                    data[key] = value;
                }
            });

            // Foto sudah dikompres saat dipilih -> di sini cukup konversi ke base64
            if (preparedPhoto.cpuz) {
                setLoading(true, 'Menyiapkan Foto CPU-Z...');
                data.fotoBase64 = await blobToBase64(preparedPhoto.cpuz.blob);
                data.fotoName = preparedPhoto.cpuz.name;
                data.fotoMime = preparedPhoto.cpuz.mime;
                data.fotoSizeKB = Math.round(preparedPhoto.cpuz.blob.size / 1024);
            } else if (fotoInput.files[0]) {
                throw new Error('Foto CPU-Z masih diproses. Tunggu sebentar lalu simpan lagi.');
            }

            // Foto Unit
            if (preparedPhoto.unit) {
                setLoading(true, 'Menyiapkan Foto Unit...');
                data.fotoUnitBase64 = await blobToBase64(preparedPhoto.unit.blob);
                data.fotoUnitName = preparedPhoto.unit.name;
                data.fotoUnitMime = preparedPhoto.unit.mime;
                data.fotoUnitSizeKB = Math.round(preparedPhoto.unit.blob.size / 1024);
            } else if (fotoUnitInput.files[0]) {
                throw new Error('Foto Unit masih diproses. Tunggu sebentar lalu simpan lagi.');
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
        if (isLoading) {
            submitBtn.disabled = true;
            if (message) {
                btnText.textContent = message;
            }
            btnLoader.classList.remove('hidden');
            submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            btnText.textContent = 'Simpan Data Verifikasi';
            btnLoader.classList.add('hidden');
            submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
        }
    }
});

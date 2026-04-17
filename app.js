document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verificationForm');

    // CPU-Z Photo Elements
    const fotoInput = document.getElementById('fotoLampiran');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image');
    const dropZoneCpuz = document.getElementById('drop-zone-cpuz');

    // Unit Photo Elements
    const fotoUnitInput = document.getElementById('fotoUnit');
    const previewContainerUnit = document.getElementById('preview-container-unit');
    const imagePreviewUnit = document.getElementById('image-preview-unit');
    const removeImageUnitBtn = document.getElementById('remove-image-unit');
    const dropZoneUnit = document.getElementById('drop-zone-unit');

    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const successToast = document.getElementById('successToast');
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');

    // Replace this with your Google Apps Script Web App URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzEfVgDRPtA2E1xQzPBHa6JfQWFk0HkoNm4VkTmK3aydEQy7n3h8o-ISzc15ozf2HmeTA/exec';

    // Image Compression Settings
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;
    const QUALITY = 0.7;
    const MAX_FILE_SIZE_MB = 1.9; // Target slightly under 2MB

    // Handle Image Preview & Compression for CPU-Z
    fotoInput.addEventListener('change', function () {
        handleImageChange(this, imagePreview, previewContainer, dropZoneCpuz);
    });

    // Handle Image Preview & Compression for Unit
    fotoUnitInput.addEventListener('change', function () {
        handleImageChange(this, imagePreviewUnit, previewContainerUnit, dropZoneUnit);
    });

    function handleImageChange(input, previewImg, container, dropZone) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImg.src = e.target.result;
                container.classList.remove('hidden');
                dropZone.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    // Remove Images
    removeImageBtn.addEventListener('click', () => {
        fotoInput.value = '';
        previewContainer.classList.add('hidden');
        dropZoneCpuz.classList.remove('hidden');
    });

    removeImageUnitBtn.addEventListener('click', () => {
        fotoUnitInput.value = '';
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

        setLoading(true);

        try {
            const formData = new FormData(form);
            const data = {};

            // Map text fields
            formData.forEach((value, key) => {
                if (key !== 'foto' && key !== 'fotoUnit') {
                    data[key] = value;
                }
            });

            // Process CPU-Z Photo
            const fileCpuz = fotoInput.files[0];
            if (fileCpuz) {
                btnText.textContent = 'Mengoptimasi Foto CPU-Z...';
                data.fotoBase64 = await compressAndGetBase64(fileCpuz);
                data.fotoName = fileCpuz.name;
            }

            // Process Unit Photo
            const fileUnit = fotoUnitInput.files[0];
            if (fileUnit) {
                btnText.textContent = 'Mengoptimasi Foto Unit...';
                data.fotoUnitBase64 = await compressAndGetBase64(fileUnit);
                data.fotoUnitName = fileUnit.name;
            }

            data.timestamp = new Date().toLocaleString('id-ID');

            // Send to Google Sheets
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
     * Compresses image and returns base64 string
     */
    async function compressAndGetBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let currentQuality = QUALITY;
                    let base64 = canvas.toDataURL('image/jpeg', currentQuality);

                    while ((base64.length * 0.75) > (MAX_FILE_SIZE_MB * 1024 * 1024) && currentQuality > 0.1) {
                        currentQuality -= 0.1;
                        base64 = canvas.toDataURL('image/jpeg', currentQuality);
                    }

                    resolve(base64.split(',')[1]);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
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

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
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

async function initializeStorage() {
    if (isCloudConfigured) {
        if (!supabaseClient) throw new Error(t('err_supabase_lib'));
        const migrationStateKey = `catMapMigratedToCloud_${supabaseUrl.split('.')[0].replace('https://', '')}`;
        try {
            localCatsMigrationComplete = localStorage.getItem(migrationStateKey) === 'true';
        } catch (error) {
            console.warn('Không thể đọc trạng thái di chuyển dữ liệu cũ:', error);
        }
        localCatsForMigration = await readLocalCatsForMigration();
        await refreshEditorAccess();
        await refreshCloudCats();
        if (isCatAdmin) await refreshPendingSubmissions();
        subscribeToCloudCats();
        storageReady = true;
        updateCollaborationControls();
        return;
    }
    const storedCats = await readStoredCats();
    if (storedCats.length) {
        cats = validateCats(storedCats);
        if (cats.some((cat, index) => cat.id !== storedCats[index].id)) {
            await replaceStoredCats(cats);
        }
        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn('Không thể xóa bản dữ liệu cũ sau khi đã chuyển:', error);
        }
    } else {
        let legacyData = null;
        try {
            legacyData = localStorage.getItem(storageKey);
        } catch (error) {
            console.warn('Không thể đọc dữ liệu cũ trong localStorage:', error);
        }
        if (legacyData) {
            cats = validateCats(JSON.parse(legacyData));
            await replaceStoredCats(cats);
            try {
                localStorage.removeItem(storageKey);
            } catch (error) {
                console.warn('Không thể xóa bản dữ liệu cũ sau khi đã chuyển:', error);
            }
        }
    }
    renderCatMarkers();
    storageReady = true;
}

async function persistCats(updatedCats) {
    if (!storageReady) throw new Error(t('err_storage_not_ready'));
    if (isCloudConfigured && !currentUser) {
        throw new Error(t('err_login_to_manage'));
    }
    const validatedCats = validateCats(updatedCats);
    if (supabaseClient) {
        const previousById = new Map(cats.map(cat => [cat.id, cat]));
        const changedCats = validatedCats
            .filter(cat => {
                const previous = previousById.get(cat.id);
                return !previous || catContentChanged(previous, cat);
            });
        changedCats.forEach(cat => {
            const previous = previousById.get(cat.id);
            if (previous && !canManageCat(previous)) {
                throw new Error(t('err_edit_own_only'));
            }
        });
        const actingUserId = currentUser.id;
        const rowsToInsert = changedCats
            .filter(cat => !previousById.has(cat.id))
            .map(catToCloudRow);
        const catsToUpdate = changedCats.filter(cat => previousById.has(cat.id));
        const persistedImages = new Map();
        const nextById = new Map(validatedCats.map(cat => [cat.id, cat]));
        const idsToDelete = cats.filter(cat => !nextById.has(cat.id)).map(cat => cat.id);
        const catsToDelete = cats.filter(cat => idsToDelete.includes(cat.id));
        if (catsToDelete.some(cat => !canManageCat(cat))) {
            throw new Error(t('err_delete_own_only'));
        }

        if (rowsToInsert.length) {
            const uploadedPaths = [];
            try {
                const cloudRows = await Promise.all(rowsToInsert.map(async row => {
                    const cat = changedCats.find(item => item.id === row.id);
                    let image = cat.image || null;
                    if (image) {
                        const uploaded = await uploadCatImages(image, cat.id);
                        image = uploaded.value;
                        uploadedPaths.push(...uploaded.uploadedPaths);
                    }
                    persistedImages.set(cat.id, image);
                    return { ...row, image };
                }));
                const { data, error } = await supabaseClient.from('cats').insert(cloudRows).select('id');
                if (error) throw error;
                if ((data || []).length !== rowsToInsert.length) {
                    throw new Error(t('err_insert_failed'));
                }
            } catch (error) {
                // Thêm thất bại: dọn ảnh vừa tải lên để không để lại ảnh mồ côi.
                await removeStorageImages(uploadedPaths);
                throw error;
            }
        }
        if (catsToUpdate.length) {
            const uploadedNewPaths = [];
            const obsoleteOldPaths = [];
            try {
                await Promise.all(catsToUpdate.map(async cat => {
                    const previous = previousById.get(cat.id);
                    const patch = catUpdatePatch(previous, cat);
                    // Chỉ tải lên ảnh mới chụp/chọn (data URL); ảnh cũ giữ nguyên đường dẫn.
                    if ('image' in patch) {
                        if (patch.image) {
                            const uploaded = await uploadCatImages(patch.image, cat.id);
                            patch.image = uploaded.value;
                            uploadedNewPaths.push(...uploaded.uploadedPaths);
                        }
                        const nextSet = new Set(parseCatImages(patch.image));
                        parseCatImages(previous?.image).forEach(oldPath => {
                            if (!nextSet.has(oldPath)) obsoleteOldPaths.push(oldPath);
                        });
                    }
                    persistedImages.set(cat.id, 'image' in patch ? patch.image : cat.image);
                    if (!Object.keys(patch).length) return;
                    const { data, error } = await supabaseClient
                        .from('cats')
                        .update(patch)
                        .eq('id', cat.id)
                        .select('id');
                    if (error) throw error;
                    if ((data || []).length !== 1) {
                        throw new Error(t('err_no_permission_update'));
                    }
                }));
                if (obsoleteOldPaths.length) {
                    await removeStorageImages(obsoleteOldPaths);
                }
            } catch (error) {
                await removeStorageImages(uploadedNewPaths);
                await refreshCloudCats();
                throw error;
            }
        }
        if (idsToDelete.length) {
            const { data, error } = await supabaseClient.from('cats').delete().in('id', idsToDelete).select('id');
            if (error) {
                await refreshCloudCats();
                throw error;
            }
            if ((data || []).length !== idsToDelete.length) {
                await refreshCloudCats();
                throw new Error(t('err_no_permission_delete'));
            }
            // Dọn ảnh của mèo đã xóa (lỗi dọn ảnh không chặn việc xóa).
            await removeStorageImages(catsToDelete.map(cat => cat.image));
        }
        const deletedIds = new Set(idsToDelete);
        cats = cats.filter(cat => !deletedIds.has(cat.id));
        changedCats.forEach(cat => {
            const existingIndex = cats.findIndex(existing => existing.id === cat.id);
            const previous = previousById.get(cat.id);
            const savedCat = {
                ...cat,
                image: persistedImages.has(cat.id) ? persistedImages.get(cat.id) : cat.image,
                created_by: previous ? previous.created_by : actingUserId,
                updated_by: actingUserId,
                updated_at: new Date().toISOString()
            };
            if (existingIndex >= 0) cats[existingIndex] = savedCat;
            else cats.unshift(savedCat);
        });
        cats.sort((first, second) =>
            (second.updated_at || '').localeCompare(first.updated_at || '')
        );
        renderCatMarkers();
        return;
    }
    await replaceStoredCats(validatedCats);
    cats = validatedCats;
    renderCatMarkers();
}

async function migrateLocalCatsToCloud() {
    if (!supabaseClient || !isSignedIn) {
        throw new Error(t('err_login_to_migrate'));
    }
    if (!localCatsForMigration.length || localCatsMigrationComplete) return;
    const confirmed = confirm(
        t('confirm_migrate_local', { count: localCatsForMigration.length })
    );
    if (!confirmed) return;

    const importedCats = localCatsForMigration.map(cat => ({
        ...cat,
        id: createCatId(),
        created_by: currentUser.id,
        updated_by: currentUser.id
    }));
    await persistCats(cats.concat(importedCats));
    const migrationStateKey = `catMapMigratedToCloud_${supabaseUrl.split('.')[0].replace('https://', '')}`;
    try {
        localStorage.setItem(migrationStateKey, 'true');
        localCatsMigrationComplete = true;
        localCatsForMigration = [];
        updateCollaborationControls();
    } catch (error) {
        console.error('Đã tải mèo lên nhưng không thể lưu trạng thái di chuyển:', error);
        showAppStatus(t('msg_migrate_state_not_saved'));
        return;
    }
    showAppStatus(t('msg_migrate_local_done', { count: importedCats.length }));
}

async function saveCatAt(lat, lng, name, note, approximate, image = currentImageDataUrl, locationName = '') {
    let locationLookupWarning = '';
    if (!locationName.trim()) {
        try {
            locationName = await lookupLocationName(lat, lng);
        } catch (error) {
            console.warn('Không thể tra cứu tên vị trí từ OpenStreetMap:', error);
            locationLookupWarning = t('warn_geocode_failed');
        }
    }
    const cat = {
        id: createCatId(),
        lat,
        lng,
        name,
        location_name: locationName,
        note,
        image: image || null,
        approximate,
        current_status: 'seen',
        status_updated_at: new Date().toISOString()
    };
    if (isCloudConfigured) {
        await persistCats(cats.concat(cat));
        showAppStatus(locationLookupWarning || t('msg_cat_added'));
        map.setView([lat, lng], 17);
        resetAndCloseModal();
        return locationLookupWarning;
    }
    await persistCats(cats.concat(cat));
    const group = markerGroups.get(`${lat},${lng}`);
    if (group) openCatGroupPopup(group);
    map.setView([lat, lng], 17);
    resetAndCloseModal();
    return locationLookupWarning;
}

let isSavingMapCat = false;
map.on('click', async event => {
    // Chặn chạm lần 2 trong lúc đang lưu (tra địa chỉ + tải ảnh có thể mất vài giây).
    if (!pendingMapCat || isSavingMapCat) return;

    const selectedCat = pendingMapCat;
    isSavingMapCat = true;
    try {
        const locationLookupWarning = await saveCatAt(
            event.latlng.lat,
            event.latlng.lng,
            selectedCat.name,
            selectedCat.note,
            false,
            selectedCat.image,
            selectedCat.location_name
        );
        pendingMapCat = null;
        mapSelectionPrompt.classList.remove('active');
        openModalButton.disabled = !storageReady || Boolean(pendingMapCat) || (isCloudConfigured && !supabaseClient);
        if (locationLookupWarning) showAppStatus(locationLookupWarning);
        else if (!isCloudConfigured) clearAppStatus();
    } catch (error) {
        console.error('Không thể lưu mèo tại vị trí đã chọn:', error);
        showAppStatus(t('err_save_location', { message: error.message }));
    } finally {
        isSavingMapCat = false;
    }
});

function getImageLayout() {
    const canvasWidth = photoPreviewCanvas.width;
    const canvasHeight = photoPreviewCanvas.height;
    const isSideways = imageRotation % 180 !== 0;
    const rotatedWidth = isSideways ? sourceImage.naturalHeight : sourceImage.naturalWidth;
    const rotatedHeight = isSideways ? sourceImage.naturalWidth : sourceImage.naturalHeight;
    const scale = Math.max(canvasWidth / rotatedWidth, canvasHeight / rotatedHeight) * Number(imageZoom.value);
    return {
        canvasWidth,
        canvasHeight,
        rotatedWidth: rotatedWidth * scale,
        rotatedHeight: rotatedHeight * scale,
        drawWidth: sourceImage.naturalWidth * scale,
        drawHeight: sourceImage.naturalHeight * scale
    };
}

function renderImagePreview() {
    if (!sourceImage) return;

    const { canvasWidth, canvasHeight, rotatedWidth, rotatedHeight, drawWidth, drawHeight } = getImageLayout();
    const offsetX = (canvasWidth - rotatedWidth) * Number(imagePanX.value) / 200;
    const offsetY = (canvasHeight - rotatedHeight) * Number(imagePanY.value) / 200;

    previewContext.clearRect(0, 0, canvasWidth, canvasHeight);
    previewContext.fillStyle = '#fff7f8';
    previewContext.fillRect(0, 0, canvasWidth, canvasHeight);
    previewContext.save();
    previewContext.filter = imageFilter.value;
    previewContext.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
    previewContext.rotate(imageRotation * Math.PI / 180);
    previewContext.scale(imageFlipX ? -1 : 1, imageFlipY ? -1 : 1);
    previewContext.drawImage(sourceImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    previewContext.restore();
}

let imageDrag = null;
photoPreviewCanvas.addEventListener('pointerdown', event => {
    if (!sourceImage || event.button !== 0) return;
    imageDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    photoPreviewCanvas.setPointerCapture(event.pointerId);
    photoPreviewCanvas.classList.add('dragging');
    event.preventDefault();
});
photoPreviewCanvas.addEventListener('pointermove', event => {
    if (!imageDrag || event.pointerId !== imageDrag.pointerId) return;

    const rect = photoPreviewCanvas.getBoundingClientRect();
    const { canvasWidth, canvasHeight, rotatedWidth, rotatedHeight } = getImageLayout();
    const deltaX = (event.clientX - imageDrag.x) * photoPreviewCanvas.width / rect.width;
    const deltaY = (event.clientY - imageDrag.y) * photoPreviewCanvas.height / rect.height;

    if (rotatedWidth > canvasWidth) {
        imagePanX.value = String(Math.max(-100, Math.min(100,
            Number(imagePanX.value) + deltaX * 200 / (canvasWidth - rotatedWidth))));
    }
    if (rotatedHeight > canvasHeight) {
        imagePanY.value = String(Math.max(-100, Math.min(100,
            Number(imagePanY.value) + deltaY * 200 / (canvasHeight - rotatedHeight))));
    }

    imageDrag.x = event.clientX;
    imageDrag.y = event.clientY;
    renderImagePreview();
    event.preventDefault();
});
function stopImageDrag(event) {
    if (!imageDrag || (event && event.pointerId !== imageDrag.pointerId)) return;
    imageDrag = null;
    photoPreviewCanvas.classList.remove('dragging');
}
photoPreviewCanvas.addEventListener('pointerup', stopImageDrag);
photoPreviewCanvas.addEventListener('pointercancel', stopImageDrag);
photoPreviewCanvas.addEventListener('lostpointercapture', stopImageDrag);

function resetImageEditor() {
    imageRotation = 0;
    imageFlipX = false;
    imageFlipY = false;
    imageZoom.value = '1';
    imagePanX.value = '0';
    imagePanY.value = '0';
    imageFilter.value = 'none';
    if (sourceImage) {
        renderImagePreview();
    } else {
        previewContext.clearRect(0, 0, photoPreviewCanvas.width, photoPreviewCanvas.height);
    }
}

let appStatusTimer = null;
let appStatusHideTimer = null;
let appStatusRemaining = 0;
let appStatusStart = 0;

function showAppStatus(message, duration = 3000) {
    if (!appStatus) return;
    if (appStatusTimer) {
        clearTimeout(appStatusTimer);
        appStatusTimer = null;
    }
    if (appStatusHideTimer) {
        clearTimeout(appStatusHideTimer);
        appStatusHideTimer = null;
    }

    const trimmed = String(message || '').trim();
    if (!trimmed) {
        clearAppStatus();
        return;
    }

    const emojiRegex = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u;
    const match = trimmed.match(emojiRegex);
    let icon = '🐾';
    let text = trimmed;

    if (match) {
        icon = match[1];
        text = match[2];
    } else if (/lỗi|không thể|thất bại|error|failed|couldn't|could not|unable/i.test(trimmed)) {
        icon = '😿';
    }

    appStatus.classList.remove('toast-hide');
    appStatus.classList.remove('toast-show');

    appStatus.replaceChildren();

    const content = document.createElement('div');
    content.className = 'toast-content';

    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon;

    const textEl = document.createElement('span');
    textEl.className = 'toast-text';
    textEl.textContent = text;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', currentLang === 'vi' ? 'Đóng thông báo' : 'Close notification');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', event => {
        event.stopPropagation();
        clearAppStatus();
    });

    content.append(iconEl, textEl, closeBtn);

    const progressBar = document.createElement('div');
    progressBar.className = 'toast-progress-bar';
    progressBar.style.animationDuration = `${duration}ms`;

    appStatus.append(content, progressBar);
    appStatus.style.display = 'block';

    // Kích hoạt animation
    void appStatus.offsetWidth;
    appStatus.classList.add('toast-show');

    // Tạm dừng khi rê chuột / chạm giữ
    appStatusRemaining = duration;
    appStatusStart = Date.now();

    const startCountdown = (ms) => {
        if (appStatusTimer) clearTimeout(appStatusTimer);
        appStatusTimer = setTimeout(() => {
            clearAppStatus();
        }, ms);
    };

    appStatus.onmouseenter = () => {
        if (appStatusTimer) {
            clearTimeout(appStatusTimer);
            appStatusTimer = null;
            appStatusRemaining = Math.max(500, appStatusRemaining - (Date.now() - appStatusStart));
        }
    };

    appStatus.onmouseleave = () => {
        if (appStatusRemaining > 0) {
            appStatusStart = Date.now();
            startCountdown(appStatusRemaining);
        } else {
            clearAppStatus();
        }
    };

    appStatus.onclick = () => {
        clearAppStatus();
    };

    startCountdown(duration);
}

function clearAppStatus() {
    if (!appStatus || appStatus.style.display === 'none') return;
    if (appStatusTimer) {
        clearTimeout(appStatusTimer);
        appStatusTimer = null;
    }
    appStatus.classList.remove('toast-show');
    appStatus.classList.add('toast-hide');
    if (appStatusHideTimer) clearTimeout(appStatusHideTimer);
    appStatusHideTimer = setTimeout(() => {
        appStatus.style.display = 'none';
        appStatus.classList.remove('toast-hide');
        appStatus.replaceChildren();
    }, 280);
}

function loadImageForEditing(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = getCatImageUrl(dataUrl);
        // Ảnh trên Supabase Storage là khác tên miền: phải tải kiểu CORS,
        // nếu không canvas bị "khóa" và không xuất lại ảnh được khi lưu.
        if (/^https?:\/\//i.test(url)) image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(t('err_open_saved_image')));
        image.src = url;
    });
}

async function openEditModal(catId) {
    const cat = cats.find(item => item.id === catId);
    if (!cat) return;
    if (!canManageCat(cat)) throw new Error(t('err_edit_own_only'));

    editingCatId = cat.id;
    const editRequestId = ++editModalSeq;
    modalTitle.textContent = t('modal_edit_cat_title');
    saveButton.textContent = t('btn_save_changes');
    chooseMapLocationButton.style.display = 'none';
    document.getElementById('catName').value = cat.name || '';
    document.getElementById('catLocationName').value = getCatLocationName(cat);
    document.getElementById('catNote').value = (cat.note === 'Một bé mèo cute ẩn danh 🐾' || cat.note === 'A cute anonymous kitty 🐾') ? '' : (cat.note || '');
    editLatitude.value = String(cat.lat);
    editLongitude.value = String(cat.lng);
    editLocationFields.classList.add('active');
    resetImageEditor();
    sourceImage = null;
    modalCatPhotos = parseCatImages(cat.image).map(val => ({ value: val, url: getCatSingleImageUrl(val), dirty: false }));
    activeModalPhotoIndex = modalCatPhotos.length ? 0 : -1;
    renderCatPhotoStrip();
    currentImageDataUrl = cat.image || '';
    previewContainer.style.display = 'none';
    if (modalCatPhotos.length) {
        try {
            const loadedImage = await loadImageForEditing(modalCatPhotos[0].value);
            // Trong lúc tải ảnh, người dùng đã đóng modal hoặc chuyển sang thêm/sửa mèo khác.
            if (editRequestId !== editModalSeq) return;
            sourceImage = loadedImage;
            resetImageEditor();
            previewContainer.style.display = 'block';
        } catch (error) {
            if (editRequestId !== editModalSeq) return;
            console.error('Không thể mở ảnh đã lưu để chỉnh sửa:', error);
            showAppStatus(error.message);
        }
    }
    modal.classList.add('active');
    const mc = modal.querySelector('.modal-content');
    if (mc) mc.scrollTop = 0;
}

async function deleteCat(catId) {
    const cat = cats.find(item => item.id === catId);
    if (cat && !canManageCat(cat)) throw new Error(currentLang === 'vi' ? 'Bạn chỉ có thể xóa mèo do chính mình tạo.' : 'You can only delete cats created by you.');
    if (!cat || !confirm(currentLang === 'vi' ? 'Bạn có chắc muốn xóa dấu mèo này?' : 'Are you sure you want to delete this cat marker?')) return;
    await persistCats(cats.filter(item => item.id !== catId));
}

async function updateCatStatus(catId, status, statusNote = '') {
    if (!['seen', 'helped', 'not_found', 'other'].includes(status)) {
        throw new Error(t('err_invalid_status'));
    }
    const normalizedNote = status === 'other' ? statusNote.trim() : '';
    if (status === 'other' && (!normalizedNote || normalizedNote.length > 200)) {
        throw new Error(t('err_status_note_required'));
    }
    const cat = cats.find(item => item.id === catId);
    if (!cat) throw new Error(t('err_cat_record_not_found'));
    const statusUpdatedAt = new Date().toISOString();
    if (isCloudConfigured) {
        if (!currentUser) throw new Error(t('err_login_to_update_status'));
        const { error } = await supabaseClient.rpc('report_cat_status', {
            p_cat_id: catId,
            p_status: status,
            p_status_note: normalizedNote
        });
        if (error) throw error;
        await refreshCloudCats();
    } else {
        await persistCats(cats.map(item => item.id === catId
            ? {
                ...item,
                current_status: status,
                status_note: normalizedNote,
                status_updated_at: statusUpdatedAt
            }
            : item));
    }
    const updatedCat = cats.find(item => item.id === catId);
    if (updatedCat && getFilteredCatResults().some(({ cat }) => cat.id === catId)) openSingleCatPopup(updatedCat);
    showAppStatus(t('toast_status_updated', { status: getCatStatusLabel(status) }));
}

// ===== Biệt danh hiển thị công khai =====
// Không bao giờ lấy email làm tên. Người đăng nhập: lưu trong user_metadata của
// tài khoản (đổi máy vẫn còn). Khách: lưu trong trình duyệt.
const DISPLAY_NAME_KEY = 'catMap_feeder_name';
const DISPLAY_NAME_SET_KEY = 'catMap_display_name_set';

function isDisplayNameSet() {
    if (currentUser) return currentUser.user_metadata?.display_name_set === true;
    try {
        return localStorage.getItem(DISPLAY_NAME_SET_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

function getDisplayName() {
    if (currentUser) return (currentUser.user_metadata?.display_name || '').trim().slice(0, 40);
    try {
        return (localStorage.getItem(DISPLAY_NAME_KEY) || '').trim().slice(0, 40);
    } catch (e) {
        return '';
    }
}

async function setDisplayName(name) {
    const cleanName = (name || '').trim().slice(0, 40);
    if (currentUser && supabaseClient) {
        const { data, error } = await supabaseClient.auth.updateUser({
            data: { display_name: cleanName, display_name_set: true }
        });
        if (error) throw error;
        if (data?.user) currentUser = data.user;
    } else {
        try {
            localStorage.setItem(DISPLAY_NAME_KEY, cleanName);
            localStorage.setItem(DISPLAY_NAME_SET_KEY, 'true');
        } catch (e) {}
    }
    updateDisplayNameButton();
    return cleanName;
}

// Hỏi biệt danh một lần nếu chưa đặt. Trả về null nếu người dùng bấm Hủy.
async function ensureDisplayName() {
    if (isDisplayNameSet()) return getDisplayName();
    const entered = prompt(t('prompt_display_name'), '');
    if (entered === null) return null;
    try {
        return await setDisplayName(entered);
    } catch (error) {
        console.warn('Không thể lưu biệt danh:', error);
        return entered.trim().slice(0, 40);
    }
}

function updateDisplayNameButton() {
    if (!collaborationDisplayNameButton) return;
    const name = isDisplayNameSet() ? getDisplayName() : '';
    collaborationDisplayNameButton.textContent = name
        ? t('btn_display_name_set', { name })
        : t('btn_display_name_empty');
}

async function checkInCatFeed(catId) {
    const cat = cats.find(item => item.id === catId);
    if (!cat) throw new Error(t('err_cat_record_not_found'));

    const displayName = await ensureDisplayName();
    if (displayName === null) return;
    const feederName = displayName || (currentLang === 'en' ? 'A kind Hooman' : 'Một Sen tốt bụng');

    const nowIso = new Date().toISOString();
    const newFedCount = (Number(cat.fed_count) || 0) + 1;

    let serverWallet = null;
    if (isCloudConfigured && supabaseClient) {
        const { data, error } = await supabaseClient.rpc('check_in_cat_feed', {
            p_cat_id: catId,
            p_feeder_name: feederName,
            p_client_id: getWalletClientId()
        });
        if (error) throw new Error(translateServerError(error.message));
        serverWallet = data;
        await refreshCloudCats();
    } else {
        await persistCats(cats.map(item => item.id === catId
            ? {
                ...item,
                last_fed_at: nowIso,
                fed_count: newFedCount,
                last_fed_by: feederName
            }
            : item));
    }

    const updatedCat = cats.find(item => item.id === catId);
    if (updatedCat) {
        openSingleCatPopup(updatedCat);
    }
    if (serverWallet) {
        applyServerWallet(serverWallet);
    } else {
        const wallet = getSenWallet();
        wallet.fedCount = (wallet.fedCount || 0) + 1;
        saveSenWallet(wallet);
    }
    showAppStatus(t('toast_feed_thanks', { feeder: feederName, name: cat.name || (currentLang === 'en' ? 'cat' : 'bé mèo') }));
}

const SEN_RANKS = [
    {
        id: 'rank_1',
        title: 'Sen Tập Sự',
        titleKey: 'rank_1_title',
        descKey: 'rank_1_desc',
        icon: '🌱',
        minStreak: 1,
        minGiven: 0,
        desc: 'Mới vào nghề, thấy bé mèo nào cũng muốn lại gần làm quen.',
        color: '#10b981',
        bg: '#ecfdf5',
        border: '#a7f3d0'
    },
    {
        id: 'rank_2',
        title: 'Sen Chu Đáo',
        titleKey: 'rank_2_title',
        descKey: 'rank_2_desc',
        icon: '🐾',
        minStreak: 3,
        minGiven: 3,
        desc: 'Đã quen mặt các bé mèo trong xóm, luôn có sẵn đồ ăn mang theo.',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd'
    },
    {
        id: 'rank_3',
        title: 'Sen Cần Mẫn',
        titleKey: 'rank_3_title',
        descKey: 'rank_3_desc',
        icon: '🔥',
        minStreak: 7,
        minGiven: 10,
        desc: 'Tuần tra chăm chỉ mỗi ngày, mèo từ xa nghe tiếng bước chân là ra đón.',
        color: '#ea580c',
        bg: '#fff7ed',
        border: '#fed7aa'
    },
    {
        id: 'rank_4',
        title: 'Đại Gia Pate',
        titleKey: 'rank_4_title',
        descKey: 'rank_4_desc',
        icon: '🐟',
        minStreak: 14,
        minGiven: 25,
        desc: 'Đại gia hào phóng tiếp tế no ấm, mèo cả khu phố đều nhận mặt Sen!',
        color: '#d946ef',
        bg: '#fdf4ff',
        border: '#f5d0fe'
    },
    {
        id: 'rank_5',
        title: 'Bảo Mẫu Hoàng Gia',
        titleKey: 'rank_5_title',
        descKey: 'rank_5_desc',
        icon: '👑',
        minStreak: 30,
        minGiven: 50,
        desc: 'Danh xưng tối thượng! Mèo cả thành phố đồng lòng tôn làm Hoàng Thượng Phụ!',
        color: '#eab308',
        bg: '#fefce8',
        border: '#fef08a'
    }
];

function calculateSenRank(streak = 1, totalGiven = 0) {
    let currentRank = SEN_RANKS[0];
    let nextRank = SEN_RANKS[1];

    for (let i = SEN_RANKS.length - 1; i >= 0; i--) {
        const r = SEN_RANKS[i];
        if (streak >= r.minStreak || totalGiven >= r.minGiven) {
            currentRank = r;
            nextRank = SEN_RANKS[i + 1] || null;
            break;
        }
    }

    let progress = 100;
    let progressText = currentLang === 'en' ? 'Max rank reached! 👑' : 'Đã đạt danh hiệu tối cao! 👑';
    if (nextRank) {
        const streakPct = Math.min(100, Math.round((streak / nextRank.minStreak) * 100));
        const givenPct = Math.min(100, Math.round((totalGiven / nextRank.minGiven) * 100));
        progress = Math.min(100, Math.max(streakPct, givenPct));
        const streakRemain = Math.max(0, nextRank.minStreak - streak);
        const givenRemain = Math.max(0, nextRank.minGiven - totalGiven);
        progressText = currentLang === 'en'
            ? `Need ${streakRemain} more days 🔥 or ${givenRemain} cans 🐟 for Level ${nextRank.id.replace('rank_', '')}`
            : `Cần thêm ${streakRemain} ngày 🔥 hoặc ${givenRemain} lon 🐟 để lên Cấp ${nextRank.id.replace('rank_', '')}`;
    }

    const localizedCurrentRank = {
        ...currentRank,
        title: t(currentRank.titleKey) || currentRank.title,
        desc: t(currentRank.descKey) || currentRank.desc
    };

    return { currentRank: localizedCurrentRank, nextRank, progress, progressText };
}

function getSenClientId() {
    let id = localStorage.getItem(SEN_CLIENT_ID_KEY);
    if (!id) {
        id = 'sen_' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
        localStorage.setItem(SEN_CLIENT_ID_KEY, id);
    }
    return id;
}

let isWalletSyncing = false;
let isWalletSyncQueued = false;
let isWalletDbSynced = false;

function getWalletClientId() {
    return currentUser?.id || getSenClientId();
}

// Khi có cloud, ví do server quản lý: ghi đè số liệu trong máy bằng số liệu server.
// Giữ nguyên lastCheckinDate trong máy (chỉ dùng để hiện thông báo điểm danh).
function applyServerWallet(data) {
    const latest = getSenWallet();
    if (!data || typeof data !== 'object') return latest;
    latest.streak = Number(data.streak) || 1;
    latest.pate = Math.max(0, Number(data.pate) || 0);
    latest.totalGiven = Math.max(0, Number(data.total_given) || 0);
    latest.fedCount = Math.max(0, Number(data.fed_count) || 0);
    if (data.rank_id) latest.rankId = data.rank_id;
    if (data.rank_title) latest.rankTitle = data.rank_title;
    try {
        localStorage.setItem(SEN_WALLET_KEY, JSON.stringify(latest));
    } catch (e) {}
    updateWalletDisplay(latest);
    return latest;
}

const SERVER_ERROR_KEYS = [
    ['This cat was just fed', 'err_feed_too_soon'],
    ['Sign in to resolve an SOS', 'err_sos_resolve_login'],
    ['SOS was just updated', 'err_sos_too_soon'],
    ['Out of pate', 'toast_pate_empty'],
    ['Cat not found', 'err_cat_not_found']
];

function translateServerError(message = '') {
    const match = SERVER_ERROR_KEYS.find(([text]) => message.includes(text));
    return match ? t(match[1]) : message;
}

async function syncSenWalletToDatabase() {
    if (!supabaseClient) return;
    if (isWalletSyncing) {
        isWalletSyncQueued = true;
        return;
    }
    try {
        isWalletSyncing = true;
        const { data, error } = await supabaseClient.rpc('sync_sen_wallet', {
            p_client_id: getWalletClientId()
        });

        if (error) {
            console.warn('Không thể đồng bộ ví Sen lên Supabase:', error.message);
            isWalletDbSynced = false;
        } else if (data) {
            isWalletDbSynced = true;
            applyServerWallet(data);
        }
    } catch (e) {
        console.warn('Lỗi kết nối đồng bộ ví:', e);
        isWalletDbSynced = false;
    } finally {
        isWalletSyncing = false;
        updateWalletDisplay();
        if (isWalletSyncQueued) {
            isWalletSyncQueued = false;
            syncSenWalletToDatabase();
        }
    }
}

function getSenWallet() {
    try {
        const raw = localStorage.getItem(SEN_WALLET_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn('Lỗi đọc ví Sen:', e);
    }
    return {
        streak: 1,
        pate: 3,
        lastCheckinDate: new Date().toLocaleDateString('en-CA'),
        totalGiven: 0,
        fedCount: 0
    };
}

function saveSenWallet(wallet) {
    try {
        localStorage.setItem(SEN_WALLET_KEY, JSON.stringify(wallet));
    } catch (e) {
        console.warn('Lỗi lưu ví Sen:', e);
    }
    updateWalletDisplay(wallet);
    if (isCloudConfigured && supabaseClient) {
        syncSenWalletToDatabase(wallet);
    }
}

function updateWalletDisplay(wallet = getSenWallet()) {
    const rankInfo = calculateSenRank(wallet.streak || 1, wallet.totalGiven || 0);

    if (streakCountText) streakCountText.textContent = wallet.streak || 1;
    if (pateCountText) pateCountText.textContent = wallet.pate || 0;
    if (walletStreakValue) walletStreakValue.textContent = `${wallet.streak || 1} ${t('unit_days')}`;
    if (walletPateValue) walletPateValue.textContent = `${wallet.pate || 0} ${t('unit_cans')}`;
    if (walletTotalGivenValue) walletTotalGivenValue.textContent = `${wallet.totalGiven || 0} ${t('unit_cans')}`;

    if (senRankIcon) senRankIcon.textContent = rankInfo.currentRank.icon;
    if (senRankTitle) {
        senRankTitle.textContent = `${rankInfo.currentRank.icon} ${rankInfo.currentRank.title}`;
        senRankTitle.style.color = rankInfo.currentRank.color;
    }
    if (senRankDesc) senRankDesc.textContent = rankInfo.currentRank.desc;
    if (senRankProgressFill) senRankProgressFill.style.width = `${rankInfo.progress}%`;
    if (senRankProgressPercent) senRankProgressPercent.textContent = `${rankInfo.progress}%`;
    if (senRankProgressText) senRankProgressText.textContent = rankInfo.progressText;

    if (streakDaysRow) {
        const currentDayInWeek = ((wallet.streak - 1) % 7) + 1;
        const badges = streakDaysRow.querySelectorAll('.streak-day-badge');
        badges.forEach((badge, index) => {
            const dayNum = index + 1;
            if (dayNum <= currentDayInWeek) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        });
    }
}

function checkDailyStreak() {
    const wallet = getSenWallet();
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (!wallet.lastCheckinDate) {
        wallet.lastCheckinDate = todayStr;
        wallet.streak = 1;
        wallet.pate = Math.max(wallet.pate || 0, 3);
        saveSenWallet(wallet);
        showAppStatus(t('toast_welcome_new_sen'));
        return;
    }

    if (wallet.lastCheckinDate === todayStr) {
        updateWalletDisplay(wallet);
        if (isCloudConfigured && supabaseClient) {
            syncSenWalletToDatabase(wallet);
        }
        return;
    }

    const lastDate = new Date(wallet.lastCheckinDate + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const diffTime = today - lastDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let bonus = 1;
    if (diffDays === 1) {
        wallet.streak = (wallet.streak || 0) + 1;
        if (wallet.streak % 7 === 0) {
            bonus += 3;
        }
    } else {
        wallet.streak = 1;
    }

    wallet.pate = (wallet.pate || 0) + bonus;
    wallet.lastCheckinDate = todayStr;
    saveSenWallet(wallet);

    if (wallet.streak % 7 === 0) {
        showAppStatus(t('toast_streak_milestone', { streak: wallet.streak, bonus }));
    } else {
        showAppStatus(t('toast_daily_checkin', { bonus, streak: wallet.streak }));
    }
}

function openSenWalletModal() {
    updateWalletDisplay();
    if (isCloudConfigured && supabaseClient) {
        syncSenWalletToDatabase();
    }
    senWalletModal.classList.add('active');
}

function closeSenWalletModal() {
    senWalletModal.classList.remove('active');
}

async function giveCatPate(catId) {
    const wallet = getSenWallet();
    if ((wallet.pate || 0) <= 0) {
        showAppStatus(t('toast_pate_empty'));
        openSenWalletModal();
        return;
    }

    const cat = cats.find(item => item.id === catId);
    if (!cat) throw new Error(currentLang === 'en' ? 'Cat record not found.' : 'Không tìm thấy bản ghi mèo.');

    const prevRank = calculateSenRank(wallet.streak, wallet.totalGiven).currentRank;

    if (isCloudConfigured && supabaseClient) {
        // Server trừ ví và cộng pate cho mèo trong cùng một giao dịch.
        const { data, error } = await supabaseClient.rpc('give_cat_pate', {
            p_cat_id: catId,
            p_client_id: getWalletClientId()
        });
        if (error) {
            if (error.message?.includes('Out of pate')) {
                await syncSenWalletToDatabase();
                showAppStatus(t('toast_pate_empty'));
                openSenWalletModal();
                return;
            }
            throw new Error(translateServerError(error.message));
        }
        const serverWallet = applyServerWallet(data?.wallet);
        if (typeof data?.pate_count === 'number') cat.pate_count = data.pate_count;
        const serverRank = calculateSenRank(serverWallet.streak, serverWallet.totalGiven).currentRank;
        if (serverRank.id !== prevRank.id) {
            showAppStatus(t('toast_rank_up', { icon: serverRank.icon, title: serverRank.title }));
        }
        await refreshCloudCats();
        const refreshedCat = cats.find(item => item.id === catId);
        if (refreshedCat) openSingleCatPopup(refreshedCat);
        showAppStatus(t('toast_pate_given', { name: cat.name || (currentLang === 'en' ? 'cat' : 'bé mèo'), remain: serverWallet.pate }));
        return;
    }

    wallet.pate -= 1;
    wallet.totalGiven = (wallet.totalGiven || 0) + 1;
    const newRankInfo = calculateSenRank(wallet.streak, wallet.totalGiven);
    wallet.rankId = newRankInfo.currentRank.id;
    wallet.rankTitle = newRankInfo.currentRank.title;
    saveSenWallet(wallet);

    if (newRankInfo.currentRank.id !== prevRank.id) {
        showAppStatus(t('toast_rank_up', { icon: newRankInfo.currentRank.icon, title: newRankInfo.currentRank.title }));
    }

    const newPateCount = (Number(cat.pate_count) || 0) + 1;
    cat.pate_count = newPateCount;
    await persistCats(cats.map(item => item.id === catId ? { ...item, pate_count: newPateCount } : item));

    const updatedCat = cats.find(item => item.id === catId);
    if (updatedCat) {
        openSingleCatPopup(updatedCat);
    }
    showAppStatus(t('toast_pate_given', { name: cat.name || (currentLang === 'en' ? 'cat' : 'bé mèo'), remain: wallet.pate }));
}

async function toggleCatSos(catId, isSos, sosNote = '') {
    const cat = cats.find(item => item.id === catId);
    if (!cat) throw new Error(currentLang === 'en' ? 'Cat record not found.' : 'Không tìm thấy bản ghi mèo.');

    const note = typeof sosNote === 'string' ? sosNote.trim().slice(0, 200) : '';

    if (isCloudConfigured && supabaseClient) {
        const { error } = await supabaseClient.rpc('toggle_cat_sos', {
            p_cat_id: catId,
            p_is_sos: isSos,
            p_sos_note: note
        });
        if (error) throw new Error(translateServerError(error.message));
        await refreshCloudCats();
    } else {
        cat.is_sos = isSos;
        cat.sos_note = note;
        await persistCats(cats.map(item => item.id === catId ? { ...item, is_sos: isSos, sos_note: note } : item));
    }

    renderCatMarkers();
    updateSosBadge();

    const updatedCat = cats.find(item => item.id === catId);
    if (updatedCat) {
        openSingleCatPopup(updatedCat);
    }
    showAppStatus(isSos
        ? t('toast_sos_on', { name: cat.name || (currentLang === 'en' ? 'cat' : 'bé mèo') })
        : t('toast_sos_off', { name: cat.name || (currentLang === 'en' ? 'cat' : 'bé mèo') }));
}

function updateSosBadge() {
    if (!sosBadgeCount) return;
    const sosCount = cats.filter(c => c.is_sos).length;
    sosBadgeCount.textContent = sosCount;
}


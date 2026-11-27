function createCatPopupContent(groupCats) {
    const content = document.createElement('div');
    content.className = 'cat-popup-list';
    content.setAttribute('role', 'region');
    content.setAttribute('aria-label', currentLang === 'en' ? 'Cat information on map' : 'Thông tin mèo trên bản đồ');
    const hasTabs = groupCats.length > 1;
    const entries = [];
    let tabsBar = null;
    if (hasTabs) {
        tabsBar = document.createElement('div');
        tabsBar.className = 'cat-popup-tabs';
        tabsBar.setAttribute('role', 'tablist');
        content.appendChild(tabsBar);
    }
    groupCats.forEach((cat, index) => {
        const entry = document.createElement('div');
        entry.className = 'cat-popup-entry';
        if (hasTabs && index > 0) entry.hidden = true;
        entries.push(entry);
        if (tabsBar) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'cat-popup-tab' + (index === 0 ? ' active' : '');
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(index === 0));
            const catLabel = cat.name || t('unnamed_cat');
            tab.textContent = (cat.is_sos ? '🚨 ' : '🐾 ') + catLabel;
            tab.addEventListener('click', event => {
                event.stopPropagation();
                tabsBar.querySelectorAll('.cat-popup-tab').forEach((btn, idx) => {
                    const active = idx === index;
                    btn.classList.toggle('active', active);
                    btn.setAttribute('aria-selected', String(active));
                });
                entries.forEach((item, idx) => {
                    item.hidden = idx !== index;
                });
                content.scrollTop = 0;
            });
            tabsBar.appendChild(tab);
        }
        const header = document.createElement('div');
        header.className = 'cat-popup-header';
        const titleRow = document.createElement('div');
        titleRow.className = 'cat-popup-title-row';
        const title = document.createElement('b');
        title.className = 'cat-popup-title';
        title.textContent = cat.name || t('unnamed_cat');
        const statusValue = document.createElement('span');
        statusValue.className = 'cat-status-value';
        statusValue.dataset.status = cat.current_status || 'unknown';
        statusValue.textContent = getCatStatusLabel(cat.current_status);
        titleRow.append(title, statusValue);
        header.appendChild(titleRow);
        const location = document.createElement('div');
        location.className = 'cat-popup-location';
        setCatLocationLabel(location, cat, '📍 ');
        header.appendChild(location);
        const catImageUrls = getCatImageUrls(cat.image);
        if (catImageUrls.length === 1) {
            const image = document.createElement('img');
            image.src = catImageUrls[0];
            image.className = 'popup-img';
            image.alt = currentLang === 'en' ? `Photo of ${cat.name || 'unnamed cat'}; tap to enlarge` : `Ảnh mèo ${cat.name || 'chưa đặt tên'}; chạm để xem ảnh lớn`;
            image.tabIndex = 0;
            image.setAttribute('role', 'button');
            image.addEventListener('click', () => openImageViewer(image, catImageUrls, 0));
            image.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openImageViewer(image, catImageUrls, 0);
                }
            });
            entry.appendChild(image);
        } else if (catImageUrls.length > 1) {
            const wrap = document.createElement('div');
            wrap.className = 'popup-img-carousel-wrap';
            const carousel = document.createElement('div');
            carousel.className = 'popup-img-carousel';
            const dotsWrap = document.createElement('div');
            dotsWrap.className = 'popup-img-dots';
            const counter = document.createElement('span');
            counter.className = 'popup-img-counter';
            counter.textContent = `1 / ${catImageUrls.length}`;

            const dots = [];
            catImageUrls.forEach((url, imgIdx) => {
                const slide = document.createElement('div');
                slide.className = 'popup-img-slide';
                const image = document.createElement('img');
                image.src = url;
                image.className = 'popup-img';
                image.alt = currentLang === 'en'
                    ? `Photo ${imgIdx + 1} of ${catImageUrls.length} for ${cat.name || 'unnamed cat'}; tap to enlarge`
                    : `Ảnh ${imgIdx + 1}/${catImageUrls.length} của ${cat.name || 'mèo chưa đặt tên'}; chạm để xem ảnh lớn`;
                image.tabIndex = 0;
                image.setAttribute('role', 'button');
                image.addEventListener('click', () => openImageViewer(image, catImageUrls, imgIdx));
                image.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openImageViewer(image, catImageUrls, imgIdx);
                    }
                });
                slide.appendChild(image);
                carousel.appendChild(slide);

                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'popup-img-dot' + (imgIdx === 0 ? ' active' : '');
                dot.setAttribute('aria-label', `${imgIdx + 1}/${catImageUrls.length}`);
                dot.addEventListener('click', e => {
                    e.stopPropagation();
                    carousel.scrollTo({ left: imgIdx * carousel.clientWidth, behavior: 'smooth' });
                });
                dots.push(dot);
                dotsWrap.appendChild(dot);
            });

            const updateCarouselIndicator = () => {
                const width = carousel.clientWidth || 1;
                const activeIdx = Math.max(0, Math.min(catImageUrls.length - 1, Math.round(carousel.scrollLeft / width)));
                counter.textContent = `${activeIdx + 1} / ${catImageUrls.length}`;
                dots.forEach((d, idx) => d.classList.toggle('active', idx === activeIdx));
            };
            carousel.addEventListener('scroll', updateCarouselIndicator, { passive: true });

            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'popup-img-nav prev';
            prevBtn.textContent = '‹';
            prevBtn.setAttribute('aria-label', currentLang === 'en' ? 'Previous photo' : 'Ảnh trước');
            prevBtn.addEventListener('click', e => {
                e.stopPropagation();
                const width = carousel.clientWidth || 1;
                const idx = Math.round(carousel.scrollLeft / width);
                const nextIdx = idx <= 0 ? catImageUrls.length - 1 : idx - 1;
                carousel.scrollTo({ left: nextIdx * width, behavior: 'smooth' });
            });

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'popup-img-nav next';
            nextBtn.textContent = '›';
            nextBtn.setAttribute('aria-label', currentLang === 'en' ? 'Next photo' : 'Ảnh sau');
            nextBtn.addEventListener('click', e => {
                e.stopPropagation();
                const width = carousel.clientWidth || 1;
                const idx = Math.round(carousel.scrollLeft / width);
                const nextIdx = idx >= catImageUrls.length - 1 ? 0 : idx + 1;
                carousel.scrollTo({ left: nextIdx * width, behavior: 'smooth' });
            });

            wrap.append(carousel, prevBtn, nextBtn, dotsWrap, counter);
            entry.appendChild(wrap);
        }

        entry.appendChild(header);
        entry.appendChild(createCatQuickActions(cat));

        const note = document.createElement('div');
        note.className = 'cat-popup-note';
        const label = document.createElement('b');
        label.className = 'cat-popup-note-label';
        label.textContent = currentLang === 'vi' ? 'Ghi chú: ' : 'Notes: ';
        note.append(label, document.createTextNode(getCatDisplayNote(cat)));
        entry.appendChild(note);

        if (cat.approximate) {
            const locationNote = document.createElement('div');
            locationNote.className = 'cat-popup-approximate';
            locationNote.textContent = currentLang === 'vi' ? 'Vị trí ước lượng (tâm bản đồ, không phải GPS).' : 'Approximate location (map center, not GPS).';
            entry.appendChild(locationNote);
        }

        // Nhật ký cho ăn hôm nay
        const feedingSection = document.createElement('div');
        feedingSection.className = 'cat-feeding-section';

        const lastFedTime = cat.last_fed_at ? new Date(cat.last_fed_at) : null;
        const isFedToday = Boolean(lastFedTime && Number.isFinite(lastFedTime.getTime()) && isSameDay(lastFedTime, new Date()));

        const feedingHeader = document.createElement('div');
        feedingHeader.className = 'cat-feeding-header';
        const feedingTitleWrap = document.createElement('span');
        feedingTitleWrap.className = 'cat-feeding-header-title';
        const feedingIcon = document.createElement('span');
        feedingIcon.textContent = '🥣';
        const feedingTitle = document.createElement('b');
        feedingTitle.textContent = t('popup_feeding_title').replace(/:$/, '');
        feedingTitleWrap.append(feedingIcon, feedingTitle);

        const statusTag = document.createElement('span');
        statusTag.className = 'feeding-status-tag ' + (isFedToday ? 'fed-today' : 'fed-none');
        statusTag.textContent = isFedToday ? t('popup_fed_today') : t('popup_fed_none');
        feedingHeader.append(feedingTitleWrap, statusTag);
        feedingSection.appendChild(feedingHeader);

        const feedingInfo = document.createElement('div');
        feedingInfo.className = 'cat-feeding-info';

        const detail = document.createElement('div');
        detail.className = 'feeding-detail';
        const feederDisplayName = (cat.last_fed_by === 'Một Sen tốt bụng' && currentLang === 'en')
            ? 'A kind Hooman'
            : cat.last_fed_by;
        if (isFedToday) {
            detail.textContent = currentLang === 'vi'
                ? `Lần gần nhất: ${formatRelativeTime(lastFedTime)} bởi ${feederDisplayName || 'Một Sen tốt bụng'}${cat.fed_count ? ` (${cat.fed_count} lần tiếp tế)` : ''}`
                : `Most recent: ${formatRelativeTime(lastFedTime)} by ${feederDisplayName || 'A kind Hooman'}${cat.fed_count ? ` (${cat.fed_count} ${cat.fed_count === 1 ? 'feeding' : 'feedings'})` : ''}`;
        } else if (lastFedTime && Number.isFinite(lastFedTime.getTime())) {
            detail.textContent = currentLang === 'vi'
                ? `Lần ăn trước: ${formatRelativeTime(lastFedTime)}${feederDisplayName ? ` (bởi ${feederDisplayName})` : ''}`
                : `Previous meal: ${formatRelativeTime(lastFedTime)}${feederDisplayName ? ` (by ${feederDisplayName})` : ''}`;
        } else {
            detail.textContent = currentLang === 'vi' ? 'Bé đang đợi một Sen ghé thăm tiếp tế!' : 'Waiting for a kind Hooman to visit and feed!';
        }
        feedingInfo.appendChild(detail);
        feedingSection.appendChild(feedingInfo);

        const feedButton = document.createElement('button');
        feedButton.type = 'button';
        feedButton.className = 'cat-feed-btn';
        feedButton.dataset.catFeed = cat.id;
        feedButton.textContent = isFedToday ? t('btn_feed_more') : t('btn_feed_now');
        feedingSection.appendChild(feedButton);

        // Hàng tặng pate yêu thương
        const pateRow = document.createElement('div');
        pateRow.className = 'cat-pate-row';

        const pateCountText = document.createElement('span');
        pateCountText.className = 'cat-pate-badge';
        pateCountText.textContent = t('popup_pate_count', { count: cat.pate_count || 0 });

        const givePateBtn = document.createElement('button');
        givePateBtn.type = 'button';
        givePateBtn.className = 'cat-give-pate-btn';
        givePateBtn.dataset.catPate = cat.id;
        givePateBtn.textContent = t('btn_give_pate');

        pateRow.append(pateCountText, givePateBtn);
        feedingSection.appendChild(pateRow);

        entry.appendChild(feedingSection);

        // Phần Nhật ký gặp lại & Hành trình lớn lên
        const sightingsSection = document.createElement('div');
        sightingsSection.className = 'cat-sightings-section';

        const sightingsHeader = document.createElement('div');
        sightingsHeader.className = 'cat-sightings-header';

        const sightingsTitle = document.createElement('span');
        sightingsTitle.className = 'cat-sightings-title';
        const totalSightings = Math.max(1, Number(cat.sightings_count) || 1);
        sightingsTitle.innerHTML = currentLang === 'en'
            ? `🐾 Encounters: <b>${totalSightings} ${totalSightings === 1 ? 'time' : 'times'}</b>`
            : t('popup_sightings_count', { count: totalSightings });

        sightingsHeader.appendChild(sightingsTitle);
        sightingsSection.appendChild(sightingsHeader);

        const sightingsActionRow = document.createElement('div');
        sightingsActionRow.className = 'cat-sightings-actions';

        const addSightingBtn = document.createElement('button');
        addSightingBtn.type = 'button';
        addSightingBtn.className = 'cat-sighting-btn btn-meet-again';
        addSightingBtn.dataset.catSightingAdd = cat.id;
        addSightingBtn.textContent = t('btn_meet_again');

        const viewTimelineBtn = document.createElement('button');
        viewTimelineBtn.type = 'button';
        viewTimelineBtn.className = 'cat-sighting-btn btn-view-timeline';
        viewTimelineBtn.dataset.catTimeline = cat.id;
        viewTimelineBtn.textContent = t('btn_view_timeline');

        sightingsActionRow.append(addSightingBtn, viewTimelineBtn);
        sightingsSection.appendChild(sightingsActionRow);
        entry.appendChild(sightingsSection);

        // Phần Radar SOS
        const sosSection = document.createElement('div');
        sosSection.className = 'cat-sos-section' + (cat.is_sos ? ' active-sos' : '');
        if (cat.is_sos) {
            const sosTag = document.createElement('div');
            sosTag.className = 'sos-badge-tag';
            sosTag.textContent = t('popup_sos_alert');
            sosSection.appendChild(sosTag);

            if (cat.sos_note) {
                const sosNoteText = document.createElement('div');
                sosNoteText.style.fontWeight = '700';
                sosNoteText.style.marginBottom = '4px';
                sosNoteText.textContent = `${currentLang === 'vi' ? 'Ghi chú cứu trợ' : 'Rescue note'}: ${cat.sos_note}`;
                sosSection.appendChild(sosNoteText);
            }

            const resolveBtn = document.createElement('button');
            resolveBtn.type = 'button';
            resolveBtn.className = 'cat-sos-toggle-btn btn-resolve';
            resolveBtn.dataset.catSosResolve = cat.id;
            resolveBtn.textContent = t('btn_resolve_sos');
            sosSection.appendChild(resolveBtn);
        } else {
            const reportSosBtn = document.createElement('button');
            reportSosBtn.type = 'button';
            reportSosBtn.className = 'cat-sos-toggle-btn';
            reportSosBtn.dataset.catSosReport = cat.id;
            reportSosBtn.textContent = t('btn_report_sos');
            sosSection.appendChild(reportSosBtn);
        }
        entry.appendChild(sosSection);

        const status = document.createElement('div');
        status.className = 'cat-status';
        if (cat.current_status === 'other' && cat.status_note) {
            const statusNote = document.createElement('p');
            statusNote.className = 'cat-status-note';
            statusNote.textContent = cat.status_note;
            status.appendChild(statusNote);
        }
        if (!isCloudConfigured || currentUser) {
            const statusActions = document.createElement('div');
            statusActions.className = 'cat-status-actions';
            [
                ['seen', t('status_seen')],
                ['helped', t('status_helped')],
                ['not_found', t('status_not_found')],
                ['other', t('status_other')]
            ].forEach(([value, labelText]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = labelText;
                button.dataset.catStatus = value;
                button.dataset.catId = cat.id;
                button.setAttribute('aria-pressed', String(cat.current_status === value));
                statusActions.appendChild(button);
            });
            status.appendChild(statusActions);
            const otherForm = document.createElement('div');
            otherForm.className = 'cat-status-other-form';
            otherForm.hidden = true;
            const otherInput = document.createElement('textarea');
            otherInput.maxLength = 200;
            otherInput.placeholder = currentLang === 'vi' ? 'Nhập tình trạng khác (tối đa 200 ký tự)' : 'Enter other status (max 200 chars)';
            otherInput.setAttribute('aria-label', currentLang === 'vi' ? 'Nội dung tình trạng khác' : 'Other status content');
            otherInput.dataset.catStatusNote = cat.id;
            otherInput.value = cat.current_status === 'other' ? cat.status_note || '' : '';
            const saveOtherButton = document.createElement('button');
            saveOtherButton.type = 'button';
            saveOtherButton.textContent = currentLang === 'vi' ? 'Lưu tình trạng' : 'Save status';
            saveOtherButton.dataset.catStatusSubmit = cat.id;
            otherForm.append(otherInput, saveOtherButton);
            status.appendChild(otherForm);
        } else {
            const loginNote = document.createElement('small');
            loginNote.className = 'cat-status-login-note';
            loginNote.textContent = t('login_to_update_status');
            status.appendChild(loginNote);
        }
        const statusUpdatedAt = cat.status_updated_at ? new Date(cat.status_updated_at) : null;
        if (statusUpdatedAt && Number.isFinite(statusUpdatedAt.getTime())) {
            const updatedTime = document.createElement('div');
            updatedTime.className = 'cat-status-updated';
            updatedTime.textContent = `${currentLang === 'vi' ? 'Cập nhật' : 'Updated'} ${statusUpdatedAt.toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US', {
                dateStyle: 'short',
                timeStyle: 'short'
            })}`;
            status.appendChild(updatedTime);
        }
        entry.appendChild(status);

        if (!isCloudConfigured || canManageCat(cat)) {
            const actions = document.createElement('div');
            actions.className = 'cat-record-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = t('btn_edit');
            editButton.dataset.catAction = 'edit';
            editButton.dataset.catId = cat.id;
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = t('btn_delete');
            deleteButton.dataset.catAction = 'delete';
            deleteButton.dataset.catId = cat.id;
            actions.append(editButton, deleteButton);
            entry.appendChild(actions);
        }
        entry.appendChild(createCatReportLink(cat));
        content.appendChild(entry);
    });
    observeCatLocations(content);
    return content;
}

const markerGroups = new Map();
let activeCatPopup = null;
let activePopupCats = null;
let cats = [];
let storageReady = false;
let editingCatId = null;
let editModalSeq = 0;
let database;

function createCatId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('catMapDatabase', 1);
    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('cats')) {
            request.result.createObjectStore('cats', { keyPath: 'id' });
        }
    };
    request.onsuccess = () => {
        database = request.result;
        resolve(database);
    };
    request.onerror = () => reject(request.error || new Error(t('err_idb_open')));
    request.onblocked = () => reject(new Error(t('err_idb_blocked')));
});

function validateCats(data) {
    if (!Array.isArray(data)) throw new Error(t('err_backup_not_list'));
    return data.map(cat => {
        if (!cat || !Number.isFinite(cat.lat) || cat.lat < -90 || cat.lat > 90 ||
            !Number.isFinite(cat.lng) || cat.lng < -180 || cat.lng > 180 ||
            typeof cat.note !== 'string' ||
            (cat.image !== null && cat.image !== undefined && typeof cat.image !== 'string')) {
            throw new Error(t('err_invalid_cat_data'));
        }
        return {
            id: typeof cat.id === 'string' && cat.id ? cat.id : createCatId(),
            lat: cat.lat,
            lng: cat.lng,
            name: typeof cat.name === 'string' ? cat.name.trim().slice(0, 40) : '',
            location_name: typeof cat.location_name === 'string' ? cat.location_name.trim().slice(0, 120) : '',
            note: cat.note,
            image: cat.image || null,
            approximate: Boolean(cat.approximate),
            current_status: ['seen', 'helped', 'not_found'].includes(cat.current_status)
                ? cat.current_status
                : cat.current_status === 'other' ? 'other' : 'unknown',
            status_note: typeof cat.status_note === 'string' ? cat.status_note.trim().slice(0, 200) : '',
            status_updated_at: typeof cat.status_updated_at === 'string' ? cat.status_updated_at : null,
            last_fed_at: typeof cat.last_fed_at === 'string' ? cat.last_fed_at : null,
            last_fed_by: typeof cat.last_fed_by === 'string' ? cat.last_fed_by.trim().slice(0, 40) : '',
            fed_count: Number.isFinite(cat.fed_count) ? cat.fed_count : 0,
            pate_count: Number.isFinite(cat.pate_count) ? cat.pate_count : 0,
            is_sos: Boolean(cat.is_sos),
            sos_note: typeof cat.sos_note === 'string' ? cat.sos_note.trim().slice(0, 200) : '',
            sightings_count: Number.isFinite(cat.sightings_count) ? cat.sightings_count : 1,
            sightings: Array.isArray(cat.sightings) ? cat.sightings : [],
            created_by: typeof cat.created_by === 'string' ? cat.created_by : null,
            updated_by: typeof cat.updated_by === 'string' ? cat.updated_by : null,
            updated_at: typeof cat.updated_at === 'string' ? cat.updated_at : null
        };
    });
}

function catFromCloudRow(row) {
    return {
        id: row.id,
        lat: Number(row.lat),
        lng: Number(row.lng),
        name: row.name || '',
        location_name: row.location_name || '',
        note: typeof row.note === 'string' ? row.note : '',
        image: row.image || null,
        approximate: Boolean(row.approximate),
        current_status: row.current_status || 'unknown',
        status_note: row.status_note || '',
        status_updated_at: row.status_updated_at || null,
        last_fed_at: row.last_fed_at || null,
        last_fed_by: row.last_fed_by || '',
        fed_count: Number(row.fed_count) || 0,
        pate_count: Number(row.pate_count) || 0,
        is_sos: Boolean(row.is_sos),
        sos_note: row.sos_note || '',
        sightings_count: Number(row.sightings_count) || 1,
        sightings: Array.isArray(row.sightings) ? row.sightings : [],
        created_by: row.created_by || null,
        updated_by: row.updated_by || null,
        updated_at: row.updated_at || null
    };
}

function parseCatImages(image) {
    if (!image) return [];
    if (Array.isArray(image)) return image.filter(item => typeof item === 'string' && item.trim());
    if (typeof image === 'string') {
        const trimmed = image.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string' && item.trim());
            } catch (e) {}
        }
        return [trimmed];
    }
    return [];
}

function serializeCatImages(images) {
    const list = (Array.isArray(images) ? images : []).filter(item => typeof item === 'string' && item.trim());
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    return JSON.stringify(list);
}

function getCatSingleImageUrl(image) {
    if (!image || image.startsWith('data:') || /^https?:\/\//i.test(image)) return image || '';
    return supabaseClient.storage.from('cat-images').getPublicUrl(image).data.publicUrl;
}

function getCatImageUrls(image) {
    return parseCatImages(image).map(getCatSingleImageUrl).filter(Boolean);
}

function getCatImageUrl(image) {
    return getCatImageUrls(image)[0] || '';
}

async function uploadCatImages(image, catId, collection = 'cats') {
    const items = parseCatImages(image);
    if (!items.length) return { value: null, uploadedPaths: [] };
    const uploadedPaths = [];
    const results = await Promise.all(items.map(async (item, idx) => {
        if (item.startsWith('data:')) {
            const suffix = items.length === 1 && idx === 0 ? catId : `${catId}_${idx}_${Date.now().toString(36)}`;
            const path = await uploadCatImage(item, suffix, collection);
            uploadedPaths.push(path);
            return path;
        }
        return item;
    }));
    return { value: serializeCatImages(results), uploadedPaths };
}

function getCatStatusLabel(status) {
    return t('status_' + (status || 'unknown'));
}

async function uploadCatImage(image, catId, collection = 'cats') {
    if (!currentUser) throw new Error(t('err_login_before_upload'));
    const response = await fetch(image);
    if (!response.ok) throw new Error(t('err_read_upload_image', { status: response.status }));
    const blob = await response.blob();
    const extensionByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };
    const extension = extensionByType[blob.type];
    if (!extension) throw new Error(t('err_unsupported_image'));
    const path = `${currentUser.id}/${collection}/${catId}.${extension}`;
    const { error } = await supabaseClient.storage.from('cat-images').upload(path, blob, {
        cacheControl: '31536000',
        contentType: blob.type,
        upsert: true
    });
    if (error) throw error;
    return path;
}

async function migrateLegacyCloudImages() {
    if (!isCatAdmin) throw new Error(t('err_admin_only_migrate'));
    const imagesToMigrate = cats.filter(cat => cat.image?.startsWith('data:'));
    const { data: submissions, error: submissionsError } = await supabaseClient
        .from('cat_submissions')
        .select('id, name, image');
    if (submissionsError) throw submissionsError;
    const submissionsToMigrate = (submissions || []).filter(submission =>
        submission.image?.startsWith('data:')
    );
    const totalImages = imagesToMigrate.length + submissionsToMigrate.length;
    if (!totalImages) {
        showAppStatus(t('msg_no_legacy_images'));
        return;
    }
    if (!confirm(t('confirm_migrate_images', { total: totalImages }))) return;

    collaborationMigrateImagesButton.disabled = true;
    let migratedCount = 0;
    try {
        for (const cat of imagesToMigrate) {
            const path = await uploadCatImage(cat.image, cat.id);
            const { data, error } = await supabaseClient
                .from('cats')
                .update({ image: path })
                .eq('id', cat.id)
                .select('id');
            if (error) throw error;
            if ((data || []).length !== 1) {
                throw new Error(t('err_no_permission_cat_image', { name: cat.name || cat.id }));
            }
            cat.image = path;
            migratedCount += 1;
            showAppStatus(t('msg_migrate_progress', { migrated: migratedCount, total: totalImages }));
        }
        for (const submission of submissionsToMigrate) {
            const path = await uploadCatImage(submission.image, submission.id, 'submissions');
            const { data, error } = await supabaseClient
                .from('cat_submissions')
                .update({ image: path })
                .eq('id', submission.id)
                .select('id');
            if (error) throw error;
            if ((data || []).length !== 1) {
                throw new Error(t('err_no_permission_submission_image', { name: submission.name || submission.id }));
            }
            migratedCount += 1;
            showAppStatus(t('msg_migrate_progress', { migrated: migratedCount, total: totalImages }));
        }
        renderCatMarkers();
        await refreshPendingSubmissions();
        showAppStatus(t('msg_migrate_done', { count: migratedCount }));
    } catch (error) {
        let refreshError = '';
        try {
            await Promise.all([refreshCloudCats(), refreshPendingSubmissions()]);
        } catch (reloadError) {
            refreshError = ' ' + t('err_reload_latest', { message: reloadError.message });
        }
        throw new Error(
            t('err_migrate_partial', { migrated: migratedCount, total: totalImages }) +
            `${error.message}${refreshError}`
        );
    } finally {
        collaborationMigrateImagesButton.disabled = false;
    }
}

function catToCloudRow(cat) {
    return {
        id: cat.id,
        lat: cat.lat,
        lng: cat.lng,
        name: cat.name,
        location_name: cat.location_name || '',
        note: cat.note,
        image: cat.image,
        approximate: cat.approximate,
        current_status: cat.current_status || 'unknown',
        status_note: cat.status_note || '',
        status_updated_at: cat.status_updated_at || null,
        last_fed_at: cat.last_fed_at || null,
        last_fed_by: cat.last_fed_by || '',
        fed_count: Number(cat.fed_count) || 0,
        pate_count: Number(cat.pate_count) || 0,
        is_sos: Boolean(cat.is_sos),
        sos_note: cat.sos_note || '',
        sightings_count: Number(cat.sightings_count) || 1,
        created_by: cat.created_by || currentUser?.id || null,
        updated_by: currentUser?.id || cat.updated_by || null,
        updated_at: new Date().toISOString()
    };
}

const CAT_UPDATABLE_FIELDS = [
    'lat', 'lng', 'name', 'location_name', 'note', 'image', 'approximate',
    'current_status', 'status_note', 'status_updated_at', 'last_fed_at', 'last_fed_by',
    'fed_count', 'pate_count', 'is_sos', 'sos_note', 'sightings_count'
];

// Khi cập nhật chỉ gửi các cột thật sự đổi, để không ghi đè số liệu
// (lượt cho ăn, pate, SOS…) người khác vừa cập nhật mà máy này chưa nhận.
// Không gửi created_by: chủ sở hữu không đổi khi sửa.
function catUpdatePatch(previous, cat) {
    const patch = {};
    CAT_UPDATABLE_FIELDS.forEach(field => {
        if ((previous[field] ?? null) !== (cat[field] ?? null)) patch[field] = cat[field] ?? null;
    });
    return patch;
}

function isStorageImagePath(image) {
    return typeof image === 'string' && image !== '' && !image.startsWith('data:') && !/^https?:\/\//i.test(image);
}

async function removeStorageImages(paths) {
    const flatPaths = (Array.isArray(paths) ? paths : [paths]).flatMap(parseCatImages);
    const validPaths = [...new Set(flatPaths.filter(isStorageImagePath))];
    if (!validPaths.length || !supabaseClient) return;
    const { error } = await supabaseClient.storage.from('cat-images').remove(validPaths);
    if (error) console.warn('Không thể dọn ảnh trong Storage:', error.message);
}

function catContentChanged(first, second) {
    return first.lat !== second.lat || first.lng !== second.lng || first.name !== second.name ||
        first.location_name !== second.location_name || first.note !== second.note ||
        first.image !== second.image || first.approximate !== second.approximate ||
        first.current_status !== second.current_status || first.status_note !== second.status_note ||
        first.status_updated_at !== second.status_updated_at ||
        first.last_fed_at !== second.last_fed_at ||
        first.last_fed_by !== second.last_fed_by ||
        first.fed_count !== second.fed_count ||
        first.pate_count !== second.pate_count ||
        first.is_sos !== second.is_sos ||
        first.sos_note !== second.sos_note ||
        first.sightings_count !== second.sightings_count;
}

function canManageCat(cat) {
    return !isCloudConfigured || isCatAdmin || Boolean(currentUser && cat.created_by === currentUser.id);
}

function readStoredCats() {
    return databasePromise.then(db => new Promise((resolve, reject) => {
        const transaction = db.transaction('cats', 'readonly');
        const request = transaction.objectStore('cats').getAll();
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result || []);
        transaction.onerror = () => reject(transaction.error || new Error(t('err_idb_read')));
        transaction.onabort = () => reject(transaction.error || new Error(t('err_idb_read_aborted')));
    }));
}

function replaceStoredCats(records) {
    return databasePromise.then(db => new Promise((resolve, reject) => {
        const transaction = db.transaction('cats', 'readwrite');
        const store = transaction.objectStore('cats');
        store.clear();
        records.forEach(cat => store.put(cat));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error(t('err_idb_write')));
        transaction.onabort = () => reject(transaction.error || new Error(t('err_idb_write_aborted')));
    }));
}

function canManageBackups() {
    return Boolean(supabaseClient && currentUser && isSignedIn && isCatAdmin);
}

function updateBackupControls() {
    const allowed = canManageBackups();
    backupActions.hidden = !allowed;
    exportBackupButton.disabled = !allowed || !storageReady;
    importBackupButton.disabled = !allowed || !storageReady;
    if (!allowed) {
        backupActions.classList.remove('expanded');
        backupMenuToggle.setAttribute('aria-expanded', 'false');
        backupMenuToggle.setAttribute('aria-label', t('aria_backup_open'));
        backupFileInput.value = '';
    }
}

function updateCollaborationControls() {
    document.getElementById('commentReportsButton').hidden = !Boolean(currentUser && isCatAdmin);
    updateBackupControls();
    if (!isCloudConfigured) {
        collaborationToggle.textContent = t('collab_not_configured');
        collaborationMessage.textContent = t('collab_msg_local');
        collaborationSignInButton.disabled = true;
        collaborationCreateAccountButton.disabled = true;
        collaborationSignUpButton.disabled = true;
        collaborationSignUpButton.hidden = true;
        collaborationResetPasswordButton.disabled = true;
        collaborationResetPasswordButton.hidden = true;
        collaborationSetPasswordButton.disabled = true;
        return;
    }
    if (!supabaseClient) {
        collaborationToggle.textContent = t('collab_conn_failed');
        collaborationMessage.textContent = t('collab_msg_supabase_err');
        collaborationSignInButton.disabled = true;
        collaborationCreateAccountButton.disabled = true;
        collaborationSignUpButton.disabled = true;
        collaborationResetPasswordButton.disabled = true;
        collaborationSetPasswordButton.disabled = true;
        openModalButton.disabled = true;
        return;
    }

    collaborationToggle.textContent = isCatAdmin
        ? t('collab_admin_access')
        : isSignedIn
            ? t('collab_syncing')
            : t('collab_login_to_add');
    collaborationMessage.textContent = !currentUser
        ? t('collab_msg_guest')
        : isCatAdmin
            ? t('collab_msg_admin', { email: currentUser.email || (currentLang === 'en' ? 'admin' : 'quản trị viên') })
            : isSignedIn
                ? t('collab_msg_user', { email: currentUser.email || (currentLang === 'en' ? 'user' : 'người dùng') })
                : t('collab_msg_logged_out', { email: currentUser.email || '' });
    collaborationEmail.hidden = Boolean(currentUser);
    collaborationPassword.hidden = Boolean(currentUser) || passwordRecoveryMode;
    collaborationSignInButton.hidden = Boolean(currentUser) || passwordRecoveryMode || isSignUpMode;
    collaborationCreateAccountButton.hidden = Boolean(currentUser) || passwordRecoveryMode || !isSignUpMode;
    collaborationSignUpButton.hidden = Boolean(currentUser) || passwordRecoveryMode;
    collaborationResetPasswordButton.hidden = Boolean(currentUser) || passwordRecoveryMode || isSignUpMode;
    collaborationSignUpButton.textContent = isSignUpMode
        ? t('btn_switch_signin')
        : t('btn_switch_signup');
    collaborationPassword.autocomplete = isSignUpMode ? 'new-password' : 'current-password';
    collaborationPassword.placeholder = isSignUpMode
        ? t('ph_password_new')
        : t('ph_password');
    collaborationNewPassword.hidden = !passwordRecoveryMode;
    collaborationSetPasswordButton.hidden = !passwordRecoveryMode;
    moderationQueueToggle.hidden = !isCatAdmin;
    moderationQueueToggle.textContent = t('btn_pending_reviews', { count: pendingCatSubmissions.length });
    collaborationMigrateImagesButton.hidden = !isCatAdmin;
    collaborationMigrateLocalButton.hidden = !localCatsForMigration.length || localCatsMigrationComplete;
    collaborationMigrateLocalButton.disabled = !isSignedIn;
    collaborationMigrateLocalButton.textContent = t('btn_migrate_local', { count: localCatsForMigration.length });
    collaborationSignOutButton.hidden = !currentUser;
    updateDisplayNameButton();
    collaborationSignInButton.disabled = false;
    collaborationCreateAccountButton.disabled = false;
    collaborationSignUpButton.disabled = false;
    collaborationResetPasswordButton.disabled = false;
    collaborationSetPasswordButton.disabled = false;
    openModalButton.disabled = !storageReady || Boolean(pendingMapCat) || (isCloudConfigured && !supabaseClient);
    renderCatMarkers();
}

// Tính trạng thái mới xong mới gán một lần, để các thao tác đang chạy
// không thấy currentUser = null giữa chừng.
async function refreshEditorAccess() {
    let nextUser = null;
    let nextIsAdmin = false;
    if (supabaseClient) {
        const { data: sessionResult, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        nextUser = sessionResult.session?.user || null;
        if (nextUser) {
            const { data, error } = await supabaseClient
                .from('cat_editors')
                .select('user_id, is_admin')
                .eq('user_id', nextUser.id)
                .maybeSingle();
            // Lỗi đọc quyền admin không có nghĩa là chưa đăng nhập.
            if (error) console.warn('Không thể kiểm tra quyền admin:', error.message);
            else nextIsAdmin = Boolean(data?.is_admin);
        }
    }
    if ((currentUser?.id || null) !== (nextUser?.id || null)) resetCatFavoriteState();
    currentUser = nextUser;
    isSignedIn = Boolean(nextUser);
    isCatAdmin = nextIsAdmin;
    updateBackupControls();
    updateCollaborationControls();
}

async function refreshCloudCats() {
    let res = await supabaseClient
        .from('cats')
        .select('id, lat, lng, name, location_name, note, image, approximate, current_status, status_note, status_updated_at, created_by, updated_by, updated_at, last_fed_at, last_fed_by, fed_count, pate_count, is_sos, sos_note, sightings_count')
        .order('updated_at', { ascending: false });
    if (res.error && res.error.message && (res.error.message.includes('sightings_count') || res.error.message.includes('column'))) {
        res = await supabaseClient
            .from('cats')
            .select('id, lat, lng, name, location_name, note, image, approximate, current_status, status_note, status_updated_at, created_by, updated_by, updated_at, last_fed_at, last_fed_by, fed_count, pate_count, is_sos, sos_note')
            .order('updated_at', { ascending: false });
    }
    if (res.error && res.error.message && (res.error.message.includes('is_sos') || res.error.message.includes('sos_note'))) {
        res = await supabaseClient
            .from('cats')
            .select('id, lat, lng, name, location_name, note, image, approximate, current_status, status_note, status_updated_at, created_by, updated_by, updated_at, last_fed_at, last_fed_by, fed_count, pate_count')
            .order('updated_at', { ascending: false });
    }
    if (res.error && res.error.message && (res.error.message.includes('pate_count') || res.error.message.includes('last_fed_at') || res.error.message.includes('column'))) {
        res = await supabaseClient
            .from('cats')
            .select('id, lat, lng, name, location_name, note, image, approximate, current_status, status_note, status_updated_at, created_by, updated_by, updated_at')
            .order('updated_at', { ascending: false });
    }
    if (res.error) throw res.error;
    cats = validateCats(res.data.map(catFromCloudRow));
    renderCatMarkers();
    await refreshCloudCatFavorites({ migrateLocal: true });
    updateDailyFortuneBadge();
    updateWalletDisplay();
    updateSosBadge();
}

function renderModerationQueue() {
    stopObservingCatLocations(moderationQueue);
    moderationQueue.replaceChildren();
    moderationQueueToggle.textContent = t('btn_pending_reviews', { count: pendingCatSubmissions.length });
    if (!pendingCatSubmissions.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = t('moderation_empty');
        moderationQueue.appendChild(emptyMessage);
        return;
    }

    pendingCatSubmissions.forEach(submission => {
        const card = document.createElement('article');
        card.className = 'submission-card';
        const title = document.createElement('b');
        title.textContent = submission.name || t('unnamed_cat');
        card.appendChild(title);
        const location = document.createElement('small');
        setCatLocationLabel(location, submission);
        card.appendChild(location);
        const note = document.createElement('span');
        note.textContent = submission.note || '';
        card.appendChild(note);
        if (submission.image) {
            const image = document.createElement('img');
            image.src = getCatImageUrl(submission.image);
            image.alt = t('alt_submission_photo', { name: submission.name || t('alt_unnamed_cat') });
            card.appendChild(image);
        }

        const actions = document.createElement('div');
        actions.className = 'submission-actions';
        ['approve', 'reject'].forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.submissionAction = action;
            button.dataset.submissionId = submission.id;
            button.textContent = action === 'approve' ? t('btn_approve') : t('btn_reject');
            actions.appendChild(button);
        });
        card.appendChild(actions);
        moderationQueue.appendChild(card);
    });
    observeCatLocations(moderationQueue);
}

async function refreshPendingSubmissions() {
    if (!isCatAdmin) return;
    const { data, error } = await supabaseClient
        .from('cat_submissions')
        .select('id, lat, lng, name, note, image, approximate, submitted_at')
        .order('submitted_at', { ascending: true });
    if (error) throw error;
    pendingCatSubmissions = data || [];
    renderModerationQueue();
}

async function moderateCatSubmission(action, submissionId) {
    if (!isCatAdmin) throw new Error(t('err_admin_only_moderate'));
    const functionName = action === 'approve'
        ? 'approve_cat_submission'
        : 'reject_cat_submission';
    const { error } = await supabaseClient.rpc(functionName, { p_submission_id: submissionId });
    if (error) throw error;
    await Promise.all([refreshPendingSubmissions(), refreshCloudCats()]);
    showAppStatus(action === 'approve' ? t('msg_submission_approved') : t('msg_submission_rejected'));
}

function applyCloudCatChange(payload) {
    if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (!deletedId || !cats.some(cat => cat.id === deletedId)) return;
        cats = cats.filter(cat => cat.id !== deletedId);
    } else if (payload.new?.id) {
        // Chuẩn hóa giống lúc tải toàn bộ danh sách; bỏ qua bản ghi hỏng thay vì làm hỏng cả tab.
        let changedCat;
        try {
            changedCat = validateCats([catFromCloudRow(payload.new)])[0];
        } catch (error) {
            console.warn('Bỏ qua bản ghi mèo realtime không hợp lệ:', payload.new.id, error);
            return;
        }
        const existingIndex = cats.findIndex(cat => cat.id === changedCat.id);
        if (existingIndex >= 0 && !catContentChanged(cats[existingIndex], changedCat)) return;
        if (existingIndex >= 0) cats[existingIndex] = changedCat;
        else cats.unshift(changedCat);
        cats.sort((first, second) =>
            (second.updated_at || '').localeCompare(first.updated_at || '')
        );
    } else {
        return;
    }

    clearTimeout(cloudRenderTimer);
    cloudRenderTimer = setTimeout(renderCatMarkers, 75);
}

async function readLocalCatsForMigration() {
    const storedCats = await readStoredCats();
    if (storedCats.length) return validateCats(storedCats);
    try {
        const legacyData = localStorage.getItem(storageKey);
        return legacyData ? validateCats(JSON.parse(legacyData)) : [];
    } catch (error) {
        console.error('Không thể đọc dữ liệu cũ để di chuyển lên đám mây:', error);
        showAppStatus(t('err_read_local_for_migration', { message: error.message }));
        return [];
    }
}

function subscribeToCloudCats() {
    if (catsRealtimeChannel) supabaseClient.removeChannel(catsRealtimeChannel);
    catsRealtimeChannel = supabaseClient
        .channel('shared-cats-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cats' }, payload => {
            applyCloudCatChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cat_submissions' }, () => {
            if (isCatAdmin) {
                refreshPendingSubmissions().catch(error => {
                    console.error('Không thể tải danh sách mèo chờ duyệt:', error);
                    showAppStatus(t('err_load_pending', { message: error.message }));
                });
            }
        })
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                showAppStatus(t('err_realtime_disconnected'));
            }
        });
}

const catMobileSheet = document.getElementById('catMobileSheet');
const catMobileSheetBody = document.getElementById('catMobileSheetBody');
const catMobileSheetPanel = catMobileSheet?.querySelector('.cat-mobile-sheet-panel');
let catMobileSheetCloseTimer = null;

function isCatMobileSheetOpen() {
    return Boolean(catMobileSheet && !catMobileSheet.hidden);
}

function setMobileSheetContent(content) {
    if (!catMobileSheetBody) return;
    stopObservingCatLocations(catMobileSheetBody.firstElementChild);
    catMobileSheetBody.innerHTML = '';
    catMobileSheetBody.appendChild(content);
    catMobileSheetBody.scrollTop = 0;
}

function closeCatMobileSheet() {
    if (!catMobileSheet || catMobileSheet.hidden) return;
    catMobileSheet.classList.remove('open');
    catMobileSheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('popup-active');
    backupActions.classList.remove('popup-active');
    stopObservingCatLocations(catMobileSheetBody?.firstElementChild);
    activePopupCats = null;
    clearTimeout(catMobileSheetCloseTimer);
    catMobileSheetCloseTimer = setTimeout(() => {
        if (!catMobileSheet.classList.contains('open')) {
            catMobileSheet.hidden = true;
            if (catMobileSheetBody) catMobileSheetBody.innerHTML = '';
        }
    }, 260);
}

function openCatMobileSheet(content, latlng, groupCats) {
    if (!catMobileSheet) return;
    clearTimeout(catMobileSheetCloseTimer);
    if (activeCatPopup) {
        activeCatPopup.remove();
        activeCatPopup = null;
    }
    map.closePopup();
    activePopupCats = groupCats;
    setMobileSheetContent(content);
    if (catMobileSheetPanel) catMobileSheetPanel.style.transform = '';
    catMobileSheet.hidden = false;
    catMobileSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('popup-active');
    backupActions.classList.add('popup-active');
    requestAnimationFrame(() => catMobileSheet.classList.add('open'));
    if (latlng) {
        const targetPoint = map.project(latlng, map.getZoom());
        targetPoint.y += Math.round(window.innerHeight * 0.25);
        map.panTo(map.unproject(targetPoint, map.getZoom()), { animate: true });
    }
}

document.getElementById('catMobileSheetBackdrop')?.addEventListener('click', closeCatMobileSheet);
document.getElementById('catMobileSheetClose')?.addEventListener('click', closeCatMobileSheet);

(() => {
    const handleBar = document.getElementById('catMobileSheetHandleBar');
    if (!handleBar || !catMobileSheetPanel) return;
    let startY = 0;
    let deltaY = 0;
    handleBar.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        deltaY = 0;
        catMobileSheetPanel.style.transition = 'none';
    }, { passive: true });
    handleBar.addEventListener('touchmove', e => {
        deltaY = Math.max(0, e.touches[0].clientY - startY);
        catMobileSheetPanel.style.transform = `translateY(${deltaY}px)`;
    }, { passive: true });
    handleBar.addEventListener('touchend', () => {
        catMobileSheetPanel.style.transition = '';
        if (deltaY > 80) {
            closeCatMobileSheet();
        } else {
            catMobileSheetPanel.style.transform = '';
        }
    });
})();

function showCatPopup(content, latlng, options, groupCats = null) {
    if (window.innerWidth <= 600 && catMobileSheet) {
        openCatMobileSheet(content, latlng, groupCats);
        return;
    }
    closeCatMobileSheet();
    if (activeCatPopup) {
        activeCatPopup.remove();
        activeCatPopup = null;
    }
    activePopupCats = groupCats;
    map.closePopup();
    L.DomEvent.disableScrollPropagation(content);
    activeCatPopup = L.popup(options).setLatLng(latlng).setContent(content);
    activeCatPopup.openOn(map);
    const popup = activeCatPopup;
    setTimeout(() => {
        if (activeCatPopup !== popup) return;
        const popupElement = popup.getElement();
        if (!popupElement) return;
        const popupBounds = popupElement.getBoundingClientRect();
        const mapBounds = map.getContainer().getBoundingClientRect();
        const edgePadding = 12;
        const horizontalOverflow = popupBounds.right > mapBounds.right - edgePadding
            ? popupBounds.right - (mapBounds.right - edgePadding)
            : popupBounds.left < mapBounds.left + edgePadding
                ? popupBounds.left - (mapBounds.left + edgePadding)
                : 0;
        const verticalOverflow = popupBounds.bottom > mapBounds.bottom - edgePadding
            ? popupBounds.bottom - (mapBounds.bottom - edgePadding)
            : popupBounds.top < mapBounds.top + edgePadding
                ? popupBounds.top - (mapBounds.top + edgePadding)
                : 0;
        if (horizontalOverflow || verticalOverflow) {
            map.panBy([horizontalOverflow, verticalOverflow], { animate: false });
        }
    }, 0);
}

function getCatPopupOptions() {
    return {
        minWidth: Math.min(280, window.innerWidth - 64),
        maxWidth: Math.max(200, Math.min(380, window.innerWidth - 48))
    };
}

function openSingleCatPopup(cat) {
    showCatPopup(createCatPopupContent([cat]), [cat.lat, cat.lng], getCatPopupOptions(), [cat]);
}

function openCatGroupPopup(group) {
    showCatPopup(createCatPopupContent(group.cats), group.marker.getLatLng(), getCatPopupOptions(), group.cats);
}

function openNearbyCatPopup(groups, latlng) {
    const nearbyCats = groups.flatMap(group => group.cats);
    showCatPopup(createCatPopupContent(nearbyCats), latlng, getCatPopupOptions(), nearbyCats);
}

function normalizeSearchText(value) {
    return value.toLocaleLowerCase('vi')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function getLocationCacheKey(lat, lng) {
    return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function getCatLocationName(cat) {
    const savedName = cat.location_name?.trim() || '';
    const cached = reverseGeocodeCache.get(getLocationCacheKey(cat.lat, cat.lng));
    return cached && (!savedName || savedName === cached.baseName) ? cached.name : savedName;
}

function setCatLocationLabel(element, cat, prefix = t('label_location_prefix')) {
    const name = getCatLocationName(cat);
    element.textContent = prefix + (name || (currentLang === 'vi' ? 'Đang tìm tên địa điểm…' : 'Locating address…'));
    if (name) element.title = name;
    const cacheKey = getLocationCacheKey(cat.lat, cat.lng);
    if (reverseGeocodeCache.has(cacheKey)) return;
    element.dataset.locationKey = cacheKey;
    element.dataset.locationLat = cat.lat;
    element.dataset.locationLng = cat.lng;
    element.dataset.locationPrefix = prefix;
    element.dataset.locationSavedName = cat.location_name?.trim() || '';
}

async function resolveCatLocationLabel(element) {
    const { locationLat, locationLng, locationPrefix, locationSavedName } = element.dataset;
    try {
        await lookupLocationName(Number(locationLat), Number(locationLng));
        if (!element.isConnected) return;
        const name = getCatLocationName({ lat: locationLat, lng: locationLng, location_name: locationSavedName });
        element.textContent = locationPrefix + name;
        element.title = name;
    } catch (error) {
        if (element.isConnected) element.textContent = locationPrefix + (locationSavedName || (currentLang === 'vi' ? 'Chưa xác định địa điểm' : 'Location undetermined'));
    }
}

function stopObservingCatLocations(container) {
    if (!container || typeof container !== 'object') return;
    catLocationObservers.get(container)?.disconnect();
    catLocationObservers.delete(container);
}

function observeCatLocations(container) {
    stopObservingCatLocations(container);
    const labels = container.querySelectorAll('[data-location-key]');
    if (!labels.length) return;
    if (!window.IntersectionObserver) {
        labels.forEach(resolveCatLocationLabel);
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            resolveCatLocationLabel(entry.target);
        });
    });
    catLocationObservers.set(container, observer);
    labels.forEach(label => observer.observe(label));
}

function lookupLocationName(lat, lng) {
    const cacheKey = getLocationCacheKey(lat, lng);
    if (reverseGeocodeCache.has(cacheKey)) return Promise.resolve(reverseGeocodeCache.get(cacheKey).name);
    if (reverseGeocodePending.has(cacheKey)) return reverseGeocodePending.get(cacheKey);
    if ((reverseGeocodeFailures.get(cacheKey) || 0) > Date.now()) {
        return Promise.reject(new Error(t('err_geocode_retry_later')));
    }

    const lookup = reverseGeocodeQueue.then(async () => {
        const waitTime = Math.max(0, 1100 - (Date.now() - lastReverseGeocodeAt));
        if (waitTime) await new Promise(resolve => setTimeout(resolve, waitTime));
        lastReverseGeocodeAt = Date.now();

        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.search = new URLSearchParams({
            format: 'jsonv2',
            lat: String(lat),
            lon: String(lng),
            zoom: '18',
            addressdetails: '1'
        });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let result;
        try {
            const response = await fetch(url, {
                headers: { 'Accept-Language': currentLang === 'en' ? 'en' : 'vi' },
                signal: controller.signal
            });
            if (!response.ok) throw new Error(t('err_geocode_http', { status: response.status }));
            result = await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
        const address = result.address || {};
        const locality = address.city || address.town || address.village ||
            address.municipality || address.county || address.state;
        const area = address.suburb || address.neighbourhood || address.quarter ||
            address.city_district;
        const road = address.road || address.pedestrian || address.footway;
        const fallbackName = result.name?.trim() || result.display_name?.split(',').slice(0, 3).map(part => part.trim()).join(', ').trim();
        const baseName = [...new Set([road, area, locality].filter(Boolean))].join(', ') || fallbackName;
        const streetAddress = [String(address.house_number ?? '').trim(), road].filter(Boolean).join(' ');
        const locationName = [...new Set([streetAddress, area, locality].filter(Boolean))].join(', ') || fallbackName;
        if (!locationName) throw new Error(t('err_geocode_not_found'));
        const normalizedName = locationName.slice(0, 120);
        reverseGeocodeCache.set(cacheKey, { name: normalizedName, baseName: (baseName || locationName).slice(0, 120) });
        reverseGeocodeFailures.delete(cacheKey);
        while (reverseGeocodeCache.size > 200) reverseGeocodeCache.delete(reverseGeocodeCache.keys().next().value);
        try {
            localStorage.setItem(locationNameCacheKey, JSON.stringify([...reverseGeocodeCache]));
        } catch (error) {
            // The in-memory cache still works when browser storage is unavailable.
        }
        return normalizedName;
    });
    const pending = lookup.catch(error => {
        reverseGeocodeFailures.set(cacheKey, Date.now() + 60000);
        throw error;
    }).finally(() => reverseGeocodePending.delete(cacheKey));
    reverseGeocodePending.set(cacheKey, pending);
    reverseGeocodeQueue = pending.catch(() => {});
    return pending;
}

function getFilteredCatResults() {
    const query = normalizeSearchText(catSearchInput.value.trim());
    const selectedStatus = catStatusFilter.value;
    const radius = catDistanceFilter.value ? Number(catDistanceFilter.value) : null;
    const results = cats.map(cat => ({
        cat,
        distance: catFilterLocation ? L.latLng(cat.lat, cat.lng).distanceTo(catFilterLocation) : null
    })).filter(({ cat, distance }) => {
        const matchesStatus = !selectedStatus ||
            (selectedStatus === 'sos' ? Boolean(cat.is_sos) :
            selectedStatus === 'hungry' ? (!cat.last_fed_at || !isSameDay(new Date(cat.last_fed_at), new Date())) :
            (cat.current_status || 'unknown') === selectedStatus);
        return (!favoritesOnly || favoriteCatIds.has(cat.id)) &&
            matchesStatus &&
            (!radius || (distance !== null && distance <= radius)) &&
            normalizeSearchText(`${cat.name || ''} ${cat.note || ''} ${getCatDisplayNote(cat)} ${getCatLocationName(cat)}`).includes(query);
    });
    if (catFilterLocation) results.sort((a, b) => a.distance - b.distance);
    return results;
}

function updateCatLocationControls() {
    catLocationButton.disabled = catLocationLoading;
    catLocationButton.textContent = catLocationLoading ? (currentLang === 'vi' ? 'Đang lấy vị trí…' : 'Getting location…') :
        catFilterLocation ? (currentLang === 'vi' ? 'Cập nhật vị trí' : 'Update location') : t('btn_use_location');
    catLocationNote.textContent = catLocationLoading ? (currentLang === 'vi' ? 'Đang xác định vị trí của bạn…' : 'Locating your device…') :
        catLocationError || (catFilterLocation
            ? (currentLang === 'vi' ? 'Xếp gần nhất trước. Khoảng cách tính theo đường thẳng từ vị trí của bạn.' : 'Nearest first. Straight-line distance from your location.')
            : t('location_note'));
}

function requestCatFilterLocation(setView = false) {
    if (catLocationLoading) return;
    catLocationLoading = true;
    catLocationError = '';
    updateCatLocationControls();
    renderCatList();
    map.locate({ setView, maxZoom: 16, timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
}

function renderCatList(results = getFilteredCatResults()) {
    const hasFilters = Boolean(catSearchInput.value.trim() || catStatusFilter.value || catDistanceFilter.value);
    const filterCount = Number(Boolean(catStatusFilter.value)) + Number(Boolean(catDistanceFilter.value));
    catFiltersSummary.textContent = filterCount ? `${t('filter_summary')} (${filterCount})` : t('filter_summary');
    const favoriteCount = cats.filter(cat => favoriteCatIds.has(cat.id)).length;
    catAllTab.textContent = `${t('cat_all')} (${cats.length})`;
    catFavoritesTab.textContent = `${t('cat_fav')} (${favoriteCount})`;
    catAllTab.setAttribute('aria-pressed', String(!favoritesOnly));
    catFavoritesTab.setAttribute('aria-pressed', String(favoritesOnly));
    catFavoritesNote.hidden = !favoritesOnly && !favoriteSyncError;
    catFavoritesNote.textContent = !currentUser ? t('fav_login_note')
        : favoriteLoading ? (currentLang === 'vi' ? 'Đang tải yêu thích từ tài khoản…' : 'Loading favorites…')
            : favoriteSaving ? (currentLang === 'vi' ? 'Đang lưu yêu thích vào tài khoản…' : 'Saving favorites…')
                : favoriteSyncError || (currentLang === 'vi' ? 'Yêu thích được lưu theo tài khoản và đồng bộ giữa các thiết bị.' : 'Favorites are synced across your devices.');
    catListToggle.textContent = favoritesOnly ? `${t('cat_fav')} (${results.length}/${favoriteCount})` : hasFilters
        ? `${t('cat_list_btn')} (${results.length}/${cats.length})`
        : `${t('cat_list_btn')} (${cats.length})`;
    catClearFiltersButton.disabled = !hasFilters;
    catFilterSummary.textContent = catDistanceFilter.value && !catFilterLocation
        ? (currentLang === 'vi' ? 'Cần vị trí của bạn để lọc theo khoảng cách.' : 'Location required to filter by distance.')
        : favoritesOnly ? (currentLang === 'vi' ? `Hiển thị ${results.length}/${favoriteCount} mèo yêu thích trên bản đồ.` : `Showing ${results.length}/${favoriteCount} favorite cats on map.`)
            : (currentLang === 'vi' ? `Hiển thị ${results.length}/${cats.length} mèo trên bản đồ.` : `Showing ${results.length}/${cats.length} cats on map.`);
    stopObservingCatLocations(catSearchResults);
    catSearchResults.replaceChildren();
    if (!results.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'cat-search-empty';
        emptyMessage.textContent = favoritesOnly && !currentUser
            ? t('list_empty_fav_login')
            : favoritesOnly && favoriteLoading ? t('list_empty_fav_loading')
            : favoritesOnly && favoriteSyncError ? t('list_empty_fav_error')
            : favoritesOnly && !favoriteCount
            ? t('list_empty_fav_none')
            : catDistanceFilter.value && !catFilterLocation
            ? catLocationLoading ? t('list_empty_gps_wait') : t('list_empty_need_location')
            : cats.length ? t('list_empty_no_match') : t('list_empty_no_cats');
        catSearchResults.appendChild(emptyMessage);
        return;
    }

    results.forEach(({ cat, distance }) => {
        const card = document.createElement('div');
        card.className = 'cat-search-result';
        card.setAttribute('role', 'listitem');
        card.dataset.catId = cat.id;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cat-search-open';
        button.dataset.catOpen = cat.id;
        const name = document.createElement('span');
        name.textContent = cat.name || t('unnamed_cat');
        button.appendChild(name);
        const location = document.createElement('small');
        location.className = 'cat-search-location';
        setCatLocationLabel(location, cat);
        button.appendChild(location);
        const details = document.createElement('small');
        const distanceLabel = distance === null ? '' : distance < 1000
            ? `${Math.round(distance)} m`
            : `${(distance / 1000).toLocaleString(currentLang === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 })} km`;
        details.textContent = [getCatStatusLabel(cat.current_status), distanceLabel].filter(Boolean).join(' · ');
        button.appendChild(details);
        const displayNote = getCatDisplayNote(cat);
        if (displayNote) {
            const note = document.createElement('small');
            note.textContent = displayNote;
            button.appendChild(note);
        }
        button.addEventListener('click', () => {
            catListPanel.classList.remove('expanded');
            catListToggle.setAttribute('aria-expanded', 'false');
            map.setView([cat.lat, cat.lng], Math.max(map.getZoom(), 17));
            openSingleCatPopup(cat);
        });
        card.append(button, createCatQuickActions(cat));
        catSearchResults.appendChild(card);
    });
    observeCatLocations(catSearchResults);
}

function openNearbyCatPopupIfNeeded(clickedGroup) {
    const clickedElement = clickedGroup.marker.getElement();
    if (!clickedElement) return false;
    const clickedBounds = clickedElement.getBoundingClientRect();
    const nearbyGroups = [...markerGroups.values()].filter(group => {
        const element = group.marker.getElement();
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        return clickedBounds.left < bounds.right && clickedBounds.right > bounds.left &&
            clickedBounds.top < bounds.bottom && clickedBounds.bottom > bounds.top;
    });
    if (nearbyGroups.length < 2) return false;

    openNearbyCatPopup(nearbyGroups, clickedGroup.marker.getLatLng());
    return true;
}

function addCatMarker(cat, openPopup = false) {
    const key = `${cat.lat},${cat.lng}`;
    let group = markerGroups.get(key);
    if (group) {
        group.cats.push(cat);
        const previewCat = [...group.cats].reverse().find(item => item.image) || cat;
        group.marker.setIcon(createCatIcon(previewCat));
    } else {
        const marker = L.marker([cat.lat, cat.lng], { icon: createCatIcon(cat) });
        group = { marker, cats: [cat] };
        marker._catGroup = group;
        if (catMarkerLayer) catMarkerLayer.addLayer(marker);
        else marker.addTo(map);
        markerGroups.set(key, group);
        marker.on('click', () => {
            if (!openNearbyCatPopupIfNeeded(group)) openCatGroupPopup(group);
        });
    }
    if (openPopup) {
        if (catMarkerLayer && typeof catMarkerLayer.zoomToShowLayer === 'function') {
            catMarkerLayer.zoomToShowLayer(group.marker, () => openCatGroupPopup(group));
        } else {
            openCatGroupPopup(group);
        }
    }
}

// Làm mới popup mèo đang mở bằng dữ liệu mới nhất thay vì đóng nó.
function refreshOpenCatPopup(catIds) {
    const freshCats = catIds.map(id => cats.find(cat => cat.id === id)).filter(Boolean);
    if (!freshCats.length) {
        closeCatMobileSheet();
        map.closePopup();
        return;
    }
    activePopupCats = freshCats;
    if (isCatMobileSheetOpen()) {
        const focused = document.activeElement;
        if (catMobileSheetBody && focused && catMobileSheetBody.contains(focused) && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)) {
            return;
        }
        setMobileSheetContent(createCatPopupContent(freshCats));
        return;
    }
    const popupElement = activeCatPopup.getElement();
    const focused = document.activeElement;
    // Người dùng đang gõ trong popup: giữ nguyên để không mất chữ đang nhập.
    if (popupElement && focused && popupElement.contains(focused) && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)) {
        return;
    }
    stopObservingCatLocations(activeCatPopup.getContent());
    const content = createCatPopupContent(freshCats);
    L.DomEvent.disableScrollPropagation(content);
    activeCatPopup.setContent(content);
}

function renderCatMarkers() {
    const openPopupCatIds = (isCatMobileSheetOpen() && activePopupCats)
        ? activePopupCats.map(cat => cat.id)
        : (activeCatPopup && activePopupCats && activeCatPopup.isOpen()
            ? activePopupCats.map(cat => cat.id)
            : null);
    if (!openPopupCatIds) {
        closeCatMobileSheet();
        map.closePopup();
    }
    if (catMarkerLayer) catMarkerLayer.clearLayers();
    else markerGroups.forEach(group => group.marker.remove());
    markerGroups.clear();
    const results = getFilteredCatResults();
    results.forEach(({ cat }) => addCatMarker(cat));
    renderCatList(results);
    updateDailyFortuneBadge();
    updateSosBadge();
    if (openPopupCatIds) refreshOpenCatPopup(openPopupCatIds);
}


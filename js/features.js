function openLeaderboardModal(activeTab = 'idol') {
    switchLeaderboardTab(activeTab);
    leaderboardModal.classList.add('active');
}

function closeLeaderboardModal() {
    leaderboardModal.classList.remove('active');
}

function switchLeaderboardTab(tab) {
    if (tab === 'sos') {
        tabIdolBtn.classList.remove('active');
        tabSosBtn.classList.add('active');
        panelIdol.style.display = 'none';
        panelSos.style.display = 'block';
        renderSosList();
    } else {
        tabSosBtn.classList.remove('active');
        tabIdolBtn.classList.add('active');
        panelSos.style.display = 'none';
        panelIdol.style.display = 'block';
        renderIdolList();
    }
}

function renderIdolList() {
    idolList.innerHTML = '';
    if (!cats.length) {
        const emptyEl = document.createElement('div');
        emptyEl.style.textAlign = 'center';
        emptyEl.style.padding = '24px 12px';
        emptyEl.style.color = '#8c7377';
        emptyEl.textContent = currentLang === 'en' ? 'No cats on the map to rank yet.' : 'Chưa có bé mèo nào trên bản đồ để xếp hạng.';
        idolList.appendChild(emptyEl);
        return;
    }

    const rankedCats = [...cats].sort((a, b) => {
        const scoreA = (Number(a.pate_count) || 0) * 10 + (Number(a.fed_count) || 0);
        const scoreB = (Number(b.pate_count) || 0) * 10 + (Number(b.fed_count) || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (Number(b.pate_count) || 0) - (Number(a.pate_count) || 0);
    }).slice(0, 10);

    rankedCats.forEach((cat, index) => {
        const card = document.createElement('div');
        card.className = 'leaderboard-card' + (index === 0 ? ' rank-1' : '');

        const rankEl = document.createElement('div');
        rankEl.className = 'leaderboard-rank';
        rankEl.textContent = index === 0 ? '👑' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `#${index + 1}`));

        let avatarEl;
        if (cat.image) {
            avatarEl = document.createElement('img');
            avatarEl.className = 'leaderboard-card-avatar';
            avatarEl.src = getCatImageUrl(cat.image);
            avatarEl.alt = cat.name || t('alt_cat');
        } else {
            avatarEl = document.createElement('div');
            avatarEl.className = 'leaderboard-card-avatar emoji-avatar';
            const emojis = ['🐱', '😸', '😻', '😽', '🐾'];
            avatarEl.textContent = emojis[Math.abs(cat.id.charCodeAt(0) || 0) % emojis.length];
        }

        const infoEl = document.createElement('div');
        infoEl.className = 'leaderboard-card-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'leaderboard-card-name';
        nameEl.textContent = cat.name || (currentLang === 'en' ? 'Anonymous Cat' : 'Bé mèo ẩn danh');

        const locEl = document.createElement('div');
        locEl.className = 'leaderboard-card-location';
        setCatLocationLabel(locEl, cat, '📍 ');

        const metricsEl = document.createElement('div');
        metricsEl.className = 'leaderboard-card-metrics';

        const pateEl = document.createElement('span');
        pateEl.className = 'metric-pate';
        pateEl.textContent = `🐟 ${cat.pate_count || 0} pate`;

        const fedEl = document.createElement('span');
        fedEl.className = 'metric-fed';
        fedEl.textContent = currentLang === 'en' ? `🥣 ${cat.fed_count || 0} meals` : `🥣 ${cat.fed_count || 0} lần ăn`;

        metricsEl.append(pateEl, fedEl);
        infoEl.append(nameEl, locEl, metricsEl);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'leaderboard-card-btn';
        actionBtn.textContent = currentLang === 'en' ? '🐾 Locate' : '🐾 Đến chỗ';
        actionBtn.onclick = () => {
            closeLeaderboardModal();
            map.flyTo([cat.lat, cat.lng], Math.max(map.getZoom(), 17), { duration: 1.2 });
            setTimeout(() => {
                openSingleCatPopup(cat);
            }, 1250);
        };

        card.append(rankEl, avatarEl, infoEl, actionBtn);
        idolList.appendChild(card);
    });
}

function renderSosList() {
    sosList.innerHTML = '';
    const sosCats = cats.filter(c => c.is_sos);
    if (!sosCats.length) {
        const emptyEl = document.createElement('div');
        emptyEl.style.textAlign = 'center';
        emptyEl.style.padding = '28px 12px';
        emptyEl.style.color = '#059669';
        emptyEl.style.fontWeight = '700';
        emptyEl.innerHTML = currentLang === 'en'
            ? '🎉 No cats currently need emergency rescue!<br><span style="font-size:12px; font-weight:normal; color:#6b7280;">Every cat on the map is safe. Thank you amazing hoomans! ❤️</span>'
            : '🎉 Hiện không có bé mèo nào cần cứu trợ khẩn cấp!<br><span style="font-size:12px; font-weight:normal; color:#6b7280;">Mọi bé mèo trên bản đồ đều đang an toàn. Cảm ơn cộng đồng Sen! ❤️</span>';
        sosList.appendChild(emptyEl);
        return;
    }

    sosCats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'leaderboard-card sos-card';

        let avatarEl;
        if (cat.image) {
            avatarEl = document.createElement('img');
            avatarEl.className = 'leaderboard-card-avatar';
            avatarEl.src = getCatImageUrl(cat.image);
            avatarEl.alt = cat.name || t('alt_sos_cat');
        } else {
            avatarEl = document.createElement('div');
            avatarEl.className = 'leaderboard-card-avatar emoji-avatar';
            avatarEl.textContent = '🚨';
        }

        const infoEl = document.createElement('div');
        infoEl.className = 'leaderboard-card-info';

        const tagEl = document.createElement('div');
        tagEl.className = 'sos-badge-tag';
        tagEl.textContent = currentLang === 'en' ? '🚨 NEEDS RESCUE' : '🚨 CẦN HỖ TRỢ';

        const nameEl = document.createElement('div');
        nameEl.className = 'leaderboard-card-name';
        nameEl.textContent = cat.name || (currentLang === 'en' ? 'SOS Cat' : 'Bé mèo SOS');

        const locEl = document.createElement('div');
        locEl.className = 'leaderboard-card-location';
        setCatLocationLabel(locEl, cat, '📍 ');

        const noteEl = document.createElement('div');
        noteEl.style.fontSize = '11px';
        noteEl.style.color = '#dc2626';
        noteEl.style.fontWeight = '700';
        noteEl.style.marginTop = '2px';
        noteEl.textContent = cat.sos_note
            ? (currentLang === 'en' ? `Note: ${cat.sos_note}` : `Ghi chú: ${cat.sos_note}`)
            : (currentLang === 'en' ? 'Reported needing rescue by community!' : 'Được cộng đồng báo cần cứu trợ!');

        infoEl.append(tagEl, nameEl, locEl, noteEl);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'leaderboard-card-btn';
        actionBtn.style.background = '#ef4444';
        actionBtn.textContent = currentLang === 'en' ? '🚨 Rescue' : '🚨 Cứu trợ';
        actionBtn.onclick = () => {
            closeLeaderboardModal();
            map.flyTo([cat.lat, cat.lng], Math.max(map.getZoom(), 17), { duration: 1.2 });
            setTimeout(() => {
                openSingleCatPopup(cat);
            }, 1250);
        };

        card.append(avatarEl, infoEl, actionBtn);
        sosList.appendChild(card);
    });
}

async function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function fetchCatSightings(catId) {
    const cat = cats.find(item => item.id === catId);
    if (!cat) return [];

    let remoteSightings = [];
    if (isCloudConfigured && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('cat_sightings')
                .select('id, cat_id, seen_at, image, note, reporter_name, created_at')
                .eq('cat_id', catId)
                .order('seen_at', { ascending: true });
            if (!error && Array.isArray(data)) {
                remoteSightings = data;
            }
        } catch (e) {
            console.warn('Không thể tải sightings từ cloud:', e);
        }
    }

    const localSightings = Array.isArray(cat.sightings) ? cat.sightings : [];
    const mergedMap = new Map();
    localSightings.forEach(s => mergedMap.set(s.id, s));
    remoteSightings.forEach(s => mergedMap.set(s.id, s));

    return Array.from(mergedMap.values()).sort((a, b) => {
        const ta = new Date(a.seen_at || a.created_at || 0).getTime();
        const tb = new Date(b.seen_at || b.created_at || 0).getTime();
        return ta - tb;
    });
}

function openSightingModal(catId) {
    const cat = cats.find(item => item.id === catId);
    if (!cat) return;
    currentSightingCatId = catId;
    currentSightingImageDataUrl = '';

    const catName = cat.name || (currentLang === 'vi' ? 'bé mèo' : 'kitty');
    sightingModalTitle.textContent = t('sighting_modal_title_cat', { name: catName });
    sightingModalDesc.textContent = t('sighting_modal_desc_cat', { name: cat.name || (currentLang === 'vi' ? 'bé' : 'kitty') });

    if (sightingPhotoInput) sightingPhotoInput.value = '';
    if (sightingPhotoCamera) sightingPhotoCamera.value = '';
    sightingPhotoPreview.src = '';
    sightingPhotoPreviewWrap.style.display = 'none';

    const todayStr = new Date().toLocaleDateString('en-CA');
    sightingDateInput.value = todayStr;

    sightingNoteInput.value = '';

    // Điền sẵn biệt danh (không bao giờ điền email).
    sightingReporterInput.value = getDisplayName();

    sightingSubmitBtn.disabled = false;
    sightingSubmitBtn.textContent = t('btn_sighting_submit');

    sightingModal.classList.add('active');
}

function closeSightingModal() {
    sightingPhotoSeq++;
    sightingModal.classList.remove('active');
    currentSightingCatId = null;
    currentSightingImageDataUrl = '';
    if (sightingPhotoInput) sightingPhotoInput.value = '';
    if (sightingPhotoCamera) sightingPhotoCamera.value = '';
    sightingPhotoPreview.src = '';
    sightingPhotoPreviewWrap.style.display = 'none';
}

async function handleSightingSubmit() {
    if (!currentSightingCatId) return;
    const catId = currentSightingCatId;
    const cat = cats.find(c => c.id === catId);
    if (!cat) return;

    const note = sightingNoteInput.value.trim().slice(0, 1000);
    const enteredReporter = sightingReporterInput.value.trim().slice(0, 40);
    const reporterName = enteredReporter || t('timeline_kind_hooman');
    // Lần đầu chưa có biệt danh: dùng tên vừa nhập làm biệt danh (để trống cũng tính là đã chọn).
    if (!isDisplayNameSet()) {
        setDisplayName(enteredReporter).catch(error => console.warn('Không thể lưu biệt danh:', error));
    }
    const dateVal = sightingDateInput.value;
    const seenAt = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : new Date().toISOString();

    sightingSubmitBtn.disabled = true;
    sightingSubmitBtn.textContent = currentLang === 'vi' ? 'Đang lưu kỷ niệm...' : 'Saving encounter...';

    try {
        let imagePath = currentSightingImageDataUrl || null;
        const sightingId = createCatId();

        if (isCloudConfigured && supabaseClient && currentUser && currentSightingImageDataUrl) {
            try {
                imagePath = await uploadCatImage(currentSightingImageDataUrl, sightingId, 'sightings');
            } catch (uploadError) {
                console.warn('Không thể tải ảnh lên Storage, lưu dataUrl:', uploadError);
                imagePath = currentSightingImageDataUrl;
            }
        }

        const newSighting = {
            id: sightingId,
            cat_id: catId,
            seen_at: seenAt,
            image: imagePath,
            note: note,
            reporter_name: reporterName,
            created_at: new Date().toISOString()
        };

        let savedOnCloud = false;
        if (isCloudConfigured && supabaseClient) {
            const { error } = await supabaseClient.rpc('add_cat_sighting', {
                p_cat_id: catId,
                p_image: imagePath,
                p_note: note,
                p_reporter_name: reporterName,
                p_seen_at: seenAt
            });
            // Bảng cat_sightings không còn cho insert trực tiếp; chỉ ghi qua RPC có kiểm tra.
            if (error) throw new Error(error.message);
            savedOnCloud = true;
            await refreshCloudCats();
        }

        if (!Array.isArray(cat.sightings)) cat.sightings = [];
        cat.sightings.push(newSighting);
        const updatedCount = (Number(cat.sightings_count) || 1) + 1;
        cat.sightings_count = updatedCount;

        if (!savedOnCloud) {
            await persistCats(cats.map(item => item.id === catId ? {
                ...item,
                sightings_count: updatedCount,
                sightings: cat.sightings
            } : item));
        }

        closeSightingModal();
        renderCatMarkers();

        const updatedCat = cats.find(item => item.id === catId);
        if (updatedCat) {
            openSingleCatPopup(updatedCat);
        }

        showAppStatus(t('toast_sighting_saved', { name: cat.name || (currentLang === 'vi' ? 'bé' : 'kitty'), count: updatedCount }));
        setTimeout(() => {
            openTimelineModal(catId);
        }, 400);
    } catch (err) {
        console.error('Không thể lưu kỷ niệm gặp lại:', err);
        showAppStatus(currentLang === 'vi' ? `Không thể lưu: ${err.message}` : `Failed to save: ${err.message}`);
        sightingSubmitBtn.disabled = false;
        sightingSubmitBtn.textContent = currentLang === 'vi' ? 'Thử lại' : 'Retry';
    }
}

let timelineRequestSeq = 0;
async function openTimelineModal(catId) {
    const cat = cats.find(item => item.id === catId);
    if (!cat) return;
    currentTimelineCatId = catId;
    const requestId = ++timelineRequestSeq;

    const catName = cat.name || (currentLang === 'vi' ? 'Bé mèo' : 'Kitty');
    timelineModalTitle.textContent = t('timeline_modal_title_cat', { name: catName });
    timelineModalSubtitle.textContent = t('timeline_modal_subtitle_cat', { name: cat.name || (currentLang === 'vi' ? 'bé' : 'kitty') });
    timelineBody.innerHTML = `<div style="text-align:center; padding: 24px; color:#8c7377;">${t('timeline_loading')}</div>`;
    timelineModal.classList.add('active');

    const sightings = await fetchCatSightings(catId);
    // Bỏ kết quả cũ nếu trong lúc chờ đã mở hành trình của bé khác hoặc đã đóng modal.
    if (requestId !== timelineRequestSeq || currentTimelineCatId !== catId || !timelineModal.classList.contains('active')) return;
    const totalCount = 1 + sightings.length;
    const countNum = Math.max(totalCount, Number(cat.sightings_count) || 1);
    timelineTotalCount.textContent = t('timeline_total_encounters', { count: countNum });

    timelineBody.innerHTML = '';

    const listEl = document.createElement('div');
    listEl.className = 'timeline-list';

    const initialDate = cat.created_at || cat.updated_at ? new Date(cat.created_at || cat.updated_at) : new Date();
    const initialCard = createTimelineCard({
        isFirst: true,
        date: initialDate,
        image: cat.image,
        note: getCatDisplayNote(cat) || t('timeline_initial_note'),
        reporterName: cat.created_by ? t('timeline_first_discoverer') : t('timeline_spotting_hooman')
    });
    listEl.appendChild(initialCard);

    sightings.forEach(sighting => {
        const sightDate = sighting.seen_at ? new Date(sighting.seen_at) : (sighting.created_at ? new Date(sighting.created_at) : new Date());
        const card = createTimelineCard({
            isFirst: false,
            date: sightDate,
            image: sighting.image,
            note: sighting.note,
            reporterName: sighting.reporter_name || t('timeline_kind_hooman')
        });
        listEl.appendChild(card);
    });

    timelineBody.appendChild(listEl);
}

function createTimelineCard({ isFirst, date, image, note, reporterName }) {
    const card = document.createElement('div');
    card.className = 'timeline-card';

    const dot = document.createElement('div');
    dot.className = 'timeline-node-dot' + (isFirst ? ' first-meet' : '');
    dot.textContent = isFirst ? '🌱' : '🐾';
    card.appendChild(dot);

    const header = document.createElement('div');
    header.className = 'timeline-card-header';

    const monthStr = date && Number.isFinite(date.getTime())
        ? (currentLang === 'vi'
            ? `Tháng ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
            : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
        : t('timeline_old_memory');
    const dateStr = date && Number.isFinite(date.getTime())
        ? date.toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    const monthTag = document.createElement('span');
    monthTag.className = 'timeline-month-tag';
    monthTag.textContent = isFirst ? t('timeline_first_encounter', { month: monthStr }) : t('timeline_encounter_item', { month: monthStr });

    const dateLabel = document.createElement('span');
    dateLabel.className = 'timeline-date-time';
    dateLabel.textContent = dateStr;

    header.append(monthTag, dateLabel);
    card.appendChild(header);

    if (image) {
        const imgEl = document.createElement('img');
        imgEl.className = 'timeline-card-image';
        imgEl.src = getCatImageUrl(image);
        imgEl.alt = note || (currentLang === 'vi' ? 'Ảnh bé mèo' : 'Cat photo');
        imgEl.tabIndex = 0;
        imgEl.addEventListener('click', () => openImageViewer(imgEl));
        imgEl.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openImageViewer(imgEl);
            }
        });
        card.appendChild(imgEl);
    }

    if (note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'timeline-card-note';
        noteEl.textContent = note;
        card.appendChild(noteEl);
    }

    if (reporterName) {
        const repEl = document.createElement('div');
        repEl.className = 'timeline-card-reporter';
        repEl.textContent = t('timeline_recorded_by', { name: reporterName });
        card.appendChild(repEl);
    }

    return card;
}

function closeTimelineModal() {
    timelineModal.classList.remove('active');
    currentTimelineCatId = null;
}

let currentFortuneIdx = 0;
const FORTUNE_SEEN_KEY = 'catMap_fortune_seen_date';

function getDailyHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function isFortuneSeenToday(todayStr) {
    try {
        return localStorage.getItem(FORTUNE_SEEN_KEY) === todayStr;
    } catch (e) {
        return false;
    }
}

// Dùng một khóa duy nhất thay vì mỗi ngày một khóa, và dọn các khóa cũ.
function markFortuneSeen(todayStr) {
    try {
        localStorage.setItem(FORTUNE_SEEN_KEY, todayStr);
        Object.keys(localStorage)
            .filter(key => key.startsWith('catMap_fortune_seen_') && key !== FORTUNE_SEEN_KEY)
            .forEach(key => localStorage.removeItem(key));
    } catch (e) {}
}

function updateDailyFortuneBadge() {
    if (!fortunePillBadge) return;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const seen = isFortuneSeenToday(todayStr);
    if (seen) {
        fortunePillBadge.classList.add('hidden');
    } else {
        fortunePillBadge.classList.remove('hidden');
    }
}

function openFortuneModal(forceRandom = false) {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const localeStr = currentLang === 'en' ? 'en-US' : 'vi-VN';
    fortuneDate.textContent = today.toLocaleDateString(localeStr, {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const fortunesList = currentLang === 'en' ? CAT_FORTUNES_EN : CAT_FORTUNES;

    if (!cats.length) {
        currentFortuneCat = null;
        fortuneCatName.textContent = currentLang === 'en' ? 'Lucky Stray Cat 🐾' : 'Mèo May Mắn Sổ Tay 🐾';
        fortuneCatLoc.textContent = currentLang === 'en' ? '📍 All across town' : '📍 Khắp mọi nẻo đường';
        fortuneCatImg.style.display = 'none';
        fortuneCatEmoji.style.display = 'block';
        fortuneCatEmoji.textContent = '😻';
        fortuneTitle.textContent = currentLang === 'en' ? 'Bright Beginnings' : 'Khởi Đầu Tươi Sáng';
        fortuneMessage.textContent = currentLang === 'en'
            ? 'Today is a wonderful day! Keep your eyes open, you might be the first to spot and mark a cute cat on the map.'
            : 'Hôm nay là một ngày tuyệt vời! Hãy mở mắt thật to, có thể bạn sẽ là người đầu tiên ghi dấu một bé mèo lên bản đồ đấy.';
        fortuneGoToCatBtn.style.display = 'none';
        fortuneModal.classList.add('active');
        markFortuneSeen(todayStr);
        fortunePillBadge.classList.add('hidden');
        return;
    }

    fortuneGoToCatBtn.style.display = 'block';

    let selectedCat;
    let fortune;

    if (forceRandom || !currentFortuneCat) {
        if (forceRandom && cats.length > 1) {
            const otherCats = cats.filter(c => !currentFortuneCat || c.id !== currentFortuneCat.id);
            selectedCat = otherCats[Math.floor(Math.random() * otherCats.length)];
        } else if (!forceRandom) {
            selectedCat = cats[getDailyHash(todayStr) % cats.length];
        } else {
            selectedCat = cats[0];
        }
        // Quẻ trong ngày cố định theo ngày; "xem quẻ khác" thì ngẫu nhiên.
        currentFortuneIdx = forceRandom
            ? Math.floor(Math.random() * fortunesList.length)
            : getDailyHash(todayStr + '|fortune') % fortunesList.length;
        fortune = fortunesList[currentFortuneIdx];
    } else {
        // Mở lại (hoặc đổi ngôn ngữ): giữ đúng quẻ đã rút.
        selectedCat = currentFortuneCat;
        fortune = fortunesList[currentFortuneIdx % fortunesList.length];
    }

    currentFortuneCat = selectedCat;
    fortuneCatName.textContent = selectedCat.name || (currentLang === 'en' ? 'Mysterious Cat' : 'Bé mèo bí ẩn');
    setCatLocationLabel(fortuneCatLoc, selectedCat, '📍 ');

    if (selectedCat.image) {
        fortuneCatImg.src = getCatImageUrl(selectedCat.image);
        fortuneCatImg.style.display = 'block';
        fortuneCatEmoji.style.display = 'none';
    } else {
        fortuneCatImg.style.display = 'none';
        fortuneCatEmoji.style.display = 'block';
        const emojis = ['🐱', '😸', '😻', '😽', '🐾'];
        fortuneCatEmoji.textContent = emojis[Math.abs(selectedCat.id.charCodeAt(0) || 0) % emojis.length];
    }

    fortuneTitle.textContent = fortune.title;
    fortuneMessage.textContent = fortune.desc;

    fortuneModal.classList.add('active');
    markFortuneSeen(todayStr);
    fortunePillBadge.classList.add('hidden');
}

function closeFortuneModal() {
    fortuneModal.classList.remove('active');
}

async function handleCatPopupActionClick(event) {
    const feedBtn = event.target.closest('button[data-cat-feed]');
    if (feedBtn) {
        event.preventDefault();
        event.stopPropagation();
        const catId = feedBtn.dataset.catFeed;
        feedBtn.disabled = true;
        feedBtn.textContent = t('btn_recording');
        try {
            await checkInCatFeed(catId);
        } catch (error) {
            console.error('Không thể ghi nhận bữa ăn:', error);
            showAppStatus(t('err_record_feed', { message: error.message }));
            feedBtn.disabled = false;
            feedBtn.textContent = t('btn_feed_retry');
        }
        return;
    }
    const pateBtn = event.target.closest('button[data-cat-pate]');
    if (pateBtn) {
        event.preventDefault();
        event.stopPropagation();
        const catId = pateBtn.dataset.catPate;
        pateBtn.disabled = true;
        pateBtn.textContent = t('btn_giving');
        try {
            await giveCatPate(catId);
        } catch (error) {
            console.error('Không thể tặng pate:', error);
            showAppStatus(t('err_give_pate', { message: error.message }));
            pateBtn.disabled = false;
            pateBtn.textContent = t('btn_give_pate');
        }
        return;
    }
    const sosReportBtn = event.target.closest('button[data-cat-sos-report]');
    if (sosReportBtn) {
        event.preventDefault();
        event.stopPropagation();
        const catId = sosReportBtn.dataset.catSosReport;
        const cat = cats.find(c => c.id === catId);
        const catName = cat?.name || (currentLang === 'vi' ? 'bé mèo' : 'cat');
        const promptMsg = currentLang === 'vi'
            ? `Nhập tình trạng hoặc lý do cần cứu trợ cho ${catName} (VD: bị thương, đói lả, cần đưa đi thú y...):`
            : `Enter situation or reason urgent help is needed for ${catName} (e.g. injured, starving, needs vet...):`;
        const note = prompt(promptMsg, cat?.sos_note || '');
        if (note === null) return;
        sosReportBtn.disabled = true;
        sosReportBtn.textContent = currentLang === 'vi' ? 'Đang gửi báo cáo...' : 'Submitting report...';
        try {
            await toggleCatSos(catId, true, note);
        } catch (error) {
            console.error('Không thể báo SOS:', error);
            showAppStatus(t('err_report_sos', { message: error.message }));
            sosReportBtn.disabled = false;
            sosReportBtn.textContent = t('btn_report_sos');
        }
        return;
    }
    const sosResolveBtn = event.target.closest('button[data-cat-sos-resolve]');
    if (sosResolveBtn) {
        event.preventDefault();
        event.stopPropagation();
        const catId = sosResolveBtn.dataset.catSosResolve;
        const cat = cats.find(c => c.id === catId);
        const catName = cat?.name || (currentLang === 'vi' ? 'bé mèo' : 'cat');
        const confirmMsg = currentLang === 'vi'
            ? `Xác nhận bé ${catName} đã được hỗ trợ hoặc đã an toàn?`
            : `Confirm that ${catName} has received help or is now safe?`;
        if (!confirm(confirmMsg)) {
            return;
        }
        sosResolveBtn.disabled = true;
        sosResolveBtn.textContent = currentLang === 'vi' ? 'Đang cập nhật...' : 'Updating...';
        try {
            await toggleCatSos(catId, false, '');
        } catch (error) {
            console.error('Không thể hủy SOS:', error);
            showAppStatus(t('err_update', { message: error.message }));
            sosResolveBtn.disabled = false;
            sosResolveBtn.textContent = t('btn_resolve_sos');
        }
        return;
    }
    const sightingAddBtn = event.target.closest('button[data-cat-sighting-add]');
    if (sightingAddBtn) {
        event.preventDefault();
        event.stopPropagation();
        openSightingModal(sightingAddBtn.dataset.catSightingAdd);
        return;
    }
    const timelineBtn = event.target.closest('button[data-cat-timeline]');
    if (timelineBtn) {
        event.preventDefault();
        event.stopPropagation();
        openTimelineModal(timelineBtn.dataset.catTimeline);
        return;
    }
    const statusButton = event.target.closest('button[data-cat-status]');
    if (statusButton) {
        event.preventDefault();
        event.stopPropagation();
        const popupEntry = statusButton.closest('.cat-popup-entry');
        if (statusButton.dataset.catStatus === 'other') {
            const otherForm = popupEntry.querySelector('.cat-status-other-form');
            otherForm.hidden = false;
            otherForm.querySelector('textarea').focus();
            return;
        }
        const statusButtons = [...popupEntry.querySelectorAll('button[data-cat-status], button[data-cat-status-submit]')];
        statusButtons.forEach(button => { button.disabled = true; });
        try {
            await updateCatStatus(statusButton.dataset.catId, statusButton.dataset.catStatus);
        } catch (error) {
            console.error('Không thể cập nhật tình trạng mèo:', error);
            showAppStatus(t('err_update_status', { message: error.message }));
            statusButtons.forEach(button => { button.disabled = false; });
        }
        return;
    }
    const statusSubmitButton = event.target.closest('button[data-cat-status-submit]');
    if (statusSubmitButton) {
        event.preventDefault();
        event.stopPropagation();
        const popupEntry = statusSubmitButton.closest('.cat-popup-entry');
        const statusButtons = [...popupEntry.querySelectorAll('button[data-cat-status], button[data-cat-status-submit]')];
        const statusNote = popupEntry.querySelector(`textarea[data-cat-status-note="${statusSubmitButton.dataset.catStatusSubmit}"]`).value;
        statusButtons.forEach(button => { button.disabled = true; });
        try {
            await updateCatStatus(statusSubmitButton.dataset.catStatusSubmit, 'other', statusNote);
        } catch (error) {
            console.error('Không thể cập nhật tình trạng mèo:', error);
            showAppStatus(t('err_update_status', { message: error.message }));
            statusButtons.forEach(button => { button.disabled = false; });
        }
        return;
    }
    const button = event.target.closest('button[data-cat-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    try {
        if (button.dataset.catAction === 'edit') {
            await openEditModal(button.dataset.catId);
        } else if (button.dataset.catAction === 'delete') {
            await deleteCat(button.dataset.catId);
        }
    } catch (error) {
        console.error('Không thể cập nhật dấu mèo:', error);
        showAppStatus(t('err_update_data', { message: error.message }));
    }
}

map.getContainer().addEventListener('click', handleCatPopupActionClick);
if (catMobileSheetBody) catMobileSheetBody.addEventListener('click', handleCatPopupActionClick);

openModalButton.onclick = () => {
    if (isCloudConfigured && !currentUser) {
        map.closePopup();
        catListPanel.classList.remove('expanded');
        catListToggle.setAttribute('aria-expanded', 'false');
        isSignUpMode = false;
        updateCollaborationControls();
        collaborationPanel.classList.add('expanded');
        collaborationToggle.setAttribute('aria-expanded', 'true');
        collaborationMessage.textContent = t('collab_msg_add_cat_prompt');
        collaborationEmail.focus();
        return;
    }
    editingCatId = null;
    editModalSeq++;
    modalTitle.textContent = t('add_modal_title');
    saveButton.textContent = isCloudConfigured ? t('btn_add_to_map') : (currentLang === 'en' ? 'Save Location' : 'Lưu vị trí');
    chooseMapLocationButton.style.display = 'block';
    editLocationFields.classList.remove('active');
    document.getElementById('catName').value = '';
    document.getElementById('catLocationName').value = '';
    document.getElementById('catNote').value = '';
    sourceImage = null;
    modalCatPhotos = [];
    activeModalPhotoIndex = -1;
    renderCatPhotoStrip();
    currentImageDataUrl = '';
    previewContainer.style.display = 'none';
    resetImageEditor();
    modal.classList.add('active');
    const mc = modal.querySelector('.modal-content');
    if (mc) mc.scrollTop = 0;
};
chooseMapLocationButton.onclick = () => {
    try {
        commitActiveModalPhotoEdit();
        currentImageDataUrl = serializeCatImages(modalCatPhotos.map(p => p.value)) || '';
        pendingMapCat = {
            name: document.getElementById('catName').value.trim() || t('unnamed_cat'),
            location_name: document.getElementById('catLocationName').value.trim(),
            note: document.getElementById('catNote').value.trim() || t('default_cat_note'),
            image: currentImageDataUrl
        };
        resetAndCloseModal();
        openModalButton.disabled = true;
        mapSelectionPrompt.classList.add('active');
        map.closePopup();
    } catch (error) {
        console.error('Không thể chuẩn bị ảnh mèo:', error);
        showAppStatus(t('err_process_image', { message: error.message }));
    }
};
document.getElementById('cancelMapSelectionBtn').onclick = () => {
    pendingMapCat = null;
    mapSelectionPrompt.classList.remove('active');
    openModalButton.disabled = !storageReady || Boolean(pendingMapCat) || (isCloudConfigured && !supabaseClient);
};
L.DomEvent.disableClickPropagation(collaborationPanel);
collaborationToggle.onclick = () => {
    const expanded = collaborationPanel.classList.toggle('expanded');
    collaborationToggle.setAttribute('aria-expanded', String(expanded));
};
function validateCollaborationEmail() {
    collaborationEmail.value = collaborationEmail.value.trim();
    collaborationEmail.setCustomValidity(!collaborationEmail.value
        ? t('err_email_required')
        : collaborationEmail.validity.typeMismatch
            ? t('err_email_invalid')
            : '');
    if (!collaborationEmail.reportValidity()) {
        collaborationEmail.focus();
        return null;
    }
    return collaborationEmail.value;
}
collaborationEmail.addEventListener('input', () => collaborationEmail.setCustomValidity(''));
collaborationContent.onsubmit = async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    const email = validateCollaborationEmail();
    if (!email) return;
    collaborationSignInButton.disabled = true;
    collaborationCreateAccountButton.disabled = true;
    try {
        if (isSignUpMode) {
            const password = collaborationPassword.value;
            if (password.length < 8) {
                collaborationMessage.textContent = currentLang === 'en' ? 'Password must be at least 8 characters.' : 'Mật khẩu cần có ít nhất 8 ký tự.';
                return;
            }
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
            });
            if (error) throw error;
            if (data.session) {
                await refreshEditorAccess();
                await refreshCloudCats();
                collaborationMessage.textContent = t('collab_msg_signup_success');
            } else {
                isSignUpMode = false;
                updateCollaborationControls();
                collaborationMessage.textContent = t('collab_msg_signup_success_verify');
            }
        } else {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email,
                password: collaborationPassword.value
            });
            if (error) throw error;
            await refreshEditorAccess();
            await refreshCloudCats();
            if (isCatAdmin) await refreshPendingSubmissions();
            collaborationPassword.value = '';
        }
    } catch (error) {
        console.error(isSignUpMode ? 'Không thể tạo tài khoản:' : 'Không thể đăng nhập cộng tác:', error);
        collaborationMessage.textContent = isSignUpMode
            ? (currentLang === 'en' ? `Account creation failed: ${error.message}` : `Tạo tài khoản thất bại: ${error.message}`)
            : (currentLang === 'en' ? `Sign in failed: ${error.message}` : `Đăng nhập thất bại: ${error.message}`);
    } finally {
        collaborationSignInButton.disabled = false;
        collaborationCreateAccountButton.disabled = false;
    }
};
collaborationSignUpButton.onclick = () => {
    isSignUpMode = !isSignUpMode;
    collaborationPassword.value = '';
    updateCollaborationControls();
    collaborationMessage.textContent = isSignUpMode
        ? t('collab_msg_signup_mode')
        : t('collab_msg_signin_mode');
    collaborationPassword.focus();
};
collaborationResetPasswordButton.onclick = async () => {
    if (!supabaseClient) return;
    const email = validateCollaborationEmail();
    if (!email) return;
    collaborationResetPasswordButton.disabled = true;
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}${window.location.pathname}`
        });
        if (error) throw error;
        collaborationMessage.textContent = t('collab_msg_reset_sent');
    } catch (error) {
        console.error('Không thể gửi email đặt lại mật khẩu:', error);
        collaborationMessage.textContent = `${currentLang === 'en' ? 'Failed to send password reset email:' : 'Không thể gửi email đặt lại mật khẩu:'} ${error.message}`;
    } finally {
        collaborationResetPasswordButton.disabled = false;
    }
};
collaborationSetPasswordButton.onclick = async () => {
    if (!supabaseClient) return;
    const password = collaborationNewPassword.value;
    if (password.length < 8) {
        collaborationMessage.textContent = currentLang === 'en' ? 'New password must be at least 8 characters.' : 'Mật khẩu mới cần có ít nhất 8 ký tự.';
        return;
    }
    collaborationSetPasswordButton.disabled = true;
    try {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        passwordRecoveryMode = false;
        collaborationNewPassword.value = '';
        await refreshEditorAccess();
        collaborationMessage.textContent = t('collab_msg_password_set');
    } catch (error) {
        console.error('Không thể đặt mật khẩu:', error);
        collaborationMessage.textContent = `${currentLang === 'en' ? 'Failed to set password:' : 'Không thể đặt mật khẩu:'} ${error.message}`;
    } finally {
        collaborationSetPasswordButton.disabled = false;
    }
};
collaborationMigrateLocalButton.onclick = async () => {
    collaborationMigrateLocalButton.disabled = true;
    try {
        await migrateLocalCatsToCloud();
    } catch (error) {
        console.error('Không thể di chuyển mèo lên dữ liệu chung:', error);
        collaborationMessage.textContent = t('err_migrate_local', { message: error.message });
    } finally {
        collaborationMigrateLocalButton.disabled = !isSignedIn;
    }
};
collaborationDisplayNameButton.onclick = async () => {
    const entered = prompt(t('prompt_display_name'), getDisplayName());
    if (entered === null) return;
    collaborationDisplayNameButton.disabled = true;
    try {
        const saved = await setDisplayName(entered);
        showAppStatus(t('toast_display_name_saved', {
            name: saved || (currentLang === 'en' ? 'A kind Hooman' : 'Một Sen tốt bụng')
        }));
    } catch (error) {
        console.error('Không thể lưu biệt danh:', error);
        showAppStatus(t('err_display_name_save', { message: error.message }));
    } finally {
        collaborationDisplayNameButton.disabled = false;
    }
};

collaborationSignOutButton.onclick = async () => {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        currentUser = null;
        isSignedIn = false;
        isCatAdmin = false;
        pendingCatSubmissions = [];
        updateCollaborationControls();
    } catch (error) {
        console.error('Không thể đăng xuất:', error);
        collaborationMessage.textContent = t('err_signout', { message: error.message });
    }
};
document.getElementById('commentReportsButton').onclick = () => {
    if (currentUser && isCatAdmin) window.catCommunity?.open(null, true);
};
moderationQueueToggle.onclick = async () => {
    if (!isCatAdmin) return;
    moderationQueue.hidden = !moderationQueue.hidden;
    moderationQueueToggle.setAttribute('aria-expanded', String(!moderationQueue.hidden));
    if (!moderationQueue.hidden) {
        moderationQueueToggle.disabled = true;
        try {
            await refreshPendingSubmissions();
        } catch (error) {
            console.error('Không thể tải danh sách mèo chờ duyệt:', error);
            showAppStatus(t('err_load_pending', { message: error.message }));
        } finally {
            moderationQueueToggle.disabled = false;
        }
    }
};
moderationQueue.addEventListener('click', async event => {
    const button = event.target.closest('button[data-submission-action]');
    if (!button) return;
    if (button.dataset.submissionAction === 'reject' &&
        !confirm(t('confirm_reject_submission'))) return;
    const submissionId = button.dataset.submissionId;
    const actionButtons = [...moderationQueue.querySelectorAll('button[data-submission-id]')]
        .filter(actionButton => actionButton.dataset.submissionId === submissionId);
    actionButtons.forEach(actionButton => { actionButton.disabled = true; });
    try {
        await moderateCatSubmission(button.dataset.submissionAction, submissionId);
    } catch (error) {
        console.error('Không thể duyệt bài gửi mèo:', error);
        showAppStatus(t('err_process_submission', { message: error.message }));
        actionButtons.forEach(actionButton => { actionButton.disabled = false; });
    }
});
if (supabaseClient) {
    collaborationToggle.textContent = t('collab_connecting');
    supabaseClient.auth.onAuthStateChange(event => {
        if (event === 'PASSWORD_RECOVERY') passwordRecoveryMode = true;
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            currentUser = null;
            resetCatFavoriteState();
            isSignedIn = false;
            isCatAdmin = false;
            pendingCatSubmissions = [];
            updateBackupControls();
            setTimeout(updateCollaborationControls, 0);
        } else if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') {
            setTimeout(async () => {
                try {
                    await refreshEditorAccess();
                    if (storageReady) {
                        await refreshCloudCats();
                        if (isCatAdmin) await refreshPendingSubmissions();
                        syncSenWalletToDatabase();
                    }
                } catch (error) {
                    console.error('Không thể cập nhật quyền cộng tác:', error);
                    showAppStatus(t('err_verify_account', { message: error.message }));
                }
            }, 0);
        }
    });
} else {
    updateCollaborationControls();
}
L.DomEvent.disableClickPropagation(catListPanel);
L.DomEvent.disableScrollPropagation(catListPanel);
catListToggle.onclick = () => {
    const expanded = catListPanel.classList.toggle('expanded');
    catListToggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) {
        renderCatList();
        catSearchInput.focus();
    }
};
catSearchInput.addEventListener('input', () => renderCatMarkers());
catAllTab.addEventListener('click', () => {
    favoritesOnly = false;
    renderCatMarkers();
});
catFavoritesTab.addEventListener('click', () => {
    favoritesOnly = true;
    renderCatMarkers();
    refreshCloudCatFavorites({ migrateLocal: true });
});
window.addEventListener('storage', event => {
    if (event.key !== favoriteCatsStorageKey && event.key !== null) return;
    if (currentUser) refreshCloudCatFavorites({ migrateLocal: true });
});
window.addEventListener('focus', () => {
    if (currentUser && storageReady) refreshCloudCatFavorites();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser && storageReady) refreshCloudCatFavorites();
});
catStatusFilter.addEventListener('change', () => renderCatMarkers());
catDistanceFilter.addEventListener('change', () => {
    renderCatMarkers();
    if (catDistanceFilter.value && !catFilterLocation) requestCatFilterLocation();
});
catLocationButton.addEventListener('click', () => requestCatFilterLocation());
catClearFiltersButton.addEventListener('click', () => {
    catSearchInput.value = '';
    catStatusFilter.value = '';
    catDistanceFilter.value = '';
    renderCatMarkers();
});
map.on('locationfound', event => {
    catFilterLocation = event.latlng;
    catLocationLoading = false;
    catLocationError = '';
    if (catLocationMarker) catLocationMarker.setLatLng(event.latlng);
    else catLocationMarker = L.circleMarker(event.latlng, {
        radius: 8, color: '#ff8da1', fillColor: '#ff8da1', fillOpacity: 0.5
    }).addTo(map);
    updateCatLocationControls();
    renderCatMarkers();
});
map.on('locationerror', event => {
    catLocationLoading = false;
    catLocationError = event.code === 1
        ? t('err_location_denied')
        : t('err_location_unavailable');
    if (catFilterLocation) catLocationError += ' ' + t('msg_distance_uses_previous');
    updateCatLocationControls();
    renderCatList();
});
requestCatFilterLocation(true);
document.addEventListener('click', event => {
    if (!catListPanel.contains(event.target)) {
        catListPanel.classList.remove('expanded');
        catListToggle.setAttribute('aria-expanded', 'false');
    }
});
imageViewerClose.onclick = closeImageViewer;
imageViewer.addEventListener('click', event => {
    if (event.target === imageViewer) closeImageViewer();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        if (imageViewer.classList.contains('active')) closeImageViewer();
        if (fortuneModal.classList.contains('active')) closeFortuneModal();
        if (senWalletModal.classList.contains('active')) closeSenWalletModal();
        if (leaderboardModal.classList.contains('active')) closeLeaderboardModal();
        if (sightingModal.classList.contains('active')) closeSightingModal();
        if (timelineModal.classList.contains('active')) closeTimelineModal();
        if (qrModal && qrModal.classList.contains('active')) qrModal.classList.remove('active');
        if (gameModal && gameModal.classList.contains('active')) closeGameModal();
    }
});

fortunePillButton.onclick = () => openFortuneModal();
closeFortuneModalBtn.onclick = closeFortuneModal;
fortuneModal.addEventListener('click', event => {
    if (event.target === fortuneModal) closeFortuneModal();
});
fortuneRedrawBtn.onclick = () => openFortuneModal(true);
fortuneGoToCatBtn.onclick = () => {
    if (!currentFortuneCat) return;
    const targetCat = currentFortuneCat;
    closeFortuneModal();
    map.flyTo([targetCat.lat, targetCat.lng], Math.max(map.getZoom(), 17), { duration: 1.2 });
    setTimeout(() => {
        openSingleCatPopup(targetCat);
    }, 1250);
};

senWalletBtn.onclick = () => openSenWalletModal();
closeSenWalletModalBtn.onclick = closeSenWalletModal;
senWalletModal.addEventListener('click', event => {
    if (event.target === senWalletModal) closeSenWalletModal();
});

leaderboardPillBtn.onclick = () => openLeaderboardModal('idol');
closeLeaderboardModalBtn.onclick = closeLeaderboardModal;
tabIdolBtn.onclick = () => switchLeaderboardTab('idol');
tabSosBtn.onclick = () => switchLeaderboardTab('sos');
leaderboardModal.addEventListener('click', event => {
    if (event.target === leaderboardModal) closeLeaderboardModal();
});

sightingCancelBtn.onclick = closeSightingModal;
sightingModal.addEventListener('click', event => {
    if (event.target === sightingModal) closeSightingModal();
});
timelineCloseBtn.onclick = closeTimelineModal;
timelineModal.addEventListener('click', event => {
    if (event.target === timelineModal) closeTimelineModal();
});
timelineAddNowBtn.onclick = () => {
    if (!currentTimelineCatId) return;
    const targetId = currentTimelineCatId;
    closeTimelineModal();
    openSightingModal(targetId);
};
const handleSightingPhotoFile = async (file) => {
    if (!file) return;
    const targetCatId = currentSightingCatId;
    const requestId = ++sightingPhotoSeq;
    try {
        const dataUrl = await compressImageFile(file, 1280, 0.82);
        // Bỏ ảnh nếu trong lúc nén người dùng đã đóng modal, bỏ ảnh hoặc chuyển sang bé khác.
        if (requestId !== sightingPhotoSeq || currentSightingCatId !== targetCatId || !sightingModal.classList.contains('active')) return;
        currentSightingImageDataUrl = dataUrl;
        sightingPhotoPreview.src = dataUrl;
        sightingPhotoPreviewWrap.style.display = 'block';
    } catch (error) {
        console.error('Không thể xử lý ảnh:', error);
        alert(t('err_read_photo'));
    }
};
if (sightingPhotoCamera) sightingPhotoCamera.onchange = (e) => handleSightingPhotoFile(e.target.files[0]);
if (sightingPhotoInput) sightingPhotoInput.onchange = (e) => handleSightingPhotoFile(e.target.files[0]);

sightingRemovePhotoBtn.onclick = () => {
    sightingPhotoSeq++;
    if (sightingPhotoInput) sightingPhotoInput.value = '';
    if (sightingPhotoCamera) sightingPhotoCamera.value = '';
    currentSightingImageDataUrl = '';
    sightingPhotoPreview.src = '';
    sightingPhotoPreviewWrap.style.display = 'none';
};
sightingSubmitBtn.onclick = handleSightingSubmit;

if (qrPillBtn) qrPillBtn.onclick = () => qrModal.classList.add('active');
if (closeQrModalBtn) closeQrModalBtn.onclick = () => qrModal.classList.remove('active');
if (qrModal) qrModal.addEventListener('click', event => { if (event.target === qrModal) qrModal.classList.remove('active'); });
if (copyAppUrlBtn) {
    copyAppUrlBtn.onclick = async () => {
        const url = 'https://phamduyen6611-ops.github.io/so-tay-bat-meo/';
        try {
            await navigator.clipboard.writeText(url);
            copyAppUrlBtn.textContent = t('btn_copied');
            setTimeout(() => { copyAppUrlBtn.textContent = t('btn_copy_link'); }, 2000);
        } catch {
            prompt(t('prompt_copy_link'), url);
        }
    };
}

/* ========================================================
   Mini-Game 1: Hứng Pate Cho Mèo 🐟🥫
   ======================================================== */
let gameAudioCtx = null;
function getGameAudioContext() {
    if (!gameAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) gameAudioCtx = new AudioCtx();
    }
    if (gameAudioCtx && gameAudioCtx.state === 'suspended') {
        gameAudioCtx.resume().catch(() => {});
    }
    return gameAudioCtx;
}

function playTone(freq, duration, type = 'sine', gainVal = 0.12) {
    try {
        const ctx = getGameAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

function playItemSound(itemType) {
    if (itemType === 'fish') {
        playTone(587.33, 0.12, 'sine', 0.12);
    } else if (itemType === 'pate') {
        playTone(659.25, 0.08, 'triangle', 0.14);
        setTimeout(() => playTone(880, 0.12, 'triangle', 0.12), 70);
    } else if (itemType === 'bowl') {
        playTone(783.99, 0.08, 'sine', 0.15);
        setTimeout(() => playTone(1046.50, 0.14, 'sine', 0.12), 80);
    } else if (itemType === 'bomb') {
        playTone(160, 0.22, 'sawtooth', 0.2);
    }
}

let gameRunning = false;
let gameAnimationId = null;
let gameTimerInterval = null;
let gameScore = 0;
let gameTimeLeft = 30;
let gameLives = 3;
let gameItems = [];
let gameParticles = [];
let gameFloatingTexts = [];
let spawnCountdown = 0;
let screenShake = 0;
const gameKeysDown = {};

const gamePlayer = {
    x: 142,
    y: 360,
    w: 76,
    h: 36
};

const GAME_ITEM_DEFS = [
    { type: 'fish', emoji: '🐟', points: 5, weight: 45, speed: [2.3, 3.3], radius: 18 },
    { type: 'pate', emoji: '🥫', points: 10, weight: 30, speed: [2.8, 3.8], radius: 20 },
    { type: 'bowl', emoji: '🥣', points: 15, weight: 15, speed: [3.2, 4.4], radius: 22 },
    { type: 'bomb', emoji: '💣', points: -15, isBomb: true, weight: 10, speed: [2.8, 4.0], radius: 20 }
];

function chooseRandomGameItem() {
    const totalWeight = GAME_ITEM_DEFS.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const def of GAME_ITEM_DEFS) {
        if (rand < def.weight) return def;
        rand -= def.weight;
    }
    return GAME_ITEM_DEFS[0];
}

function spawnGameItem() {
    const def = chooseRandomGameItem();
    const baseSpeed = def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]);
    const difficultyMult = 1 + (30 - gameTimeLeft) * 0.015;
    const x = def.radius + Math.random() * (360 - def.radius * 2);
    gameItems.push({
        type: def.type,
        emoji: def.emoji,
        points: def.points,
        isBomb: Boolean(def.isBomb),
        radius: def.radius,
        x,
        y: -def.radius,
        vy: baseSpeed * difficultyMult,
        rotation: (Math.random() - 0.5) * 0.2,
        rotSpeed: (Math.random() - 0.5) * 0.04
    });
}

function addGameScorePopup(x, y, text, color) {
    gameFloatingTexts.push({
        x,
        y,
        text,
        color,
        alpha: 1.0,
        vy: -1.6,
        life: 32
    });
}

function addGameSparkles(x, y, color) {
    for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.4 + Math.random() * 2.6;
        gameParticles.push({
            x,
            y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            radius: 2 + Math.random() * 2.5,
            color,
            alpha: 1.0,
            life: 24
        });
    }
}

function updateGameHud() {
    if (gameScoreText) gameScoreText.textContent = String(gameScore);
    if (gameTimerText) gameTimerText.textContent = `${Math.max(0, gameTimeLeft)}s`;
    if (gameLivesText) {
        const safeLives = Math.max(0, Math.min(3, gameLives));
        gameLivesText.textContent = '❤️'.repeat(safeLives) + '🖤'.repeat(3 - safeLives);
    }
}

function drawGamePlayer(ctx, player) {
    const x = player.x;
    const y = player.y;
    const w = player.w;
    const h = player.h;

    ctx.save();
    // Bóng dưới đáy
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w * 0.44, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fill();

    // Mèo con nhô đầu từ bát
    ctx.font = '32px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐱', x + w / 2, y - 4);

    // Bát đựng pate
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, y + 10, w, 22, [6, 6, 12, 12]);
    } else {
        ctx.rect(x, y + 10, w, 22);
    }
    const bowlGrad = ctx.createLinearGradient(x, y + 10, x, y + 32);
    bowlGrad.addColorStop(0, '#f97316');
    bowlGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = bowlGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#c2410c';
    ctx.stroke();

    // Vành miệng bát
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x - 3, y + 8, w + 6, 6, 3);
    } else {
        ctx.rect(x - 3, y + 8, w + 6, 6);
    }
    ctx.fillStyle = '#fed7aa';
    ctx.fill();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nhãn dán chữ PATE trên bát
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🥣 PATE', x + w / 2, y + 21);

    ctx.restore();
}

function drawInitialGameCanvas() {
    if (!gameCanvas) return;
    const ctx = gameCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 360, 420);

    // Nền cỏ xanh phía dưới
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 396, 360, 24);
    ctx.fillStyle = '#22c55e';
    for (let i = 10; i < 360; i += 24) {
        ctx.fillRect(i, 393, 3, 5);
    }

    drawGamePlayer(ctx, gamePlayer);
}

function gameLoop() {
    if (!gameRunning || !gameCanvas) return;
    const ctx = gameCanvas.getContext('2d');
    if (!ctx) return;

    // Xử lý di chuyển bằng bàn phím
    if (gameKeysDown['left']) {
        gamePlayer.x = Math.max(0, gamePlayer.x - 7.5);
    }
    if (gameKeysDown['right']) {
        gamePlayer.x = Math.min(360 - gamePlayer.w, gamePlayer.x + 7.5);
    }

    // Xóa khung hình
    ctx.clearRect(0, 0, 360, 420);

    // Hiệu ứng rung màn hình khi trúng bom
    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        screenShake = Math.max(0, screenShake - 1);
    }

    // Nền cỏ
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 396, 360, 24);
    ctx.fillStyle = '#22c55e';
    for (let i = 10; i < 360; i += 24) {
        ctx.fillRect(i, 393, 3, 5);
    }

    // Sinh vật phẩm rơi
    spawnCountdown -= 1;
    if (spawnCountdown <= 0) {
        spawnGameItem();
        const minSpawn = Math.max(34, 58 - (30 - gameTimeLeft));
        const maxSpawn = Math.max(48, 76 - (30 - gameTimeLeft));
        spawnCountdown = Math.floor(minSpawn + Math.random() * (maxSpawn - minSpawn));
    }

    // Cập nhật và vẽ vật phẩm rơi
    const bowlTop = gamePlayer.y + 6;
    const bowlBottom = gamePlayer.y + gamePlayer.h;
    const bowlLeft = gamePlayer.x - 6;
    const bowlRight = gamePlayer.x + gamePlayer.w + 6;

    for (let i = gameItems.length - 1; i >= 0; i--) {
        const item = gameItems[i];
        item.y += item.vy;
        item.rotation += item.rotSpeed;

        // Kiểm tra va chạm với bát
        if (item.y + item.radius >= bowlTop &&
            item.y - item.radius <= bowlBottom &&
            item.x >= bowlLeft &&
            item.x <= bowlRight) {

            playItemSound(item.type);
            if (item.isBomb) {
                gameLives -= 1;
                gameScore = Math.max(0, gameScore + item.points);
                screenShake = 12;
                addGameScorePopup(item.x, item.y, '-15 💥', '#ef4444');
                addGameSparkles(item.x, item.y, '#f87171');
                updateGameHud();
                if (gameLives <= 0) {
                    gameItems.splice(i, 1);
                    ctx.restore();
                    endGame('dead');
                    return;
                }
            } else {
                gameScore += item.points;
                const text = `+${item.points}`;
                const color = item.type === 'bowl' ? '#d97706' : (item.type === 'pate' ? '#059669' : '#0284c7');
                addGameScorePopup(item.x, item.y, text, color);
                addGameSparkles(item.x, item.y, color);
                updateGameHud();
            }

            gameItems.splice(i, 1);
            continue;
        }

        // Rơi ra ngoài đáy màn hình
        if (item.y - item.radius > 420) {
            gameItems.splice(i, 1);
            continue;
        }

        // Vẽ vật phẩm
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotation);
        ctx.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, 0, 0);
        ctx.restore();
    }

    // Vẽ bé mèo và bát
    drawGamePlayer(ctx, gamePlayer);

    // Cập nhật và vẽ hạt hiệu ứng (particles)
    for (let i = gameParticles.length - 1; i >= 0; i--) {
        const p = gameParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        p.alpha = Math.max(0, p.life / 24);
        if (p.life <= 0) {
            gameParticles.splice(i, 1);
            continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Cập nhật và vẽ chữ điểm bay (+5, +10, -15...)
    for (let i = gameFloatingTexts.length - 1; i >= 0; i--) {
        const ft = gameFloatingTexts[i];
        ft.y += ft.vy;
        ft.life -= 1;
        ft.alpha = Math.max(0, ft.life / 32);
        if (ft.life <= 0) {
            gameFloatingTexts.splice(i, 1);
            continue;
        }
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }

    ctx.restore();

    gameAnimationId = requestAnimationFrame(gameLoop);
}

function resetGameVars() {
    gameScore = 0;
    gameTimeLeft = 30;
    gameLives = 3;
    gameItems = [];
    gameParticles = [];
    gameFloatingTexts = [];
    spawnCountdown = 0;
    screenShake = 0;
    gameKeysDown['left'] = false;
    gameKeysDown['right'] = false;
    gamePlayer.x = (360 - gamePlayer.w) / 2;
    updateGameHud();
}

function startGameTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        if (!gameRunning) return;
        gameTimeLeft -= 1;
        updateGameHud();
        if (gameTimeLeft <= 0) {
            endGame('timeup');
        }
    }, 1000);
}

function startGame() {
    getGameAudioContext();
    resetGameVars();
    if (gameStartOverlay) gameStartOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    gameRunning = true;
    startGameTimer();
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
    gameAnimationId = requestAnimationFrame(gameLoop);
}

function stopGame() {
    gameRunning = false;
    if (gameAnimationId) {
        cancelAnimationFrame(gameAnimationId);
        gameAnimationId = null;
    }
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
}

function endGame(reason = 'timeup') {
    stopGame();
    playTone(reason === 'dead' ? 140 : 523, 0.3, 'triangle', 0.2);

    const prevHigh = Number(localStorage.getItem('catMap_game_highScore') || 0);
    const newHigh = Math.max(prevHigh, gameScore);
    localStorage.setItem('catMap_game_highScore', String(newHigh));

    if (gameFinalScore) {
        gameFinalScore.textContent = currentLang === 'en' ? `Score: ${gameScore} pts` : `Điểm: ${gameScore}đ`;
    }
    if (gameHighScore) {
        gameHighScore.textContent = currentLang === 'en' ? `🏆 High Score: ${newHigh} pts` : `🏆 Kỷ lục: ${newHigh}đ`;
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    const lastRewardDate = localStorage.getItem('catMap_game_reward_date');

    if (gameScore >= 50) {
        if (lastRewardDate !== todayStr) {
            if (isCloudConfigured && supabaseClient) {
                // Server cộng thưởng (tối đa 1 lần/ngày) rồi trả về ví mới.
                supabaseClient.rpc('claim_game_reward', { p_client_id: getWalletClientId() })
                    .then(({ data, error }) => {
                        if (error) {
                            console.warn('Không nhận được thưởng game:', error.message);
                            syncSenWalletToDatabase();
                        } else {
                            applyServerWallet(data);
                        }
                    });
            } else {
                const wallet = getSenWallet();
                wallet.pate = (wallet.pate || 0) + 1;
                saveSenWallet(wallet);
                updateWalletDisplay();
            }
            localStorage.setItem('catMap_game_reward_date', todayStr);

            if (gameOverIcon) gameOverIcon.textContent = '🎉';
            if (gameOverTitle) {
                gameOverTitle.textContent = reason === 'dead'
                    ? (currentLang === 'en' ? 'Out of lives but target reached!' : 'Hết tim nhưng vẫn đủ chỉ tiêu!')
                    : (currentLang === 'en' ? 'Outstanding Victory!' : 'Chiến thắng xuất sắc!');
            }
            if (gameRewardText) {
                gameRewardText.innerHTML = currentLang === 'en'
                    ? '🎁 Reward: <b>+1 pate can 🐟</b> transferred to your Bag!'
                    : '🎁 Thưởng: <b>+1 lon pate 🐟</b> đã được chuyển vào Túi Sen!';
            }
            showAppStatus(t('toast_game_win_reward', { score: gameScore }));
        } else {
            if (gameOverIcon) gameOverIcon.textContent = '⭐';
            if (gameOverTitle) {
                gameOverTitle.textContent = currentLang === 'en' ? 'Pate Catching Master!' : 'Cao thủ hứng pate!';
            }
            if (gameRewardText) {
                gameRewardText.innerHTML = currentLang === 'en'
                    ? "✨ You already received today's pate reward. Come back tomorrow!"
                    : '✨ Bạn đã nhận phần thưởng pate của hôm nay rồi. Hãy quay lại vào ngày mai nhé!';
            }
        }
    } else {
        if (gameOverIcon) gameOverIcon.textContent = reason === 'dead' ? '😿' : '🐱';
        if (gameOverTitle) {
            gameOverTitle.textContent = reason === 'dead'
                ? (currentLang === 'en' ? 'The cat got hit by spicy bombs!' : 'Bé mèo bị trúng bom cay!')
                : (currentLang === 'en' ? 'Time is up!' : 'Hết giờ rồi!');
        }
        if (gameRewardText) {
            gameRewardText.innerHTML = currentLang === 'en'
                ? 'Keep trying Hooman! Reach <b>50 pts</b> to win 1 pate can!'
                : 'Cố lên Sen ơi! Cần đạt <b>50đ</b> để nhận 1 lon pate vào Ví nhé!';
        }
    }

    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
}

function openGameModal() {
    stopGame();
    resetGameVars();
    if (gameStartOverlay) gameStartOverlay.style.display = 'flex';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    if (gameModal) gameModal.classList.add('active');
    drawInitialGameCanvas();
}

function closeGameModal() {
    stopGame();
    if (gameModal) gameModal.classList.remove('active');
}

function handleGamePointer(clientX) {
    if (!gameCanvas) return;
    const rect = gameCanvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const scaleX = gameCanvas.width / rect.width;
    const targetX = (clientX - rect.left) * scaleX - gamePlayer.w / 2;
    gamePlayer.x = Math.max(0, Math.min(gameCanvas.width - gamePlayer.w, targetX));
}

const gameCanvasWrapEl = document.getElementById('gameCanvasWrap');
if (gameCanvasWrapEl) {
    gameCanvasWrapEl.addEventListener('mousemove', e => {
        if (!gameRunning) return;
        handleGamePointer(e.clientX);
    });

    gameCanvasWrapEl.addEventListener('touchstart', e => {
        if (!gameRunning) return;
        if (e.touches && e.touches[0]) {
            e.preventDefault();
            handleGamePointer(e.touches[0].clientX);
        }
    }, { passive: false });

    gameCanvasWrapEl.addEventListener('touchmove', e => {
        if (!gameRunning) return;
        if (e.touches && e.touches[0]) {
            e.preventDefault();
            handleGamePointer(e.touches[0].clientX);
        }
    }, { passive: false });
}

window.addEventListener('keydown', e => {
    if (!gameRunning) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gameKeysDown['left'] = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gameKeysDown['right'] = true;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gameKeysDown['left'] = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gameKeysDown['right'] = false;
    }
});

if (gamePillBtn) gamePillBtn.onclick = openGameModal;
if (walletPlayGameBtn) walletPlayGameBtn.onclick = () => {
    closeSenWalletModal();
    openGameModal();
};
if (closeGameModalBtn) closeGameModalBtn.onclick = closeGameModal;
if (gameModal) gameModal.addEventListener('click', event => {
    if (event.target === gameModal) closeGameModal();
});
if (startGameBtn) startGameBtn.onclick = startGame;
if (playAgainBtn) playAgainBtn.onclick = startGame;
if (gameDoneBtn) gameDoneBtn.onclick = closeGameModal;
if (langToggleBtn) {
    langToggleBtn.onclick = () => {
        applyLanguage(currentLang === 'vi' ? 'en' : 'vi');
    };
}

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'inline-flex';
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'none';
    }
    showAppStatus(t('toast_app_installed'));
});

if (pwaInstallBtn) {
    pwaInstallBtn.onclick = async () => {
        if (!deferredInstallPrompt) {
            showAppStatus(t('toast_install_hint'));
            return;
        }
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            pwaInstallBtn.style.display = 'none';
        }
        deferredInstallPrompt = null;
    };
}

if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Đăng ký Service Worker thất bại:', err);
        });
    });
}
backupMenuToggle.onclick = () => {
    if (!canManageBackups()) return;
    const expanded = backupActions.classList.toggle('expanded');
    backupMenuToggle.setAttribute('aria-expanded', String(expanded));
    backupMenuToggle.setAttribute('aria-label', expanded ? t('aria_backup_close') : t('aria_backup_open'));
};
document.addEventListener('click', event => {
    if (!backupActions.contains(event.target)) {
        backupActions.classList.remove('expanded');
        backupMenuToggle.setAttribute('aria-expanded', 'false');
        backupMenuToggle.setAttribute('aria-label', t('aria_backup_open'));
    }
});
document.getElementById('closeModalBtn').onclick = resetAndCloseModal;

[imageZoom, imagePanX, imagePanY, imageFilter].forEach(control => {
    control.addEventListener('input', renderImagePreview);
    control.addEventListener('change', renderImagePreview);
});
document.getElementById('rotateLeftBtn').onclick = () => {
    imageRotation = (imageRotation + 270) % 360;
    renderImagePreview();
};
document.getElementById('rotateRightBtn').onclick = () => {
    imageRotation = (imageRotation + 90) % 360;
    renderImagePreview();
};
document.getElementById('flipHorizontalBtn').onclick = () => {
    imageFlipX = !imageFlipX;
    renderImagePreview();
};
document.getElementById('flipVerticalBtn').onclick = () => {
    imageFlipY = !imageFlipY;
    renderImagePreview();
};
document.getElementById('resetImageEditBtn').onclick = resetImageEditor;

const catPhotoStrip = document.getElementById('catPhotoStrip');
const MAX_CAT_PHOTOS = 8;
let modalCatPhotos = [];
let activeModalPhotoIndex = -1;
let isActiveModalPhotoDirty = false;

function markActiveModalPhotoDirty() {
    if (activeModalPhotoIndex >= 0 && modalCatPhotos[activeModalPhotoIndex]) {
        isActiveModalPhotoDirty = true;
    }
}

['imageZoom', 'imagePanX', 'imagePanY', 'imageFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', markActiveModalPhotoDirty);
});
['rotateLeftBtn', 'rotateRightBtn', 'flipHorizontalBtn', 'flipVerticalBtn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', markActiveModalPhotoDirty);
});

function commitActiveModalPhotoEdit() {
    if (activeModalPhotoIndex < 0 || !modalCatPhotos[activeModalPhotoIndex]) return;
    if (!sourceImage) return;
    const current = modalCatPhotos[activeModalPhotoIndex];
    if (isActiveModalPhotoDirty || current.value.startsWith('data:')) {
        try {
            const exported = photoPreviewCanvas.toDataURL('image/jpeg', 0.82);
            current.value = exported;
            current.url = exported;
            isActiveModalPhotoDirty = false;
        } catch (error) {
            console.warn('Không thể xuất lại ảnh đang chọn:', error);
        }
    }
}

function renderCatPhotoStrip() {
    if (!catPhotoStrip) return;
    catPhotoStrip.innerHTML = '';
    if (!modalCatPhotos.length) {
        catPhotoStrip.hidden = true;
        return;
    }
    catPhotoStrip.hidden = false;
    modalCatPhotos.forEach((item, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'cat-photo-thumb' + (idx === activeModalPhotoIndex ? ' active' : '');
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = `${currentLang === 'en' ? 'Photo' : 'Ảnh'} ${idx + 1}`;
        thumb.appendChild(img);

        if (idx === 0) {
            const cover = document.createElement('span');
            cover.className = 'cat-photo-thumb-cover';
            cover.textContent = currentLang === 'en' ? 'Cover' : 'Bìa';
            thumb.appendChild(cover);
        }

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cat-photo-thumb-remove';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', currentLang === 'en' ? 'Remove photo' : 'Xóa ảnh này');
        removeBtn.addEventListener('click', async e => {
            e.stopPropagation();
            modalCatPhotos.splice(idx, 1);
            if (!modalCatPhotos.length) {
                activeModalPhotoIndex = -1;
                sourceImage = null;
                previewContainer.style.display = 'none';
                renderCatPhotoStrip();
                return;
            }
            const nextIdx = Math.min(idx, modalCatPhotos.length - 1);
            await selectModalPhoto(nextIdx, false);
        });
        thumb.appendChild(removeBtn);

        thumb.addEventListener('click', () => selectModalPhoto(idx, true));
        catPhotoStrip.appendChild(thumb);
    });
    if (modalCatPhotos.length < MAX_CAT_PHOTOS && catPhotoGallery) {
        const addTile = document.createElement('button');
        addTile.type = 'button';
        addTile.className = 'cat-photo-thumb';
        addTile.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:var(--primary);border-style:dashed;background:#fff8fa;';
        addTile.textContent = '+';
        addTile.title = currentLang === 'en' ? 'Add more photos' : 'Thêm ảnh';
        addTile.setAttribute('aria-label', addTile.title);
        addTile.addEventListener('click', () => catPhotoGallery.click());
        catPhotoStrip.appendChild(addTile);
    }
}

async function selectModalPhoto(idx, commitCurrent = true) {
    if (commitCurrent) commitActiveModalPhotoEdit();
    if (idx < 0 || idx >= modalCatPhotos.length) return;
    activeModalPhotoIndex = idx;
    isActiveModalPhotoDirty = false;
    renderCatPhotoStrip();
    try {
        const loadedImage = await loadImageForEditing(modalCatPhotos[idx].value);
        sourceImage = loadedImage;
        resetImageEditor();
        previewContainer.style.display = 'block';
    } catch (error) {
        console.warn('Không thể tải ảnh vào trình chỉnh sửa:', error);
        sourceImage = null;
        previewContainer.style.display = 'none';
    }
}

function readFileToCompressedDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            const image = new Image();
            image.onload = () => {
                const maxW = 900;
                const maxH = 675;
                const scale = Math.min(1, maxW / image.width, maxH / image.height);
                const w = Math.max(1, Math.round(image.width * scale));
                const h = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(image, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            image.onerror = () => reject(new Error(currentLang === 'vi' ? 'Không thể mở ảnh đã chọn.' : 'Could not open selected image.'));
            image.src = event.target.result;
        };
        reader.onerror = () => reject(new Error(currentLang === 'vi' ? 'Không thể đọc ảnh đã chọn.' : 'Could not read selected image.'));
        reader.readAsDataURL(file);
    });
}

async function handleCatPhotosSelected(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    commitActiveModalPhotoEdit();
    const remaining = MAX_CAT_PHOTOS - modalCatPhotos.length;
    if (remaining <= 0) {
        showToast(currentLang === 'vi' ? `Mỗi bé tối đa ${MAX_CAT_PHOTOS} ảnh thôi nhé! 📸` : `Maximum ${MAX_CAT_PHOTOS} photos per cat! 📸`, 'warning');
        return;
    }
    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
        showToast(currentLang === 'vi' ? `Chỉ thêm được ${remaining} ảnh nữa (tối đa ${MAX_CAT_PHOTOS} ảnh).` : `Added ${remaining} photos (max ${MAX_CAT_PHOTOS}).`, 'info');
    }
    for (const file of toProcess) {
        try {
            const dataUrl = await readFileToCompressedDataUrl(file);
            modalCatPhotos.push({ value: dataUrl, url: dataUrl });
        } catch (err) {
            showAppStatus(err.message);
        }
    }
    if (modalCatPhotos.length) {
        await selectModalPhoto(modalCatPhotos.length - 1, false);
    }
}

if (catPhotoCamera) catPhotoCamera.onchange = (e) => { handleCatPhotosSelected(e.target.files); e.target.value = ''; };
if (catPhotoGallery) catPhotoGallery.onchange = (e) => { handleCatPhotosSelected(e.target.files); e.target.value = ''; };
if (photoInput && photoInput !== catPhotoGallery) photoInput.onchange = (e) => { handleCatPhotosSelected(e.target.files); e.target.value = ''; };

collaborationMigrateImagesButton.onclick = async () => {
    try {
        await migrateLegacyCloudImages();
    } catch (error) {
        console.error('Không thể di chuyển ảnh cũ sang Storage:', error);
        showAppStatus(t('err_migrate_images', { message: error.message }));
    }
};

exportBackupButton.onclick = () => {
    if (!canManageBackups() || !storageReady) return;
    try {
        const backup = {
            format: 'cat-map-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            cats: cats.map(cat => ({
                ...cat,
                image: serializeCatImages(getCatImageUrls(cat.image))
            }))
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `so-tay-bat-meo-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        clearAppStatus();
    } catch (error) {
        console.error('Không thể tạo bản sao lưu:', error);
        showAppStatus(t('err_create_backup', { message: error.message }));
    }
};

importBackupButton.onclick = () => {
    if (!canManageBackups() || !storageReady) return;
    backupFileInput.click();
};
backupFileInput.onchange = async () => {
    const file = backupFileInput.files[0];
    if (!file) return;
    if (!canManageBackups() || !storageReady) {
        backupFileInput.value = '';
        return;
    }
    const importingUserId = currentUser.id;
    try {
        const backup = JSON.parse(await file.text());
        if (!canManageBackups() || currentUser.id !== importingUserId) {
            throw new Error(t('err_account_changed_restore'));
        }
        let backupCats;
        if (Array.isArray(backup)) {
            backupCats = backup;
        } else if (backup && typeof backup === 'object' && Array.isArray(backup.cats)) {
            if (backup.format && backup.format !== 'cat-map-backup') {
                throw new Error(t('err_backup_other_app'));
            }
            if (backup.version !== undefined && backup.version !== 1) {
                throw new Error(t('err_backup_version', { version: backup.version }));
            }
            backupCats = backup.cats;
        } else {
            throw new Error(t('err_backup_no_cats'));
        }
        const importedCats = validateCats(backupCats).map(cat => ({ ...cat, id: createCatId() }));
        await persistCats(cats.concat(importedCats));
        showAppStatus(t('msg_restore_done', { count: importedCats.length }));
        clearTimeout(window.appStatusTimer);
        window.appStatusTimer = setTimeout(clearAppStatus, 7000);
    } catch (error) {
        console.error('Không thể khôi phục bản sao lưu:', error);
        showAppStatus(t('err_restore_failed', { message: error.message }));
    } finally {
        backupFileInput.value = '';
    }
};

saveButton.onclick = async () => {
    const name = document.getElementById('catName').value.trim().slice(0, 40) || t('unnamed_cat');
    const note = document.getElementById('catNote').value.trim() || t('default_cat_note');
    const isEditing = Boolean(editingCatId);
    saveButton.disabled = true;
    saveButton.innerText = isEditing ? t('btn_saving') : t('btn_getting_location');
    await new Promise(resolve => requestAnimationFrame(resolve));
    const editingCat = isEditing ? cats.find(cat => cat.id === editingCatId) : null;
    try {
        commitActiveModalPhotoEdit();
        currentImageDataUrl = serializeCatImages(modalCatPhotos.map(p => p.value)) || '';
    } catch (error) {
        if (editingCat?.image && sourceImage) {
            // Không xuất lại được ảnh cũ: giữ nguyên ảnh cũ, vẫn lưu tên/ghi chú.
            console.warn('Không xuất lại được ảnh cũ, giữ nguyên ảnh đã lưu:', error);
            currentImageDataUrl = editingCat.image;
        } else {
            console.error('Không thể xuất ảnh đã chỉnh sửa:', error);
            showAppStatus(currentLang === 'vi' ? 'Không thể xử lý ảnh này. Vui lòng chọn ảnh khác.' : 'Could not process this image. Please choose another.');
            saveButton.disabled = false;
            saveButton.innerText = isEditing ? t('btn_save_changes') :
                isCloudConfigured ? t('btn_add_to_map') : t('btn_save_location');
            return;
        }
    }
    let locationLookupWarning = '';
    try {
        if (editingCatId) {
            const editedId = editingCatId;
            const lat = Number(editLatitude.value);
            const lng = Number(editLongitude.value);
            if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
                throw new Error(t('err_invalid_coords'));
            }
            saveButton.innerText = t('btn_syncing');
            let locationName = document.getElementById('catLocationName').value.trim();
            if (!locationName) {
                try {
                    locationName = await lookupLocationName(lat, lng);
                } catch (error) {
                    console.warn('Không thể tra cứu tên vị trí từ OpenStreetMap:', error);
                    locationLookupWarning = t('warn_geocode_failed');
                }
            }
            const updatedCats = cats.map(cat => cat.id === editingCatId
                ? {
                    ...cat,
                    lat,
                    lng,
                    name,
                    location_name: locationName,
                    note,
                    image: currentImageDataUrl || null
                }
                : cat);
            await persistCats(updatedCats);
            resetAndCloseModal();
            const editedCat = cats.find(cat => cat.id === editedId);
            if (editedCat) {
                const group = markerGroups.get(`${editedCat.lat},${editedCat.lng}`);
                if (group) openCatGroupPopup(group);
            }
        } else {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    error => reject({ geolocationError: error }),
                    { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
                );
            });
            saveButton.innerText = t('btn_syncing');
            locationLookupWarning = await saveCatAt(
                position.coords.latitude,
                position.coords.longitude,
                name,
                note,
                false,
                currentImageDataUrl,
                document.getElementById('catLocationName').value.trim()
            );
        }
        if (locationLookupWarning) showAppStatus(locationLookupWarning);
        else if (!isCloudConfigured || isEditing) clearAppStatus();
    } catch (error) {
        if (!editingCatId && error?.geolocationError) {
            const locationError = error.geolocationError;
            const reason = locationError.code === locationError.PERMISSION_DENIED
                ? t('err_geo_denied')
                : locationError.code === locationError.POSITION_UNAVAILABLE
                    ? t('err_geo_unavailable')
                    : t('err_geo_timeout');
            if (confirm(t('confirm_use_map_center', { reason }))) {
                const center = map.getCenter();
                try {
                    locationLookupWarning = await saveCatAt(
                        center.lat,
                        center.lng,
                        name,
                        note,
                        true,
                        currentImageDataUrl,
                        document.getElementById('catLocationName').value.trim()
                    );
                    if (locationLookupWarning) showAppStatus(locationLookupWarning);
                } catch (saveError) {
                    console.error('Không thể lưu vị trí mèo:', saveError);
                    showAppStatus(t('err_save_location', { message: saveError.message }));
                }
            }
        } else {
            console.error('Không thể lưu thông tin mèo:', error);
            showAppStatus(t('err_save_info', { message: error.message }));
        }
    } finally {
        saveButton.disabled = false;
        saveButton.innerText = editingCatId ? t('btn_save_changes') :
            isCloudConfigured ? t('btn_add_to_map') : t('btn_save_location');
    }
};

function resetAndCloseModal() {
    modal.classList.remove('active');
    if (catPhotoCamera) catPhotoCamera.value = "";
    if (catPhotoGallery) catPhotoGallery.value = "";
    if (photoInput) photoInput.value = "";
    document.getElementById('catName').value = "";
    document.getElementById('catLocationName').value = "";
    document.getElementById('catNote').value = "";
    previewContainer.style.display = "none";
    modalCatPhotos = [];
    activeModalPhotoIndex = -1;
    isActiveModalPhotoDirty = false;
    renderCatPhotoStrip();
    editingCatId = null;
    editModalSeq++;
    modalTitle.textContent = t('add_modal_title');
    saveButton.innerText = isCloudConfigured ? t('btn_add_to_map') : (currentLang === 'en' ? 'Save Location' : 'Lưu vị trí');
    editLocationFields.classList.remove('active');
    sourceImage = null;
    currentImageDataUrl = "";
    resetImageEditor();
    saveButton.disabled = false;
}

initializeStorage().then(() => {
    applyLanguage(currentLang);
    saveButton.disabled = false;
    openModalButton.disabled = !storageReady || Boolean(pendingMapCat) || (isCloudConfigured && !supabaseClient);
    updateBackupControls();
    checkDailyStreak();
    updateWalletDisplay();
    updateSosBadge();

    // App để mở qua nửa đêm (thường gặp với PWA): điểm danh khi người dùng quay lại.
    let lastStreakCheckDate = new Date().toLocaleDateString('en-CA');
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const todayStr = new Date().toLocaleDateString('en-CA');
        if (todayStr === lastStreakCheckDate) return;
        lastStreakCheckDate = todayStr;
        checkDailyStreak();
        updateDailyFortuneBadge();
    });
}).catch(error => {
    console.error('Không thể khởi tạo kho dữ liệu:', error);
    showAppStatus(t('err_storage_init', { message: error.message }));
});

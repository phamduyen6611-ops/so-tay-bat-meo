/* ========================================================
   Song ngữ Tiếng Việt 🇻🇳 / English 🇬🇧 (I18N)
   ======================================================== */
let currentLang = 'vi';
try {
    currentLang = localStorage.getItem('catMap_lang') || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'vi');
} catch (e) {}

const map = L.map('map', { zoomControl: false }).setView([21.0285, 105.8542], 15);
const mapStatus = document.getElementById('mapStatus');
const appStatus = document.getElementById('appStatus');
const storageKey = 'catMapMarkers';
const supabaseUrl = 'https://sxeslpgevuzabvetfijl.supabase.co';
const supabaseAnonKey = 'sb_publishable_6zZxDufl8qJ_C1Yk3-1PmQ_a2HzU-M8';
const isCloudConfigured = supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('YOUR_') && Boolean(supabaseAnonKey) && !supabaseAnonKey.includes('YOUR_');
const supabaseClient = isCloudConfigured && window.supabase
    ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    : null;
let tileErrors = 0;

const tileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=' + currentLang + '&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps'
});
tileLayer.on('loading', () => {
    tileErrors = 0;
});
tileLayer.on('tileerror', () => {
    tileErrors += 1;
    if (tileErrors === 5 && !tileLayer._hasFallenBack) {
        tileLayer._hasFallenBack = true;
        console.warn('Google Maps tile error, falling back to Esri');
        tileLayer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}');
    }
});
tileLayer.on('load', () => {
    if (tileErrors > 5) {
        mapStatus.textContent = currentLang === 'vi'
            ? 'Không tải được một số mảnh bản đồ. Hãy kiểm tra kết nối Internet.'
            : 'Could not load some map tiles. Please check your Internet connection.';
        mapStatus.style.display = 'block';
    } else {
        mapStatus.style.display = 'none';
    }
});
tileLayer.addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const catMarkerLayer = typeof L.markerClusterGroup === 'function'
    ? L.markerClusterGroup({
        maxClusterRadius: 48,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 17,
        iconCreateFunction: cluster => {
            const childMarkers = cluster.getAllChildMarkers();
            let totalCats = 0;
            let hasSos = false;
            childMarkers.forEach(m => {
                const groupCats = m._catGroup?.cats;
                if (Array.isArray(groupCats) && groupCats.length) {
                    totalCats += groupCats.length;
                    if (groupCats.some(c => c.is_sos)) hasSos = true;
                } else {
                    totalCats += 1;
                }
            });
            const size = totalCats >= 50 ? 50 : totalCats >= 10 ? 44 : 38;
            const label = `${hasSos ? '🚨' : '🐾'}${totalCats}`;
            return L.divIcon({
                html: `<div class="cat-cluster-badge${hasSos ? ' has-sos' : ''}">${label}</div>`,
                className: 'cat-cluster-icon',
                iconSize: L.point(size, size)
            });
        }
    }).addTo(map)
    : null;
map.on('popupopen', () => {
    document.body.classList.add('popup-active');
    backupActions.classList.add('popup-active');
});
map.on('popupclose', event => {
    document.body.classList.remove('popup-active');
    backupActions.classList.remove('popup-active');
    stopObservingCatLocations(event.popup.getContent());
    if (activeCatPopup === event.popup) {
        activeCatPopup = null;
        activePopupCats = null;
    }
});

const catIcon = L.divIcon({
    html: '<div class="cat-marker">🐱</div>',
    className: 'custom-cat-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

function isTopIdolCat(catId) {
    if (!cats || !cats.length) return false;
    let topCat = null;
    let maxScore = 0;
    for (const c of cats) {
        const s = (Number(c.pate_count) || 0) * 10 + (Number(c.fed_count) || 0);
        if (s > maxScore) {
            maxScore = s;
            topCat = c;
        }
    }
    return Boolean(topCat && maxScore > 0 && topCat.id === catId);
}

function createCatIcon(cat) {
    const container = document.createElement('div');
    container.className = 'cat-marker-wrap';

    if (cat.image) {
        const image = document.createElement('img');
        image.className = 'cat-marker-photo';
        image.src = getCatImageUrl(cat.image);
        image.alt = t('alt_cat_photo', { name: cat.name || t('alt_unnamed') });
        container.appendChild(image);
    } else {
        const emoji = document.createElement('div');
        emoji.className = 'cat-marker';
        emoji.textContent = '🐱';
        container.appendChild(emoji);
    }

    if (cat.is_sos) {
        const sosBadge = document.createElement('span');
        sosBadge.className = 'marker-sos-badge';
        sosBadge.textContent = '🚨';
        container.appendChild(sosBadge);
    } else if (isTopIdolCat(cat.id)) {
        const crownBadge = document.createElement('span');
        crownBadge.className = 'marker-crown-badge';
        crownBadge.textContent = '👑';
        container.appendChild(crownBadge);
    }

    const isPhoto = Boolean(cat.image);
    return L.divIcon({
        html: container,
        className: 'custom-cat-icon' + (cat.is_sos ? ' sos-pulse' : ''),
        iconSize: isPhoto ? [64, 64] : [40, 40],
        iconAnchor: isPhoto ? [32, 64] : [20, 40],
        popupAnchor: isPhoto ? [0, -64] : [0, -40]
    });
}

const modal = document.getElementById('addCatModal');
const catPhotoCamera = document.getElementById('catPhotoCamera');
const catPhotoGallery = document.getElementById('catPhotoGallery');
const photoInput = catPhotoGallery || document.getElementById('catPhoto');
const photoPreviewCanvas = document.getElementById('photoPreviewCanvas');
const imageZoom = document.getElementById('imageZoom');
const imagePanX = document.getElementById('imagePanX');
const imagePanY = document.getElementById('imagePanY');
const imageFilter = document.getElementById('imageFilter');
const previewContainer = document.getElementById('previewContainer');
const saveButton = document.getElementById('saveCatBtn');
const modalTitle = document.getElementById('modalTitle');
const editLocationFields = document.getElementById('editLocationFields');
const editLatitude = document.getElementById('editLatitude');
const editLongitude = document.getElementById('editLongitude');
const openModalButton = document.getElementById('openModalBtn');
const exportBackupButton = document.getElementById('exportBackupBtn');
const importBackupButton = document.getElementById('importBackupBtn');
const backupFileInput = document.getElementById('backupFileInput');
const chooseMapLocationButton = document.getElementById('chooseMapLocationBtn');
const mapSelectionPrompt = document.getElementById('mapSelectionPrompt');
const backupActions = document.querySelector('.backup-actions');
const backupMenuToggle = document.getElementById('backupMenuToggle');
const catListPanel = document.getElementById('catListPanel');
const catListToggle = document.getElementById('catListToggle');
const catSearchInput = document.getElementById('catSearchInput');
const catSearchResults = document.getElementById('catSearchResults');
const catStatusFilter = document.getElementById('catStatusFilter');
const catDistanceFilter = document.getElementById('catDistanceFilter');
const catLocationButton = document.getElementById('catLocationBtn');
const catClearFiltersButton = document.getElementById('catClearFiltersBtn');
const catLocationNote = document.getElementById('catLocationNote');
const catFilterSummary = document.getElementById('catFilterSummary');
const catAllTab = document.getElementById('catAllTab');
const catFavoritesTab = document.getElementById('catFavoritesTab');
const catFavoritesNote = document.getElementById('catFavoritesNote');
const catListFilters = document.getElementById('catListFilters');
const catFiltersSummary = document.getElementById('catFiltersSummary');
catListFilters.open = window.innerWidth > 600;
const favoriteCatsStorageKey = 'catMapFavoritesV1';
const favoriteMigrationOwnerKey = 'catMapFavoritesMigrationOwnerV1';
let legacyFavoriteMigrationOwner = null;
let favoriteCatIds = new Set();
let favoriteAccountId = null;
let favoriteRequestVersion = 0;
let favoriteLoading = false;
let favoriteSaving = false;
let favoriteSyncError = '';
let favoritesOnly = false;
let catFilterLocation = null;
let catLocationMarker = null;
let catLocationLoading = false;
let catLocationError = '';
const collaborationPanel = document.getElementById('collaborationPanel');
const collaborationToggle = document.getElementById('collaborationToggle');
const collaborationContent = document.getElementById('collaborationContent');
const collaborationMessage = document.getElementById('collaborationMessage');
const collaborationEmail = document.getElementById('collaborationEmail');
const collaborationPassword = document.getElementById('collaborationPassword');
const collaborationNewPassword = document.getElementById('collaborationNewPassword');
const collaborationSignInButton = document.getElementById('collaborationSignInBtn');
const collaborationCreateAccountButton = document.getElementById('collaborationCreateAccountBtn');
const collaborationSignUpButton = document.getElementById('collaborationSignUpBtn');
const collaborationResetPasswordButton = document.getElementById('collaborationResetPasswordBtn');
const collaborationSetPasswordButton = document.getElementById('collaborationSetPasswordBtn');
const moderationQueueToggle = document.getElementById('moderationQueueToggle');
const moderationQueue = document.getElementById('moderationQueue');
const collaborationMigrateImagesButton = document.getElementById('collaborationMigrateImagesBtn');
const collaborationMigrateLocalButton = document.getElementById('collaborationMigrateLocalBtn');
const collaborationSignOutButton = document.getElementById('collaborationSignOutBtn');
const collaborationDisplayNameButton = document.getElementById('collaborationDisplayNameBtn');
const imageViewer = document.getElementById('imageViewer');
const imageViewerImage = document.getElementById('imageViewerImage');
const imageViewerClose = document.getElementById('imageViewerClose');
const fortunePillButton = document.getElementById('fortunePillBtn');
const fortunePillBadge = document.getElementById('fortunePillBadge');
const fortuneModal = document.getElementById('fortuneModal');
const fortuneDate = document.getElementById('fortuneDate');
const fortuneCatImg = document.getElementById('fortuneCatImg');
const fortuneCatEmoji = document.getElementById('fortuneCatEmoji');
const fortuneCatName = document.getElementById('fortuneCatName');
const fortuneCatLoc = document.getElementById('fortuneCatLoc');
const fortuneTitle = document.getElementById('fortuneTitle');
const fortuneMessage = document.getElementById('fortuneMessage');
const fortuneGoToCatBtn = document.getElementById('fortuneGoToCatBtn');
const fortuneRedrawBtn = document.getElementById('fortuneRedrawBtn');
const closeFortuneModalBtn = document.getElementById('closeFortuneModalBtn');
let currentFortuneCat = null;
const senWalletBtn = document.getElementById('senWalletBtn');
const streakCountText = document.getElementById('streakCountText');
const pateCountText = document.getElementById('pateCountText');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const senWalletModal = document.getElementById('senWalletModal');
const walletStreakValue = document.getElementById('walletStreakValue');
const walletPateValue = document.getElementById('walletPateValue');
const walletTotalGivenValue = document.getElementById('walletTotalGivenValue');
const senRankCard = document.getElementById('senRankCard');
const senRankIcon = document.getElementById('senRankIcon');
const senRankTitle = document.getElementById('senRankTitle');
const senRankDesc = document.getElementById('senRankDesc');
const senRankProgressFill = document.getElementById('senRankProgressFill');
const senRankProgressText = document.getElementById('senRankProgressText');
const senRankProgressPercent = document.getElementById('senRankProgressPercent');
const streakDaysRow = document.getElementById('streakDaysRow');
const closeSenWalletModalBtn = document.getElementById('closeSenWalletModalBtn');
const SEN_WALLET_KEY = 'catMap_sen_wallet_v2';
const SEN_CLIENT_ID_KEY = 'catMap_sen_client_id_v2';
let deferredInstallPrompt = null;
const leaderboardPillBtn = document.getElementById('leaderboardPillBtn');
const leaderboardModal = document.getElementById('leaderboardModal');
const tabIdolBtn = document.getElementById('tabIdolBtn');
const tabSosBtn = document.getElementById('tabSosBtn');
const sosBadgeCount = document.getElementById('sosBadgeCount');
const panelIdol = document.getElementById('panelIdol');
const panelSos = document.getElementById('panelSos');
const idolList = document.getElementById('idolList');
const sosList = document.getElementById('sosList');
const closeLeaderboardModalBtn = document.getElementById('closeLeaderboardModalBtn');

const sightingModal = document.getElementById('sightingModal');
const sightingModalTitle = document.getElementById('sightingModalTitle');
const sightingModalDesc = document.getElementById('sightingModalDesc');
const sightingPhotoCamera = document.getElementById('sightingPhotoCamera');
const sightingPhotoInput = document.getElementById('sightingPhotoInput');
const sightingPhotoPreviewWrap = document.getElementById('sightingPhotoPreviewWrap');
const sightingPhotoPreview = document.getElementById('sightingPhotoPreview');
const sightingRemovePhotoBtn = document.getElementById('sightingRemovePhotoBtn');
const sightingDateInput = document.getElementById('sightingDateInput');
const sightingNoteInput = document.getElementById('sightingNoteInput');
const sightingReporterInput = document.getElementById('sightingReporterInput');
const sightingSubmitBtn = document.getElementById('sightingSubmitBtn');
const sightingCancelBtn = document.getElementById('sightingCancelBtn');
let currentSightingCatId = null;
let currentSightingImageDataUrl = '';
let sightingPhotoSeq = 0;

const timelineModal = document.getElementById('timelineModal');
const timelineModalTitle = document.getElementById('timelineModalTitle');
const timelineModalSubtitle = document.getElementById('timelineModalSubtitle');
const timelineTotalCount = document.getElementById('timelineTotalCount');
const timelineAddNowBtn = document.getElementById('timelineAddNowBtn');
const timelineBody = document.getElementById('timelineBody');
const timelineCloseBtn = document.getElementById('timelineCloseBtn');
let currentTimelineCatId = null;

const langToggleBtn = document.getElementById('langToggleBtn');
const langToggleText = document.getElementById('langToggleText');
const qrPillBtn = document.getElementById('qrPillBtn');
const qrModal = document.getElementById('qrModal');
const closeQrModalBtn = document.getElementById('closeQrModalBtn');
const copyAppUrlBtn = document.getElementById('copyAppUrlBtn');

const gamePillBtn = document.getElementById('gamePillBtn');
const walletPlayGameBtn = document.getElementById('walletPlayGameBtn');
const gameModal = document.getElementById('gameModal');
const closeGameModalBtn = document.getElementById('closeGameModalBtn');
const gameCanvas = document.getElementById('gameCanvas');
const gameScoreText = document.getElementById('gameScoreText');
const gameTimerText = document.getElementById('gameTimerText');
const gameLivesText = document.getElementById('gameLivesText');
const gameStartOverlay = document.getElementById('gameStartOverlay');
const startGameBtn = document.getElementById('startGameBtn');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverIcon = document.getElementById('gameOverIcon');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameFinalScore = document.getElementById('gameFinalScore');
const gameHighScore = document.getElementById('gameHighScore');
const gameRewardText = document.getElementById('gameRewardText');
const playAgainBtn = document.getElementById('playAgainBtn');
const gameDoneBtn = document.getElementById('gameDoneBtn');

/* ========================================================
   Từ điển Song ngữ (I18N Dictionary)
   ======================================================== */
const I18N = {
    vi: {
        app_title: "Sổ Tay Bắt Mèo 🐾",
        cat_list_btn: "🐾 Danh sách mèo",
        cat_all: "Tất cả",
        cat_fav: "♥ Yêu thích",
        search_placeholder: "Tìm tên, ghi chú, vị trí",
        filter_summary: "Bộ lọc",
        filter_status: "Tình trạng",
        filter_distance: "Khoảng cách",
        filter_all: "Tất cả",
        status_seen: "Vẫn thấy",
        status_sos: "🚨 Cần hỗ trợ (SOS)",
        status_hungry: "🥣 Chưa ăn hôm nay",
        status_helped: "Đã được giúp đỡ",
        status_not_found: "Không còn ở đây",
        status_other: "Khác",
        status_unknown: "Chưa cập nhật",
        dist_500m: "Trong 500 m",
        dist_1km: "Trong 1 km",
        dist_3km: "Trong 3 km",
        dist_5km: "Trong 5 km",
        dist_10km: "Trong 10 km",
        btn_use_location: "Dùng vị trí của tôi",
        btn_clear_filters: "Xóa bộ lọc",
        location_note: "Dùng vị trí của bạn để tìm mèo gần nhất.",
        fav_login_note: "Đăng nhập để lưu và đồng bộ yêu thích theo tài khoản.",
        guide_link: "Hướng dẫn ↗",
        privacy_link: "Quyền riêng tư ↗",
        contact_link: "Liên hệ / báo nội dung ↗",
        pill_fortune: "Quẻ Mèo",
        pill_leaderboard: "Bảng Vàng",
        pill_game: "Hứng Pate",
        pill_phone: "📱 Xem trên ĐT",
        pill_install: "📲 Cài App",
        fab_spot_cat: "🐾 Thấy Mèo!",
        // Fortune modal
        fortune_badge: "✨ Quẻ Mèo May Mắn ✨",
        fortune_redraw: "🎲 Bốc quẻ khác",
        fortune_goto: "🐾 Ghé thăm bé trên bản đồ",
        // Wallet modal
        wallet_badge: "🎒 Túi Đồ Của Sen 🐾",
        wallet_title: "Chuỗi Tuần Tra & Quà Tặng",
        wallet_desc: "Điểm danh mỗi ngày, tích lũy pate để thăng cấp danh hiệu!",
        rank_current: "Danh hiệu hiện tại",
        rank_progress_next: "Tiến trình lên Cấp {level}",
        rank_max: "Đã đạt cấp tối đa! 👑",
        stat_streak: "🔥 Chuỗi ngày",
        stat_pate: "🐟 Pate có sẵn",
        stat_given: "💖 Đã tặng mèo",
        streak_title: "Tiến trình nhận quà 7 ngày (Mỗi ngày +1 🐟, ngày 7 +3 🎁)",
        wallet_guide: "• <strong>Mỗi ngày vào app:</strong> Tự động nhận ngay 1 lon pate ảo 🐟 để giữ chuỗi.<br>• <strong>Tặng pate cho mèo:</strong> Bấm vào bất kỳ bé mèo nào trên bản đồ và nhấn <em>\"🐟 Tặng 1 lon pate\"</em> để tiếp tế yêu thương!<br>• <strong>Cài App:</strong> Thêm Sổ Tay Bắt Mèo vào màn hình chính để mở app chỉ với 1 chạm.",
        btn_play_game: "🎮 Chơi game Hứng Pate kiếm thưởng",
        btn_close: "Đóng",
        btn_cancel: "Hủy",
        // Leaderboard modal
        leaderboard_badge: "🏆 Bảng Vàng & Radar SOS 🐾",
        tab_idol: "👑 Mèo Idol",
        idol_subtitle: "Top các bé mèo được yêu thích và nhận nhiều pate nhất bản đồ 💖",
        sos_subtitle: "Danh sách mèo đang cần hỗ trợ y tế, thức ăn hoặc trạm cứu hộ 🚨",
        // Mini game
        game_badge: "🎮 Mini-Game 🐾",
        game_title: "Hứng Pate Cho Mèo 🐟🥫",
        game_subtitle: "Kéo bé mèo qua lại hứng cá và pate, né bom cay!",
        game_ready_title: "Sẵn sàng chưa Sen?",
        game_ready_desc: "🐟 Cá: <b>+5đ</b> • 🥫 Pate: <b>+10đ</b> • 🥣 Hạt: <b>+15đ</b><br>💣 Bom: <b>-1 tim & -15đ</b> • Đạt <b>50đ</b> nhận ngay <b>1 lon pate</b>!",
        btn_play_now: "▶ Chơi Ngay!",
        btn_play_again: "🔄 Chơi lại",
        btn_done: "Xong",
        game_tip: "👆 <em>Kéo ngón tay trên màn hình hoặc rê chuột để di chuyển bé mèo</em>",
        // Add/Edit modal
        add_modal_title: "Bắt được một bé! 🐾",
        edit_modal_title: "Chỉnh sửa thông tin mèo 🐾",
        btn_camera: "📸 Chụp ảnh ngay",
        btn_gallery: "🖼️ Chọn nhiều ảnh",
        ph_name: "Tên bé mèo (ví dụ: Mimi)",
        ph_location_name: "Tên vị trí nếu muốn tự đặt",
        ph_note: "Mèo tam thể, đang ngủ gật...",
        btn_add_to_map: "Thêm lên bản đồ",
        btn_save_changes: "Lưu thay đổi",
        // Sighting modal
        sighting_modal_title: "📸 Gặp lại bé mèo!",
        sighting_modal_title_cat: "📸 Gặp lại {name}!",
        sighting_modal_desc: "Ghi lại khoảnh khắc hôm nay bạn gặp lại bé để lưu vào hành trình lớn lên theo từng tháng.",
        sighting_modal_desc_cat: "Lưu lại khoảnh khắc hôm nay bạn gặp lại {name}. Ảnh sẽ được thêm vào dòng thời gian lớn lên theo từng tháng! 🐾",
        sighting_photo_label: "Ảnh chụp hôm nay (rất nên có! 📸):",
        sighting_date_label: "Ngày gặp lại:",
        sighting_note_label: "Ghi chú khoảnh khắc:",
        sighting_ph_note: "VD: Bé mập hơn nhiều, đang ngủ ngoan trên ghế đá, rất quấn người...",
        sighting_reporter_label: "Tên của bạn (Sen):",
        sighting_ph_reporter: "Tên hoặc biệt danh của bạn",
        btn_sighting_submit: "Lưu kỷ niệm gặp lại 🐾",
        btn_remove_photo: "✕ Bỏ ảnh này",
        // Timeline modal
        timeline_modal_title: "📅 Hành trình lớn lên 🐾",
        timeline_modal_title_cat: "📅 Hành trình lớn lên: {name} 🐾",
        timeline_modal_subtitle: "Dòng thời gian các lần gặp gỡ của bé mèo",
        timeline_modal_subtitle_cat: "Dòng thời gian ảnh và các lần gặp gỡ {name}",
        timeline_loading: "Đang tải hành trình của bé... 🐾",
        timeline_total_encounters: "Tổng cộng: {count} lần gặp 🐾",
        timeline_first_encounter: "🌱 Lần đầu gặp · {month}",
        timeline_encounter_item: "🐾 {month}",
        timeline_old_memory: "Kỷ niệm xưa",
        timeline_recorded_by: "Ghi nhận bởi: {name}",
        timeline_initial_note: "Bé được phát hiện và lưu lên bản đồ lần đầu tiên 🐾",
        timeline_first_discoverer: "Người phát hiện ban đầu",
        timeline_spotting_hooman: "Một Sen ghi dấu",
        timeline_kind_hooman: "Một Sen tốt bụng",
        btn_timeline_add: "📸 Hôm nay lại gặp",
        // QR modal
        qr_title: "📱 Mở trên điện thoại",
        qr_desc: "Mở camera điện thoại (iPhone hoặc Android) quét mã QR bên dưới để xem ngay:",
        qr_tip: "💡 <b>Mẹo:</b> Khi mở trên điện thoại, bấm vào biểu tượng <b>Chia sẻ / Menu ⋯</b> rồi chọn <b>\"Thêm vào Màn hình chính\"</b> để dùng như một ứng dụng độc lập nhé!",
        btn_copy_link: "📋 Sao chép Link",
        btn_copied: "✅ Đã chép link!",
        // Units
        unit_days: "ngày",
        unit_cans: "lon",
        // Ranks
        rank_1_title: "Sen Tập Sự",
        rank_1_desc: "Mới vào nghề, thấy bé mèo nào cũng muốn lại gần làm quen.",
        rank_2_title: "Sen Chu Đáo",
        rank_2_desc: "Đã quen mặt các bé mèo trong xóm, luôn có sẵn đồ ăn mang theo.",
        rank_3_title: "Sen Cần Mẫn",
        rank_3_desc: "Tuần tra chăm chỉ mỗi ngày, mèo từ xa nghe tiếng bước chân là ra đón.",
        rank_4_title: "Đại Gia Pate",
        rank_4_desc: "Đại gia hào phóng tiếp tế no ấm, mèo cả khu phố đều nhận mặt Sen!",
        rank_5_title: "Bảo Mẫu Hoàng Gia",
        rank_5_desc: "Danh xưng tối thượng! Mèo cả thành phố đồng lòng tôn làm Hoàng Thượng Phụ!",
        // Popup & Actions
        popup_feeding_title: "Nhật ký bữa ăn hôm nay:",
        popup_fed_today: "✅ Đã được cho ăn hôm nay! 🐟",
        popup_fed_none: "🥣 Hôm nay chưa ghi nhận ai cho ăn",
        btn_feed_more: "🥣 Mình vừa cho bé ăn thêm!",
        btn_feed_now: "🥣 Mình vừa cho bé ăn!",
        popup_pate_count: "💖 {count} lon pate đã nhận",
        btn_give_pate: "🐟 Tặng 1 lon pate",
        popup_sightings_count: "🐾 Đã gặp bé: <b>{count} lần</b>",
        btn_meet_again: "📸 Hôm nay lại gặp bé!",
        btn_view_timeline: "📅 Xem hành trình ảnh",
        popup_sos_alert: "🚨 BÉ ĐANG CẦN HỖ TRỢ KHẨN CẤP",
        btn_resolve_sos: "✅ Đánh dấu bé đã an toàn / Đã được cứu",
        btn_report_sos: "🚨 Báo bé này cần hỗ trợ khẩn cấp (SOS)",
        btn_directions: "↗ Chỉ đường",
        btn_report_info: "Báo thông tin sai",
        unnamed_cat: "Mèo chưa đặt tên",
        default_cat_note: "Một bé mèo cute ẩn danh 🐾",
        btn_edit: "Sửa",
        btn_delete: "Xóa",
        login_to_update_status: "Đăng nhập để cập nhật tình trạng.",
        // Toasts & Alerts
        toast_welcome_new_sen: "🎒 Chào mừng Sen mới! Bạn được tặng 3 lon pate yêu thương 🐟",
        toast_streak_milestone: "🌟 Xuất sắc! Chuỗi {streak} ngày tuần tra! Thưởng lớn +{bonus} lon pate 🐟",
        toast_daily_checkin: "🎉 Điểm danh ngày mới! Bạn nhận được +{bonus} lon pate 🐟 (Chuỗi {streak} ngày 🔥)",
        toast_rank_up: "🎉 CHÚC MỪNG BẠN ĐÃ THĂNG CẤP: {icon} {title}! 🐾👑",
        toast_pate_empty: "😿 Bạn đã hết pate rồi! Hãy quay lại điểm danh vào ngày mai để nhận thêm nhé 🐟",
        toast_pate_given: "🐟 Bạn vừa tặng 1 lon pate cho {name}! Cảm ơn tấm lòng của Sen ❤️ (Còn {remain} lon)",
        toast_sos_on: "🚨 Đã bật cảnh báo cứu trợ SOS cho {name}!",
        err_feed_too_soon: "Bé vừa được cho ăn cách đây chưa tới 10 phút. Bạn quay lại sau chút nữa nhé 🥣",
        err_sos_resolve_login: "Bạn cần đăng nhập để xác nhận bé đã an toàn.",
        err_sos_too_soon: "Cảnh báo SOS của bé vừa được cập nhật. Bạn đợi 1 phút rồi thử lại nhé.",
        err_cat_not_found: "Không tìm thấy bé mèo này, có thể bé đã bị xóa khỏi bản đồ.",
        toast_sos_off: "✅ Đã đánh dấu {name} đã an toàn!",
        toast_feed_thanks: "🥣 Cảm ơn Sen {feeder} đã tiếp tế cho {name}! 🐾🐟",
        toast_sighting_saved: "🎉 Đã lưu kỷ niệm gặp lại! Bạn và cộng đồng đã gặp {name} {count} lần 🐾📸",
        toast_game_win_reward: "🎮 Tuyệt vời! Bạn ghi được {score}đ và nhận ngay 1 lon pate vào Ví Sen 🐟",
        toast_status_updated: "Đã cập nhật tình trạng: {status}.",
        // Collaboration / Account
        collab_local_saving: "☁️ Đang lưu trên thiết bị",
        collab_not_configured: "☁️ Chưa cấu hình",
        collab_conn_failed: "☁️ Không kết nối được",
        collab_admin_access: "☁️ Admin toàn quyền",
        collab_syncing: "☁️ Đang đồng bộ",
        collab_login_to_add: "☁️ Đăng nhập để thêm mèo",
        collab_connecting: "☁️ Đang kết nối dữ liệu chung…",
        collab_msg_local: "Ứng dụng đang lưu dữ liệu trên thiết bị này.",
        collab_msg_supabase_err: "Không tải được thư viện Supabase. Kiểm tra kết nối Internet rồi tải lại trang.",
        collab_msg_guest: "Đăng nhập hoặc tạo tài khoản để thêm mèo và quản lý mèo do bạn tạo. Mèo mới sẽ hiện ngay trên bản đồ.",
        collab_msg_admin: "Đã đăng nhập admin: {email}.",
        collab_msg_user: "Đã đăng nhập: {email}. Bạn có thể thêm mèo và sửa/xóa mèo do mình tạo.",
        collab_msg_logged_out: "Tài khoản {email} chưa đăng nhập.",
        collab_msg_fav_prompt: "Đăng nhập để lưu yêu thích và đồng bộ giữa các thiết bị.",
        collab_msg_add_cat_prompt: "Bạn cần đăng nhập để thêm mèo. Nếu chưa có tài khoản, hãy chọn Tạo tài khoản bên dưới.",
        collab_msg_signup_mode: "Nhập email và mật khẩu mới để tạo tài khoản.",
        collab_msg_signin_mode: "Nhập email và mật khẩu để đăng nhập.",
        collab_msg_signup_success_verify: "Đã tạo tài khoản. Hãy kiểm tra email để xác nhận, sau đó đăng nhập.",
        collab_msg_signup_success: "Đã tạo tài khoản và đăng nhập. Bạn có thể thêm mèo lên bản đồ.",
        collab_msg_reset_sent: "Nếu email này có tài khoản, sẽ có thư đặt lại mật khẩu. Hãy kiểm tra hộp thư đến và thư rác.",
        collab_msg_password_set: "Đã đặt mật khẩu. Bạn có thể sử dụng tài khoản được mời.",
        ph_email: "Email",
        ph_password: "Mật khẩu",
        ph_password_new: "Mật khẩu mới (ít nhất 8 ký tự)",
        ph_new_password_invite: "Mật khẩu mới khi nhận lời mời",
        btn_signin: "Đăng nhập",
        btn_create_account: "Tạo tài khoản",
        btn_switch_signup: "Chưa có tài khoản? Tạo tài khoản",
        btn_switch_signin: "Đã có tài khoản? Đăng nhập",
        btn_forgot_password: "Quên mật khẩu?",
        btn_set_password: "Đặt mật khẩu",
        btn_pending_reviews: "Bài cũ chờ duyệt ({count})",
        btn_migrate_images: "Chuyển ảnh cũ lên Storage",
        btn_migrate_local: "Đưa {count} mèo trên thiết bị lên dữ liệu chung",
        btn_signout: "Đăng xuất",
        // Install App Dialog
        btn_install_shortcut: "＋ Thêm vào màn hình chính",
        install_help_title: "Thêm vào màn hình chính",
        install_help_intro: "Mở nhanh Sổ Tay Bắt Mèo từ biểu tượng trên thiết bị của bạn.",
        install_help_browser_note: "Nếu đang mở trong Zalo hoặc Facebook, hãy chọn mở liên kết bằng trình duyệt trước.",
        install_help_url_label: "Liên kết ứng dụng",
        btn_got_it: "Đã hiểu",
        map_selection_prompt: "Chạm vào bản đồ để đặt vị trí mèo",
        // Dynamic messages (JS)
        alt_cat_photo: "Ảnh mèo {name}",
        alt_unnamed: "chưa đặt tên",
        alt_unnamed_cat: "mèo chưa đặt tên",
        alt_submission_photo: "Ảnh đề xuất: {name}",
        alt_cat: "Mèo",
        alt_sos_cat: "Mèo SOS",
        err_fav_sync: "Không thể đồng bộ yêu thích. Bấm mục Yêu thích để thử lại.",
        err_fav_save: "Chưa lưu được yêu thích. Bấm mục Yêu thích để thử đồng bộ lại.",
        err_idb_open: "Không thể mở IndexedDB.",
        err_idb_blocked: "IndexedDB đang bị chặn bởi một tab khác.",
        err_idb_read: "Không thể đọc IndexedDB.",
        err_idb_read_aborted: "Đọc IndexedDB đã bị hủy.",
        err_idb_write: "Không thể ghi IndexedDB.",
        err_idb_write_aborted: "Ghi IndexedDB đã bị hủy.",
        err_backup_not_list: "File sao lưu phải chứa danh sách mèo.",
        err_invalid_cat_data: "Dữ liệu mèo không hợp lệ; không có dữ liệu nào được nhập.",
        err_login_before_upload: "Hãy đăng nhập trước khi tải ảnh lên.",
        err_read_upload_image: "Không thể đọc ảnh cần tải lên ({status}).",
        err_unsupported_image: "Định dạng ảnh chưa được hỗ trợ; hãy chọn ảnh JPEG, PNG hoặc WebP.",
        err_admin_only_migrate: "Chỉ admin mới có thể di chuyển ảnh cũ.",
        msg_no_legacy_images: "Không còn ảnh dạng cũ trong dữ liệu mèo chung.",
        confirm_migrate_images: "Chuyển {total} ảnh cũ (gồm ảnh trên bản đồ và hàng chờ cũ) sang Supabase Storage? Ảnh chỉ được thay bằng đường dẫn sau khi tải lên thành công.",
        err_no_permission_cat_image: "Không đủ quyền cập nhật ảnh của mèo {name}.",
        err_no_permission_submission_image: "Không đủ quyền cập nhật ảnh bài chờ duyệt {name}.",
        msg_migrate_progress: "Đã chuyển {migrated}/{total} ảnh lên Storage…",
        msg_migrate_done: "Đã chuyển {count} ảnh sang Supabase Storage.",
        err_reload_latest: "Không tải lại được danh sách mới nhất: {message}",
        err_migrate_partial: "Đã chuyển {migrated}/{total} ảnh; ảnh còn lại vẫn được giữ nguyên. ",
        aria_backup_open: "Mở menu sao lưu",
        aria_backup_close: "Đóng menu sao lưu",
        moderation_empty: "Chưa có mèo nào chờ duyệt.",
        btn_approve: "Duyệt",
        btn_reject: "Từ chối",
        err_admin_only_moderate: "Chỉ admin mới được duyệt bài gửi.",
        msg_submission_approved: "Đã duyệt mèo và đưa lên bản đồ chung.",
        msg_submission_rejected: "Đã từ chối bài gửi.",
        confirm_reject_submission: "Từ chối và xóa bài gửi mèo này?",
        err_process_submission: "Không thể xử lý bài gửi: {message}",
        err_read_local_for_migration: "Không thể đọc dữ liệu mèo trên thiết bị để di chuyển: {message}",
        err_load_pending: "Không thể tải danh sách chờ duyệt: {message}",
        err_realtime_disconnected: "Kết nối đồng bộ trực tiếp bị gián đoạn. Hãy tải lại trang nếu dữ liệu chưa cập nhật.",
        label_location_prefix: "Vị trí: ",
        err_geocode_retry_later: "Chưa thể tra cứu lại tên địa điểm.",
        err_geocode_http: "OpenStreetMap trả về lỗi {status}.",
        err_geocode_not_found: "Không tìm thấy tên vị trí cho tọa độ này.",
        list_empty_fav_login: "Đăng nhập tài khoản để xem danh sách yêu thích của bạn.",
        list_empty_fav_loading: "Đang tải danh sách yêu thích…",
        list_empty_fav_error: "Chưa tải được yêu thích. Bấm mục Yêu thích để thử lại.",
        list_empty_fav_none: "Chưa có mèo yêu thích. Bấm ♡ Yêu thích ở một bé mèo để thêm vào danh sách.",
        list_empty_gps_wait: "Đang chờ vị trí GPS…",
        list_empty_need_location: "Bấm “Dùng vị trí của tôi” hoặc chọn “Tất cả” trong Khoảng cách để xem mèo.",
        list_empty_no_match: "Không tìm thấy bé mèo phù hợp. Hãy thử mở rộng khoảng cách hoặc xóa bộ lọc.",
        list_empty_no_cats: "Chưa có mèo nào được lưu.",
        err_supabase_lib: "Không tải được thư viện Supabase.",
        err_storage_not_ready: "Kho dữ liệu chưa sẵn sàng.",
        err_login_to_manage: "Hãy đăng nhập để thêm hoặc quản lý mèo.",
        err_edit_own_only: "Bạn chỉ có thể sửa mèo do chính mình tạo.",
        err_delete_own_only: "Bạn chỉ có thể xóa mèo do chính mình tạo.",
        err_insert_failed: "Không thể thêm một hoặc nhiều bản ghi mèo.",
        err_no_permission_update: "Không đủ quyền cập nhật một hoặc nhiều bản ghi mèo.",
        err_no_permission_delete: "Không đủ quyền xóa một hoặc nhiều bản ghi mèo.",
        err_login_to_migrate: "Bạn cần đăng nhập để đưa mèo lên dữ liệu chung.",
        confirm_migrate_local: "Tải {count} mèo cùng ảnh và vị trí đang lưu trên thiết bị này lên bản đồ chung? Các bản gốc trên thiết bị sẽ được giữ nguyên.",
        msg_migrate_state_not_saved: "Đã tải dữ liệu lên. Không lưu được trạng thái di chuyển trên thiết bị này; đừng chạy di chuyển lần nữa để tránh bản trùng.",
        msg_migrate_local_done: "Đã đưa {count} mèo lên dữ liệu chung. Bản gốc trên thiết bị vẫn được giữ.",
        warn_geocode_failed: "Không tra cứu được tên vị trí qua OpenStreetMap; mèo vẫn được lưu bằng tọa độ.",
        msg_cat_added: "Đã thêm mèo lên bản đồ chung.",
        err_save_location: "Không thể lưu vị trí: {message}",
        err_open_saved_image: "Không thể mở ảnh đã lưu.",
        modal_edit_cat_title: "Sửa thông tin mèo",
        err_invalid_status: "Tình trạng mèo không hợp lệ.",
        err_status_note_required: "Nhập nội dung tình trạng khác, tối đa 200 ký tự.",
        err_cat_record_not_found: "Không tìm thấy bản ghi mèo.",
        err_login_to_update_status: "Hãy đăng nhập để cập nhật tình trạng mèo.",
        prompt_feeder_name: "Nhập tên của bạn để ghi nhận tiếp tế (hoặc để trống):",
        prompt_display_name: "Bạn muốn hiện tên gì khi ghi nhận cho ăn / gặp lại bé? (Tên này ai cũng thấy. Để trống sẽ hiện \"Một Sen tốt bụng\".)",
        btn_display_name_set: "✏️ Biệt danh: {name}",
        btn_display_name_empty: "✏️ Đặt biệt danh",
        toast_display_name_saved: "✅ Đã lưu biệt danh: {name}",
        err_display_name_save: "Không thể lưu biệt danh: {message}",
        btn_recording: "Đang ghi nhận...",
        err_record_feed: "Không thể ghi nhận: {message}",
        btn_feed_retry: "🥣 Thử lại",
        btn_giving: "Đang tặng...",
        err_give_pate: "Không thể tặng: {message}",
        err_report_sos: "Không thể báo SOS: {message}",
        err_update: "Không thể cập nhật: {message}",
        err_update_status: "Không thể cập nhật tình trạng: {message}",
        err_update_data: "Không thể cập nhật dữ liệu: {message}",
        err_process_image: "Không thể xử lý ảnh: {message}",
        err_email_required: "Vui lòng nhập email.",
        err_email_invalid: "Vui lòng nhập email đúng định dạng.",
        err_migrate_local: "Không thể đưa dữ liệu lên: {message}",
        err_signout: "Không thể đăng xuất: {message}",
        err_verify_account: "Không thể xác nhận quyền tài khoản: {message}",
        err_location_denied: "Chưa được cấp quyền vị trí. Hãy cho phép truy cập vị trí trong trình duyệt hoặc chọn “Tất cả” trong Khoảng cách.",
        err_location_unavailable: "Không lấy được vị trí. Hãy thử lại hoặc chọn “Tất cả” trong Khoảng cách.",
        msg_distance_uses_previous: "Khoảng cách vẫn dùng vị trí đã lấy trước đó.",
        err_read_photo: "Không thể đọc ảnh này. Vui lòng thử ảnh khác!",
        prompt_copy_link: "Sao chép đường link bên dưới:",
        toast_app_installed: "🎉 Chúc mừng bạn đã cài đặt Sổ Tay Bắt Mèo lên màn hình chính!",
        toast_install_hint: "Để cài đặt, hãy chọn \"Thêm vào màn hình chính\" (Add to Home Screen) trong menu trình duyệt nhé!",
        err_migrate_images: "Không thể di chuyển ảnh: {message}",
        err_create_backup: "Không thể tạo bản sao lưu: {message}",
        err_account_changed_restore: "Tài khoản hoặc quyền admin đã thay đổi. Hãy đăng nhập lại để khôi phục.",
        err_backup_other_app: "File này có định dạng sao lưu của ứng dụng khác.",
        err_backup_version: "Phiên bản sao lưu {version} chưa được hỗ trợ.",
        err_backup_no_cats: "Không tìm thấy danh sách mèo trong file JSON.",
        msg_restore_done: "Đã khôi phục thêm {count} dấu mèo. Dữ liệu hiện có được giữ nguyên.",
        err_restore_failed: "Khôi phục thất bại: {message}",
        btn_saving: "Đang lưu...",
        btn_getting_location: "Đang lấy vị trí...",
        btn_save_location: "Lưu vị trí",
        err_invalid_coords: "Vĩ độ hoặc kinh độ không hợp lệ.",
        btn_syncing: "Đang đồng bộ...",
        err_geo_denied: "Bạn đã từ chối quyền truy cập vị trí.",
        err_geo_unavailable: "Thiết bị không xác định được vị trí.",
        err_geo_timeout: "Đã hết thời gian chờ GPS.",
        confirm_use_map_center: "{reason}\n\nBạn có muốn đặt dấu mèo tại tâm bản đồ hiện tại không? Đây chỉ là vị trí ước lượng, không phải vị trí GPS.",
        err_save_info: "Không thể lưu thông tin: {message}",
        err_storage_init: "Không thể mở kho dữ liệu trên trình duyệt: {message}"
    },
    en: {
        app_title: "Stray Cat Notebook 🐾",
        cat_list_btn: "🐾 Cat List",
        cat_all: "All",
        cat_fav: "♥ Favorites",
        search_placeholder: "Search name, notes, location",
        filter_summary: "Filters",
        filter_status: "Status",
        filter_distance: "Distance",
        filter_all: "All",
        status_seen: "Seen",
        status_sos: "🚨 Needs Help (SOS)",
        status_hungry: "🥣 Hungry today",
        status_helped: "Helped",
        status_not_found: "Not here anymore",
        status_other: "Other",
        status_unknown: "Unknown",
        dist_500m: "Within 500 m",
        dist_1km: "Within 1 km",
        dist_3km: "Within 3 km",
        dist_5km: "Within 5 km",
        dist_10km: "Within 10 km",
        btn_use_location: "Use my location",
        btn_clear_filters: "Clear filters",
        location_note: "Use your location to find the nearest cats.",
        fav_login_note: "Sign in to sync your favorites across devices.",
        guide_link: "Guide ↗",
        privacy_link: "Privacy ↗",
        contact_link: "Contact & Report ↗",
        pill_fortune: "Cat Fortune",
        pill_leaderboard: "Leaderboard",
        pill_game: "Catch Pate",
        pill_phone: "📱 On Phone",
        pill_install: "📲 Install App",
        fab_spot_cat: "🐾 Spotted a Cat!",
        // Fortune modal
        fortune_badge: "✨ Daily Cat Fortune ✨",
        fortune_redraw: "🎲 Draw another",
        fortune_goto: "🐾 Visit this cat on map",
        // Wallet modal
        wallet_badge: "🎒 Hooman's Bag 🐾",
        wallet_title: "Patrol Streak & Gifts",
        wallet_desc: "Check in daily, collect pate and level up your caregiver rank!",
        rank_current: "Current Rank",
        rank_progress_next: "Progress to Level {level}",
        rank_max: "Max rank reached! 👑",
        stat_streak: "🔥 Daily Streak",
        stat_pate: "🐟 Pate Cans",
        stat_given: "💖 Given to Cats",
        streak_title: "7-Day Reward Track (Daily +1 🐟, Day 7 +3 🎁)",
        wallet_guide: "• <strong>Daily check-in:</strong> Automatically receive 1 virtual pate 🐟 each day to keep your streak.<br>• <strong>Give pate to cats:</strong> Tap any cat on the map and hit <em>\"🐟 Give 1 pate\"</em> to send love!<br>• <strong>Install App:</strong> Add Stray Cat Notebook to your home screen for instant 1-tap access.",
        btn_play_game: "🎮 Play Catch Pate Mini-Game",
        btn_close: "Close",
        btn_cancel: "Cancel",
        // Leaderboard modal
        leaderboard_badge: "🏆 Leaderboard & SOS Radar 🐾",
        tab_idol: "👑 Idol Cats",
        idol_subtitle: "Most loved cats receiving the most pate on the map 💖",
        sos_subtitle: "Cats needing medical attention, food, or shelter rescue 🚨",
        // Mini game
        game_badge: "🎮 Mini-Game 🐾",
        game_title: "Catch Pate For Cats 🐟🥫",
        game_subtitle: "Drag the cat to catch fish & pate, avoid bombs!",
        game_ready_title: "Ready, Hooman?",
        game_ready_desc: "🐟 Fish: <b>+5pts</b> • 🥫 Pate: <b>+10pts</b> • 🥣 Bowl: <b>+15pts</b><br>💣 Bomb: <b>-1 life & -15pts</b> • Score <b>50pts</b> for <b>1 pate</b>!",
        btn_play_now: "▶ Play Now!",
        btn_play_again: "🔄 Play Again",
        btn_done: "Done",
        game_tip: "👆 <em>Drag finger on screen or move mouse to control the cat</em>",
        // Add/Edit modal
        add_modal_title: "Spotted a Cat! 🐾",
        edit_modal_title: "Edit Cat Details 🐾",
        btn_camera: "📸 Take Photo",
        btn_gallery: "🖼️ Choose Photos (Multi)",
        ph_name: "Cat name (e.g., Mimi, Whiskers)",
        ph_location_name: "Location name (optional)",
        ph_note: "Calico cat, taking a nap...",
        btn_add_to_map: "Add to Map",
        btn_save_changes: "Save Changes",
        // Sighting modal
        sighting_modal_title: "📸 Met this cat again!",
        sighting_modal_title_cat: "📸 Met {name} again!",
        sighting_modal_desc: "Record today's encounter to capture their monthly growth journey.",
        sighting_modal_desc_cat: "Save the moment you met {name} today. Photos will be added to the growing journey timeline! 🐾",
        sighting_photo_label: "Today's photo (highly recommended! 📸):",
        sighting_date_label: "Date encountered:",
        sighting_note_label: "Moment notes:",
        sighting_ph_note: "e.g., Looking chunkier, napping on the park bench, super cuddly...",
        sighting_reporter_label: "Your name (Hooman):",
        sighting_ph_reporter: "Your name or nickname",
        btn_sighting_submit: "Save Encounter 🐾",
        btn_remove_photo: "✕ Remove photo",
        // Timeline modal
        timeline_modal_title: "📅 Growth Journey 🐾",
        timeline_modal_title_cat: "📅 Growth Journey: {name} 🐾",
        timeline_modal_subtitle: "Timeline of encounters with this cat",
        timeline_modal_subtitle_cat: "Photo timeline and encounters with {name}",
        timeline_loading: "Loading kitty's journey... 🐾",
        timeline_total_encounters: "Total: {count} encounters 🐾",
        timeline_first_encounter: "🌱 First Encounter · {month}",
        timeline_encounter_item: "🐾 {month}",
        timeline_old_memory: "Old memory",
        timeline_recorded_by: "Recorded by: {name}",
        timeline_initial_note: "Cat first spotted and saved to the map 🐾",
        timeline_first_discoverer: "Original discoverer",
        timeline_spotting_hooman: "A spotting Hooman",
        timeline_kind_hooman: "A kind Hooman",
        btn_timeline_add: "📸 Met again today",
        // QR modal
        qr_title: "📱 Open on Mobile",
        qr_desc: "Scan this QR code with your phone camera (iPhone or Android) to open instantly:",
        qr_tip: "💡 <b>Tip:</b> On mobile, tap <b>Share / Menu ⋯</b> then choose <b>\"Add to Home Screen\"</b> to use as a standalone app!",
        btn_copy_link: "📋 Copy Link",
        btn_copied: "✅ Link copied!",
        // Units
        unit_days: "days",
        unit_cans: "cans",
        // Ranks
        rank_1_title: "Novice Hooman",
        rank_1_desc: "A beginner cat lover eager to befriend every furry neighbor.",
        rank_2_title: "Caring Hooman",
        rank_2_desc: "Familiar with local felines, always carrying snacks for visits.",
        rank_3_title: "Dedicated Hooman",
        rank_3_desc: "Patrols daily; cats hear footsteps and run out to greet you.",
        rank_4_title: "Pate Tycoon",
        rank_4_desc: "Generous food provider; meows erupt whenever you arrive.",
        rank_5_title: "Royal Caregiver",
        rank_5_desc: "Ultimate rank! Revered by cats and showered with royal blessings.",
        // Popup & Actions
        popup_feeding_title: "Today's Meal Log:",
        popup_fed_today: "✅ Fed today! 🐟",
        popup_fed_none: "🥣 No feedings recorded yet today",
        btn_feed_more: "🥣 Fed them again just now!",
        btn_feed_now: "🥣 I just fed this cat!",
        popup_pate_count: "💖 {count} pate cans received",
        btn_give_pate: "🐟 Give 1 pate",
        popup_sightings_count: "🐾 Encounters: <b>{count} times</b>",
        btn_meet_again: "📸 Met again today!",
        btn_view_timeline: "📅 View Journey",
        popup_sos_alert: "🚨 THIS CAT NEEDS URGENT HELP",
        btn_resolve_sos: "✅ Mark safe / Rescued",
        btn_report_sos: "🚨 Report urgent assistance needed (SOS)",
        btn_directions: "↗ Directions",
        btn_report_info: "Report wrong info",
        unnamed_cat: "Unnamed cat",
        default_cat_note: "A cute anonymous kitty 🐾",
        btn_edit: "Edit",
        btn_delete: "Delete",
        login_to_update_status: "Sign in to update status.",
        // Toasts & Alerts
        toast_welcome_new_sen: "🎒 Welcome new Hooman! You received 3 starter pate cans 🐟",
        toast_streak_milestone: "🌟 Awesome! {streak}-day patrol streak! Big reward +{bonus} pate cans 🐟",
        toast_daily_checkin: "🎉 Daily check-in! You received +{bonus} pate can 🐟 ({streak}-day streak 🔥)",
        toast_rank_up: "🎉 CONGRATULATIONS! YOU LEVELED UP: {icon} {title}! 🐾👑",
        toast_pate_empty: "😿 You're out of pate! Check in tomorrow to get more 🐟",
        toast_pate_given: "🐟 You gave 1 pate can to {name}! Thank you Hooman ❤️ ({remain} left)",
        toast_sos_on: "🚨 SOS rescue alert turned on for {name}!",
        err_feed_too_soon: "This cat was fed less than 10 minutes ago. Please check back a bit later 🥣",
        err_sos_resolve_login: "Please sign in to confirm this cat is safe.",
        err_sos_too_soon: "This cat's SOS alert was just updated. Please wait a minute and try again.",
        err_cat_not_found: "This cat could not be found. It may have been removed from the map.",
        toast_sos_off: "✅ {name} marked safe!",
        toast_feed_thanks: "🥣 Thank you {feeder} for feeding {name}! 🐾🐟",
        toast_sighting_saved: "🎉 Encounter saved! You and the community have met {name} {count} times 🐾📸",
        toast_game_win_reward: "🎮 Awesome! You scored {score}pts and earned 1 pate can into your Bag 🐟",
        toast_status_updated: "Status updated: {status}.",
        // Collaboration / Account
        collab_local_saving: "☁️ Stored on device",
        collab_not_configured: "☁️ Not configured",
        collab_conn_failed: "☁️ Connection failed",
        collab_admin_access: "☁️ Admin Access",
        collab_syncing: "☁️ Cloud Synced",
        collab_login_to_add: "☁️ Sign in to add cats",
        collab_connecting: "☁️ Connecting to cloud…",
        collab_msg_local: "App is currently storing data on this device only.",
        collab_msg_supabase_err: "Could not load Supabase library. Check Internet connection and reload.",
        collab_msg_guest: "Sign in or register to spot cats and manage your submissions. New cats appear on the public map.",
        collab_msg_admin: "Signed in as admin: {email}.",
        collab_msg_user: "Signed in: {email}. You can add cats and manage cats you created.",
        collab_msg_logged_out: "Account {email} is not signed in.",
        collab_msg_fav_prompt: "Sign in to save favorites and sync across devices.",
        collab_msg_add_cat_prompt: "You need to sign in to add cats. If you don't have an account, choose Create Account below.",
        collab_msg_signup_mode: "Enter email and a new password to create your account.",
        collab_msg_signin_mode: "Enter email and password to sign in.",
        collab_msg_signup_success_verify: "Account created! Please check your email to confirm, then sign in.",
        collab_msg_signup_success: "Account created and signed in! You can now add cats to the map.",
        collab_msg_reset_sent: "If this email is registered, a password reset link has been sent. Check your inbox and spam folder.",
        collab_msg_password_set: "Password set successfully! You can now use your invited account.",
        ph_email: "Email address",
        ph_password: "Password",
        ph_password_new: "New password (min 8 characters)",
        ph_new_password_invite: "New password for invited account",
        btn_signin: "Sign In",
        btn_create_account: "Create Account",
        btn_switch_signup: "Don't have an account? Sign Up",
        btn_switch_signin: "Already have an account? Sign In",
        btn_forgot_password: "Forgot password?",
        btn_set_password: "Set Password",
        btn_pending_reviews: "Pending review ({count})",
        btn_migrate_images: "Migrate legacy photos to Storage",
        btn_migrate_local: "Upload {count} local cats to cloud",
        btn_signout: "Sign Out",
        // Install App Dialog
        btn_install_shortcut: "＋ Add to Home Screen",
        install_help_title: "Add to Home Screen",
        install_help_intro: "Quickly open Stray Cat Notebook right from your device home screen.",
        install_help_browser_note: "If opened inside Zalo or Facebook, tap ⋯ and choose 'Open in Browser' first.",
        install_help_url_label: "Application Link",
        btn_got_it: "Got it",
        map_selection_prompt: "Tap on the map to place the cat marker",
        // Dynamic messages (JS)
        alt_cat_photo: "Photo of {name}",
        alt_unnamed: "unnamed cat",
        alt_unnamed_cat: "unnamed cat",
        alt_submission_photo: "Submitted photo: {name}",
        alt_cat: "Cat",
        alt_sos_cat: "SOS cat",
        err_fav_sync: "Couldn't sync your favorites. Tap Favorites to try again.",
        err_fav_save: "Your favorites weren't saved yet. Tap Favorites to sync again.",
        err_idb_open: "Couldn't open IndexedDB.",
        err_idb_blocked: "IndexedDB is blocked by another tab.",
        err_idb_read: "Couldn't read from IndexedDB.",
        err_idb_read_aborted: "Reading from IndexedDB was aborted.",
        err_idb_write: "Couldn't write to IndexedDB.",
        err_idb_write_aborted: "Writing to IndexedDB was aborted.",
        err_backup_not_list: "The backup file must contain a list of cats.",
        err_invalid_cat_data: "Invalid cat data; nothing was imported.",
        err_login_before_upload: "Please sign in before uploading photos.",
        err_read_upload_image: "Couldn't read the photo to upload ({status}).",
        err_unsupported_image: "This photo format isn't supported yet; please choose a JPEG, PNG or WebP photo.",
        err_admin_only_migrate: "Only admins can migrate legacy photos.",
        msg_no_legacy_images: "No legacy-format photos left in the shared cat data.",
        confirm_migrate_images: "Move {total} legacy photos (including map photos and the old review queue) to Supabase Storage? Each photo is only replaced with a link after it uploads successfully.",
        err_no_permission_cat_image: "You don't have permission to update the photo of cat {name}.",
        err_no_permission_submission_image: "You don't have permission to update the photo of pending submission {name}.",
        msg_migrate_progress: "Moved {migrated}/{total} photos to Storage…",
        msg_migrate_done: "Moved {count} photos to Supabase Storage.",
        err_reload_latest: "Couldn't reload the latest list: {message}",
        err_migrate_partial: "Moved {migrated}/{total} photos; the remaining photos were left unchanged. ",
        aria_backup_open: "Open backup menu",
        aria_backup_close: "Close backup menu",
        moderation_empty: "No cats waiting for review.",
        btn_approve: "Approve",
        btn_reject: "Reject",
        err_admin_only_moderate: "Only admins can review submissions.",
        msg_submission_approved: "Cat approved and added to the shared map.",
        msg_submission_rejected: "Submission rejected.",
        confirm_reject_submission: "Reject and delete this cat submission?",
        err_process_submission: "Couldn't process the submission: {message}",
        err_read_local_for_migration: "Couldn't read the cat data on this device for migration: {message}",
        err_load_pending: "Couldn't load the review queue: {message}",
        err_realtime_disconnected: "Live sync was interrupted. Reload the page if the data doesn't update.",
        label_location_prefix: "Location: ",
        err_geocode_retry_later: "Can't look up the place name again just yet.",
        err_geocode_http: "OpenStreetMap returned error {status}.",
        err_geocode_not_found: "No place name found for these coordinates.",
        list_empty_fav_login: "Sign in to see your favorite cats.",
        list_empty_fav_loading: "Loading your favorites…",
        list_empty_fav_error: "Couldn't load your favorites. Tap Favorites to try again.",
        list_empty_fav_none: "No favorite cats yet. Tap ♡ Favorite on a cat to add it to your list.",
        list_empty_gps_wait: "Waiting for GPS location…",
        list_empty_need_location: "Tap “Use my location” or choose “All” under Distance to see cats.",
        list_empty_no_match: "No matching cats found. Try a wider distance or clear the filters.",
        list_empty_no_cats: "No cats saved yet.",
        err_supabase_lib: "Couldn't load the Supabase library.",
        err_storage_not_ready: "Data storage isn't ready yet.",
        err_login_to_manage: "Please sign in to add or manage cats.",
        err_edit_own_only: "You can only edit cats you created.",
        err_delete_own_only: "You can only delete cats you created.",
        err_insert_failed: "Couldn't add one or more cat records.",
        err_no_permission_update: "You don't have permission to update one or more cat records.",
        err_no_permission_delete: "You don't have permission to delete one or more cat records.",
        err_login_to_migrate: "You need to sign in to upload cats to the shared data.",
        confirm_migrate_local: "Upload {count} cats, with the photos and locations saved on this device, to the shared map? The originals on this device will be kept.",
        msg_migrate_state_not_saved: "Data uploaded. Couldn't save the migration status on this device; don't run the migration again to avoid duplicates.",
        msg_migrate_local_done: "Uploaded {count} cats to the shared data. The originals on this device are kept.",
        warn_geocode_failed: "Couldn't look up the place name via OpenStreetMap; the cat is still saved with its coordinates.",
        msg_cat_added: "Cat added to the shared map.",
        err_save_location: "Couldn't save the location: {message}",
        err_open_saved_image: "Couldn't open the saved photo.",
        modal_edit_cat_title: "Edit cat details",
        err_invalid_status: "Invalid cat status.",
        err_status_note_required: "Describe the other status, up to 200 characters.",
        err_cat_record_not_found: "Cat record not found.",
        err_login_to_update_status: "Please sign in to update the cat's status.",
        prompt_feeder_name: "Enter your name to log this feeding (or leave blank):",
        prompt_display_name: "What name should show when you log a feeding or sighting? (Everyone can see it. Leave blank to show \"A kind Hooman\".)",
        btn_display_name_set: "✏️ Nickname: {name}",
        btn_display_name_empty: "✏️ Set nickname",
        toast_display_name_saved: "✅ Nickname saved: {name}",
        err_display_name_save: "Couldn't save nickname: {message}",
        btn_recording: "Logging...",
        err_record_feed: "Couldn't log the feeding: {message}",
        btn_feed_retry: "🥣 Try again",
        btn_giving: "Giving...",
        err_give_pate: "Couldn't give pate: {message}",
        err_report_sos: "Couldn't report SOS: {message}",
        err_update: "Couldn't update: {message}",
        err_update_status: "Couldn't update status: {message}",
        err_update_data: "Couldn't update data: {message}",
        err_process_image: "Couldn't process the photo: {message}",
        err_email_required: "Please enter your email.",
        err_email_invalid: "Please enter a valid email address.",
        err_migrate_local: "Couldn't upload the data: {message}",
        err_signout: "Couldn't sign out: {message}",
        err_verify_account: "Couldn't verify account permissions: {message}",
        err_location_denied: "Location permission not granted. Allow location access in your browser or choose “All” under Distance.",
        err_location_unavailable: "Couldn't get your location. Try again or choose “All” under Distance.",
        msg_distance_uses_previous: "Distances still use your previously detected location.",
        err_read_photo: "Couldn't read this photo. Please try another one!",
        prompt_copy_link: "Copy the link below:",
        toast_app_installed: "🎉 Yay! Stray Cat Notebook is now on your home screen, Hooman!",
        toast_install_hint: "To install, choose \"Add to Home Screen\" from your browser menu!",
        err_migrate_images: "Couldn't migrate photos: {message}",
        err_create_backup: "Couldn't create the backup: {message}",
        err_account_changed_restore: "Your account or admin permissions changed. Please sign in again to restore.",
        err_backup_other_app: "This file is a backup from a different app.",
        err_backup_version: "Backup version {version} isn't supported yet.",
        err_backup_no_cats: "No cat list found in the JSON file.",
        msg_restore_done: "Restored {count} more cat markers. Your existing data was kept.",
        err_restore_failed: "Restore failed: {message}",
        btn_saving: "Saving...",
        btn_getting_location: "Getting location...",
        btn_save_location: "Save Location",
        err_invalid_coords: "Invalid latitude or longitude.",
        btn_syncing: "Syncing...",
        err_geo_denied: "You denied location access.",
        err_geo_unavailable: "Your device couldn't determine its location.",
        err_geo_timeout: "GPS timed out.",
        confirm_use_map_center: "{reason}\n\nWould you like to place the cat marker at the current map center instead? This is only an approximate location, not a GPS position.",
        err_save_info: "Couldn't save the details: {message}",
        err_storage_init: "Couldn't open the browser data storage: {message}"
    }
};

const CAT_FORTUNES_EN = [
    { title: "Plump Belly Fortune", desc: "Wealth is flowing smoothly, just like a well-fed cat's soft and round belly after a feast!" },
    { title: "Effortlessly Cool", desc: "Peak chill vibes today! If anything bothers you, give a gentle meow and strut away." },
    { title: "Four-Legged Benefactor", desc: "Watch your step today — you might encounter a super adorable four-legged friend bringing good luck." },
    { title: "Deep Sleep & Feast", desc: "Daily forecast: Full energy! Take a long stretch and a big yawn before conquering the day." },
    { title: "Pamper Yourself", desc: "A great day to treat yourself! Enjoy a tasty meal just like giving a cat their favorite purée treat." },
    { title: "Super Cat Intuition", desc: "Your intuition is as sharp as a cat hearing a snack bag tear open in the middle of the night!" },
    { title: "Pink Paw Pad Blessings", desc: "Everything will be smooth, gentle, and comforting today like soft pink cat paw pads." },
    { title: "Royal Feline Philosophy", desc: "When facing a challenge, don't fret — take a power nap first. Things will work out wonderfully!" },
    { title: "Charming Sweetheart", desc: "Your charm is at max level today; everyone you meet will find you delightful and kind." },
    { title: "Sumptuous Feast", desc: "Top fortune: Good food fuels good vibes! Eat heartily and stay cozy like a content kitten." },
    { title: "Laser Leap", desc: "You're bound to make an impressive breakthrough today, as precise as a cat pouncing on a laser dot." },
    { title: "Sunbathing Peace", desc: "Peace of mind amidst the hustle. Relax and watch the clouds drift by like a cat basking in the window sun." },
    { title: "Blossoming Connection", desc: "Warm care is coming your way... from a dear friend or an affectionate cat bumping their head on your shoe!" },
    { title: "Noble Demeanor", desc: "Hold your head high with pride! You radiate elegance and royal feline poise today." },
    { title: "Alleyway Explorer", desc: "A lovely day to wander familiar corners — you'll uncover delightful little surprises." },
    { title: "Fearless Rooftop Climb", desc: "Brave like a cat on the rooftop! Any hurdles today will be cleared with effortless grace." },
    { title: "Purr Frequency", desc: "Your happiness frequency is peaking. Spread smiles and gentle warmth to everyone around you today." }
];

function t(key, params = {}) {
    const langDict = I18N[currentLang] || I18N['vi'];
    let text = langDict[key] || I18N['vi'][key] || key;
    if (params && typeof params === 'object') {
        for (const [k, v] of Object.entries(params)) {
            // Dùng hàm thay thế để ký tự `$` trong tên mèo/người không bị hiểu là mẫu thay thế.
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), () => String(v));
        }
    }
    return text;
}

function applyLanguage(newLang) {
    currentLang = newLang === 'en' ? 'en' : 'vi';
    try {
        localStorage.setItem('catMap_lang', currentLang);
    } catch (e) {}
    document.documentElement.lang = currentLang;

    if (langToggleText) {
        langToggleText.textContent = currentLang === 'vi' ? 'EN' : 'VI';
    }
    if (langToggleBtn) {
        langToggleBtn.title = currentLang === 'vi' ? 'Chuyển sang Tiếng Anh / Switch to English' : 'Chuyển sang Tiếng Việt / Switch to Vietnamese';
    }
    document.title = t('app_title');

    // Cập nhật text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (key) el.textContent = t(key);
    });

    // Cập nhật innerHTML
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.dataset.i18nHtml;
        if (key) el.innerHTML = t(key);
    });

    // Cập nhật placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (key) el.placeholder = t(key);
    });

    // Cập nhật các lựa chọn bộ lọc tình trạng
    if (catStatusFilter) {
        const curVal = catStatusFilter.value;
        catStatusFilter.options[0].textContent = t('filter_all');
        catStatusFilter.options[1].textContent = t('status_seen');
        catStatusFilter.options[2].textContent = t('status_sos');
        catStatusFilter.options[3].textContent = t('status_hungry');
        catStatusFilter.options[4].textContent = t('status_helped');
        catStatusFilter.options[5].textContent = t('status_not_found');
        catStatusFilter.options[6].textContent = t('status_other');
        catStatusFilter.options[7].textContent = t('status_unknown');
        catStatusFilter.value = curVal;
    }

    // Cập nhật bộ lọc khoảng cách
    if (catDistanceFilter) {
        const curVal = catDistanceFilter.value;
        catDistanceFilter.options[0].textContent = t('filter_all');
        catDistanceFilter.options[1].textContent = t('dist_500m');
        catDistanceFilter.options[2].textContent = t('dist_1km');
        catDistanceFilter.options[3].textContent = t('dist_3km');
        catDistanceFilter.options[4].textContent = t('dist_5km');
        catDistanceFilter.options[5].textContent = t('dist_10km');
        catDistanceFilter.value = curVal;
    }

    // Cập nhật các view động
    updateWalletDisplay();
    updateCollaborationControls();
    if (window.updateInstallLanguage) window.updateInstallLanguage();
    renderCatList();
    updateDailyFortuneBadge();
    updateSosBadge();

    // Nếu modal Bảng Vàng đang mở
    if (leaderboardModal && leaderboardModal.classList.contains('active')) {
        if (tabIdolBtn && tabIdolBtn.classList.contains('active')) renderIdolList();
        else renderSosList();
    }

    // Nếu modal Quẻ Mèo đang mở
    if (fortuneModal && fortuneModal.classList.contains('active')) {
        openFortuneModal(false);
    }

    // Nếu modal Dòng thời gian đang mở
    if (timelineModal && timelineModal.classList.contains('active') && currentTimelineCatId) {
        openTimelineModal(currentTimelineCatId);
    }

    // Nếu modal Check-in Gặp lại đang mở
    if (sightingModal && sightingModal.classList.contains('active') && currentSightingCatId) {
        const preservedNote = sightingNoteInput ? sightingNoteInput.value : '';
        const preservedReporter = sightingReporterInput ? sightingReporterInput.value : '';
        const preservedDate = sightingDateInput ? sightingDateInput.value : '';
        const preservedImage = currentSightingImageDataUrl;
        const wasSubmitting = sightingSubmitBtn.disabled;
        openSightingModal(currentSightingCatId);
        if (sightingNoteInput && preservedNote) sightingNoteInput.value = preservedNote;
        if (sightingReporterInput && preservedReporter) sightingReporterInput.value = preservedReporter;
        if (sightingDateInput && preservedDate) sightingDateInput.value = preservedDate;
        // Giữ ảnh đã chọn và trạng thái đang lưu khi đổi ngôn ngữ.
        if (preservedImage) {
            currentSightingImageDataUrl = preservedImage;
            sightingPhotoPreview.src = preservedImage;
            sightingPhotoPreviewWrap.style.display = 'block';
        }
        if (wasSubmitting) {
            sightingSubmitBtn.disabled = true;
            sightingSubmitBtn.textContent = currentLang === 'vi' ? 'Đang lưu kỷ niệm...' : 'Saving encounter...';
        }
    }

    // Nếu có popup mèo đang mở trên bản đồ, làm mới nội dung theo ngôn ngữ mới
    if (isCatMobileSheetOpen() && activePopupCats) {
        setMobileSheetContent(createCatPopupContent(activePopupCats));
    } else if (activeCatPopup && activePopupCats && activeCatPopup.isOpen && activeCatPopup.isOpen()) {
        activeCatPopup.setContent(createCatPopupContent(activePopupCats));
    }

    // Cập nhật nhãn ngôn ngữ cho bản đồ Google Maps
    if (tileLayer && tileLayer.setUrl && !tileLayer._hasFallenBack) {
        tileLayer.setUrl('https://mt{s}.google.com/vt/lyrs=m&hl=' + currentLang + '&x={x}&y={y}&z={z}');
    }
}

const CAT_FORTUNES = [
    { title: "Đại Cát Bụng Mỡ", desc: "Tài lộc hôm nay rủng rỉnh như chiếc bụng mỡ của mèo sau bữa tiệc pate thượng hạng!" },
    { title: "Ung Dung Tự Tại", desc: "Thần thái đỉnh cao! Ai làm bạn phiền lòng thì cứ meo một tiếng rồi lơ đẹp nhé." },
    { title: "Quý Nhân Bốn Chân", desc: "Hôm nay ra đường nhớ nhìn trước ngó sau, rất có thể bạn sẽ va phải một 'quý nhân bốn chân' cực kỳ dễ thương." },
    { title: "Ngủ Kỹ No Say", desc: "Dự báo ngày mới: Năng lượng dồi dào, hãy vươn vai thật dài và ngáp một cái thật sảng khoái trước khi bắt đầu." },
    { title: "Yêu Chiều Bản Thân", desc: "Một ngày tuyệt vời để tự thưởng! Đừng quên đãi mình một món ngon như thưởng cho mèo một thanh súp thưởng." },
    { title: "Trực Giác Siêu Phàm", desc: "Trực giác hôm nay nhạy bén như tai mèo nghe thấy tiếng xé gói đồ ăn vặt lúc nửa đêm!" },
    { title: "Điềm Lành Đệm Thịt", desc: "Mọi việc hôm nay đều sẽ êm ái, nhẹ nhàng và mềm mại như đệm thịt hồng hào của chân mèo." },
    { title: "Triết Lý Hoàng Thượng", desc: "Gặp chuyện khó khăn đừng quạu, cứ ngủ một giấc rồi dậy tính tiếp. Mọi chuyện rồi sẽ êm xuôi!" },
    { title: "Sát Thủ Đáng Yêu", desc: "Hôm nay sự dễ thương của bạn đạt điểm tối đa, làm gì cũng được mọi người yêu quý và nhường nhịn." },
    { title: "Bữa Tiệc Thịnh Soạn", desc: "Quẻ Thượng Thượng Cát: Có thực mới vực được đạo, hãy ăn uống no say và ấm bụng như một chú mèo ngoan!" },
    { title: "Bước Nhảy Vồ Mồi", desc: "Hôm nay bạn sẽ có một bước tiến bứt phá đầy ấn tượng, chuẩn xác như mèo tung người vồ trúng tia laser." },
    { title: "Tắm Nắng Bình Yên", desc: "Tâm bất biến giữa dòng đời vạn biến, ung dung ngắm mây trôi như mèo nằm sưởi nắng bên khung cửa sổ." },
    { title: "Tình Duyên Chớm Nở", desc: "Hôm nay bạn sẽ nhận được sự quan tâm ấm áp bất ngờ... có thể là từ một người bạn hoặc một chú mèo lạ dụi đầu vào chân!" },
    { title: "Khí Chất Quý Tộc", desc: "Tự tin ngẩng cao đầu! Khí chất hôm nay sang chảnh, thần thái như một chú mèo hoàng gia." },
    { title: "Khám Phá Góc Phố", desc: "Ngày đẹp trời để dạo quanh góc phố quen thuộc, bạn sẽ phát hiện ra nhiều điều bí mật thú vị." },
    { title: "Vượt Lưới An Toàn", desc: "Dũng cảm như một chú mèo leo nóc nhà! Mọi thử thách hôm nay bạn đều sẽ vượt qua nhẹ tênh." },
    { title: "Sóng Âm Gừ Gừ", desc: "Tần số hạnh phúc đang ở mức cao nhất. Hôm nay hãy lan tỏa tiếng cười và sự dịu dàng tới mọi người xung quanh." }
];

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function formatRelativeTime(date) {
    if (!date || isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const locale = currentLang === 'vi' ? 'vi-VN' : 'en-US';
    const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    if (diffMin < 1) return currentLang === 'vi' ? 'Vừa mới xong' : 'Just now';
    if (diffMin < 60) return currentLang === 'vi' ? `${diffMin} phút trước (${timeStr})` : `${diffMin}m ago (${timeStr})`;
    if (diffHour < 24 && isSameDay(date, now)) return currentLang === 'vi' ? `${diffHour} giờ trước (${timeStr})` : `${diffHour}h ago (${timeStr})`;
    const dateStr = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    return currentLang === 'vi' ? `${dateStr} lúc ${timeStr}` : `${dateStr} at ${timeStr}`;
}
const previewContext = photoPreviewCanvas.getContext('2d');
let sourceImage = null;
let imageRotation = 0;
let imageFlipX = false;
let imageFlipY = false;
let currentImageDataUrl = "";
let pendingMapCat = null;
let currentUser = null;
let isSignedIn = false;
let isCatAdmin = false;
let pendingCatSubmissions = [];
let localCatsForMigration = [];
let localCatsMigrationComplete = false;
let cloudRenderTimer = null;
const authLinkType = new URLSearchParams(window.location.hash.slice(1)).get('type') ||
    new URLSearchParams(window.location.search).get('type');
let passwordRecoveryMode = authLinkType === 'invite' || authLinkType === 'recovery';
let isSignUpMode = false;
let catsRealtimeChannel = null;
const locationNameCacheKey = 'catMapLocationNamesV2';
function readLocationNameCache() {
    try {
        const entries = JSON.parse(localStorage.getItem(locationNameCacheKey) || '[]');
        return new Map(Array.isArray(entries) ? entries.filter(entry =>
            Array.isArray(entry) && typeof entry[0] === 'string' &&
            entry[1] && typeof entry[1].name === 'string' && entry[1].name.trim() && entry[1].name.length <= 120 &&
            typeof entry[1].baseName === 'string' && entry[1].baseName.trim() && entry[1].baseName.length <= 120
        ).slice(-200) : []);
    } catch (error) {
        return new Map();
    }
}
const reverseGeocodeCache = readLocationNameCache();
const reverseGeocodePending = new Map();
const reverseGeocodeFailures = new Map();
const catLocationObservers = new WeakMap();
let reverseGeocodeQueue = Promise.resolve();
let lastReverseGeocodeAt = 0;
saveButton.disabled = true;
openModalButton.disabled = true;
exportBackupButton.disabled = true;
importBackupButton.disabled = true;

const imageViewerPrev = document.getElementById('imageViewerPrev');
const imageViewerNext = document.getElementById('imageViewerNext');
const imageViewerCounter = document.getElementById('imageViewerCounter');
let imageViewerGallery = [];
let imageViewerIndex = 0;

function renderImageViewerSlide() {
    if (!imageViewerGallery.length) return;
    imageViewerImage.src = imageViewerGallery[imageViewerIndex];
    const hasMultiple = imageViewerGallery.length > 1;
    if (imageViewerPrev) imageViewerPrev.hidden = !hasMultiple;
    if (imageViewerNext) imageViewerNext.hidden = !hasMultiple;
    if (imageViewerCounter) {
        imageViewerCounter.hidden = !hasMultiple;
        if (hasMultiple) imageViewerCounter.textContent = `${imageViewerIndex + 1} / ${imageViewerGallery.length}`;
    }
}

function stepImageViewer(delta) {
    if (imageViewerGallery.length <= 1) return;
    imageViewerIndex = (imageViewerIndex + delta + imageViewerGallery.length) % imageViewerGallery.length;
    renderImageViewerSlide();
}

if (imageViewerPrev) imageViewerPrev.addEventListener('click', e => { e.stopPropagation(); stepImageViewer(-1); });
if (imageViewerNext) imageViewerNext.addEventListener('click', e => { e.stopPropagation(); stepImageViewer(1); });

(() => {
    let touchStartX = 0;
    imageViewer.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    imageViewer.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 45) stepImageViewer(dx < 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('keydown', e => {
        if (!imageViewer.classList.contains('active')) return;
        if (e.key === 'ArrowLeft') stepImageViewer(-1);
        else if (e.key === 'ArrowRight') stepImageViewer(1);
    });
})();

function closeImageViewer() {
    imageViewer.classList.remove('active');
    imageViewerImage.removeAttribute('src');
    imageViewerGallery = [];
    imageViewerIndex = 0;
}

function openImageViewer(image, galleryUrls = null, startIndex = 0) {
    const list = Array.isArray(galleryUrls) && galleryUrls.length ? galleryUrls : [image.src].filter(Boolean);
    imageViewerGallery = list;
    imageViewerIndex = Math.max(0, Math.min(startIndex, list.length - 1));
    renderImageViewerSlide();
    imageViewer.classList.add('active');
    imageViewerClose.focus();
}

function readFavoriteCatIds() {
    try {
        const stored = localStorage.getItem(favoriteCatsStorageKey);
        const values = stored ? JSON.parse(stored) : [];
        return new Set(Array.isArray(values) ? values.filter(id => typeof id === 'string' && id.trim() && id.length <= 200) : []);
    } catch (error) {
        return new Set();
    }
}

function resetCatFavoriteState() {
    favoriteRequestVersion += 1;
    favoriteAccountId = null;
    favoriteCatIds = new Set();
    favoriteLoading = false;
    favoriteSaving = false;
    favoriteSyncError = '';
    refreshCatFavoriteViews();
}

function claimLegacyFavoriteMigration(userId) {
    if (legacyFavoriteMigrationOwner && legacyFavoriteMigrationOwner !== userId) return false;
    try {
        const storedOwner = localStorage.getItem(favoriteMigrationOwnerKey);
        if (storedOwner && storedOwner !== userId) return false;
        if (!storedOwner) localStorage.setItem(favoriteMigrationOwnerKey, userId);
        if (localStorage.getItem(favoriteMigrationOwnerKey) !== userId) return false;
        legacyFavoriteMigrationOwner = userId;
        return true;
    } catch (error) {
        return false;
    }
}

async function refreshCloudCatFavorites({ migrateLocal = false } = {}) {
    const userId = currentUser?.id;
    if (!userId || !supabaseClient) {
        resetCatFavoriteState();
        return false;
    }
    if ((favoriteLoading || favoriteSaving) && favoriteAccountId === userId) return false;
    const requestVersion = ++favoriteRequestVersion;
    if (favoriteAccountId !== userId) {
        favoriteCatIds = new Set();
        favoriteSaving = false;
    }
    favoriteAccountId = userId;
    favoriteLoading = true;
    favoriteSyncError = '';
    refreshCatFavoriteViews();
    try {
        const knownCatIds = new Set(cats.map(cat => cat.id));
        const legacyIds = migrateLocal ? [...readFavoriteCatIds()].filter(id => knownCatIds.has(id)) : [];
        const importedIds = legacyIds.length && claimLegacyFavoriteMigration(userId) ? legacyIds : [];
        if (importedIds.length) {
            const { error } = await supabaseClient.from('cat_favorites').upsert(
                importedIds.map(cat_id => ({ user_id: userId, cat_id })),
                { onConflict: 'user_id,cat_id', ignoreDuplicates: true }
            );
            if (error) throw error;
        }
        const { data, error } = await supabaseClient.from('cat_favorites').select('cat_id').eq('user_id', userId);
        if (error) throw error;
        if (currentUser?.id !== userId || requestVersion !== favoriteRequestVersion) return false;
        favoriteCatIds = new Set((data || []).map(row => row.cat_id));
        if (importedIds.length) {
            const imported = new Set(importedIds);
            const remaining = [...readFavoriteCatIds()].filter(id => !imported.has(id));
            try {
                if (remaining.length) localStorage.setItem(favoriteCatsStorageKey, JSON.stringify(remaining));
                else localStorage.removeItem(favoriteCatsStorageKey);
            } catch (error) {}
        }
        return true;
    } catch (error) {
        if (currentUser?.id === userId && requestVersion === favoriteRequestVersion) {
            favoriteSyncError = t('err_fav_sync');
            console.error('Không thể đồng bộ yêu thích:', error);
        }
        return false;
    } finally {
        if (currentUser?.id === userId && requestVersion === favoriteRequestVersion) {
            favoriteLoading = false;
            refreshCatFavoriteViews();
        }
    }
}

function updateCatFavoriteButton(button) {
    const selected = favoriteCatIds.has(button.dataset.catFavorite);
    button.disabled = favoriteLoading || favoriteSaving || Boolean(currentUser && favoriteSyncError);
    button.setAttribute('aria-busy', String(favoriteLoading || favoriteSaving));
    button.textContent = selected
        ? (currentLang === 'vi' ? '♥ Yêu thích' : '♥ Favorited')
        : (currentLang === 'vi' ? '♡ Yêu thích' : '♡ Favorite');
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? (currentLang === 'vi' ? 'Bỏ yêu thích' : 'Unfavorite') : (currentLang === 'vi' ? 'Thêm vào yêu thích' : 'Favorite')}: ${button.dataset.catName}`);
}

function refreshCatFavoriteViews() {
    const activeButton = document.activeElement;
    const focusedId = catSearchResults.contains(activeButton) ? activeButton?.dataset.catFavorite : null;
    const scrollTop = catSearchResults.scrollTop;
    if (favoritesOnly) renderCatMarkers();
    else renderCatList();
    document.querySelectorAll('button[data-cat-favorite]').forEach(updateCatFavoriteButton);
    catSearchResults.scrollTop = scrollTop;
    if (focusedId) {
        const nextButton = [...catSearchResults.querySelectorAll('button[data-cat-favorite]')]
            .find(button => button.dataset.catFavorite === focusedId);
        (nextButton || catFavoritesTab).focus({ preventScroll: true });
    }
}

async function toggleCatFavorite(catId) {
    if (!cats.some(cat => cat.id === catId)) return;
    if (!currentUser || !supabaseClient) {
        collaborationPanel.classList.add('expanded');
        collaborationToggle.setAttribute('aria-expanded', 'true');
        collaborationMessage.textContent = t('collab_msg_fav_prompt');
        collaborationEmail.focus();
        return;
    }
    if (favoriteLoading || favoriteSaving || favoriteSyncError || favoriteAccountId !== currentUser.id) return;
    const userId = currentUser.id;
    const adding = !favoriteCatIds.has(catId);
    const requestVersion = ++favoriteRequestVersion;
    favoriteSaving = true;
    refreshCatFavoriteViews();
    try {
        const result = adding
            ? await supabaseClient.from('cat_favorites').upsert({ user_id: userId, cat_id: catId },
                { onConflict: 'user_id,cat_id', ignoreDuplicates: true })
            : await supabaseClient.from('cat_favorites').delete().eq('user_id', userId).eq('cat_id', catId);
        if (result.error) throw result.error;
        if (currentUser?.id !== userId || requestVersion !== favoriteRequestVersion) return;
        if (adding) favoriteCatIds.add(catId);
        else favoriteCatIds.delete(catId);
    } catch (error) {
        if (currentUser?.id === userId && requestVersion === favoriteRequestVersion) {
            favoriteSyncError = t('err_fav_save');
            console.error('Không thể lưu yêu thích:', error);
        }
    } finally {
        if (currentUser?.id === userId && requestVersion === favoriteRequestVersion) {
            favoriteSaving = false;
            refreshCatFavoriteViews();
        }
    }
}

function getCatDirectionsUrl(cat) {
    const coordinates = [cat?.lat, cat?.lng];
    if (coordinates.some(value => !['number', 'string'].includes(typeof value) ||
        (typeof value === 'string' && !value.trim()))) return null;
    const lat = Number(cat.lat);
    const lng = Number(cat.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
    const url = new URL('https://www.google.com/maps/dir/');
    url.search = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, dir_action: 'navigate' });
    return url.href;
}

function getCatDisplayNote(cat) {
    const raw = (cat?.note || '').trim();
    if (!raw || raw === 'Một bé mèo cute ẩn danh 🐾' || raw === 'A cute anonymous kitty 🐾') {
        return t('default_cat_note');
    }
    return raw;
}

function createCatQuickActions(cat) {
    const actions = document.createElement('div');
    actions.className = 'cat-quick-actions';
    const commentsButton = document.createElement('button');
    commentsButton.type = 'button';
    commentsButton.className = 'cat-comments-button';
    commentsButton.textContent = currentLang === 'en' ? '💬 Comments' : '💬 Bình luận';
    commentsButton.addEventListener('click', event => {
        event.stopPropagation();
        window.catCommunity?.open(cat);
    });
    actions.appendChild(commentsButton);
    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.dataset.catFavorite = cat.id;
    favoriteButton.dataset.catName = cat.name || t('unnamed_cat');
    updateCatFavoriteButton(favoriteButton);
    favoriteButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleCatFavorite(cat.id);
    });
    actions.appendChild(favoriteButton);
    const href = getCatDirectionsUrl(cat);
    if (href) {
        const directions = document.createElement('a');
        directions.href = href;
        directions.target = '_blank';
        directions.rel = 'noopener noreferrer';
        directions.textContent = t('btn_directions');
        directions.setAttribute('aria-label', currentLang === 'en' ? `Directions to ${cat.name || 'cat'} on Google Maps (opens in new tab)` : `Chỉ đường đến ${cat.name || 'mèo'} trên Google Maps (mở trong thẻ mới)`);
        directions.addEventListener('click', event => event.stopPropagation());
        actions.appendChild(directions);
    }
    return actions;
}

function createCatReportLink(cat) {
    const report = document.createElement('a');
    const reportUrl = new URL('https://phamduyen6611-ops.github.io/lien-he.html');
    reportUrl.search = new URLSearchParams({ cat: String(cat.id), ten: cat.name || (currentLang === 'en' ? 'Unnamed cat' : 'Mèo chưa đặt tên') });
    report.className = 'cat-report-link';
    report.href = reportUrl.href;
    report.target = '_blank';
    report.rel = 'noopener noreferrer';
    report.textContent = t('btn_report_info');
    report.setAttribute('aria-label', currentLang === 'en' ? `Report incorrect information about ${cat.name || 'cat'} (opens in new tab)` : `Báo thông tin sai về ${cat.name || 'mèo'} (mở trong thẻ mới)`);
    report.addEventListener('click', event => event.stopPropagation());
    return report;
}


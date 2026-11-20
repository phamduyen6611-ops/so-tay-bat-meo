(() => {
    'use strict';
    const button = document.getElementById('installAppButton');
    const dialog = document.getElementById('installHelpDialog');
    const status = document.getElementById('installHelpStatus');
    const standalone = window.matchMedia('(display-mode: standalone)');
    const fullscreen = window.matchMedia('(display-mode: fullscreen)');
    let deferredPrompt = null;
    let installed = false;
    let prompting = false;

    function getLang() {
        return (document.documentElement.lang || localStorage.getItem('catMap_lang') || 'vi') === 'en' ? 'en' : 'vi';
    }

    function updateLanguage() {
        const isEn = getLang() === 'en';
        if (button) {
            button.textContent = isEn ? '＋ Add to Home Screen' : '＋ Thêm vào màn hình chính';
        }
        const titleEl = document.getElementById('installHelpTitle');
        if (titleEl) titleEl.textContent = isEn ? 'Add to Home Screen' : 'Thêm vào màn hình chính';
        const introEl = document.getElementById('installHelpIntro');
        if (introEl) introEl.textContent = isEn ? 'Quickly access Stray Cat Notebook from your device home screen.' : 'Mở nhanh Sổ Tay Bắt Mèo từ biểu tượng trên thiết bị của bạn.';
        const noteEl = document.getElementById('installHelpBrowserNote');
        if (noteEl) noteEl.textContent = isEn ? "If opened inside Zalo or Facebook, tap ⋯ and choose 'Open in Browser' first." : 'Nếu đang mở trong Zalo hoặc Facebook, hãy chọn mở liên kết bằng trình duyệt trước.';
        const urlLabel = document.querySelector('label[for="installAppUrl"]');
        if (urlLabel) urlLabel.textContent = isEn ? 'Application Link' : 'Liên kết ứng dụng';
        const copyBtn = document.getElementById('installCopyLink');
        if (copyBtn) copyBtn.textContent = isEn ? 'Copy Link' : 'Sao chép liên kết';
        const doneBtn = document.getElementById('installHelpDone');
        if (doneBtn) doneBtn.textContent = isEn ? 'Got it' : 'Đã hiểu';
        if (dialog && dialog.open) {
            showHelp();
        }
    }

    window.updateInstallLanguage = updateLanguage;

    function updateButton() {
        button.hidden = installed || standalone.matches || fullscreen.matches || navigator.standalone === true;
        button.disabled = prompting;
        if (button.hidden && dialog.open) dialog.close();
    }

    function showHelp(message = '') {
        const isEn = getLang() === 'en';
        const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const android = /Android/i.test(navigator.userAgent);
        const steps = ios ? (isEn ? [
            'Open the app link below in Safari.',
            'Tap the Share button (square with arrow pointing up). On some Safari versions, it is in the ⋯ menu.',
            'Choose "Add to Home Screen". If available, toggle on "Open as Web App", then tap "Add".'
        ] : [
            'Mở liên kết ứng dụng bên dưới bằng Safari.',
            'Bấm nút Chia sẻ (hình vuông có mũi tên hướng lên). Tùy phiên bản Safari, nút này có thể nằm trong menu ⋯.',
            'Chọn “Thêm vào Màn hình chính”. Nếu có tùy chọn “Mở dưới dạng ứng dụng web”, hãy bật tùy chọn đó, rồi bấm “Thêm”.'
        ]) : android ? (isEn ? [
            'Open the app link below in Chrome.',
            'Tap the browser ⋮ menu, choose "Add to Home screen" or "Install app".',
            'Confirm "Add" or "Install" in the browser prompt.'
        ] : [
            'Mở liên kết ứng dụng bên dưới bằng Chrome.',
            'Bấm menu ⋮ của trình duyệt, chọn “Thêm vào màn hình chính” hoặc “Cài đặt ứng dụng”.',
            'Xác nhận “Thêm” hoặc “Cài đặt” trong cửa sổ của trình duyệt.'
        ]) : (isEn ? [
            'Open the app link in Chrome or Edge.',
            'Find the install icon in the address bar or "Install app" in the browser ⋮ / ⋯ menu.',
            'Click "Install". If unavailable, bookmark this page for fast access.'
        ] : [
            'Mở liên kết ứng dụng bằng Chrome hoặc Edge.',
            'Tìm biểu tượng cài đặt trên thanh địa chỉ hoặc mục cài ứng dụng trong menu ⋮ / ⋯ của trình duyệt.',
            'Chọn “Cài đặt”. Nếu trình duyệt không có lựa chọn này, bạn có thể lưu dấu trang để mở nhanh.'
        ]);
        const list = document.getElementById('installHelpSteps');
        list.replaceChildren(...steps.map(text => {
            const item = document.createElement('li');
            item.textContent = text;
            return item;
        }));
        status.textContent = message;
        if (!dialog.open) {
            dialog.showModal();
            dialog.scrollTop = 0;
        }
    }

    window.addEventListener('beforeinstallprompt', event => {
        if (typeof event.prompt !== 'function') return;
        event.preventDefault();
        deferredPrompt = event;
        updateButton();
    });
    window.addEventListener('appinstalled', () => {
        installed = true;
        deferredPrompt = null;
        updateButton();
    });
    for (const query of [standalone, fullscreen]) {
        if (query.addEventListener) query.addEventListener('change', updateButton);
        else if (query.addListener) query.addListener(updateButton);
    }
    window.addEventListener('pageshow', () => {
        updateLanguage();
        updateButton();
    });
    button.addEventListener('click', async () => {
        if (prompting || button.hidden) return;
        if (!deferredPrompt) {
            showHelp();
            return;
        }
        const prompt = deferredPrompt;
        deferredPrompt = null;
        prompting = true;
        updateButton();
        try {
            const result = await prompt.prompt();
            const choice = result || await prompt.userChoice;
            if (choice?.outcome === 'accepted') installed = true;
        } catch {
            const isEn = getLang() === 'en';
            if (!installed) showHelp(isEn ? 'Could not open install dialog. Please follow the steps above.' : 'Chưa mở được cửa sổ cài đặt. Bạn có thể làm theo các bước phía trên.');
        } finally {
            prompting = false;
            updateButton();
        }
    });
    for (const id of ['installHelpClose', 'installHelpDone']) {
        document.getElementById(id).addEventListener('click', () => dialog.close());
    }
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { if (!button.hidden) button.focus({ preventScroll: true }); });
    document.getElementById('installCopyLink').addEventListener('click', async () => {
        const input = document.getElementById('installAppUrl');
        const isEn = getLang() === 'en';
        try {
            await navigator.clipboard.writeText(input.value);
            status.textContent = isEn ? 'App link copied to clipboard.' : 'Đã sao chép liên kết ứng dụng.';
        } catch {
            input.focus();
            input.select();
            status.textContent = isEn ? 'Tap and hold selected link to copy.' : 'Chạm giữ liên kết đã chọn để sao chép.';
        }
    });
    updateLanguage();
    updateButton();
})();

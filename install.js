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

    function updateButton() {
        button.hidden = installed || standalone.matches || fullscreen.matches || navigator.standalone === true;
        button.disabled = prompting;
        if (button.hidden && dialog.open) dialog.close();
    }

    function showHelp(message = '') {
        const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const android = /Android/i.test(navigator.userAgent);
        const steps = ios ? [
            'Mở liên kết ứng dụng bên dưới bằng Safari.',
            'Bấm nút Chia sẻ (hình vuông có mũi tên hướng lên). Tùy phiên bản Safari, nút này có thể nằm trong menu ⋯.',
            'Chọn “Thêm vào Màn hình chính”. Nếu có tùy chọn “Mở dưới dạng ứng dụng web”, hãy bật tùy chọn đó, rồi bấm “Thêm”.'
        ] : android ? [
            'Mở liên kết ứng dụng bên dưới bằng Chrome.',
            'Bấm menu ⋮ của trình duyệt, chọn “Thêm vào màn hình chính” hoặc “Cài đặt ứng dụng”.',
            'Xác nhận “Thêm” hoặc “Cài đặt” trong cửa sổ của trình duyệt.'
        ] : [
            'Mở liên kết ứng dụng bằng Chrome hoặc Edge.',
            'Tìm biểu tượng cài đặt trên thanh địa chỉ hoặc mục cài ứng dụng trong menu ⋮ / ⋯ của trình duyệt.',
            'Chọn “Cài đặt”. Nếu trình duyệt không có lựa chọn này, bạn có thể lưu dấu trang để mở nhanh.'
        ];
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
    window.addEventListener('pageshow', updateButton);
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
            if (!installed) showHelp('Chưa mở được cửa sổ cài đặt. Bạn có thể làm theo các bước phía trên.');
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
        try {
            await navigator.clipboard.writeText(input.value);
            status.textContent = 'Đã sao chép liên kết ứng dụng.';
        } catch {
            input.focus();
            input.select();
            status.textContent = 'Chạm giữ liên kết đã chọn để sao chép.';
        }
    });
    updateButton();
})();

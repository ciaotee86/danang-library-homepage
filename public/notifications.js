/**
 * Thư viện Đà Nẵng - Hệ thống Thông báo & Hộp thoại tùy chỉnh (Toasts & Custom Modals)
 * Thay thế hàm alert() mặc định bằng các thẻ thông báo động, mượt mà và đẹp mắt.
 */

// Đảm bảo các thành phần HTML được tạo tự động nếu chưa có
function initializeNotificationDOM() {
    if (!document.getElementById('toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(toastContainer);
    }

    if (!document.getElementById('custom-alert')) {
        const alertOverlay = document.createElement('div');
        alertOverlay.id = 'custom-alert';
        alertOverlay.className = 'custom-alert-overlay';
        alertOverlay.innerHTML = `
            <div class="custom-alert-card">
                <div id="custom-alert-icon" style="font-size: 3.5rem; margin-bottom: 15px;"></div>
                <h3 id="custom-alert-title" style="font-size: 1.25rem; font-weight: 700; color: #112E51; margin-bottom: 8px;">Thông báo</h3>
                <p id="custom-alert-message" style="font-size: 0.9rem; color: #64748b; line-height: 1.5; margin-bottom: 24px; white-space: pre-line;"></p>
                <button id="custom-alert-btn" class="payment-btn-confirm" style="width: auto; display: inline-block; padding: 10px 30px; background-color: #1E6B7B; color: white; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;">Đồng ý</button>
            </div>
        `;
        document.body.appendChild(alertOverlay);

        // Đóng hộp thoại khi click Đồng ý
        document.getElementById('custom-alert-btn').addEventListener('click', () => {
            alertOverlay.classList.remove('active');
        });
    }
}

// Hàm hiển thị Toast (Thông báo nổi góc màn hình)
function showToast(message, type = 'success') {
    initializeNotificationDOM();
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'info') iconClass = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Tự động xóa toast sau 4 giây
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3700);
}

// Hàm hiển thị Alert Modal tùy chỉnh (Hộp thoại sự kiện)
function showAlert(title, message, type = 'info', callback = null) {
    initializeNotificationDOM();
    const alertOverlay = document.getElementById('custom-alert');
    const iconDiv = document.getElementById('custom-alert-icon');
    const titleH3 = document.getElementById('custom-alert-title');
    const messageP = document.getElementById('custom-alert-message');
    const btn = document.getElementById('custom-alert-btn');

    // Ẩn confirm actions nếu có
    const oldActions = document.getElementById('custom-confirm-actions');
    if (oldActions) oldActions.remove();
    btn.style.display = 'inline-block';

    titleH3.textContent = title;
    messageP.textContent = message;

    // Đổi icon và màu dựa trên loại thông báo
    iconDiv.className = `custom-alert-icon-${type}`;
    if (type === 'success') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        btn.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        btn.style.backgroundColor = '#ef4444';
    } else if (type === 'warning') {
        iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        btn.style.backgroundColor = '#f59e0b';
    } else {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        btn.style.backgroundColor = '#1E6B7B';
    }

    // Gắn callback khi bấm nút đồng ý
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
        alertOverlay.classList.remove('active');
        if (callback) callback();
    });

    alertOverlay.classList.add('active');
}

// Hàm Confirm Modal tùy chỉnh (Hộp thoại xác nhận)
function showConfirm(title, message, callbackYes, callbackNo = null) {
    initializeNotificationDOM();
    const alertOverlay = document.getElementById('custom-alert');
    const iconDiv = document.getElementById('custom-alert-icon');
    const titleH3 = document.getElementById('custom-alert-title');
    const messageP = document.getElementById('custom-alert-message');
    const btn = document.getElementById('custom-alert-btn');

    titleH3.textContent = title;
    messageP.textContent = message;
    iconDiv.className = 'custom-alert-icon-info';
    iconDiv.innerHTML = '<i class="fa-solid fa-circle-question" style="color: #3b82f6;"></i>';

    // Tạo 2 nút Đồng ý & Hủy
    const actionsWrapper = document.createElement('div');
    actionsWrapper.id = 'custom-confirm-actions';
    actionsWrapper.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin-top: 24px;';
    
    const btnYes = document.createElement('button');
    btnYes.className = 'payment-btn-confirm';
    btnYes.style.cssText = 'width: auto; padding: 10px 24px; background-color: #3b82f6; color: white; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;';
    btnYes.textContent = 'Đồng ý';

    const btnNo = document.createElement('button');
    btnNo.className = 'payment-btn-confirm';
    btnNo.style.cssText = 'width: auto; padding: 10px 24px; background-color: #94a3b8; color: white; border-radius: 6px; font-weight: 600; border: none; cursor: pointer;';
    btnNo.textContent = 'Hủy bỏ';

    actionsWrapper.appendChild(btnNo);
    actionsWrapper.appendChild(btnYes);

    const oldActions = document.getElementById('custom-confirm-actions');
    if (oldActions) oldActions.remove();

    btn.style.display = 'none'; // Ẩn nút OK mặc định
    btn.parentNode.appendChild(actionsWrapper);

    btnYes.addEventListener('click', () => {
        alertOverlay.classList.remove('active');
        btn.style.display = 'inline-block';
        actionsWrapper.remove();
        if (callbackYes) callbackYes();
    });

    btnNo.addEventListener('click', () => {
        alertOverlay.classList.remove('active');
        btn.style.display = 'inline-block';
        actionsWrapper.remove();
        if (callbackNo) callbackNo();
    });

    alertOverlay.classList.add('active');
}

// Gắn đè hàm alert mặc định bằng Toast để tăng trải nghiệm người dùng
window.alert = function(msg) {
    showToast(msg, 'info');
};

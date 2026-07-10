/**
 * Thư viện Đà Nẵng - Logic Nghiệp vụ Trang Cá nhân Bạn đọc
 * Kết nối REST API, gia hạn sách và thanh toán tiền phạt trực tuyến.
 */

let activeSlipIdForPayment = null;
let activeFineAmountForPayment = 0;

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Xác thực (Authentication Check) ===
    const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
    const token = sessionStorage.getItem('tvdn_auth_token');
    if (!loggedUser || !token) {
        sessionStorage.removeItem('tvdn_logged_in_user');
        sessionStorage.removeItem('tvdn_auth_token');
        window.location.href = 'login.html';
        return;
    }

    // Hiển thị Header
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        const adminButton = loggedUser.role === 'admin' 
            ? `<button class="btn-login" onclick="window.location.href='admin.html'" style="border-color:var(--secondary-color); color:var(--secondary-color); background-color:#eff6ff;"><i class="fa-solid fa-gauge-high"></i> Quản trị</button>` 
            : '';
        
        headerActions.innerHTML = `
            <button class="btn-cart" id="btn-cart-trigger" title="Giỏ hàng sách mua" style="margin-right: 8px;">
                <i class="fa-solid fa-cart-shopping"></i> Giỏ hàng
                <span class="cart-badge" id="cart-badge-count">0</span>
            </button>
            <button class="btn-ai-suggest" id="btn-ai-suggest" onclick="window.location.href='ai-suggest.html'">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý AI
            </button>
            ${adminButton}
            <div class="user-greeting-badge" style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; color:var(--primary-color); cursor:pointer;">
                <i class="fa-solid fa-user-circle" style="font-size:1.15rem; color:var(--secondary-color);"></i> Hi, ${loggedUser.fullname}
            </div>
            <button class="btn-login" id="btn-logout" style="border-color:#fca5a5; color:#e11d48; background-color:#fff1f2;" title="Đăng xuất tài khoản">
                <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
            </button>
        `;

        // Đồng bộ số lượng giỏ hàng ở header trang cá nhân
        const cart = JSON.parse(sessionStorage.getItem('tvdn_shopping_cart')) || [];
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartBadge = document.getElementById('cart-badge-count');
        if (cartBadge) {
            cartBadge.textContent = count;
            cartBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        document.getElementById('btn-cart-trigger').addEventListener('click', () => {
            window.location.href = 'index.html?openCart=true';
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            showConfirm('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?', () => {
                sessionStorage.removeItem('tvdn_logged_in_user');
                window.location.href = 'index.html';
            });
        });
    }

    // === 2. Điền thông tin hồ sơ ===
    document.getElementById('profile-fullname').textContent = loggedUser.fullname;
    document.getElementById('profile-card-id').textContent = loggedUser.cardId || 'TVDN-xxxx';
    document.getElementById('profile-username').textContent = loggedUser.username;
    document.getElementById('profile-phone').textContent = loggedUser.phone || 'Chưa cập nhật';
    
    const initials = loggedUser.fullname.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('profile-avatar-letters').textContent = initials || 'US';

    // === 3. Tải danh sách mượn trả từ API ===
    loadUserSlips(loggedUser);
    loadUserOrders(loggedUser);
});

async function loadUserSlips(user) {
    try {
        const token = sessionStorage.getItem('tvdn_auth_token');
        const res = await fetch('/api/slips', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const slips = await res.json();

        // Lọc phiếu của user
        const userSlips = slips.filter(s => s.username === user.username);

        // 1. Tính toán Metrics
        const borrowingCount = userSlips.filter(s => s.status === 'borrowing' || s.status === 'overdue').length;
        const overdueCount = userSlips.filter(s => s.status === 'overdue').length;
        
        let unpaidFineSum = 0;
        userSlips.forEach(s => {
            if (s.fineAmount > 0 && s.paymentStatus === 'unpaid') {
                unpaidFineSum += s.fineAmount;
            }
        });

        document.getElementById('metric-p-borrowing').textContent = borrowingCount;
        document.getElementById('metric-p-overdue').textContent = overdueCount;
        document.getElementById('metric-p-fine').textContent = unpaidFineSum.toLocaleString() + 'đ';

        // 2. Điền bảng lịch sử mượn
        const tableBody = document.getElementById('user-slips-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (userSlips.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Bạn chưa từng đăng ký mượn tài liệu nào.</td></tr>`;
            return;
        }

        userSlips.forEach(s => {
            let statusBadgeClass = 'badge-success';
            let statusText = 'Đã trả';

            if (s.status === 'borrowing') {
                statusBadgeClass = 'badge-info';
                statusText = 'Đang mượn';
            } else if (s.status === 'overdue') {
                statusBadgeClass = 'badge-danger';
                statusText = 'Quá hạn';
            }

            const returnDateText = s.returnDate ? s.returnDate : '-';
            const fineText = s.fineAmount > 0 ? `${s.fineAmount.toLocaleString()}đ` : '-';
            
            let paymentBadge = '';
            if (s.fineAmount > 0) {
                paymentBadge = s.paymentStatus === 'paid' 
                    ? ' <span class="badge badge-success" style="font-size:0.65rem;">Đã đóng</span>'
                    : ' <span class="badge badge-danger" style="font-size:0.65rem;">Chưa đóng</span>';
            }

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.setAttribute('onclick', `selectUserSlipRow('${s.id}')`);
            tr.innerHTML = `
                <td><strong>${s.id}</strong></td>
                <td title="${s.bookTitle}">${s.bookTitle}</td>
                <td>${s.borrowDate}</td>
                <td>${s.dueDate}</td>
                <td>${returnDateText}</td>
                <td><strong>${fineText}</strong>${paymentBadge}</td>
                <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Lỗi tải phiếu mượn cá nhân:', err);
    }
}

// Xử lý khi click hàng phiếu mượn
window.selectUserSlipRow = async function(slipId) {
    const detailPanel = document.getElementById('user-slip-detail-panel');
    if (!detailPanel) return;

    try {
        const token = sessionStorage.getItem('tvdn_auth_token');
        const res = await fetch('/api/slips', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const slips = await res.json();
        const slip = slips.find(s => s.id === slipId);

        if (!slip) return;

        detailPanel.style.display = 'block';
        document.getElementById('detail-active-slip-id').textContent = slip.id;

        const desc = document.getElementById('detail-active-slip-desc');
        const actionsRow = document.getElementById('detail-active-actions-row');
        
        actionsRow.innerHTML = '';

        if (slip.status === 'borrowing' || slip.status === 'overdue') {
            desc.innerHTML = `Cuốn sách: <strong>${slip.bookTitle}</strong>. Hạn trả hiện tại: <strong>${slip.dueDate}</strong>. Bạn có thể gia hạn thêm 14 ngày nếu chưa trễ hạn.`;
            
            // Nút Trả sách trực tuyến
            actionsRow.innerHTML += `<button class="btn-login" style="border-color:var(--secondary-color); color:var(--secondary-color); background-color:white;" onclick="returnUserBook('${slip.id}')"><i class="fa-solid fa-arrow-rotate-left"></i> Trả sách</button>`;

            // Chỉ cho gia hạn nếu là borrowing (chưa quá hạn)
            if (slip.status === 'borrowing') {
                actionsRow.innerHTML += `<button class="btn-login" style="border-color:var(--accent-color); color:var(--accent-dark); background-color:white;" onclick="renewUserSlip('${slip.id}')"><i class="fa-solid fa-calendar-plus"></i> Tự động gia hạn 14 ngày</button>`;
            } else {
                desc.innerHTML += `<br><span style="color:#ef4444; font-weight:bold;">* Phiếu mượn đã QUÁ HẠN. Vui lòng bấm trả sách và nộp phạt trễ hạn.</span>`;
            }

            // Nếu quá hạn và chưa đóng phạt
            if (slip.fineAmount > 0 && slip.paymentStatus === 'unpaid') {
                desc.innerHTML += `<br><span style="color:#ef4444; font-weight:bold;">* Số tiền phạt trễ hạn hiện tại: ${slip.fineAmount.toLocaleString()}đ</span>`;
                actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:var(--accent-dark); width:auto;" onclick="openPaymentModal('${slip.id}', ${slip.fineAmount})"><i class="fa-solid fa-credit-card"></i> Thanh toán khoản phạt</button>`;
            }
        } else if (slip.status === 'returned') {
            desc.innerHTML = `Cuốn sách: <strong>${slip.bookTitle}</strong>. Đã hoàn trả thư viện ngày: <strong>${slip.returnDate}</strong>.`;
            
            // Đã trả nhưng chưa nộp phạt trễ hạn
            if (slip.fineAmount > 0 && slip.paymentStatus === 'unpaid') {
                desc.innerHTML += `<br><span style="color:#ef4444; font-weight:bold;">* Phát sinh phạt trễ hạn chưa thanh toán: ${slip.fineAmount.toLocaleString()}đ.</span>`;
                actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:var(--accent-dark); width:auto;" onclick="openPaymentModal('${slip.id}', ${slip.fineAmount})"><i class="fa-solid fa-credit-card"></i> Thanh toán khoản phạt</button>`;
            } else {
                desc.innerHTML += ` Phiếu mượn đã hoàn thành hợp lệ.`;
            }
        }

    } catch (err) {
        console.error(err);
    }
};

// Trả sách trực tuyến
window.returnUserBook = async function(slipId) {
    showConfirm('Xác nhận trả sách', 'Bạn có chắc chắn muốn hoàn trả cuốn sách này về thư viện?', async () => {
        try {
            const token = sessionStorage.getItem('tvdn_auth_token');
            const res = await fetch(`/api/slips/${slipId}/return`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                if (data.fineAmount > 0) {
                    showAlert('Trả sách thành công', `Bạn đã trả sách thành công.\nPhiếu mượn quá hạn phát sinh khoản phạt: ${data.fineAmount.toLocaleString()}đ.\nVui lòng thanh toán khoản phạt trễ hạn này!`, 'warning');
                } else {
                    showAlert('Trả sách thành công', 'Bạn đã hoàn trả sách thành công về thư viện!', 'success');
                }
                const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
                loadUserSlips(loggedUser);
                selectUserSlipRow(slipId);
            } else {
                showAlert('Lỗi trả sách', data.message, 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ khi trả sách.', 'error');
        }
    });
};

// Gia hạn trực tuyến
window.renewUserSlip = async function(slipId) {
    try {
        const token = sessionStorage.getItem('tvdn_auth_token');
        const res = await fetch(`/api/slips/${slipId}/renew`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            showAlert('Gia hạn thành công', `Hạn trả mới cho phiếu mượn ${slipId} đã được dời đến: ${data.newDueDate}`, 'success');
            const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
            loadUserSlips(loggedUser);
            selectUserSlipRow(slipId);
        } else {
            showAlert('Lỗi gia hạn', data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối máy chủ khi gia hạn.', 'error');
    }
};

// --- THANH TOÁN QR ---
let paymentType = 'slip'; // slip or order

window.openPaymentModal = function(slipId, amount, type = 'slip') {
    activeSlipIdForPayment = slipId;
    activeFineAmountForPayment = amount;
    paymentType = type;

    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    const titleH3 = modal.querySelector('h3');
    if (titleH3) {
        if (paymentType === 'order') {
            titleH3.innerHTML = `<i class="fa-solid fa-cart-shopping text-secondary" style="color:var(--secondary-color); margin-right:8px;"></i> Thanh toán hóa đơn mua sách`;
        } else {
            titleH3.innerHTML = `<i class="fa-solid fa-wallet text-secondary" style="color:var(--secondary-color); margin-right:8px;"></i> Thanh toán phí phạt thư viện`;
        }
    }

    document.getElementById('pay-slip-id').textContent = slipId;
    document.getElementById('pay-amount-label').textContent = `${amount.toLocaleString()}đ`;

    selectPaymentMethod('bank'); // Default VietQR
    modal.classList.add('active');
};

window.closePaymentModal = function() {
    document.getElementById('payment-modal').classList.remove('active');
};

window.selectPaymentMethod = async function(method) {
    const btnBank = document.getElementById('method-bank');
    const btnMomo = document.getElementById('method-momo');
    const qrImg = document.getElementById('qr-payment-img');
    const payInstructions = document.getElementById('pay-instructions');

    btnBank.classList.remove('active');
    btnMomo.classList.remove('active');

    if (method === 'bank') {
        btnBank.classList.add('active');
        qrImg.src = '';
        payInstructions.innerHTML = 'Đang kết nối API VietQR để tạo mã thanh toán ngân hàng...';
        
        try {
            const res = await fetch('/api/payment/vietqr-config');
            const config = await res.json();
            
            const addInfo = paymentType === 'order' ? `TVDN MUA ${activeSlipIdForPayment}` : `TVDN PHAT ${activeSlipIdForPayment}`;
            const formattedInfo = encodeURIComponent(addInfo);
            qrImg.src = `https://img.vietqr.io/image/${config.bankId}-${config.accountNumber}-compact2.png?amount=${activeFineAmountForPayment}&addInfo=${formattedInfo}&accountName=${encodeURIComponent(config.accountName)}`;
            payInstructions.innerHTML = `Mở ứng dụng Ngân hàng (SmartBanking) quét mã QR để chuyển khoản. Nội dung chuyển khoản bắt buộc: **${addInfo}**. Tài khoản nhận: **${config.bankId} - ${config.accountNumber}** (${config.accountName}).`;
        } catch (err) {
            payInstructions.innerHTML = 'Lỗi kết nối VietQR API.';
        }
    } else {
        btnMomo.classList.add('active');
        qrImg.src = '';
        payInstructions.innerHTML = 'Đang gọi API cổng thanh toán MoMo...';
        
        try {
            const token = sessionStorage.getItem('tvdn_auth_token');
            const res = await fetch('/api/payment/momo', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slipId: activeSlipIdForPayment, amount: activeFineAmountForPayment })
            });
            const data = await res.json();
            
            if (data.success) {
                qrImg.src = data.payUrl;
                if (data.isMock) {
                    payInstructions.innerHTML = 'Mở ứng dụng Ví MoMo, quét mã QR MoMo để thanh toán (Sandbox Demo).';
                } else {
                    payInstructions.innerHTML = 'Cổng MoMo chính thức đã phản hồi! Nhấp <a href="' + data.payUrl + '" target="_blank" style="color:var(--accent-dark); font-weight:700;">vào đây</a> để mở trang thanh toán.';
                }
            } else {
                payInstructions.innerHTML = 'API MoMo lỗi: ' + data.message;
            }
        } catch (err) {
            payInstructions.innerHTML = 'Lỗi kết nối cổng thanh toán MoMo.';
        }
    }
};

window.confirmPaymentSimulate = async function() {
    try {
        const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        const token = sessionStorage.getItem('tvdn_auth_token');
        if (paymentType === 'order') {
            const res = await fetch(`/api/orders/${activeSlipIdForPayment}/pay`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                showAlert('Thanh toán thành công', `Đơn hàng ${activeSlipIdForPayment} đã được cập nhật trạng thái ĐÃ THANH TOÁN thành công!`, 'success');
                closePaymentModal();
                loadUserOrders(loggedUser);
            }
        } else {
            const res = await fetch('/api/payment/confirm', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slipId: activeSlipIdForPayment })
            });
            const data = await res.json();
            
            if (data.success) {
                showAlert('Thanh toán thành công', `Hóa đơn phạt trễ hạn ${activeSlipIdForPayment} đã được cập nhật thành ĐÃ THANH TOÁN thành công!`, 'success');
                closePaymentModal();
                loadUserSlips(loggedUser);
                selectUserSlipRow(activeSlipIdForPayment);
            }
        }
    } catch (err) {
        showToast('Lỗi kết nối API xác nhận thanh toán.', 'error');
    }
};

async function loadUserOrders(user) {
    const tableBody = document.getElementById('user-orders-table-body');
    if (!tableBody) return;

    try {
        const token = sessionStorage.getItem('tvdn_auth_token');
        const res = await fetch(`/api/orders/user/${user.username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orders = await res.json();

        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Bạn chưa có đơn đặt mua sách nào.</td></tr>`;
            return;
        }

        orders.forEach(o => {
            let payBadgeClass = 'badge-danger';
            let payText = 'Chưa thanh toán';
            if (o.paymentStatus === 'paid') {
                payBadgeClass = 'badge-success';
                payText = 'Đã thanh toán';
            }

            let statusBadgeClass = 'badge-pending';
            let statusText = 'Chờ xử lý';
            if (o.status === 'paid') {
                statusBadgeClass = 'badge-paid';
                statusText = 'Đã thanh toán';
            } else if (o.status === 'shipping') {
                statusBadgeClass = 'badge-shipping';
                statusText = 'Đang giao hàng';
            } else if (o.status === 'completed') {
                statusBadgeClass = 'badge-completed';
                statusText = 'Đã hoàn thành';
            }

            const itemsText = o.items.map(it => `${it.bookTitle} (x${it.quantity})`).join('<br>');
            
            let actionBtn = '';
            if (o.paymentStatus === 'unpaid') {
                actionBtn = `<button class="btn-search-submit" style="padding:6px 12px; font-size:0.75rem; background-color:var(--accent-dark); width:auto;" onclick="openPaymentModal('${o.id}', ${o.totalAmount}, 'order')"><i class="fa-solid fa-credit-card"></i> Thanh toán</button>`;
            } else {
                actionBtn = `<span style="color:var(--text-muted); font-size:0.8rem;"><i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Đã xong</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${o.id}</strong></td>
                <td>${o.orderDate}</td>
                <td style="font-size:0.8rem; line-height:1.4;">${itemsText}</td>
                <td><strong>${o.totalAmount.toLocaleString()}đ</strong></td>
                <td style="text-transform: uppercase; font-size:0.8rem;">${o.paymentMethod}</td>
                <td><span class="badge ${payBadgeClass}">${payText}</span></td>
                <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
                <td>${actionBtn}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Lỗi khi tải đơn hàng của bạn đọc:', err);
    }
}

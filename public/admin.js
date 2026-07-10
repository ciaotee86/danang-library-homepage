/**
 * Thư viện Đà Nẵng - Logic Nghiệp vụ Trang Quản trị (Admin)
 * Kết nối REST API Backend, quản trị độc giả, duyệt mượn trả, vẽ biểu đồ và cổng thanh toán.
 */

// Tự động đính kèm Token JWT vào tất cả các lượt fetch gọi từ trang Admin
const originalFetch = window.fetch;
window.fetch = function(...args) {
    let [url, options] = args;
    const token = sessionStorage.getItem('tvdn_auth_token');
    if (token) {
        options = options || {};
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
            options.headers.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(options.headers)) {
            options.headers.push(['Authorization', `Bearer ${token}`]);
        } else {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        args[1] = options;
    }
    return originalFetch(...args);
};

let borrowsByDayChart = null;
let borrowsByCategoryChart = null;
let activeSlipIdForPayment = null;
let activeFineAmountForPayment = 0;
let currentSettingsTab = 'info';
let currentBorrowTab = 'borrowing'; // borrowing, history

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Kiểm tra xác thực (Authentication Check) ===
    const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
    const token = sessionStorage.getItem('tvdn_auth_token');
    if (!loggedUser || loggedUser.role !== 'admin' || !token) {
        sessionStorage.removeItem('tvdn_logged_in_user');
        sessionStorage.removeItem('tvdn_auth_token');
        showAlert('Từ chối truy cập', 'Bạn không có quyền truy cập trang quản trị. Vui lòng đăng nhập tài khoản thủ thư!', 'error', () => {
            window.location.href = 'login.html';
        });
        return;
    }

    // Hiển thị thông tin người đăng nhập
    const adminFullname = document.getElementById('admin-fullname-display');
    const adminAvatar = document.getElementById('admin-avatar-letters');
    if (adminFullname && adminAvatar) {
        adminFullname.textContent = loggedUser.fullname;
        const letters = loggedUser.fullname.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
        adminAvatar.textContent = letters || 'AD';
    }

    // === 2. Định tuyến Menu Sidebar (Sidebar Routing) ===
    const menuItems = document.querySelectorAll('.sidebar-menu-item');
    const panels = document.querySelectorAll('.admin-panel');
    const pageTitleText = document.getElementById('page-title-text');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');

            panels.forEach(p => p.style.display = 'none');
            const targetPanel = document.getElementById(`panel-${view}`);
            if (targetPanel) {
                targetPanel.style.display = 'block';
            }

            // Cập nhật tiêu đề trang
            const labelMap = {
                readers: 'Sổ đọc giả',
                borrow: 'Quản lý mượn / trả',
                orders: 'Quản lý đơn hàng mua sách',
                stats: 'Thống kê & Báo cáo',
                settings: 'Cài đặt hệ thống'
            };
            if (pageTitleText) {
                pageTitleText.textContent = labelMap[view] || 'Quản trị';
            }

            // Kích hoạt load dữ liệu tương ứng
            if (view === 'readers') loadReaders();
            if (view === 'borrow') loadSlips();
            if (view === 'orders') loadOrders();
            if (view === 'stats') loadStats();
            if (view === 'settings') loadSettings();
        });
    });

    // === 3. Xử lý Tab cài đặt và tab phiếu mượn ===
    // Tab của phiếu mượn
    const borrowTabs = document.querySelectorAll('[data-slip-tab]');
    borrowTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            borrowTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentBorrowTab = tab.getAttribute('data-slip-tab');
            loadSlips();
        });
    });

    // Tab của cài đặt
    const settingsTabs = document.querySelectorAll('[data-settings-tab]');
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            settingsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentSettingsTab = tab.getAttribute('data-settings-tab');
            document.querySelectorAll('.settings-tab-panel').forEach(p => p.style.display = 'none');
            document.getElementById(`settings-${currentSettingsTab}`).style.display = 'block';
        });
    });

    // === 4. Khởi tạo dữ liệu trang đầu tiên ===
    loadReaders();

    // Sự kiện tìm kiếm độc giả
    const searchReaderInput = document.getElementById('search-reader-input');
    if (searchReaderInput) {
        searchReaderInput.addEventListener('input', loadReaders);
    }

    // Sự kiện tìm kiếm phiếu mượn
    const searchSlipInput = document.getElementById('search-slip-input');
    if (searchSlipInput) {
        searchSlipInput.addEventListener('input', loadSlips);
    }

    const filterSlipStatus = document.getElementById('filter-slip-status');
    if (filterSlipStatus) {
        filterSlipStatus.addEventListener('change', loadSlips);
    }

    // Form thông tin cài đặt
    const settingsInfoForm = document.getElementById('settings-info-form');
    if (settingsInfoForm) {
        settingsInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const config = {
                libraryName: document.getElementById('set-lib-name').value,
                address: document.getElementById('set-lib-address').value,
                phone: document.getElementById('set-lib-phone').value,
                email: document.getElementById('set-lib-email').value
            };
            
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Lưu thông tin cài đặt thư viện thành công!', 'success');
                }
            } catch (err) {
                showToast('Không cập nhật được cài đặt lên API server.', 'error');
            }
        });
    }

    // Form quy tắc mượn trả
    const settingsRulesForm = document.getElementById('settings-rules-form');
    if (settingsRulesForm) {
        settingsRulesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const config = {
                maxBorrowDays: parseInt(document.getElementById('set-max-days').value),
                maxBorrowBooks: parseInt(document.getElementById('set-max-books').value),
                overdueFinePerDay: parseInt(document.getElementById('set-fine-amount').value)
            };
            
            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Lưu quy định mượn trả thành công!', 'success');
                }
            } catch (err) {
                showToast('Không cập nhật được cài đặt lên API server.', 'error');
            }
        });
    }

    // Hộp thoại thêm độc giả
    const btnAddReaderTrigger = document.getElementById('btn-add-reader-trigger');
    const readerModal = document.getElementById('reader-modal');
    if (btnAddReaderTrigger && readerModal) {
        btnAddReaderTrigger.addEventListener('click', () => {
            openReaderModal();
        });
    }

    const readerForm = document.getElementById('reader-form');
    if (readerForm) {
        readerForm.addEventListener('submit', saveReader);
    }
});

// Đăng xuất admin
window.logoutAdmin = function() {
    showConfirm('Đăng xuất quản trị', 'Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị?', () => {
        sessionStorage.removeItem('tvdn_logged_in_user');
        window.location.href = 'login.html';
    });
};

// === PHÂN HỆ 1: SỔ ĐỌC GIẢ (READERS) ===
async function loadReaders() {
    const tableBody = document.getElementById('readers-table-body');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/readers');
        const readers = await res.json();
        
        const searchVal = document.getElementById('search-reader-input').value.toLowerCase().trim();
        tableBody.innerHTML = '';
        
        let filteredReaders = readers;

        if (searchVal) {
            filteredReaders = readers.filter(r => 
                r.fullname.toLowerCase().includes(searchVal) ||
                r.username.toLowerCase().includes(searchVal) ||
                r.cardId.toLowerCase().includes(searchVal) ||
                r.phone.includes(searchVal)
            );
        }

        // Cập nhật Metrics của Sổ đọc giả
        const totalReaders = readers.length;
        const activeReaders = readers.filter(r => r.status === 'active').length;
        const lockedReaders = readers.filter(r => r.status === 'locked').length;
        const newReadersThisMonth = readers.filter(r => !r.cardId.includes('TVDN-0001') && !r.cardId.includes('TVDN-0002')).length; // giả lập

        document.getElementById('metric-r-total').textContent = totalReaders;
        document.getElementById('metric-r-active').textContent = activeReaders;
        document.getElementById('metric-r-locked').textContent = lockedReaders;
        document.getElementById('metric-r-new').textContent = newReadersThisMonth;

        if (filteredReaders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Không tìm thấy độc giả nào phù hợp.</td></tr>`;
            return;
        }

        filteredReaders.forEach(r => {
            const statusBadgeClass = r.status === 'active' ? 'badge-success' : 'badge-danger';
            const statusText = r.status === 'active' ? 'Hoạt động' : 'Đang khóa';
            const lockActionText = r.status === 'active' ? 'Khóa thẻ' : 'Mở khóa';
            const lockActionIcon = r.status === 'active' ? 'fa-lock' : 'fa-lock-open';
            const lockActionColor = r.status === 'active' ? '#e11d48' : '#10b981';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${r.cardId}</strong></td>
                <td>${r.fullname}</td>
                <td><code>${r.username}</code></td>
                <td>${r.phone}</td>
                <td style="text-align: center;">${r.borrowCount || 0} cuốn</td>
                <td><span class="badge ${statusBadgeClass}">${statusText}</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="editReader('${r.username}')" style="color: var(--secondary-color); font-size: 0.9rem;" title="Sửa"><i class="fa-solid fa-pen-to-square"></i> Sửa</button>
                        <button onclick="toggleLockReader('${r.username}')" style="color: ${lockActionColor}; font-size: 0.9rem;" title="${lockActionText}"><i class="fa-solid ${lockActionIcon}"></i> ${lockActionText}</button>
                        <button onclick="deleteReader('${r.username}')" style="color: #ef4444; font-size: 0.9rem;" title="Xóa"><i class="fa-solid fa-trash"></i> Xóa</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Lỗi tải độc giả:', err);
    }
}

async function openReaderModal(username = '') {
    const modal = document.getElementById('reader-modal');
    const modalTitle = document.getElementById('reader-modal-title');
    const passGroup = document.getElementById('reader-pass-group');
    
    // Reset form
    document.getElementById('reader-form').reset();
    document.getElementById('reader-old-username').value = '';
    
    if (username) {
        modalTitle.textContent = 'Sửa thông tin độc giả';
        passGroup.style.display = 'none'; // Ẩn mật khẩu khi sửa
        document.getElementById('reader-username').disabled = true; // Không cho sửa username
        
        try {
            const res = await fetch('/api/readers');
            const readers = await res.json();
            const user = readers.find(u => u.username === username);
            if (user) {
                document.getElementById('reader-old-username').value = user.username;
                document.getElementById('reader-username').value = user.username;
                document.getElementById('reader-fullname').value = user.fullname;
                document.getElementById('reader-phone').value = user.phone;
                document.getElementById('reader-cardid').value = user.cardId;
            }
        } catch (err) {
            console.error('Lỗi lấy thông tin sửa:', err);
        }
    } else {
        modalTitle.textContent = 'Thêm độc giả mới';
        passGroup.style.display = 'flex';
        document.getElementById('reader-username').disabled = false;
    }
    
    modal.classList.add('active');
}

window.closeReaderModal = function() {
    document.getElementById('reader-modal').classList.remove('active');
};

async function saveReader(e) {
    e.preventDefault();
    const oldUsername = document.getElementById('reader-old-username').value;
    const fullname = document.getElementById('reader-fullname').value;
    const username = document.getElementById('reader-username').value.trim().toLowerCase();
    const phone = document.getElementById('reader-phone').value;
    const cardId = document.getElementById('reader-cardid').value.trim().toUpperCase();
    
    try {
        if (oldUsername) {
            // Chế độ Sửa
            const res = await fetch(`/api/readers/${oldUsername}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, phone, cardId })
            });
            const data = await res.json();
            if (data.success) showToast('Cập nhật thông tin độc giả thành công!', 'success');
        } else {
            // Chế độ Thêm mới
            const password = document.getElementById('reader-password').value || '123456';
            const res = await fetch('/api/readers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, fullname, phone, cardId })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Thêm độc giả mới thành công!', 'success');
            } else {
                showAlert('Lỗi thêm độc gia', data.message, 'error');
                return;
            }
        }
        
        closeReaderModal();
        loadReaders();
    } catch (err) {
        showToast('Lỗi kết nối API lưu độc giả.', 'error');
    }
}

window.editReader = function(username) {
    openReaderModal(username);
};

window.toggleLockReader = async function(username) {
    try {
        const res = await fetch(`/api/readers/${username}/toggle-lock`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
            loadReaders();
        }
    } catch (err) {
        console.error(err);
    }
};

window.deleteReader = async function(username) {
    showConfirm('Xóa độc giả', `Bạn có chắc chắn muốn xóa vĩnh viễn độc giả: "${username}"?`, async () => {
        try {
            const res = await fetch(`/api/readers/${username}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Đã xóa độc giả thành công!', 'success');
                loadReaders();
            }
        } catch (err) {
            showToast('Lỗi kết nối API khi xóa độc giả.', 'error');
        }
    });
};

// === PHÂN HỆ 2: QUẢN LÝ MƯỢN TRẢ (BORROW/RETURN) ===
async function loadSlips() {
    const tableBody = document.getElementById('slips-table-body');
    const countIndicator = document.getElementById('slip-count-indicator');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/slips');
        const slips = await res.json();
        
        const searchVal = document.getElementById('search-slip-input').value.toLowerCase().trim();
        const statusVal = document.getElementById('filter-slip-status').value;
        
        tableBody.innerHTML = '';
        let filteredSlips = slips;

        // 1. Phân loại theo Tabs (Đang mượn vs Lịch sử)
        if (currentBorrowTab === 'borrowing') {
            filteredSlips = slips.filter(s => s.status === 'borrowing' || s.status === 'overdue');
        } else {
            filteredSlips = slips.filter(s => s.status === 'returned');
        }

        // 2. Lọc theo search input
        if (searchVal) {
            filteredSlips = filteredSlips.filter(s => 
                s.id.toLowerCase().includes(searchVal) ||
                s.fullname.toLowerCase().includes(searchVal) ||
                s.bookTitle.toLowerCase().includes(searchVal)
            );
        }

        // 3. Lọc theo trạng thái status dropdown
        if (statusVal !== 'all') {
            filteredSlips = filteredSlips.filter(s => s.status === statusVal);
        }

        if (countIndicator) {
            countIndicator.textContent = filteredSlips.length;
        }

        if (filteredSlips.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Không có phiếu mượn nào phù hợp.</td></tr>`;
            return;
        }

        filteredSlips.forEach(s => {
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
            tr.setAttribute('onclick', `selectSlipRow('${s.id}')`);
            tr.innerHTML = `
                <td><strong>${s.id}</strong></td>
                <td>${s.fullname}</td>
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
        console.error('Lỗi tải phiếu mượn:', err);
    }
}

window.selectSlipRow = async function(slipId) {
    const detailSec = document.getElementById('borrow-detail-section');
    if (!detailSec) return;

    try {
        const res = await fetch('/api/slips');
        const slips = await res.json();
        const slip = slips.find(s => s.id === slipId);
        
        if (!slip) return;

        detailSec.style.display = 'block';

        document.getElementById('detail-slip-id').textContent = slip.id;
        document.getElementById('detail-fullname').textContent = slip.fullname;
        document.getElementById('detail-card-id').textContent = slip.cardId;
        document.getElementById('detail-book-title').textContent = slip.bookTitle;
        document.getElementById('detail-borrow-date').textContent = slip.borrowDate;
        document.getElementById('detail-due-date').textContent = slip.dueDate;
        document.getElementById('detail-return-date').textContent = slip.returnDate || '-';
        
        const fineText = slip.fineAmount > 0 
            ? `${slip.fineAmount.toLocaleString()}đ (${slip.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'})` 
            : '0đ';
        document.getElementById('detail-fine-amount').textContent = fineText;
        document.getElementById('detail-fine-amount').style.color = slip.fineAmount > 0 && slip.paymentStatus === 'unpaid' ? '#ef4444' : '#1e293b';

        // Đổ các nút hành động tương ứng với trạng thái
        const actionsRow = document.getElementById('detail-actions-row');
        actionsRow.innerHTML = '';

        if (slip.status === 'borrowing' || slip.status === 'overdue') {
            // Nút Trả sách
            actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:#10b981;" onclick="returnBookAction('${slip.id}')"><i class="fa-solid fa-circle-check"></i> Xác nhận trả sách</button>`;
            // Nút Gia hạn
            actionsRow.innerHTML += `<button class="btn-login" style="border-color:var(--accent-color); color:var(--accent-dark);" onclick="renewBookAction('${slip.id}')"><i class="fa-solid fa-calendar-plus"></i> Gia hạn 14 ngày</button>`;
        } else if (slip.status === 'returned' && slip.fineAmount > 0 && slip.paymentStatus === 'unpaid') {
            // Nếu đã trả nhưng còn nợ tiền phạt
            actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:var(--accent-dark);" onclick="openPaymentModal('${slip.id}', ${slip.fineAmount})"><i class="fa-solid fa-credit-card"></i> Thu tiền phạt quá hạn</button>`;
        }
    } catch (err) {
        console.error(err);
    }
};

window.returnBookAction = async function(slipId) {
    try {
        const res = await fetch(`/api/slips/${slipId}/return`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            if (data.fineAmount > 0) {
                showAlert('Trả sách trễ hạn', `Trả sách thành công!\nPhiếu mượn trễ hạn. Tiền phạt phát sinh: ${data.fineAmount.toLocaleString()}đ.\n\nHướng dẫn độc giả quét mã thanh toán để đóng phạt.`, 'warning');
            } else {
                showToast('Xác nhận trả sách trúng hạn thành công!', 'success');
            }
            loadSlips();
            selectSlipRow(slipId);
        }
    } catch (err) {
        showToast('Lỗi kết nối API khi trả sách.', 'error');
    }
};

window.renewBookAction = async function(slipId) {
    try {
        const res = await fetch(`/api/slips/${slipId}/renew`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            showAlert('Gia hạn thành công', `Gia hạn phiếu mượn thành công!\nHạn trả mới là: ${data.newDueDate}`, 'success');
            loadSlips();
            selectSlipRow(slipId);
        }
    } catch (err) {
        showToast('Lỗi kết nối API khi gia hạn sách.', 'error');
    }
};

// === PHÂN HỆ 3: THỐNG KÊ & BIỂU ĐỒ (STATISTICS & CHARTS) ===
async function loadStats() {
    try {
        const resBooks = await fetch('/api/books');
        const books = await resBooks.json();
        
        const resSlips = await fetch('/api/slips');
        const slips = await resSlips.json();
        
        const resReaders = await fetch('/api/readers');
        const readers = await resReaders.json();

        // 1. Load Metric Widgets
        document.getElementById('metric-s-books').textContent = books.length;
        document.getElementById('metric-s-borrows').textContent = slips.length;
        document.getElementById('metric-s-readers').textContent = readers.length;
        document.getElementById('metric-s-overdue').textContent = slips.filter(s => s.status === 'overdue').length;

        // 2. Load Top tables
        // Top sách
        const bookBorrowCounts = {};
        slips.forEach(s => {
            bookBorrowCounts[s.bookId] = (bookBorrowCounts[s.bookId] || 0) + 1;
        });

        const topBooksList = document.getElementById('top-books-list');
        topBooksList.innerHTML = '';
        
        const sortedBooks = [...books].sort((a,b) => (bookBorrowCounts[b.id] || 0) - (bookBorrowCounts[a.id] || 0)).slice(0, 3);
        sortedBooks.forEach((b, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${index + 1}</strong></td>
                <td>${b.title}</td>
                <td>${b.categoryName}</td>
                <td style="text-align: right; font-weight: 700;">${bookBorrowCounts[b.id] || 0} lượt</td>
            `;
            topBooksList.appendChild(tr);
        });

        // Top độc giả
        const readerBorrowCounts = {};
        slips.forEach(s => {
            readerBorrowCounts[s.username] = (readerBorrowCounts[s.username] || 0) + 1;
        });
        
        const topReadersList = document.getElementById('top-readers-list');
        topReadersList.innerHTML = '';
        
        const sortedReaders = [...readers].sort((a,b) => (readerBorrowCounts[b.username] || 0) - (readerBorrowCounts[a.username] || 0)).slice(0, 3);
        sortedReaders.forEach((r, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${index + 1}</strong></td>
                <td>${r.fullname}</td>
                <td><code>${r.cardId}</code></td>
                <td style="text-align: right; font-weight: 700;">${readerBorrowCounts[r.username] || 0} lượt</td>
            `;
            topReadersList.appendChild(tr);
        });

        // 3. Render Chart.js
        renderCharts(slips, books);
    } catch (err) {
        console.error('Lỗi tải thống kê báo cáo:', err);
    }
}

function renderCharts(slips, books) {
    if (borrowsByDayChart) borrowsByDayChart.destroy();
    if (borrowsByCategoryChart) borrowsByCategoryChart.destroy();

    // --- BIỂU ĐỒ 1: LƯỢT MƯỢN THEO NGÀY ---
    const daysLabel = [];
    const daysData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const parts = dayStr.split('-');
        daysLabel.push(`${parts[2]}/${parts[1]}`);

        const count = slips.filter(s => s.borrowDate === dayStr).length;
        daysData.push(count);
    }

    const ctxDay = document.getElementById('chart-borrows-by-day').getContext('2d');
    borrowsByDayChart = new Chart(ctxDay, {
        type: 'line',
        data: {
            labels: daysLabel,
            datasets: [{
                label: 'Số lượt mượn',
                data: daysData,
                borderColor: '#1E6B7B',
                backgroundColor: 'rgba(30, 107, 123, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // --- BIỂU ĐỒ 2: LƯỢT MƯỢN THEO THỂ LOẠI ---
    const categoriesMap = {
        ai: { name: 'Công nghệ', count: 0 },
        history: { name: 'Lịch sử', count: 0 },
        skills: { name: 'Kỹ năng', count: 0 },
        literature: { name: 'Văn học', count: 0 },
        economy: { name: 'Kinh tế', count: 0 }
    };

    slips.forEach(s => {
        const book = books.find(b => b.id === s.bookId);
        if (book && categoriesMap[book.category]) {
            categoriesMap[book.category].count += 1;
        }
    });

    const categoryLabels = Object.values(categoriesMap).map(c => c.name);
    const categoryData = Object.values(categoriesMap).map(c => c.count);

    const ctxCat = document.getElementById('chart-borrows-by-category').getContext('2d');
    borrowsByCategoryChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryData,
                backgroundColor: ['#112E51', '#1E6B7B', '#d4a359', '#10b981', '#fbbf24']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
    });
}

// === PHÂN HỆ 4: CÀI ĐẶT & SAO LƯU JSON (SETTINGS) ===
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        // Điền form thông tin
        document.getElementById('set-lib-name').value = settings.libraryName || '';
        document.getElementById('set-lib-address').value = settings.address || '';
        document.getElementById('set-lib-phone').value = settings.phone || '';
        document.getElementById('set-lib-email').value = settings.email || '';

        // Điền quy định
        document.getElementById('set-max-days').value = settings.maxBorrowDays || 14;
        document.getElementById('set-max-books').value = settings.maxBorrowBooks || 5;
        document.getElementById('set-fine-amount').value = settings.overdueFinePerDay || 5000;
    } catch (err) {
        console.error('Lỗi lấy cài đặt:', err);
    }
}

// Sao lưu toàn bộ Database SQLite sang file JSON
window.backupDatabaseJSON = async function() {
    try {
        const res = await fetch('/api/backup');
        const dataBackup = await res.json();

        const jsonStr = JSON.stringify(dataBackup, null, 4);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'thuvien_danang_database_sqlite.json';
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        showAlert('Lỗi sao lưu', 'Lỗi xuất tệp sao lưu từ server: ' + err.message, 'error');
    }
};

// Khôi phục Database từ tệp tin JSON tải lên
window.restoreDatabaseJSON = function() {
    const fileInput = document.getElementById('restore-file-input');
    if (!fileInput || !fileInput.files[0]) {
        showToast('Vui lòng chọn tệp tin JSON đã sao lưu trước!', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const restoredData = JSON.parse(e.target.result);
            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(restoredData)
            });
            const data = await res.json();
            
            if (data.success) {
                showAlert('Khôi phục thành công', 'Khôi phục cơ sở dữ liệu SQLite thành công! Trang quản trị sẽ tải lại.', 'success', () => {
                    window.location.reload();
                });
            } else {
                showAlert('Khôi phục thất bại', data.message, 'error');
            }
        } catch (err) {
            showAlert('Lỗi khôi phục', 'Lỗi đọc tệp tin sao lưu: ' + err.message, 'error');
        }
    };

    reader.readAsText(file);
};

// === PHÂN HỆ 5: THANH TOÁN (PAYMENT REAL INTEGRATION MOCK) ===
window.openPaymentModal = function(slipId, amount) {
    activeSlipIdForPayment = slipId;
    activeFineAmountForPayment = amount;

    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    document.getElementById('pay-slip-id').textContent = slipId;
    document.getElementById('pay-amount-label').textContent = `${amount.toLocaleString()}đ`;

    selectPaymentMethod('bank'); // Mặc định VietQR
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
        qrImg.src = ''; // Clear old qr
        payInstructions.innerHTML = 'Đang kết nối API VietQR để tạo mã thanh toán ngân hàng...';
        
        try {
            // Lấy VietQR config thật từ server (.env)
            const res = await fetch('/api/payment/vietqr-config');
            const config = await res.json();
            
            const formattedInfo = encodeURIComponent(`TVDN PHAT ${activeSlipIdForPayment}`);
            // Đổ link QR code Napas VietQR thật
            qrImg.src = `https://img.vietqr.io/image/${config.bankId}-${config.accountNumber}-compact2.png?amount=${activeFineAmountForPayment}&addInfo=${formattedInfo}&accountName=${encodeURIComponent(config.accountName)}`;
            payInstructions.innerHTML = `Mở app SmartBanking ngân hàng bất kỳ, quét mã VietQR ở trên để chuyển khoản tự động. Tài khoản nhận: **${config.bankId} - ${config.accountNumber}** (${config.accountName}).`;
        } catch (err) {
            payInstructions.innerHTML = 'Lỗi kết nối VietQR API.';
        }
    } else {
        btnMomo.classList.add('active');
        qrImg.src = '';
        payInstructions.innerHTML = 'Đang gọi API cổng thanh toán MoMo...';
        
        try {
            const res = await fetch('/api/payment/momo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slipId: activeSlipIdForPayment, amount: activeFineAmountForPayment })
            });
            const data = await res.json();
            
            if (data.success) {
                qrImg.src = data.payUrl;
                if (data.isMock) {
                    payInstructions.innerHTML = 'Mở ứng dụng Ví MoMo trên điện thoại, quét mã QR MoMo ở trên để thanh toán (Phiên bản chạy thử nghiệm Sandbox).';
                } else {
                    payInstructions.innerHTML = 'Cổng MoMo chính thức đã phản hồi thành công! Bạn có thể nhấp <a href="' + data.payUrl + '" target="_blank" style="color:var(--accent-dark); font-weight:700;">vào đây</a> để mở trang thanh toán Ví MoMo trên tab mới.';
                }
            } else {
                payInstructions.innerHTML = 'API MoMo lỗi: ' + data.message;
            }
        } catch (err) {
            payInstructions.innerHTML = 'Lỗi kết nối cổng thanh toán MoMo.';
        }
    }
};

// Xác nhận thanh toán thủ công (Simulate confirm)
window.confirmPaymentSimulate = async function() {
    try {
        const res = await fetch('/api/payment/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slipId: activeSlipIdForPayment })
        });
        const data = await res.json();
        
        if (data.success) {
            showAlert('Thanh toán thành công', `Đã xác nhận thanh toán phí phạt cho phiếu mượn: ${activeSlipIdForPayment}.\n\nTrạng thái phiếu đã được cập nhật thành ĐÃ ĐÓNG PHẠT.`, 'success');
            closePaymentModal();
            loadSlips();
            selectSlipRow(activeSlipIdForPayment);
        }
    } catch (err) {
        showToast('Lỗi kết nối API xác nhận thanh toán.', 'error');
    }
};

// === PHÂN HỆ 6: QUẢN LÝ ĐƠN HÀNG MUA SÁCH (ORDERS) ===
async function loadOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();

        const searchVal = document.getElementById('search-order-input').value.toLowerCase().trim();
        tableBody.innerHTML = '';

        let filteredOrders = orders;
        if (searchVal) {
            filteredOrders = orders.filter(o => 
                o.id.toLowerCase().includes(searchVal) ||
                o.fullname.toLowerCase().includes(searchVal)
            );
        }

        // Cập nhật Metrics của Đơn hàng
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const shippingOrders = orders.filter(o => o.status === 'shipping').length;
        const revenue = orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);

        document.getElementById('metric-o-total').textContent = totalOrders;
        document.getElementById('metric-o-pending').textContent = pendingOrders;
        document.getElementById('metric-o-shipping').textContent = shippingOrders;
        document.getElementById('metric-o-revenue').textContent = revenue.toLocaleString() + 'đ';

        if (filteredOrders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Không có đơn hàng nào phù hợp.</td></tr>`;
            return;
        }

        filteredOrders.forEach(o => {
            let payBadgeClass = o.paymentStatus === 'paid' ? 'badge-success' : 'badge-danger';
            let payText = o.paymentStatus === 'paid' ? 'Đã thu' : 'Chưa thu';

            let shipBadgeClass = 'badge-pending';
            let shipText = 'Chờ xử lý';
            if (o.status === 'paid') {
                shipBadgeClass = 'badge-paid';
                shipText = 'Đã duyệt';
            } else if (o.status === 'shipping') {
                shipBadgeClass = 'badge-shipping';
                shipText = 'Đang giao';
            } else if (o.status === 'completed') {
                shipBadgeClass = 'badge-completed';
                shipText = 'Đã giao xong';
            }

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.setAttribute('onclick', `selectOrderRow('${o.id}')`);
            tr.innerHTML = `
                <td><strong>${o.id}</strong></td>
                <td>${o.fullname}</td>
                <td>${o.orderDate}</td>
                <td><strong>${o.totalAmount.toLocaleString()}đ</strong></td>
                <td><span class="badge ${payBadgeClass}">${payText}</span></td>
                <td><span class="badge ${shipBadgeClass}">${shipText}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Lỗi tải đơn hàng:', err);
    }
}

window.selectOrderRow = async function(orderId) {
    const detailSec = document.getElementById('order-detail-section');
    if (!detailSec) return;

    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        const order = orders.find(o => o.id === orderId);

        if (!order) return;

        detailSec.style.display = 'block';

        document.getElementById('detail-order-id').textContent = order.id;
        document.getElementById('detail-order-name').textContent = order.fullname;
        document.getElementById('detail-order-phone').textContent = order.phone;
        document.getElementById('detail-order-address').textContent = order.address;
        document.getElementById('detail-order-date').textContent = order.orderDate;
        document.getElementById('detail-order-amount').textContent = order.totalAmount.toLocaleString() + 'đ';

        // Hiển thị mặt hàng đã mua
        const itemsDiv = document.getElementById('detail-order-items');
        itemsDiv.innerHTML = order.items.map(it => `• ${it.bookTitle} (x${it.quantity}) - Đơn giá: ${it.price.toLocaleString()}đ`).join('<br>');

        // Tạo các nút hành động cho thủ thư
        const actionsRow = document.getElementById('order-action-buttons');
        actionsRow.innerHTML = '';

        if (order.status === 'pending') {
            actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:#10b981;" onclick="updateOrderStatus('${order.id}', 'paid')"><i class="fa-solid fa-credit-card"></i> Duyệt Đã Thanh Toán</button>`;
            actionsRow.innerHTML += `<button class="btn-login" style="border-color:#fca5a5; color:#e11d48; background-color:#fff1f2;" onclick="updateOrderStatus('${order.id}', 'cancelled')"><i class="fa-solid fa-xmark"></i> Hủy đơn hàng</button>`;
        } else if (order.status === 'paid') {
            actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:#2563eb;" onclick="updateOrderStatus('${order.id}', 'shipping')"><i class="fa-solid fa-truck-fast"></i> Bắt đầu giao hàng</button>`;
        } else if (order.status === 'shipping') {
            actionsRow.innerHTML += `<button class="btn-search-submit" style="background-color:#16a34a;" onclick="updateOrderStatus('${order.id}', 'completed')"><i class="fa-solid fa-circle-check"></i> Xác nhận hoàn thành giao</button>`;
        } else {
            actionsRow.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;"><i class="fa-solid fa-circle-info"></i> Đơn hàng đã kết thúc ở trạng thái: ${order.status.toUpperCase()}</span>`;
        }
    } catch (err) {
        console.error(err);
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('Cập nhật trạng thái đơn hàng thành công!', 'success');
            loadOrders();
            selectOrderRow(orderId);
        } else {
            showAlert('Lỗi cập nhật', data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối máy chủ khi cập nhật đơn hàng.', 'error');
    }
};

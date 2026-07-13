/**
 * Thư viện Đà Nẵng - Script Interactivity v3.1
 * Đã cập nhật cho layout Sidebar Dashboard mới.
 * Xử lý: Auth, Book Grid, Cart, Chatbot, Modals, Borrow.
 */

// ========================= HELPERS (GLOBAL) =========================

// ========================= GLOBAL STATE =========================
let cart = JSON.parse(sessionStorage.getItem('tvdn_shopping_cart')) || [];
window.cart = cart;

window.updateCartBadgeCount = function() {
    const count = window.cart.reduce((sum, item) => sum + item.quantity, 0);
    // Support cả id mới (topbar badge) lẫn id cũ
    const badge = document.getElementById('cart-count-badge') || document.getElementById('cart-badge-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
};

// ========================= LOGIN MODAL =========================

window.openLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.add('active');
    } else {
        window.location.href = 'login.html';
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
};

// Close modal on overlay click
document.addEventListener('click', function(e) {
    if (e.target.id === 'login-modal') closeLoginModal();
    if (e.target.id === 'borrow-modal') closeBorrowModal();
    if (e.target.id === 'cart-modal') closeCartModal();
    if (e.target.id === 'book-detail-modal') closeBookDetailModal();
});

// ========================= AUTH UI SYNC =========================

window.updateUIForLoggedUser = function() {
    const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));

    // --- Topbar Actions Unified ---
    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions) {
        if (loggedUser) {
            const adminBtn = loggedUser.role === 'admin' ? `<button class="topbar-login-btn" onclick="window.location.href='admin.html'" style="margin-right:8px; border:1px solid var(--teal); color:var(--teal); background:rgba(30,107,123,0.1);"><i class="fa-solid fa-gauge-high"></i> Quản trị</button>` : '';
            topbarActions.innerHTML = `
                <div style="position:relative; display:inline-block;">
                    <button class="topbar-icon-btn" title="Thông báo" id="btn-notify">
                        <i class="fa-regular fa-bell"></i><span class="topbar-badge" id="notify-badge" style="display:flex;">3</span>
                    </button>
                    <!-- Notification Dropdown -->
                    <div class="notify-dropdown" id="notify-dropdown">
                        <div class="notify-header">
                            <span>Thông báo mới</span>
                            <span style="font-size:0.75rem;color:var(--teal);cursor:pointer;" onclick="markAllNotificationsRead(event)">Đánh dấu đã đọc</span>
                        </div>
                        <div class="notify-list" id="notify-list">
                            <div class="notify-item unread" onclick="handleNotificationClick('notify-1')">
                                <div class="notify-item-icon ni-info"><i class="fa-solid fa-circle-info"></i></div>
                                <div class="notify-item-content">
                                    <span class="notify-item-title">Nhắc nhở trả sách</span>
                                    <span class="notify-item-desc">Cuốn sách "Lịch Sử Đà Nẵng" của bạn đã quá hạn 14 ngày.</span>
                                    <span class="notify-item-time">10 phút trước</span>
                                </div>
                            </div>
                            <div class="notify-item unread" onclick="handleNotificationClick('notify-2')">
                                <div class="notify-item-icon ni-success"><i class="fa-solid fa-circle-check"></i></div>
                                <div class="notify-item-content">
                                    <span class="notify-item-title">Mượn sách thành công</span>
                                    <span class="notify-item-desc">Phiếu mượn slip-1003 cho cuốn "Mắt Biếc" đã được phê duyệt.</span>
                                    <span class="notify-item-time">2 giờ trước</span>
                                </div>
                            </div>
                            <div class="notify-item" onclick="handleNotificationClick('notify-3')">
                                <div class="notify-item-icon ni-warning"><i class="fa-solid fa-triangle-exclamation"></i></div>
                                <div class="notify-item-content">
                                    <span class="notify-item-title">Cảnh báo hệ thống</span>
                                    <span class="notify-item-desc">Cổng thanh toán MoMo đang bảo trì từ 2:00 - 4:00.</span>
                                    <span class="notify-item-time">1 ngày trước</span>
                                </div>
                            </div>
                        </div>
                        <div class="notify-footer">
                            <a href="profile.html">Xem tất cả thông báo</a>
                        </div>
                    </div>
                </div>
                <button class="topbar-icon-btn" id="btn-cart-trigger" title="Giỏ hàng" onclick="typeof openCartModal === 'function' ? openCartModal() : window.location.href='index.html?openCart=true'">
                    <i class="fa-solid fa-cart-shopping"></i><span class="topbar-badge" id="cart-count-badge" style="display:none;">0</span>
                </button>
                ${adminBtn}
                <button class="topbar-login-btn" onclick="window.location.href='profile.html'" style="margin-right:8px;">
                    <i class="fa-regular fa-circle-user"></i> ${loggedUser.fullname.split(' ').pop()}
                </button>
                <button class="topbar-login-btn" id="btn-logout" style="border:1px solid #fca5a5; color:#e11d48; background-color:#fff1f2;">
                    <i class="fa-solid fa-right-from-bracket"></i> Thoát
                </button>
            `;
            const logoutBtn = document.getElementById('btn-logout');
            if(logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    sessionStorage.removeItem('tvdn_logged_in_user');
                    sessionStorage.removeItem('tvdn_auth_token');
                    window.location.href = 'index.html';
                });
            }
        } else {
            topbarActions.innerHTML = `
                <div style="position:relative; display:inline-block;">
                    <button class="topbar-icon-btn" title="Thông báo" id="btn-notify">
                        <i class="fa-regular fa-bell"></i><span class="topbar-badge" id="notify-badge" style="display:flex;">1</span>
                    </button>
                    <!-- Notification Dropdown for Guest -->
                    <div class="notify-dropdown" id="notify-dropdown">
                        <div class="notify-header">
                            <span>Thông báo</span>
                        </div>
                        <div class="notify-list">
                            <div class="notify-item unread" onclick="openLoginModal()">
                                <div class="notify-item-icon ni-info"><i class="fa-solid fa-circle-info"></i></div>
                                <div class="notify-item-content">
                                    <span class="notify-item-title">Chào mừng bạn đọc mới!</span>
                                    <span class="notify-item-desc">Đăng nhập tài khoản để mượn sách miễn phí và đọc E-book trực tuyến.</span>
                                    <span class="notify-item-time">Vừa xong</span>
                                </div>
                            </div>
                        </div>
                        <div class="notify-footer">
                            <a href="#" onclick="openLoginModal(); return false;">Đăng nhập ngay</a>
                        </div>
                    </div>
                </div>
                <button class="topbar-login-btn" id="btn-login-topbar" onclick="typeof openLoginModal === 'function' ? openLoginModal() : window.location.href='login.html'">
                    <i class="fa-regular fa-circle-user"></i> Đăng nhập
                </button>
            `;
        }
    }

    // --- Sidebar user widget ---
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRole = document.getElementById('sidebar-user-role');
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarBtn = document.getElementById('sidebar-user-btn');

    if (loggedUser) {
        if (sidebarName) sidebarName.textContent = loggedUser.fullname;
        if (sidebarRole) sidebarRole.textContent = loggedUser.role === 'admin' ? '⚙️ Quản trị viên' : '📚 Bạn đọc';
        if (sidebarAvatar) sidebarAvatar.innerHTML = `<span style="font-size:0.75rem;font-weight:800;">${loggedUser.fullname.charAt(loggedUser.fullname.lastIndexOf(' ')+1)}</span>`;
        if (sidebarBtn) {
            sidebarBtn.removeAttribute('onclick');
            sidebarBtn.onclick = (e) => {
                e.preventDefault();
                window.location.href = 'profile.html';
            };
        }
    } else {
        if (sidebarName) sidebarName.textContent = 'Đăng nhập';
        if (sidebarRole) sidebarRole.textContent = 'Bạn chưa đăng nhập';
        if (sidebarBtn) {
            sidebarBtn.removeAttribute('onclick');
            sidebarBtn.onclick = (e) => {
                e.preventDefault();
                openLoginModal();
            };
        }
    }

    // --- Cart badge ---
    updateCartBadgeCount();
};

// ========================= MAIN DOMContentLoaded =========================
document.addEventListener('DOMContentLoaded', () => {

    // Cập nhật UI auth
    updateUIForLoggedUser();

    // Toggle notification dropdown (event delegation)
    document.addEventListener('click', (e) => {
        const notifyBtn = document.getElementById('btn-notify');
        const notifyDropdown = document.getElementById('notify-dropdown');
        if (!notifyBtn || !notifyDropdown) return;

        // If clicked the bell button or a child of the bell button
        if (notifyBtn.contains(e.target)) {
            e.stopPropagation();
            notifyDropdown.classList.toggle('active');
        } else if (!notifyDropdown.contains(e.target)) {
            notifyDropdown.classList.remove('active');
        }
    });

    window.markAllNotificationsRead = function(e) {
        if (e) e.stopPropagation();
        const badge = document.getElementById('notify-badge');
        if (badge) badge.style.display = 'none';
        document.querySelectorAll('.notify-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        showToast('Đã đánh dấu đọc tất cả thông báo.', 'success');
    };

    window.handleNotificationClick = function(id) {
        showToast('Đang mở chi tiết thông báo...', 'info');
    };

    // === BOOK GRID RENDERING ===
    const bookGrid = document.getElementById('book-grid');

    // Biến state filter
    let currentPage = 1;
    const itemsPerPage = 12;
    let allBooks = [];
    let currentGenre = 'all';
    let showAvailableOnly = false;

    async function loadBooks() {
        if (!bookGrid) return;

        try {
            const res = await fetch('/api/books');
            allBooks = await res.json();
            renderBooks();
        } catch (err) {
            console.error('Lỗi tải sách:', err);
            if (bookGrid) bookGrid.innerHTML = `
                <div style="text-align:center;grid-column:1/-1;padding:48px;color:#ef4444;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
                    <p style="font-weight:600;">Không kết nối được tới máy chủ API Thư viện.</p>
                    <p style="font-size:0.83rem;color:#94a3b8;margin-top:6px;">Vui lòng bật server.js hoặc deploy ứng dụng!</p>
                </div>
            `;
        }
    }

    window.renderBooks = function() {
        if (!bookGrid) return;

        // Lọc theo genre
        let filtered = allBooks;
        if (currentGenre !== 'all') {
            filtered = filtered.filter(b => b.categoryName === currentGenre || b.category === currentGenre);
        }

        // Lọc theo còn sách
        if (showAvailableOnly) {
            filtered = filtered.filter(b => b.status !== 'borrowed' && b.quantity > 0);
        }

        // Tìm kiếm text từ topbar
        const searchInput = document.getElementById('search-input');
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (q) {
            filtered = filtered.filter(b =>
                b.title.toLowerCase().includes(q) ||
                b.author.toLowerCase().includes(q) ||
                (b.categoryName && b.categoryName.toLowerCase().includes(q))
            );
        }

        // Phân trang
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = 1;
        const start = (currentPage - 1) * itemsPerPage;
        const pageBooks = filtered.slice(start, start + itemsPerPage);

        // Cập nhật label
        const countLabel = document.getElementById('book-count-label');
        if (countLabel) countLabel.textContent = `${filtered.length} cuốn sách`;

        // Render cards
        bookGrid.innerHTML = '';
        if (pageBooks.length === 0) {
            bookGrid.innerHTML = `
                <div style="text-align:center;grid-column:1/-1;padding:48px;color:var(--text-muted);">
                    <i class="fa-solid fa-book-open" style="font-size:2.5rem;margin-bottom:12px;display:block;color:#cbd5e1;"></i>
                    <p style="font-weight:600;font-size:1rem;color:var(--navy);">Không tìm thấy sách phù hợp</p>
                    <p style="font-size:0.83rem;margin-top:4px;">Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm khác.</p>
                </div>
            `;
            renderPagination(0);
            return;
        }

        pageBooks.forEach(b => {
            let statusText = 'Còn sách';
            let statusClass = 'status-available';
            let actionBtns = '';

            if (b.status === 'digital') {
                statusText = 'E-Book';
                statusClass = 'status-digital';
                actionBtns = `
                    <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                    <button class="btn-action-borrow" onclick="showToast('Đang tải tệp Ebook PDF!', 'info')"><i class="fa-solid fa-download"></i> Tải PDF</button>
                `;
            } else if (b.status === 'borrowed' || b.quantity <= 0) {
                statusText = 'Đang mượn';
                statusClass = 'status-borrowed';
                actionBtns = `
                    <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                    <button class="btn-action-borrow disabled" disabled><i class="fa-solid fa-clock"></i> Hết sách giấy</button>
                `;
            } else {
                actionBtns = `
                    <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                    <button class="btn-action-borrow" onclick="borrowBook('${b.id}', '${b.title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-book-open"></i> Đăng ký mượn</button>
                `;
                if (b.price > 0) {
                    actionBtns += `<button class="btn-action-borrow" style="background:var(--gold);color:var(--navy-dark);" onclick="addToCart('${b.id}')"><i class="fa-solid fa-cart-plus"></i> Chọn mua</button>`;
                }
            }

            const coverHtml = b.coverUrl
                ? `<img src="${b.coverUrl}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;display:block;">`
                : `<div class="book-cover-mock ${b.coverGradient || 'cover-gradient-1'}">
                       <div class="cover-accent-line"></div>
                       <div class="cover-content">
                           <h3 class="cover-book-title">${b.title.toUpperCase()}</h3>
                           <p class="cover-book-sub">${b.author}</p>
                       </div>
                   </div>`;

            const priceTag = b.price > 0
                ? `<div class="book-price-tag">${b.price.toLocaleString()}đ</div>`
                : `<div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">Mượn miễn phí</div>`;

            const card = document.createElement('div');
            card.className = 'book-card';
            card.setAttribute('data-category', b.category);
            card.innerHTML = `
                <div class="book-card-cover-wrapper">
                    ${coverHtml}
                    <span class="badge-status ${statusClass}">${statusText}</span>
                    <div class="book-card-hover-overlay">${actionBtns}</div>
                </div>
                <div class="book-card-info">
                    <span class="book-genre">${b.categoryName || ''}</span>
                    <h3 class="book-title" title="${b.title}">${b.title}</h3>
                    <p class="book-author">${b.author}</p>
                    ${priceTag}
                    <div class="book-rating">
                        <div class="stars">
                            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                            <i class="fa-solid fa-star-half-stroke"></i>
                        </div>
                        <span class="rating-text">(${b.rating || '4.5'})</span>
                    </div>
                </div>
            `;
            bookGrid.appendChild(card);
        });

        renderPagination(totalPages);
    };

    window.filterBooksByGenre = function(genre) {
        currentGenre = genre;
        currentPage = 1;
        renderBooks();
    };

    // Filter chips genre
    document.querySelectorAll('.filter-chip[data-genre]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip[data-genre]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterBooksByGenre(chip.dataset.genre);
        });
    });

    // "Còn sách" toggle
    const availableChip = document.getElementById('filter-available-only');
    if (availableChip) {
        availableChip.addEventListener('click', function() {
            showAvailableOnly = !showAvailableOnly;
            this.classList.toggle('active', showAvailableOnly);
            currentPage = 1;
            renderBooks();
        });
    }

    // Tìm kiếm topbar (nếu đang ở trang index)
    const searchInput = document.getElementById('search-input');
    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            const q = searchInput ? searchInput.value.trim() : '';
            if (q && !bookGrid) {
                window.location.href = `search.html?q=${encodeURIComponent(q)}`;
            } else {
                renderBooks();
            }
        });
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') btnSearch && btnSearch.click();
        });
    }

    function renderPagination(totalPages) {
        const wrapper = document.getElementById('pagination-wrapper');
        // Support cả id cũ lẫn mới
        const paginationEl = wrapper || document.getElementById('homepage-pagination');
        if (!paginationEl) return;
        paginationEl.innerHTML = '';
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
        paginationEl.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${currentPage === i ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => { currentPage = i; renderBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
            paginationEl.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
        paginationEl.appendChild(nextBtn);
    }

    loadBooks();

    // === SHOPPING CART ===
    updateCartBadgeCount();

    window.addToCart = async function(bookId) {
        const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (!loggedUser) {
            showToast('Vui lòng đăng nhập để sử dụng tính năng giỏ hàng!', 'warning');
            if (typeof openLoginModal === 'function') openLoginModal();
            return;
        }
        try {
            const res = await fetch('/api/books');
            const books = await res.json();
            const book = books.find(b => b.id === bookId);

            if (!book || book.price <= 0) { showToast('Cuốn sách này không bán.', 'warning'); return; }

            const existing = cart.find(i => i.bookId === bookId);
            if (existing) {
                if (existing.quantity >= book.quantity) { showToast(`Sách "${book.title}" chỉ còn ${book.quantity} cuốn.`, 'warning'); return; }
                existing.quantity++;
            } else {
                cart.push({ bookId: book.id, bookTitle: book.title, price: book.price, quantity: 1, maxQty: book.quantity });
            }

            sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
            updateCartBadgeCount();
            showToast(`Đã thêm "${book.title}" vào giỏ hàng! 🛒`, 'success');
        } catch (err) {
            showToast('Lỗi khi thêm sách vào giỏ hàng.', 'error');
        }
    };

    window.openCartModal = function() {
        const modal = document.getElementById('cart-modal');
        if (!modal) {
            window.location.href = 'index.html?openCart=true';
            return;
        }

        const tableBody = document.getElementById('cart-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (cart.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Giỏ hàng trống. Vui lòng chọn mua sách!</td></tr>`;
            const amountEl = document.getElementById('cart-total-amount');
            if (amountEl) amountEl.textContent = '0đ';
            modal.classList.add('active');
            return;
        }

        let total = 0;
        cart.forEach(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.bookTitle}</strong></td>
                <td>${item.price.toLocaleString()}đ</td>
                <td style="text-align:center;"><input type="number" class="cart-qty-input" min="1" max="${item.maxQty}" value="${item.quantity}" onchange="changeCartQty('${item.bookId}', this.value)"></td>
                <td><strong>${subtotal.toLocaleString()}đ</strong></td>
                <td><button class="cart-btn-remove" onclick="removeFromCart('${item.bookId}')"><i class="fa-solid fa-trash-can"></i></button></td>
            `;
            tableBody.appendChild(tr);
        });

        const amountEl = document.getElementById('cart-total-amount');
        if (amountEl) amountEl.textContent = total.toLocaleString() + 'đ';

        const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (loggedUser) {
            const fnEl = document.getElementById('cart-fullname');
            const phEl = document.getElementById('cart-phone');
            if (fnEl) fnEl.value = loggedUser.fullname || '';
            if (phEl) phEl.value = loggedUser.phone || '';
        }

        modal.classList.add('active');
    };

    window.closeCartModal = function() {
        const modal = document.getElementById('cart-modal');
        if (modal) modal.classList.remove('active');
    };

    window.removeFromCart = function(bookId) {
        cart = cart.filter(i => i.bookId !== bookId);
        sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
        updateCartBadgeCount();
        openCartModal();
        showToast('Đã xóa sách khỏi giỏ hàng.', 'info');
    };

    window.changeCartQty = function(bookId, val) {
        const qty = parseInt(val);
        const item = cart.find(i => i.bookId === bookId);
        if (item) {
            if (isNaN(qty) || qty < 1) item.quantity = 1;
            else if (qty > item.maxQty) { item.quantity = item.maxQty; showToast(`Chỉ còn tối đa ${item.maxQty} cuốn trong kho!`, 'warning'); }
            else item.quantity = qty;
            sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
            updateCartBadgeCount();
            openCartModal();
        }
    };

    window.executeCartCheckout = async function(e) {
        e.preventDefault();
        if (cart.length === 0) { showToast('Giỏ hàng của bạn đang trống!', 'warning'); return; }

        const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (!user) {
            showAlert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập tài khoản để thực hiện mua sách!', 'warning', () => {
                closeCartModal();
                openLoginModal();
            });
            return;
        }

        const fullname = document.getElementById('cart-fullname')?.value || '';
        const phone = document.getElementById('cart-phone')?.value || '';
        const address = document.getElementById('cart-address')?.value || '';
        const payEl = document.querySelector('input[name="cart-pay-method"]:checked');
        const paymentMethod = payEl ? payEl.value : 'bank';

        try {
            const token = sessionStorage.getItem('tvdn_auth_token');
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ fullname, phone, address, paymentMethod, items: cart })
            });
            const data = await res.json();

            if (data.success) {
                cart = [];
                sessionStorage.removeItem('tvdn_shopping_cart');
                updateCartBadgeCount();
                closeCartModal();
                showAlert('Đặt hàng thành công! 🎉', `Đơn hàng ${data.orderId} đã được tạo!\nTổng tiền: ${data.totalAmount.toLocaleString()}đ\n\nHệ thống sẽ chuyển bạn sang trang cá nhân để theo dõi đơn hàng.`, 'success', () => {
                    window.location.href = 'profile.html';
                });
            } else {
                showAlert('Lỗi đặt hàng', data.message, 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ đặt hàng.', 'error');
        }
    };

    // Cart trigger (topbar button)
    const cartTrigger = document.getElementById('btn-cart-trigger');
    if (cartTrigger) cartTrigger.addEventListener('click', openCartModal);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCart') === 'true') setTimeout(openCartModal, 300);

    // === CHATBOT ===
    window.toggleChatbox = function() {
        const win = document.getElementById('chatbox-window');
        if (win) win.classList.toggle('active');
    };

    window.sendChatMessage = function() {
        const input = document.getElementById('chatbox-input');
        const messages = document.getElementById('chatbox-messages');
        if (!input || !messages) return;

        const text = input.value.trim();
        if (!text) return;

        // User message
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user-message';
        userMsg.innerHTML = `<div class="message-content">${text}</div><span class="message-time">Vừa xong</span>`;
        messages.appendChild(userMsg);
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        setTimeout(() => {
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-message bot-message';
            botMsg.innerHTML = `<div class="message-content">${generateBotReply(text)}</div><span class="message-time">Vừa xong</span>`;
            messages.appendChild(botMsg);
            messages.scrollTop = messages.scrollHeight;
        }, 800);
    };

    const chatInput = document.getElementById('chatbox-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    function generateBotReply(text) {
        text = text.toLowerCase();
        if (text.includes('xin chào') || text.includes('hello') || text.includes('hi')) return 'Xin chào! Tôi là Trợ lý AI Thư viện Đà Nẵng. Tôi có thể giúp gì cho bạn?';
        if (text.includes('tìm sách') || text.includes('có sách')) return 'Bạn có thể dùng thanh tìm kiếm ở trên để tra cứu theo tên sách hoặc tác giả. Bạn cần tìm sách gì?';
        if (text.includes('mượn') || text.includes('làm thẻ')) return 'Để mượn sách, bạn cần đăng nhập tài khoản. Bấm vào "Đăng nhập" trong sidebar để đăng ký thẻ miễn phí nhé!';
        if (text.includes('địa chỉ') || text.includes('ở đâu')) return 'Thư viện Tổng hợp Đà Nẵng tại số 46 Bạch Đằng, quận Hải Châu, ngay sát sông Hàn!';
        if (text.includes('giờ') || text.includes('mở cửa')) return 'Giờ mở cửa: Thứ 2–6: 7:30–21:00 | Thứ 7–CN: 7:30–17:00 | Lễ Tết: Nghỉ.';
        if (text.includes('cảm ơn')) return 'Không có gì! Chúc bạn đọc sách vui vẻ! 🌸';
        return 'Tôi đã ghi nhận câu hỏi của bạn. Bạn có thể sử dụng bộ lọc thể loại hoặc thanh tìm kiếm để tra cứu tài liệu nhé!';
    }

    // === LOGIN FORM (trên index.html) ===
    window.handleLoginSubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value;
        if (!username || !password) return;

        const submitBtn = document.getElementById('btn-login-submit');
        if (submitBtn) { submitBtn.textContent = 'Đang kiểm tra...'; submitBtn.disabled = true; }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem('tvdn_logged_in_user', JSON.stringify(data.user));
                sessionStorage.setItem('tvdn_auth_token', data.token);
                closeLoginModal();
                showToast(`Chào mừng, ${data.user.fullname}! 🎉`, 'success');
                setTimeout(() => {
                    updateUIForLoggedUser();
                    window.location.reload();
                }, 800);
            } else {
                showToast(data.message || 'Tên đăng nhập hoặc mật khẩu không đúng.', 'error');
            }
        } catch (err) {
            showToast('Không kết nối được tới máy chủ. Vui lòng bật server.js!', 'error');
        } finally {
            if (submitBtn) { submitBtn.textContent = 'Đăng nhập'; submitBtn.disabled = false; }
        }
    };

    // Logout button (khi tồn tại trên trang)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            showConfirm('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', () => {
                sessionStorage.removeItem('tvdn_logged_in_user');
                sessionStorage.removeItem('tvdn_auth_token');
                showToast('Đã đăng xuất thành công.', 'info');
                setTimeout(() => window.location.reload(), 800);
            });
        });
    }

    // Google login button
    const btnGoogle = document.getElementById('btn-google-login');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            showToast('Tính năng đăng nhập Google đang được cấu hình. Vui lòng dùng tài khoản thư viện!', 'info');
        });
    }

}); // end DOMContentLoaded

// ========================= BORROW BOOK =========================
window.borrowBook = function(bookId, bookTitle) {
    const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
    if (!user) {
        showAlert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập tài khoản bạn đọc để mượn cuốn sách này!', 'warning', () => {
            openLoginModal();
        });
        return;
    }

    const modal = document.getElementById('borrow-modal');
    if (modal) {
        const titleEl = document.getElementById('borrow-modal-book-title');
        const nameEl = document.getElementById('borrow-name');
        if (titleEl) titleEl.textContent = `Mượn: "${bookTitle}"`;
        if (nameEl) nameEl.value = user.fullname || '';
        modal.dataset.bookId = bookId;
        modal.dataset.bookTitle = bookTitle;
        modal.classList.add('active');
    } else {
        // Fallback for pages without borrow-modal HTML
        showConfirm('Xác nhận mượn sách', `Bạn có muốn đăng ký mượn cuốn sách "${bookTitle}"?`, async () => {
            try {
                const token = sessionStorage.getItem('tvdn_auth_token');
                const res = await fetch('/api/slips', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ bookId })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('Mượn sách thành công! 🎉', `Đã đăng ký mượn: "${bookTitle}"\nHạn trả: ${data.slip.dueDate}\nMã phiếu: ${data.slip.id}\n\nVui lòng đến thư viện nhận sách.`, 'success');
                    user.borrowCount = (user.borrowCount || 0) + 1;
                    sessionStorage.setItem('tvdn_logged_in_user', JSON.stringify(user));
                    if (typeof renderBooks === 'function') renderBooks();
                    if (typeof loadDigitalBooks === 'function') loadDigitalBooks();
                    if (typeof loadCatalogSearch === 'function') loadCatalogSearch();
                } else {
                    showAlert('Lỗi mượn sách', data.message, 'error');
                }
            } catch (err) {
                showToast('Có lỗi xảy ra khi gửi yêu cầu mượn sách.', 'error');
            }
        });
    }
};

window.closeBorrowModal = function() {
    const modal = document.getElementById('borrow-modal');
    if (modal) modal.classList.remove('active');
};

// Global executeBorrow function called by form onsubmit
window.executeBorrow = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const modal = document.getElementById('borrow-modal');
    if (!modal) return;
    const bookId = modal.dataset.bookId;
    const bookTitle = modal.dataset.bookTitle || '';

    closeBorrowModal();

    try {
        const token = sessionStorage.getItem('tvdn_auth_token');
        const res = await fetch('/api/slips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bookId })
        });
        const data = await res.json();

        if (data.success) {
            showAlert('Mượn sách thành công! 🎉', `Đã đăng ký mượn: "${bookTitle}"\nHạn trả: ${data.slip.dueDate}\nMã phiếu: ${data.slip.id}\n\nVui lòng đến thư viện nhận sách.`, 'success');
            const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
            if (user) { user.borrowCount = (user.borrowCount || 0) + 1; sessionStorage.setItem('tvdn_logged_in_user', JSON.stringify(user)); }
            if (typeof renderBooks === 'function') renderBooks();
            if (typeof loadCatalogSearch === 'function') loadCatalogSearch();
            updateUIForLoggedUser();
        } else {
            showAlert('Lỗi mượn sách', data.message, 'error');
        }
    } catch (err) {
        showToast('Có lỗi xảy ra khi gửi yêu cầu mượn sách.', 'error');
    }
};

// ========================= BOOK DETAIL MODAL =========================
window.openBookDetailModal = async function(bookId) {
    try {
        const res = await fetch('/api/books');
        const books = await res.json();
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        const modal = document.getElementById('book-detail-modal');
        if (modal) {
            const img = document.getElementById('detail-book-img');
            const grad = document.getElementById('detail-book-gradient');
            if (book.coverUrl) {
                if (img) { img.src = book.coverUrl; img.style.display = 'block'; }
                if (grad) grad.style.display = 'none';
            } else {
                if (img) img.style.display = 'none';
                if (grad) {
                    grad.style.display = 'flex';
                    grad.className = `book-cover-mock ${book.coverGradient || 'cover-gradient-1'}`;
                    grad.innerHTML = `
                        <div class="cover-accent-line"></div>
                        <div class="cover-content" style="padding:10px;">
                            <h3 class="cover-book-title" style="font-size:0.9rem;color:white;line-height:1.2;">${book.title.toUpperCase()}</h3>
                            <p class="cover-book-sub" style="font-size:0.7rem;color:rgba(255,255,255,0.8);">${book.author}</p>
                        </div>
                    `;
                }
            }

            const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            safeSet('detail-book-title', book.title);
            safeSet('detail-book-genre-badge', book.categoryName || '');
            safeSet('detail-book-author', book.author);
            safeSet('detail-book-publisher', book.publisher || 'NXB Trẻ');
            safeSet('detail-book-year', book.releaseYear || 2022);
            safeSet('detail-book-price', book.price > 0 ? `${book.price.toLocaleString()}đ` : 'Sách E-Book (Miễn phí)');
            safeSet('detail-book-desc', book.description || 'Chưa có tóm tắt chi tiết cho tác phẩm này.');

            const stockEl = document.getElementById('detail-book-stock');
            if (stockEl) {
                if (book.status === 'digital') stockEl.innerHTML = `<span class="badge badge-info">Đọc trực tuyến (E-Book)</span>`;
                else if (book.quantity > 0) stockEl.innerHTML = `<span class="badge badge-success">Sẵn sàng mượn (${book.quantity} cuốn)</span>`;
                else stockEl.innerHTML = `<span class="badge badge-danger">Đã được mượn hết</span>`;
            }

            const actionsDiv = document.getElementById('detail-book-actions');
            if (actionsDiv) {
                actionsDiv.innerHTML = '';
                if (book.status === 'digital') {
                    actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:var(--teal);width:auto;padding:10px 20px;" onclick="closeBookDetailModal();showToast('Đang tải trình đọc sách trực tuyến!','info')"><i class="fa-solid fa-book-open"></i> Đọc online</button>`;
                    actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:var(--border);color:var(--text-primary);width:auto;padding:10px 20px;" onclick="showToast('Đang tải tệp PDF!','info')"><i class="fa-solid fa-download"></i> Tải PDF</button>`;
                } else {
                    if (book.quantity > 0) {
                        actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:var(--navy);width:auto;padding:10px 20px;" onclick="closeBookDetailModal();borrowBook('${book.id}','${book.title.replace(/'/g,"\\'")}')"><i class="fa-solid fa-book-open"></i> Đăng ký mượn</button>`;
                    } else {
                        actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:#cbd5e1;color:#94a3b8;width:auto;padding:10px 20px;" disabled><i class="fa-solid fa-lock"></i> Hết sách giấy</button>`;
                    }
                    if (book.price > 0) {
                        actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:var(--gold);color:var(--navy-dark);width:auto;padding:10px 20px;" onclick="closeBookDetailModal();addToCart('${book.id}')"><i class="fa-solid fa-cart-plus"></i> Chọn mua (${book.price.toLocaleString()}đ)</button>`;
                    }
                }
                actionsDiv.innerHTML += `<button class="btn-login-submit" style="background:var(--border);color:var(--text-primary);width:auto;padding:10px 20px;" onclick="closeBookDetailModal()">Đóng lại</button>`;
            }

            modal.classList.add('active');
        } else {
            // Fallback: show in custom alert
            showAlert(book.title, `Tác giả: ${book.author}\nThể loại: ${book.categoryName}\nNăm phát hành: ${book.releaseYear || 2022}\nGiá sách giấy: ${book.price > 0 ? `${book.price.toLocaleString()}đ` : 'Miễn phí'}\n\nMô tả: ${book.description || 'Chưa có mô tả.'}`, 'info');
        }
    } catch (err) {
        console.error('Lỗi khi hiển thị chi tiết sách:', err);
        showToast('Không thể tải thông tin sách.', 'error');
    }
};

window.closeBookDetailModal = function() {
    const modal = document.getElementById('book-detail-modal');
    if (modal) modal.classList.remove('active');
};

// CSS Animation FadeIn cho sách
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
`;
document.head.appendChild(styleSheet);

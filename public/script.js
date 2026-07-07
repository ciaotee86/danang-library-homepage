/**
 * Thư viện Đà Nẵng - Script Interactivity
 * Xử lý các hoạt động tương tác động trên trang chủ, kết nối REST API Backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Kiểm tra trạng thái Đăng nhập & Hiển thị Header ===
    const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
    const headerActions = document.querySelector('.header-actions');

    if (headerActions) {
        if (loggedUser) {
            // Đã đăng nhập
            const adminButton = loggedUser.role === 'admin' 
                ? `<button class="btn-login" onclick="window.location.href='admin.html'" style="border-color:var(--secondary-color); color:var(--secondary-color); background-color:#eff6ff;"><i class="fa-solid fa-gauge-high"></i> Quản trị</button>` 
                : '';
            
            headerActions.innerHTML = `
                <button class="btn-cart" id="btn-cart-trigger" title="Giỏ hàng sách mua" style="margin-right: 8px;">
                    <i class="fa-solid fa-cart-shopping"></i> Giỏ hàng
                    <span class="cart-badge" id="cart-badge-count">0</span>
                </button>
                <button class="btn-ai-suggest" id="btn-ai-suggest" onclick="window.location.href='ai-suggest.html'" title="Gợi ý sách AI">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý AI
                </button>
                ${adminButton}
                <div class="user-greeting-badge" onclick="window.location.href='profile.html'" style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; color:var(--primary-color); cursor:pointer;" title="Xem trang cá nhân của bạn">
                    <i class="fa-solid fa-user-circle" style="font-size:1.15rem; color:var(--secondary-color);"></i> Hi, ${loggedUser.fullname}
                </div>
                <button class="btn-login" id="btn-logout" style="border-color:#fca5a5; color:#e11d48; background-color:#fff1f2;" title="Đăng xuất tài khoản">
                    <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
                </button>
            `;

            // Nút đăng xuất
            document.getElementById('btn-logout').addEventListener('click', () => {
                showConfirm('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?', () => {
                    sessionStorage.removeItem('tvdn_logged_in_user');
                    window.location.reload();
                });
            });
        } else {
            // Chưa đăng nhập
            headerActions.innerHTML = `
                <button class="btn-cart" id="btn-cart-trigger" title="Giỏ hàng sách mua" style="margin-right: 8px;">
                    <i class="fa-solid fa-cart-shopping"></i> Giỏ hàng
                    <span class="cart-badge" id="cart-badge-count">0</span>
                </button>
                <button class="btn-ai-suggest" id="btn-ai-suggest" title="Nhận gợi ý sách tự động từ AI">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý AI
                </button>
                <button class="btn-login" id="btn-login-trigger">
                    <i class="fa-solid fa-user-tie"></i> Đăng nhập
                </button>
            `;

            document.getElementById('btn-login-trigger').addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }
    }

    // === 2. Tải Sách động từ REST API Backend ===
    const bookGrid = document.getElementById('book-display-grid');
    
    async function renderBooks() {
        if (!bookGrid) return;
        
        try {
            const res = await fetch('/api/books');
            const books = await res.json();
            
            bookGrid.innerHTML = '';

            books.forEach(b => {
                let statusText = 'Còn sách';
                let statusClass = 'status-available';
                let hoverOverlayHtml = '';

                if (b.status === 'borrowed' || b.quantity <= 0) {
                    statusText = 'Đang mượn';
                    statusClass = 'status-borrowed';
                    hoverOverlayHtml = `
                        <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                        <button class="btn-action-borrow disabled" disabled><i class="fa-solid fa-clock"></i> Hết sách giấy</button>
                    `;
                } else if (b.status === 'digital') {
                    statusText = 'E-Book';
                    statusClass = 'status-digital';
                    hoverOverlayHtml = `
                        <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                        <button class="btn-action-borrow" onclick="showToast('Đang tải tệp tin Ebook PDF của sách!', 'info')"><i class="fa-solid fa-download"></i> Tải PDF</button>
                    `;
                } else {
                    hoverOverlayHtml = `
                        <button class="btn-action-view" onclick="openBookDetailModal('${b.id}')"><i class="fa-solid fa-eye"></i> Xem nhanh</button>
                        <button class="btn-action-borrow" onclick="borrowBook('${b.id}', '${b.title}')"><i class="fa-solid fa-book-open"></i> Đăng ký mượn</button>
                    `;
                    if (b.price > 0) {
                        hoverOverlayHtml += `
                        <button class="btn-action-borrow" style="background-color:var(--accent-color); color:var(--text-dark);" onclick="addToCart('${b.id}')"><i class="fa-solid fa-cart-plus"></i> Chọn mua</button>
                        `;
                    }
                }

                const coverHtml = b.coverUrl 
                    ? `<img src="${b.coverUrl}" alt="${b.title}" class="book-cover-img" style="width:100%; height:100%; object-fit:cover; display:block;">`
                    : `<div class="book-cover-mock ${b.coverGradient}">
                        <div class="cover-accent-line"></div>
                        <div class="cover-content">
                            <h3 class="cover-book-title">${b.title.toUpperCase()}</h3>
                            <p class="cover-book-sub">${b.author}</p>
                        </div>
                       </div>`;

                const priceTagHtml = b.price > 0 
                    ? `<div class="book-price-tag">${b.price.toLocaleString()}đ</div>`
                    : `<div class="book-price-tag" style="color: #64748b; font-size: 0.8rem;">Chỉ đọc/mượn miễn phí</div>`;

                const card = document.createElement('div');
                card.className = 'book-card';
                card.setAttribute('data-category', b.category);
                card.setAttribute('data-tag', b.tag);
                card.innerHTML = `
                    <div class="book-card-cover-wrapper">
                        ${coverHtml}
                        <span class="badge-status ${statusClass}">${statusText}</span>
                        <div class="book-card-hover-overlay">
                            ${hoverOverlayHtml}
                        </div>
                    </div>
                    <div class="book-card-info">
                        <span class="book-genre">${b.categoryName}</span>
                        <h3 class="book-title" title="${b.title}">${b.title}</h3>
                        <p class="book-author">${b.author}</p>
                        ${priceTagHtml}
                        <div class="book-rating">
                            <div class="stars">
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star-half-stroke"></i>
                            </div>
                            <span class="rating-text">(${b.rating || '4.5'})</span>
                        </div>
                    </div>
                `;
                bookGrid.appendChild(card);
            });

            updateBookGrid();
        } catch (err) {
            console.error('Lỗi tải sách từ API:', err);
            bookGrid.innerHTML = `
                <div style="text-align:center; grid-column:1/-1; padding:40px; color:#ef4444;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>Không kết nối được tới máy chủ API Thư viện. Vui lòng bật server.js hoặc deploy ứng dụng!</p>
                </div>
            `;
        }
    }

    // Khởi động render sách lần đầu
    renderBooks();

    // === 3. Xử lý Đăng ký mượn sách thực tế qua API ===
    window.borrowBook = async function(bookId, bookTitle) {
        const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (!user) {
            showAlert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập tài khoản bạn đọc để mượn cuốn sách này!', 'warning', () => {
                window.location.href = 'login.html';
            });
            return;
        }

        try {
            const res = await fetch('/api/books');
            const books = await res.json();
            const book = books.find(b => b.id === bookId);
            if (!book) return;

            // Điền thông tin vào modal xác nhận mượn sách
            document.getElementById('confirm-book-id').textContent = book.id.toUpperCase();
            document.getElementById('confirm-book-genre').textContent = book.categoryName;
            document.getElementById('confirm-book-title').textContent = book.title;
            document.getElementById('confirm-borrower-name').textContent = user.fullname + ` (${user.username})`;
            
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('confirm-borrow-date').textContent = todayStr;

            // Ràng buộc sự kiện nút Xác nhận mượn thực tế
            const confirmBtn = document.getElementById('btn-confirm-borrow-execute');
            confirmBtn.onclick = async () => {
                closeBorrowModal();
                try {
                    const res = await fetch('/api/slips', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: user.username, bookId })
                    });
                    
                    const data = await res.json();
                    
                    if (data.success) {
                        showAlert('Mượn sách thành công', `Bạn đã đăng ký mượn cuốn: "${bookTitle}"\nHạn trả sách: ${data.slip.dueDate}\n\nMã phiếu mượn của bạn là: ${data.slip.id}.\n\nVui lòng đến thư viện để nhận sách.`, 'success');
                        // Đồng bộ lại local session
                        user.borrowCount = (user.borrowCount || 0) + 1;
                        sessionStorage.setItem('tvdn_logged_in_user', JSON.stringify(user));
                        // Reload lại lưới sách để cập nhật trạng thái kho
                        renderBooks();
                    } else {
                        showAlert('Lỗi mượn sách', data.message, 'error');
                    }
                } catch (err) {
                    showToast('Có lỗi xảy ra khi gửi yêu cầu mượn sách.', 'error');
                }
            };

            // Hiển thị modal
            document.getElementById('borrow-confirm-modal').classList.add('active');
        } catch (err) {
            console.error('Lỗi khi mở modal xác nhận mượn sách:', err);
        }
    };

    window.closeBorrowModal = function() {
        const modal = document.getElementById('borrow-confirm-modal');
        if (modal) modal.classList.remove('active');
    };

    // === 4. Xử lý Bộ lọc và Tìm kiếm Sách ở Cột Giữa ===
    const tabs = document.querySelectorAll('.content-tab');
    const visibleCountText = document.getElementById('visible-count');
    
    const filterCategory = document.getElementById('filter-category');
    const radioAvailable = document.querySelector('input[name="status-filter"][value="available"]');
    const btnApplyFilter = document.getElementById('btn-apply-filter');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const searchInput = document.getElementById('search-input');
    const btnSearch = document.getElementById('btn-search');

    let currentTab = 'all';
    let currentPage = 1;
    const itemsPerPage = 8;

    function updateBookGrid(resetPage = true) {
        if (resetPage) {
            currentPage = 1;
        }

        const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCategory = filterCategory ? filterCategory.value : 'all';
        const showOnlyAvailable = radioAvailable ? radioAvailable.checked : false;

        const cards = document.querySelectorAll('.book-card');
        const matchedCards = [];

        cards.forEach(card => {
            const cardTag = card.getAttribute('data-tag'); // new, popular, digital
            const cardCategory = card.getAttribute('data-category');
            const statusBadge = card.querySelector('.badge-status');
            if (!statusBadge) return; // Skip if no badge found
            
            const isAvailable = statusBadge.classList.contains('status-available') || 
                                statusBadge.classList.contains('status-digital'); // digital counts as available

            const title = card.querySelector('.book-title').textContent.toLowerCase();
            const author = card.querySelector('.book-author').textContent.toLowerCase();
            const genre = card.querySelector('.book-genre').textContent.toLowerCase();

            // 1. Kiểm tra Tab đang chọn
            let matchesTab = (currentTab === 'all') || (cardTag === currentTab);

            // 2. Kiểm tra Thể loại lọc
            let matchesCategory = (selectedCategory === 'all') || (cardCategory === selectedCategory);

            // 3. Kiểm tra Tình trạng
            let matchesAvailability = !showOnlyAvailable || isAvailable;

            // 4. Kiểm tra Tìm kiếm từ khóa
            let matchesSearch = !searchText || title.includes(searchText) || author.includes(searchText) || genre.includes(searchText);

            if (matchesTab && matchesCategory && matchesAvailability && matchesSearch) {
                matchedCards.push(card);
            } else {
                card.style.display = 'none';
            }
        });

        const totalMatched = matchedCards.length;
        const totalPages = Math.ceil(totalMatched / itemsPerPage);

        // Hide all, then show only the current page items
        matchedCards.forEach((card, index) => {
            const startIdx = (currentPage - 1) * itemsPerPage;
            const endIdx = currentPage * itemsPerPage;
            if (index >= startIdx && index < endIdx) {
                card.style.display = 'flex';
                card.style.animation = 'fadeIn 0.5s ease forwards';
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCountText) {
            visibleCountText.textContent = totalMatched;
        }

        renderPaginationControls(totalPages);

        // Hiển thị thông báo nếu không tìm thấy sách
        let emptyMessage = document.getElementById('no-books-message');
        if (totalMatched === 0) {
            if (!emptyMessage) {
                emptyMessage = document.createElement('div');
                emptyMessage.id = 'no-books-message';
                emptyMessage.innerHTML = `
                    <div style="text-align: center; grid-column: 1 / -1; padding: 40px 20px; color: var(--text-muted);">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; margin-bottom: 15px; color: var(--text-light);"></i>
                        <p style="font-weight: 600; font-size: 1.1rem; color: var(--primary-color);">Không tìm thấy đầu sách nào phù hợp</p>
                        <p style="font-size: 0.85rem;">Bạn hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm khác nhé.</p>
                    </div>
                `;
                bookGrid.appendChild(emptyMessage);
            }
        } else if (emptyMessage) {
            emptyMessage.remove();
        }
    }

    function renderPaginationControls(totalPages) {
        const paginationContainer = document.getElementById('homepage-pagination');
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';

        if (totalPages <= 1) {
            return; // No need for pagination controls
        }

        // Prev Button
        const prevBtn = document.createElement('button');
        prevBtn.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateBookGrid(false);
                document.querySelector('.layout-grid-container').scrollIntoView({ behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(prevBtn);

        // Page Number Buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${currentPage === i ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                updateBookGrid(false);
                document.querySelector('.layout-grid-container').scrollIntoView({ behavior: 'smooth' });
            });
            paginationContainer.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateBookGrid(false);
                document.querySelector('.layout-grid-container').scrollIntoView({ behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(nextBtn);
    }

    // Sự kiện click Tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.getAttribute('data-tab');
            updateBookGrid();
        });
    });

    // Nhấp nút Lọc
    if (btnApplyFilter) {
        btnApplyFilter.addEventListener('click', updateBookGrid);
    }

    // Đặt lại bộ lọc
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            if (filterCategory) filterCategory.value = 'all';
            const radioAll = document.querySelector('input[name="status-filter"][value="all"]');
            if (radioAll) radioAll.checked = true;
            document.querySelectorAll('input[name="format"]').forEach(cb => cb.checked = true);
            if (searchInput) searchInput.value = '';
            updateBookGrid();
        });
    }

    // Nhấp nút Tìm kiếm
    if (btnSearch) {
        btnSearch.addEventListener('click', updateBookGrid);
    }

    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                updateBookGrid();
            }
        });
    }

    // Click tags nhanh ở Hero
    const heroTagLinks = document.querySelectorAll('.search-tag-link');
    heroTagLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (searchInput) {
                searchInput.value = link.textContent;
                updateBookGrid();
            }
            // Cuộn xuống khu vực sách
            document.querySelector('.layout-grid-container').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // === 5. Tính năng "Gợi ý AI" tự động ===
    const btnAiSuggest = document.getElementById('btn-ai-suggest');
    if (btnAiSuggest) {
        btnAiSuggest.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'ai-suggest.html';
        });
    }

    // === 6. Quản lý AI Chatbot Widget ===
    const chatbotTrigger = document.getElementById('chatbot-trigger');
    const chatboxWindow = document.getElementById('chatbox-window');
    const chatboxMinimize = document.getElementById('btn-chat-minimize');
    const chatboxClose = document.getElementById('btn-chat-close');
    const chatboxInput = document.getElementById('chatbox-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chatbox-messages');

    if (chatbotTrigger && chatboxWindow) {
        chatbotTrigger.addEventListener('click', () => {
            chatboxWindow.classList.add('active');
            chatbotTrigger.style.display = 'none';
        });

        const closeChat = () => {
            chatboxWindow.classList.remove('active');
            chatbotTrigger.style.display = 'flex';
        };

        if (chatboxMinimize) chatboxMinimize.addEventListener('click', closeChat);
        if (chatboxClose) chatboxClose.addEventListener('click', closeChat);

        const handleSendMessage = () => {
            const messageText = chatboxInput.value.trim();
            if (!messageText) return;

            appendMessage(messageText, 'user-message');
            chatboxInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;

            setTimeout(() => {
                const botReply = generateBotReply(messageText);
                appendMessage(botReply, 'bot-message');
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 1000);
        };

        if (btnSendChat) btnSendChat.addEventListener('click', handleSendMessage);
        if (chatboxInput) {
            chatboxInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    handleSendMessage();
                }
            });
        }
    }

    function appendMessage(text, className) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${className}`;
        msgDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <span class="message-time">Vừa xong</span>
        `;
        if (chatMessages) chatMessages.appendChild(msgDiv);
    }

    function generateBotReply(userText) {
        const text = userText.toLowerCase();
        
        if (text.includes('xin chào') || text.includes('hello') || text.includes('hi')) {
            return 'Xin chào bạn! Tôi là Trợ lý AI của Thư viện Đà Nẵng. Tôi có thể giúp gì cho bạn hôm nay?';
        }
        if (text.includes('tìm sách') || text.includes('muốn đọc') || text.includes('có sách')) {
            return 'Bạn có thể tìm kiếm sách trực tiếp trên thanh tìm kiếm ở đầu trang bằng cách gõ tên sách hoặc tác giả. Bạn đang muốn tìm sách thuộc thể loại gì để tôi gợi ý?';
        }
        if (text.includes('lịch sử') || text.includes('đà nẵng')) {
            return 'Về Lịch sử Đà Nẵng, thư viện chúng tôi có cuốn sách rất nổi tiếng là: "Địa Chí Lịch Sử Đà Nẵng". Sách hiện đang còn sẵn để mượn tại tầng 2 phòng Địa chí!';
        }
        if (text.includes('ai') || text.includes('trí tuệ nhân tạo') || text.includes('học máy')) {
            return 'Chủ đề AI và Công nghệ thông tin rất hot! Thư viện đang trưng bày các cuốn: "Kỷ Nguyên Trí Tuệ Nhân Tạo" (sách giấy) và "Giáo Trình Học Máy Cơ Bản" (đọc trực tuyến e-book).';
        }
        if (text.includes('mượn') || text.includes('làm thẻ') || text.includes('đăng ký')) {
            return 'Để mượn sách, bạn cần đăng ký thẻ thư viện. Hãy nhấp vào nút "Đăng nhập" ở góc trên bên phải hoặc đến trực tiếp thư viện tại 46 Bạch Đằng để được các thủ thư hỗ trợ làm thẻ nhanh chóng (chỉ mất 10 phút thôi nhé).';
        }
        if (text.includes('địa chỉ') || text.includes('ở đâu') || text.includes('liên hệ')) {
            return 'Thư viện Tổng hợp Đà Nẵng nằm tại số **46 Bạch Đằng, quận Hải Châu, Đà Nẵng**, ngay sát sông Hàn thơ mộng. Rất hân hạnh được đón tiếp bạn!';
        }
        if (text.includes('cảm ơn') || text.includes('thank')) {
            return 'Không có gì! Rất vui được hỗ trợ bạn. Chúc bạn một ngày đọc sách thật nhiều niềm vui! 🌸';
        }

        return 'Tôi đã ghi nhận câu hỏi của bạn. Để tìm kiếm chính xác nhất các tài liệu này, bạn có thể sử dụng công cụ "Bộ lọc đầu sách" ở cột bên phải trang web, hoặc để lại số điện thoại/mã thẻ để thủ thư liên hệ hỗ trợ bạn nhé!';
    }

    // ==================== 6. SHOPPING CART ENGINE ====================
    let cart = JSON.parse(sessionStorage.getItem('tvdn_shopping_cart')) || [];

    window.updateCartBadgeCount = function() {
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById('cart-badge-count');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    };

    window.addToCart = async function(bookId) {
        try {
            const res = await fetch('/api/books');
            const books = await res.json();
            const book = books.find(b => b.id === bookId);
            
            if (!book || book.price <= 0) {
                showToast('Cuốn sách này không bán.', 'warning');
                return;
            }

            const existingItem = cart.find(item => item.bookId === bookId);
            if (existingItem) {
                if (existingItem.quantity >= book.quantity) {
                    showToast(`Sách "${book.title}" chỉ còn ${book.quantity} cuốn trong kho.`, 'warning');
                    return;
                }
                existingItem.quantity += 1;
            } else {
                cart.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    price: book.price,
                    quantity: 1,
                    maxQty: book.quantity
                });
            }

            sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
            updateCartBadgeCount();
            showToast(`Đã thêm "${book.title}" vào giỏ hàng!`, 'success');
        } catch (err) {
            showToast('Lỗi khi thêm sách vào giỏ hàng.', 'error');
        }
    };

    window.openCartModal = function() {
        const modal = document.getElementById('cart-modal');
        if (!modal) return;

        const tableBody = document.getElementById('cart-table-body');
        tableBody.innerHTML = '';

        if (cart.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">Giỏ hàng trống. Vui lòng chọn mua sách!</td></tr>`;
            document.getElementById('cart-total-amount').textContent = '0đ';
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
                <td style="text-align: center;">
                    <input type="number" class="cart-qty-input" min="1" max="${item.maxQty}" value="${item.quantity}" onchange="changeCartQty('${item.bookId}', this.value)">
                </td>
                <td><strong>${subtotal.toLocaleString()}đ</strong></td>
                <td>
                    <button class="cart-btn-remove" onclick="removeFromCart('${item.bookId}')"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.getElementById('cart-total-amount').textContent = total.toLocaleString() + 'đ';

        // Điền thông tin người dùng nếu có sẵn
        const loggedUser = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (loggedUser) {
            document.getElementById('cart-fullname').value = loggedUser.fullname || '';
            document.getElementById('cart-phone').value = loggedUser.phone || '';
        }

        modal.classList.add('active');
    };

    window.closeCartModal = function() {
        const modal = document.getElementById('cart-modal');
        if (modal) modal.classList.remove('active');
    };

    window.removeFromCart = function(bookId) {
        cart = cart.filter(item => item.bookId !== bookId);
        sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
        updateCartBadgeCount();
        openCartModal(); // Re-render
        showToast('Đã xóa sách khỏi giỏ hàng.', 'info');
    };

    window.changeCartQty = function(bookId, val) {
        const qty = parseInt(val);
        const item = cart.find(i => i.bookId === bookId);
        if (item) {
            if (isNaN(qty) || qty < 1) {
                item.quantity = 1;
            } else if (qty > item.maxQty) {
                item.quantity = item.maxQty;
                showToast(`Chỉ còn tối đa ${item.maxQty} cuốn sách trong kho!`, 'warning');
            } else {
                item.quantity = qty;
            }
            sessionStorage.setItem('tvdn_shopping_cart', JSON.stringify(cart));
            updateCartBadgeCount();
            openCartModal(); // Re-render to update totals
        }
    };

    window.executeCartCheckout = async function(e) {
        e.preventDefault();
        
        if (cart.length === 0) {
            showToast('Giỏ hàng của bạn đang trống!', 'warning');
            return;
        }

        const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
        if (!user) {
            showAlert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập tài khoản để thực hiện mua sách!', 'warning', () => {
                closeCartModal();
                window.location.href = 'login.html';
            });
            return;
        }

        const fullname = document.getElementById('cart-fullname').value;
        const phone = document.getElementById('cart-phone').value;
        const address = document.getElementById('cart-address').value;
        const paymentMethod = document.querySelector('input[name="cart-pay-method"]:checked').value;

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    fullname,
                    phone,
                    address,
                    paymentMethod,
                    items: cart
                })
            });

            const data = await res.json();
            if (data.success) {
                // Clear cart
                cart = [];
                sessionStorage.removeItem('tvdn_shopping_cart');
                updateCartBadgeCount();
                closeCartModal();

                showAlert('Đặt hàng thành công', `Đơn hàng ${data.orderId} của bạn đã được tạo thành công với số tiền ${data.totalAmount.toLocaleString()}đ!\n\nHệ thống sẽ chuyển bạn sang trang cá nhân để theo dõi đơn hàng và đóng tiền mua sách.`, 'success', () => {
                    window.location.href = 'profile.html';
                });
            } else {
                showAlert('Lỗi đặt hàng', data.message, 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ đặt hàng.', 'error');
        }
    };

    // Khởi tạo số lượng giỏ hàng lần đầu
    updateCartBadgeCount();

    // Trigger mở giỏ hàng
    const cartTrigger = document.getElementById('btn-cart-trigger');
    if (cartTrigger) {
        cartTrigger.addEventListener('click', openCartModal);
    }

    // Kiểm tra nếu có tham số openCart=true trên URL để tự động mở giỏ hàng
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCart') === 'true') {
        setTimeout(openCartModal, 300);
    }
});

// ==================== 7. BOOK DETAIL MODAL ====================
window.openBookDetailModal = async function(bookId) {
    try {
        const res = await fetch('/api/books');
        const books = await res.json();
        const book = books.find(b => b.id === bookId);
        
        if (!book) return;

        const modal = document.getElementById('book-detail-modal');
        if (!modal) return;

        // Bìa sách
        const img = document.getElementById('detail-book-img');
        const grad = document.getElementById('detail-book-gradient');
        if (book.coverUrl) {
            img.src = book.coverUrl;
            img.style.display = 'block';
            grad.style.display = 'none';
        } else {
            img.style.display = 'none';
            grad.style.display = 'flex';
            grad.className = `book-cover-mock ${book.coverGradient}`;
            grad.innerHTML = `
                <div class="cover-accent-line"></div>
                <div class="cover-content" style="padding:10px;">
                    <h3 class="cover-book-title" style="font-size:0.9rem; color:white; line-height:1.2;">${book.title.toUpperCase()}</h3>
                    <p class="cover-book-sub" style="font-size:0.7rem; color:rgba(255,255,255,0.8);">${book.author}</p>
                </div>
            `;
        }

        // Điền thông tin
        document.getElementById('detail-book-title').textContent = book.title;
        document.getElementById('detail-book-genre-badge').textContent = book.categoryName;
        document.getElementById('detail-book-author').textContent = book.author;
        document.getElementById('detail-book-publisher').textContent = book.publisher || 'NXB Trẻ';
        document.getElementById('detail-book-year').textContent = book.releaseYear || 2022;
        document.getElementById('detail-book-price').textContent = book.price > 0 ? `${book.price.toLocaleString()}đ` : 'Sách E-Book (Miễn phí)';
        document.getElementById('detail-book-desc').textContent = book.description || 'Chưa có tóm tắt chi tiết cho tác phẩm này.';

        const stock = document.getElementById('detail-book-stock');
        if (book.status === 'digital') {
            stock.innerHTML = `<span class="badge badge-success" style="background-color:#ecfdf5; color:#10b981; font-weight:600; padding:4px 8px; border-radius:4px;">Đọc trực tuyến (E-Book)</span>`;
        } else if (book.quantity > 0) {
            stock.innerHTML = `<span class="badge badge-success" style="background-color:#ecfdf5; color:#10b981; font-weight:600; padding:4px 8px; border-radius:4px;">Sẵn sàng mượn (${book.quantity} cuốn)</span>`;
        } else {
            stock.innerHTML = `<span class="badge badge-danger" style="background-color:#fff1f2; color:#e11d48; font-weight:600; padding:4px 8px; border-radius:4px;">Đã được mượn hết</span>`;
        }

        // Tạo các nút hành động tương ứng ở phía dưới
        const actionsDiv = document.getElementById('detail-book-actions');
        actionsDiv.innerHTML = '';

        if (book.status === 'digital') {
            actionsDiv.innerHTML += `<button class="btn-search-submit" style="background-color:#1e6b7b; width:auto; padding:10px 20px;" onclick="closeBookDetailModal(); showAlert('Đọc trực tuyến', 'Đang tải trình đọc sách trực tuyến cho tác phẩm: ${book.title}', 'success')"><i class="fa-solid fa-book-open"></i> Đọc online</button>`;
            actionsDiv.innerHTML += `<button class="btn-login" style="border-color:#1e6b7b; color:#1e6b7b; width:auto; padding:10px 20px;" onclick="showToast('Đang tải tệp tin Ebook PDF của sách!', 'info')"><i class="fa-solid fa-download"></i> Tải PDF</button>`;
        } else {
            if (book.quantity > 0) {
                actionsDiv.innerHTML += `<button class="btn-search-submit" style="background-color:#112e51; width:auto; padding:10px 20px;" onclick="closeBookDetailModal(); borrowBook('${book.id}', '${book.title}')"><i class="fa-solid fa-book-open"></i> Đăng ký mượn</button>`;
            } else {
                actionsDiv.innerHTML += `<button class="btn-search-submit disabled" style="background-color:#cbd5e1; color:#94a3b8; width:auto; padding:10px 20px;" disabled><i class="fa-solid fa-lock"></i> Đã hết sách giấy</button>`;
            }

            if (book.price > 0) {
                actionsDiv.innerHTML += `<button class="btn-search-submit" style="background-color:var(--accent-color); color:var(--text-dark); width:auto; padding:10px 20px; border:none;" onclick="closeBookDetailModal(); addToCart('${book.id}')"><i class="fa-solid fa-cart-plus"></i> Chọn mua (${book.price.toLocaleString()}đ)</button>`;
            }
        }

        actionsDiv.innerHTML += `<button class="btn-login" style="border-color:var(--border-color); color:var(--text-dark); width:auto; padding:10px 20px;" onclick="closeBookDetailModal()">Đóng lại</button>`;

        modal.classList.add('active');
    } catch (err) {
        console.error('Lỗi khi hiển thị chi tiết sách:', err);
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

/**
 * Thư viện Đà Nẵng - Logic Phân tích & Gợi ý Sách AI Cá nhân hóa
 * Kết nối REST API Backend, phân tích lịch sử đọc sách và thói quen mượn của tài khoản.
 */

let habitChart = null;

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
                <button class="btn-ai-suggest active" id="btn-ai-suggest" onclick="window.location.href='ai-suggest.html'">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý AI
                </button>
                ${adminButton}
                <div class="user-greeting-badge" onclick="window.location.href='profile.html'" style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; color:var(--primary-color); cursor:pointer;" title="Trang cá nhân bạn đọc">
                    <i class="fa-solid fa-user-circle" style="font-size:1.15rem; color:var(--secondary-color);"></i> Hi, ${loggedUser.fullname}
                </div>
                <button class="btn-login" id="btn-logout" style="border-color:#fca5a5; color:#e11d48; background-color:#fff1f2;" title="Đăng xuất tài khoản">
                    <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
                </button>
            `;

            document.getElementById('btn-logout').addEventListener('click', () => {
                if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                    sessionStorage.removeItem('tvdn_logged_in_user');
                    window.location.href = 'index.html';
                }
            });
        } else {
            // Chưa đăng nhập
            headerActions.innerHTML = `
                <button class="btn-ai-suggest active" id="btn-ai-suggest" onclick="window.location.href='ai-suggest.html'">
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

    // === 2. Xử lý phân bổ giao diện theo Đăng nhập ===
    const unloggedCard = document.getElementById('ai-unlogged-card');
    const loggedBoard = document.getElementById('ai-logged-board');

    if (!loggedUser) {
        // Chưa đăng nhập: Hiện màn hình khóa và vẽ chart mặc định
        if (unloggedCard) unloggedCard.style.display = 'flex';
        if (loggedBoard) loggedBoard.style.display = 'none';
        renderHabitChart({ 'Công nghệ': 1, 'Lịch sử': 1, 'Kỹ năng': 1, 'Văn học': 1, 'Kinh tế': 1 }, true);
    } else {
        // Đã đăng nhập: Tải dữ liệu thật từ API
        if (unloggedCard) unloggedCard.style.display = 'none';
        if (loggedBoard) loggedBoard.style.display = 'block';
        loadAiSuggestions(loggedUser);
    }
});

// Tải danh sách mượn trả và sách để đưa ra gợi ý cá nhân hóa
async function loadAiSuggestions(user) {
    try {
        const resSlips = await fetch('/api/slips');
        const slips = await resSlips.json();

        const resBooks = await fetch('/api/books');
        const books = await resBooks.json();

        // 1. Lọc ra các phiếu mượn của tài khoản hiện tại
        const userSlips = slips.filter(s => s.username === user.username);
        
        // 2. Tính toán thống kê thói quen đọc sách theo danh mục
        const categoriesCount = {
            'Công nghệ': 0,
            'Lịch sử': 0,
            'Kỹ năng': 0,
            'Văn học': 0,
            'Kinh tế': 0,
            'Khoa học': 0,
            'Y học': 0
        };

        const genreKeyMap = {
            'ai': 'Công nghệ',
            'history': 'Lịch sử',
            'skills': 'Kỹ năng',
            'literature': 'Văn học',
            'economy': 'Kinh tế',
            'science': 'Khoa học',
            'health': 'Y học'
        };

        const borrowedBookIds = new Set();

        userSlips.forEach(s => {
            borrowedBookIds.add(s.bookId);
            const book = books.find(b => b.id === s.bookId);
            if (book && genreKeyMap[book.category]) {
                categoriesCount[genreKeyMap[book.category]] += 1;
            }
        });

        // Tìm thể loại đọc nhiều nhất
        let favGenre = 'Chưa xác định';
        let maxCount = -1;
        for (const [genre, count] of Object.entries(categoriesCount)) {
            if (count > maxCount && count > 0) {
                maxCount = count;
                favGenre = genre;
            }
        }

        // Vẽ biểu đồ thói quen của user
        const hasHistory = userSlips.length > 0;
        if (hasHistory) {
            renderHabitChart(categoriesCount, false);
        } else {
            // Nếu chưa có lịch sử mượn, điền chart mẫu và đặt sở thích mặc định
            categoriesCount['Kỹ năng'] = 1;
            categoriesCount['Công nghệ'] = 1;
            renderHabitChart(categoriesCount, false);
        }

        // 3. Viết lời phản hồi nhận xét của AI
        const feedbackDiv = document.getElementById('ai-analysis-feedback');
        if (feedbackDiv) {
            if (hasHistory) {
                feedbackDiv.innerHTML = `
                    Xin chào <strong>${user.fullname}</strong>! Dựa trên việc phân tích <strong>${userSlips.length} lượt mượn sách</strong> trong lịch sử thẻ thư viện của bạn, 
                    AI nhận thấy thể loại sách yêu thích nhất của bạn là <strong>${favGenre}</strong>.
                    <br><br>
                    Để mở rộng kiến thức và tối ưu hóa lộ trình học tập, AI đề xuất cho bạn các cuốn sách cùng chủ đề hoặc thuộc nhóm kỹ năng bổ trợ bên dưới mà bạn chưa từng mượn:
                `;
            } else {
                feedbackDiv.innerHTML = `
                    Xin chào <strong>${user.fullname}</strong>! Vì đây là tài khoản mới và chưa ghi nhận phiếu mượn sách giấy nào trong cơ sở dữ liệu, 
                    AI khuyên bạn hãy bắt đầu hành trình bằng việc chọn thể loại yêu thích trong phiếu khảo sát nhanh bên dưới hoặc tham khảo các đề xuất sách kỹ năng tiêu biểu:
                `;
            }
        }

        // 4. Lọc sách đề xuất
        generateBookRecommendations(books, borrowedBookIds, favGenre, []);

        // 5. Ràng buộc sự kiện Form khảo sát sở thích
        const surveyForm = document.getElementById('ai-survey-form');
        if (surveyForm) {
            surveyForm.onsubmit = (e) => {
                e.preventDefault();
                const checkedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked')).map(cb => cb.value);
                
                if (checkedInterests.length === 0) {
                    showToast('Vui lòng chọn ít nhất 1 chủ đề quan tâm!', 'warning');
                    return;
                }

                // Cập nhật lại biểu đồ và danh sách sách đề xuất dựa trên khảo sát mới
                const surveyCategoryNames = checkedInterests.map(val => genreKeyMap[val]);
                const newCategoriesCount = { 'Công nghệ': 0, 'Lịch sử': 0, 'Kỹ năng': 0, 'Văn học': 0, 'Kinh tế': 0, 'Khoa học': 0, 'Y học': 0 };
                
                surveyCategoryNames.forEach(name => {
                    newCategoriesCount[name] = 2; // Gán trọng số cao hơn
                });

                renderHabitChart(newCategoriesCount, false);
                generateBookRecommendations(books, borrowedBookIds, surveyCategoryNames[0], checkedInterests);

                showToast('Đã cập nhật lại bộ lọc đề xuất AI thành công!', 'success');
            };
        }

    } catch (err) {
        console.error('Lỗi tải dữ liệu gợi ý AI:', err);
    }
}

// Lọc sách và hiển thị thẻ lên grid đề xuất
function generateBookRecommendations(books, borrowedBookIds, favoriteGenreName, selectedGenres = []) {
    const grid = document.getElementById('ai-suggestions-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const genreMapInverse = {
        'Công nghệ': 'ai',
        'Lịch sử': 'history',
        'Kỹ năng': 'skills',
        'Văn học': 'literature',
        'Kinh tế': 'economy',
        'Khoa học': 'science',
        'Y học': 'health'
    };

    const targetGenreCode = genreMapInverse[favoriteGenreName] || 'skills';
    
    // Lọc sách:
    // Ưu tiên 1: Nằm trong thể loại ưa thích nhất (hoặc khảo sát chọn) và CHƯA mượn
    // Ưu tiên 2: Các sách có rating cao (nổi tiếng) và CHƯA mượn
    let recommended = books.filter(b => !borrowedBookIds.has(b.id));

    if (selectedGenres.length > 0) {
        recommended = recommended.filter(b => selectedGenres.includes(b.category));
    } else {
        recommended = recommended.filter(b => b.category === targetGenreCode || b.tag === 'popular');
    }

    // Lấy tối đa 3 cuốn sách đề xuất
    recommended = recommended.slice(0, 3);

    if (recommended.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">AI tạm thời chưa tìm thấy đầu sách mới phù hợp sở thích của bạn.</div>`;
        return;
    }

    recommended.forEach(b => {
        let statusText = 'Còn sách';
        let statusClass = 'status-available';
        let actionBtn = `<button class="btn-action-borrow" onclick="borrowBookFromAI('${b.id}', '${b.title}')" style="background-color:var(--secondary-color); color:white; border-radius:4px; font-weight:600; width:100%; padding:8px;"><i class="fa-solid fa-book-open"></i> Đăng ký mượn</button>`;

        if (b.status === 'borrowed' || b.quantity <= 0) {
            statusText = 'Đang mượn';
            statusClass = 'status-borrowed';
            actionBtn = `<button class="btn-action-borrow disabled" disabled style="background-color:#e2e8f0; color:#94a3b8; border-radius:4px; font-weight:600; width:100%; padding:8px;">Hết sách giấy</button>`;
        } else if (b.status === 'digital') {
            statusText = 'E-Book';
            statusClass = 'status-digital';
            actionBtn = `<button class="btn-action-borrow" onclick="showAlert('Đọc trực tuyến', 'Đang kết nối tài nguyên số của cuốn: ${b.title}...', 'info')" style="background-color:#06b6d4; color:white; border-radius:4px; font-weight:600; width:100%; padding:8px;"><i class="fa-solid fa-laptop"></i> Đọc online</button>`;
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

        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.animation = 'fadeIn 0.5s ease forwards';
        card.innerHTML = `
            <div class="book-card-cover-wrapper">
                ${coverHtml}
                <span class="badge-status ${statusClass}">${statusText}</span>
            </div>
            <div class="book-card-info" style="padding:15px;">
                <span class="book-genre">${b.categoryName}</span>
                <h3 class="book-title" title="${b.title}" style="font-size:0.85rem; height:40px; overflow:hidden;">${b.title}</h3>
                <p class="book-author" style="font-size:0.75rem;">${b.author}</p>
                <div style="margin-top:10px;">
                    ${actionBtn}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Gọi API mượn sách trực tiếp từ trang AI
window.borrowBookFromAI = async function(bookId, bookTitle) {
    const user = JSON.parse(sessionStorage.getItem('tvdn_logged_in_user'));
    if (!user) return;

    showConfirm('Xác nhận mượn', `Bạn muốn mượn sách đề xuất: "${bookTitle}"?`, async () => {
        try {
            const res = await fetch('/api/slips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, bookId })
            });
            const data = await res.json();
            
            if (data.success) {
                showAlert('Mượn sách thành công', `Bạn đã đăng ký mượn cuốn: "${bookTitle}"\nMã phiếu mượn: ${data.slip.id}\n\nVui lòng đến thư viện nhận sách trước ngày trả: ${data.slip.dueDate}`, 'success');
                user.borrowCount = (user.borrowCount || 0) + 1;
                sessionStorage.setItem('tvdn_logged_in_user', JSON.stringify(user));
                loadAiSuggestions(user); // Reload
            } else {
                showAlert('Lỗi mượn sách', data.message, 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ.', 'error');
        }
    });
};

// Hàm vẽ biểu đồ hình tròn thói quen
function renderHabitChart(categoriesCount, isGreyedOut = false) {
    if (habitChart) habitChart.destroy();

    const ctx = document.getElementById('user-habit-chart').getContext('2d');
    
    const labels = Object.keys(categoriesCount);
    const data = Object.values(categoriesCount);
    
    // Nếu chưa đăng nhập, vẽ màu xám để báo khóa
    const backgroundColors = isGreyedOut 
        ? ['#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1']
        : ['#112E51', '#1E6B7B', '#d4a359', '#10b981', '#f59e0b'];

    habitChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10, weight: 'bold' }
                    }
                }
            }
        }
    });
}

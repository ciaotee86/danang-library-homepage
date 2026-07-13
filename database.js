/**
 * Thư viện Đà Nẵng - Cơ sở dữ liệu SQLite Persistent
 * Khởi tạo kết nối, cấu trúc bảng và cung cấp các hàm API thao tác với Database.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.resolve(__dirname, 'library.db');

// Kết nối tới file database SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Không thể kết nối cơ sở dữ liệu SQLite:', err.message);
    } else {
        console.log('Đã kết nối thành công tới database SQLite (library.db)');
        initializeDatabase();
    }
});

// Wrapper chuyển đổi truy vấn SQLite sang Promise
const query = {
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
};

// Khởi tạo các bảng và chèn dữ liệu hạt giống (Seed Data) nếu trống
async function initializeDatabase() {
    try {
        // 1. Tạo bảng Users
        await query.run(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                fullname TEXT NOT NULL,
                cardId TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                borrowCount INTEGER DEFAULT 0
            )
        `);

        // Seed users
        const userCount = await query.get("SELECT COUNT(*) as count FROM users");
        if (userCount.count === 0) {
            const hashedAdmin = await bcrypt.hash('admin123', 10);
            const hashedReader = await bcrypt.hash('123', 10);
            await query.run("INSERT INTO users VALUES ('admin', ?, 'admin', 'Nguyễn Văn Thủ Thư', 'TVDN-ADMIN', '0905123456', 'active', 0)", [hashedAdmin]);
            await query.run("INSERT INTO users VALUES ('reader1', ?, 'reader', 'Lê Hoàng Nam', 'TVDN-0001', '0935987654', 'active', 2)", [hashedReader]);
            await query.run("INSERT INTO users VALUES ('reader2', ?, 'reader', 'Trần Thị Mỹ Linh', 'TVDN-0002', '0914112233', 'active', 1)", [hashedReader]);
            await query.run("INSERT INTO users VALUES ('reader3', ?, 'reader', 'Phạm Minh Hải', 'TVDN-0003', '0988445566', 'locked', 0)", [hashedReader]);
            await query.run("INSERT INTO users VALUES ('reader4', ?, 'reader', 'Hoàng Anh Tuấn', 'TVDN-0004', '0977123987', 'active', 0)", [hashedReader]);
            console.log('-> Đã chèn dữ liệu mẫu bảng users.');
        }

        // Migration: Băm mật khẩu cho các tài khoản hiện có nếu chưa băm
        const existingUsersList = await query.all("SELECT username, password FROM users");
        for (const u of existingUsersList) {
            const isHashed = u.password.startsWith('$2a$') || u.password.startsWith('$2b$');
            if (!isHashed) {
                const hashedPassword = await bcrypt.hash(u.password, 10);
                await query.run("UPDATE users SET password = ? WHERE username = ?", [hashedPassword, u.username]);
                console.log(`-> Đã di trú băm mật khẩu cho tài khoản: ${u.username}`);
            }
        }

        // 2. Tạo bảng Books
        await query.run(`
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL,
                categoryName TEXT NOT NULL,
                tag TEXT NOT NULL,
                coverGradient TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                status TEXT NOT NULL,
                rating REAL DEFAULT 4.5,
                coverUrl TEXT,
                price INTEGER DEFAULT 0,
                publisher TEXT DEFAULT 'NXB Trẻ',
                releaseYear INTEGER DEFAULT 2022,
                description TEXT
            )
        `);

        // Migration: Thêm cột coverUrl nếu chưa có
        try {
            await query.run("ALTER TABLE books ADD COLUMN coverUrl TEXT");
            console.log('-> Đã chạy migration thêm cột coverUrl.');
        } catch (e) {
            // Cột đã tồn tại
        }

        // Migration: Thêm cột price nếu chưa có
        try {
            await query.run("ALTER TABLE books ADD COLUMN price INTEGER DEFAULT 0");
            console.log('-> Đã chạy migration thêm cột price.');
        } catch (e) {
            // Cột đã tồn tại
        }

        // Migration: Thêm các cột publisher, releaseYear, description nếu chưa có
        try {
            await query.run("ALTER TABLE books ADD COLUMN publisher TEXT DEFAULT 'NXB Trẻ'");
            await query.run("ALTER TABLE books ADD COLUMN releaseYear INTEGER DEFAULT 2022");
            await query.run("ALTER TABLE books ADD COLUMN description TEXT");
            console.log('-> Đã chạy migration thêm các cột thông tin chi tiết sách.');
        } catch (e) {
            // Các cột đã tồn tại
        }

        // Reseed / Replace books to support the new coverUrl schema, price, and details
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-1', 'Kỷ Nguyên Trí Tuệ Nhân Tạo', 'TS. Nguyễn Văn A', 'ai', 'Công nghệ & AI', 'new', 'cover-gradient-1', 5, 'available', 4.8, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80', 120000, 'NXB Thông tin & Truyền thông', 2023, 'Cuốn sách khám phá hành trình phát triển vượt bậc của Trí tuệ Nhân tạo, từ những lý thuyết cơ bản đến các ứng dụng đột phá trong cuộc sống hiện đại và tương lai.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-2', 'Lịch Sử Đà Nẵng', 'Hội Khoa Học Lịch Sử', 'history', 'Lịch sử địa phương', 'popular', 'cover-gradient-2', 2, 'available', 5.0, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80', 180000, 'NXB Đà Nẵng', 2020, 'Tài liệu toàn diện ghi lại lịch sử hình thành, quá trình phát triển và các đặc trưng văn hóa xã hội đặc sắc của thành phố Đà Nẵng qua các thời kỳ.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-3', 'Tư Duy Ngược & Tư Duy Mở', 'Nguyễn Anh Dũng', 'skills', 'Phát triển bản thân', 'new', 'cover-gradient-3', 0, 'borrowed', 4.2, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80', 95000, 'NXB Thế Giới', 2021, 'Tác phẩm hướng dẫn phá vỡ các giới hạn tư duy lối mòn, giúp bạn mở rộng tầm nhìn để tìm ra hướng đi đột phá trong cuộc sống và công việc.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-4', 'Mắt Biếc (Bản Đặc Biệt)', 'Nguyễn Nhật Ánh', 'literature', 'Văn học nghệ thuật', 'popular', 'cover-gradient-4', 3, 'available', 4.7, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80', 110000, 'NXB Trẻ', 2019, 'Một trong những tiểu thuyết lãng mạn xuất sắc nhất của Nguyễn Nhật Ánh, kể về tình yêu thơ ngây, sâu đậm và day dứt của Ngạn dành cho Hà Lan.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-5', 'Kinh Tế Vi Mô Hiện Đại', 'GS. Trần Thanh B', 'economy', 'Kinh tế học', 'digital', 'cover-gradient-5', 99, 'digital', 4.0, 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=400&q=80', 0, 'NXB Giáo Dục', 2022, 'Giáo trình chuẩn nghiên cứu về hành vi của các cá nhân, hộ gia đình và doanh nghiệp trong việc đưa ra quyết định phân bổ các nguồn lực khan hiếm.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-6', 'Giáo Trình Học Máy Cơ Bản', 'PGS.TS Lê Hoàng C', 'ai', 'Công nghệ & AI', 'digital', 'cover-gradient-6', 99, 'digital', 4.9, 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80', 0, 'NXB Đại Học Quốc Gia', 2023, 'Cung cấp kiến thức nền tảng vững chắc về các thuật toán học máy phổ biến như Hồi quy tuyến tính, SVM, Cây quyết định và Mạng nơ-ron cơ bản.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-7', 'Đà Nẵng - Thành Phố Đáng Sống', 'Nhiều Tác Giả', 'history', 'Lịch sử địa phương', 'new', 'cover-gradient-1', 3, 'available', 4.5, 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80', 150000, 'NXB Đà Nẵng', 2021, 'Tập hợp các bài viết cảm động và chân thực về sự chuyển mình mạnh mẽ, con người thân thiện và cảnh sắc tuyệt đẹp của thành phố bên sông Hàn.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-8', 'Kỹ Năng Giao Tiếp Trong Công Việc', 'Dale Carnegie', 'skills', 'Phát triển bản thân', 'popular', 'cover-gradient-3', 4, 'available', 4.6, 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=400&q=80', 85000, 'NXB Lao Động', 2020, 'Hướng dẫn các nguyên tắc đắc nhân tâm trong giao tiếp, ứng xử để xây dựng các mối quan hệ bền vững và đạt được thành công tại nơi làm việc.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-9', 'Lược Sử Thời Gian', 'Stephen Hawking', 'skills', 'Khoa học tự nhiên', 'new', 'cover-gradient-5', 5, 'available', 4.9, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80', 140000, 'NXB Trẻ', 2018, 'Kiệt tác khoa học của Stephen Hawking giải thích những khái niệm phức tạp của vũ trụ học như Big Bang, Hố đen và Lý thuyết dây một cách dễ hiểu.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-10', 'Gen - Lịch Sử Mật Mã Sự Sống', 'Siddhartha Mukherjee', 'science', 'Khoa học tự nhiên', 'new', 'cover-gradient-1', 3, 'available', 4.8, 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=400&q=80', 220000, 'NXB Dân Trí', 2021, 'Một biên niên sử đồ sộ về sự ra đời, phát triển và tương lai của di truyền học, đặt ra những câu hỏi đạo đức sâu sắc về việc can thiệp vào mã di truyền con người.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-11', 'Cơ Thể Tự Chữa Lành', 'Anthony William', 'health', 'Y học & Đời sống', 'new', 'cover-gradient-2', 4, 'available', 4.4, 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80', 160000, 'NXB Thanh Niên', 2022, 'Khám phá khả năng tự phục hồi kỳ diệu của cơ thể con người thông qua chế độ dinh dưỡng lành mạnh, thanh lọc cơ thể bằng các loại thực phẩm tự nhiên.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-12', 'Dinh Dưỡng Học Bị Thất Truyền', 'TS. Vương Đào', 'health', 'Y học & Đời sống', 'popular', 'cover-gradient-6', 2, 'available', 4.6, 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80', 135000, 'NXB Y Học', 2021, 'Cuốn sách lý giải mối liên hệ mật thiết giữa thói quen ăn uống và bệnh tật, từ đó hướng dẫn cách dùng thực phẩm để phục hồi sức khỏe tự nhiên.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-13', 'Nhà Giả Kim', 'Paulo Coelho', 'literature', 'Văn học nghệ thuật', 'popular', 'cover-gradient-3', 10, 'available', 4.8, 'https://images.unsplash.com/photo-1474932430478-367db26836c1?auto=format&fit=crop&w=400&q=80', 79000, 'NXB Hội Nhà Văn', 2020, 'Câu chuyện ngụ ngôn đầy triết lý kể về chuyến hành trình theo đuổi giấc mơ của cậu bé chăn cừu Santiago, truyền cảm hứng sống cho hàng triệu độc giả.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-14', 'Đắc Nhân Tâm', 'Dale Carnegie', 'skills', 'Phát triển bản thân', 'popular', 'cover-gradient-4', 8, 'available', 4.9, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80', 88000, 'NXB Tổng Hợp', 2019, 'Cuốn sách nghệ thuật ứng xử kinh điển mọi thời đại, đưa ra những lời khuyên vàng về cách thu phục lòng người và xây dựng mối quan hệ xã hội tốt đẹp.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-15', 'Cha Giàu Cha Nghèo', 'Robert Kiyosaki', 'economy', 'Kinh tế học', 'popular', 'cover-gradient-2', 6, 'available', 4.7, 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?auto=format&fit=crop&w=400&q=80', 99000, 'NXB Trẻ', 2021, 'Chia sẻ các bài học tài chính thực tế và sự khác biệt trong tư duy về tiền bạc giữa người giàu và người nghèo, giúp bạn bắt đầu con đường tự do tài chính.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-16', 'Quốc Gia Khởi Nghiệp', 'Dan Senor', 'economy', 'Kinh tế học', 'new', 'cover-gradient-5', 4, 'available', 4.6, 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=400&q=80', 115000, 'NXB Thế Giới', 2020, 'Câu chuyện kỳ tích về sự phát triển thần kỳ của Israel - một quốc gia nhỏ bé giữa sa mạc và chiến tranh đã vươn lên thành trung tâm công nghệ thế giới.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-17', 'Vũ Trụ (Ấn Bản Mới)', 'Carl Sagan', 'science', 'Khoa học tự nhiên', 'popular', 'cover-gradient-6', 3, 'available', 4.9, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80', 195000, 'NXB Trẻ', 2021, 'Hành trình khám phá không gian vô tận của Carl Sagan, đan xen triết học, lịch sử và khoa học để vẽ nên bức tranh tráng lệ về vị trí của loài người trong vũ trụ.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-18', 'Lập Trình Web React Hiện Đại', 'Nhiều Tác Giả', 'ai', 'Công nghệ & AI', 'digital', 'cover-gradient-1', 99, 'digital', 4.7, 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=400&q=80', 0, 'NXB Khoa Học Kỹ Thuật', 2023, 'Hướng dẫn xây dựng các ứng dụng web đơn trang (SPA) hiệu năng cao sử dụng thư viện React.js, từ các khái niệm cơ bản đến React Hooks và Redux.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-19', 'Tập Bản Đồ Đà Nẵng Xưa Nay', 'Lưu Anh Rô', 'history', 'Lịch sử địa phương', 'popular', 'cover-gradient-3', 2, 'available', 4.8, 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=400&q=80', 250000, 'NXB Đà Nẵng', 2018, 'Công trình địa lý quý giá lưu giữ các bản đồ cổ và hiện đại của Đà Nẵng, giúp độc giả hình dung rõ nét sự thay đổi địa giới hành chính qua lịch sử.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-20', 'Sức Mạnh Của Thói Quen', 'Charles Duhigg', 'skills', 'Phát triển bản thân', 'new', 'cover-gradient-4', 5, 'available', 4.5, 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80', 105000, 'NXB Lao Động', 2020, 'Giải thích cơ chế hình thành thói quen trong não bộ và cách thức thay đổi các thói quen xấu để đạt được năng suất vượt trội trong công việc và cuộc sống.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-21', 'Trí Tuệ Nhân Tạo Cho Người Không Chuyên', 'John McCarthy', 'ai', 'Công nghệ & AI', 'popular', 'cover-gradient-3', 0, 'borrowed', 4.7, 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80', 0, 'NXB Khoa Học', 2021, 'Cuốn sách nhập môn dễ hiểu về trí tuệ nhân tạo dành cho người không có nền tảng tin học.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-22', 'Tư Duy Nhanh Và Chậm', 'Daniel Kahneman', 'skills', 'Phát triển bản thân', 'popular', 'cover-gradient-2', 5, 'available', 4.8, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80', 120000, 'NXB Thế Giới', 2018, 'Tác phẩm kinh điển về hai hệ thống tư duy chi phối quyết định của con người.')");
        await query.run("INSERT OR REPLACE INTO books VALUES ('book-23', 'Clean Code', 'Robert C. Martin', 'ai', 'Công nghệ & AI', 'popular', 'cover-gradient-6', 99, 'digital', 5.0, 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=400&q=80', 0, 'NXB Giáo Dục', 2015, 'Cuốn sách gối đầu giường của mọi lập trình viên để viết mã nguồn sạch và dễ bảo trì.')");
        console.log('-> Đã chèn dữ liệu mẫu bảng books cập nhật mới.');

        // 3. Tạo bảng Borrow Slips
        await query.run(`
            CREATE TABLE IF NOT EXISTS borrow_slips (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                fullname TEXT NOT NULL,
                cardId TEXT NOT NULL,
                bookId TEXT NOT NULL,
                bookTitle TEXT NOT NULL,
                borrowDate TEXT NOT NULL,
                dueDate TEXT NOT NULL,
                returnDate TEXT,
                status TEXT NOT NULL,
                fineAmount INTEGER DEFAULT 0,
                paymentStatus TEXT DEFAULT 'unpaid'
            )
        `);

        // Seed slips
        const slipCount = await query.get("SELECT COUNT(*) as count FROM borrow_slips");
        if (slipCount.count === 0) {
            await query.run("INSERT INTO borrow_slips VALUES ('slip-1001', 'reader1', 'Lê Hoàng Nam', 'TVDN-0001', 'book-1', 'Kỷ Nguyên Trí Tuệ Nhân Tạo', '2026-06-25', '2026-07-09', NULL, 'borrowing', 0, 'unpaid')");
            await query.run("INSERT INTO borrow_slips VALUES ('slip-1002', 'reader1', 'Lê Hoàng Nam', 'TVDN-0001', 'book-2', 'Địa Chí Lịch Sử Đà Nẵng', '2026-06-10', '2026-06-24', NULL, 'overdue', 65000, 'unpaid')");
            await query.run("INSERT INTO borrow_slips VALUES ('slip-1003', 'reader2', 'Trần Thị Mỹ Linh', 'TVDN-0002', 'book-4', 'Mắt Biếc (Bản Đặc Biệt)', '2026-06-28', '2026-07-12', NULL, 'borrowing', 0, 'unpaid')");
            await query.run("INSERT INTO borrow_slips VALUES ('slip-1004', 'reader2', 'Trần Thị Mỹ Linh', 'TVDN-0002', 'book-3', 'Tư Duy Ngược & Tư Duy Mở', '2026-05-15', '2026-05-29', '2026-05-28', 'returned', 0, 'paid')");
            await query.run("INSERT INTO borrow_slips VALUES ('slip-1005', 'reader4', 'Hoàng Anh Tuấn', 'TVDN-0004', 'book-8', 'Kỹ Năng Giao Tiếp Trong Công Việc', '2026-05-01', '2026-05-15', '2026-05-18', 'returned', 15000, 'paid')");
            console.log('-> Đã chèn dữ liệu mẫu bảng borrow_slips.');
        }

        // 4. Tạo bảng Settings
        await query.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // Seed settings
        const settingsCount = await query.get("SELECT COUNT(*) as count FROM settings");
        if (settingsCount.count === 0) {
            await query.run("INSERT INTO settings VALUES ('libraryName', 'Thư viện Tổng hợp Đà Nẵng')");
            await query.run("INSERT INTO settings VALUES ('address', '46 Bạch Đằng, Hải Châu, Đà Nẵng')");
            await query.run("INSERT INTO settings VALUES ('phone', '(0236) 3822603')");
            await query.run("INSERT INTO settings VALUES ('email', 'tvdn@danang.gov.vn')");
            await query.run("INSERT INTO settings VALUES ('maxBorrowDays', '14')");
            await query.run("INSERT INTO settings VALUES ('maxBorrowBooks', '5')");
            await query.run("INSERT INTO settings VALUES ('overdueFinePerDay', '5000')");
            console.log('-> Đã chèn cài đặt mặc định.');
        }

        // 5. Tạo bảng Orders
        await query.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                fullname TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT NOT NULL,
                totalAmount INTEGER NOT NULL,
                orderDate TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                paymentMethod TEXT NOT NULL DEFAULT 'bank',
                paymentStatus TEXT NOT NULL DEFAULT 'unpaid'
            )
        `);

        // 6. Tạo bảng Order Items
        await query.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                orderId TEXT NOT NULL,
                bookId TEXT NOT NULL,
                bookTitle TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price INTEGER NOT NULL,
                PRIMARY KEY (orderId, bookId),
                FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        // Seed orders mẫu
        const ordersCount = await query.get("SELECT COUNT(*) as count FROM orders");
        if (ordersCount.count === 0) {
            await query.run("INSERT INTO orders VALUES ('order-1001', 'reader1', 'Lê Hoàng Nam', '0935987654', '12 Lê Lợi, Hải Châu, Đà Nẵng', 215000, '2026-07-06', 'pending', 'bank', 'unpaid')");
            await query.run("INSERT INTO order_items VALUES ('order-1001', 'book-1', 'Kỷ Nguyên Trí Tuệ Nhân Tạo', 1, 120000)");
            await query.run("INSERT INTO order_items VALUES ('order-1001', 'book-3', 'Tư Duy Ngược & Tư Duy Mở', 1, 95000)");

            await query.run("INSERT INTO orders VALUES ('order-1002', 'reader2', 'Trần Thị Mỹ Linh', '0914112233', '85 Nguyễn Văn Linh, Đà Nẵng', 110000, '2026-07-05', 'completed', 'momo', 'paid')");
            await query.run("INSERT INTO order_items VALUES ('order-1002', 'book-4', 'Mắt Biếc (Bản Đặc Biệt)', 1, 110000)");
            console.log('-> Đã chèn dữ liệu đơn hàng mẫu.');
        }

        console.log('>>> KHỞI TẠO DATABASE HOÀN TẤT <<<');

    } catch (e) {
        console.error('Lỗi khởi tạo database:', e.message);
    }
}

module.exports = {
    query,
    db
};

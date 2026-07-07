/**
 * Thư viện Đà Nẵng - Express Web Server
 * Tích hợp REST API, xác thực Google OAuth, cơ sở dữ liệu SQLite và cổng thanh toán MoMo.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
// Native fetch is used instead of axios to reduce dependencies
const { OAuth2Client } = require('google-auth-library');
const DB = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve tĩnh thư mục public (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo Google Auth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==================== 1. API XÁC THỰC (AUTHENTICATION) ====================

// Đăng nhập tài khoản thông thường
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
        }

        const user = await DB.query.get(
            "SELECT * FROM users WHERE (username = ? OR cardId = ?) AND password = ?",
            [username.trim().toLowerCase(), username.trim().toUpperCase(), password]
        );

        if (!user) {
            return res.status(401).json({ success: false, message: 'Sai tên đăng nhập, mã thẻ hoặc mật khẩu.' });
        }

        if (user.status === 'locked') {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn hiện đang bị khóa thẻ.' });
        }

        res.json({ success: true, user: { username: user.username, fullname: user.fullname, role: user.role, cardId: user.cardId, phone: user.phone } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Đăng ký tài khoản bạn đọc mới
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, fullname, phone } = req.body;
        
        if (!username || !password || !fullname || !phone) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }

        const cleanUsername = username.trim().toLowerCase();
        
        // Kiểm tra xem username đã tồn tại chưa
        const existingUser = await DB.query.get("SELECT username FROM users WHERE username = ?", [cleanUsername]);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập này đã có người sử dụng.' });
        }

        // Tạo mã thẻ bạn đọc ngẫu nhiên
        const cardId = 'TVDN-' + Math.floor(1000 + Math.random() * 9000);

        await DB.query.run(
            "INSERT INTO users (username, password, role, fullname, cardId, phone, status, borrowCount) VALUES (?, ?, 'reader', ?, ?, ?, 'active', 0)",
            [cleanUsername, password, fullname, cardId, phone]
        );

        res.status(201).json({
            success: true,
            message: 'Đăng ký thẻ bạn đọc thành công!',
            user: { username: cleanUsername, fullname, role: 'reader', cardId, phone }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Xác thực Google OAuth Token (Đăng nhập Google)
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy token xác thực của Google.' });
        }

        let googlePayload = null;

        // Nếu người dùng đã cài đặt GOOGLE_CLIENT_ID thật sự
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com') {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });
                googlePayload = ticket.getPayload();
            } catch (authErr) {
                console.warn('Xác thực Google JWT thất bại, chuyển sang chế độ giả lập:', authErr.message);
            }
        }

        // Chế độ mô phỏng / Mock login (dùng base64 decode nếu Client ID trống hoặc lỗi)
        if (!googlePayload) {
            try {
                const base64Url = credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(c => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                googlePayload = JSON.parse(jsonPayload);
            } catch (parseErr) {
                return res.status(400).json({ success: false, message: 'JWT Token Google không hợp lệ.' });
            }
        }

        const email = googlePayload.email;
        const fullname = googlePayload.name || 'Người dùng Google';
        
        // Rút gọn email làm tên đăng nhập
        const username = email.split('@')[0].replace(/\./g, '').toLowerCase();

        // Kiểm tra xem user này đã tồn tại trong DB chưa
        let user = await DB.query.get("SELECT * FROM users WHERE username = ?", [username]);

        if (!user) {
            // Đăng ký tự động tài khoản bạn đọc mới
            const cardId = 'TVDN-GG' + Math.floor(100 + Math.random() * 900);
            const randomPassword = crypto.randomBytes(8).toString('hex');
            
            await DB.query.run(
                "INSERT INTO users (username, password, role, fullname, cardId, phone, status, borrowCount) VALUES (?, ?, 'reader', ?, ?, 'Google Account', 'active', 0)",
                [username, randomPassword, fullname, cardId]
            );

            user = { username, fullname, role: 'reader', cardId, phone: 'Google Account', status: 'active' };
        }

        if (user.status === 'locked') {
            return res.status(403).json({ success: false, message: 'Tài khoản liên kết Google này đang bị khóa thẻ.' });
        }

        res.json({
            success: true,
            user: { username: user.username, fullname: user.fullname, role: user.role, cardId: user.cardId, phone: user.phone }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 2. API QUẢN LÝ SÁCH (BOOKS) ====================

// Lấy danh sách toàn bộ sách
app.get('/api/books', async (req, res) => {
    try {
        const books = await DB.query.all("SELECT * FROM books");
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== 3. API QUẢN LÝ ĐỘC GIẢ (READERS) ====================

// Lấy danh sách độc giả (role = 'reader')
app.get('/api/readers', async (req, res) => {
    try {
        const readers = await DB.query.all("SELECT username, fullname, cardId, phone, status, borrowCount FROM users WHERE role = 'reader'");
        res.json(readers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Thêm mới độc giả
app.post('/api/readers', async (req, res) => {
    try {
        const { username, password, fullname, phone, cardId } = req.body;
        if (!username || !password || !fullname || !phone || !cardId) {
            return res.status(400).json({ success: false, message: 'Điền thiếu thông tin độc giả.' });
        }

        const existingUser = await DB.query.get("SELECT username FROM users WHERE username = ?", [username.trim().toLowerCase()]);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
        }

        await DB.query.run(
            "INSERT INTO users (username, password, role, fullname, cardId, phone, status, borrowCount) VALUES (?, ?, 'reader', ?, ?, ?, 'active', 0)",
            [username.trim().toLowerCase(), password, fullname, cardId.trim().toUpperCase(), phone]
        );

        res.json({ success: true, message: 'Thêm độc giả mới thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Cập nhật thông tin độc giả
app.put('/api/readers/:username', async (req, res) => {
    try {
        const { fullname, phone, cardId } = req.body;
        const username = req.params.username;

        await DB.query.run(
            "UPDATE users SET fullname = ?, phone = ?, cardId = ? WHERE username = ?",
            [fullname, phone, cardId.trim().toUpperCase(), username]
        );

        res.json({ success: true, message: 'Cập nhật thông tin độc giả thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Khóa / mở khóa độc giả
app.patch('/api/readers/:username/toggle-lock', async (req, res) => {
    try {
        const username = req.params.username;
        const user = await DB.query.get("SELECT status FROM users WHERE username = ?", [username]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy độc giả.' });
        }

        const newStatus = user.status === 'active' ? 'locked' : 'active';
        await DB.query.run("UPDATE users SET status = ? WHERE username = ?", [newStatus, username]);

        res.json({ success: true, status: newStatus });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Xóa độc giả
app.delete('/api/readers/:username', async (req, res) => {
    try {
        const username = req.params.username;
        await DB.query.run("DELETE FROM users WHERE username = ?", [username]);
        res.json({ success: true, message: 'Đã xóa độc giả thành công.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 4. API QUẢN LÝ MƯỢN TRẢ SÁCH (SLIPS) ====================

// Lấy danh sách phiếu mượn
app.get('/api/slips', async (req, res) => {
    try {
        const slips = await DB.query.all("SELECT * FROM borrow_slips ORDER BY borrowDate DESC");
        res.json(slips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Đăng ký mượn sách mới
app.post('/api/slips', async (req, res) => {
    try {
        const { username, bookId } = req.body;
        if (!username || !bookId) {
            return res.status(400).json({ success: false, message: 'Đầu vào thiếu tên độc giả hoặc mã sách.' });
        }

        const user = await DB.query.get("SELECT * FROM users WHERE username = ?", [username]);
        const book = await DB.query.get("SELECT * FROM books WHERE id = ?", [bookId]);

        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin độc giả.' });
        if (user.status === 'locked') return { success: false, message: 'Thẻ thư viện của bạn đang bị khóa.' };
        if (!book) return res.status(404).json({ success: false, message: 'Sách không tồn tại.' });

        const settings = {};
        const settingsRows = await DB.query.all("SELECT * FROM settings");
        settingsRows.forEach(r => settings[r.key] = r.value);

        if (book.status !== 'digital') {
            if (book.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Sách hiện đã hết trên kệ.' });
            }
            // Giảm số lượng
            const newQty = book.quantity - 1;
            const newStatus = newQty === 0 ? 'borrowed' : 'available';
            await DB.query.run("UPDATE books SET quantity = ?, status = ? WHERE id = ?", [newQty, newStatus, book.id]);
        }

        // Tăng borrowCount của user
        await DB.query.run("UPDATE users SET borrowCount = borrowCount + 1 WHERE username = ?", [user.username]);

        const today = new Date();
        const borrowDateStr = today.toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + parseInt(settings.maxBorrowDays || 14));
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const slipId = 'slip-' + Math.floor(1000 + Math.random() * 9000);

        await DB.query.run(
            "INSERT INTO borrow_slips (id, username, fullname, cardId, bookId, bookTitle, borrowDate, dueDate, returnDate, status, fineAmount, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'borrowing', 0, 'unpaid')",
            [slipId, user.username, user.fullname, user.cardId, book.id, book.title, borrowDateStr, dueDateStr]
        );

        res.json({
            success: true,
            slip: { id: slipId, dueDate: dueDateStr }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Trả sách
app.post('/api/slips/:id/return', async (req, res) => {
    try {
        const slipId = req.params.id;
        const slip = await DB.query.get("SELECT * FROM borrow_slips WHERE id = ?", [slipId]);
        if (!slip) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu mượn.' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Tính trễ hạn phạt tiền
        const dueDate = new Date(slip.dueDate);
        const returnDate = new Date(todayStr);
        let fineAmount = 0;
        let paymentStatus = 'paid';
        let status = 'returned';

        if (returnDate > dueDate) {
            const diffTime = Math.abs(returnDate - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const settingsRows = await DB.query.all("SELECT * FROM settings");
            const settings = {};
            settingsRows.forEach(r => settings[r.key] = r.value);
            
            fineAmount = diffDays * parseInt(settings.overdueFinePerDay || 5000);
            paymentStatus = 'unpaid';
        }

        // Cập nhật phiếu mượn
        await DB.query.run(
            "UPDATE borrow_slips SET returnDate = ?, status = ?, fineAmount = ?, paymentStatus = ? WHERE id = ?",
            [todayStr, status, fineAmount, paymentStatus, slipId]
        );

        // Trả lại số lượng sách trên kệ
        const book = await DB.query.get("SELECT * FROM books WHERE id = ?", [slip.bookId]);
        if (book && book.status !== 'digital') {
            await DB.query.run("UPDATE books SET quantity = quantity + 1, status = 'available' WHERE id = ?", [book.id]);
        }

        // Giảm borrowCount của user
        await DB.query.run("UPDATE users SET borrowCount = CASE WHEN borrowCount > 0 THEN borrowCount - 1 ELSE 0 END WHERE username = ?", [slip.username]);

        res.json({
            success: true,
            fineAmount,
            paymentStatus
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Gia hạn phiếu mượn
app.post('/api/slips/:id/renew', async (req, res) => {
    try {
        const slipId = req.params.id;
        const slip = await DB.query.get("SELECT * FROM borrow_slips WHERE id = ?", [slipId]);
        if (!slip) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu mượn.' });
        }

        const newDueDate = new Date(slip.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 14);
        const newDueDateStr = newDueDate.toISOString().split('T')[0];

        // Nếu gia hạn qua ngày hiện tại thì gỡ phạt quá hạn
        const today = new Date();
        const status = newDueDate >= today ? 'borrowing' : slip.status;

        await DB.query.run("UPDATE borrow_slips SET dueDate = ?, status = ? WHERE id = ?", [newDueDateStr, status, slipId]);

        res.json({ success: true, newDueDate: newDueDateStr });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 5. API CÀI ĐẶT (SETTINGS) ====================

app.get('/api/settings', async (req, res) => {
    try {
        const rows = await DB.query.all("SELECT * FROM settings");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await DB.query.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value.toString()]);
        }
        res.json({ success: true, message: 'Cập nhật cài đặt thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 6. API THANH TOÁN (PAYMENTS) ====================

// Lấy thông tin cấu hình VietQR của ngân hàng (Từ .env)
app.get('/api/payment/vietqr-config', (req, res) => {
    res.json({
        bankId: process.env.BANK_ID || 'MB',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '0905123456',
        accountName: process.env.BANK_ACCOUNT_NAME || 'NGUYEN VAN THU THU'
    });
});

// Gọi cổng thanh toán MoMo thực tế để lấy Link/QR Code
app.post('/api/payment/momo', async (req, res) => {
    try {
        const { slipId, amount } = req.body;
        if (!slipId || !amount) {
            return res.status(400).json({ success: false, message: 'Thiếu mã phiếu mượn hoặc số tiền.' });
        }

        const partnerCode = process.env.MOMO_PARTNER_CODE;
        const accessKey = process.env.MOMO_ACCESS_KEY;
        const secretKey = process.env.MOMO_SECRET_KEY;
        const endpoint = process.env.MOMO_API_ENDPOINT;

        // Nếu thiếu API credentials MoMo, trả về mã mockup để chạy thử
        if (!partnerCode || partnerCode === 'MOMO_PARTNER_CODE_HERE') {
            console.warn('Momo API credentials không tồn tại. Đang phục vụ liên kết giả lập thanh toán.');
            // Trả về mockup URL
            return res.json({
                success: true,
                isMock: true,
                payUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=momo://pay?recipient=0905123456%26amount=${amount}%26desc=TVDN%20PHAT%20${slipId}`
            });
        }

        // Tạo tham số yêu cầu MoMo Capture Wallet chính thức
        const requestId = partnerCode + new Date().getTime();
        const orderId = slipId + '-' + new Date().getTime();
        const orderInfo = `Thanh toan phi phat tre han thu vien Da Nang - ${slipId}`;
        const redirectUrl = `http://localhost:${PORT}/admin.html`;
        const ipnUrl = `http://localhost:${PORT}/api/payment/momo-ipn`; // Webhook callback
        const requestType = "captureWallet";
        const extraData = "";

        // Tạo Signature SHA256 HMAC theo thứ tự alphabetic quy chuẩn của MoMo
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        // Body request gửi tới MoMo
        const requestBody = {
            partnerCode,
            partnerName: "Thư viện Đà Nẵng",
            storeId: "Thư viện Đà Nẵng",
            requestId,
            amount: amount.toString(),
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            lang: "vi",
            requestType,
            autoCapture: true,
            extraData,
            signature
        };

        // Gửi POST request tới Endpoint MoMo bằng native fetch
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        if (response.ok && responseData.resultCode === 0) {
            res.json({
                success: true,
                isMock: false,
                payUrl: responseData.payUrl // Link/QR Code Momo trả về
            });
        } else {
            res.status(400).json({
                success: false,
                message: responseData.message || 'Lỗi gọi API MoMo.'
            });
        }

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Webhook callback (IPN) từ MoMo sau khi khách thanh toán thành công
app.post('/api/payment/momo-ipn', async (req, res) => {
    try {
        const { orderId, resultCode, amount, extraData } = req.body;
        console.log(`Nhận IPN MoMo: Hóa đơn ${orderId}, kết quả: ${resultCode}`);

        if (resultCode === 0) {
            // Lấy slipId từ orderId (cấu trúc: slipId-timestamp)
            const slipId = orderId.split('-')[0];
            await DB.query.run("UPDATE borrow_slips SET paymentStatus = 'paid' WHERE id = ?", [slipId]);
            console.log(`-> Đã xác nhận đóng phạt thành công qua MoMo IPN cho phiếu mượn: ${slipId}`);
        }
        res.status(204).send(); // Phản hồi không nội dung quy chuẩn cho MoMo
    } catch (err) {
        console.error('Lỗi IPN MoMo:', err.message);
        res.status(500).send();
    }
});

// Xác nhận thanh toán (Thủ công / Dành cho VietQR hoặc nút xác nhận mô phỏng)
app.post('/api/payment/confirm', async (req, res) => {
    try {
        const { slipId } = req.body;
        if (!slipId) {
            return res.status(400).json({ success: false, message: 'Thiếu mã phiếu mượn.' });
        }

        await DB.query.run("UPDATE borrow_slips SET paymentStatus = 'paid' WHERE id = ?", [slipId]);
        res.json({ success: true, message: 'Hóa đơn đã được cập nhật thành Đã thanh toán.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 7. SAO LƯU & KHÔI PHỤC DATABASE ====================

app.get('/api/backup', async (req, res) => {
    try {
        const users = await DB.query.all("SELECT * FROM users");
        const books = await DB.query.all("SELECT * FROM books");
        const slips = await DB.query.all("SELECT * FROM borrow_slips");
        const settings = await DB.query.all("SELECT * FROM settings");
        const orders = await DB.query.all("SELECT * FROM orders");
        const orderItems = await DB.query.all("SELECT * FROM order_items");

        res.json({ users, books, slips, settings, orders, orderItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/restore', async (req, res) => {
    try {
        const { users, books, slips, settings, orders, orderItems } = req.body;
        if (!users || !books || !slips || !settings) {
            return res.status(400).json({ success: false, message: 'Dữ liệu khôi phục không hợp lệ.' });
        }

        // Xóa sạch bảng cũ
        await DB.query.run("DELETE FROM users");
        await DB.query.run("DELETE FROM books");
        await DB.query.run("DELETE FROM borrow_slips");
        await DB.query.run("DELETE FROM settings");
        await DB.query.run("DELETE FROM orders");
        await DB.query.run("DELETE FROM order_items");

        // Nhập users
        for (const u of users) {
            await DB.query.run("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [u.username, u.password, u.role, u.fullname, u.cardId, u.phone, u.status, u.borrowCount]);
        }
        // Nhập books
        for (const b of books) {
            await DB.query.run("INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [b.id, b.title, b.author, b.category, b.categoryName, b.tag, b.coverGradient, b.quantity, b.status, b.rating, b.coverUrl || '', b.price || 0]);
        }
        // Nhập slips
        for (const s of slips) {
            await DB.query.run("INSERT INTO borrow_slips VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [s.id, s.username, s.fullname, s.cardId, s.bookId, s.bookTitle, s.borrowDate, s.dueDate, s.returnDate, s.status, s.fineAmount, s.paymentStatus]);
        }
        // Nhập settings
        for (const set of settings) {
            await DB.query.run("INSERT INTO settings VALUES (?, ?)", [set.key, set.value]);
        }
        // Nhập orders
        if (orders) {
            for (const o of orders) {
                await DB.query.run("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [o.id, o.username, o.fullname, o.phone, o.address, o.totalAmount, o.orderDate, o.status, o.paymentMethod, o.paymentStatus]);
            }
        }
        // Nhập order items
        if (orderItems) {
            for (const oi of orderItems) {
                await DB.query.run("INSERT INTO order_items VALUES (?, ?, ?, ?, ?)", [oi.orderId, oi.bookId, oi.bookTitle, oi.quantity, oi.price]);
            }
        }

        res.json({ success: true, message: 'Khôi phục toàn bộ database thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 8. API QUẢN LÝ ĐƠN HÀNG MUA SÁCH (ORDERS) ====================

// 1. Đặt hàng mới (mua sách)
app.post('/api/orders', async (req, res) => {
    try {
        const { username, fullname, phone, address, items, paymentMethod } = req.body;
        if (!username || !fullname || !phone || !address || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Đầu vào thiếu thông tin đặt hàng.' });
        }

        const orderId = 'order-' + Math.floor(1000 + Math.random() * 9000);
        const orderDate = new Date().toISOString().split('T')[0];

        let totalAmount = 0;
        for (const item of items) {
            const book = await DB.query.get("SELECT * FROM books WHERE id = ?", [item.bookId]);
            if (!book) {
                return res.status(404).json({ success: false, message: `Không tìm thấy sách: ${item.bookTitle}` });
            }
            if (book.status !== 'digital' && book.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `Sách "${book.title}" không đủ số lượng trong kho.` });
            }
            totalAmount += book.price * item.quantity;
        }

        // Tạo order
        await DB.query.run(
            "INSERT INTO orders (id, username, fullname, phone, address, totalAmount, orderDate, status, paymentMethod, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'unpaid')",
            [orderId, username, fullname, phone, address, totalAmount, orderDate, paymentMethod]
        );

        // Tạo order_items & trừ số lượng sách
        for (const item of items) {
            const book = await DB.query.get("SELECT * FROM books WHERE id = ?", [item.bookId]);
            await DB.query.run(
                "INSERT INTO order_items (orderId, bookId, bookTitle, quantity, price) VALUES (?, ?, ?, ?, ?)",
                [orderId, item.bookId, book.title, item.quantity, book.price]
            );

            if (book.status !== 'digital') {
                const newQty = book.quantity - item.quantity;
                const newStatus = newQty === 0 ? 'borrowed' : 'available';
                await DB.query.run("UPDATE books SET quantity = ?, status = ? WHERE id = ?", [newQty, newStatus, book.id]);
            }
        }

        res.json({ success: true, orderId, totalAmount, message: 'Đặt hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Lấy danh sách đơn hàng (Admin)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await DB.query.all("SELECT * FROM orders ORDER BY orderDate DESC");
        const items = await DB.query.all("SELECT * FROM order_items");
        
        // Group items by orderId
        const itemsMap = {};
        items.forEach(it => {
            if (!itemsMap[it.orderId]) itemsMap[it.orderId] = [];
            itemsMap[it.orderId].push(it);
        });

        // Attach items to orders
        orders.forEach(o => {
            o.items = itemsMap[o.id] || [];
        });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Lấy danh sách đơn hàng của bạn đọc
app.get('/api/orders/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const orders = await DB.query.all("SELECT * FROM orders WHERE username = ? ORDER BY orderDate DESC", [username]);
        const items = await DB.query.all("SELECT * FROM order_items WHERE orderId IN (SELECT id FROM orders WHERE username = ?)", [username]);

        const itemsMap = {};
        items.forEach(it => {
            if (!itemsMap[it.orderId]) itemsMap[it.orderId] = [];
            itemsMap[it.orderId].push(it);
        });

        orders.forEach(o => {
            o.items = itemsMap[o.id] || [];
        });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Thanh toán đơn hàng (VietQR / MoMo simulation)
app.post('/api/orders/:id/pay', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await DB.query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Đơn hàng không tồn tại.' });
        }

        await DB.query.run("UPDATE orders SET paymentStatus = 'paid', status = 'paid' WHERE id = ?", [orderId]);
        res.json({ success: true, message: 'Thanh toán đơn hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Cập nhật trạng thái đơn hàng (Admin)
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body; // status: pending, paid, shipping, completed
        
        const order = await DB.query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Đơn hàng không tồn tại.' });
        }

        // Nếu chuyển sang completed thì tự động đánh dấu paymentStatus = 'paid'
        let paymentStatus = order.paymentStatus;
        if (status === 'completed' || status === 'paid') {
            paymentStatus = 'paid';
        }

        await DB.query.run("UPDATE orders SET status = ?, paymentStatus = ? WHERE id = ?", [status, paymentStatus, orderId]);
        res.json({ success: true, message: 'Cập nhật trạng thái đơn hàng thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Chuyển hướng các trang khác sang trang chủ (Fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi chạy Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`Server Thư viện số Đà Nẵng đang chạy tại:`);
        console.log(`👉 http://localhost:${PORT}`);
        console.log(`====================================================`);
    });
}

module.exports = app;

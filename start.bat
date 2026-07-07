@echo off
chcp 65001 > nul
echo ========================================================
echo   Khởi chạy Hệ thống Thư viện Đà Nẵng (Fullstack Server)
echo ========================================================
echo.

:: Kiểm tra cài đặt Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [CẢNH BÁO] Không tìm thấy Node.js trên hệ thống của bạn!
    echo Vui lòng tải xuống và cài đặt Node.js từ https://nodejs.org/
    echo sau đó khởi động lại cửa sổ dòng lệnh này.
    echo.
    pause
    exit /b 1
)

echo [+] Đã tìm thấy Node.js. Đang tiến hành cài đặt thư viện NPM...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Cài đặt các thư viện NPM thất bại. Vui lòng kiểm tra kết nối mạng.
    echo.
    pause
    exit /b 1
)

echo.
echo [+] Đã cài đặt thư viện thành công. Khởi chạy Express Server...
echo.
call npm start
pause

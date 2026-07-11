/**
 * animations.js — Scroll-trigger + Page Transition for Thư Viện Đà Nẵng
 * Sử dụng Intersection Observer API để kích hoạt animation khi cuộn
 */

(function () {
    'use strict';

    // ========================= SCROLL-TRIGGERED ANIMATIONS =========================
    const animateObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    animateObserver.unobserve(entry.target); // Chỉ chạy 1 lần
                }
            });
        },
        {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px',
        }
    );

    // Quan sát tất cả phần tử có data-animate
    function initScrollAnimations() {
        const elements = document.querySelectorAll('[data-animate]');
        elements.forEach((el) => animateObserver.observe(el));
    }

    // ========================= HEADER SCROLL EFFECT =========================
    function initHeaderScroll() {
        const header = document.querySelector('.app-header');
        if (!header) return;

        let lastScrollY = window.scrollY;

        window.addEventListener(
            'scroll',
            () => {
                const currentScrollY = window.scrollY;
                if (currentScrollY > 60) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
                lastScrollY = currentScrollY;
            },
            { passive: true }
        );
    }

    // ========================= PAGE TRANSITION =========================
    function initPageTransitions() {
        // Fade-in khi trang vừa tải xong
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.3s ease';
        window.addEventListener('load', () => {
            document.body.style.opacity = '1';
        });

        // Fade-out khi click link (chuyển trang)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            // Bỏ qua: anchor, javascript, external, modal trigger
            if (
                !href ||
                href.startsWith('#') ||
                href.startsWith('javascript') ||
                href.startsWith('mailto') ||
                href.startsWith('tel') ||
                link.target === '_blank' ||
                e.ctrlKey || e.metaKey || e.shiftKey
            ) return;

            e.preventDefault();
            document.body.style.opacity = '0';
            setTimeout(() => {
                window.location.href = href;
            }, 260);
        });
    }

    // ========================= POPULARITY BAR ANIMATION =========================
    // Animate thanh % phổ biến khi tải trang
    function initPopularityBars() {
        const bars = document.querySelectorAll('.popularity-bar');
        bars.forEach((bar) => {
            const targetWidth = bar.style.width;
            bar.style.width = '0';
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, 400);
        });
    }

    // ========================= ACTIVE NAV HIGHLIGHT =========================
    function initActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.main-nav a');
        navLinks.forEach((link) => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // ========================= SMOOTH COUNTER ANIMATION =========================
    function animateCounter(el, target, duration = 1200) {
        let start = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                el.textContent = target.toLocaleString('vi-VN') + (el.dataset.suffix || '');
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(start).toLocaleString('vi-VN') + (el.dataset.suffix || '');
            }
        }, 16);
    }

    function initCounters() {
        const counters = document.querySelectorAll('[data-counter]');
        if (!counters.length) return;

        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.dataset.counter, 10);
                    animateCounter(el, target);
                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach((el) => counterObserver.observe(el));
    }

    // ========================= INIT =========================
    document.addEventListener('DOMContentLoaded', () => {
        initScrollAnimations();
        initHeaderScroll();
        initPopularityBars();
        initActiveNav();
        initCounters();
    });

    // Page transitions sau khi DOM xong
    initPageTransitions();

})();

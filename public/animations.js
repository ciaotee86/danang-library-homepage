/**
 * animations.js — Scroll-trigger + Page Transition + Sidebar helpers
 * Thư Viện Số Đà Nẵng v3.0 — Sidebar Dashboard Layout
 */

(function () {
    'use strict';

    // ========================= SCROLL-TRIGGERED ANIMATIONS =========================
    const animateObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    animateObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.10, rootMargin: '0px 0px -30px 0px' }
    );

    function initScrollAnimations() {
        document.querySelectorAll('[data-animate]').forEach(el => animateObserver.observe(el));
    }

    // ========================= TOPBAR SCROLL EFFECT =========================
    function initTopbarScroll() {
        const topbar = document.querySelector('.topbar');
        if (!topbar) return;
        window.addEventListener('scroll', () => {
            topbar.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }

    // ========================= PAGE TRANSITION =========================
    function initPageTransitions() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.28s ease';
        window.addEventListener('load', () => {
            document.body.style.opacity = '1';
        });
        window.addEventListener('pageshow', (event) => {
            document.body.style.opacity = '1';
        });
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript') ||
                href.startsWith('mailto') || href.startsWith('tel') ||
                link.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
            e.preventDefault();
            document.body.style.opacity = '0';
            setTimeout(() => { window.location.href = href; }, 260);
        });
    }

    // ========================= SMOOTH COUNTER =========================
    function animateCounter(el, target, duration = 1200) {
        let start = 0;
        const increment = target / (duration / 16);
        const suffix = el.dataset.suffix || '';
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                el.textContent = Number(target).toLocaleString('vi-VN') + suffix;
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(start).toLocaleString('vi-VN') + suffix;
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
                    animateCounter(el, parseInt(el.dataset.counter, 10));
                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });
        counters.forEach(el => counterObserver.observe(el));
    }

    // ========================= ACTIVE NAV HIGHLIGHT =========================
    function initActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // ========================= INIT =========================
    document.addEventListener('DOMContentLoaded', () => {
        initScrollAnimations();
        initTopbarScroll();
        initCounters();
        initActiveNav();
    });

    initPageTransitions();
})();

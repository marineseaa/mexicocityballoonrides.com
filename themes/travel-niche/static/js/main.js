/**
 * Amsterdam Cruise Tours — Main JS
 * Vanilla JS, no dependencies.
 */

/* ── Config ── */
const GYG_AFFILIATE_URL = 'https://gyg.me/REPLACE_WITH_YOUR_GYG_LINK';

/* ── DOM helpers ── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ════════════════════════════════════════════════════════════
   1. GYG Affiliate Links
   Replace all [data-gyg-link] href values with the affiliate URL.
   ════════════════════════════════════════════════════════════ */
function initGYGLinks() {
  $$('[data-gyg-link]').forEach(el => {
    el.href       = GYG_AFFILIATE_URL;
    el.target     = '_blank';
    el.rel        = 'sponsored noopener noreferrer';
  });
}

/* ════════════════════════════════════════════════════════════
   2. Header — scroll-triggered background
   ════════════════════════════════════════════════════════════ */
function initScrollHeader() {
  const header = $('#site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}

/* ════════════════════════════════════════════════════════════
   3. Sticky Mobile CTA — handled by inline <script> in
      sticky-cta.html partial (scroll-direction aware).
   ════════════════════════════════════════════════════════════ */
function initStickyCTA() { /* no-op — see sticky-cta.html */ }

/* ════════════════════════════════════════════════════════════
   4. Mobile Menu
   ════════════════════════════════════════════════════════════ */
function initMobileMenu() {
  const hamburger = $('#hamburger-btn');
  const closeBtn  = $('#mobile-close-btn');
  const menu      = $('#mobile-menu');
  const backdrop  = $('#mobile-backdrop');
  if (!hamburger || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
    // Move focus inside menu
    closeBtn?.focus();
  }

  function closeMenu() {
    menu.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.focus();
  }

  hamburger.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);

  // Close on nav link click
  $$('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on mobile menu CTA click (Book Now button)
  const mobileCTA = $('.mobile-menu-cta');
  if (mobileCTA) {
    mobileCTA.addEventListener('click', closeMenu);
  }

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });
}

/* ════════════════════════════════════════════════════════════
   5. FAQ Accordion
   Single-expand: only one item open at a time.
   Uses hidden attribute + max-height trick for animation.
   ════════════════════════════════════════════════════════════ */
function initFAQ() {
  const questions = $$('.faq-question');
  if (!questions.length) return;

  // Remove the 'hidden' attribute so CSS animation works,
  // but collapse via max-height: 0 in CSS.
  $$('.faq-answer').forEach(answer => {
    answer.removeAttribute('hidden');
  });

  questions.forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen   = btn.getAttribute('aria-expanded') === 'true';
      const targetId = btn.getAttribute('aria-controls');
      const answer   = document.getElementById(targetId);

      // Close all
      questions.forEach(q => {
        q.setAttribute('aria-expanded', 'false');
        const a = document.getElementById(q.getAttribute('aria-controls'));
        if (a) a.style.maxHeight = '0';
      });

      // Open clicked (if it was closed)
      if (!isOpen && answer) {
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   6. Scroll-Triggered Fade-Up Animations
   ════════════════════════════════════════════════════════════ */
function initFadeUp() {
  const elements = $$('.fade-up');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback: show all immediately
    elements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach(el => observer.observe(el));
}

/* ════════════════════════════════════════════════════════════
   7. Smooth scroll for in-page anchor links
   (Handles fixed header offset)
   ════════════════════════════════════════════════════════════ */
function initSmoothScroll() {
  const HEADER_HEIGHT = 70; // approx fixed header height

  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id     = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ════════════════════════════════════════════════════════════
   Init
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initGYGLinks();
  initScrollHeader();
  initStickyCTA();
  initMobileMenu();
  initFAQ();
  initFadeUp();
  initSmoothScroll();
});

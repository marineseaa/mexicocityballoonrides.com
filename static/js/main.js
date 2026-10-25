/**
 * Travel Niche — Main JS
 * Vanilla JS, no dependencies.
 */

/* ── Config — MIXED PROVIDER (Viator primary, GetYourGuide secondary) ──
   Affiliate params are injected at RUNTIME so they never sit in static HTML
   (/final-check §4). Decoration is chosen by the destination HOST, not by the
   attribute, so a Viator URL can never carry GYG params or the reverse.
   GYG partner id comes from this project's gyg_analytics_head_code.txt.
   Viator pid/mcid are this account's (viator-tours skill); keep all of these in
   sync with hugo.toml [params]. */
const GYG_PARTNER_ID = 'GLBKRID';
const GYG_CAMPAIGN   = 'mexicocityballoonrides';
const AFFILIATE_PID      = 'P00285896';
const AFFILIATE_MCID     = '42383';
const AFFILIATE_CAMPAIGN = 'mexicocityballoonrides-viator';
/* Featured tour (homepage) — used only by [data-gyg-link]/[data-affiliate-link],
   i.e. elements on pages that have no tour of their own. */
const FEATURED_URL = 'https://www.viator.com/tours/Mexico-City/Hot-Air-Balloon-Flight-in-Teotihuacan-with-Breakfast-Included/d628-357659P1';

/* ── DOM helpers ── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* Is this URL one of OUR affiliate destinations? Only those may be decorated.
   Not every link in a comparison table or a guide is monetised: the kit's own
   "official ticket / operator-direct" framing (orchestrate-full-site Patch 11)
   routinely points a column at the attraction's OWN ticket page, which earns
   nothing. Appending tracking params there produces a URL the operator's site
   does not understand AND claims an affiliate relationship that does not exist.
   Fails CLOSED: an unparseable value is treated as non-affiliate and left alone.
   (Reported on futureofflighttickets.com 2026-08-29 — its comparison table
   links boeingfutureofflight.com beside two GYG columns.) */
function hostOf(u) {
  try { return new URL(u, location.href).hostname; } catch (e) { return ''; }
}
function isGYGUrl(u)    { return /(^|\.)getyourguide\.com$/i.test(hostOf(u)); }
function isViatorUrl(u) { return /(^|\.)viator\.com$/i.test(hostOf(u)); }

/* Append the right network's params to a BARE booking URL; others untouched.
   GYG:    partner_id + utm_medium + cmp
   Viator: pid + mcid + medium + api_version + campaign (replaces any query) */
function affiliateDecorate(bareURL) {
  const u = bareURL || FEATURED_URL;
  if (isGYGUrl(u)) {
    const sep = u.indexOf('?') === -1 ? '?' : '&';
    return u + sep + 'partner_id=' + GYG_PARTNER_ID +
           '&utm_medium=online_publisher&cmp=' + GYG_CAMPAIGN;
  }
  if (isViatorUrl(u)) {
    const base = u.split('?')[0];
    return base + '?pid=' + AFFILIATE_PID + '&mcid=' + AFFILIATE_MCID +
           '&medium=api&api_version=2.0&campaign=' + AFFILIATE_CAMPAIGN;
  }
  return u;
}

/* ════════════════════════════════════════════════════════════
   1. Affiliate Links (both networks)
   [data-gyg-link] / [data-affiliate-link] → the featured-tour URL.
   [data-gyg-href] / [data-affiliate-href] → per-element bare URL, decorated
                     at runtime for whichever network its host belongs to.
   Only <a> elements are decorated: the GYG availability widget's own <div>
   also carries data-gyg-href (the iframe endpoint) and must be left alone.
   ════════════════════════════════════════════════════════════ */
function initAffiliateLinks() {
  $$('[data-gyg-link], [data-affiliate-link]').forEach(el => {
    el.href       = affiliateDecorate(FEATURED_URL);
    el.target     = '_blank';
    el.rel        = 'sponsored nofollow noopener noreferrer';
  });
  $$('a[data-gyg-href], a[data-affiliate-href]').forEach(el => {
    const bare = el.getAttribute('data-gyg-href') || el.getAttribute('data-affiliate-href');
    el.href    = affiliateDecorate(bare);
    el.target  = '_blank';
    /* rel must match reality. "sponsored" on a link that pays nothing is a
       false disclosure, and Google treats a mis-tagged link as a disclosure
       error. Only genuinely monetised destinations carry it. */
    el.rel     = (isGYGUrl(bare) || isViatorUrl(bare)) ? 'sponsored nofollow noopener noreferrer'
                                                        : 'noopener noreferrer';
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
  /* Start collapsed, as on the romeinaday.tours design: removing `hidden`
     alone let `.faq-answer:not([hidden])` open every answer at load while the
     buttons still said aria-expanded="false" (and showed "+"). */
  $$('.faq-answer').forEach(answer => {
    answer.removeAttribute('hidden');
    answer.style.maxHeight = '0';
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
   5b. Gallery Lightbox (gallery.html photo-essay grid)
   Native <dialog>: Esc closes, focus is trapped and restored by the browser.
   ════════════════════════════════════════════════════════════ */
function initGalleryLightbox() {
  const box = $('.gallery-lightbox');
  if (!box || typeof box.showModal !== 'function') return;
  const items = $$('.gallery-item');
  const img = $('.gallery-lightbox__img', box);
  const cap = $('.gallery-lightbox__caption', box);
  let cur = 0;

  const show = i => {
    cur = (i + items.length) % items.length;
    const src = $('img', items[cur]);
    const fc  = $('.gallery-caption', items[cur]);
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    /* Caption without the figure number span */
    cap.textContent = fc ? [...fc.childNodes].filter(n => !n.classList?.contains('gallery-num')).map(n => n.textContent).join('').trim() : '';
  };

  $$('.gallery-open').forEach(btn => btn.addEventListener('click', () => {
    show(+btn.dataset.galleryIndex);
    box.showModal();
  }));
  $('.gallery-lightbox__close', box).addEventListener('click', () => box.close());
  $('.gallery-lightbox__prev', box).addEventListener('click', () => show(cur - 1));
  $('.gallery-lightbox__next', box).addEventListener('click', () => show(cur + 1));
  box.addEventListener('click', e => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  box.addEventListener('close', () => { document.body.style.overflow = ''; });
  $$('.gallery-open').forEach(btn => btn.addEventListener('click', () => { document.body.style.overflow = 'hidden'; }));
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
   8. Share row — "Copy link" (share-row.html). The X/Facebook links
      are plain hrefs and need no script.
   ════════════════════════════════════════════════════════════ */
function initShareRow() {
  $$('[data-share="copy"]').forEach(link => {
    link.addEventListener('click', e => {
      if (!navigator.clipboard) return;          // fall through to the plain href
      e.preventDefault();
      navigator.clipboard.writeText(link.href).then(() => {
        const was = link.textContent;
        link.textContent = 'Link copied';
        setTimeout(() => { link.textContent = was; }, 1800);
      });
    });
  });
}

/* ════════════════════════════════════════════════════════════
   Init
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initAffiliateLinks();
  initScrollHeader();
  initStickyCTA();
  initMobileMenu();
  initFAQ();
  initGalleryLightbox();
  initFadeUp();
  initSmoothScroll();
  initShareRow();
});

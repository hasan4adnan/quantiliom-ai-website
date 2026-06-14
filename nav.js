/**
 * Quantiliom Global Navigation Component
 * Usage: include <script src="nav.js"></script> in any page — nav renders itself automatically.
 * Public API: QuantiliomNav.navigateTo(url) · QuantiliomNav.goBack()
 */
(function () {
  'use strict';

  /* ── Page definitions ── */
  var PAGES = [
    { label: 'Product',   href: '#' },
    { label: 'Use Cases', href: '#' },
    { label: 'Services',  href: 'services.html' },
    { label: 'Pricing',   href: 'pricing.html' },
    { label: 'Docs',      href: '#' },
    { label: 'Blog',      href: '#' },
  ];

  /* ── Action button routes ──
   *
   * Sign-in / sign-up / onboarding live in the dashboard repo
   * (quantiliom-ai-dashboard, port 5173). Log In sends users to the
   * dashboard's login mode; Get Started sends them to its sign-up mode.
   * Contact Sales stays on the website. The dashboard URL is also
   * mirrored in login.html / registration.html (as redirect targets) so
   * any legacy CTA that still points at .html keeps working.
   */
  var DASHBOARD_URL = 'http://localhost:5173';
  var ACTION_HREFS = [
    DASHBOARD_URL + '/#login',
    'contact-sales.html',
    DASHBOARD_URL + '/#signup',
  ];

  /* ── Injected CSS ── */
  var CSS = [
    ':root { --q-spring: cubic-bezier(0.16, 1, 0.3, 1); }',

    /* Nav bar */
    '#qnav {',
    '  position: sticky; top: 0; z-index: 100;',
    '  background: #fff; border-bottom: 1px solid #020202;',
    '  height: 96px; display: flex; align-items: center;',
    '  flex-shrink: 0; transition: box-shadow .2s;',
    '}',
    '#qnav.scrolled { box-shadow: 0 1px 20px rgba(2,2,2,.07); }',
    '.qnav-inner {',
    '  max-width: 1440px; margin: 0 auto; padding: 0 72px;',
    '  width: 100%; display: flex; align-items: center; justify-content: space-between;',
    '}',
    '.qnav-logo { display: flex; align-items: center; cursor: pointer; text-decoration: none; }',
    '.qnav-logo img { height: 160px; width: auto; display: block; }',

    /* Links */
    '.qnav-links { display: flex; align-items: center; gap: 36px; list-style: none; }',
    '.qnav-links a {',
    '  font-size: 15px; font-family: "Inter", ui-sans-serif, system-ui, sans-serif;',
    '  color: #020202; text-decoration: none;',
    '  transition: color .15s; position: relative; cursor: pointer;',
    '}',
    '.qnav-links a::after {',
    '  content: ""; position: absolute; bottom: -3px; left: 0;',
    '  width: 0; height: 1px; background: #020202;',
    '  transition: width .25s var(--q-spring);',
    '}',
    '.qnav-links a:hover::after, .qnav-links a.qnav-active::after { width: 100%; }',
    '.qnav-links a.qnav-active { color: #ef6f2e; }',
    '.qnav-links a.qnav-active::after { background: #ef6f2e; }',

    /* Action buttons */
    '.qnav-actions { display: flex; align-items: center; gap: 8px; }',
    '.qnav-btn {',
    '  display: inline-flex; align-items: center; gap: 8px;',
    '  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;',
    '  font-size: 15px; border-radius: 5px; padding: 8px 18px;',
    '  border: 1px solid transparent; line-height: 1.4;',
    '  transition: all .15s ease; cursor: pointer; white-space: nowrap; background: none;',
    '}',
    '.qnav-btn-ghost { color: #020202; border-color: transparent; }',
    '.qnav-btn-outline { color: #020202; border-color: #020202; }',
    '.qnav-btn-outline:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(2,2,2,.08); }',
    '.qnav-btn-dark { background: #020202; color: #fff; border-color: #020202; }',
    '.qnav-btn-dark:hover { background: #ef6f2e; border-color: #ef6f2e; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(2,2,2,.22); }',
    '.qnav-btn:active { transform: scale(0.97) !important; box-shadow: none !important; }',
    '.qnav-btn-active-outline { color: #ef6f2e !important; border-color: #ef6f2e !important; }',

    /* Page exit animation (used by navigateTo) */
    '@keyframes qnav-pg-exit { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-12px)} }',
    'body.page-exiting { animation: qnav-pg-exit 0.26s cubic-bezier(0.55,0,0.45,1) both; pointer-events: none; }',
  ].join('\n');

  /* ── Helpers ── */
  function currentFilename() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function navigateTo(url) {
    document.body.classList.add('page-exiting');
    setTimeout(function () { window.location.href = url; }, 250);
  }

  function goBack() {
    navigateTo('index.html');
  }

  /* ── CSS injection (idempotent) ── */
  function injectCSS() {
    if (document.getElementById('qnav-styles')) return;
    var style = document.createElement('style');
    style.id = 'qnav-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ── Nav HTML build & mount ── */
  function render() {
    injectCSS();

    /* Skip if already rendered */
    if (document.getElementById('qnav')) return;

    var filename = currentFilename();

    /* Outer nav */
    var nav = document.createElement('nav');
    nav.id = 'qnav';

    /* Inner wrapper */
    var inner = document.createElement('div');
    inner.className = 'qnav-inner';

    /* Logo — always links to home */
    var logo = document.createElement('a');
    logo.className = 'qnav-logo';
    logo.href = 'index.html';
    var logoImg = document.createElement('img');
    logoImg.src = 'QuantiliomMainLogo.png';
    logoImg.alt = 'Quantiliom';
    logo.appendChild(logoImg);

    /* Links */
    var ul = document.createElement('ul');
    ul.className = 'qnav-links';
    PAGES.forEach(function (page) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.textContent = page.label;
      a.href = page.href;
      if (page.href !== '#' && filename === page.href) {
        a.classList.add('qnav-active');
      }
      li.appendChild(a);
      ul.appendChild(li);
    });

    /* Action buttons */
    var actions = document.createElement('div');
    actions.className = 'qnav-actions';
    ['Log In', 'Contact Sales', 'Get Started'].forEach(function (label, i) {
      var btn = document.createElement('button');
      var baseClass = 'qnav-btn ' + ['qnav-btn-ghost', 'qnav-btn-outline', 'qnav-btn-dark'][i];
      var href = ACTION_HREFS[i];
      /* Highlight "Contact Sales" when on that page (cross-origin URLs
       * never match the local filename, so the dashboard buttons never
       * get the active-outline state — which is the desired behavior). */
      if (href && filename === href) {
        btn.className = baseClass + ' qnav-btn-active-outline';
      } else {
        btn.className = baseClass;
      }
      btn.textContent = label;
      if (href) {
        btn.addEventListener('click', function () {
          /* Cross-origin URLs bypass the page-exit animation since we
           * are leaving the website's lifecycle entirely. */
          if (/^https?:\/\//.test(href)) {
            window.location.href = href;
          } else {
            navigateTo(href);
          }
        });
      }
      actions.appendChild(btn);
    });

    inner.appendChild(logo);
    inner.appendChild(ul);
    inner.appendChild(actions);
    nav.appendChild(inner);

    /* Mount before first child of body */
    document.body.insertBefore(nav, document.body.firstChild);

    /* Behaviors */
    _attachScrollShadow(nav);
    _attachTransitions(nav);
  }

  function _attachScrollShadow(nav) {
    /* Prefer .svc-body (overlay-style pages) over window */
    function attach() {
      var svcBody = document.querySelector('.svc-body');
      if (svcBody) {
        svcBody.addEventListener('scroll', function () {
          nav.classList.toggle('scrolled', svcBody.scrollTop > 12);
        }, { passive: true });
      } else {
        window.addEventListener('scroll', function () {
          nav.classList.toggle('scrolled', window.scrollY > 12);
        }, { passive: true });
      }
    }
    /* Defer so .svc-body is in the DOM */
    setTimeout(attach, 0);
  }

  function _attachTransitions(nav) {
    /* Logo → home with exit animation (unless already on index) */
    nav.querySelector('.qnav-logo').addEventListener('click', function (e) {
      if (currentFilename() !== 'index.html') {
        e.preventDefault();
        navigateTo('index.html');
      }
    });

    /* Links that have real hrefs get exit animation */
    nav.querySelectorAll('.qnav-links a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      if (a.classList.contains('qnav-active')) return;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo(href);
      });
    });
  }

  /* ── Public API ── */
  window.QuantiliomNav = { navigateTo: navigateTo, goBack: goBack };

  /* ── Auto-render ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
}());

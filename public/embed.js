/**
 * LessonLoop Embeddable Booking Widget
 *
 * Usage:
 *   <script src="https://app.lessonloop.com/embed.js" data-slug="my-studio"></script>
 *
 * Optional data attributes:
 *   data-slug       (required) The booking page URL slug
 *   data-color      Accent color for the button (default: #6366f1)
 *   data-text       Button text (default: "Book a Trial Lesson")
 *   data-position   Button position: "bottom-right" | "bottom-left" (default: "bottom-right")
 *   data-base-url   Override base URL (default: auto-detected from script src)
 */
(function () {
  'use strict';

  // Prevent double-initialisation
  if (window.__lessonloop_embed_init) return;
  window.__lessonloop_embed_init = true;

  // ─── Configuration ─────────────────────────────────

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var slug = script.getAttribute('data-slug');
  if (!slug) {
    console.warn('[LessonLoop] Missing data-slug attribute on embed script.');
    return;
  }

  var accentColor = script.getAttribute('data-color') || '#6366f1';
  var buttonText = script.getAttribute('data-text') || 'Book a Trial Lesson';
  var position = script.getAttribute('data-position') || 'bottom-right';

  // Detect base URL from script src, or use data-base-url override
  var baseUrl = script.getAttribute('data-base-url');
  if (!baseUrl) {
    var scriptSrc = script.src || '';
    var urlMatch = scriptSrc.match(/^(https?:\/\/[^/]+)/);
    baseUrl = urlMatch ? urlMatch[1] : 'https://app.lessonloop.com';
  }

  var bookingUrl = baseUrl + '/book/' + slug + '?embed=true';

  // ─── Styles ────────────────────────────────────────

  var WIDGET_ID = 'll-booking-widget';
  var OVERLAY_ID = 'll-booking-overlay';

  var css = [
    '#' + WIDGET_ID + '{',
    '  position:fixed;',
    '  ' + (position === 'bottom-left' ? 'left' : 'right') + ':20px;',
    '  bottom:20px;',
    '  z-index:999999;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    '}',
    '#' + WIDGET_ID + ' button{',
    '  display:inline-flex;',
    '  align-items:center;',
    '  gap:8px;',
    '  padding:12px 24px;',
    '  border:none;',
    '  border-radius:9999px;',
    '  background:' + accentColor + ';',
    '  color:#fff;',
    '  font-size:14px;',
    '  font-weight:600;',
    '  cursor:pointer;',
    '  box-shadow:0 4px 14px rgba(0,0,0,0.15);',
    '  transition:transform 0.15s ease,box-shadow 0.15s ease,opacity 0.15s ease;',
    '  line-height:1;',
    '  white-space:nowrap;',
    '}',
    '#' + WIDGET_ID + ' button:hover{',
    '  transform:translateY(-2px);',
    '  box-shadow:0 6px 20px rgba(0,0,0,0.2);',
    '}',
    '#' + WIDGET_ID + ' button:active{',
    '  transform:scale(0.97);',
    '}',
    '#' + WIDGET_ID + ' button svg{',
    '  width:18px;',
    '  height:18px;',
    '  fill:none;',
    '  stroke:currentColor;',
    '  stroke-width:2;',
    '  stroke-linecap:round;',
    '  stroke-linejoin:round;',
    '}',
    '#' + OVERLAY_ID + '{',
    '  position:fixed;',
    '  inset:0;',
    '  z-index:9999999;',
    '  display:none;',
    '  align-items:center;',
    '  justify-content:center;',
    '  background:rgba(0,0,0,0.5);',
    '  opacity:0;',
    '  transition:opacity 0.25s ease;',
    '  padding:16px;',
    '}',
    '#' + OVERLAY_ID + '.ll-open{',
    '  display:flex;',
    '  opacity:1;',
    '}',
    '#' + OVERLAY_ID + ' .ll-frame-wrap{',
    '  position:relative;',
    '  width:100%;',
    '  max-width:480px;',
    '  max-height:90vh;',
    '  height:700px;',
    '  background:#fff;',
    '  border-radius:16px;',
    '  overflow:hidden;',
    '  box-shadow:0 25px 50px rgba(0,0,0,0.25);',
    '  transform:translateY(20px);',
    '  transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '#' + OVERLAY_ID + '.ll-open .ll-frame-wrap{',
    '  transform:translateY(0);',
    '}',
    '#' + OVERLAY_ID + ' .ll-close{',
    '  position:absolute;',
    '  top:8px;',
    '  right:8px;',
    '  z-index:10;',
    '  width:32px;',
    '  height:32px;',
    '  border-radius:50%;',
    '  border:none;',
    '  background:rgba(0,0,0,0.06);',
    '  cursor:pointer;',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '  transition:background 0.15s ease;',
    '  padding:0;',
    '}',
    '#' + OVERLAY_ID + ' .ll-close:hover{',
    '  background:rgba(0,0,0,0.12);',
    '}',
    '#' + OVERLAY_ID + ' .ll-close svg{',
    '  width:16px;',
    '  height:16px;',
    '  stroke:#666;',
    '  stroke-width:2;',
    '  fill:none;',
    '  stroke-linecap:round;',
    '}',
    '#' + OVERLAY_ID + ' iframe{',
    '  width:100%;',
    '  height:100%;',
    '  border:none;',
    '}',
    '@media(max-width:640px){',
    '  #' + OVERLAY_ID + '{padding:0;}',
    '  #' + OVERLAY_ID + ' .ll-frame-wrap{',
    '    max-width:100%;',
    '    max-height:100%;',
    '    height:100%;',
    '    border-radius:0;',
    '  }',
    '  #' + WIDGET_ID + '{',
    '    ' + (position === 'bottom-left' ? 'left' : 'right') + ':12px;',
    '    bottom:12px;',
    '  }',
    '  #' + WIDGET_ID + ' button{',
    '    padding:10px 20px;',
    '    font-size:13px;',
    '  }',
    '}',
  ].join('\n');

  // ─── Inject styles ────────────────────────────────

  var style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  // ─── Calendar icon SVG ────────────────────────────

  var calendarIcon = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var closeIcon = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ─── Create DOM ───────────────────────────────────

  // Floating button
  var widget = document.createElement('div');
  widget.id = WIDGET_ID;

  var btn = document.createElement('button');
  btn.innerHTML = calendarIcon + buttonText;
  btn.setAttribute('aria-label', buttonText);
  widget.appendChild(btn);

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  var frameWrap = document.createElement('div');
  frameWrap.className = 'll-frame-wrap';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'll-close';
  closeBtn.innerHTML = closeIcon;
  closeBtn.setAttribute('aria-label', 'Close booking');
  frameWrap.appendChild(closeBtn);

  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Book a lesson');
  iframe.setAttribute('loading', 'lazy');
  frameWrap.appendChild(iframe);

  overlay.appendChild(frameWrap);

  // ─── Event handlers ───────────────────────────────

  function openModal() {
    iframe.src = bookingUrl;
    overlay.style.display = 'flex';
    // Force reflow then add class for animation
    void overlay.offsetHeight;
    overlay.classList.add('ll-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('ll-open');
    document.body.style.overflow = '';
    setTimeout(function () {
      overlay.style.display = 'none';
      iframe.src = 'about:blank';
    }, 300);
  }

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // Close on overlay background click
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('ll-open')) {
      closeModal();
    }
  });

  // Listen for postMessage from iframe
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;

    switch (e.data.type) {
      case 'lessonloop:close':
        closeModal();
        break;
      case 'lessonloop:booking-complete':
        // Keep modal open to show confirmation, auto-close after delay
        setTimeout(function () {
          closeModal();
        }, 5000);
        break;
    }
  });

  // ─── Insert into DOM ──────────────────────────────

  document.body.appendChild(widget);
  document.body.appendChild(overlay);
})();

/* ============================================
   LESSONLOOP DESIGN SYSTEM UPGRADE — JS
   GSAP ScrollTrigger + Counters
   ============================================ */

// --- GSAP Animations ---
(function() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    // Fallback: use existing IntersectionObserver for .animate-on-scroll
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Staggered card reveals — feature cards, comparison rows, etc.
  document.querySelectorAll('.glass-card, .feature-card-grid > div, [data-stagger-group] > *').forEach((card, i, arr) => {
    // Find sibling index within parent for stagger offset
    const parent = card.parentElement;
    const siblings = Array.from(parent.children);
    const siblingIndex = siblings.indexOf(card);

    gsap.from(card, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      delay: siblingIndex * 0.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });
  });

  // Section headings — slide up with subtle scale
  document.querySelectorAll('section h2').forEach(heading => {
    gsap.from(heading, {
      y: 50,
      opacity: 0,
      scale: 0.97,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: heading,
        start: 'top 82%'
      }
    });
  });

  // Section subheadings/descriptions
  document.querySelectorAll('section h2 + p, section h2 + div + p').forEach(p => {
    gsap.from(p, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      delay: 0.15,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: p,
        start: 'top 85%'
      }
    });
  });

  // Stat number counter animations
  document.querySelectorAll('[data-count-target]').forEach(el => {
    const target = parseFloat(el.dataset.countTarget);
    const suffix = el.dataset.countSuffix || '';
    const prefix = el.dataset.countPrefix || '';
    const decimals = el.dataset.countDecimals ? parseInt(el.dataset.countDecimals) : 0;

    gsap.from(el, {
      textContent: 0,
      duration: 2,
      ease: 'power2.out',
      snap: decimals === 0 ? { textContent: 1 } : {},
      scrollTrigger: {
        trigger: el,
        start: 'top 85%'
      },
      onUpdate: function() {
        const val = decimals > 0
          ? parseFloat(this.targets()[0].textContent).toFixed(decimals)
          : Math.ceil(this.targets()[0].textContent);
        el.textContent = prefix + val + suffix;
      }
    });
  });

  // Browser frame mockups — scale up from 0.95
  document.querySelectorAll('.browser-frame, .rounded-2xl.overflow-hidden.border').forEach(frame => {
    gsap.from(frame, {
      scale: 0.95,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: frame,
        start: 'top 80%'
      }
    });
  });

  // FAQ items — staggered
  document.querySelectorAll('[data-faq-group] > *, .faq-item').forEach((item, i) => {
    const parent = item.parentElement;
    const siblings = Array.from(parent.children);
    const idx = siblings.indexOf(item);

    gsap.from(item, {
      y: 20,
      opacity: 0,
      duration: 0.6,
      delay: idx * 0.08,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 90%'
      }
    });
  });

  // How-it-works step progress line
  document.querySelectorAll('[data-progress-line]').forEach(line => {
    gsap.fromTo(line,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 75%'
        }
      }
    );
  });

  // Step number icons — pop in
  document.querySelectorAll('[data-step-icon]').forEach((icon, i) => {
    gsap.from(icon, {
      scale: 0,
      opacity: 0,
      duration: 0.5,
      delay: i * 0.2,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: icon,
        start: 'top 85%'
      }
    });
  });
})();

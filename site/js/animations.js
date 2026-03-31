(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) return;

  // --- Scroll fade-in ---
  let staggerIndex = 0;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.transitionDelay = (staggerIndex * 100) + 'ms';
      staggerIndex++;
      el.classList.add('section-visible');
      observer.unobserve(el);

      // Trigger stat counters if this is a stats section
      if (el.classList.contains('section-stats')) {
        animateStatCounters(el);
      }
    });
    // Reset stagger after batch
    setTimeout(function () { staggerIndex = 0; }, 50);
  }, { threshold: 0.15 });

  // Observe sections once DOM is ready
  function observeSections() {
    document.querySelectorAll('.section').forEach(function (el) {
      observer.observe(el);
    });
  }

  // MutationObserver to catch dynamically added sections
  const mutObs = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('section')) {
          observer.observe(node);
        }
      });
    });
  });
  mutObs.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeSections);
  } else {
    observeSections();
  }

  // --- Stat counter animation ---
  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animateStatCounters(section) {
    section.querySelectorAll('.stat-value').forEach(function (el) {
      var text = el.textContent.trim();
      // Extract prefix (e.g. "$"), number, suffix (e.g. "+", "%")
      var match = text.match(/^([^\d]*?)([\d,]+(?:\.\d+)?)(.*)$/);
      if (!match) return; // non-numeric, show as-is

      var prefix = match[1];
      var numStr = match[2].replace(/,/g, '');
      var suffix = match[3];
      var target = parseFloat(numStr);
      var isInteger = numStr.indexOf('.') === -1;
      var duration = 1500;
      var start = performance.now();

      function frame(now) {
        var t = Math.min((now - start) / duration, 1);
        var eased = easeOutExpo(t);
        var current = eased * target;
        var formatted = isInteger
          ? Math.round(current).toLocaleString()
          : current.toFixed(numStr.split('.')[1].length).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        el.textContent = prefix + formatted + suffix;
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Hero parallax ---
  var parallaxEnabled = !('ontouchstart' in window);

  if (parallaxEnabled) {
    var heroEl = null;
    var ticking = false;

    function findHero() {
      var hero = document.querySelector('.section-hero');
      if (hero && hero.style.backgroundImage) {
        heroEl = hero;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        // Wrap content for independent positioning
        hero.style.overflow = 'hidden';
      }
    }

    function onScroll() {
      if (!heroEl || ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var rect = heroEl.getBoundingClientRect();
        // Only apply parallax when hero is visible
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          var offset = window.scrollY * 0.3;
          heroEl.style.backgroundPosition = 'center ' + (-offset) + 'px';
        }
        ticking = false;
      });
    }

    // Wait for hero to be rendered
    var heroCheck = new MutationObserver(function () {
      findHero();
      if (heroEl) {
        heroCheck.disconnect();
        window.addEventListener('scroll', onScroll, { passive: true });
      }
    });
    heroCheck.observe(document.body, { childList: true, subtree: true });

    // Also check immediately
    findHero();
    if (heroEl) {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }
})();

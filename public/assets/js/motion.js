/* ═══════════════════════════════════════════════════════════════════════
   MORDAZ — motion and interaction
   ───────────────────────────────────────────────────────────────────────
   Shared by index.html and article.html. Every block guards for its own
   elements, so the file is safe to load on any page.

   The motion language is WIPES, not fades. The hero panel already arrives
   by clip-path (`panelIn`), so everything else follows: text wipes in from
   the left like ink being laid down, and plates are revealed by a circle
   growing out of their bitten corner — the bite, doing the revealing.

   Nothing here fades up by 20px. That is the one gesture the brief
   specifically rules out, and it was what the first pass did everywhere.

   Principles held here:
   · Animate transform, opacity and clip-path only — never layout.
   · Scroll work is rAF-throttled and passive; nothing runs per scroll event.
   · Reveals are opt-in via the `js` class, so with JS off the page is
     fully visible rather than permanently blank.
   · prefers-reduced-motion is honoured in CSS; observers below simply
     reveal everything at once rather than animating it.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  /* ─── Reveals ───────────────────────────────────────────────────────
     [data-reveal] wipes in; .plate settles.

     IMPORTANT — why the PARENT is observed, not the element:
     a wipe-in element rests at `clip-path: inset(0 100% 0 0)`, and Chrome
     clips the IntersectionObserver rect by the element's own clip-path. So
     a clipped element reports intersectionRatio 0 forever, and any observer
     watching it can never cross a threshold to un-clip it — the observer
     deadlocks against the very state it exists to clear. (Measured: clipped
     ratio 0, unclipped ratio 1.) Grouping by parent sidesteps it entirely,
     and gives better choreography: a section arrives as one sequence.      */

  function revealAll(sel, cls) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      el.classList.add(cls);
    });
  }

  function observeGroups() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (reduce || !canObserve) { revealAll('[data-reveal]', 'is-in'); return; }

    /* group the clipped children under their unclipped parent */
    var groups = [];
    Array.prototype.forEach.call(targets, function (el) {
      var parent = el.parentElement || document.body;
      var group = null;
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].parent === parent) { group = groups[i]; break; }
      }
      if (!group) { group = { parent: parent, kids: [] }; groups.push(group); }
      group.kids.push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var parent = entry.target;

        groups.forEach(function (g) {
          if (g.parent !== parent) return;
          g.kids.forEach(function (el, i) {
            el.style.setProperty('--d', (i > 0 ? i * 85 : 0) + 'ms');
            el.classList.add('is-in');
          });
        });

        io.unobserve(parent);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    groups.forEach(function (g) { io.observe(g.parent); });

    /* Failsafe. A wipe-in element rests fully clipped, so if the observer
       never fires the content is invisible rather than merely un-animated —
       the worst failure mode available. IntersectionObserver does not fire
       while a tab is not compositing (background tabs, some prerenderers,
       headless capture), and that state can outlive the delay below.
       After 1.2s, show everything regardless: a missed animation is nothing,
       a blank page is everything. */
    window.setTimeout(function () {
      var stuck = document.querySelectorAll('[data-reveal]:not(.is-in)');
      if (!stuck.length) return;
      io.disconnect();
      Array.prototype.forEach.call(stuck, function (el) { el.classList.add('is-in'); });
    }, 1200);
  }

  function observePlates() {
    var plates = document.querySelectorAll('.plate');
    if (!plates.length) return;
    if (reduce || !canObserve) { revealAll('.plate', 'is-lit'); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-lit');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });

    Array.prototype.forEach.call(plates, function (el) { io.observe(el); });
  }

  observeGroups();
  observePlates();


  /* ─── Reading progress ──────────────────────────────────────────────
     Drives the hairline under the sticky bar via a custom property, so the
     paint is a single cheap scaleX rather than a width change. */

  var bar = document.getElementById('bar');

  if (bar) {
    var ticking = false;

    var paint = function () {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var p = scrollable > 0 ? window.scrollY / scrollable : 0;
      bar.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4));
      bar.classList.toggle('is-stuck', window.scrollY > 8);
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }


  /* ─── Drawer (small screens) ────────────────────────────────────────── */

  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');

  if (burger && drawer) {
    var setDrawer = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      drawer.hidden = !open;
      burger.querySelector('.u-sr').textContent = open ? 'Close menu' : 'Open menu';
    };

    burger.addEventListener('click', function () {
      setDrawer(burger.getAttribute('aria-expanded') !== 'true');
    });

    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setDrawer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setDrawer(false);
        burger.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 960) setDrawer(false);
    }, { passive: true });
  }


  /* ─── The archive: filter by beat, order by date or alphabetically ──
     Rows are hidden with the `hidden` attribute so they leave the
     accessibility tree too, not just the view. */

  var arc = document.getElementById('arc');

  if (arc) {
    var rows   = Array.prototype.slice.call(arc.querySelectorAll('.arc__row'));
    var count  = document.getElementById('arc-count');
    var empty  = document.getElementById('arc-empty');
    var chips  = document.querySelectorAll('.chip[data-filter]');
    var orders = document.querySelectorAll('.chip[data-order]');

    var beat  = 'all';
    var order = 'new';   /* newest first by default; A–Z is the secondary view */

    /* A–Z sorts on the rebuttal — the bold line, and the one a reader is
       actually scanning. Read off the DOM rather than a data attribute so
       there is no second copy of the text to fall out of step, and leading
       articles are stripped so "a seat count" files under S. */
    var key = function (row) {
      var el = row.querySelector('.arc__ours');
      var t = (el ? el.textContent : '').trim().toLowerCase();
      return t.replace(/^(a|an|the)\s+/, '');
    };

    var apply = function () {
      /* order first — reordering hidden rows too keeps it stable when the
         filter is cleared again */
      var sorted = rows.slice().sort(function (a, b) {
        if (order === 'az') return key(a).localeCompare(key(b), 'en');
        return b.getAttribute('data-date').localeCompare(a.getAttribute('data-date'));
      });

      var frag = document.createDocumentFragment();
      sorted.forEach(function (r) { frag.appendChild(r); });
      arc.appendChild(frag);

      var shown = 0;
      rows.forEach(function (r) {
        var match = beat === 'all' || r.getAttribute('data-beat') === beat;
        r.hidden = !match;
        if (match) shown++;
      });

      if (count) count.textContent = String(shown);
      if (empty) empty.hidden = shown !== 0;
    };

    var wire = function (group, attr, set) {
      Array.prototype.forEach.call(group, function (btn) {
        btn.addEventListener('click', function () {
          Array.prototype.forEach.call(group, function (b) {
            var on = b === btn;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
          });
          set(btn.getAttribute(attr));
          apply();
        });
      });
    };

    wire(chips,  'data-filter', function (v) { beat = v; });
    wire(orders, 'data-order',  function (v) { order = v; });

    apply();
  }
}());

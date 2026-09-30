/* ═══════════════════════════════════════════════════════════════════════
   MORDAZ — plates
   ───────────────────────────────────────────────────────────────────────
   A piece without a photograph gets a generated plate: the piece's TOPIC set
   at poster scale on the ink, with a red rule under it.

   It used to set the received view and strike a red band through it — the
   argument as an image. That read as a caption arguing with itself above the
   headline, and the band cut through the words it was meant to label. The
   plate's job is to sit under a headline and say what the piece is about, so
   it now does only that. Nothing is crossed out.

   Two rules keep it art direction rather than ornament:

   1. It is DETERMINISTIC. The topic is the only seed, so a given piece always
      produces the same plate — every device, every load. Nothing is random
      at view time.
   2. It is DERIVED FROM CONTENT. Line breaks and scale fall out of the words
      themselves, and the palette comes from the CSS custom properties.

   Colours come from the CSS custom properties, so plates follow the palette
   rather than duplicating it.

   Usage:  <figure class="plate" data-plate="flat output is a puzzle"
                   role="img" aria-label="…"></figure>
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var css = getComputedStyle(document.documentElement);
  var INK = (css.getPropertyValue('--ink')   || '#171516').trim();
  var RED = (css.getPropertyValue('--red')   || '#C4202A').trim();
  var CRM = (css.getPropertyValue('--cream') || '#F0E9DE').trim();

  var LH = 0.86;   /* line height, in em — tight, for display type */

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* FNV-1a — small, fast, stable across engines */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* Break the claim into roughly even lines. Greedy on character count is
     enough here — the widths get measured and normalised afterwards. */
  function wrap(words, lines) {
    if (lines <= 1) return [words.join(' ')];
    var target = words.join(' ').length / lines;
    var out = [], cur = [], len = 0;

    words.forEach(function (w) {
      if (cur.length && len + w.length > target * 1.12 && out.length < lines - 1) {
        out.push(cur.join(' '));
        cur = [w];
        len = w.length;
      } else {
        cur.push(w);
        len += w.length + 1;
      }
    });
    out.push(cur.join(' '));
    return out;
  }

  function draw(node) {
    var claim = (node.getAttribute('data-plate') || '').trim();
    if (!claim) return;

    var wide = node.classList.contains('plate--wide');

    /* The viewBox must match the element's real aspect ratio. With a fixed
       viewBox and preserveAspectRatio="slice", any mismatch crops the plate a
       second time on top of the intended bleed. Deriving it from the measured
       box means the bleed is the only crop. */
    var rect = node.getBoundingClientRect();
    var ar   = (rect.width > 0 && rect.height > 0)
                 ? rect.width / rect.height
                 : (wide ? 2.5 : 4 / 3);
    var H = 900;
    var W = Math.round(H * ar);

    var rand = rng(hash(claim));
    var svg  = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid slice',
      'aria-hidden': 'true',
      focusable: 'false'
    });

    svg.appendChild(el('rect', { width: W, height: H, fill: INK }));

    /* a faint rule grid, for texture under the type */
    var step = wide ? 80 : 90;
    var grid = el('g', { stroke: CRM, 'stroke-opacity': '.06', 'stroke-width': '1' });
    for (var gy = step; gy < H; gy += step) {
      grid.appendChild(el('line', { x1: 0, y1: gy, x2: W, y2: gy }));
    }
    svg.appendChild(grid);

    /* ── set the topic ── */
    var words = claim.split(/\s+/);
    /* Two words go on two lines rather than one. A short label set on a single
       line is limited by the frame's width, which on a wide plate left the
       bottom third empty; stacked, the height constraint binds instead and the
       type fills the panel. A single word keeps its one big line. */
    var count = words.length > 1 ? 2 : 1;
    var lines = wrap(words, count);

    var PROBE = 100;
    var text = el('text', {
      'font-family': "Archivo, 'Helvetica Neue', Arial, sans-serif",
      'font-size': PROBE,
      'font-variation-settings': "'wdth' 82, 'wght' 800",
      'letter-spacing': '0.005em',
      fill: CRM
    });

    lines.forEach(function (ln, i) {
      var ts = el('tspan', { x: 0, dy: (i === 0 ? 0 : LH) + 'em' });
      ts.textContent = ln.toUpperCase();
      text.appendChild(ts);
    });

    svg.appendChild(text);
    node.textContent = '';
    node.appendChild(svg);

    /* measure at the probe size, then solve for the size that fills the frame */
    var widest = 0;
    Array.prototype.forEach.call(text.childNodes, function (ts) {
      var w = 0;
      try { w = ts.getComputedTextLength(); } catch (e) { w = 0; }
      if (w > widest) widest = w;
    });
    if (!widest) widest = PROBE * 0.52 * (lines[0] || '').length;

    /* The measure is what is left after the left inset, counted on both sides.
       Sizing to the full frame width and only then indenting by `x` pushed the
       longest line up to 13% past the right edge — `fill` could reach 1.04 on
       its own — which cut the last word mid-letter and read as a broken image
       rather than as an intentional crop. */
    var x     = W * (0.05 + rand() * 0.04);
    var fill  = 0.96 + rand() * 0.04;

    /* Width alone is not enough. Three lines of display type in a frame this
       short overran the bottom edge and sliced the last line through its
       middle, which reads as a rendering fault rather than as a crop. Take
       whichever of the two constraints binds first. */
    var byWidth  = PROBE * ((W - 2 * x) * fill) / widest;
    /* Half the frame rather than nearly all of it: the eyebrow takes the top
       and the rule takes the bottom, so the type gets the middle band. */
    var byHeight = (H * 0.42) / ((lines.length - 1) * LH + 1);
    var size     = Math.min(byWidth, byHeight);

    var block = (lines.length - 1) * LH * size;
    /* Fixed, not jittered. A struck claim sitting at a different height on
       every plate read as handmade; a label doing it reads as a mistake. */
    var first = H * 0.30 + size * 0.72;

    text.setAttribute('font-size', size.toFixed(2));
    text.setAttribute('y', first.toFixed(2));
    Array.prototype.forEach.call(text.childNodes, function (ts) {
      ts.setAttribute('x', x.toFixed(2));
    });

    /* ── the furniture ───────────────────────────────────────────────────
       Red stays, but as an accent beside the type rather than a band through
       it: a rule under the last line, and a mark in the corner. The eyebrow
       gives the upper third something to hold, so a two-word topic does not
       leave two thirds of the panel empty. */
    /* The rule sits above the type, not under it. On the lead plate the
       bottom third is under a cream gradient that keeps the headline
       readable, and a red rule down there came out pink. */
    svg.appendChild(el('rect', {
      x: x.toFixed(2),
      y: (H * 0.20).toFixed(2),
      width: (W * 0.16).toFixed(2),
      height: (H * 0.022).toFixed(2),
      fill: RED
    }));

    var eyebrow = el('text', {
      'font-family': "Archivo, 'Helvetica Neue', Arial, sans-serif",
      'font-size': wide ? 26 : 32,
      'font-variation-settings': "'wdth' 90, 'wght' 700",
      'letter-spacing': '0.24em',
      fill: CRM,
      'fill-opacity': '.5',
      x: x.toFixed(2),
      y: (H * 0.14).toFixed(2)
    });
    eyebrow.textContent = 'MORDAZ';
    svg.appendChild(eyebrow);

    var markSize = wide ? 26 : 32;
    svg.appendChild(el('rect', {
      x: (W - x - markSize).toFixed(1),
      y: (H * 0.14 - markSize).toFixed(1),
      width: markSize, height: markSize,
      fill: RED
    }));

    node.classList.add('is-drawn');
  }

  /* ── the photo tritone ──────────────────────────────────────────────
     Maps a photograph onto the site's three colours: shadows to ink,
     midtones to red, highlights to cream. Injected once, only if the page
     actually contains a photograph, so pages of generated plates carry no
     extra markup.

     tableValues are the real token values as 0–1 channel stops, read from
     the CSS custom properties — change the palette and photos follow. */
  function injectDuotone() {
    if (document.getElementById('mordaz-duotone')) return;
    if (!document.querySelector('.plate img')) return;

    function stops(i) {
      return [INK, RED, CRM].map(function (hex) {
        var h = hex.replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return (parseInt(h.substr(i * 2, 2), 16) / 255).toFixed(3);
      }).join(' ');
    }

    var svg = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');

    var filter = el('filter', {
      id: 'mordaz-duotone',
      'color-interpolation-filters': 'sRGB'
    });

    /* to luminance first, so hue in the original can't skew the mapping */
    filter.appendChild(el('feColorMatrix', {
      type: 'matrix',
      values: '0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0'
    }));

    var xfer = el('feComponentTransfer', {});
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(function (fn, i) {
      xfer.appendChild(el(fn, { type: 'table', tableValues: stops(i) }));
    });
    filter.appendChild(xfer);

    svg.appendChild(filter);
    document.body.appendChild(svg);
    document.documentElement.classList.add('has-duo');
  }

  function run() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plate]'), draw);
    injectDuotone();
  }

  /* Redraw on resize, debounced: the plate's aspect ratio changes at the
     breakpoints, and the viewBox is derived from it. */
  var t = null;
  window.addEventListener('resize', function () {
    if (t) clearTimeout(t);
    t = setTimeout(run, 220);
  }, { passive: true });

  /* The plate is sized against real glyph metrics, so it has to wait for the
     webfont — measuring against the fallback would break every line. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run).catch(run);
  } else {
    run();
  }
}());

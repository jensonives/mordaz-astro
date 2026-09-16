/* ═══════════════════════════════════════════════════════════════════════
   MORDAZ — plates
   ───────────────────────────────────────────────────────────────────────
   Every piece gets a generated plate instead of a photograph or a stock
   illustration. The plate sets the RECEIVED VIEW — the thing everybody says
   — at poster scale, and strikes the red band through it.

   That is the whole argument in one image: here is the conventional wisdom,
   crossed out. The band is not decoration; it is the rebuttal.

   Two rules make this art direction rather than ornament:

   1. It is DETERMINISTIC. The claim is the only seed, so a given piece always
      produces the same plate — every device, every load. Nothing is random
      at view time.
   2. It is DERIVED FROM CONTENT. Line breaks, scale, which line gets struck
      and where the band sits all fall out of the words themselves. No two
      plates match, and none of it needed a photographer.

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

    /* ── set the claim ── */
    var words = claim.split(/\s+/);
    var count = wide ? (words.length > 5 ? 2 : 1)
                     : (words.length > 6 ? 3 : words.length > 2 ? 2 : 1);
    var lines = wrap(words, count);

    var PROBE = 100;
    var text = el('text', {
      'font-family': "Archivo, 'Helvetica Neue', Arial, sans-serif",
      'font-size': PROBE,
      'font-variation-settings': "'wdth' 96, 'wght' 800",
      'letter-spacing': '-0.015em',
      fill: CRM
    });

    lines.forEach(function (ln, i) {
      var ts = el('tspan', { x: 0, dy: (i === 0 ? 0 : LH) + 'em' });
      ts.textContent = ln;
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

    /* The claim has to be READABLE — the plate only works if you can see what
       is being struck out.

       The measure is what is left after the left inset, counted on both sides.
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
    var byHeight = (H * 0.92) / ((lines.length - 1) * LH + 1);
    var size     = Math.min(byWidth, byHeight);

    var block = (lines.length - 1) * LH * size;
    var first = (H - block) / 2 + size * 0.30 + (rand() - 0.5) * H * 0.06;

    /* The jitter above is what stops every plate sitting at exactly the same
       height. Clamp it so it can never push the type out of the frame: cap
       height above the first baseline, descender below the last. */
    var minFirst = H * 0.04 + size * 0.75;
    var maxFirst = H * 0.96 - block - size * 0.22;
    if (maxFirst > minFirst) first = Math.max(minFirst, Math.min(maxFirst, first));

    text.setAttribute('font-size', size.toFixed(2));
    text.setAttribute('y', first.toFixed(2));
    Array.prototype.forEach.call(text.childNodes, function (ts) {
      ts.setAttribute('x', x.toFixed(2));
    });

    /* ── the strike: a band through one line, with that line re-cut in ink ── */
    var struck   = Math.floor(rand() * lines.length);
    var baseline = first + struck * LH * size;
    var bandH    = size * 0.30;
    var bandY    = baseline - size * 0.32;

    svg.appendChild(el('rect', {
      x: 0, y: bandY.toFixed(2), width: W, height: bandH.toFixed(2), fill: RED
    }));

    var clipId = 'strike-' + (hash(claim) % 99991);
    var defs = el('defs');
    var clip = el('clipPath', { id: clipId });
    clip.appendChild(el('rect', { x: 0, y: bandY.toFixed(2), width: W, height: bandH.toFixed(2) }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var cut = text.cloneNode(true);
    cut.setAttribute('fill', INK);
    cut.setAttribute('clip-path', 'url(#' + clipId + ')');
    svg.appendChild(cut);

    /* one red mark, clear of the band — the only free element */
    svg.appendChild(el('circle', {
      cx: (W * (0.05 + rand() * 0.04)).toFixed(1),
      cy: (bandY > H / 2 ? H * 0.13 : H * 0.88).toFixed(1),
      r: wide ? 13 : 17,
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

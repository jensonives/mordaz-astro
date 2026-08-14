/* ═══════════════════════════════════════════════════════════════════════
   MORDAZ — Responses
   ───────────────────────────────────────────────────────────────────────
   A working threaded comment system with no server behind it. Posting,
   replying, agreeing and sorting all work; the thread persists in this
   browser via localStorage.

   ┌─ SWAP POINT ──────────────────────────────────────────────────────┐
   │ Everything that touches storage lives in `Store` below, and        │
   │ nothing else in this file knows where the data comes from.         │
   │ To move to a real backend, replace Store.read and Store.write with │
   │ fetch() calls and make render() await them. No other change is     │
   │ needed. See CONTENT.md for the shape of a comment object.          │
   └────────────────────────────────────────────────────────────────────┘

   Note on scope: because the store is localStorage, responses are visible
   only to the person who wrote them, on the device they wrote them on.
   That is a genuine limitation, not a bug — see README.md.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var root = document.getElementById('responses');
  if (!root) return;

  var THREAD  = root.getAttribute('data-thread') || 'default';
  var MAXLEN  = 1200;


  /* ─── Store ─────────────────────────────────────────────────────────
     The only part of this file that knows about persistence.
     Comment shape: { id, parent, name, body, at, up, voted, mine }      */

  var Store = {
    key: 'mordaz:responses:' + THREAD,
    memory: null,

    read: function () {
      if (this.memory) return this.memory;
      try {
        var raw = window.localStorage.getItem(this.key);
        this.memory = raw ? JSON.parse(raw) : seed();
      } catch (err) {
        /* private browsing, or storage disabled — hold it in memory only */
        this.memory = seed();
      }
      return this.memory;
    },

    write: function (list) {
      this.memory = list;
      try {
        window.localStorage.setItem(this.key, JSON.stringify(list));
      } catch (err) {
        /* nothing to do; the thread still works for this page view */
      }
    }
  };

  /* Demo responses, used only until the first real one is posted.
     REPLACE or empty this array — see CONTENT.md. */
  function seed() {
    var hour = 3600000;
    var now  = Date.now();
    return [
      { id: 's1', parent: null, name: 'M. Hale', at: now - hour * 2, up: 18, voted: false, mine: false,
        body: 'The received view is stated a bit too neatly. A problem can be genuinely hard AND unprofitable to solve — those are not alternatives.' },
      { id: 's2', parent: 's1', name: 'Jenson Ives', at: now - hour, up: 6, voted: false, mine: false,
        body: 'Agreed, but notice which of the two gets called a puzzle in the press releases. Nobody reaches for the word when the fix is cheap.' },
      { id: 's3', parent: null, name: 'R. Okonjo', at: now - hour * 26, up: 11, voted: false, mine: false,
        body: 'Would like to see this run against the 2019 numbers. My hunch is the pattern is older than the piece allows for.' }
    ];
  }


  /* ─── Helpers ───────────────────────────────────────────────────────── */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   /* textContent, never innerHTML */
    return n;
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function when(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function agreeIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 3 23 21H1z');
    svg.appendChild(path);
    return svg;
  }


  /* ─── State ─────────────────────────────────────────────────────────── */

  var sort     = 'newest';
  var replyTo  = null;

  var thread   = root.querySelector('#thread');
  var counter  = root.querySelector('#resp-count');
  var empty    = root.querySelector('#resp-empty');
  var form     = root.querySelector('#comp');
  var nameIn   = root.querySelector('#comp-name');
  var bodyIn   = root.querySelector('#comp-body');
  var postBtn  = root.querySelector('#comp-post');
  var countEl  = root.querySelector('#comp-count');


  /* ─── Render ────────────────────────────────────────────────────────── */

  function render() {
    var all   = Store.read();
    var roots = all.filter(function (c) { return !c.parent; });

    roots.sort(function (a, b) {
      if (sort === 'top' && b.up !== a.up) return b.up - a.up;
      return b.at - a.at;
    });

    thread.textContent = '';
    roots.forEach(function (c) { thread.appendChild(node(c, all)); });

    counter.textContent = all.length + (all.length === 1 ? ' response' : ' responses');
    empty.hidden = all.length !== 0;
  }

  function node(c, all) {
    var wrap = el('article', 'cmt');

    /* byline */
    var top = el('div', 'cmt__top');
    top.appendChild(el('span', 'cmt__who', c.name));
    if (c.mine) top.appendChild(el('span', 'cmt__mine', 'You'));
    top.appendChild(el('span', 'cmt__when', when(c.at)));
    wrap.appendChild(top);

    wrap.appendChild(el('p', 'cmt__body', c.body));

    /* actions */
    var acts = el('div', 'cmt__acts');

    var agree = el('button', 'cmt__act' + (c.voted ? ' is-on' : ''));
    agree.type = 'button';
    agree.setAttribute('aria-pressed', String(!!c.voted));
    agree.appendChild(agreeIcon());
    agree.appendChild(el('span', null, String(c.up)));
    agree.appendChild(el('span', 'u-sr', 'Agree with ' + c.name));
    agree.addEventListener('click', function () { vote(c.id); });
    acts.appendChild(agree);

    if (!c.parent) {
      var reply = el('button', 'cmt__act');
      reply.type = 'button';
      reply.textContent = '↳ Reply';
      reply.addEventListener('click', function () { openReply(c.id, wrap); });
      acts.appendChild(reply);
    }

    wrap.appendChild(acts);

    /* replies, always chronological */
    var kids = all.filter(function (k) { return k.parent === c.id; })
                  .sort(function (a, b) { return a.at - b.at; });

    if (kids.length) {
      var box = el('div', 'cmt__kids');
      kids.forEach(function (k) { box.appendChild(node(k, all)); });
      wrap.appendChild(box);
    }

    if (replyTo === c.id) wrap.appendChild(replyForm(c));

    return wrap;
  }


  /* ─── Reply composer ────────────────────────────────────────────────── */

  function replyForm(parent) {
    var f = el('form', 'comp cmt__reply');

    var label = el('label', 'u-sr', 'Your reply to ' + parent.name);
    var id = 'reply-' + parent.id;
    label.setAttribute('for', id);

    var ta = el('textarea');
    ta.id = id;
    ta.placeholder = 'Reply to ' + parent.name + '…';
    ta.maxLength = MAXLEN;
    ta.required = true;

    var foot = el('div', 'comp__foot');
    var send = el('button', 'btn', 'Post reply');
    send.type = 'submit';
    var cancel = el('button', 'btn btn--ghost', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { replyTo = null; render(); });

    foot.appendChild(send);
    foot.appendChild(cancel);

    f.appendChild(label);
    f.appendChild(ta);
    f.appendChild(foot);

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) return;
      add(text, parent.id);
      replyTo = null;
      render();
    });

    window.requestAnimationFrame(function () { ta.focus(); });
    return f;
  }

  function openReply(id) {
    replyTo = replyTo === id ? null : id;
    render();
  }


  /* ─── Mutations ─────────────────────────────────────────────────────── */

  function add(body, parent) {
    var list = Store.read().slice();
    list.push({
      id: uid(),
      parent: parent || null,
      name: (nameIn && nameIn.value.trim()) || 'Reader',
      body: body,
      at: Date.now(),
      up: 0,
      voted: false,
      mine: true
    });
    Store.write(list);
  }

  function vote(id) {
    var list = Store.read().map(function (c) {
      if (c.id !== id) return c;
      var voted = !c.voted;
      return Object.assign({}, c, { voted: voted, up: c.up + (voted ? 1 : -1) });
    });
    Store.write(list);
    render();
  }


  /* ─── Top-level composer ────────────────────────────────────────────── */

  if (form) {
    var sync = function () {
      var len = bodyIn.value.trim().length;
      countEl.textContent = len + ' / ' + MAXLEN;
      countEl.classList.toggle('is-over', len > MAXLEN);
      postBtn.disabled = len === 0 || len > MAXLEN;
    };

    bodyIn.addEventListener('input', sync);
    sync();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = bodyIn.value.trim();
      if (!text || text.length > MAXLEN) return;
      add(text, null);
      bodyIn.value = '';
      sync();
      sort = 'newest';
      syncSort();
      render();
    });
  }


  /* ─── Sort ──────────────────────────────────────────────────────────── */

  var sorters = root.querySelectorAll('[data-sort]');

  function syncSort() {
    Array.prototype.forEach.call(sorters, function (b) {
      var on = b.getAttribute('data-sort') === sort;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  Array.prototype.forEach.call(sorters, function (b) {
    b.addEventListener('click', function () {
      sort = b.getAttribute('data-sort');
      syncSort();
      render();
    });
  });

  syncSort();
  render();
}());

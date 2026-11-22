/* شبّة — النواة: أدوات مشتركة بين كل الألعاب */
(function () {
  'use strict';
  const SH = (window.SH = { games: [] });

  /* ---------- أدوات عامة ---------- */
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function h(sel, props, ...kids) {
    const parts = sel.split('.');
    const el = document.createElement(parts[0] || 'div');
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    if (props != null && (typeof props !== 'object' || props.nodeType || Array.isArray(props))) { kids.unshift(props); props = null; }
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'html') el.innerHTML = v;
        else if (k === 'style') { for (const s in v) { if (s.startsWith('--')) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; } }
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k.startsWith('aria-') || k === 'role' || k === 'for' || k === 'viewBox') el.setAttribute(k, v);
        else { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
      }
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
  }

  const Store = {
    get(k, d) { try { const v = localStorage.getItem('shabbah:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('shabbah:' + k, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } },
  };

  /* سحب بدون تكرار: يتذكّر اللي انسحب حتى بين الجلسات */
  function deck(key, items) {
    let seen = new Set(Store.get('deck:' + key, []).filter((i) => i < items.length));
    let pool = shuffle(items.map((_, i) => i).filter((i) => !seen.has(i)));
    return {
      next() {
        if (!pool.length) { seen = new Set(); pool = shuffle(items.map((_, i) => i)); }
        const i = pool.pop(); seen.add(i); Store.set('deck:' + key, [...seen]);
        return items[i];
      },
    };
  }

  /* ---------- الصوت والاهتزاز ---------- */
  const Sound = {
    on: Store.get('sound', true),
    ac: null,
    ctx() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ac = new AC(); } catch (e) { return null; }
      }
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      return this.ac;
    },
    tone(f, d, o = {}) {
      const ac = this.ctx(); if (!ac) return;
      const t = ac.currentTime + (o.at || 0);
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
      const v = o.vol == null ? 0.14 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g).connect(ac.destination);
      osc.start(t); osc.stop(t + d + 0.04);
    },
    noise(d, o = {}) {
      const ac = this.ctx(); if (!ac) return;
      const t = ac.currentTime + (o.at || 0);
      const len = Math.floor(ac.sampleRate * d);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(o.from || 2000, t);
      f.frequency.exponentialRampToValueAtTime(o.to || 200, t + d);
      const g = ac.createGain(); g.gain.value = o.vol == null ? 0.3 : o.vol;
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
    },
    play(name) {
      if (!this.on) return;
      const s = this;
      const lib = {
        tap() { s.tone(520, 0.06, { type: 'triangle', vol: 0.08 }); },
        pop() { s.tone(620, 0.09, { to: 1100, vol: 0.1 }); },
        good() { s.tone(660, 0.12); s.tone(880, 0.12, { at: 0.1 }); s.tone(1320, 0.24, { at: 0.2 }); },
        bad() { s.tone(230, 0.28, { type: 'sawtooth', to: 110, vol: 0.1 }); },
        tick() { s.tone(1150, 0.04, { type: 'square', vol: 0.045 }); },
        tock() { s.tone(760, 0.05, { type: 'square', vol: 0.05 }); },
        end() { s.tone(320, 0.5, { type: 'square', to: 150, vol: 0.09 }); },
        flip() { s.noise(0.07, { from: 3200, to: 900, vol: 0.14 }); },
        reveal() { s.tone(300, 0.45, { to: 950, vol: 0.12 }); },
        boom() { s.noise(1.0, { from: 1100, to: 50, vol: 0.8 }); s.tone(95, 0.7, { to: 32, vol: 0.5 }); },
        win() { [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.22, { at: i * 0.11, type: 'triangle', vol: 0.13 })); s.tone(1047, 0.6, { at: 0.6, vol: 0.1 }); },
      };
      try { lib[name] && lib[name](); } catch (e) { /* الصوت غير متاح */ }
    },
  };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* ما فيه اهتزاز */ } };

  /* ---------- مؤثرات ---------- */
  function confetti(n = 150) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = h('canvas.confetti'); document.body.append(cv);
    const c = cv.getContext('2d'); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const cols = ['#FFC83D', '#FF8A1F', '#D8343B', '#12996A', '#17B5B0', '#F0699C', '#7A5CF0', '#FFF6E6'];
    const ps = Array.from({ length: n }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.38,
      vx: (Math.random() - 0.5) * 24 * dpr, vy: (-Math.random() * 20 - 7) * dpr,
      s: (7 + Math.random() * 9) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: pick(cols), tri: Math.random() < 0.45,
    }));
    const t0 = performance.now(), life = 3400;
    (function loop(now) {
      const el = now - t0; c.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.55 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.globalAlpha = Math.max(0, 1 - el / life);
        if (p.tri) { c.beginPath(); c.moveTo(0, -p.s / 2); c.lineTo(p.s / 2, p.s / 2); c.lineTo(-p.s / 2, p.s / 2); c.fill(); }
        else c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        c.restore();
      }
      if (el < life && cv.isConnected) requestAnimationFrame(loop); else cv.remove();
    })(t0);
  }

  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = h('div.toast', { role: 'status' }, msg); document.body.append(toastEl);
    clearTimeout(toastT); toastT = setTimeout(() => toastEl && toastEl.remove(), 2200);
  }

  function modal(content, opts = {}) {
    const box = h('div.modal-box', content);
    const wrap = h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, box);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); };
    if (opts.dismiss !== false) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    document.body.append(wrap);
    return { close, el: wrap };
  }
  function confirmBox(msg, yes = 'إيه', no = 'لا') {
    return new Promise((res) => {
      const m = modal([
        h('p.modal-msg', msg),
        h('div.row', h('button.btn.btn-fire', { onclick() { m.close(); res(true); } }, yes), h('button.btn', { onclick() { m.close(); res(false); } }, no)),
      ], { dismiss: false });
    });
  }

  let wakeLock = null;
  async function wake(on) {
    try {
      if (on && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  /* ---------- مكوّنات اللعب ---------- */
  const PALETTE = ['#D8343B', '#2F74E8', '#12996A', '#E0880A', '#7A5CF0', '#D9488B', '#0FA3A0', '#B4530A', '#5B6CFF', '#8A9A1F', '#C0392B', '#3D8B6E'];
  const TEAM_NAMES = ['الصقور', 'النشامى', 'الفرسان', 'الذيابة'];

  /* نص له صيغتين: واحدة للوضع النهاري وواحدة لليلي، والتبديل بالـCSS فيتبع الثيم تلقائياً */
  const dayNight = (day, night) => h('span', h('span.when-day', day), h('span.when-night', night));
  const gname = (g) => (g.nameEl ? g.nameEl() : g.name);
  const isDay = () => currentTheme() === 'light';
  /* نص عادي من قيمة قد تكون نصاً أو عنصر dayNight (نحتاجه في بطاقة النتيجة) */
  const plain = (x) => (x == null ? '' : typeof x === 'string' ? x : ((x.querySelector && x.querySelector(isDay() ? '.when-day' : '.when-night')) || x).textContent);
  /* أسئلة العائلة المحفوظة على الجهاز */
  const mine = () => { const d = Store.get('mine', null) || {}; return { trivia: d.trivia || [], whois: d.whois || [], truth: d.truth || [], dare: d.dare || [] }; };

  function seg(choices, value, onChange, multi) {
    const el = h('div.seg', { role: 'group' });
    const isOn = (v) => (multi ? value.includes(v) : value === v);
    choices.forEach(([v, label]) => {
      el.append(h('button', {
        type: 'button', 'aria-pressed': String(isOn(v)),
        onclick(e) {
          Sound.play('tap');
          if (multi) {
            if (value.includes(v)) { if (value.length > 1) value = value.filter((x) => x !== v); }
            else value = value.concat([v]);
          } else value = v;
          [...el.children].forEach((b, i) => b.setAttribute('aria-pressed', String(isOn(choices[i][0]))));
          onChange(value);
        },
      }, label));
    });
    return el;
  }

  function timer(ctx, secs, opts = {}) {
    const num = h('span', String(secs));
    const el = h('div.timer' + (opts.large ? '.timer-lg' : ''), { role: 'timer', html: '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="t-bg" cx="50" cy="50" r="44"/><circle class="t-fg" cx="50" cy="50" r="44" pathLength="100"/></svg>' }, num);
    let total = secs, left = secs, last = 0, id = null, lastWhole = secs;
    const paint = () => {
      num.textContent = String(Math.ceil(left));
      el.style.setProperty('--p', String(clamp(left / total, 0, 1)));
      el.classList.toggle('low', left <= 5.05);
    };
    const api = {
      el,
      get left() { return left; },
      get total() { return total; },
      get running() { return id != null; },
      start() {
        if (id != null) return api;
        last = performance.now();
        id = ctx.interval(() => {
          const now = performance.now(); left -= (now - last) / 1000; last = now;
          if (left <= 0) { left = 0; paint(); api.stop(); Sound.play('end'); buzz([120, 60, 120]); opts.onEnd && opts.onEnd(); return; }
          const w = Math.ceil(left);
          if (w !== lastWhole) { lastWhole = w; if (w <= 5) Sound.play('tick'); opts.onTick && opts.onTick(w); }
          paint();
        }, 100);
        return api;
      },
      stop() { if (id != null) { ctx.clear(id); id = null; } return api; },
    };
    paint();
    return api;
  }

  function scorebar(list, active) {
    return h('div.scores', list.map((t, i) => h('div.score' + (i === active ? '.on' : '') + (t.out ? '.out' : ''), { style: { '--c': t.color } }, h('i'), h('span', t.name), h('b', String(t.score)))));
  }

  /* 3 2 1 */
  function countdown(ctx, words, done) {
    const b = h('b'); const el = h('div.countdown', b); document.body.append(el);
    ctx.onCleanup(() => el.remove());
    let i = 0;
    (function step() {
      if (i >= words.length) { el.remove(); done && done(); return; }
      b.textContent = words[i]; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
      Sound.play(i === words.length - 1 ? 'pop' : 'tock'); i++;
      ctx.timeout(step, 750);
    })();
  }

  /* ---------- تجهيز الفرق واللاعبين ---------- */
  function teamSetup(min, max) {
    const saved = Store.get('teams', null);
    let names = (saved && saved.names) || TEAM_NAMES.slice();
    let n = clamp((saved && saved.n) || 2, min, max);
    const list = h('div.names'); const count = h('b', String(n));
    const draw = () => {
      count.textContent = String(n);
      list.replaceChildren(...Array.from({ length: n }, (_, i) => h('div.name-row', { style: { '--c': PALETTE[i] } }, h('span.dot'),
        h('input', { id: 'team-name-' + i, type: 'text', maxLength: 16, value: names[i] || '', placeholder: TEAM_NAMES[i], 'aria-label': 'اسم الفريق ' + (i + 1), oninput(e) { names[i] = e.target.value; } }))));
    };
    draw();
    const el = h('div.field',
      h('div.row', { style: { justifyContent: 'space-between' } }, h('span.label', { style: { margin: 0 } }, 'كم فريق؟'),
        h('div.stepper', h('button', { type: 'button', 'aria-label': 'أقل', onclick() { if (n > min) { n--; Sound.play('tap'); draw(); } } }, '−'), count, h('button', { type: 'button', 'aria-label': 'أكثر', onclick() { if (n < max) { n++; Sound.play('tap'); draw(); } } }, '+'))),
      list);
    return {
      el,
      value() {
        Store.set('teams', { n, names });
        return Array.from({ length: n }, (_, i) => ({ name: (names[i] || '').trim() || TEAM_NAMES[i], color: PALETTE[i], score: 0 }));
      },
    };
  }

  function playerSetup(min, max, label) {
    let names = Store.get('players', []).slice(0, max);
    while (names.length < Math.max(min, Math.min(4, max))) names.push('');
    const list = h('div.names');
    const addBtn = h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick() { if (names.length < max) { names.push(''); Sound.play('pop'); draw(true); } } }, '＋ لاعب');
    const draw = (focusLast) => {
      list.replaceChildren(...names.map((nm, i) => h('div.name-row', { style: { '--c': PALETTE[i % PALETTE.length] } }, h('span.dot'),
        h('input', { id: 'player-name-' + i, type: 'text', maxLength: 14, value: nm, placeholder: 'لاعب ' + (i + 1), 'aria-label': 'اسم اللاعب ' + (i + 1), oninput(e) { names[i] = e.target.value; } }),
        names.length > min ? h('button.x', { type: 'button', 'aria-label': 'حذف', onclick() { names.splice(i, 1); Sound.play('tap'); draw(); } }, '✕') : null)));
      addBtn.hidden = names.length >= max;
      if (focusLast) { const inp = list.lastElementChild && list.lastElementChild.querySelector('input'); inp && inp.focus(); }
    };
    draw();
    const el = h('div.field', h('span.label', label || (min === max ? 'أسماء اللاعبين' : `اللاعبين (${min} إلى ${max})`)), list, min === max ? null : addBtn);
    return {
      el,
      value() {
        const prev = Store.get('players', []);
        Store.set('players', names.map((s) => s.trim()).concat(prev.length > max ? prev.slice(max) : []));
        return names.map((s, i) => ({ name: s.trim() || 'لاعب ' + (i + 1), color: PALETTE[i % PALETTE.length], score: 0 }));
      },
    };
  }

  /* ---------- الصفحة الرئيسية ---------- */
  const DALLAH = '<svg viewBox="0 0 100 120" aria-hidden="true"><defs><linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#FFE38F"/><stop offset=".5" stop-color="#FFB02E"/><stop offset="1" stop-color="#C97A0A"/></linearGradient></defs><path d="M65 46c20-4 26 26 8 40" fill="none" stroke="#C97A0A" stroke-width="6" stroke-linecap="round"/><path d="M40 44C28 44 16 40 7 27c5 17 18 28 33 28z" fill="url(#dg)"/><path d="M36 40c0 12 6 14 6 22 0 10-16 16-16 32 0 10 8 16 24 16s24-6 24-16c0-16-16-22-16-32 0-8 6-10 6-22z" fill="url(#dg)"/><path d="M36 40c2-14 26-14 28 0z" fill="#FFD25E"/><path d="M50 29V18" stroke="#C97A0A" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="14" r="4.5" fill="#FFD25E"/><path d="M41 62h18M31 84h38" stroke="#9A5A06" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>';
  SH.DALLAH = DALLAH;

  const SCENE = '<svg class="scene" viewBox="0 0 600 330" role="img" aria-label="شبّة نار ودلّة قهوة في ليل البر"><path class="moon" d="M118 34a44 44 0 1 0 38 66 36 36 0 1 1-38-66z"/><path class="d3" d="M0 250c90-60 190-70 300-40s210 10 300-30v150H0z"/><path class="d1" d="M0 276c120-44 220-36 330-12s190 8 270-18v84H0z"/><g><path d="M455 262c-6-50-2-96 12-132" fill="none" stroke="#7A4A1A" stroke-width="9" stroke-linecap="round"/><path d="M467 132c-34-22-62-14-78 6 26-12 52-10 78-6zm0 0c-8-38-34-52-60-50 26 8 46 24 60 50zm0 0c18-34 48-40 72-30-28 2-52 12-72 30zm0 0c36-10 62 6 72 30-22-18-46-28-72-30zm0 0c-30 2-48 24-50 50 10-24 26-42 50-50z" fill="#12996A"/></g><g><path d="M40 268l74-86 74 86z" fill="#1B1730"/><path d="M114 182l-26 86h52z" fill="#D8343B"/><path d="M62 242h104M50 256h128" stroke="#FFF6E6" stroke-width="4" opacity=".85"/><path d="M114 182v-16" stroke="#FFF6E6" stroke-width="3"/></g><path class="d2" d="M0 300c150-34 300-30 600-8v38H0z"/><g><ellipse cx="300" cy="286" rx="70" ry="12" fill="#FF8A1F" opacity=".28"/><path d="M262 286l76-16M262 270l76 16" stroke="#6B3A12" stroke-width="11" stroke-linecap="round"/><path class="flame" d="M300 190c28 30 40 52 28 76-8 14-48 14-56 0-12-24 4-40 28-76z" fill="#E2343B"/><path class="flame f2" d="M300 214c18 22 26 36 18 52-6 10-30 10-36 0-8-16 2-28 18-52z" fill="#FF8A1F"/><path class="flame f3" d="M300 236c10 12 14 22 9 31-4 6-14 6-18 0-5-9 0-17 9-31z" fill="#FFE38F"/><circle class="spark" cx="306" cy="196" r="3"/><circle class="spark s2" cx="292" cy="204" r="2.4"/><circle class="spark s3" cx="314" cy="210" r="2"/></g><g transform="translate(372 196) scale(.82)"><path class="steam" d="M8 18c-8-8 6-12-2-22"/><path d="M65 46c20-4 26 26 8 40" fill="none" stroke="#C97A0A" stroke-width="6" stroke-linecap="round"/><path d="M40 44C28 44 16 40 7 27c5 17 18 28 33 28z" fill="#FFB02E"/><path d="M36 40c0 12 6 14 6 22 0 10-16 16-16 32 0 10 8 16 24 16s24-6 24-16c0-16-16-22-16-32 0-8 6-10 6-22z" fill="#FFB02E"/><path d="M36 40c2-14 26-14 28 0z" fill="#FFD25E"/><path d="M50 29V18" stroke="#C97A0A" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="14" r="4.5" fill="#FFD25E"/><path d="M41 62h18M31 84h38" stroke="#9A5A06" stroke-width="3" stroke-linecap="round" opacity=".55"/></g><g fill="#FFF6E6"><path d="M214 276h22l-3 16h-16z"/><path d="M240 282h18l-3 13h-12z" opacity=".9"/></g></svg>';

  const FILTERS = [['all', 'الكل'], ['laugh', '🔥 ضحك وحماس'], ['brain', '🧠 تفكير ومعلومات'], ['talk', '🗣️ سوالف'], ['kids', '🧒 تناسب الصغار'], ['duo', '👥 تنلعب لشخصين']];

  let homeScroll = 0, filter = 'all';

  function setTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode); Store.set('theme', mode);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = mode === 'dark' ? '#0F1128' : '#F7EDDC';
  }
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  function soundBtn() {
    const b = h('button.icon-btn', { type: 'button', 'aria-label': 'الصوت', onclick() { Sound.on = !Sound.on; Store.set('sound', Sound.on); b.textContent = Sound.on ? '🔊' : '🔇'; Sound.play('pop'); } }, Sound.on ? '🔊' : '🔇');
    return b;
  }

  function mountHome(app) {
    const grid = h('div.grid');
    const drawGrid = () => {
      const list = SH.games.filter((g) => !g.hidden && (filter === 'all' || g.moods.includes(filter)));
      grid.replaceChildren(...list.map((g, i) => h('a.tile.dye-' + g.color, { href: '#' + g.id, id: 'tile-' + g.id, style: { '--i': i }, onclick() { Sound.play('pop'); } },
        h('span.t-emoji', { 'aria-hidden': 'true' }, g.emoji), h('h3', g.name), h('span.t-tag', g.tagline),
        h('span.t-meta', h('span', '👥 ' + g.players), h('span', '⏱ ' + g.time)))));
    };
    const chips = h('div.chips', { role: 'group', 'aria-label': 'تصفية الألعاب' }, FILTERS.map(([k, label]) => h('button.chip', {
      type: 'button', 'aria-pressed': String(k === filter),
      onclick(e) { filter = k; Sound.play('tap'); [...chips.children].forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); drawGrid(); },
    }, label)));
    drawGrid();

    const surprise = () => {
      const tiles = [...grid.children]; if (!tiles.length) return;
      document.getElementById('games').scrollIntoView({ behavior: 'smooth', block: 'start' });
      let i = 0; const hops = 9 + rnd(tiles.length);
      (function hop() {
        tiles.forEach((t) => t.classList.remove('pulse'));
        const t = tiles[i % tiles.length]; t.classList.add('pulse'); Sound.play('tock'); i++;
        if (i < hops) setTimeout(hop, 70 + i * 16);
        else { Sound.play('good'); setTimeout(() => { if (t.isConnected) location.hash = t.getAttribute('href'); }, 750); }
      })();
    };

    const saved = Store.get('tour', null);
    const live = !!(saved && Array.isArray(saved.games) && saved.idx > 0 && saved.idx < saved.games.length);
    const tourBanner = SH.games.some((g) => g.id === 'tour') ? h('a.tour-banner', { href: '#tour', onclick() { Sound.play('pop'); } },
      h('span.tb-e', { 'aria-hidden': 'true' }, '🏆'),
      h('span.tb-t', h('b', dayNight('بطولة العصرية', 'بطولة السهرة')), h('span', live ? `بطولتكم واقفة عند اللعبة ${saved.idx + 1} من ${saved.games.length}. كمّلوها!` : 'اختاروا ألعابكم، والنقاط تتجمّع من لعبة للعبة لين التتويج.')),
      h('span.tb-go', live ? 'كمّلوا' : 'ابدأوا')) : null;

    const haflaBanner = SH.online && SH.online.available() && SH.games.some((g) => g.id === 'hafla') ? h('a.hafla-banner', { href: '#hafla', onclick() { Sound.play('pop'); } },
      h('span.hb-e', { 'aria-hidden': 'true' }, '🎉'),
      h('span.hb-t', h('b', 'حفلتكم على شبّة'), h('span', 'توديع عزوبية، بيبي شاور، عيد ميلاد: حطّوا صورها وجاوبوا عن أسئلتها، والضيوف يلعبون فقرات كلها عنها.')),
      h('span.hb-go', 'جهّزوها')) : null;

    const own = mine(), ownCount = own.trivia.length + own.whois.length + own.truth.length + own.dare.length;
    const mineLink = SH.games.some((g) => g.id === 'mine') ? h('a.mine-link', { href: '#mine', onclick() { Sound.play('pop'); } },
      h('span.e', { 'aria-hidden': 'true' }, '🏠'),
      h('span', h('b', 'أسئلة العائلة'), ownCount ? `عندكم ${ownCount} من أسئلتكم وسوالفكم في الألعاب.` : 'اكتبوا أسئلتكم وسوالفكم الخاصة وتدخل في الألعاب.'),
      h('span.go', ownCount ? 'عدّلوا' : 'اكتبوا')) : null;

    const onlineLink = SH.online && SH.online.available() && SH.games.some((g) => g.id === 'online') ? h('a.mine-link', { href: '#online', style: { marginBottom: '12px' }, onclick() { Sound.play('pop'); } },
      h('span.e', { 'aria-hidden': 'true' }, '🌐'),
      h('span', h('b', 'العبوا أونلاين'), 'كل واحد يدخل من جواله برمز الغرفة.'),
      h('span.go', 'ادخلوا')) : null;

    const themeB = h('button.icon-btn', { type: 'button', 'aria-label': 'تبديل الوضع الليلي والنهاري', onclick() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); themeB.textContent = currentTheme() === 'dark' ? '☀️' : '🌙'; Sound.play('pop'); } }, currentTheme() === 'dark' ? '☀️' : '🌙');

    app.replaceChildren(
      h('div.sky'),
      h('header.hero',
        h('div.wrap.nav', h('div.logo', h('span', { html: DALLAH }), 'شبّة'), h('span.grow'), soundBtn(), themeB),
        h('div.wrap.hero-in',
          h('div.hero-text',
            h('span.kicker', '🔥 شبّوا الضو وقرّبوا'),
            h('h1.brand', 'شبّة'),
            h('h2', 'ألعاب الجَمعة السعودية'),
            h('p.lead', 'مكتبة ألعاب جماعية للعائلة والأصحاب، بأسئلة وسوالف من ديرتنا: أمثالنا، لهجاتنا، أكلاتنا وكورتنا. جوال واحد يكفي الجلسة كلها.'),
            h('div.hero-cta',
              h('a.btn.btn-fire.btn-xl', { href: '#games', onclick(e) { e.preventDefault(); Sound.play('pop'); document.getElementById('games').scrollIntoView({ behavior: 'smooth' }); } }, 'يلا نلعب'),
              h('button.btn.btn-xl', { type: 'button', onclick: surprise }, '🎲 اختاروا لنا')),
            h('div.hero-facts', h('span', h('b', String(SH.games.filter((g) => !g.hidden).length)), 'لعبة'), h('span', h('b', '0'), 'تسجيل'), h('span', h('b', '100%'), 'مناسبة للعائلة'), h('span', 'تشتغل بدون نت'))),
          h('div.scene-wrap', { html: SCENE }))),
      h('div.sadu', { role: 'presentation' }),
      h('main',
        h('section.section.wrap', { id: 'games' },
          tourBanner, haflaBanner, onlineLink, mineLink,
          h('div.section-head', h('h2', 'مكتبة الألعاب'), h('p', 'اختاروا على مزاج الجلسة')),
          chips, grid)),
      h('div.sadu', { role: 'presentation' }),
      h('footer.foot.wrap', h('p', h('b', 'شبّة'), ' — صُنعت للجمعات الحلوة. كل المحتوى نظيف ومناسب لكل الأعمار.'), h('p', 'ثبّتوها على الجوال من قائمة المتصفح «إضافة إلى الشاشة الرئيسية» وتشتغل معكم حتى في البر.'))
    );
    requestAnimationFrame(() => window.scrollTo(0, homeScroll));
  }

  /* ---------- تشغيل لعبة ---------- */
  let active = null;

  function teardown() {
    if (!active) return;
    active.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    active.cleanups.forEach((fn) => { try { fn(); } catch (e) { /* تجاهل */ } });
    active = null; wake(false);
    document.querySelectorAll('.modal, .countdown, .confetti, .duel').forEach((n) => n.remove());
  }

  function mountGame(app, g) {
    const stage = h('div.stage');
    const ctx = (active = {
      game: g, stage, timers: new Set(), cleanups: [], dirty: false,
      show(node) { stage.replaceChildren(node); window.scrollTo(0, 0); return node; },
      view(...kids) { return ctx.show(h('div.view', kids)); },
      timeout(fn, ms) { const t = setTimeout(() => { ctx.timers.delete(t); if (active === ctx) fn(); }, ms); ctx.timers.add(t); return t; },
      interval(fn, ms) { const t = setInterval(() => { if (active === ctx) fn(); }, ms); ctx.timers.add(t); return t; },
      clear(t) { clearTimeout(t); clearInterval(t); ctx.timers.delete(t); },
      onCleanup(fn) { ctx.cleanups.push(fn); },
      home() { location.hash = ''; },
      /* يوقف مؤقتات ومخلّفات اللعبة الحالية (بين ألعاب البطولة أو عند الإعادة) */
      reset() {
        ctx.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); ctx.timers.clear();
        ctx.cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* تجاهل */ } });
        document.querySelectorAll('.modal, .countdown, .duel').forEach((n) => n.remove());
      },
      restart() { ctx.reset(); ctx.dirty = false; ctx.setGame(g); g.start(ctx); },
      /* this وليس ctx: عشان اللعبة الفرعية في البطولة تمرّر إعداداتها */
      intro(spec) { intro(this, spec); },
      results(spec) { results(this, spec); },
      pass(name, cb, o) { pass(ctx, name, cb, o); },
    });

    let shown = g;
    const title = h('div.title');
    const shell = h('div.game');
    ctx.setGame = (x) => { shown = x; shell.className = 'game dye-' + x.color; title.replaceChildren(h('span', { 'aria-hidden': 'true' }, x.emoji), gname(x)); };
    ctx.setGame(g);

    const help = () => {
      const m = modal([
        h('h3', shown.emoji + ' ', gname(shown)),
        h('ol.steps.dye-' + shown.color, shown.how.map((s) => h('li', s))),
        h('button.btn.btn-gold.btn-block', { onclick() { m.close(); } }, 'فهمت'),
      ]);
    };
    const leave = async () => {
      Sound.play('tap');
      if (!ctx.dirty || (await confirmBox(g.leaveMsg || 'تطلعون من اللعبة؟ النتيجة بتروح.', 'نطلع', 'نكمّل'))) ctx.home();
    };

    app.replaceChildren(
      h('div.sky'),
      shell);
    shell.append(
      h('div.topbar',
        h('button.icon-btn', { type: 'button', 'aria-label': 'رجوع للمكتبة', onclick: leave }, '✕'),
        title,
        h('button.icon-btn', { type: 'button', 'aria-label': 'طريقة اللعب', onclick() { Sound.play('tap'); help(); } }, '؟'),
        soundBtn()),
      h('div.topbar-band'),
      stage);
    window.scrollTo(0, 0);
    wake(true);
    g.start(ctx);
  }

  /* ctx.preset (في البطولة): { kicker, note, defaults, roster() } يغني عن تسجيل الفرق */
  function intro(ctx, spec) {
    const g = ctx.game, pre = ctx.preset || null;
    const savedOpt = pre ? pre.defaults : Store.get('opt:' + g.id, {});
    const cfg = {};
    const fields = [];
    let setup = null;
    if (!pre && spec.setup === 'teams') setup = teamSetup(spec.min || 2, spec.max || 4);
    if (!pre && spec.setup === 'players') setup = playerSetup(spec.min || 2, spec.max || 10, spec.setupLabel);
    (spec.options || []).forEach((o) => {
      const valid = o.choices.map((c) => c[0]);
      let v = savedOpt[o.key];
      if (o.multi) { v = Array.isArray(v) ? v.filter((x) => valid.includes(x)) : null; if (!v || !v.length) v = o.def; }
      else if (!valid.includes(v)) v = o.def;
      cfg[o.key] = v;
      fields.push(h('div.field', h('span.label', o.label), seg(o.choices, v, (nv) => { cfg[o.key] = nv; }, o.multi)));
    });
    const go = () => {
      const roster = pre ? pre.roster() : setup ? setup.value() : null;
      if (spec.setup === 'teams') cfg.teams = roster;
      if (spec.setup === 'players') cfg.players = roster;
      const err = spec.validate && spec.validate(cfg);
      if (err) { Sound.play('bad'); toast(err); return; }
      Sound.play('good'); buzz(30);
      if (!pre) { const optOnly = {}; (spec.options || []).forEach((o) => { optOnly[o.key] = cfg[o.key]; }); Store.set('opt:' + g.id, optOnly); }
      ctx.dirty = true;
      spec.onStart(cfg);
    };
    ctx.view(
      pre ? h('p.center', h('span.pill.gold', pre.kicker)) : null,
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, g.emoji), h('h1', gname(g)), h('p', g.tagline)),
      h('div.card', h('h3', 'كيف نلعب؟'), h('ol.steps', g.how.map((s) => h('li', s)))),
      pre && pre.note ? h('div.note', h('b', 'في البطولة: '), pre.note) : null,
      setup || fields.length ? h('div.card', setup ? setup.el : null, fields) : null,
      h('div.sticky-cta', h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick: go }, spec.startLabel || 'ابدأ اللعب'))
    );
  }

  function results(ctx, spec) {
    if (ctx.onResults) return ctx.onResults(spec);
    ctx.dirty = false;
    const rows = spec.rows.slice().sort((a, b) => b.score - a.score);
    const top = rows[0];
    const tie = !spec.headline && rows.length > 1 && rows[1].score === top.score;
    Sound.play('win'); buzz([60, 40, 60, 40, 160]); confetti();
    const medals = ['🥇', '🥈', '🥉'];
    let place = 0;
    const ranked = rows.map((r, i) => { if (i > 0 && r.score < rows[i - 1].score) place = i; return { r, place, medal: medals[place] || String(place + 1) }; });
    const icon = spec.icon || (tie ? '🤝' : '🏆');
    const kicker = spec.kicker || (tie ? 'تعادل! ما فيه غالب ولا مغلوب' : 'الفايز');
    const headline = spec.headline || (tie ? rows.filter((r) => r.score === top.score).map((r) => r.name).join(' و ') : top.name);
    const award = spec.award ? (typeof spec.award === 'function' ? spec.award(top, tie) : spec.award) : null;
    const listed = rows.length > 1 || spec.showSingle;
    const g = ctx.game;
    const card = {
      game: plain(gname(g)), emoji: g.emoji, icon, kicker: plain(kicker), headline: plain(headline), award: plain(award),
      rows: listed ? ranked.map((x) => ({ name: x.r.name, score: String(x.r.score) + (spec.unit ? ' ' + spec.unit : ''), medal: x.medal })) : [],
    };
    /* نجهّز الصورة من الحين، عشان المشاركة تشتغل مباشرة مع الضغطة (بعض الجوالات ترفضها لو تأخرت) */
    let cardBlob = null;
    if (SH.cardBlob) SH.cardBlob(card).then((b) => { cardBlob = b; });
    const share = () => { Sound.play('pop'); SH.share(card, cardBlob); };
    ctx.view(
      h('div.podium',
        h('span.crown', { 'aria-hidden': 'true' }, icon),
        h('p.eyebrow', kicker),
        h('div.who', headline),
        award ? h('span.award', award) : null),
      listed ? h('div.rank', ranked.map((x, i) => h('div.rank-row', { style: { '--i': i } }, h('span.m', x.medal), h('span.n', x.r.name, x.r.sub ? h('small', x.r.sub) : null), h('span.s', String(x.r.score) + (spec.unit ? ' ' + spec.unit : ''))))) : null,
      spec.extra || null,
      h('div.spacer'),
      SH.share ? h('button.btn.btn-gold.btn-block', { type: 'button', onclick: share }, '📤 شاركوا النتيجة') : null,
      h('div.row',
        h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); ctx.restart(); } }, '🔁 نعيدها'),
        h('button.btn', { type: 'button', onclick() { Sound.play('tap'); ctx.home(); } }, 'لعبة ثانية'))
    );
  }

  function pass(ctx, name, cb, o = {}) {
    ctx.show(h('div.view', h('div.pass',
      h('span.phone', { 'aria-hidden': 'true' }, '📱'),
      h('p.eyebrow', o.kicker || 'عطوا الجوال لـ'),
      h('div.big', { style: { color: o.color || 'var(--accent)' } }, name),
      o.sub ? h('p.muted', o.sub) : null),
      h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); cb(); } }, o.btn || 'الجوال معي')));
  }

  /* ---------- التوجيه ---------- */
  function route() {
    const app = document.getElementById('app');
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    const g = SH.games.find((x) => x.id === id);
    if (active) teardown();
    else if (g && app.querySelector('.hero')) homeScroll = window.scrollY;
    if (g) mountGame(app, g);
    else {
      mountHome(app);
      if (id === 'games') { const t = document.getElementById(id); t && t.scrollIntoView(); }
    }
  }

  SH.boot = function () {
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl';
    const t = Store.get('theme', null); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && active) wake(true); });
    route();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  };

  Object.assign(SH, { dayNight, isDay, mine, h, rnd, pick, shuffle, clamp, Store, deck, Sound, buzz, confetti, toast, modal, confirm: confirmBox, seg, timer, scorebar, countdown, PALETTE, add(g) { SH.games.push(g); } });
})();

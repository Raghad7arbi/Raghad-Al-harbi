/* شبّة — اللعب أونلاين: غرفة برمز، وكل واحد يلعب من جواله.
   بيانات الغرفة (rooms/الرمز):
     meta    { host, created }            يكتبها المستضيف مرة وحدة
     players { uid: { name, c, at, on } } كل لاعب يكتب نفسه
     state   { game, step, n, ... }       الحالة العامة، يكتبها المستضيف فقط
     inbox   { uid: { n, v } }            ردّ كل لاعب على الخطوة رقم n
     secret  { uid: {...} }               معلومة خاصة لكل لاعب (مثل كلمة السالفة)، و h للمستضيف نفسه
   جهاز المستضيف هو اللي يحرّك اللعبة: يقرأ الردود ويكتب الحالة الجاية.

   كل لعبة أونلاين تتسجّل بـ SH.onlineGame({ id, emoji, name, desc, min, start(R), auto: { الخطوة(R) }, view(R) })
   و R هو واجهة الغرفة (تحت). الألعاب نفسها في ملفات play-*.js */
(function () {
  'use strict';
  const { h, Sound, buzz, Store, rnd, PALETTE } = SH;
  const params = new URLSearchParams(location.search);
  const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');

  SH.onlineGames = [];
  SH.onlineGame = (g) => { SH.onlineGames.push(g); };

  /* ---------- شاشة الدخول ---------- */
  function entry(ctx) {
    const saved = Store.get('online', null) || {};
    const name = h('input.inp', { id: 'on-name', type: 'text', maxLength: 14, autocomplete: 'off', placeholder: 'اسمك', 'aria-label': 'اسمك', value: saved.name || '' });
    const code = h('input.inp', { id: 'on-code', type: 'text', inputMode: 'numeric', maxLength: 6, autocomplete: 'off', placeholder: 'رمز الغرفة (6 أرقام)', 'aria-label': 'رمز الغرفة', value: digits(params.get('room')) || saved.code || '' });
    const status = h('p.muted.center.small', { role: 'status' });
    let busy = false;
    const go = async (create) => {
      if (busy) return;
      const nm = name.value.trim().replace(/\s+/g, ' ');
      const cd = digits(code.value);
      if (!nm) { SH.toast('اكتبوا الاسم أول'); name.focus(); return; }
      if (!create && cd.length !== 6) { SH.toast('رمز الغرفة 6 أرقام'); code.focus(); return; }
      busy = true; status.textContent = 'جاري الاتصال…'; Sound.play('pop');
      try {
        const net = await SH.net();
        let room = cd;
        if (create) {
          for (let k = 0; k < 8; k++) { room = String(100000 + rnd(900000)); if (!(await net.get(`rooms/${room}/meta`))) break; }
          await net.set(`rooms/${room}/meta`, { host: net.uid, created: net.now() });
          await net.set(`rooms/${room}/state`, { game: 'lobby', n: 0 });
        } else if (!(await net.get(`rooms/${room}/meta`))) throw new Error('noroom');
        Store.set('online', { name: nm, code: room });
        await openRoom(ctx, net, room, nm);
      } catch (e) {
        busy = false; status.textContent = ''; Sound.play('bad');
        SH.toast(e && e.message === 'noroom' ? 'ما لقينا غرفة بهذا الرمز' : 'ما قدرنا نتصل. تأكدوا من النت وجرّبوا مرة ثانية');
      }
    };
    ctx.view(
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🌐'), h('h1', 'العبوا أونلاين'), h('p', 'واحد يسوّي غرفة ويرسل رمزها، والباقين يدخلون من جوالاتهم.')),
      h('div.card', h('div.field', h('span.label', 'الاسم اللي يطلع للباقين'), name)),
      h('div.card', h('div.field', h('span.label', 'عندكم رمز غرفة؟'), code,
        h('button.btn.btn-primary.btn-block', { type: 'button', onclick() { go(false); } }, 'ادخل الغرفة'))),
      h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { go(true); } }, '＋ سوّ غرفة جديدة'),
      status
    );
  }

  /* ---------- الغرفة ---------- */
  async function openRoom(ctx, net, code, myName) {
    const base = 'rooms/' + code, me = net.uid;
    let meta = null, players = {}, state = null, inbox = {}, secret = null;
    let ui = {}, acting = -1, inboxOff = null, conn = true, lastKey = '', lastScene = '', sync = '';
    const mem = {};   /* ذاكرة محلية تبقى بين الخطوات (مثل اللي ينكتب في «إنسان حيوان») */
    const box = h('div.view');
    ctx.show(box); ctx.dirty = true;

    /* الانضمام (أو الرجوع بنفس المكان) */
    const before = (await net.get(base + '/players')) || {};
    const old = before[me];
    await net.set(`${base}/players/${me}`, { name: myName, c: old ? old.c : Object.keys(before).length % PALETTE.length, at: old ? old.at : net.now(), on: true });

    const list = () => Object.keys(players).map((id) => Object.assign({ id }, players[id])).sort((a, b) => a.at - b.at);
    const here = () => list().filter((p) => p.on !== false);
    const nameOf = (id) => (players[id] ? players[id].name : 'لاعب');
    const colorOf = (id) => PALETTE[(players[id] ? players[id].c : 0) % PALETTE.length];
    const isOn = (id) => !!players[id] && players[id].on !== false;
    const isHost = () => !!meta && meta.host === me;
    const who = () => (state && state.who) || [];
    const playing = () => who().includes(me);
    const active = () => who().filter(isOn);
    const got = () => { const m = {}; who().forEach((id) => { const x = inbox[id]; if (x && x.n === state.n) m[id] = x.v; }); return m; };
    const allIn = (ids) => { const g = got(), a = (ids || who()).filter(isOn); return a.length > 0 && a.every((id) => id in g); };
    const put = (next) => net.set(base + '/state', Object.assign({}, next, { n: (state ? state.n : 0) + 1 }));
    const send = (v) => {
      ui.sent = v; Sound.play('pop'); buzz(20);
      net.set(`${base}/inbox/${me}`, { n: state.n, v }).catch(() => { ui.sent = undefined; SH.toast('ما وصل ردّك، جرّبوا مرة ثانية'); render(); });
      render();
    };
    /* انتقال يسوّيه المستضيف مرة وحدة لكل خطوة. لو ما غيّر الحالة (مثل نقص اللاعبين) نسمح بالمحاولة مرة ثانية */
    const act = async (fn) => {
      if (!state || acting === state.n) return;
      const n0 = (acting = state.n);
      try { await fn(); if (state && state.n === n0) acting = -1; } catch (e) { acting = -1; SH.toast('انقطع الاتصال، جرّبوا مرة ثانية'); }
    };
    /* عدّاد «كم واحد ردّ» يشوفه الكل. نتذكّر آخر قيمة كتبناها عشان ما نكرر الكتابة */
    const syncGot = () => {
      const c = Object.keys(got()).length, k = state.n + ':' + c;
      if (k === sync || (state.got || 0) === c) return;
      sync = k; net.update(base + '/state', { got: c });
    };
    const game = () => (state ? SH.onlineGames.find((g) => g.id === state.game) : null);
    const toLobby = () => put({ game: 'lobby' });

    /* ===== عناصر واجهة مشتركة ===== */
    const hostBtn = (label, fn, cls) => (isHost() ? h('button.btn.btn-block' + (cls || '.btn-primary.btn-xl'), { type: 'button', onclick() { Sound.play('pop'); act(fn); } }, label) : null);
    const waiting = (text) => h('p.muted.center', text + (state.got != null ? ` (${state.got} من ${active().length})` : ''));
    const board = (scores, sub, ids) => {
      const rows = (ids || who()).map((id) => ({ id, s: (scores && scores[id]) || 0 })).sort((a, b) => b.s - a.s);
      return h('div.rank', rows.map((r, i) => h('div.rank-row', { style: { '--i': i } }, h('span.m', String(i + 1)), h('span.n', h('i.tdot', { style: { background: colorOf(r.id) } }), nameOf(r.id), sub && sub[r.id] ? h('small', sub[r.id]) : null), h('span.s', String(r.s)))));
    };
    const pickPlayer = (ids) => h('div.votes-grid', ids.map((id) => h('button.vote', { type: 'button', style: { '--c': colorOf(id) }, onclick() { send(id); } }, nameOf(id))));
    const endButtons = (again) => (isHost() ? h('div.row',
      h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); act(again); } }, '🔁 جولة جديدة'),
      h('button.btn', { type: 'button', onclick() { Sound.play('tap'); act(toLobby); } }, 'نغيّر اللعبة')) : h('p.muted.center', 'المستضيف يختار: جولة جديدة أو لعبة ثانية.'));
    const left = (ends) => Math.max(0, Math.ceil((ends - net.now()) / 1000));
    /* عدّاد وقت يتحدّث لحاله: نص (دقيقة:ثانية) أو شريط */
    const clock = (ends) => { const el = h('span.pill', ''); const up = () => { const s = left(ends); el.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.classList.toggle('gold', s <= 5); }; ui.clocks.push(up); up(); return el; };
    const bar = (ends, dur) => { const el = h('div.bar', h('i')); const up = () => { const p = Math.max(0, Math.min(1, (ends - net.now()) / dur)); el.style.setProperty('--p', String(p)); el.classList.toggle('low', p * dur <= 5000); }; ui.clocks.push(up); up(); return el; };

    /* واجهة الغرفة اللي تستخدمها الألعاب */
    const R = {
      net, me, code, mem,
      get state() { return state; }, get ui() { return ui; }, get secret() { return secret; }, get priv() { return (secret && secret.h) || null; }, get players() { return players; },
      now: () => net.now(), list, here, hereIds: () => here().map((p) => p.id), nameOf, colorOf, isOn, isHost, who, active, got, allIn,
      put, step: (patch) => put(Object.assign({}, state, patch)), patch: (obj) => net.update(base + '/state', obj),
      send, act, syncGot, render: () => render(), toLobby,
      deal: (map) => net.set(base + '/secret', map),                     /* توزيع جديد لكل الخانات الخاصة */
      tell: (uid, obj) => net.update(`${base}/secret/${uid}`, obj),      /* معلومة خاصة للاعب واحد */
      keep: (obj) => net.update(`${base}/secret/${me}`, { h: obj }),     /* معلومة يحتفظ بها المستضيف لنفسه */
      hostBtn, waiting, board, pickPlayer, endButtons, left, clock, bar,
    };

    function tick() {
      if (!isHost() || !state) return;
      const g = game();
      const fn = g && g.auto && g.auto[state.step];
      if (fn && acting !== state.n) fn(R);
    }

    function lobbyView() {
      const link = location.origin + location.pathname + '?room=' + code + '#online';
      const share = async () => {
        Sound.play('pop');
        const text = `تعالوا العبوا معنا في شبّة! رمز الغرفة: ${code}`;
        try { if (navigator.share) { await navigator.share({ title: 'شبّة', text, url: link }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(`${text}\n${link}`); SH.toast('انسخ الرابط، أرسلوه للقروب'); } catch (e) { SH.toast('رمز الغرفة: ' + code); }
      };
      const n = here().length;
      return [
        h('div.center', h('p.eyebrow', 'رمز الغرفة'), h('div.room-code', code), h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: share }, '📤 أرسلوا الدعوة')),
        h('div.card', h('h3', `الموجودين (${n})`), h('div.scores', list().map((p) => h('div.score' + (p.on === false ? '.out' : ''), { style: { '--c': PALETTE[p.c % PALETTE.length] } }, h('i'), h('span', p.name + (p.id === meta.host ? ' 👑' : '') + (p.id === me ? ' (أنت)' : '')))))),
        isHost()
          ? h('div', { style: { display: 'grid', gap: '10px' } }, h('p.label', { style: { margin: '0' } }, 'اختاروا اللعبة'),
            h('div.tiles', SH.onlineGames.map((g) => h('button.pickt', { type: 'button', disabled: n < g.min, title: g.desc, onclick() { Sound.play('pop'); act(() => g.start(R)); } },
              h('span.e', g.emoji), g.name, h('small', n < g.min ? `تحتاج ${g.min} لاعبين` : g.desc)))))
          : h('p.muted.center', 'ننتظر المستضيف يختار اللعبة…'),
      ];
    }

    function render() {
      if (!state || !meta) { box.replaceChildren(h('div.pass', h('div.big', 'جاري الدخول للغرفة…'))); return; }
      const key = `${state.game}:${state.step || ''}:${state.n}`;
      if (ui.key !== key) ui = { key };
      /* لعبة فيها كتابة: ما نعيد رسم الشاشة والواحد يكتب، نحدّث الأجزاء المتغيّرة بس */
      if (key === lastKey && ui.freeze) { if (ui.soft) ui.soft(); return; }
      ui.clocks = [];
      const g = game();
      const hostHere = isOn(meta.host);
      const body = !g ? lobbyView()
        : !playing() ? [h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, g.emoji), h('div.big', 'اللعبة شغّالة'), h('p.muted', 'تدخلون مع الجولة الجاية. خلّوا الصفحة مفتوحة.'))]
          : g.view(R);
      const tmp = h('div',
        h('div.hud', h('span.pill.gold', 'غرفة ' + code), g ? h('span.pill', g.emoji + ' ' + g.name) : null, h('span.pill', '👥 ' + here().length)),
        conn ? null : h('div.note', h('b', 'انقطع الاتصال عندكم. '), 'نحاول نرجّعه، تأكدوا من النت.'),
        !conn || hostHere || isHost() ? null : h('div.note', 'المستضيف مو متصل الحين. ننتظر رجوعه…'),
        body,
        g && isHost() && state.step !== 'end' ? h('button.btn.btn-sm.btn-ghost', { type: 'button', style: { alignSelf: 'center' }, async onclick() { Sound.play('tap'); if (await SH.confirm('تنهون اللعبة وترجعون للغرفة؟', 'نرجع للغرفة', 'نكمّل')) act(toLobby); } }, 'نغيّر اللعبة') : null);
      box.replaceChildren(...tmp.childNodes);
      lastKey = key;
      const scene = g && g.calm && state.step !== 'end' ? state.game : [state.game, state.step, state.i, state.t, state.round].join(':');
      if (scene !== lastScene) { lastScene = scene; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; window.scrollTo(0, 0); }
    }

    /* الاستماع للتغييرات */
    const offs = [
      net.on(base + '/meta', (v) => {
        meta = v;
        if (isHost() && !inboxOff) inboxOff = net.on(base + '/inbox', (x) => { inbox = x || {}; tick(); });
        render(); tick();
      }),
      net.on(base + '/players', (v) => { players = v || {}; render(); tick(); }),
      net.on(base + '/state', (v) => { state = v; render(); tick(); }),
      net.on(`${base}/secret/${me}`, (v) => { secret = v; render(); tick(); }),
      net.connected((ok) => {
        conn = ok;
        if (ok) { net.onDisconnect(`${base}/players/${me}/on`, false); net.update(`${base}/players/${me}`, { on: true }); }
        render();
      }),
    ];
    ctx.interval(() => { if (ui.fast) ui.fast(); }, 40);
    ctx.interval(() => { (ui.clocks || []).forEach((f) => f()); tick(); }, 250);
    ctx.onCleanup(() => { offs.forEach((off) => off()); if (inboxOff) inboxOff(); net.update(`${base}/players/${me}`, { on: false }).catch(() => {}); });
  }

  SH.add({
    id: 'online', hidden: true, name: 'العبوا أونلاين', emoji: '🌐', color: 'sky', moods: [],
    tagline: 'واحد يسوّي غرفة، والباقين يدخلون من جوالاتهم برمزها.',
    leaveMsg: 'تطلعون من الغرفة؟ تقدرون ترجعون لها بنفس الرمز.',
    how: [
      'واحد يسوّي غرفة ويرسل رمزها أو رابطها للباقين، وكل واحد يدخل من جواله.',
      'اللي سوّى الغرفة هو المستضيف: يختار اللعبة ويحرّك الجولات. لو طلع توقف اللعبة لين يرجع.',
      'تشتغل والكل في نفس المجلس، أو كل واحد في مكان مع مكالمة جماعية.',
    ],
    start(ctx) {
      if (SH.online.available()) return entry(ctx);
      ctx.view(h('div.pass', h('span', { style: { fontSize: '72px', lineHeight: '1.2' } }, '🌐'), h('div.big', 'اللعب أونلاين قريباً'), h('p.muted', 'نجهّز الغرف الحين. إلى ذلك الوقت، كل الألعاب تشتغل على جوال واحد.')),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { ctx.home(); } }, 'رجوع للمكتبة'));
    },
  });

  /* رابط دعوة فيه رمز الغرفة يفتح شاشة الدخول مباشرة */
  if (params.get('room') && !location.hash && SH.online.available()) location.hash = '#online';
})();

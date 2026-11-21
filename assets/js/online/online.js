/* شبّة — اللعب أونلاين: غرفة برمز، وكل واحد يلعب من جواله.
   بيانات الغرفة (rooms/الرمز):
     meta    { host, created }            يكتبها المستضيف مرة وحدة
     players { uid: { name, c, at, on } } كل لاعب يكتب نفسه
     state   { game, step, n, ... }       الحالة العامة، يكتبها المستضيف فقط
     inbox   { uid: { n, v } }            ردّ كل لاعب على الخطوة رقم n
     secret  { uid: {...} }               معلومة خاصة لكل لاعب (مثل كلمة السالفة)
   جهاز المستضيف هو اللي يحرّك اللعبة: يقرأ الردود ويكتب الحالة الجاية. */
(function () {
  'use strict';
  const { h, Sound, buzz, Store, shuffle, pick, rnd, PALETTE } = SH;
  const params = new URLSearchParams(location.search);
  const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const fmt = (n) => (n >= 10000 ? Number(n).toLocaleString('en-US') : String(n));

  /* [المعرّف، الإيموجي، الاسم، الوصف، أقل عدد لاعبين] */
  const GAMES = [
    ['outsider', '🕵️', 'مين الدخيل؟', 'السالفة تطلع لكل واحد على جواله، والتصويت سرّي.', 3],
    ['guess', '🎯', 'كم تتوقع؟', 'الكل يكتب توقّعه في نفس اللحظة.', 2],
    ['whois', '👉', 'مين فينا؟', 'كل واحد يصوّت من جواله، والنتيجة تنكشف للكل.', 3],
  ];

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
    let ui = {}, acting = -1, inboxOff = null;
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
    const isHost = () => !!meta && meta.host === me;
    const who = () => (state && state.who) || [];
    const playing = () => who().includes(me);
    const active = () => who().filter((id) => players[id] && players[id].on !== false);
    const got = () => { const m = {}; who().forEach((id) => { const x = inbox[id]; if (x && x.n === state.n) m[id] = x.v; }); return m; };
    const allIn = () => { const g = got(), a = active(); return a.length > 0 && a.every((id) => id in g); };
    const put = (next) => net.set(base + '/state', Object.assign({}, next, { n: (state ? state.n : 0) + 1 }));
    const send = (v) => { ui.sent = v; Sound.play('pop'); buzz(20); net.set(`${base}/inbox/${me}`, { n: state.n, v }).catch(() => { ui.sent = undefined; SH.toast('ما وصل ردّك، جرّبوا مرة ثانية'); render(); }); render(); };
    /* انتقال يسوّيه المستضيف مرة وحدة لكل خطوة */
    const act = async (fn) => {
      if (!state || acting === state.n) return;
      const n0 = (acting = state.n);
      try { await fn(); if (state && state.n === n0) acting = -1; } catch (e) { acting = -1; SH.toast('انقطع الاتصال، جرّبوا مرة ثانية'); }
    };
    /* عدّاد «كم واحد ردّ» يشوفه الكل. نتذكّر آخر قيمة كتبناها عشان ما نكرر الكتابة */
    let sync = '';
    const syncGot = () => {
      const c = Object.keys(got()).length, k = state.n + ':' + c;
      if (k === sync || (state.got || 0) === c) return;
      sync = k; net.update(base + '/state', { got: c });
    };

    /* ===== منطق المستضيف ===== */
    async function startOutsider(keep) {
      const ids = here().map((p) => p.id);
      if (ids.length < 3) { SH.toast('«مين الدخيل؟» تحتاج 3 لاعبين على الأقل'); return; }
      const cat = pick(SH.OUTSIDER), word = pick(cat[3]), spy = pick(ids);
      const sec = {};
      ids.forEach((id) => { sec[id] = id === spy ? { spy: true } : { w: word }; });
      sec[me] = Object.assign(sec[me] || {}, { h: { spy, word, cat: cat[0] } });
      await net.set(base + '/secret', sec);
      await put({ game: 'outsider', step: 'reveal', who: ids, cat: [cat[1], cat[2]], got: 0, scores: keep ? state.scores || null : null, round: keep ? (state.round || 1) + 1 : 1 });
    }
    async function outsiderTally() {
      const votes = got(), hp = secret.h, counts = {};
      Object.keys(votes).forEach((v) => { counts[votes[v]] = (counts[votes[v]] || 0) + 1; });
      const max = Math.max(0, ...Object.keys(counts).map((k) => counts[k]));
      const top = Object.keys(counts).filter((k) => counts[k] === max);
      const caught = top.length === 1 && top[0] === hp.spy;
      const scores = Object.assign({}, state.scores || {});
      Object.keys(votes).forEach((v) => { if (votes[v] === hp.spy && v !== hp.spy) scores[v] = (scores[v] || 0) + 1; });
      if (!caught) scores[hp.spy] = (scores[hp.spy] || 0) + 3;
      const words = SH.OUTSIDER.find((c) => c[0] === hp.cat)[3];
      await put(Object.assign({}, state, {
        step: 'tally', votes, counts, spy: hp.spy, caught, scores, got: 0,
        options: caught ? shuffle([hp.word].concat(shuffle(words.filter((w) => w !== hp.word)).slice(0, 5))) : null,
        word: caught ? null : hp.word,
      }));
    }
    async function outsiderEnd(guess) {
      const hp = secret.h, ok = guess === hp.word;
      const scores = Object.assign({}, state.scores || {});
      if (ok) scores[hp.spy] = (scores[hp.spy] || 0) + 2;
      await put(Object.assign({}, state, { step: 'end', word: hp.word, guessed: guess || null, ok, scores }));
    }

    async function startGuess() {
      const ids = here().map((p) => p.id);
      if (ids.length < 2) { SH.toast('«كم تتوقع؟» تحتاج لاعبين على الأقل'); return; }
      const qs = shuffle(SH.GUESS).slice(0, 5);
      await net.set(`${base}/secret/${me}`, { h: { qs } });
      await put({ game: 'guess', step: 'ask', who: ids, i: 0, total: qs.length, q: [qs[0][0], qs[0][2]], got: 0 });
    }
    async function guessReveal() {
      const g = got(), ans = secret.h.qs[state.i][1];
      const rows = Object.keys(g).map((id) => ({ id, d: Math.abs(g[id] - ans) })).sort((a, b) => a.d - b.d);
      const gains = {}, scores = Object.assign({}, state.scores || {});
      if (rows.length) {
        const best = rows[0].d, second = rows.find((r) => r.d > best);
        rows.forEach((r) => {
          const pts = r.d === best ? 3 + (r.d === 0 ? 2 : 0) : rows.length >= 3 && second && r.d === second.d ? 1 : 0;
          if (pts) { gains[r.id] = pts; scores[r.id] = (scores[r.id] || 0) + pts; }
        });
      }
      await put(Object.assign({}, state, { step: 'reveal', answer: ans, guesses: g, gains, scores, got: 0 }));
    }
    async function guessNext() {
      const i = state.i + 1, qs = secret.h.qs;
      if (i >= state.total) return put({ game: 'guess', step: 'end', who: state.who, scores: state.scores || null });
      await put({ game: 'guess', step: 'ask', who: state.who, i, total: state.total, q: [qs[i][0], qs[i][2]], got: 0, scores: state.scores || null });
    }

    async function startWhois() {
      const ids = here().map((p) => p.id);
      if (ids.length < 3) { SH.toast('«مين فينا؟» تحتاج 3 لاعبين على الأقل'); return; }
      const own = shuffle(SH.mine().whois), pool = shuffle(SH.WHOIS), texts = [];
      for (let i = 0; i < 8; i++) texts.push(own.length && i % 2 === 0 ? own.pop() : pool.pop());
      await net.set(`${base}/secret/${me}`, { h: { texts } });
      await put({ game: 'whois', step: 'ask', who: ids, i: 0, total: texts.length, text: texts[0], got: 0 });
    }
    async function whoisReveal() {
      const g = got(), counts = {};
      Object.keys(g).forEach((v) => { counts[g[v]] = (counts[g[v]] || 0) + 1; });
      const max = Math.max(0, ...Object.keys(counts).map((k) => counts[k]));
      const top = Object.keys(counts).filter((k) => counts[k] === max);
      const scores = Object.assign({}, state.scores || {}), titles = Object.assign({}, state.titles || {});
      if (top.length === 1) { scores[top[0]] = (scores[top[0]] || 0) + 1; titles[top[0]] = state.text; }
      await put(Object.assign({}, state, { step: 'reveal', counts, top, scores, titles, got: 0 }));
    }
    async function whoisNext() {
      const i = state.i + 1, texts = secret.h.texts;
      const keep = { who: state.who, scores: state.scores || null, titles: state.titles || null };
      if (i >= state.total) return put(Object.assign({ game: 'whois', step: 'end' }, keep));
      await put(Object.assign({ game: 'whois', step: 'ask', i, total: state.total, text: texts[i], got: 0 }, keep));
    }

    const START = { outsider: () => startOutsider(false), guess: startGuess, whois: startWhois };
    const toLobby = () => put({ game: 'lobby' });
    /* اللي يتحرّك تلقائياً لما يكتمل شرطه */
    const AUTO = {
      outsider: {
        reveal() { if (allIn()) act(() => put(Object.assign({}, state, { step: 'discuss', got: 0, ends: net.now() + 180000 }))); else syncGot(); },
        discuss() { if (net.now() >= state.ends) act(() => put(Object.assign({}, state, { step: 'vote', got: 0 }))); },
        vote() { if (allIn()) act(outsiderTally); else syncGot(); },
        guess() { const g = got(); if (state.spy in g) act(() => outsiderEnd(g[state.spy])); },
      },
      guess: { ask() { if (allIn()) act(guessReveal); else syncGot(); } },
      whois: { ask() { if (allIn()) act(whoisReveal); else syncGot(); } },
    };
    function tick() {
      if (!isHost() || !state || !secret && state.game !== 'lobby') return;
      const fn = AUTO[state.game] && AUTO[state.game][state.step];
      if (fn && acting !== state.n) fn();
    }

    /* ===== الواجهة ===== */
    const hostBtn = (label, fn, cls) => (isHost() ? h('button.btn.btn-block' + (cls || '.btn-primary.btn-xl'), { type: 'button', onclick() { Sound.play('pop'); act(fn); } }, label) : null);
    const waiting = (text) => h('p.muted.center', text + (state.got != null ? ` (${state.got} من ${active().length})` : ''));
    const board = (scores, sub) => {
      const rows = who().map((id) => ({ id, s: (scores && scores[id]) || 0 })).sort((a, b) => b.s - a.s);
      return h('div.rank', rows.map((r, i) => h('div.rank-row', { style: { '--i': i } }, h('span.m', String(i + 1)), h('span.n', h('i.tdot', { style: { background: colorOf(r.id) } }), nameOf(r.id), sub && sub[r.id] ? h('small', sub[r.id]) : null), h('span.s', String(r.s)))));
    };
    const pickPlayer = (ids) => h('div.votes-grid', ids.map((id) => h('button.vote', { type: 'button', style: { '--c': colorOf(id) }, onclick() { send(id); } }, nameOf(id))));
    const endButtons = (again) => (isHost() ? h('div.row',
      h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); act(again); } }, '🔁 جولة جديدة'),
      h('button.btn', { type: 'button', onclick() { Sound.play('tap'); act(toLobby); } }, 'نغيّر اللعبة')) : h('p.muted.center', 'المستضيف يختار: جولة جديدة أو لعبة ثانية.'));

    const VIEW = {
      lobby() {
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
              GAMES.map(([id, e, nm, desc, min]) => h('button.pickt', { type: 'button', disabled: n < min, onclick() { Sound.play('pop'); act(START[id]); } },
                h('span.e', e), nm, h('small', n < min ? `تحتاج ${min} لاعبين على الأقل` : desc))))
            : h('p.muted.center', 'ننتظر المستضيف يختار اللعبة…'),
        ];
      },

      outsider() {
        const s = state;
        if (s.step === 'reveal') {
          if (!secret) return [h('div.pass', h('div.big', 'جاري توزيع السوالف…'))];
          const spy = !!secret.spy;
          const card = h('button.secret' + (ui.open ? '.open' + (spy ? '.spy' : '') : ''), { type: 'button', onclick() { if (!ui.open) { ui.open = true; Sound.play(spy ? 'bad' : 'reveal'); buzz(spy ? [80, 50, 80] : 30); render(); } } },
            ui.open
              ? (spy ? [h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '🕵️'), h('div.big', 'أنت الدخيل!'), h('p', `ما تعرف السالفة. كل اللي تعرفه إنها من «${s.cat[1]}».`)]
                : [h('p', 'السالفة هي'), h('div.huge', { style: { fontSize: 'clamp(44px, 13vw, 76px)' } }, secret.w), h('p.small', `${s.cat[0]} ${s.cat[1]}`)])
              : [h('span', { style: { fontSize: '56px', lineHeight: '1.2' } }, '👆'), h('span', 'اضغط عشان تشوف سالفتك')]);
          return [card, ui.sent ? waiting('ننتظر الباقين يشوفون') : ui.open ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { send('ok'); } }, 'شفتها ✓') : null,
            ui.sent ? hostBtn('نبدأ النقاش الحين', () => put(Object.assign({}, state, { step: 'discuss', got: 0, ends: net.now() + 180000 })), '.btn-ghost') : null];
        }
        if (s.step === 'discuss') {
          const clock = h('div.huge', { style: { color: 'var(--accent)', direction: 'ltr' } }, '');
          ui.clock = () => { const left = Math.max(0, Math.ceil((s.ends - net.now()) / 1000)); clock.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); };
          ui.clock();
          return [
            h('div.center', h('p.eyebrow', `${s.cat[0]} ${s.cat[1]}`), h('div.big', 'اسألوا بعض وطلّعوا الدخيل'), clock),
            h('p.muted.center.small', 'اسألوا عن السالفة بدون ما تفضحونها. لو كل واحد في مكان، افتحوا مكالمة جماعية.'),
            secret && !secret.spy ? h('div.note', h('b', 'سالفتك: '), ui.peek ? secret.w : h('button.btn.btn-sm', { type: 'button', onclick() { ui.peek = true; render(); } }, 'ذكّرني')) : null,
            h('div.spacer'), hostBtn('نصوّت الحين', () => put(Object.assign({}, state, { step: 'vote', got: 0 }))),
          ];
        }
        if (s.step === 'vote') {
          return ui.sent
            ? [h('div.pass', h('div.big', 'صوّتّ على ' + nameOf(ui.sent)), waiting('ننتظر الباقين')), hostBtn('اكشف النتيجة الحين', outsiderTally, '.btn-ghost')]
            : [h('div.center', h('p.eyebrow', 'تصويت سرّي'), h('div.big', 'مين تشكّ إنه الدخيل؟')), pickPlayer(who().filter((id) => id !== me))];
        }
        if (s.step === 'tally' || s.step === 'guess') {
          const counts = s.counts || {};
          const tally = h('div.rank', who().map((id) => ({ id, c: counts[id] || 0 })).sort((a, b) => b.c - a.c).map((r, i) =>
            h('div.rank-row', { style: { '--i': i, background: 'var(--surface)', color: 'var(--ink)' } }, h('span.m', '🗳️'), h('span.n', nameOf(r.id) + (r.id === s.spy ? ' 🕵️' : '')), h('span.s', String(r.c)))));
          const headline = h('div.center', h('p.eyebrow', 'الدخيل هو'), h('div.huge', { style: { color: colorOf(s.spy), fontSize: 'clamp(44px, 13vw, 76px)' } }, nameOf(s.spy)), h('div.big', s.caught ? 'انكشف! 🎯' : 'هرب منكم! 😎'));
          if (s.step === 'tally') return [headline, tally, h('div.spacer'), s.caught ? hostBtn('فرصة الدخيل الأخيرة', () => put(Object.assign({}, state, { step: 'guess', got: 0 }))) : hostBtn('النتيجة', () => put(Object.assign({}, state, { step: 'end' })))];
          return me === s.spy
            ? [h('div.center', h('p.eyebrow', 'فرصتك الأخيرة'), h('div.big', 'وش كانت السالفة؟')), ui.sent ? h('p.muted.center', 'اخترت: ' + ui.sent) : h('div.tiles', (s.options || []).map((w) => h('button.pickt', { type: 'button', onclick() { send(w); } }, w)))]
            : [headline, h('p.muted.center', `${nameOf(s.spy)} يحاول يخمّن السالفة…`), hostBtn('نكمّل بدون تخمين', () => outsiderEnd(null), '.btn-ghost')];
        }
        return [ /* end */
          h('div.prompt', h('span.tag', `${s.cat[0]} ${s.cat[1]}`), 'السالفة كانت', h('span.word', s.word)),
          s.caught ? h('div.note', s.ok ? `${nameOf(s.spy)} عرف السالفة وأخذ نقطتين!` : `${nameOf(s.spy)} ما عرفها${s.guessed ? ' وقال «' + s.guessed + '»' : ''}.`) : h('div.note', `${nameOf(s.spy)} هرب وأخذ 3 نقاط.`),
          board(s.scores), h('div.spacer'), endButtons(() => startOutsider(true)),
        ];
      },

      guess() {
        const s = state;
        if (s.step === 'ask') {
          const head = [h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`)), h('div.prompt', { style: { minHeight: '0' } }, s.q[1] ? h('span.tag', 'الجواب بوحدة: ' + s.q[1]) : null, s.q[0])];
          if (ui.sent != null) return head.concat([h('div.pass', h('p.eyebrow', 'توقّعك'), h('div.huge', { style: { direction: 'ltr' } }, fmt(ui.sent)), waiting('ننتظر الباقين')), hostBtn('اكشف الحين', guessReveal, '.btn-ghost')]);
          const num = h('span', ui.val ? fmt(Number(ui.val)) : '؟');
          const press = (d) => { ui.val = ui.val || ''; if (ui.val.length < 7) { ui.val = ui.val === '0' ? d : ui.val + d; Sound.play('tap'); num.textContent = fmt(Number(ui.val)); } };
          return head.concat([
            h('div.kp-screen', num, s.q[1] ? h('small', s.q[1]) : null),
            h('div.kp', ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { type: 'button', onclick() { press(d); } }, d)),
              h('button', { type: 'button', 'aria-label': 'مسح', onclick() { ui.val = (ui.val || '').slice(0, -1); Sound.play('tap'); num.textContent = ui.val ? fmt(Number(ui.val)) : '؟'; } }, '⌫'),
              h('button', { type: 'button', onclick() { press('0'); } }, '0'),
              h('button.go', { type: 'button', 'aria-label': 'اعتماد', onclick() { if (!ui.val) { SH.toast('اكتبوا رقم أول'); return; } send(Number(ui.val)); } }, '✓')),
          ]);
        }
        if (s.step === 'reveal') {
          const g = s.guesses || {}, gains = s.gains || {};
          const rows = Object.keys(g).map((id) => ({ id, v: g[id], d: Math.abs(g[id] - s.answer) })).sort((a, b) => a.d - b.d);
          return [
            h('div.center', h('p.muted', s.q[0]), h('p.eyebrow', 'الجواب الصحيح'), h('div.huge', { style: { color: 'var(--accent)', direction: 'ltr' } }, fmt(s.answer)), s.q[1] ? h('p.label', s.q[1]) : null),
            h('div', { style: { display: 'grid', gap: '8px' } }, rows.map((r, i) => h('div.guess-row' + (gains[r.id] >= 3 ? '.win' : ''), { style: { '--i': i } },
              h('span.n', nameOf(r.id), h('small', r.d === 0 ? ' · بالضبط! 🎯' : ` · الفرق ${fmt(r.d)}`)), h('span.v', fmt(r.v)), gains[r.id] ? h('span.pill.gold', '+' + gains[r.id]) : null))),
            h('div.spacer'), hostBtn(s.i + 1 < s.total ? 'السؤال التالي' : 'النتيجة', guessNext),
          ];
        }
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), board(s.scores), h('div.spacer'), endButtons(startGuess)];
      },

      whois() {
        const s = state;
        const card = h('div.prompt', { style: { minHeight: '0' } }, h('span.tag', 'مين فينا أكثر واحد…'), (s.text || '') + '؟');
        if (s.step === 'ask') {
          return ui.sent
            ? [h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`)), card, h('div.pass', h('div.big', 'اخترت ' + nameOf(ui.sent)), waiting('ننتظر الباقين')), hostBtn('اكشف الحين', whoisReveal, '.btn-ghost')]
            : [h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`)), card, h('p.muted.center', 'صوّتوا بالسر، وتقدرون تصوّتون على أنفسكم.'), pickPlayer(who())];
        }
        if (s.step === 'reveal') {
          const counts = s.counts || {}, top = s.top || [];
          return [card,
            h('div.center.big', top.length === 1 ? nameOf(top[0]) + ' 👈' : 'تعادل!'),
            h('div.rank', who().map((id) => ({ id, c: counts[id] || 0 })).sort((a, b) => b.c - a.c).map((r, i) =>
              h('div.rank-row', { style: { '--i': i, background: top.includes(r.id) && top.length === 1 ? 'var(--gold)' : 'var(--surface)', color: top.includes(r.id) && top.length === 1 ? '#33230A' : 'var(--ink)' } }, h('span.m', '👉'), h('span.n', nameOf(r.id)), h('span.s', String(r.c))))),
            h('div.spacer'), hostBtn(s.i + 1 < s.total ? 'السؤال التالي' : 'ألقاب الجلسة', whoisNext)];
        }
        const titles = {}; Object.keys(s.titles || {}).forEach((id) => { titles[id] = 'اللي ' + s.titles[id]; });
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🌟'), h('div.big', 'ألقاب الجلسة')), board(s.scores, titles), h('div.spacer'), endButtons(startWhois)];
      },
    };

    let lastKey = '';
    function render() {
      if (!state || !meta) { box.replaceChildren(h('div.pass', h('div.big', 'جاري الدخول للغرفة…'))); return; }
      const key = `${state.game}:${state.step || ''}:${state.n}`;
      if (ui.key !== key) ui = { key };
      const hostHere = players[meta.host] && players[meta.host].on !== false;
      const g = GAMES.find((x) => x[0] === state.game);
      const body = state.game !== 'lobby' && !playing()
        ? [h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, g ? g[1] : '⏳'), h('div.big', 'اللعبة شغّالة'), h('p.muted', 'تدخلون مع الجولة الجاية. خلّوا الصفحة مفتوحة.'))]
        : (VIEW[state.game] || VIEW.lobby)();
      const tmp = h('div',
        h('div.hud', h('span.pill.gold', 'غرفة ' + code), g ? h('span.pill', g[1] + ' ' + g[2]) : null, h('span.pill', '👥 ' + here().length)),
        hostHere || isHost() ? null : h('div.note', 'المستضيف مو متصل الحين. ننتظر رجوعه…'),
        body);
      box.replaceChildren(...tmp.childNodes);
      if (key !== lastKey) { lastKey = key; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; window.scrollTo(0, 0); }
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
      net.connected((ok) => { if (ok) { net.onDisconnect(`${base}/players/${me}/on`, false); net.update(`${base}/players/${me}`, { on: true }); } }),
    ];
    ctx.interval(() => { if (ui.clock && state && state.step === 'discuss') ui.clock(); tick(); }, 500);
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

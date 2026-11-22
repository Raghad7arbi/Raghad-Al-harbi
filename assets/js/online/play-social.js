/* اللعب أونلاين — مين الدخيل؟ · كم تتوقع؟ · مين فينا؟ · لو خيّروك */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle, pick } = SH;
  const fmt = (n) => (n >= 10000 ? Number(n).toLocaleString('en-US') : String(n));
  const tally = (votes) => { const c = {}; Object.keys(votes).forEach((v) => { c[votes[v]] = (c[votes[v]] || 0) + 1; }); return c; };
  const tops = (counts) => { const max = Math.max(0, ...Object.keys(counts).map((k) => counts[k])); return Object.keys(counts).filter((k) => counts[k] === max); };

  /* ---------- مين الدخيل؟ ---------- */
  const outsider = {
    id: 'outsider', emoji: '🕵️', name: 'مين الدخيل؟', desc: 'السالفة على جوالك والتصويت سرّي', min: 3,
    async start(R, keep) {
      const ids = R.hereIds();
      if (ids.length < 3) { SH.toast('«مين الدخيل؟» تحتاج 3 لاعبين على الأقل'); return; }
      const cat = pick(SH.OUTSIDER), word = pick(cat[3]), spy = pick(ids), sec = {};
      ids.forEach((id) => { sec[id] = id === spy ? { spy: true } : { w: word }; });
      sec[R.me] = Object.assign(sec[R.me] || {}, { h: { spy, word, cat: cat[0] } });
      await R.deal(sec);
      await R.put({ game: 'outsider', step: 'reveal', who: ids, cat: [cat[1], cat[2]], got: 0, scores: keep ? R.state.scores || null : null });
    },
    toDiscuss: (R) => R.step({ step: 'discuss', got: 0, ends: R.now() + 180000 }),
    toVote: (R) => R.step({ step: 'vote', got: 0 }),
    async tally(R) {
      const s = R.state, votes = R.got(), hp = R.priv, counts = tally(votes), top = tops(counts);
      const caught = top.length === 1 && top[0] === hp.spy;
      const scores = Object.assign({}, s.scores || {});
      Object.keys(votes).forEach((v) => { if (votes[v] === hp.spy && v !== hp.spy) scores[v] = (scores[v] || 0) + 1; });
      if (!caught) scores[hp.spy] = (scores[hp.spy] || 0) + 3;
      const words = SH.OUTSIDER.find((c) => c[0] === hp.cat)[3];
      await R.step({ step: 'tally', votes, counts, spy: hp.spy, caught, scores, got: 0,
        options: caught ? shuffle([hp.word].concat(shuffle(words.filter((w) => w !== hp.word)).slice(0, 5))) : null, word: caught ? null : hp.word });
    },
    async finish(R, guess) {
      const hp = R.priv, ok = guess === hp.word, scores = Object.assign({}, R.state.scores || {});
      if (ok) scores[hp.spy] = (scores[hp.spy] || 0) + 2;
      await R.step({ step: 'end', word: hp.word, guessed: guess || null, ok, scores });
    },
    auto: {
      reveal(R) { if (!R.priv) return; if (R.allIn()) R.act(() => outsider.toDiscuss(R)); else R.syncGot(); },
      discuss(R) { if (R.now() >= R.state.ends) R.act(() => outsider.toVote(R)); },
      vote(R) { if (!R.priv) return; if (R.allIn()) R.act(() => outsider.tally(R)); else R.syncGot(); },
      guess(R) { const g = R.got(); if (R.priv && R.state.spy in g) R.act(() => outsider.finish(R, g[R.state.spy])); },
    },
    view(R) {
      const s = R.state, ui = R.ui, sec = R.secret, me = R.me, name = R.nameOf;
      if (s.step === 'reveal') {
        if (!sec) return [h('div.pass', h('div.big', 'جاري توزيع السوالف…'))];
        const spy = !!sec.spy;
        const card = h('button.secret' + (ui.open ? '.open' + (spy ? '.spy' : '') : ''), { type: 'button', onclick() { if (!ui.open) { ui.open = true; Sound.play(spy ? 'bad' : 'reveal'); buzz(spy ? [80, 50, 80] : 30); R.render(); } } },
          ui.open
            ? (spy ? [h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '🕵️'), h('div.big', 'أنت الدخيل!'), h('p', `ما تعرف السالفة. كل اللي تعرفه إنها من «${s.cat[1]}».`)]
              : [h('p', 'السالفة هي'), h('div.huge', { style: { fontSize: 'clamp(44px, 13vw, 76px)' } }, sec.w), h('p.small', `${s.cat[0]} ${s.cat[1]}`)])
            : [h('span', { style: { fontSize: '56px', lineHeight: '1.2' } }, '👆'), h('span', 'اضغط عشان تشوف سالفتك')]);
        return [card, ui.sent ? R.waiting('ننتظر الباقين يشوفون') : ui.open ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { R.send('ok'); } }, 'شفتها ✓') : null,
          ui.sent ? R.hostBtn('نبدأ النقاش الحين', () => outsider.toDiscuss(R), '.btn-ghost') : null];
      }
      if (s.step === 'discuss') {
        return [
          h('div.center', h('p.eyebrow', `${s.cat[0]} ${s.cat[1]}`), h('div.big', 'اسألوا بعض وطلّعوا الدخيل'), R.clock(s.ends)),
          h('p.muted.center.small', 'اسألوا عن السالفة بدون ما تفضحونها. لو كل واحد في مكان، افتحوا مكالمة جماعية.'),
          sec && !sec.spy ? h('div.note', h('b', 'سالفتك: '), ui.peek ? sec.w : h('button.btn.btn-sm', { type: 'button', onclick() { ui.peek = true; R.render(); } }, 'ذكّرني')) : null,
          h('div.spacer'), R.hostBtn('نصوّت الحين', () => outsider.toVote(R)),
        ];
      }
      if (s.step === 'vote') {
        return ui.sent
          ? [h('div.pass', h('div.big', 'صوّتّ على ' + name(ui.sent)), R.waiting('ننتظر الباقين')), R.hostBtn('اكشف النتيجة الحين', () => outsider.tally(R), '.btn-ghost')]
          : [h('div.center', h('p.eyebrow', 'تصويت سرّي'), h('div.big', 'مين تشكّ إنه الدخيل؟')), R.pickPlayer(R.who().filter((id) => id !== me))];
      }
      if (s.step === 'tally' || s.step === 'guess') {
        const counts = s.counts || {};
        const rows = h('div.rank', R.who().map((id) => ({ id, c: counts[id] || 0 })).sort((a, b) => b.c - a.c).map((r, i) =>
          h('div.rank-row', { style: { '--i': i, background: 'var(--surface)', color: 'var(--ink)' } }, h('span.m', '🗳️'), h('span.n', name(r.id) + (r.id === s.spy ? ' 🕵️' : '')), h('span.s', String(r.c)))));
        const head = h('div.center', h('p.eyebrow', 'الدخيل هو'), h('div.huge', { style: { color: R.colorOf(s.spy), fontSize: 'clamp(44px, 13vw, 76px)' } }, name(s.spy)), h('div.big', s.caught ? 'انكشف! 🎯' : 'هرب منكم! 😎'));
        if (s.step === 'tally') return [head, rows, h('div.spacer'), s.caught ? R.hostBtn('فرصة الدخيل الأخيرة', () => R.step({ step: 'guess', got: 0 })) : R.hostBtn('النتيجة', () => R.step({ step: 'end' }))];
        return me === s.spy
          ? [h('div.center', h('p.eyebrow', 'فرصتك الأخيرة'), h('div.big', 'وش كانت السالفة؟')), ui.sent ? h('p.muted.center', 'اخترت: ' + ui.sent) : h('div.tiles', (s.options || []).map((w) => h('button.pickt', { type: 'button', onclick() { R.send(w); } }, w)))]
          : [head, h('p.muted.center', `${name(s.spy)} يحاول يخمّن السالفة…`), R.hostBtn('نكمّل بدون تخمين', () => outsider.finish(R, null), '.btn-ghost')];
      }
      return [
        h('div.prompt', h('span.tag', `${s.cat[0]} ${s.cat[1]}`), 'السالفة كانت', h('span.word', s.word)),
        s.caught ? h('div.note', s.ok ? `${name(s.spy)} عرف السالفة وأخذ نقطتين!` : `${name(s.spy)} ما عرفها${s.guessed ? ' وقال «' + s.guessed + '»' : ''}.`) : h('div.note', `${name(s.spy)} هرب وأخذ 3 نقاط.`),
        R.board(s.scores), h('div.spacer'), R.endButtons(() => outsider.start(R, true)),
      ];
    },
  };
  SH.onlineGame(outsider);

  /* ---------- كم تتوقع؟ ----------
     محرك عام لأسئلة الأرقام: الكل يكتب رقمه، والأقرب ياخذ النقاط.
     def.make(R) ترجّع [{ t: السؤال, a: الجواب, u: الوحدة, p: رقم صورة من صور الحفلة }] */
  function numbers(def) {
    const pub = (q) => ({ t: q.t, u: q.u || '', p: q.p == null ? null : q.p });
    const photo = (R, q, cls) => (q.p != null && R.photos[q.p] ? h('img.q-photo' + (cls || ''), { src: R.photos[q.p], alt: 'صورة من الحفلة' }) : null);
    const g = {
      id: def.id, emoji: def.emoji, name: def.name, desc: def.desc, min: 2,
      party: def.party, types: def.types, title: def.title, pdesc: def.pdesc, ready: def.ready, watch: !!def.party,
      async start(R) {
        const ids = def.who ? def.who(R) : R.hereIds();
        if (ids.length < 2) { SH.toast(`«${R.label(g)}» تحتاج لاعبين على الأقل` + (def.who ? ' غير صاحبة الحفلة' : '')); return; }
        const qs = def.make(R);
        if (!qs.length) { SH.toast('ما فيه أسئلة كفاية لهالفقرة'); return; }
        await R.keep({ qs });
        await R.put({ game: def.id, step: 'ask', who: ids, i: 0, total: qs.length, q: pub(qs[0]), got: 0 });
      },
      async reveal(R) {
        const s = R.state, got = R.got(), ans = R.priv.qs[s.i].a;
        const rows = Object.keys(got).map((id) => ({ id, d: Math.abs(got[id] - ans) })).sort((x, y) => x.d - y.d);
        const gains = {}, scores = Object.assign({}, s.scores || {});
        if (rows.length) {
          const best = rows[0].d, second = rows.find((r) => r.d > best);
          rows.forEach((r) => { const pts = r.d === best ? 3 + (r.d === 0 ? 2 : 0) : rows.length >= 3 && second && r.d === second.d ? 1 : 0; if (pts) { gains[r.id] = pts; scores[r.id] = (scores[r.id] || 0) + pts; } });
        }
        await R.step({ step: 'reveal', answer: ans, guesses: got, gains, scores, got: 0 });
      },
      async next(R) {
        const s = R.state, i = s.i + 1, qs = R.priv.qs;
        if (i >= s.total) return R.put({ game: def.id, step: 'end', who: s.who, scores: s.scores || null });
        await R.put({ game: def.id, step: 'ask', who: s.who, i, total: s.total, q: pub(qs[i]), got: 0, scores: s.scores || null });
      },
      auto: { ask(R) { if (!R.priv) return; if (R.allIn()) R.act(() => g.reveal(R)); else R.syncGot(); } },
      view(R) {
        const s = R.state, ui = R.ui, q = s.q || {};
        if (s.step === 'ask') {
          const head = [h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`)), photo(R, q), h('div.prompt', { style: { minHeight: '0' } }, q.u ? h('span.tag', 'الجواب بوحدة: ' + q.u) : null, q.t)];
          if (!s.who.includes(R.me)) return head.concat([h('p.muted.center', def.specHint ? def.specHint(R) : 'تتفرّجون هالجولة.'), R.waiting('جاوبوا')]);
          if (ui.sent != null) return head.concat([h('div.pass', h('p.eyebrow', 'توقّعك'), h('div.huge', { style: { direction: 'ltr' } }, fmt(ui.sent)), R.waiting('ننتظر الباقين')), R.hostBtn('اكشف الحين', () => g.reveal(R), '.btn-ghost')]);
          const num = h('span', ui.val ? fmt(Number(ui.val)) : '؟');
          const press = (d) => { ui.val = ui.val || ''; if (ui.val.length < 7) { ui.val = ui.val === '0' ? d : ui.val + d; Sound.play('tap'); num.textContent = fmt(Number(ui.val)); } };
          return head.concat([
            h('div.kp-screen', num, q.u ? h('small', q.u) : null),
            h('div.kp', ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { type: 'button', onclick() { press(d); } }, d)),
              h('button', { type: 'button', 'aria-label': 'مسح', onclick() { ui.val = (ui.val || '').slice(0, -1); Sound.play('tap'); num.textContent = ui.val ? fmt(Number(ui.val)) : '؟'; } }, '⌫'),
              h('button', { type: 'button', onclick() { press('0'); } }, '0'),
              h('button.go', { type: 'button', 'aria-label': 'اعتماد', onclick() { if (!ui.val) { SH.toast('اكتبوا رقم أول'); return; } R.send(Number(ui.val)); } }, '✓')),
          ]);
        }
        if (s.step === 'reveal') {
          const got = s.guesses || {}, gains = s.gains || {};
          const rows = Object.keys(got).map((id) => ({ id, v: got[id], d: Math.abs(got[id] - s.answer) })).sort((x, y) => x.d - y.d);
          return [
            photo(R, q, '.sm'),
            h('div.center', h('p.muted', q.t), h('p.eyebrow', 'الجواب الصحيح'), h('div.huge', { style: { color: 'var(--accent)', direction: 'ltr' } }, fmt(s.answer)), q.u ? h('p.label', q.u) : null),
            h('div', { style: { display: 'grid', gap: '8px' } }, rows.map((r, i) => h('div.guess-row' + (gains[r.id] >= 3 ? '.win' : ''), { style: { '--i': i } },
              h('span.n', R.nameOf(r.id), h('small', r.d === 0 ? ' · بالضبط! 🎯' : ` · الفرق ${fmt(r.d)}`)), h('span.v', fmt(r.v)), gains[r.id] ? h('span.pill.gold', '+' + gains[r.id]) : null))),
            h('div.spacer'), R.hostBtn(s.i + 1 < s.total ? 'السؤال التالي' : 'النتيجة', () => g.next(R)),
          ];
        }
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), R.board(s.scores), h('div.spacer'), R.endButtons(() => g.start(R))];
      },
    };
    SH.onlineGame(g);
  }
  SH.onlineNumbers = numbers;
  numbers({
    id: 'guess', emoji: '🎯', name: 'كم تتوقع؟', desc: 'الكل يكتب توقّعه بنفس اللحظة',
    make: () => shuffle(SH.GUESS).slice(0, 5).map((x) => ({ t: x[0], a: x[1], u: x[2] })),
  });

  /* ---------- مين فينا؟ ---------- */
  const whois = {
    id: 'whois', emoji: '👉', name: 'مين فينا؟', desc: 'تصويت سرّي من كل جوال', min: 3,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 3) { SH.toast('«مين فينا؟» تحتاج 3 لاعبين على الأقل'); return; }
      const themed = R.party && SH.hafla ? shuffle(SH.hafla.extra(R.party, 'whois')) : [];
      const own = shuffle(SH.mine().whois), pool = shuffle(SH.WHOIS), texts = themed.slice(0, 8);
      for (let i = 0; texts.length < 8; i++) texts.push(own.length && i % 2 === 0 ? own.pop() : pool.pop());
      /* سوالف الحفلة مكتوبة كجملة كاملة بعد «مين فينا»، والباقي بعد «أكثر واحد» */
      await R.keep({ texts, themed: themed.length });
      await R.put({ game: 'whois', step: 'ask', who: ids, i: 0, total: texts.length, text: texts[0], full: themed.length > 0, got: 0 });
    },
    async reveal(R) {
      const s = R.state, counts = tally(R.got()), top = tops(counts);
      const scores = Object.assign({}, s.scores || {}), titles = Object.assign({}, s.titles || {});
      if (top.length === 1) { scores[top[0]] = (scores[top[0]] || 0) + 1; titles[top[0]] = (s.full ? '' : 'اللي ') + s.text; }
      await R.step({ step: 'reveal', counts, top, scores, titles, got: 0 });
    },
    async next(R) {
      const s = R.state, i = s.i + 1, keep = { who: s.who, scores: s.scores || null, titles: s.titles || null };
      if (i >= s.total) return R.put(Object.assign({ game: 'whois', step: 'end' }, keep));
      await R.put(Object.assign({ game: 'whois', step: 'ask', i, total: s.total, text: R.priv.texts[i], full: i < (R.priv.themed || 0), got: 0 }, keep));
    },
    auto: { ask(R) { if (R.allIn()) R.act(() => whois.reveal(R)); else R.syncGot(); } },
    view(R) {
      const s = R.state, ui = R.ui, name = R.nameOf;
      const card = h('div.prompt', { style: { minHeight: '0' } }, h('span.tag', s.full ? 'مين فينا…' : 'مين فينا أكثر واحد…'), (s.text || '') + '؟');
      const hud = h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`));
      if (s.step === 'ask') {
        return ui.sent
          ? [hud, card, h('div.pass', h('div.big', 'اخترت ' + name(ui.sent)), R.waiting('ننتظر الباقين')), R.hostBtn('اكشف الحين', () => whois.reveal(R), '.btn-ghost')]
          : [hud, card, h('p.muted.center', 'صوّتوا بالسر، وتقدرون تصوّتون على أنفسكم.'), R.pickPlayer(R.who())];
      }
      if (s.step === 'reveal') {
        const counts = s.counts || {}, top = s.top || [], one = top.length === 1;
        return [card, h('div.center.big', one ? name(top[0]) + ' 👈' : 'تعادل!'),
          h('div.rank', R.who().map((id) => ({ id, c: counts[id] || 0 })).sort((a, b) => b.c - a.c).map((r, i) => {
            const win = one && top[0] === r.id;
            return h('div.rank-row', { style: { '--i': i, background: win ? 'var(--gold)' : 'var(--surface)', color: win ? '#33230A' : 'var(--ink)' } }, h('span.m', '👉'), h('span.n', name(r.id)), h('span.s', String(r.c)));
          })),
          h('div.spacer'), R.hostBtn(s.i + 1 < s.total ? 'السؤال التالي' : 'ألقاب الجلسة', () => whois.next(R))];
      }
      return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🌟'), h('div.big', 'ألقاب الجلسة')), R.board(s.scores, s.titles || {}), h('div.spacer'), R.endButtons(() => whois.start(R))];
    },
  };
  SH.onlineGame(whois);

  /* ---------- لو خيّروك ---------- */
  const wyr = {
    id: 'wyr', emoji: '🤔', name: 'لو خيّروك', desc: 'الكل يختار، والأقلية تدافع', min: 2,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 2) { SH.toast('«لو خيّروك» تحتاج لاعبين على الأقل'); return; }
      const pairs = shuffle(SH.WYR).slice(0, 30);
      await R.keep({ pairs });
      await R.put({ game: 'wyr', step: 'ask', who: ids, i: 0, a: pairs[0][0], b: pairs[0][1], got: 0 });
    },
    reveal: (R) => R.step({ step: 'reveal', picks: R.got(), got: 0 }),
    async next(R) {
      const s = R.state, pairs = R.priv.pairs, i = (s.i + 1) % pairs.length;
      await R.put({ game: 'wyr', step: 'ask', who: s.who, i, a: pairs[i][0], b: pairs[i][1], got: 0 });
    },
    auto: { ask(R) { if (R.allIn()) R.act(() => wyr.reveal(R)); else R.syncGot(); } },
    view(R) {
      const s = R.state, ui = R.ui, picks = s.picks || {};
      const side = (k, text, cols) => {
        const names = Object.keys(picks).filter((id) => picks[id] === k).map((id) => R.nameOf(id));
        const total = Object.keys(picks).length;
        const done = s.step === 'reveal';
        return h('button.wyr-opt', { type: 'button', disabled: done || ui.sent != null, style: { '--c': cols[0], '--c2': cols[1], '--ci': cols[2], '--pct': done && total ? String(names.length / total) : '0', outline: ui.sent === k ? '4px solid var(--gold)' : 'none' }, onclick() { R.send(k); } },
          h('span.fill'), h('span', text), done ? h('span.pct', total ? Math.round((names.length / total) * 100) + '%' : '0%') : null, done ? h('span.small', names.join('، ') || 'ولا أحد') : null);
      };
      const box = h('div.wyr' + (s.step === 'reveal' ? '.done' : ''), side(0, s.a, ['#2F74E8', '#1C52B4', '#fff']), h('span.wyr-or', 'ولا'), side(1, s.b, ['#F58A1F', '#C4620A', '#2A1505']));
      if (s.step === 'ask') return [h('div.center.big', 'لو خيّروك…'), box, ui.sent != null ? R.waiting('ننتظر الباقين') : h('p.muted.center', 'اختاروا بالسر'), ui.sent != null ? R.hostBtn('اكشف الحين', () => wyr.reveal(R), '.btn-ghost') : null];
      const n = [0, 1].map((k) => Object.keys(picks).filter((id) => picks[id] === k).length), min = Math.min(n[0], n[1]);
      const verdict = n[0] === n[1] ? 'تعادل! الجلسة منقسمة نصّين 🔥' : min === 0 ? 'إجماع! ما فيه نقاش 😄' : `الأقلية (${min}) تدافع عن رأيها! عندها 30 ثانية ⏱️`;
      return [h('div.center.big', 'لو خيّروك…'), box, h('div.note', verdict), R.hostBtn('السؤال التالي', () => wyr.next(R))];
    },
  };
  SH.onlineGame(wyr);
})();

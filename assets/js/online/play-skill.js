/* اللعب أونلاين — إنسان حيوان جماد · تطابق · مبارزة الصقر */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle, pick, rnd } = SH;

  /* ---------- إنسان حيوان جماد ----------
     كل واحد يكتب إجاباته على جواله. أول واحد يخلّص يوقّف الكل، والنقاط تنحسب تلقائياً:
     جواب ما كتبه غيرك 10، مكرّر 5، فاضي أو ما يبدأ بالحرف 0. والمستضيف يقدر يلغي أي جواب غلط. */
  const norm = (s) => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  const bare = (s) => norm(s).replace(/^ال/, '');
  const starts = (ans, letter) => { const L = norm(letter).charAt(0), a = norm(ans); return !!a && (a.charAt(0) === L || bare(ans).charAt(0) === L); };
  function scoreRound(who, answers, letter, bad) {
    const cats = SH.LETTER_CATS.length, pts = {};
    who.forEach((id) => { pts[id] = []; });
    for (let c = 0; c < cats; c++) {
      const valid = {};
      who.forEach((id) => { const a = (answers[id] || [])[c] || ''; if (starts(a, letter) && !(bad && bad[id + '_' + c])) valid[id] = bare(a); });
      who.forEach((id) => { pts[id][c] = !(id in valid) ? 0 : Object.keys(valid).some((o) => o !== id && valid[o] === valid[id]) ? 5 : 10; });
    }
    return pts;
  }
  const sum = (a) => (a || []).reduce((x, y) => x + (y || 0), 0);

  const letters = {
    id: 'letters', emoji: '✍️', name: 'إنسان حيوان جماد', desc: 'كل واحد يكتب على جواله', min: 2,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 2) { SH.toast('«إنسان حيوان جماد» تحتاج لاعبين على الأقل'); return; }
      await letters.round(R, { who: ids, round: 0, rounds: 3, scores: null }, []);
    },
    async round(R, base, used) {
      const pool = SH.LETTERS.filter((l) => !used.includes(l)), letter = pick(pool.length ? pool : SH.LETTERS);
      await R.keep({ used: used.concat([letter]) });
      await R.put({ game: 'letters', step: 'play', who: base.who, round: base.round + 1, rounds: base.rounds, scores: base.scores || null, letter, ends: R.now() + 90000, got: 0 });
    },
    collect: (R) => R.step({ step: 'collect', at: R.now(), got: 0 }),
    async score(R) {
      const s = R.state, got = R.got(), answers = {};
      s.who.forEach((id) => { const a = (got[id] && got[id].a) || []; answers[id] = SH.LETTER_CATS.map((_, c) => String(a[c] || '').slice(0, 30)); });
      await R.step({ step: 'score', answers, bad: null, pts: scoreRound(s.who, answers, s.letter, null), got: 0 });
    },
    toggle(R, key) {
      const s = R.state, bad = Object.assign({}, s.bad || {});
      if (bad[key]) delete bad[key]; else bad[key] = true;
      return R.patch({ bad: Object.keys(bad).length ? bad : null, pts: scoreRound(s.who, s.answers, s.letter, bad) });
    },
    async confirm(R) {
      const s = R.state, scores = Object.assign({}, s.scores || {});
      s.who.forEach((id) => { scores[id] = (scores[id] || 0) + sum(s.pts[id]); });
      if (s.round >= s.rounds) return R.put({ game: 'letters', step: 'end', who: s.who, scores });
      await letters.round(R, { who: s.who, round: s.round, rounds: s.rounds, scores }, (R.priv && R.priv.used) || []);
    },
    auto: {
      play(R) { const got = R.got(); if (R.now() >= R.state.ends || Object.keys(got).some((id) => got[id] && got[id].done)) R.act(() => letters.collect(R)); },
      collect(R) { if (R.allIn() || R.now() - R.state.at >= 5000) R.act(() => letters.score(R)); else R.syncGot(); },
    },
    view(R) {
      const s = R.state, ui = R.ui, mem = R.mem, cats = SH.LETTER_CATS;
      if (mem.round !== s.round && (s.step === 'play')) { mem.round = s.round; mem.vals = cats.map(() => ''); }
      const hud = h('div.hud', h('span.pill', `الجولة ${s.round} من ${s.rounds}`), h('span.pill.gold', 'حرف ' + s.letter));
      if (s.step === 'play') {
        if (ui.sent != null) return [hud, h('div.pass', h('div.big', 'خلّصت! ✋'), h('p.muted', 'نوقّف الباقين ونجمع الأوراق…'))];
        ui.freeze = true;   /* لا نعيد رسم الشاشة والواحد يكتب */
        return [hud,
          h('div.center', h('div.slot', { style: { fontSize: 'clamp(70px, 22vw, 110px)' } }, s.letter), R.clock(s.ends)),
          h('div.card', { style: { display: 'grid', gap: '8px' } }, cats.map((c, i) => h('label.lt-row', h('span', c),
            h('input.inp', { id: 'lt-' + i, type: 'text', maxLength: 30, autocomplete: 'off', value: mem.vals[i] || '', oninput(e) { mem.vals[i] = e.target.value; } })))),
          h('button.btn.btn-bad.btn-xl.btn-block', { type: 'button', onclick() { ui.freeze = false; R.send({ done: true, a: mem.vals.slice() }); } }, '✋ خلّصت! وقّفوا')];
      }
      if (s.step === 'collect') {
        if (ui.sent == null && !ui.auto) { ui.auto = true; setTimeout(() => { if (R.state && R.state.n === s.n) R.send({ a: (mem.vals || []).slice() }); }, 0); }
        return [hud, h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '✋'), h('div.big', 'وقّفوا الأقلام!'), h('p.muted', 'نجمع الأوراق ونحسب النقاط…'))];
      }
      if (s.step === 'score') {
        const bad = s.bad || {}, host = R.isHost();
        return [hud,
          host ? h('div.note', h('b', 'للمستضيف: '), 'لو فيه جواب غلط اضغط عليه عشان ينلغي، ثم اعتمد.') : h('p.muted.center.small', 'المستضيف يراجع الإجابات ثم يعتمد النقاط.'),
          cats.map((c, ci) => h('div.card', { style: { padding: '12px 14px' } }, h('p.label', { style: { margin: '0 0 6px' } }, c),
            h('div.list', s.who.map((id) => {
              const a = ((s.answers || {})[id] || [])[ci] || '', p = ((s.pts || {})[id] || [])[ci] || 0, off = !!bad[id + '_' + ci];
              return h(host && a ? 'button' : 'div', { type: 'button', style: { opacity: a ? '1' : '.5', textDecoration: off ? 'line-through' : 'none', width: '100%', textAlign: 'start' }, onclick() { if (host && a) { Sound.play('tap'); letters.toggle(R, id + '_' + ci); } } },
                h('span.small.muted', R.nameOf(id)), h('span', { style: { flex: '1' } }, a || '—'), h('span.st', { style: { fontFamily: 'var(--font-display)' } }, String(p)));
            })))),
          h('div.card', h('h3', 'نقاط الجولة'), R.board(Object.keys(s.pts || {}).reduce((o, id) => { o[id] = sum(s.pts[id]); return o; }, {}))),
          R.hostBtn(s.round < s.rounds ? 'اعتمد وكمّل' : 'اعتمد والنتيجة', () => letters.confirm(R))];
      }
      return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), R.board(s.scores), h('div.spacer'), R.endButtons(() => letters.start(R))];
    },
  };
  SH.onlineGame(letters);

  /* ---------- تطابق ----------
     لوحة وحدة يشوفها الكل، وصاحب الدور يقلب من جواله. ترتيب البطاقات عند المستضيف بس. */
  const SIZE = 16;
  const memory = {
    id: 'memory', emoji: '🃏', name: 'تطابق', desc: 'لوحة وحدة والأدوار بينكم', min: 2, calm: true,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 2) { SH.toast('«تطابق» تحتاج لاعبين على الأقل'); return; }
      const icons = shuffle(SH.MEMORY.map((_, i) => i)).slice(0, SIZE / 2);
      await R.keep({ deck: shuffle(icons.concat(icons)) });
      await R.put({ game: 'memory', step: 'turn', who: ids, turn: ids[0], got: 0 });
    },
    nextTurn(R) { const s = R.state, n = s.who.length, at = s.who.indexOf(s.turn); for (let k = 1; k <= n; k++) { const id = s.who[(at + k) % n]; if (R.isOn(id)) return id; } return s.turn; },
    async flip(R, idx) {
      const s = R.state, deck = R.priv.deck, key = 'c' + idx;
      const open = Object.assign({}, s.open || {}), done = Object.assign({}, s.done || {});
      if (!(idx >= 0 && idx < SIZE) || key in open || key in done) return R.step({ got: 0 });
      open[key] = deck[idx];
      const keys = Object.keys(open);
      if (keys.length < 2) return R.step({ open, got: 0 });
      if (open[keys[0]] !== open[keys[1]]) return R.step({ step: 'peek', open, until: R.now() + 1400, got: 0 });
      keys.forEach((k) => { done[k] = open[k]; });
      const scores = Object.assign({}, s.scores || {}); scores[s.turn] = (scores[s.turn] || 0) + 1;
      await R.step({ step: Object.keys(done).length >= SIZE ? 'end' : 'turn', open: null, done, scores, got: 0 });
    },
    skip: (R) => R.step({ step: 'turn', open: null, turn: memory.nextTurn(R), got: 0 }),
    auto: {
      turn(R) { const s = R.state, got = R.got(); if (R.priv && s.turn in got) R.act(() => memory.flip(R, got[s.turn])); },
      peek(R) { if (R.now() >= R.state.until) R.act(() => memory.skip(R)); },
    },
    view(R) {
      const s = R.state, ui = R.ui, me = R.me, open = s.open || {}, done = s.done || {};
      if (s.step === 'end') return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), R.board(s.scores), h('div.spacer'), R.endButtons(() => memory.start(R))];
      const mine = s.turn === me && s.step === 'turn' && ui.sent == null;
      const shown = R.mem.cards || {}, now = (R.mem.cards = {});
      return [
        h('div.turn', { style: { '--c': R.colorOf(s.turn) } }, h('p.eyebrow', s.turn === me ? 'دورك! اقلب بطاقتين' : 'الدور على'), h('div.who', { style: { fontSize: '30px' } }, R.nameOf(s.turn))),
        h('div.mem', Array.from({ length: SIZE }, (_, i) => {
          const k = 'c' + i, icon = k in done ? done[k] : k in open ? open[k] : null, m = icon == null ? null : SH.MEMORY[icon];
          const fresh = !!m && !shown[k];   /* بطاقة انقلبت للتوّ: نرسمها مقلوبة ثم نقلبها عشان تبان الحركة */
          const el = h('button.mcard' + (m && !fresh ? '.up' : '') + (k in done ? '.done' : ''), { type: 'button', 'aria-label': m ? m[1] : 'بطاقة', disabled: !mine || !!m, onclick() { if (mine && !m) { Sound.play('flip'); R.send(i); } } },
            h('span.mcard-in', h('span.mface.mback'), h('span.mface.mfront', m ? [h('span.e', m[0]), m[1]] : null)));
          if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('up')));
          if (m) now[k] = true;
          return el;
        })),
        R.board(s.scores),
        s.turn === me ? null : R.hostBtn('نتخطّى دوره', () => memory.skip(R), '.btn-ghost'),
      ];
    },
  };
  SH.onlineGame(memory);

  /* ---------- مبارزة الصقر ----------
     الكل يشوف نفس الرموز بنفس التوقيت، وأول ما يطلع الصقر اضغط. كل جوال يحسب سرعة صاحبه بنفسه،
     فالنت البطيء ما يظلم أحد. اللي يضغط بدري أو على حيوان ثاني يطلع من الجولة. */
  const DECOYS = ['🐓', '🦉', '🐪', '🦆', '🐈', '🦜', '🐧'];
  const duel = {
    id: 'duel', emoji: '🦅', name: 'مبارزة الصقر', desc: 'مين أسرع يد؟', min: 2,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 2) { SH.toast('«مبارزة الصقر» تحتاج لاعبين على الأقل'); return; }
      await duel.arm(R, { who: ids, scores: null, round: 0 });
    },
    async arm(R, base) {
      const now = R.now(), at = now + 2800 + rnd(3600), fakes = [];
      for (let t = now + 1500; t + 1000 < at; t += 1100) if (Math.random() < 0.45) fakes.push({ at: t, s: pick(DECOYS) });
      await R.put({ game: 'duel', step: 'arm', who: base.who, scores: base.scores || null, round: base.round + 1, to: 5, at, fakes: fakes.length ? fakes : null, got: 0 });
    },
    async point(R) {
      const s = R.state, got = R.got(), times = {};
      Object.keys(got).forEach((id) => { times[id] = got[id]; });
      const ok = Object.keys(times).filter((id) => times[id] >= 0), best = ok.length ? Math.min(...ok.map((id) => times[id])) : null;
      const win = ok.filter((id) => times[id] === best), scores = Object.assign({}, s.scores || {});
      win.forEach((id) => { scores[id] = (scores[id] || 0) + 1; });
      await R.step({ step: 'point', times: Object.keys(times).length ? times : null, win: win.length ? win : null, scores, until: R.now() + 3000, got: 0 });
    },
    async after(R) {
      const s = R.state, top = Math.max(0, ...Object.keys(s.scores || {}).map((id) => s.scores[id]));
      if (top >= s.to) return R.put({ game: 'duel', step: 'end', who: s.who, scores: s.scores || null });
      await duel.arm(R, s);
    },
    auto: {
      arm(R) { if (R.allIn() || R.now() >= R.state.at + 2600) R.act(() => duel.point(R)); else R.syncGot(); },
      point(R) { if (R.now() >= R.state.until) R.act(() => duel.after(R)); },
    },
    view(R) {
      const s = R.state, ui = R.ui;
      if (s.step === 'arm') {
        const sym = h('div.sym', ''), msg = h('div.msg', ui.sent == null ? 'اضغط أول ما تشوف الصقر 🦅' : ui.sent >= 0 ? `ضغطت في ${ui.sent} ملّي ثانية ⚡` : 'استعجلت! ✋ طلعت من هالجولة');
        const current = () => { const t = R.now(); if (t >= s.at && t < s.at + 2000) return '🦅'; const f = (s.fakes || []).find((x) => t >= x.at && t < x.at + 750); return f ? f.s : ''; };
        ui.fast = () => { const c = current(); if (c !== ui.shown) { ui.shown = c; sym.textContent = c; if (c) Sound.play(c === '🦅' ? 'pop' : 'tock'); } };
        sym.textContent = ui.shown || '';
        const zone = h('button.tapzone' + (ui.sent == null ? '' : ui.sent >= 0 ? '.hit' : '.miss'), { type: 'button', disabled: ui.sent != null }, sym, msg);
        zone.addEventListener('pointerdown', (e) => { e.preventDefault(); if (ui.sent != null) return; const t = R.now(); buzz(30); R.send(t >= s.at ? Math.round(t - s.at) : -1); });
        return [h('div.hud', h('span.pill', 'الجولة ' + s.round), h('span.pill.gold', `الفوز من ${s.to}`)), zone, R.board(s.scores)];
      }
      if (s.step === 'point') {
        const times = s.times || {}, win = s.win || [];
        const rows = s.who.map((id) => ({ id, t: id in times ? times[id] : null })).sort((a, b) => (a.t == null || a.t < 0 ? 1e9 : a.t) - (b.t == null || b.t < 0 ? 1e9 : b.t));
        return [h('div.center', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, win.length ? '⚡' : '😅'), h('div.big', win.length ? 'أسرع يد: ' + win.map((id) => R.nameOf(id)).join(' و ') : 'طار الصقر وما أحد لحقه')),
          h('div', { style: { display: 'grid', gap: '8px' } }, rows.map((r, i) => h('div.guess-row' + (win.includes(r.id) ? '.win' : ''), { style: { '--i': i } },
            h('span.n', R.nameOf(r.id)), h('span.v', r.t == null ? '—' : r.t < 0 ? 'استعجل ✋' : r.t + ' ms')))),
          R.board(s.scores)];
      }
      return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'عين الصقر')), R.board(s.scores), h('div.spacer'), R.endButtons(() => duel.start(R))];
    },
  };
  SH.onlineGame(duel);
})();

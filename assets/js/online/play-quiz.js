/* اللعب أونلاين — ألعاب الأسئلة: الكل يجاوب على جواله بنفس اللحظة، والأسرع ياخذ نقاط أكثر.
   الفطاحلة (مع اختيار المجال بالدور) · كمّل المثل · وش معناها؟ · فكّ الإيموجي */
(function () {
  'use strict';
  const { h, shuffle, pick } = SH;
  const LETTERS = ['أ', 'ب', 'ج', 'د'];

  /* سؤال بصيغته الداخلية: { tag, text, big, opts[4], c (رقم الصح), note } */
  const mk = (tag, text, correct, wrongs, note, big) => {
    const opts = shuffle([correct].concat(wrongs));
    return { tag, text, big: !!big, opts, c: opts.indexOf(correct), note: note || '' };
  };
  const pub = (q) => ({ tag: q.tag, text: q.text, big: q.big, opts: q.opts });

  /* def: { id, emoji, name, desc, total, secs, make(R, n) => أسئلة، أو cats لاختيار المجال }
     ولفقرات الحفلة: party, types, title(R), ready(R), who(R) (مين يلعب)، وصاحبة الحفلة تتفرّج */
  function quiz(def) {
    const ask = (R, base, q) => R.put(Object.assign({ game: def.id, step: 'ask', q: pub(q), ends: R.now() + def.secs * 1000, dur: def.secs * 1000, got: 0 }, base));
    const nextChooser = (R, who, from) => { for (let k = 0; k < who.length; k++) { const id = who[(from + k) % who.length]; if (R.isOn(id)) return id; } return who[from % who.length]; };

    const g = {
      id: def.id, emoji: def.emoji, name: def.name, desc: def.desc, min: 2,
      party: def.party, types: def.types, title: def.title, pdesc: def.pdesc, ready: def.ready, watch: !!def.party,
      async start(R) {
        const ids = def.who ? def.who(R) : R.hereIds();
        if (ids.length < 2) { SH.toast(`«${R.label(g)}» تحتاج لاعبين على الأقل` + (def.who ? ' غير صاحبة الحفلة' : '')); return; }
        if (def.cats) { await R.keep({ used: null }); return R.put({ game: def.id, step: 'pick', who: ids, i: 0, total: def.total, chooser: ids[0], got: 0 }); }
        const qs = def.make(R, def.total);
        if (!qs.length) { SH.toast('ما فيه أسئلة كفاية لهالفقرة'); return; }
        await R.keep({ qs });
        await ask(R, { who: ids, i: 0, total: qs.length }, qs[0]);
      },
      /* الفطاحلة: نسحب سؤال من المجال اللي اختاره صاحب الدور */
      async draw(R, cat) {
        const s = R.state, used = (R.priv && R.priv.used) || [];
        const row = SH.TRIVIA.cats.find((c) => c[0] === cat) || pick(SH.TRIVIA.cats);
        const all = SH.TRIVIA.q[row[0]].map((q, i) => ({ q, key: row[0] + ':' + i }));
        let pool = all.filter((x) => !used.includes(x.key)); if (!pool.length) pool = all;
        const x = pick(pool);
        const q = mk(row[1] + ' ' + row[2], x.q[1], x.q[2], x.q.slice(3, 6), x.q[6]);
        await R.keep({ cur: q, used: used.concat([x.key]) });
        await ask(R, { who: s.who, i: s.i, total: s.total, scores: s.scores || null }, q);
      },
      async reveal(R) {
        const s = R.state, got = R.got(), q = def.cats ? R.priv.cur : R.priv.qs[s.i];
        const picks = {}, gains = {}, scores = Object.assign({}, s.scores || {});
        Object.keys(got).forEach((id) => {
          const v = got[id]; picks[id] = v.i;
          if (v.i === q.c) { const p = 10 + Math.round(5 * Math.max(0, Math.min(1, (s.ends - v.t) / s.dur))); gains[id] = p; scores[id] = (scores[id] || 0) + p; }
        });
        await R.step({ step: 'reveal', c: q.c, picks, gains, scores, note: q.note || null, got: 0 });
      },
      async next(R) {
        const s = R.state, i = s.i + 1, base = { who: s.who, i, total: s.total, scores: s.scores || null };
        if (i >= s.total) return R.put({ game: def.id, step: 'end', who: s.who, scores: s.scores || null });
        if (def.cats) return R.put(Object.assign({ game: def.id, step: 'pick', chooser: nextChooser(R, s.who, i), got: 0 }, base));
        await ask(R, base, R.priv.qs[i]);
      },
      auto: {
        pick(R) { const got = R.got(), c = R.state.chooser; if (c in got) R.act(() => g.draw(R, got[c])); },
        ask(R) { if (!R.priv) return; if (R.allIn() || R.now() >= R.state.ends) R.act(() => g.reveal(R)); else R.syncGot(); },
      },
      view(R) {
        const s = R.state, ui = R.ui, me = R.me;
        if (s.step === 'pick') {
          const mine = s.chooser === me;
          return [
            h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`)),
            h('div.turn', { style: { '--c': R.colorOf(s.chooser) } }, h('p.eyebrow', 'يختار المجال'), h('div.who', R.nameOf(s.chooser))),
            mine ? (ui.sent ? h('p.muted.center', 'جاري سحب السؤال…') : h('div.tiles', def.cats().map(([id, e, name]) => h('button.pickt', { type: 'button', onclick() { R.send(id); } }, h('span.e', e), name))))
              : h('p.muted.center', 'استعدوا… السؤال جاي للكل بنفس اللحظة.'),
            mine ? null : R.hostBtn('اختاروا عنه', () => g.draw(R, pick(def.cats())[0]), '.btn-ghost'),
            R.board(s.scores),
          ];
        }
        if (s.step === 'ask' || s.step === 'reveal') {
          const q = s.q, done = s.step === 'reveal', my = done ? (s.picks || {})[me] : ui.sent != null ? ui.sent.i : null;
          const spec = !s.who.includes(me);   /* متفرّج: يشوف السؤال والنتيجة بدون ما يجاوب */
          const opts = h('div.opts' + (done || spec || ui.sent != null ? '.locked' : ''), q.opts.map((txt, k) => {
            let cls = '';
            if (done) cls = k === s.c ? '.right' : k === my ? '.wrong' : '.dim'; else if (my != null) cls = k === my ? '.sel' : '.dim';
            return h('button.opt' + cls, { type: 'button', onclick() { if (!done && !spec && ui.sent == null) R.send({ i: k, t: R.now() }); } }, h('span.k', LETTERS[k]), h('span', txt));
          }));
          const head = [
            h('div.hud', h('span.pill', `سؤال ${s.i + 1} من ${s.total}`), done ? null : R.clock(s.ends)),
            done ? null : R.bar(s.ends, s.dur),
            h('div.prompt', { style: { minHeight: '0' } }, q.tag ? h('span.tag', q.tag) : null, q.big ? h('span.emo', q.text) : q.text),
            opts,
          ];
          if (!done) return head.concat([spec ? h('p.muted.center', def.specHint ? def.specHint(R) : 'تتفرّجون هالجولة.') : null, ui.sent != null || spec ? R.waiting(spec ? 'جاوبوا' : 'ننتظر الباقين') : null]);
          const gains = s.gains || {}, right = Object.keys(gains).map((id) => R.nameOf(id));
          return head.concat([
            spec ? (s.note ? h('div.note', s.note) : null) : h('div.note', h('b', gains[me] ? `كفو! +${gains[me]} ` : my == null ? 'ما لحقت تجاوب. ' : 'لا، مو هذي. '), s.note || ''),
            h('p.muted.center.small', right.length ? 'جاوبوا صح: ' + right.join('، ') : 'ولا أحد جاوب صح!'),
            R.board(s.scores), R.hostBtn(s.i + 1 < s.total ? 'السؤال التالي' : 'النتيجة', () => g.next(R)),
          ]);
        }
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), R.board(s.scores), h('div.spacer'), R.endButtons(() => g.start(R))];
      },
    };
    SH.onlineGame(g);
  }
  SH.onlineQuiz = quiz; SH.onlineMk = mk;

  quiz({
    id: 'trivia', emoji: '🧠', name: 'الفطاحلة', desc: 'كل واحد يختار المجال بدوره', total: 8, secs: 20,
    cats: () => SH.TRIVIA.cats,
  });
  quiz({
    id: 'proverbs', emoji: '📜', name: 'كمّل المثل', desc: 'الأسرع في تكملة المثل', total: 8, secs: 15,
    make: (R, n) => shuffle(SH.PROVERBS).slice(0, n).map((p) => mk('كمّل المثل', p[0], p[1], p.slice(2, 5), `«${p[0].replace('…', '')} ${p[1]}»: ${p[5]}`)),
  });
  quiz({
    id: 'dialects', emoji: '🗣️', name: 'وش معناها؟', desc: 'كلمات من لهجات المملكة', total: 8, secs: 15,
    make: (R, n) => shuffle(SH.DIALECTS).slice(0, n).map((d) => mk('لهجة ' + d[1], '«' + d[0] + '»', d[2], d.slice(3, 6), `«${d[0]}» تعني: ${d[2]}. ${d[6]}`)),
  });
  quiz({
    id: 'emoji', emoji: '🧩', name: 'فكّ الإيموجي', desc: 'مين يفكّ اللغز أول؟', total: 8, secs: 20,
    make: (R, n) => shuffle(SH.EMOJI).slice(0, n).map((e) => {
      const same = shuffle(SH.EMOJI.filter((x) => x !== e && x[2] === e[2])), rest = shuffle(SH.EMOJI.filter((x) => x !== e && x[2] !== e[2]));
      return mk(e[2], e[0], e[1], same.concat(rest).slice(0, 3).map((x) => x[1]), null, true);
    }),
  });
})();

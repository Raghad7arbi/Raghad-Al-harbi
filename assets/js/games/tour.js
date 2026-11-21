/* بطولة السهرة — نفس الفرق تلعب عدة ألعاب والنقاط تتجمّع لين التتويج */
(function () {
  'use strict';
  const { h, Sound, Store } = SH;

  /* ترتيب اللعب: تسخين خفيف، ثم تبادل بين الحركة والتفكير، والختام بالفطاحلة */
  const ORDER = ['emoji', 'charades', 'guess', 'taboo', 'proverbs', 'memory', 'dialects', 'letters', 'duel', 'trivia'];
  /* إعدادات قصيرة عشان البطولة ما تطول (وتتغيّر من شاشة كل لعبة) */
  const SHORT = {
    trivia: { rounds: 3 }, charades: { rounds: 2, time: 60 }, taboo: { rounds: 2, time: 60 }, emoji: { n: 8, time: 30 },
    guess: { n: 5 }, proverbs: { n: 5 }, dialects: { n: 5 }, letters: { rounds: 3, time: 90 }, memory: { size: 16 }, duel: { to: 5 },
  };
  const NOTES = {
    guess: 'كل فريق يتشاور ويكتب توقّع واحد.',
    proverbs: 'كل فريق يتشاور ويجاوب في دوره.',
    dialects: 'كل فريق يتشاور ويجاوب في دوره.',
    letters: 'كل فريق يكتب على ورقة وحدة.',
    memory: 'الفرق تتناوب، وكل دور يلعبه واحد من الفريق.',
    duel: 'كل فريق يختار مبارز واحد يمثّله.',
  };
  const game = (id) => SH.games.find((g) => g.id === id);
  const save = (t) => Store.set('tour', t);
  const golden = (t, i) => t.games.length > 1 && i === t.games.length - 1;

  const TOUR = {
    id: 'tour', hidden: true, name: 'بطولة السهرة', emoji: '🏆', color: 'night', moods: [],
    tagline: 'اختاروا ألعابكم، والنقاط تتجمّع من لعبة للعبة لين التتويج.',
    leaveMsg: 'تطلعون من البطولة؟ الترتيب محفوظ وتقدرون تكمّلونها بعدين.',
    how: [
      'سجّلوا فرقكم واختاروا الألعاب. نفس الفرق تلعب كل الألعاب ورا بعض.',
      'بعد كل لعبة: فوزك على فريق يعطيك نقطتين في ترتيب البطولة، والتعادل نقطة.',
      'آخر لعبة هي الذهبية ونقاطها مضاعفة، فالحسم دايماً في النهاية.',
    ],
    start(ctx) {
      const t = Store.get('tour', null);
      const ok = t && Array.isArray(t.games) && Array.isArray(t.teams) && Array.isArray(t.log) && t.idx > 0 && t.idx < t.games.length && t.games.every(game);
      if (ok) return resume(ctx, t);
      setup(ctx);
    },
  };

  function setup(ctx) {
    ctx.intro({
      setup: 'teams', min: 2, max: 4, startLabel: 'ابدأوا البطولة',
      options: [{ key: 'games', label: 'ألعاب البطولة (اختاروا لعبتين أو أكثر)', multi: true, choices: ORDER.map((id) => [id, game(id).emoji + ' ' + game(id).name]), def: ['emoji', 'charades', 'guess', 'trivia'] }],
      validate(cfg) {
        const list = cfg.games.filter((id) => id !== 'duel' || cfg.teams.length === 2);
        if (list.length < 2) return cfg.games.includes('duel') && cfg.teams.length !== 2 ? 'مبارزة الصقر لفريقين بس. اختاروا لعبة ثانية معها' : 'اختاروا لعبتين على الأقل';
        return null;
      },
      onStart(cfg) {
        const dropped = cfg.games.includes('duel') && cfg.teams.length !== 2;
        const t = {
          teams: cfg.teams.map((x) => ({ name: x.name, color: x.color, total: 0 })),
          games: ORDER.filter((id) => cfg.games.includes(id) && (id !== 'duel' || cfg.teams.length === 2)),
          idx: 0, log: [],
        };
        save(t);
        if (dropped) SH.toast('شلنا مبارزة الصقر لأنها لفريقين بس');
        hub(ctx, t, null);
      },
    });
  }

  function resume(ctx, t) {
    ctx.dirty = true;
    ctx.view(
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🏆'), h('h1', 'بطولتكم بانتظاركم'), h('p', `وقفتوا عند اللعبة ${t.idx + 1} من ${t.games.length}.`)),
      standings(t),
      h('div.spacer'),
      h('div.row',
        h('button.btn.btn-gold', { type: 'button', onclick() { Sound.play('pop'); hub(ctx, t, null); } }, 'نكمّل البطولة'),
        h('button.btn', { type: 'button', onclick() { Sound.play('tap'); save(null); ctx.dirty = false; setup(ctx); } }, 'بطولة جديدة'))
    );
  }

  const standings = (t) => h('div.card', h('h3', 'ترتيب البطولة'),
    h('div.rank', t.teams.slice().sort((a, b) => b.total - a.total).map((x, i) =>
      h('div.rank-row', { style: { '--i': i } }, h('span.m', String(i + 1)), h('span.n', h('i.tdot', { style: { background: x.color } }), x.name), h('span.s', String(x.total))))));

  const schedule = (t) => h('div.sched', t.games.map((id, i) => {
    const g = game(id), done = t.log[i];
    const best = done ? Math.max(...done.scores) : 0;
    const winners = done ? t.teams.filter((_, k) => done.scores[k] === best).map((x) => x.name) : [];
    return h('div' + (i === t.idx ? '.now' : done ? '.done' : ''),
      h('span.st', done ? '✓' : i === t.idx ? '▶' : String(i + 1)),
      h('span.nm', g.emoji + ' ' + g.name, golden(t, i) ? h('small', '✨ ذهبية: نقاطها مضاعفة') : null),
      done ? h('small', winners.length === 1 ? 'فاز ' + winners[0] : 'تعادل') : null);
  }));

  /* محطة البطولة: نتيجة اللعبة اللي خلصت + الترتيب + اللعبة الجاية */
  function hub(ctx, t, last) {
    ctx.reset(); ctx.setGame(TOUR); ctx.dirty = true;
    const over = t.idx >= t.games.length;
    const next = over ? null : game(t.games[t.idx]);
    let lastCard = null;
    if (last) {
      const g = game(last.id);
      const order = t.teams.map((x, i) => i).sort((a, b) => last.scores[b] - last.scores[a]);
      lastCard = h('div.card', h('h3', `نتيجة ${g.emoji} ${g.name}`),
        h('div.rank', order.map((i, k) => h('div.rank-row', { style: { '--i': k, background: 'var(--surface2)', color: 'var(--ink)' } },
          h('span.n', h('i.tdot', { style: { background: t.teams[i].color } }), t.teams[i].name, h('small', 'نقاط اللعبة: ' + last.scores[i])),
          h('span.pill.gold', '+' + last.pts[i])))));
      Sound.play('reveal');
    }
    ctx.view(
      h('div.hud', h('span.pill.gold', over ? 'خلصت كل الألعاب' : `اللعبة ${t.idx + 1} من ${t.games.length}`), last ? null : h('span.muted.small', 'فوزك على فريق = نقطتين')),
      lastCard,
      standings(t),
      schedule(t),
      h('div.spacer'),
      h('div.sticky-cta', over
        ? h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { crown(ctx, t); } }, '🏆 التتويج')
        : h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); play(ctx, t); } }, `يلا: ${next.emoji} ${next.name}`)),
      !over && t.log.length ? h('button.btn.btn-ghost', { type: 'button', async onclick() { if (await SH.confirm('تنهون البطولة الحين وتتوّجون المتصدّر؟', 'ننهيها', 'نكمّل')) crown(ctx, t); } }, 'ننهي البطولة هنا') : null
    );
  }

  /* تشغيل لعبة من المكتبة داخل البطولة: نفس اللعبة لكن بفرق جاهزة ونتيجتها ترجع لنا */
  function play(ctx, t) {
    ctx.reset();
    const g = game(t.games[t.idx]);
    const gold = golden(t, t.idx);
    const sub = Object.create(ctx);
    sub.game = g;
    sub.preset = {
      kicker: `اللعبة ${t.idx + 1} من ${t.games.length}` + (gold ? ' · ✨ الذهبية: نقاطها مضاعفة' : ''),
      note: NOTES[g.id] || null,
      defaults: SHORT[g.id] || {},
      roster: () => t.teams.map((x, i) => ({ name: x.name, color: x.color, score: 0, idx: i })),
    };
    sub.onResults = (spec) => {
      const scores = t.teams.map(() => 0);
      spec.rows.forEach((r) => { scores[r.idx] = r.score; });
      const pts = scores.map((s, i) => scores.reduce((sum, o, j) => sum + (j === i ? 0 : s > o ? 2 : s === o ? 1 : 0), 0) * (gold ? 2 : 1));
      t.teams.forEach((x, i) => { x.total += pts[i]; });
      t.log.push({ id: g.id, scores, pts }); t.idx++;
      save(t);
      hub(ctx, t, t.log[t.log.length - 1]);
    };
    ctx.setGame(g);
    g.start(sub);
  }

  function crown(ctx, t) {
    save(null);
    ctx.results({
      rows: t.teams.map((x) => ({ name: x.name, color: x.color, score: x.total })),
      award: (w, tie) => (tie ? 'أبطال السهرة مع بعض 🏆' : 'أبطال السهرة 🏆'),
      extra: schedule(Object.assign({}, t, { idx: -1 })),
    });
  }

  SH.add(TOUR);
})();

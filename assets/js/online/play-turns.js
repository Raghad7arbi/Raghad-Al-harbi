/* اللعب أونلاين — ألعاب الأدوار: بدون كلام · لا تقولها · القنبلة · دوّر الدلّة */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle, pick, rnd } = SH;

  /* ---------- بدون كلام + لا تقولها ----------
     صاحب الدور يشوف البطاقة على جواله بس، والباقين يخمّنون بصوتهم (في نفس المجلس أو على مكالمة).
     في «لا تقولها» واحد يراقب البطاقة ويضغط لو انقالت كلمة ممنوعة. */
  function turns(def) {
    const g = {
      id: def.id, emoji: def.emoji, name: def.name, desc: def.desc, min: def.min,
      async start(R) {
        const ids = R.hereIds();
        if (ids.length < def.min) { SH.toast(`«${def.name}» تحتاج ${def.min} لاعبين على الأقل`); return; }
        await R.put({ game: def.id, step: 'ready', who: ids, t: 0, turns: ids.length * (ids.length <= 3 ? 2 : 1), actor: ids[0], watch: def.watch ? ids[1 % ids.length] : null, got: 0 });
      },
      async deal(R) { const s = R.state, card = def.draw(); await R.tell(s.actor, { card }); if (s.watch) await R.tell(s.watch, { card }); },
      async begin(R) { await g.deal(R); await R.step({ step: 'turn', ends: R.now() + 60000, count: 0, skips: 3, k: 0, got: 0 }); },
      async action(R, a) {
        const s = R.state; let count = s.count, skips = s.skips;
        if (a === 'ok') count++; else if (a === 'bad') count--; else skips = Math.max(0, skips - 1);
        await g.deal(R);
        await R.step({ count, skips, k: s.k + 1, got: 0 });
      },
      async finish(R) {
        const s = R.state, scores = Object.assign({}, s.scores || {});
        scores[s.actor] = (scores[s.actor] || 0) + s.count;
        await R.step({ step: 'summary', scores, got: 0 });
      },
      async next(R) {
        const s = R.state, t = s.t + 1, n = s.who.length;
        if (t >= s.turns) return R.put({ game: def.id, step: 'end', who: s.who, scores: s.scores || null });
        await R.put({ game: def.id, step: 'ready', who: s.who, t, turns: s.turns, actor: s.who[t % n], watch: def.watch ? s.who[(t + 1) % n] : null, scores: s.scores || null, got: 0 });
      },
      auto: {
        ready(R) { if (R.state.actor in R.got()) R.act(() => g.begin(R)); },
        turn(R) {
          const s = R.state, got = R.got();
          if (R.now() >= s.ends) return R.act(() => g.finish(R));
          if (s.watch && got[s.watch] === 'bad') return R.act(() => g.action(R, 'bad'));
          if (s.actor in got) R.act(() => g.action(R, got[s.actor]));
        },
      },
      view(R) {
        const s = R.state, ui = R.ui, me = R.me, actor = R.nameOf(s.actor);
        const iAct = s.actor === me, iWatch = s.watch === me;
        const turnNo = h('span.pill', `دور ${s.t + 1} من ${s.turns}`);
        if (s.step === 'ready') {
          return [h('div.hud', turnNo),
            h('div.turn', { style: { '--c': R.colorOf(s.actor) } }, h('p.eyebrow', 'الدور على'), h('div.who', actor)),
            iAct ? h('p.center', def.actorHint) : h('p.muted.center', iWatch ? 'أنت المراقب هالدور: بتشوف البطاقة، وإذا قال كلمة ممنوعة اضغط «قالها!».' : def.guessHint),
            s.watch && !iWatch ? h('p.muted.center.small', `المراقب: ${R.nameOf(s.watch)}`) : null,
            h('div.spacer'),
            iAct ? (ui.sent ? h('p.muted.center', 'لحظة…') : h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { R.send('go'); } }, 'جاهز، ابدأ الوقت'))
              : R.hostBtn('نتخطّى دوره', () => g.next(R), '.btn-ghost')];
        }
        if (s.step === 'turn') {
          const card = R.secret && R.secret.card;
          const hud = h('div.hud', R.clock(s.ends), h('span.pill.gold', 'النقاط ' + s.count));
          if (iAct) return [hud, card ? def.face(card) : h('div.pass', 'لحظة…'),
            h('div.row', h('button.btn.btn-ok', { type: 'button', disabled: ui.sent != null, style: { flex: '2 1 160px' }, onclick() { R.send('ok'); } }, '✓ خمّنوها'),
              h('button.btn', { type: 'button', disabled: ui.sent != null || s.skips <= 0, onclick() { R.send('skip'); } }, `↷ تخطّي (${s.skips})`))];
          if (iWatch) return [hud, h('div.note', h('b', 'أنت المراقب. '), `لو ${actor} قال كلمة ممنوعة اضغط الزر.`), card ? def.face(card) : null,
            h('button.btn.btn-bad.btn-xl.btn-block', { type: 'button', disabled: ui.sent != null, onclick() { R.send('bad'); } }, '✗ قالها!')];
          return [hud, h('div.pass', h('span', { style: { fontSize: '72px', lineHeight: '1.2' } }, def.emoji), h('div.big', `${actor} ${def.verb}`), h('p.muted', 'خمّنوا بصوت عالي!')),
            R.hostBtn('نتخطّى دوره', () => g.finish(R), '.btn-ghost')];
        }
        if (s.step === 'summary') {
          return [h('div.turn', { style: { '--c': R.colorOf(s.actor) } }, h('p.eyebrow', 'خلص الوقت!'), h('div.who', actor), h('div.big', 'النقاط: ' + (s.count > 0 ? '+' : '') + s.count)),
            R.board(s.scores), h('div.spacer'), R.hostBtn(s.t + 1 < s.turns ? 'الدور الجاي' : 'النتيجة', () => g.next(R))];
        }
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('div.big', 'النتيجة')), R.board(s.scores), h('div.spacer'), R.endButtons(() => g.start(R))];
      },
    };
    SH.onlineGame(g);
  }

  turns({
    id: 'charades', emoji: '🎭', name: 'بدون كلام', desc: 'الكلمة على جوالك، مثّلها للباقين', min: 2, watch: false, verb: 'يمثّل…',
    actorHint: 'بتطلع لك كلمات على جوالك. مثّلها بدون كلام، وكل ما خمّنوها اضغط «خمّنوها».',
    guessHint: 'ركّزوا معه وخمّنوا بصوت عالي. لو كل واحد في مكان، افتحوا مكالمة فيديو.',
    draw: () => { const c = pick(SH.CHARADES); return { w: pick(c[2]), tag: c[1] }; },
    face: (c) => h('div.prompt.grow', h('span.tag', c.tag), h('span.word', { style: { fontSize: 'clamp(34px, 9.5vw, 56px)' } }, c.w), h('span.small', 'مثّلها بدون كلام')),
  });
  turns({
    id: 'taboo', emoji: '🤐', name: 'لا تقولها', desc: 'وصّف بدون الكلمات الممنوعة', min: 3, watch: true, verb: 'يوصّف…',
    actorHint: 'بتطلع لك كلمة ومعها كلمات ممنوعة. وصّفها للباقين بدون ما تقول الممنوعات.',
    guessHint: 'اسمعوا الوصف وخمّنوا الكلمة بصوت عالي.',
    draw: () => { const c = pick(SH.TABOO); return { w: c[0], ban: c[1] }; },
    face: (c) => h('div.prompt.grow', h('span.word', c.w), h('span.small', 'ممنوع تقول'), h('div.ban', (c.ban || []).map((w) => h('span', w)))),
  });

  /* ---------- القنبلة ----------
     القنبلة «عند» لاعب واحد. يقول جوابه ويضغط عشان تروح للّي بعده. وقت الانفجار مخفي عند المستضيف. */
  const BEAT = [800, 620, 460, 320, 210];
  const hearts = (R, s) => h('div.scores', s.who.map((id) => h('div.score' + ((s.lives[id] || 0) <= 0 ? '.out' : '') + (id === s.holder ? '.on' : ''), { style: { '--c': R.colorOf(id) } }, h('i'), h('span', R.nameOf(id)), h('span.hearts', (s.lives[id] || 0) > 0 ? '❤️'.repeat(s.lives[id]) : '💀'))));
  let heatMemo = '';
  const bomb = {
    id: 'bomb', emoji: '💣', name: 'القنبلة', desc: 'قل جواب ومرّرها قبل تنفجر', min: 3,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 3) { SH.toast('«القنبلة» تحتاج 3 لاعبين على الأقل'); return; }
      const lives = {}; ids.forEach((id) => { lives[id] = 2; });
      await bomb.round(R, { who: ids, alive: ids, lives, round: 0 }, pick(ids));
    },
    async round(R, base, holder) {
      const t0 = R.now();
      await R.keep({ t0, ends: t0 + 15000 + rnd(25000) });
      await R.put({ game: 'bomb', step: 'hold', who: base.who, alive: base.alive, lives: base.lives, round: base.round + 1, holder, prompt: pick(SH.BOMB), heat: 0, passes: 0, got: 0 });
    },
    pass(R) { const s = R.state, a = s.alive, next = a[(a.indexOf(s.holder) + 1) % a.length]; return R.step({ holder: next, passes: s.passes + 1, got: 0 }); },
    boom(R) {
      const s = R.state, lives = Object.assign({}, s.lives); lives[s.holder] = Math.max(0, (lives[s.holder] || 0) - 1);
      return R.step({ step: 'boom', hit: s.holder, lives, alive: s.alive.filter((id) => lives[id] > 0), got: 0 });
    },
    again(R) {
      const s = R.state;
      if (s.alive.length <= 1) return R.step({ step: 'end' });
      const from = s.alive.includes(s.hit) ? s.hit : s.alive[0];
      return bomb.round(R, { who: s.who, alive: s.alive, lives: s.lives, round: s.round }, from);
    },
    auto: {
      hold(R) {
        const s = R.state, p = R.priv; if (!p || !p.ends) return;
        if (R.now() >= p.ends) return R.act(() => bomb.boom(R));
        if (R.got()[s.holder] === 'pass') return R.act(() => bomb.pass(R));
        const heat = Math.min(4, Math.floor((5 * (R.now() - p.t0)) / (p.ends - p.t0))), k = s.n + ':' + heat;
        if (heat !== s.heat && k !== heatMemo) { heatMemo = k; R.patch({ heat }); }
      },
    },
    view(R) {
      const s = R.state, ui = R.ui, me = R.me, mine = s.holder === me;
      if (s.step === 'hold') {
        const beat = BEAT[s.heat || 0];
        ui.last = ui.last || 0;
        ui.fast = () => { const t = Date.now(); if (t - ui.last >= beat) { ui.last = t; Sound.play((s.heat || 0) >= 3 ? 'tick' : 'tock'); } };
        return [
          h('div.hud', h('span.pill', 'الجولة ' + s.round), h('span.pill', 'تمريرات ' + s.passes)),
          h('div.prompt', { style: { minHeight: '0', padding: '14px 16px 36px' } }, h('span.tag', 'كل واحد يقول'), s.prompt),
          hearts(R, s),
          h('div.bomb-wrap' + (mine ? '.danger-bg' : ''), { style: { '--beat': beat / 1000 + 's' } }, h('div.bomb', { style: mine ? {} : { fontSize: '90px' } }, '💣'),
            h('div.big', mine ? 'القنبلة عندك!' : 'القنبلة عند ' + R.nameOf(s.holder))),
          mine ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', disabled: ui.sent != null, onclick() { R.send('pass'); } }, 'قلتها، مرّر! 💨')
            : R.hostBtn('مرّر عنه', () => bomb.pass(R), '.btn-ghost'),
        ];
      }
      if (s.step === 'boom') {
        if (!ui.boomed) { ui.boomed = true; Sound.play('boom'); buzz([300, 80, 300]); }
        const out = (s.lives[s.hit] || 0) <= 0;
        return [h('div.bomb-wrap.shake', h('div.boom', '💥'), h('div.big', 'انفجرت عند ' + R.nameOf(s.hit)), h('p.muted', out ? 'خلصت قلوبه وطلع من اللعبة 💀' : 'خسر قلب')),
          hearts(R, s), R.hostBtn(s.alive.length <= 1 ? 'النتيجة' : 'جولة جديدة', () => bomb.again(R))];
      }
      return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '🏆'), h('p.eyebrow', 'آخر واحد نجا'), h('div.huge', { style: { fontSize: 'clamp(44px, 13vw, 76px)', color: 'var(--accent)' } }, R.nameOf(s.alive[0]))),
        hearts(R, s), h('div.spacer'), R.endButtons(() => bomb.start(R))];
    },
  };
  SH.onlineGame(bomb);

  /* ---------- دوّر الدلّة ----------
     الدلّة تدور على كل الجوالات وتوقف على نفس الشخص، وهو يختار صراحة أو تحدّي من جواله. */
  const SPIN = 4300;
  const dallah = {
    id: 'dallah', emoji: '🫖', name: 'دوّر الدلّة', desc: 'صراحة ولا تحدّي؟', min: 2,
    async start(R) {
      const ids = R.hereIds();
      if (ids.length < 2) { SH.toast('«دوّر الدلّة» تحتاج لاعبين على الأقل'); return; }
      const mine = SH.mine();
      await R.keep({ t: shuffle(mine.truth).concat(shuffle(SH.TRUTH)).slice(0, 40), d: shuffle(mine.dare).concat(shuffle(SH.DARE)).slice(0, 40) });
      await dallah.spin(R, { who: ids, ti: 0, di: 0, turns: null }, null);
    },
    async spin(R, base, last) {
      const turns = Object.assign({}, base.turns || {});
      let pool = base.who.filter((id) => R.isOn(id) && id !== last); if (!pool.length) pool = base.who.filter((id) => R.isOn(id)); if (!pool.length) pool = base.who;
      const least = Math.min(...pool.map((id) => turns[id] || 0));
      const target = pick(pool.filter((id) => (turns[id] || 0) <= least));
      turns[target] = (turns[target] || 0) + 1;
      await R.put({ game: 'dallah', step: 'spin', who: base.who, ti: base.ti, di: base.di, turns, target, at: R.now(), got: 0 });
    },
    async card(R, kind) {
      const s = R.state, p = R.priv, truth = kind !== 'dare';
      const listed = truth ? p.t : p.d, idx = truth ? s.ti : s.di;
      await R.step({ step: 'card', kind: truth ? 'truth' : 'dare', text: listed[idx % listed.length], ti: s.ti + (truth ? 1 : 0), di: s.di + (truth ? 0 : 1), got: 0 });
    },
    again: (R) => dallah.spin(R, R.state, R.state.target),
    auto: {
      spin(R) { const s = R.state, got = R.got(); if (R.priv && s.target in got) R.act(() => dallah.card(R, got[s.target])); },
      card(R) { const s = R.state; if (R.got()[s.target] === 'done') R.act(() => dallah.again(R)); },
    },
    view(R) {
      const s = R.state, ui = R.ui, me = R.me, n = s.who.length, mine = s.target === me, name = R.nameOf(s.target);
      if (s.step === 'spin') {
        const idx = s.who.indexOf(s.target), rot = 360 * 5 + (idx / n) * 360;
        if (!ui.arena) {
          const late = R.now() - s.at >= SPIN;
          ui.spun = late;
          const spinner = h('div.spinner', { html: SH.DALLAH_TOP, style: { transition: late ? 'none' : '', transform: `rotate(${late ? rot : 0}deg)` } });
          ui.seats = s.who.map((id, i) => { const a = (i / n) * Math.PI * 2; return h('div.seat', { style: { '--c': R.colorOf(id), left: 50 + 40 * Math.sin(a) + '%', top: 50 - 42 * Math.cos(a) + '%' } }, R.nameOf(id)); });
          ui.arena = h('div.arena', ui.seats, spinner);
          if (!late) requestAnimationFrame(() => requestAnimationFrame(() => { spinner.style.transform = `rotate(${rot}deg)`; }));
          ui.fast = () => { if (!ui.spun && R.now() - s.at >= SPIN) { ui.spun = true; Sound.play('good'); buzz([40, 30, 120]); R.render(); } };
        }
        if (ui.spun) ui.seats[idx].classList.add('on');
        return [ui.arena,
          !ui.spun ? h('p.muted.center', 'الدلّة تدور…')
            : mine ? (ui.sent ? h('p.muted.center', 'لحظة…') : [h('p.center', h('b', { style: { color: 'var(--accent)', fontSize: '20px' } }, 'وقفت عليك! '), 'وش تختار؟'),
              h('div.row', h('button.btn.btn-gold', { type: 'button', onclick() { R.send('truth'); } }, '🗣️ صراحة'), h('button.btn.btn-fire', { type: 'button', onclick() { R.send('dare'); } }, '🎯 تحدّي'))])
              : h('p.center', h('b', { style: { color: 'var(--accent)', fontSize: '20px' } }, name), ' يختار: صراحة ولا تحدّي؟'),
          h('div.spacer'), mine ? null : R.hostBtn('ندوّر مرة ثانية', () => dallah.again(R), '.btn-ghost')];
      }
      return [h('div.turn', { style: { '--c': R.colorOf(s.target) } }, h('p.eyebrow', 'الدور على'), h('div.who', name)),
        h('div.prompt.grow', h('span.tag', s.kind === 'truth' ? '🗣️ صراحة' : '🎯 تحدّي'), s.text),
        h('p.muted.center.small', 'اللي ما يجاوب أو ما ينفّذ: يصبّ القهوة للكل 😄'),
        mine ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', disabled: ui.sent != null, onclick() { R.send('done'); } }, 'تم ✅ دوّروا الدلّة')
          : R.hostBtn('الدور الجاي', () => dallah.again(R), '.btn-ghost')];
    },
  };
  SH.onlineGame(dallah);
})();

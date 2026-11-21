/* الفطاحلة — تحدّي معلومات بين الفرق */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle, pick, Store } = SH;

  const LEVELS = [
    [1, '🙂', 'سهل', '#2FD08A', '#169B62', '#06281A'],
    [2, '😎', 'وسط', '#FFC83D', '#C98F0A', '#33230A'],
    [3, '🔥', 'صعب', '#FF5C6C', '#C7323F', '#3A0610'],
  ];

  function run(ctx, cfg) {
    const T = SH.TRIVIA;
    const teams = cfg.teams;
    teams.forEach((t) => { t.half = true; t.dbl = true; });
    const used = new Set(Store.get('trivia:used', []));
    let round = 1, turn = 0;
    const golden = () => cfg.rounds > 1 && round === cfg.rounds;

    function draw(cat, lvl) {
      const all = T.q[cat].map((q, i) => ({ q, key: cat + ':' + i }));
      let pool = all.filter((x) => !used.has(x.key));
      if (!pool.length) { all.forEach((x) => used.delete(x.key)); pool = all; }
      const same = pool.filter((x) => x.q[0] === lvl);
      const x = pick(same.length ? same : pool);
      used.add(x.key); Store.set('trivia:used', [...used]);
      return x.q;
    }

    const head = () => [
      h('div.hud', h('span.pill' + (golden() ? '.gold' : ''), golden() ? '✨ الجولة الذهبية: النقاط ×2' : `الجولة ${round} من ${cfg.rounds}`)),
      SH.scorebar(teams, turn),
    ];

    function pickCat() {
      const t = teams[turn];
      ctx.view(
        head(),
        h('div.turn', { style: { '--c': t.color } }, h('p.eyebrow', 'الدور على'), h('div.who', t.name), h('p.muted', 'اختاروا المجال')),
        h('div.tiles', T.cats.map(([id, e, name]) => h('button.pickt', { type: 'button', onclick() { Sound.play('pop'); pickLevel(id, e, name); } }, h('span.e', e), name)))
      );
    }

    function pickLevel(cat, e, name) {
      const t = teams[turn];
      let dbl = false;
      const mult = golden() ? 2 : 1;
      const dblBtn = t.dbl ? h('button.toggle', { type: 'button', 'aria-pressed': 'false', onclick() { dbl = !dbl; dblBtn.setAttribute('aria-pressed', String(dbl)); Sound.play('tap'); } },
        h('span.sw'), h('span', '✖️2 ورقة الدبل', h('small', 'الصح يتضاعف والغلط يخصم. مرة وحدة في اللعبة.'))) : null;
      ctx.view(
        head(),
        h('div.turn', { style: { '--c': t.color } }, h('p.eyebrow', e + ' ' + name), h('div.big', 'على كم تجرؤون؟')),
        h('div.tiles.three', LEVELS.map(([lvl, em, label, c, c2, ci]) => h('button.pickt.lvl', { type: 'button', style: { '--c': c, '--c2': c2, '--ci': ci }, onclick() { Sound.play('pop'); ask(cat, e, name, lvl, dbl); } },
          h('span.e', em), h('b', String(lvl * 100 * mult)), h('small', label)))),
        dblBtn,
        h('div.spacer'),
        h('button.btn.btn-ghost', { type: 'button', onclick() { Sound.play('tap'); pickCat(); } }, 'نغيّر المجال')
      );
    }

    function ask(cat, e, name, lvl, dbl) {
      const t = teams[turn];
      if (dbl) t.dbl = false;
      const q = draw(cat, lvl);
      const right = q[2], wrongs = q.slice(3, 6), note = q[6];
      const base = lvl * 100 * (golden() ? 2 : 1);
      let answering = turn, stealing = false, done = false;

      const banner = h('div.turn', { style: { '--c': t.color } });
      const paintBanner = () => {
        const a = teams[answering];
        banner.style.setProperty('--c', a.color);
        banner.replaceChildren(h('p.eyebrow', stealing ? '⚡ فرصة سرقة بنص النقاط' : `${e} ${name} · ${dbl ? base * 2 : base} نقطة${dbl ? ' (دبل)' : ''}`), h('div.who', { style: { fontSize: '28px' } }, a.name));
      };
      const letters = ['أ', 'ب', 'ج', 'د'];
      const opts = h('div.opts');
      const btns = shuffle([right].concat(wrongs)).map((txt, k) => {
        const b = h('button.opt', { type: 'button', onclick() { choose(txt, b); } }, h('span.k', letters[k]), h('span', txt));
        b.dataset.v = txt; return b;
      });
      opts.append(...btns);
      const after = h('div', { style: { display: 'grid', gap: '12px' } });
      const timerSlot = h('div');
      let tm = null;
      const startTimer = (s) => { if (tm) tm.stop(); tm = SH.timer(ctx, s, { onEnd() { choose(null, null); } }); timerSlot.replaceChildren(tm.el); tm.start(); };

      const halfBtn = t.half ? h('button.btn.btn-sm', { type: 'button', onclick() {
        if (done || stealing) return;
        t.half = false; halfBtn.remove(); Sound.play('flip');
        shuffle(btns.filter((b) => b.dataset.v !== right)).slice(0, 2).forEach((b) => b.classList.add('dim'));
      } }, '✂️ حذف إجابتين') : null;

      function finish(msg, good) {
        done = true; tm.stop(); opts.classList.add('locked');
        btns.forEach((b) => { if (b.dataset.v === right) b.classList.add('right'); else if (!b.classList.contains('wrong')) b.classList.add('dim'); });
        if (halfBtn) halfBtn.remove();
        Sound.play(good ? 'good' : 'bad'); buzz(good ? 30 : 140);
        after.append(
          h('div.note', h('b', msg + ' '), note || `الجواب: ${right}.`),
          h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); next(); } }, 'التالي'));
        scoreSlot.replaceChildren(SH.scorebar(teams, answering));
        after.lastChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      function choose(txt, btn) {
        if (done) return;
        if (txt === right) {
          const gain = stealing ? base / 2 : dbl ? base * 2 : base;
          teams[answering].score += gain;
          return finish(`كفو يا ${teams[answering].name}! +${gain}`, true);
        }
        if (btn) btn.classList.add('wrong');
        if (!stealing) {
          if (dbl) t.score -= base;
          if (teams.length > 1) {
            stealing = true; answering = (turn + 1) % teams.length;
            Sound.play('bad'); buzz(140);
            if (halfBtn) halfBtn.remove();
            paintBanner(); scoreSlot.replaceChildren(SH.scorebar(teams, answering));
            startTimer(15);
            return;
          }
        }
        finish(txt === null ? 'خلص الوقت!' : 'ما ضبطت!', false);
      }

      const scoreSlot = h('div', SH.scorebar(teams, turn));
      paintBanner();
      ctx.view(
        h('div.hud', timerSlot, banner, halfBtn || h('span')),
        scoreSlot,
        h('div.prompt', q[1]),
        opts, after
      );
      startTimer(30);
    }

    function next() {
      turn++;
      if (turn >= teams.length) { turn = 0; round++; }
      if (round > cfg.rounds) return ctx.results({ rows: teams, unit: '', award: (w, tie) => (tie ? 'فطاحلة كلكم 🧠' : 'فطاحلة السهرة 🧠') });
      if (turn === 0 && golden()) {
        Sound.play('reveal');
        ctx.view(h('div.pass', h('span.phone', { style: { animation: 'bob 2s ease-in-out infinite' } }, '✨'), h('div.big', 'الجولة الذهبية'), h('p.muted', 'آخر جولة وكل النقاط مضاعفة. اللي ورا يقدر يقلبها!')),
          h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); pickCat(); } }, 'يلا'));
        return;
      }
      pickCat();
    }

    pickCat();
  }

  SH.add({
    id: 'trivia', name: 'الفطاحلة', emoji: '🧠', color: 'green',
    tagline: 'تحدّي معلومات بين الفرق: ديرتنا، كورتنا، أكلاتنا وأكثر.',
    players: 'فريقين إلى 4', time: '15 د', moods: ['brain'],
    how: [
      'كل فريق بدوره يختار المجال ومستوى الجرأة: سهل 100، وسط 200، صعب 300.',
      'جاوبوا قبل ما يخلص الوقت. إذا غلطتوا، الفريق اللي بعدكم له فرصة سرقة بنص النقاط.',
      'الجولة الأخيرة ذهبية وكل نقاطها مضاعفة، فلا أحد يستسلم بدري.',
    ],
    start(ctx) {
      ctx.intro({
        setup: 'teams', min: 2, max: 4,
        options: [{ key: 'rounds', label: 'كم جولة؟', choices: [[3, '3 جولات'], [5, '5 جولات'], [7, '7 جولات']], def: 5 }],
        onStart: (cfg) => run(ctx, cfg),
      });
    },
  });
})();

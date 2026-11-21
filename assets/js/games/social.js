/* لو خيّروك · مين فينا؟ · دوّر الدلّة */
(function () {
  'use strict';
  const { h, Sound, buzz, rnd } = SH;

  /* ---------- لو خيّروك ---------- */
  const DUO = [['#2F74E8', '#1C52B4', '#fff'], ['#F58A1F', '#C4620A', '#2A1505'], ['#0C8058', '#075A3D', '#fff'], ['#CF2F38', '#9C1A26', '#fff'], ['#6C4CE6', '#4A2FB8', '#fff'], ['#FFC83D', '#D29A0C', '#33230A']];

  function wyr(ctx) {
    const deck = SH.deck('wyr', SH.WYR);
    let n = 0;
    (function show() {
      n++;
      const pair = deck.next();
      const sides = Math.random() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
      const ci = rnd(DUO.length); const cols = [DUO[ci], DUO[(ci + 1 + rnd(DUO.length - 1)) % DUO.length]];
      const votes = [0, 0]; let done = false;
      const footer = h('div', { style: { display: 'grid', gap: '12px' } });
      const mk = (i) => {
        const tray = h('span.votes');
        const b = h('button.wyr-opt', { type: 'button', style: { '--c': cols[i][0], '--c2': cols[i][1], '--ci': cols[i][2] }, onclick() {
          if (done) return; votes[i]++; tray.append('🙋'); Sound.play('pop'); buzz(15);
        } }, h('span.fill'), h('span', sides[i]), tray);
        return { b, tray };
      };
      const A = mk(0), B = mk(1);
      const box = h('div.wyr', A.b, h('span.wyr-or', 'ولا'), B.b);
      const revealBtn = h('button.btn.btn-primary', { type: 'button', onclick: reveal }, 'اكشف النتيجة');
      const undo = h('button.btn.btn-ghost', { type: 'button', onclick() { votes[0] = votes[1] = 0; A.tray.replaceChildren(); B.tray.replaceChildren(); Sound.play('tap'); } }, '↩ نعيد التصويت');

      function reveal() {
        const total = votes[0] + votes[1];
        if (!total) { SH.toast('كل واحد يضغط على اختياره أول'); return; }
        done = true; box.classList.add('done'); Sound.play('reveal');
        [A, B].forEach((s, i) => {
          const pct = votes[i] / total;
          s.b.style.setProperty('--pct', String(pct));
          s.tray.replaceChildren(h('span.pct', Math.round(pct * 100) + '%'));
        });
        const min = Math.min(votes[0], votes[1]);
        const verdict = votes[0] === votes[1] ? 'تعادل! الجلسة منقسمة نصّين 🔥 كل فريق يقنع الثاني.'
          : min === 0 ? 'إجماع! ما فيه نقاش 😄'
            : `الأقلية (${min}) تدافع عن رأيها! عندكم 30 ثانية تقنعون الباقين ⏱️`;
        footer.replaceChildren(h('div.note', verdict), h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); show(); } }, 'السؤال التالي'));
      }

      footer.append(h('div.row', undo, revealBtn));
      ctx.view(
        h('div.hud', h('span.pill', 'سؤال ' + n), h('span.muted.small', 'كل واحد يضغط على اختياره')),
        h('div.center.big', 'لو خيّروك…'),
        box, footer
      );
    })();
  }

  SH.add({
    id: 'wyr', name: 'لو خيّروك', emoji: '🤔', color: 'pink',
    tagline: 'خيارين أحلاهم مرّ. كل واحد يختار، والأقلية تدافع!',
    players: '2 وأكثر', time: 'مفتوح', moods: ['talk', 'duo', 'kids'],
    how: [
      'يطلع لكم خيارين. كل واحد يضغط على اللي يختاره، ومرّروا الجوال.',
      'اكشفوا النتيجة وشوفوا الجلسة مع مين.',
      'الأقلية تدافع عن اختيارها في 30 ثانية. ومنها تبدأ السوالف!',
    ],
    start(ctx) { ctx.intro({ startLabel: 'يلا نختار', onStart: () => wyr(ctx) }); },
  });

  /* ---------- مين فينا؟ ---------- */
  function whois(ctx, cfg) {
    const players = cfg.players;
    players.forEach((p) => { p.won = []; });
    const deck = SH.deck('whois', SH.WHOIS);
    const own = SH.shuffle(SH.mine().whois);   /* أسئلة العائلة تطلع بالتناوب مع الباقي */
    let i = 0;

    function ask() {
      const text = own.length && i % 2 === 0 ? own.pop() : deck.next();
      const card = () => h('div.prompt', h('span.tag', 'مين فينا أكثر واحد…'), text + '؟');
      ctx.view(
        h('div.hud', h('span.pill', `سؤال ${i + 1} من ${cfg.n}`)),
        card(),
        h('p.muted.center', 'فكّروا بدون ما تتكلمون. مع العدّ، الكل يأشّر على شخص واحد!'),
        h('div.spacer'),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() {
          SH.countdown(ctx, ['3', '2', '1', '👉'], () => {
            buzz(60);
            ctx.view(
              card(),
              h('div.center.big', 'مين أخذ أكثر أصابع؟'),
              h('div.votes-grid', players.map((p) => h('button.vote', { type: 'button', style: { '--c': p.color }, onclick() { p.score++; p.won.push(text); Sound.play('good'); next(); } }, p.name))),
              h('button.btn.btn-ghost', { type: 'button', onclick() { Sound.play('tap'); next(); } }, 'تعادل، ولا أحد')
            );
          });
        } }, 'جاهزين؟ عدّوا وأشّروا 👉')
      );
    }
    function next() {
      i++;
      if (i < cfg.n) return ask();
      ctx.results({
        rows: players.map((p) => Object.assign(p, { sub: p.won.length ? 'اللي ' + p.won[0] : 'طلع منها سليم 😇' })),
        unit: '', kicker: SH.dayNight('نجم العصرية', 'نجم السهرة'), icon: '🌟',
        award: (w) => (w.won.length ? 'اللي ' + w.won[w.won.length - 1] : 'الكل سليم'),
      });
    }
    ask();
  }

  SH.add({
    id: 'whois', name: 'مين فينا؟', emoji: '👉', color: 'sky',
    tagline: 'مين فينا أكثر واحد يتأخر؟ عدّوا ثلاثة وأشّروا!',
    players: '3 إلى 12', time: '10 د', moods: ['talk', 'laugh'],
    how: [
      'يطلع سؤال «مين فينا أكثر واحد…؟» وكل واحد يفكّر بصمت.',
      'مع العدّ 3، 2، 1 الكل يأشّر بإصبعه على شخص واحد في نفس اللحظة.',
      'اللي ياخذ أكثر أصابع ينحسب عليه السؤال، وفي النهاية كل واحد ياخذ لقبه.',
    ],
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 3, max: 12,
        options: [{ key: 'n', label: 'كم سؤال؟', choices: [[8, '8'], [12, '12'], [16, '16']], def: 12 }],
        onStart: (cfg) => whois(ctx, cfg),
      });
    },
  });

  /* ---------- دوّر الدلّة ---------- */
  const TOP = '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="dtop" cx=".38" cy=".34"><stop offset="0" stop-color="#FFEDB0"/><stop offset=".6" stop-color="#FFB02E"/><stop offset="1" stop-color="#B56A06"/></radialGradient></defs><path d="M82 142c-8 34 44 34 36 0" fill="none" stroke="#B56A06" stroke-width="11" stroke-linecap="round"/><path d="M83 66C89 44 95 26 100 5c5 21 11 39 17 61z" fill="#FFC83D" stroke="#B56A06" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="100" r="46" fill="url(#dtop)" stroke="#B56A06" stroke-width="3"/><circle cx="100" cy="100" r="31" fill="none" stroke="#B56A06" stroke-width="3" opacity=".55"/><circle cx="100" cy="100" r="19" fill="#FFD25E" stroke="#B56A06" stroke-width="3"/><circle cx="100" cy="100" r="7" fill="#B56A06"/></svg>';

  function dallah(ctx, cfg) {
    const players = cfg.players;
    const n = players.length;
    players.forEach((p) => { p.turns = 0; });
    const truths = SH.deck('truth', SH.TRUTH), dares = SH.deck('dare', SH.DARE);
    const mine = SH.mine();
    const own = { truth: SH.shuffle(mine.truth), dare: SH.shuffle(mine.dare) };
    let rot = 0, last = -1;

    function arena(pointAt) {
      let busy = false;
      const spinner = h('div.spinner', { html: TOP, style: { transition: 'none', transform: `rotate(${rot}deg)` } });
      const seats = players.map((p, i) => {
        const a = (i / n) * Math.PI * 2;
        return h('div.seat' + (i === pointAt ? '.on' : ''), { style: { '--c': p.color, left: 50 + 40 * Math.sin(a) + '%', top: 50 - 42 * Math.cos(a) + '%' } }, p.name);
      });
      const btn = h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick: spin }, '🌀 دوّر الدلّة');
      const msg = h('p.center.muted', 'اللي توقف عليه الدلّة يختار: صراحة ولا تحدّي');

      function spin() {
        if (busy) return; busy = true; btn.disabled = true;
        seats.forEach((s) => s.classList.remove('on'));
        const least = Math.min(...players.map((p) => p.turns));
        let pool = players.map((_, i) => i).filter((i) => i !== last && players[i].turns <= least + 1);
        if (!pool.length) pool = players.map((_, i) => i).filter((i) => i !== last);
        const idx = pool[rnd(pool.length)];
        rot = Math.ceil(rot / 360) * 360 + 360 * (4 + rnd(3)) + (idx / n) * 360;
        spinner.style.transition = ''; void spinner.offsetWidth;
        spinner.style.transform = `rotate(${rot}deg)`;
        let gap = 60, t = 0;
        while (t < 3900) { ctx.timeout(() => Sound.play('tick'), t); gap *= 1.16; t += gap; }
        ctx.timeout(() => {
          last = idx; players[idx].turns++;
          seats[idx].classList.add('on'); Sound.play('good'); buzz([40, 30, 120]);
          msg.replaceChildren(h('b', { style: { color: 'var(--accent)', fontSize: '20px' } }, players[idx].name), ' وش تختار؟');
          btn.replaceWith(h('div.row',
            h('button.btn.btn-gold', { type: 'button', onclick() { Sound.play('pop'); card(idx, 'truth'); } }, '🗣️ صراحة'),
            h('button.btn.btn-fire', { type: 'button', onclick() { Sound.play('pop'); card(idx, 'dare'); } }, '🎯 تحدّي')));
        }, 4350);
      }

      ctx.view(h('div.arena', seats, spinner), msg, h('div.spacer'), btn);
    }

    function card(idx, kind) {
      const p = players[idx];
      let swapped = false;
      const slot = h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column' } });
      const draw = () => {
        const text = own[kind].length && Math.random() < 0.5 ? own[kind].pop() : (kind === 'truth' ? truths : dares).next();
        slot.replaceChildren(h('div.prompt.pop.grow', h('span.tag', kind === 'truth' ? '🗣️ صراحة' : '🎯 تحدّي'), text));
      };
      const swap = h('button.btn', { type: 'button', onclick() { if (swapped) return; swapped = true; swap.disabled = true; Sound.play('flip'); draw(); } }, '🔄 بدّلها (مرة وحدة)');
      draw();
      ctx.view(
        h('div.turn', { style: { '--c': p.color } }, h('p.eyebrow', 'الدور على'), h('div.who', p.name)),
        slot,
        h('p.muted.center.small', 'اللي ما يجاوب أو ما ينفّذ: يصبّ القهوة للكل 😄'),
        h('div.row', swap, h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); arena(idx); } }, 'تم ✅ الدور الجاي'))
      );
    }

    arena(-1);
  }

  SH.add({
    id: 'dallah', name: 'دوّر الدلّة', emoji: '🫖', color: 'sand',
    tagline: 'الدلّة تدور وتوقف على واحد: صراحة ولا تحدّي؟',
    players: '2 إلى 10', time: 'مفتوح', moods: ['talk', 'laugh'],
    how: [
      'اجلسوا دائرة ودوّروا الدلّة. اللي يوقف عنده مصبّ الدلّة هو صاحب الدور.',
      'يختار «صراحة» ويجاوب بصدق، أو «تحدّي» وينفّذه قدام الكل.',
      'اللي يرفض يصبّ القهوة للجلسة كلها. كل الأسئلة نظيفة ومناسبة للعائلة.',
    ],
    start(ctx) { ctx.intro({ setup: 'players', min: 2, max: 10, onStart: (cfg) => dallah(ctx, cfg) }); },
  });
})();

/* تطابق · مبارزة الصقر */
(function () {
  'use strict';
  const { h, Sound, buzz, rnd, shuffle, pick, Store } = SH;

  /* ---------- تطابق ---------- */
  function memory(ctx, cfg) {
    const players = cfg.players;
    const solo = players.length === 1;
    const pairs = cfg.size / 2;
    const icons = shuffle(SH.MEMORY).slice(0, pairs);
    const cards = shuffle(icons.concat(icons));
    let open = [], lock = false, turn = 0, found = 0, moves = 0;
    const t0 = performance.now();
    const head = h('div');
    const paintHead = () => head.replaceChildren(solo
      ? h('div.hud', h('span.pill', `المحاولات ${moves}`), h('span.pill.gold', `${found} من ${pairs}`))
      : SH.scorebar(players, turn));

    const board = h('div.mem' + (cfg.size > 16 ? '.wide' : ''), cards.map((ic) => {
      const el = h('button.mcard', { type: 'button', 'aria-label': 'بطاقة', onclick() { flip(el, ic); } },
        h('span.mcard-in', h('span.mface.mback'), h('span.mface.mfront', h('span.e', ic[0]), ic[1])));
      return el;
    }));

    function flip(el, ic) {
      if (lock || el.classList.contains('up')) return;
      el.classList.add('up'); Sound.play('flip');
      open.push({ el, ic });
      if (open.length < 2) return;
      moves++;
      const [a, b] = open; open = [];
      if (a.ic === b.ic) {
        a.el.classList.add('done'); b.el.classList.add('done');
        players[turn].score++; found++; Sound.play('good'); buzz(30); paintHead();
        if (found === pairs) ctx.timeout(finish, 900);
      } else {
        lock = true;
        ctx.timeout(() => {
          a.el.classList.remove('up'); b.el.classList.remove('up'); Sound.play('tap');
          turn = (turn + 1) % players.length; lock = false; paintHead();
        }, 950);
      }
    }

    function finish() {
      if (!solo) return ctx.results({ rows: players, award: 'ذاكرة فيل 🐘' });
      const secs = Math.round((performance.now() - t0) / 1000);
      const key = 'memory:best:' + cfg.size;
      const best = Store.get(key, null);
      const record = best == null || moves < best;
      if (record) Store.set(key, moves);
      ctx.results({
        rows: players, icon: record ? '🏆' : '👏',
        kicker: `عدد المحاولات: ${moves} · الوقت: ${secs} ث`,
        headline: record ? 'رقم قياسي جديد!' : 'كفو!',
        award: record ? null : `أفضل رقم لك: ${best}`,
      });
    }

    paintHead();
    ctx.view(head, board, solo ? null : h('p.muted.center.small', 'اللي يلقى زوج يلعب مرة ثانية'));
  }

  SH.add({
    id: 'memory', name: 'تطابق', emoji: '🃏', color: 'pink',
    tagline: 'اقلب البطاقات ولقّ الأزواج: جمل، دلّة، صقر ونخلة.',
    players: '1 إلى 4', time: '5 د', moods: ['kids', 'duo', 'brain'],
    how: [
      'اقلب بطاقتين. إذا تطابقوا تاخذ نقطة وتلعب مرة ثانية.',
      'إذا ما تطابقوا يرجعون مقلوبين والدور للّي بعدك، فركّز وين كانت كل بطاقة.',
      'اللي يجمع أكثر أزواج يفوز. وتقدر تلعبها لحالك وتكسر رقمك.',
    ],
    science: 'قوانينها تنفهم من أول قلبة، فهي أحسن لعبة تجمع طفل عمره خمس سنين مع جدّه. والصغار غالباً يغلبون الكبار فيها، وهذا يعطيهم ثقة.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 1, max: 4, setupLabel: 'اللاعبين (1 إلى 4)',
        options: [{ key: 'size', label: 'حجم اللوحة', choices: [[12, '12 بطاقة'], [16, '16 بطاقة'], [20, '20 بطاقة'], [24, '24 بطاقة']], def: 16 }],
        onStart: (cfg) => memory(ctx, cfg),
      });
    },
  });

  /* ---------- مبارزة الصقر ---------- */
  const DECOYS = ['🐓', '🦉', '🐪', '🦆', '🐈', '🦜', '🐧'];

  function duel(ctx, cfg) {
    const players = cfg.players;
    const scores = [0, 0];
    let phase = 'pause', t0 = 0, pending = null, decoysShown = 0;

    const mk = (i) => {
      const sym = h('div.sym'), msg = h('div.msg', 'اضغط أول ما تشوف الصقر 🦅'), pts = h('div.pts', '0');
      const el = h('div.zone' + (i === 1 ? '.top' : ''), { style: { '--c': i === 0 ? '#1C52B4' : '#B3262E' } }, h('div.nm', players[i].name), pts, sym, msg);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(i); });
      return { el, sym, msg, pts };
    };
    const Z = [mk(0), mk(1)];
    const closeBtn = h('button.duel-x', { type: 'button', 'aria-label': 'خروج', onclick() { ctx.home(); } }, '✕');
    const mid = h('div.duel-mid', closeBtn);
    const wrap = h('div.duel', Z[1].el, mid, Z[0].el);
    closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(wrap);
    ctx.onCleanup(() => wrap.remove());

    const setSym = (s) => Z.forEach((z) => { z.sym.textContent = s; z.sym.classList.remove('in'); if (s) { void z.sym.offsetWidth; z.sym.classList.add('in'); } });
    const setMsg = (a, b) => { Z[0].msg.textContent = a; Z[1].msg.textContent = b == null ? a : b; };
    const later = (fn, ms) => { if (pending) ctx.clear(pending); pending = ctx.timeout(fn, ms); };

    function wait() {
      phase = 'idle'; decoysShown = 0;
      Z.forEach((z) => z.el.classList.remove('win', 'lose'));
      setSym(''); setMsg('استعد…');
      later(show, 1100 + rnd(1700));
    }
    function show() {
      const isTarget = Math.random() < 0.38 + decoysShown * 0.2;
      if (isTarget) {
        phase = 'target'; t0 = performance.now(); setSym('🦅'); Sound.play('pop');
        later(() => { phase = 'pause'; setSym(''); setMsg('طار الصقر وما أحد لحقه 😅'); later(wait, 1300); }, 1700);
      } else {
        phase = 'decoy'; decoysShown++; setSym(pick(DECOYS)); Sound.play('tock');
        later(() => { phase = 'idle'; setSym(''); later(show, 500 + rnd(1300)); }, 800);
      }
    }
    function tap(i) {
      if (phase === 'pause') return;
      if (phase === 'target') {
        const ms = Math.round(performance.now() - t0);
        point(i, `أسرع يد! ${ms} ملّي ثانية ⚡`, 'سبقك! 😬');
      } else {
        point(1 - i, phase === 'decoy' ? 'خصمك حسبه صقر 😂' : 'خصمك استعجل!', phase === 'decoy' ? 'هذا مو صقر! 😂' : 'استعجلت! ✋');
      }
    }
    function point(w, winMsg, loseMsg) {
      phase = 'pause'; if (pending) ctx.clear(pending);
      scores[w]++; Z[w].pts.textContent = String(scores[w]);
      Z[w].el.classList.add('win'); Z[1 - w].el.classList.add('lose');
      Z[w].msg.textContent = winMsg; Z[1 - w].msg.textContent = loseMsg;
      Sound.play('good'); buzz(50);
      if (scores[w] >= cfg.to) {
        later(() => {
          wrap.remove();
          players[0].score = scores[0]; players[1].score = scores[1];
          ctx.results({ rows: players, award: 'عين الصقر 🦅' });
        }, 1500);
      } else later(wait, 1700);
    }

    ctx.view(h('div.pass', h('div.big', 'المبارزة شغّالة…')));
    wait();
  }

  SH.add({
    id: 'duel', name: 'مبارزة الصقر', emoji: '🦅', color: 'red',
    tagline: 'وجه لوجه على جوال واحد: مين أسرع يد لما يطلع الصقر؟',
    players: 'لاعبين', time: '3 د', moods: ['duo', 'kids', 'laugh'],
    how: [
      'حطّوا الجوال بينكم على الطاولة، وكل واحد له نص الشاشة.',
      'أول ما يطلع الصقر 🦅 اضغط على نصّك. الأسرع ياخذ النقطة.',
      'انتبه! لو ضغطت بدري أو على حيوان ثاني (ديك، بومة، جمل) تروح النقطة لخصمك.',
    ],
    science: 'جولة مدتها ثواني ونتيجتها فورية، فتدمن عليها. والحيوانات المخادعة تضيف اختبار ضبط نفس، مو بس سرعة، فتتساوى الفرص بين الصغير والكبير.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 2, max: 2, setupLabel: 'المتبارزين',
        options: [{ key: 'to', label: 'الفوز من كم نقطة؟', choices: [[3, '3'], [5, '5'], [7, '7']], def: 5 }],
        onStart: (cfg) => duel(ctx, cfg),
      });
    },
  });
})();

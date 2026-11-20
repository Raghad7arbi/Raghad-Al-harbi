/* القنبلة · فكّ الإيموجي · كم تتوقع؟ · إنسان حيوان جماد */
(function () {
  'use strict';
  const { h, Sound, buzz, rnd, shuffle } = SH;

  /* ---------- القنبلة ---------- */
  function bomb(ctx, cfg) {
    const players = cfg.players;
    players.forEach((p) => { p.lives = cfg.lives; p.out = false; p.score = 0; });
    const deck = SH.deck('bomb', SH.BOMB);
    let roundNo = 0, starter = rnd(players.length);
    const alive = () => players.filter((p) => !p.out);
    const hearts = () => h('div.scores', players.map((p) => h('div.score' + (p.out ? '.out' : ''), { style: { '--c': p.color } }, h('i'), h('span', p.name), h('span.hearts', p.out ? '💀' : '❤️'.repeat(p.lives)))));

    function intro() {
      roundNo++;
      const prompt = deck.next();
      do { starter = (starter + 1) % players.length; } while (players[starter].out);
      ctx.view(
        h('div.hud', h('span.pill', 'الجولة ' + roundNo), h('span.pill', `الباقين: ${alive().length}`)),
        hearts(),
        h('div.prompt', h('span.tag', 'كل واحد يقول'), h('span.word', { style: { fontSize: 'clamp(32px, 9vw, 52px)' } }, prompt), h('span.small', 'ممنوع التكرار وممنوع التأخير')),
        h('p.center', 'يبدأ ', h('b', { style: { color: players[starter].color, fontSize: '20px' } }, players[starter].name), ' ثم مرّروا الجوال باتجاه اليمين'),
        h('div.spacer'),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { play(prompt); } }, '🔥 شعّل الفتيل')
      );
    }

    function play(prompt) {
      Sound.play('reveal');
      const total = 14000 + rnd(26000);
      const t0 = performance.now();
      let count = 0;
      const countEl = h('b', '0');
      const wrap = h('div.bomb-wrap.danger-bg', h('div.bomb', '💣'));
      const view = ctx.view(
        h('div.prompt', { style: { minHeight: '0', padding: '14px 16px 36px' } }, h('span.tag', 'قولوا'), prompt),
        wrap,
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { count++; countEl.textContent = String(count); Sound.play('pop'); buzz(15); } }, 'قلتها، مرّر! ', h('span.small', '(', countEl, ')'))
      );
      (function tick() {
        const p = (performance.now() - t0) / total;
        if (p >= 1) return boom(view);
        const gap = 820 - 640 * p;
        wrap.style.setProperty('--beat', Math.max(0.16, gap / 1000) + 's');
        Sound.play(p > 0.75 ? 'tick' : 'tock');
        ctx.timeout(tick, gap);
      })();
    }

    function boom(view) {
      Sound.play('boom'); buzz([300, 80, 300]);
      view.replaceChildren(h('div.bomb-wrap.shake', h('div.boom', '💥'), h('div.huge', 'بووووم!')));
      ctx.timeout(() => {
        ctx.view(
          h('div.center', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '💥'), h('div.big', 'عند مين انفجرت؟')),
          h('div.votes-grid', alive().map((p) => h('button.vote', { type: 'button', style: { '--c': p.color }, onclick() { hit(p); } }, p.name)))
        );
      }, 1500);
    }

    function hit(p) {
      Sound.play('bad');
      p.lives--;
      alive().forEach((x) => { if (x !== p) x.score++; });
      if (p.lives <= 0) { p.out = true; SH.toast(`${p.name} طلع من اللعبة 💀`); }
      const left = alive();
      if (left.length <= 1) {
        return ctx.results({ rows: players.map((x) => Object.assign(x, { sub: x.out ? 'انفجرت فيه' : 'نجا للنهاية' })), headline: left[0] ? left[0].name : null, award: 'أعصاب من حديد 💣' });
      }
      intro();
    }

    intro();
  }

  SH.add({
    id: 'bomb', name: 'القنبلة', emoji: '💣', color: 'night',
    tagline: 'قل جواب ومرّر الجوال بسرعة… قبل ما تنفجر في يدك!',
    players: '3 إلى 10', time: '10 د', moods: ['laugh', 'kids'],
    how: [
      'تطلع فئة مثل «أكلة سعودية». اللي معه الجوال يقول جواب جديد ويمرّره للّي جنبه.',
      'القنبلة تنفجر في وقت عشوائي ما أحد يعرفه. ممنوع تكرار جواب انقال.',
      'اللي تنفجر في يده يخسر قلب. آخر واحد يبقى هو الفايز.',
    ],
    science: 'الوقت المخفي يصنع توتر ممتع يتصاعد مع صوت التكتكة، وكل لاعب مشارك في كل ثانية فما فيه انتظار ممل.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 3, max: 10,
        options: [{ key: 'lives', label: 'كم قلب لكل لاعب؟', choices: [[1, '❤️'], [2, '❤️❤️'], [3, '❤️❤️❤️']], def: 2 }],
        onStart: (cfg) => bomb(ctx, cfg),
      });
    },
  });

  /* ---------- فكّ الإيموجي ---------- */
  function emoji(ctx, cfg) {
    const teams = cfg.teams;
    const deck = SH.deck('emoji', SH.EMOJI);
    let i = 0;

    function puzzle() {
      const [emo, answer, type] = deck.next();
      let open = false;
      const after = h('div', { style: { display: 'grid', gap: '12px' } });
      const revealBtn = h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { reveal(); } }, 'اكشف الجواب');
      const tm = SH.timer(ctx, cfg.time, { onEnd() { reveal(); } });
      function reveal() {
        if (open) return; open = true; tm.stop(); Sound.play('reveal');
        revealBtn.remove();
        after.append(
          h('div.note', h('b', 'الجواب: '), answer),
          h('p.center.label', 'مين قالها أول؟'),
          h('div.votes-grid', teams.map((t) => h('button.vote', { type: 'button', style: { '--c': t.color }, onclick() { t.score++; Sound.play('good'); buzz(25); next(); } }, t.name))),
          h('button.btn.btn-ghost', { type: 'button', onclick() { Sound.play('tap'); next(); } }, 'ما أحد عرفها')
        );
        after.lastChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      ctx.view(
        h('div.hud', tm.el, h('span.pill', `لغز ${i + 1} من ${cfg.n}`)),
        SH.scorebar(teams, -1),
        h('div.prompt.pop', h('span.tag', type), h('span.emo', emo)),
        h('p.muted.center.small', 'أول فريق يصرخ بالجواب الصح ياخذ النقطة'),
        revealBtn, after
      );
      tm.start();
    }
    function next() {
      i++;
      if (i < cfg.n) puzzle(); else ctx.results({ rows: teams, award: 'خبراء الإيموجي 😎' });
    }
    puzzle();
  }

  SH.add({
    id: 'emoji', name: 'فكّ الإيموجي', emoji: '🧩', color: 'violet',
    tagline: 'أمثال وأكلات ومعالم سعودية مكتوبة بالإيموجي. مين يفكّها أول؟',
    players: 'فريقين إلى 4', time: '10 د', moods: ['brain', 'laugh', 'kids'],
    how: [
      'يطلع لغز بالإيموجي: مثل شعبي، أكلة، مدينة أو شي من يومياتنا.',
      'أول فريق يصرخ بالجواب الصح ياخذ النقطة. ما فيه أدوار، الكل يلعب مع بعض.',
      'إذا خلص الوقت ينكشف الجواب وتمشون للّي بعده.',
    ],
    science: 'لحظة «آها!» لما تنفكّ الشفرة من ألذّ مشاعر اللعب، واللعب في نفس الوقت يخلّي كل الجلسة مشدودة بدون انتظار دور.',
    start(ctx) {
      ctx.intro({
        setup: 'teams', min: 2, max: 4,
        options: [
          { key: 'n', label: 'كم لغز؟', choices: [[8, '8'], [12, '12'], [16, '16']], def: 12 },
          { key: 'time', label: 'وقت اللغز', choices: [[20, '20 ثانية'], [30, '30 ثانية'], [45, '45 ثانية']], def: 30 },
        ],
        onStart: (cfg) => emoji(ctx, cfg),
      });
    },
  });

  /* ---------- كم تتوقع؟ ---------- */
  const fmt = (n) => (n >= 10000 ? n.toLocaleString('en-US') : String(n));

  function guess(ctx, cfg) {
    const players = cfg.players;
    const deck = SH.deck('guess', SH.GUESS);
    let qi = 0, q, guesses;

    function question() {
      q = deck.next(); guesses = [];
      ctx.view(
        h('div.hud', h('span.pill', `سؤال ${qi + 1} من ${cfg.n}`)),
        SH.scorebar(players, -1),
        h('div.prompt', q[2] ? h('span.tag', 'الجواب بوحدة: ' + q[2]) : h('span.tag', 'الجواب رقم'), q[0]),
        h('p.muted.center', 'كل واحد يكتب توقّعه بالسر. الأقرب للرقم الصحيح يفوز.'),
        h('div.spacer'),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); enter(0); } }, 'نبدأ التوقّعات')
      );
    }

    function enter(pi) {
      const p = players[pi];
      ctx.pass(p.name, () => {
        let val = '';
        const num = h('span', '؟');
        const paint = () => { num.textContent = val === '' ? '؟' : fmt(Number(val)); };
        const press = (d) => { if (val.length < 7) { val = val === '0' ? d : val + d; Sound.play('tap'); paint(); } };
        ctx.view(
          h('div.turn', { style: { '--c': p.color } }, h('p.eyebrow', 'توقّع ' + p.name), h('p', q[0])),
          h('div.kp-screen', num, q[2] ? h('small', q[2]) : null),
          h('div.kp',
            ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { type: 'button', onclick() { press(d); } }, d)),
            h('button', { type: 'button', 'aria-label': 'مسح', onclick() { val = val.slice(0, -1); Sound.play('tap'); paint(); } }, '⌫'),
            h('button', { type: 'button', onclick() { press('0'); } }, '0'),
            h('button.go', { type: 'button', 'aria-label': 'اعتماد', onclick() {
              if (val === '') { SH.toast('اكتب رقم أول'); return; }
              guesses[pi] = Number(val); Sound.play('pop');
              pi + 1 < players.length ? enter(pi + 1) : reveal();
            } }, '✓'))
        );
      }, { kicker: 'توقّع سرّي، عطوا الجوال لـ', color: p.color, sub: 'لا تخلّي أحد يشوف رقمك' });
    }

    function reveal() {
      const ans = q[1];
      const rows = players.map((p, i) => ({ p, g: guesses[i], d: Math.abs(guesses[i] - ans) })).sort((a, b) => a.d - b.d);
      const best = rows[0].d;
      const second = rows.find((r) => r.d > best);
      rows.forEach((r) => {
        r.gain = r.d === best ? 3 + (r.d === 0 ? 2 : 0) : players.length >= 3 && second && r.d === second.d ? 1 : 0;
        r.p.score += r.gain;
      });
      const big = h('div.huge', { style: { color: 'var(--accent)', direction: 'ltr' } }, '0');
      const list = h('div', { style: { display: 'grid', gap: '8px' } });
      const nextBtn = h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', hidden: true, onclick() { Sound.play('pop'); qi++; qi < cfg.n ? question() : ctx.results({ rows: players, award: 'أدقّ توقّع 🎯' }); } }, qi + 1 < cfg.n ? 'السؤال التالي' : 'النتيجة');
      ctx.view(
        h('div.center', h('p.muted', q[0]), h('p.eyebrow', 'الجواب الصحيح'), big, q[2] ? h('p.label', q[2]) : null),
        list, h('div.spacer'), nextBtn
      );
      const t0 = performance.now(), dur = 1300;
      const roll = ctx.interval(() => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        big.textContent = fmt(Math.round(ans * (1 - Math.pow(1 - k, 3))));
        if (k < 1) { Sound.play('tick'); return; }
        ctx.clear(roll);
        Sound.play('good'); buzz(40);
        list.append(...rows.map((r, i) => h('div.guess-row' + (r.d === best ? '.win' : ''), { style: { '--i': i } },
          h('span.n', r.p.name, h('small', r.d === 0 ? ' · بالضبط! 🎯' : ` · الفرق ${fmt(r.d)}`)),
          h('span.v', fmt(r.g)), r.gain ? h('span.pill.gold', '+' + r.gain) : null)));
        nextBtn.hidden = false;
      }, 60);
    }

    question();
  }

  SH.add({
    id: 'guess', name: 'كم تتوقع؟', emoji: '🎯', color: 'green',
    tagline: 'كم ارتفاع برج المملكة؟ ما يحتاج تعرف، يكفي تكون الأقرب.',
    players: '2 إلى 8', time: '10 د', moods: ['brain', 'duo', 'kids'],
    how: [
      'يطلع سؤال جوابه رقم، مثل ارتفاع برج أو سنة حدث.',
      'كل لاعب أو فريق يكتب توقّعه بالسر ويمرّر الجوال.',
      'الأقرب للرقم الصحيح ياخذ 3 نقاط، والثاني نقطة، واللي يصيبها بالضبط له نقطتين زيادة.',
    ],
    science: 'في أسئلة التقدير ما أحد يعرف الجواب بالضبط، فالكل عنده فرصة يفوز حتى اللي معلوماته أقل. وهذا يخلّي المنافسة متقاربة وممتعة لكل الأعمار.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 2, max: 8, setupLabel: 'اللاعبين أو الفرق (2 إلى 8)',
        options: [{ key: 'n', label: 'كم سؤال؟', choices: [[5, '5'], [7, '7'], [10, '10']], def: 7 }],
        onStart: (cfg) => guess(ctx, cfg),
      });
    },
  });

  /* ---------- إنسان حيوان جماد ---------- */
  function letters(ctx, cfg) {
    const players = cfg.players;
    let round = 1;
    let pool = shuffle(SH.LETTERS);
    const cats = () => h('div.cats', SH.LETTER_CATS.map((c) => h('span', c)));

    function intro() {
      const slot = h('div.slot', '؟');
      const btn = h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() {
        btn.disabled = true;
        if (!pool.length) pool = shuffle(SH.LETTERS);
        const letter = pool.pop();
        slot.classList.add('roll');
        let k = 0;
        const roll = ctx.interval(() => {
          slot.textContent = SH.LETTERS[rnd(SH.LETTERS.length)]; Sound.play('tick'); k++;
          if (k > 20) {
            ctx.clear(roll); slot.classList.remove('roll'); slot.textContent = letter;
            Sound.play('good'); buzz([40, 40, 120]);
            ctx.timeout(() => play(letter), 1100);
          }
        }, 80);
      } }, '🎰 اسحب الحرف');
      ctx.view(
        h('div.hud', h('span.pill', `الجولة ${round} من ${cfg.rounds}`), h('span.pill', `⏱ ${cfg.time} ثانية`)),
        SH.scorebar(players, -1),
        slot,
        h('p.muted.center', 'جهّزوا الورقة والقلم. اكتبوا كلمة تبدأ بالحرف لكل خانة:'),
        cats(), h('div.spacer'), btn
      );
    }

    function play(letter) {
      const stop = () => { tm.stop(); Sound.play('end'); buzz([120, 60, 120]); score(letter); };
      const tm = SH.timer(ctx, cfg.time, { large: true, onEnd() { score(letter); } });
      ctx.view(
        h('div.hud', h('span.pill', `الجولة ${round} من ${cfg.rounds}`), h('span.pill.gold', 'حرف ' + letter)),
        h('div', { style: { display: 'grid', placeItems: 'center', gap: '4px' } }, h('div.slot', { style: { fontSize: 'clamp(90px, 28vw, 150px)' } }, letter), tm.el),
        cats(), h('div.spacer'),
        h('button.btn.btn-bad.btn-xl.btn-block', { type: 'button', onclick: stop }, '✋ خلّصت! وقّفوا')
      );
      tm.start();
    }

    function score(letter) {
      const add = players.map(() => 0);
      const rows = players.map((p, i) => {
        const val = h('b', '0');
        const bump = (d) => () => { add[i] = Math.max(0, add[i] + d); val.textContent = String(add[i]); Sound.play('tap'); };
        return h('div.tally', h('span.n', p.name),
          h('button', { type: 'button', 'aria-label': 'ناقص خمسة', onclick: bump(-5) }, '−5'), val,
          h('button', { type: 'button', onclick: bump(5) }, '+5'), h('button', { type: 'button', onclick: bump(10) }, '+10'));
      });
      ctx.view(
        h('div.center', h('p.eyebrow', 'حرف ' + letter), h('div.big', 'وقّفوا الأقلام!')),
        h('div.note', h('b', 'الحساب: '), 'جواب ما كتبه غيرك 10، جواب مكرّر 5، والخانة الفاضية أو الغلط صفر.'),
        h('div', { style: { display: 'grid', gap: '8px' } }, rows),
        h('div.spacer'),
        h('div.sticky-cta', h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() {
          players.forEach((p, i) => { p.score += add[i]; });
          Sound.play('pop'); round++;
          round > cfg.rounds ? ctx.results({ rows: players, award: 'قاموس يمشي 📚' }) : intro();
        } }, 'اعتمد النقاط'))
      );
    }

    intro();
  }

  SH.add({
    id: 'letters', name: 'إنسان حيوان جماد', emoji: '✍️', color: 'orange',
    tagline: 'لعبة الطيبين بثوب جديد: حرف عشوائي، وقت يمشي، وأقلام تتسابق.',
    players: '2 إلى 8', time: '15 د', moods: ['brain', 'kids', 'duo'],
    how: [
      'كل واحد معه ورقة وقلم. اسحبوا حرف عشوائي وابدأ الوقت.',
      'اكتبوا لكل خانة كلمة تبدأ بالحرف: اسم، حيوان، نبات، جماد، بلاد، أكلة، مهنة.',
      'أول واحد يخلّص يوقّف الكل. الجواب المميّز 10، والمكرّر 5.',
    ],
    science: 'لعبة يعرفها كل بيت، فما تحتاج شرح. الموقع ياخذ عنكم الأشياء المملّة (اختيار الحرف، الوقت، جمع النقاط) ويترك لكم المتعة.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 2, max: 8,
        options: [
          { key: 'time', label: 'وقت الجولة', choices: [[60, 'دقيقة'], [90, 'دقيقة ونص'], [120, 'دقيقتين']], def: 90 },
          { key: 'rounds', label: 'كم جولة؟', choices: [[3, '3'], [5, '5'], [7, '7']], def: 5 },
        ],
        onStart: (cfg) => letters(ctx, cfg),
      });
    },
  });
})();

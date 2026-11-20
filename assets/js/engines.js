/* شبّة — محرّكات مشتركة: لعب الفرق بالوقت، واختبار الاختيارات */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle } = SH;

  /* فريق يلعب ضد الوقت والبطاقات تتوالى (بدون كلام · لا تقولها)
     sp: { teams, time, rounds, draw(), render(card), label(card), penalty, roleHint, award } */
  SH.timedTeams = function (ctx, sp) {
    const teams = sp.teams;
    let round = 1, turn = 0;

    function turnIntro() {
      const t = teams[turn];
      ctx.view(
        h('div.hud', h('span.pill', `الجولة ${round} من ${sp.rounds}`), h('span.pill', `⏱ ${sp.time} ثانية`)),
        SH.scorebar(teams, turn),
        h('div.spacer'),
        h('div.turn', { style: { '--c': t.color } }, h('p.eyebrow', 'الدور على'), h('div.who', t.name), h('p.muted', sp.roleHint)),
        h('div.spacer'),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick: play }, 'جاهزين؟ ابدأ')
      );
    }

    function play() {
      Sound.play('pop');
      const t = teams[turn];
      const log = [];
      let card = null, skips = 3, pts = 0;
      const slot = h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column' } });
      const ptsEl = h('b', '0');
      const skipB = h('button.btn', { type: 'button', onclick() { if (skips > 0) mark('skip'); } }, '');
      const paintSkip = () => { skipB.textContent = `↷ تخطّي (${skips})`; skipB.disabled = skips <= 0; };
      const next = () => { card = sp.draw(); const node = sp.render(card); node.classList.add('pop', 'grow'); slot.replaceChildren(node); };
      const mark = (kind) => {
        log.push([sp.label(card), kind]);
        if (kind === 'ok') { pts++; Sound.play('good'); buzz(25); }
        else if (kind === 'bad') { pts--; Sound.play('bad'); buzz(140); }
        else { skips--; Sound.play('tap'); }
        ptsEl.textContent = String(pts); paintSkip(); next();
      };
      const tm = SH.timer(ctx, sp.time, {
        onEnd() { log.push([sp.label(card), 'time']); t.score += pts; summary(log, pts); },
      });
      paintSkip();
      ctx.view(
        h('div.hud', tm.el, h('div.turn', { style: { '--c': t.color } }, h('div.who', { style: { fontSize: '26px' } }, t.name)), h('span.pill.gold', 'النقاط ', ptsEl)),
        slot,
        h('div.row',
          h('button.btn.btn-ok', { type: 'button', style: { flex: '2 1 160px' }, onclick() { mark('ok'); } }, '✓ صح'),
          sp.penalty ? h('button.btn.btn-bad', { type: 'button', onclick() { mark('bad'); } }, '✗ قالها!') : null,
          skipB)
      );
      next(); tm.start();
    }

    function summary(log, pts) {
      const t = teams[turn];
      const icon = { ok: '✅', bad: '❌', skip: '↷', time: '⏰' };
      ctx.view(
        h('div.turn', { style: { '--c': t.color } }, h('p.eyebrow', 'خلص الوقت!'), h('div.who', t.name),
          h('div.big', 'النقاط: ' + (pts > 0 ? '+' : '') + pts)),
        h('div.list', log.map(([w, k]) => h('div', h('span', w), h('span.st', icon[k])))),
        SH.scorebar(teams, turn),
        h('div.spacer'),
        h('div.sticky-cta', h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); advance(); } }, 'التالي'))
      );
    }

    function advance() {
      turn++;
      if (turn >= teams.length) { turn = 0; round++; }
      if (round > sp.rounds) ctx.results({ rows: teams, award: sp.award });
      else turnIntro();
    }

    turnIntro();
  };

  /* اختبار اختيارات بالدور (كمّل المثل · وش معناها؟)
     sp: { players, perPlayer, secs, draw(), build(item) => {tag, text, correct, wrongs, note}, title(pct) } */
  SH.quiz = function (ctx, sp) {
    const players = sp.players;
    players.forEach((p) => { p.right = 0; });
    const total = players.length * sp.perPlayer;
    const solo = players.length === 1;
    let i = 0;

    function ask() {
      const p = players[i % players.length];
      const q = sp.build(sp.draw());
      let done = false;
      const bar = h('div.bar', h('i'));
      const after = h('div', { style: { display: 'grid', gap: '12px' } });
      const opts = h('div.opts');
      const letters = ['أ', 'ب', 'ج', 'د'];
      const btns = shuffle([q.correct].concat(q.wrongs)).map((txt, k) => {
        const b = h('button.opt', { type: 'button', onclick() { answer(txt, b); } }, h('span.k', letters[k]), h('span', txt));
        b.dataset.v = txt; return b;
      });
      opts.append(...btns);

      const tm = SH.timer(ctx, sp.secs, {
        onEnd() { answer(null, null); },
      });
      const sync = ctx.interval(() => { bar.style.setProperty('--p', String(tm.left / tm.total)); bar.classList.toggle('low', tm.left <= 5); }, 100);

      function answer(txt, btn) {
        if (done) return; done = true;
        tm.stop(); ctx.clear(sync); opts.classList.add('locked');
        const ok = txt === q.correct;
        btns.forEach((b) => { if (b.dataset.v === q.correct) b.classList.add('right'); else if (b !== btn) b.classList.add('dim'); });
        if (btn && !ok) btn.classList.add('wrong');
        let gain = 0;
        if (ok) { gain = 10 + Math.round((tm.left / tm.total) * 5); p.score += gain; p.right++; Sound.play('good'); buzz(25); }
        else if (txt !== null) { Sound.play('bad'); buzz(140); }
        i++;
        after.append(
          h('div.note', h('b', ok ? `كفو! +${gain} ` : txt === null ? 'خلص الوقت! ' : 'لا، مو هذي. '), q.note || ''),
          h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); i >= total ? finish() : ask(); } }, i >= total ? 'النتيجة' : 'التالي')
        );
        after.lastChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      ctx.view(
        h('div.hud', h('span.pill', `سؤال ${i + 1} من ${total}`), solo ? h('span.pill.gold', 'نقاطك ', h('b', String(p.score))) : h('span.pill', { style: { background: p.color, color: '#fff' } }, 'دور ' + p.name)),
        solo ? null : SH.scorebar(players, i % players.length),
        bar,
        h('div.prompt', q.tag ? h('span.tag', q.tag) : null, q.text),
        opts, after
      );
      tm.start();
    }

    function finish() {
      const best = players.slice().sort((a, b) => b.score - a.score)[0];
      const pct = best.right / sp.perPlayer;
      if (solo) {
        ctx.results({ rows: players, icon: pct >= 0.8 ? '🏆' : pct >= 0.5 ? '👏' : '😅', kicker: `جاوبت ${best.right} من ${sp.perPlayer} صح · مجموع نقاطك ${best.score}`, headline: sp.title(pct) });
      } else {
        ctx.results({ rows: players.map((p) => Object.assign(p, { sub: `${p.right} من ${sp.perPlayer} صح` })), award: () => sp.title(pct) });
      }
    }

    ask();
  };
})();

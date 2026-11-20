/* مين الدخيل؟ — الكل يعرف السالفة إلا واحد */
(function () {
  'use strict';
  const { h, Sound, buzz, shuffle, pick, rnd } = SH;

  function run(ctx, cfg) {
    const players = cfg.players;
    const n = players.length;
    let roundNo = 0, cat, word, spy, votes;

    function newRound() {
      roundNo++;
      cat = cfg.cat === 'any' ? pick(SH.OUTSIDER) : SH.OUTSIDER.find((c) => c[0] === cfg.cat);
      word = SH.deck('outsider:' + cat[0], cat[3]).next();
      spy = rnd(n); votes = [];
      reveal(0);
    }

    function reveal(i) {
      ctx.pass(players[i].name, () => secret(i), { color: players[i].color, sub: 'لا تخلّي أحد يشوف الشاشة غيرك', btn: 'أنا ' + players[i].name });
    }

    function secret(i) {
      const isSpy = i === spy;
      const nextBtn = h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', hidden: true, onclick() { Sound.play('pop'); i + 1 < n ? reveal(i + 1) : discuss(); } }, i + 1 < n ? 'خبّيتها، اللي بعدي' : 'الكل شاف، نبدأ');
      const card = h('button.secret', { type: 'button', onclick() {
        if (card.classList.contains('open')) return;
        card.classList.add('open'); if (isSpy) card.classList.add('spy');
        Sound.play(isSpy ? 'bad' : 'reveal'); buzz(isSpy ? [80, 50, 80] : 30);
        card.replaceChildren(...(isSpy
          ? [h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '🕵️'), h('div.big', 'أنت الدخيل!'), h('p', `ما تعرف السالفة. كل اللي تعرفه إنها من «${cat[2]}».`), h('p.small', 'اسمع زين، جاوب بثقة، وحاول ما تنكشف.')]
          : [h('p', 'السالفة هي'), h('div.huge', { style: { fontSize: 'clamp(44px, 13vw, 76px)' } }, word), h('p.small', `${cat[1]} ${cat[2]} · لا تقولها بصوت عالي`)]));
        nextBtn.hidden = false;
      } }, h('span', { style: { fontSize: '56px', lineHeight: '1.2' } }, '👆'), h('span', 'اضغط عشان تشوف سالفتك'));
      ctx.view(h('div.turn', { style: { '--c': players[i].color } }, h('div.who', { style: { fontSize: '30px' } }, players[i].name)), card, nextBtn);
    }

    function discuss() {
      const pair = h('div.note');
      const suggest = () => {
        const a = rnd(n); let b = rnd(n - 1); if (b >= a) b++;
        pair.replaceChildren(h('b', '💬 اقتراح: '), `${players[a].name} يسأل ${players[b].name}`);
      };
      suggest();
      const tm = SH.timer(ctx, cfg.time, { large: true, onEnd() { SH.toast('خلص وقت النقاش! صوّتوا'); vote(0); } });
      ctx.view(
        h('div.center', h('p.eyebrow', `الجولة ${roundNo} · ${cat[1]} ${cat[2]}`), h('div.big', 'اسألوا بعض وطلّعوا الدخيل')),
        h('div', { style: { display: 'grid', placeItems: 'center' } }, tm.el),
        pair,
        h('p.muted.center.small', 'اسألوا أسئلة عن السالفة بدون ما تفضحونها، مثل: «متى آخر مرة شفتها؟» أو «تحبها حارة ولا باردة؟»'),
        h('div.spacer'),
        h('div.row',
          h('button.btn', { type: 'button', onclick() { Sound.play('tap'); suggest(); } }, '🔄 اقتراح ثاني'),
          h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); tm.stop(); vote(0); } }, 'خلّصنا، نصوّت'))
      );
      tm.start();
    }

    function vote(i) {
      ctx.pass(players[i].name, () => {
        ctx.view(
          h('div.turn', { style: { '--c': players[i].color } }, h('p.eyebrow', 'تصويت ' + players[i].name), h('div.big', 'مين تشكّ إنه الدخيل؟')),
          h('div.votes-grid', players.map((p, j) => (j === i ? null : h('button.vote', { type: 'button', style: { '--c': p.color }, onclick() { Sound.play('pop'); votes[i] = j; i + 1 < n ? vote(i + 1) : tally(); } }, p.name))))
        );
      }, { kicker: 'تصويت سرّي، عطوا الجوال لـ', color: players[i].color, btn: 'أنا ' + players[i].name });
    }

    function tally() {
      const count = players.map(() => 0);
      votes.forEach((j) => { count[j]++; });
      const max = Math.max(...count);
      const top = count.map((c, j) => (c === max ? j : -1)).filter((j) => j >= 0);
      const caught = top.length === 1 && top[0] === spy;
      ctx.view(
        h('div.center', h('p.eyebrow', 'نتيجة التصويت'), h('div.big', 'الأصوات تقول…')),
        h('div.rank', players.map((p, j) => ({ p, c: count[j] })).sort((a, b) => b.c - a.c).map((x, k) =>
          h('div.rank-row', { style: { '--i': k, background: 'var(--surface)', color: 'var(--ink)' } }, h('span.m', '🗳️'), h('span.n', x.p.name), h('span.s', String(x.c))))),
        h('div.spacer'),
        h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { unmask(caught); } }, '🥁 اكشف الدخيل')
      );
    }

    function unmask(caught) {
      Sound.play('reveal'); buzz([40, 40, 40, 40, 200]);
      votes.forEach((j, i) => { if (j === spy && i !== spy) players[i].score += 1; });
      if (!caught) players[spy].score += 3;
      ctx.view(
        h('div.pass',
          h('span', { style: { fontSize: '84px', lineHeight: '1.2' } }, caught ? '🎯' : '😎'),
          h('p.eyebrow', 'الدخيل هو'),
          h('div.huge', { style: { color: players[spy].color, fontSize: 'clamp(48px, 14vw, 84px)' } }, players[spy].name),
          h('div.big', caught ? 'انكشف!' : 'هرب منكم!'),
          h('p.muted', caught ? 'كل اللي صوّت عليه ياخذ نقطة. بس باقي له فرصة أخيرة…' : 'الدخيل ياخذ 3 نقاط، واللي شكّ فيه صح ياخذ نقطة.')),
        caught
          ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); lastChance(); } }, 'فرصة الدخيل الأخيرة')
          : h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { Sound.play('pop'); roundEnd(); } }, 'وش كانت السالفة؟')
      );
      if (!caught) SH.confetti(70);
    }

    function lastChance() {
      const options = shuffle([word].concat(shuffle(cat[3].filter((w) => w !== word)).slice(0, 5)));
      ctx.view(
        h('div.turn', { style: { '--c': players[spy].color } }, h('p.eyebrow', 'يا ' + players[spy].name), h('div.big', 'وش كانت السالفة؟'), h('p.muted', 'لو عرفتها تاخذ نقطتين وتحفظ ماء الوجه.')),
        h('div.tiles', options.map((w) => h('button.pickt', { type: 'button', onclick() {
          const ok = w === word;
          if (ok) { players[spy].score += 2; Sound.play('good'); SH.toast('عرفها! +2 للدخيل'); } else { Sound.play('bad'); SH.toast('لا، مو هذي'); }
          buzz(ok ? 30 : 140); roundEnd();
        } }, w)))
      );
    }

    function roundEnd() {
      const ranked = players.slice().sort((a, b) => b.score - a.score);
      ctx.view(
        h('div.prompt', h('span.tag', `${cat[1]} ${cat[2]}`), 'السالفة كانت', h('span.word', word)),
        h('div.rank', ranked.map((p, k) => h('div.rank-row', { style: { '--i': k, background: 'var(--surface)', color: 'var(--ink)' } }, h('span.m', String(k + 1)), h('span.n', p.name), h('span.s', String(p.score))))),
        h('div.spacer'),
        h('div.row',
          h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); newRound(); } }, 'جولة جديدة'),
          h('button.btn', { type: 'button', onclick() { ctx.results({ rows: players, award: 'شارلوك الجلسة 🕵️' }); } }, 'ننهي ونتوّج'))
      );
    }

    newRound();
  }

  SH.add({
    id: 'outsider', name: 'مين الدخيل؟', emoji: '🕵️', color: 'violet',
    tagline: 'الكل يعرف السالفة إلا واحد. اكشفوه قبل ما يكشف السالفة!',
    players: '3 إلى 10', time: '10 د', moods: ['laugh', 'talk'],
    how: [
      'كل واحد يشوف السالفة بالسر، إلا «الدخيل» ما يعرف منها إلا المجال.',
      'اسألوا بعض أسئلة عن السالفة بدون ما تفضحونها، وراقبوا مين يتلعثم.',
      'صوّتوا على الدخيل. لو انكشف، له فرصة أخيرة يخمّن السالفة.',
    ],
    science: 'المعلومة المخفية تولّد شك وضحك وتمثيل، وكل جولة قصيرة تخلّي الكل يقول «جولة ثانية». هذا النوع من ألعاب الاستنتاج الاجتماعي يعتمد على الغموض كمصدر أساسي للتشويق.',
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 3, max: 10,
        options: [
          { key: 'cat', label: 'السالفة عن', choices: [['any', '🎲 عشوائي']].concat(SH.OUTSIDER.map((c) => [c[0], c[1] + ' ' + c[2]])), def: 'any' },
          { key: 'time', label: 'وقت النقاش', choices: [[120, 'دقيقتين'], [180, '3 دقايق'], [300, '5 دقايق']], def: 180 },
        ],
        onStart: (cfg) => run(ctx, cfg),
      });
    },
  });
})();

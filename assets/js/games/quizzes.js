/* كمّل المثل + وش معناها؟ — نفس المحرّك (اختيارات بالدور) */
(function () {
  'use strict';
  const { h } = SH;

  const COUNT = { key: 'n', label: 'كم سؤال لكل لاعب؟', choices: [[5, '5'], [8, '8'], [10, '10']], def: 5 };

  SH.add({
    id: 'proverbs', name: 'كمّل المثل', emoji: '📜', color: 'gold',
    tagline: 'أمثال الشيّاب عليكم… تعرفون تكمّلونها؟',
    players: '1 إلى 8', time: '8 د', moods: ['brain', 'duo', 'kids'],
    how: [
      'يطلع لك أول المثل، واختر التكملة الصحيحة من أربع.',
      'كل جواب صح بعشر نقاط، وكل ما جاوبت أسرع زادت نقاطك.',
      'بعد كل سؤال يطلع معنى المثل، عشان الصغار يتعلمون والكبار يتذكرون.',
    ],
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 1, max: 8, setupLabel: 'اللاعبين (1 إلى 8)',
        options: [COUNT],
        onStart(cfg) {
          const deck = SH.deck('proverbs', SH.PROVERBS);
          SH.quiz(ctx, {
            players: cfg.players, perPlayer: cfg.n, secs: 15,
            draw: () => deck.next(),
            build: (p) => ({ tag: 'كمّل المثل', text: h('span', { style: { fontSize: 'clamp(26px, 7vw, 38px)' } }, p[0]), correct: p[1], wrongs: p.slice(2, 5), note: `«${p[0].replace('…', '')} ${p[1]}»: ${p[5]}` }),
            title: (pct) => (pct >= 0.8 ? 'حكيم الديرة 🧓' : pct >= 0.5 ? 'راعي أمثال 👌' : 'يبي لك جلسة مع الشيّاب ☕'),
          });
        },
      });
    },
  });

  SH.add({
    id: 'dialects', name: 'وش معناها؟', emoji: '🗣️', color: 'teal',
    tagline: 'كلمات من لهجات المملكة: حجازية، نجدية، جنوبية وشرقاوية.',
    players: '1 إلى 8', time: '8 د', moods: ['brain', 'duo'],
    how: [
      'تطلع لك كلمة من لهجة سعودية، واختر معناها الصحيح.',
      'كل جواب صح بعشر نقاط، والسرعة تزيدك.',
      'بعد كل سؤال يطلع مثال على استخدامها.',
    ],
    start(ctx) {
      ctx.intro({
        setup: 'players', min: 1, max: 8, setupLabel: 'اللاعبين (1 إلى 8)',
        options: [COUNT],
        onStart(cfg) {
          const deck = SH.deck('dialects', SH.DIALECTS);
          SH.quiz(ctx, {
            players: cfg.players, perPlayer: cfg.n, secs: 15,
            draw: () => deck.next(),
            build: (d) => ({ tag: 'لهجة ' + d[1], text: h('span.word', '«' + d[0] + '»'), correct: d[2], wrongs: d.slice(3, 6), note: `«${d[0]}» تعني: ${d[2]}. ${d[6]}` }),
            title: (pct) => (pct >= 0.8 ? 'سفير اللهجات 🇸🇦' : pct >= 0.5 ? 'فاهم السوالف 👌' : 'يبي لك لفّة على المناطق 🚙'),
          });
        },
      });
    },
  });
})();

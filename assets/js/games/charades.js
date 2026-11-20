/* بدون كلام + لا تقولها — نفس المحرّك (فريق ضد الوقت) */
(function () {
  'use strict';
  const { h } = SH;

  const TIME = { key: 'time', label: 'وقت الدور', choices: [[45, '45 ثانية'], [60, '60 ثانية'], [90, '90 ثانية']], def: 60 };
  const ROUNDS = { key: 'rounds', label: 'كم جولة؟', choices: [[2, 'جولتين'], [3, '3 جولات'], [4, '4 جولات']], def: 3 };

  SH.add({
    id: 'charades', name: 'بدون كلام', emoji: '🎭', color: 'orange',
    tagline: 'مثّل بالحركات بس، وفريقك يخمّن قبل ما يخلص الوقت.',
    players: 'فريقين إلى 4', time: '15 د', moods: ['laugh', 'kids'],
    how: [
      'واحد من الفريق يمسك الجوال ويمثّل الكلمة بالحركات بس. ممنوع الكلام والأصوات.',
      'إذا خمّنها فريقه يضغط «صح» وتطلع كلمة جديدة. عندكم 3 تخطّيات في كل دور.',
      'بدّلوا الممثّل كل دور، والفريق الأكثر نقاط يفوز.',
    ],
    science: 'الضحك هنا يجي من الحركة والخروج عن المألوف، وضغط الوقت يرفع الحماس بدون ما يحتاج أحد معلومات مسبقة، فالصغير والكبير متساوين.',
    start(ctx) {
      const all = SH.CHARADES.map((c) => c[0]);
      ctx.intro({
        setup: 'teams', min: 2, max: 4,
        options: [{ key: 'cats', label: 'وش تمثّلون؟', multi: true, choices: SH.CHARADES.map((c) => [c[0], c[1]]), def: all }, TIME, ROUNDS],
        onStart(cfg) {
          const items = [];
          SH.CHARADES.filter((c) => cfg.cats.includes(c[0])).forEach((c) => c[2].forEach((w) => items.push([w, c[1]])));
          const deck = SH.deck('charades:' + cfg.cats.slice().sort().join(), items);
          SH.timedTeams(ctx, {
            teams: cfg.teams, time: cfg.time, rounds: cfg.rounds,
            roleHint: 'اختاروا واحد يمثّل، والباقي يخمّنون',
            draw: () => deck.next(),
            label: (c) => c[0],
            render: (c) => h('div.prompt', h('span.tag', c[1]), h('span.word', { style: { fontSize: 'clamp(34px, 9.5vw, 56px)' } }, c[0]), h('span.small', 'مثّلها بدون كلام')),
            award: 'نجوم التمثيل 🎭',
          });
        },
      });
    },
  });

  SH.add({
    id: 'taboo', name: 'لا تقولها', emoji: '🤐', color: 'red',
    tagline: 'وصّف الكلمة لفريقك بدون ما تقول الكلمات الممنوعة.',
    players: 'فريقين إلى 4', time: '15 د', moods: ['laugh', 'brain'],
    how: [
      'واحد يوصّف الكلمة اللي فوق لفريقه، بدون ما يقول أي كلمة من الممنوعات اللي تحتها.',
      'واحد من الفريق الخصم يراقب الشاشة. إذا انقالت كلمة ممنوعة يضغط «قالها!» وتنخصم نقطة.',
      'كل كلمة يخمّنها الفريق بنقطة، والوقت يمشي!',
    ],
    science: 'القيد هو مصدر المتعة: لما تنمنع الكلمات السهلة يضطر العقل يبدع، والفريق الخصم مشغول بالمراقبة فما فيه أحد جالس بدون دور.',
    start(ctx) {
      ctx.intro({
        setup: 'teams', min: 2, max: 4,
        options: [TIME, ROUNDS],
        onStart(cfg) {
          const deck = SH.deck('taboo', SH.TABOO);
          SH.timedTeams(ctx, {
            teams: cfg.teams, time: cfg.time, rounds: cfg.rounds, penalty: true,
            roleHint: 'واحد يوصّف، وواحد من الخصم يراقب الممنوعات',
            draw: () => deck.next(),
            label: (c) => c[0],
            render: (c) => h('div.prompt', h('span.word', c[0]), h('span.small', 'ممنوع تقول'), h('div.ban', c[1].map((w) => h('span', w)))),
            award: 'ملوك الوصف 🤐',
          });
        },
      });
    },
  });
})();

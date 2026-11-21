/* أسئلة العائلة — تكتبون أسئلتكم وسوالفكم الخاصة وتدخل في الألعاب (تنحفظ على الجهاز نفسه) */
(function () {
  'use strict';
  const { h, Sound, Store } = SH;
  const MAX = 100, LEN = 140;

  /* [المعرّف، الإيموجي، الاسم، وين تطلع، نص الحقل] */
  const TYPES = [
    ['trivia', '🧠', 'الفطاحلة', 'تطلع في «الفطاحلة» كمجال اسمه «أسئلة العائلة». الفريق يجاوب بصوته، ثم تكشفون الجواب وتحكمون.', 'السؤال، مثل: وش أول سيارة اشتراها أبوي؟'],
    ['whois', '👉', 'مين فينا؟', 'تطلع في «مين فينا؟» بالتناوب مع باقي الأسئلة.', 'مثل: يحرق الأكل دايم'],
    ['truth', '🗣️', 'صراحة', 'تطلع في «دوّر الدلّة» لما أحد يختار صراحة.', 'سؤال صراحة، مثل: مين كسر تحفة جدّتي؟'],
    ['dare', '🎯', 'تحدّي', 'تطلع في «دوّر الدلّة» لما أحد يختار تحدّي.', 'تحدّي، مثل: قلّد خالي وهو يسوق'],
  ];
  let tab = 'trivia';

  function page(ctx) {
    const data = SH.mine();
    const [id, , name, where, hint] = TYPES.find((t) => t[0] === tab);
    const list = data[id];
    const pair = id === 'trivia';

    const tabs = h('div.seg', { role: 'group', 'aria-label': 'نوع الأسئلة' }, TYPES.map(([tid, e, tname]) => h('button', {
      type: 'button', 'aria-pressed': String(tid === tab),
      onclick() { if (tid !== tab) { tab = tid; Sound.play('tap'); page(ctx); } },
    }, `${e} ${tname} (${data[tid].length})`)));

    const q = h('input.inp', { id: 'mine-q', type: 'text', maxLength: LEN, autocomplete: 'off', placeholder: hint, 'aria-label': pair ? 'السؤال' : name });
    const a = pair ? h('input.inp', { id: 'mine-a', type: 'text', maxLength: LEN, autocomplete: 'off', placeholder: 'الجواب الصحيح', 'aria-label': 'الجواب' }) : null;
    const items = h('div.own-list');

    const save = () => Store.set('mine', data);
    const drawList = () => {
      [...tabs.children].forEach((b, i) => { b.textContent = `${TYPES[i][1]} ${TYPES[i][2]} (${data[TYPES[i][0]].length})`; });
      items.replaceChildren(...(list.length ? list.map((it, i) => h('div.own-item',
        h('span.t', (id === 'whois' ? 'مين فينا أكثر واحد ' : '') + (pair ? it[0] : it), pair ? h('small', 'الجواب: ' + it[1]) : null),
        h('button.x', { type: 'button', 'aria-label': 'حذف', onclick() { list.splice(i, 1); save(); Sound.play('tap'); drawList(); } }, '✕')))
        : [h('p.muted.center', 'ما كتبتوا شي هنا للحين. أول سؤال يبدأ من فوق.')]));
    };
    const add = () => {
      const text = q.value.trim().replace(/\s+/g, ' ');
      const ans = a ? a.value.trim().replace(/\s+/g, ' ') : '';
      if (!text || (a && !ans)) { Sound.play('bad'); SH.toast(a ? 'اكتبوا السؤال والجواب' : 'اكتبوا شي أول'); return; }
      if (list.length >= MAX) { SH.toast(`الحد الأعلى ${MAX} في كل نوع`); return; }
      if (list.some((it) => (pair ? it[0] : it) === text)) { SH.toast('هذا مكتوب من قبل'); return; }
      list.unshift(pair ? [text, ans] : text);
      save(); Sound.play('good'); SH.buzz(25);
      q.value = ''; if (a) a.value = '';
      drawList(); q.focus();
    };

    drawList();
    ctx.view(
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🏠'), h('h1', 'أسئلة العائلة'), h('p', 'اكتبوا أسئلتكم وسوالفكم الخاصة وتدخل في الألعاب. تنحفظ على هذا الجوال بس.')),
      tabs,
      h('form.card', { onsubmit(e) { e.preventDefault(); add(); } },
        h('div.field',
          id === 'whois' ? h('span.label', 'مين فينا أكثر واحد…') : null,
          q, a,
          h('button.btn.btn-primary.btn-block', { type: 'submit' }, '＋ أضف')),
        h('p.muted.small', { style: { marginTop: '10px' } }, where)),
      items
    );
  }

  SH.add({
    id: 'mine', hidden: true, name: 'أسئلة العائلة', emoji: '🏠', color: 'teal', moods: [],
    tagline: 'اكتبوا أسئلتكم وسوالفكم الخاصة وتدخل في الألعاب.',
    how: [
      'اختاروا النوع من فوق: سؤال للفطاحلة، سؤال «مين فينا؟»، صراحة أو تحدّي.',
      'اكتبوا السؤال واضغطوا «أضف». يدخل في اللعبة من أول جولة جاية.',
      'كل شي ينحفظ على هذا الجوال بس، وتقدرون تحذفون أي سؤال من القائمة.',
    ],
    start(ctx) { page(ctx); },
  });
})();

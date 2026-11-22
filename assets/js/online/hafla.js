/* شبّة — حفلتكم: توديع عزوبية، بيبي شاور، عيد ميلاد.
   صاحب الحفلة يجهّزها (صور، أجوبة عن صاحبة المناسبة)، والضيوف يدخلون برابط دعوة خاص ويلعبون فقرات كلها عنها.
   الحفلة غرفة أونلاين عادية (online.js) فوقها:
     meta.party { type, name, f, star, pv, g }   بيانات تظهر للضيوف (star = اللي عنها الحفلة لو كانت موجودة، pv = رقم نسخة الصور)
     secret/المستضيف/p { ans, custom, ages, gender }   الأجوبة، تبقى عند المستضيف
     vault/photos و vault/wishes                    الصور ودفتر الأمنيات، لمن معه رابط الدعوة فقط */
(function () {
  'use strict';
  const { h, Sound, buzz, Store, shuffle } = SH;
  const MAXP = 8, SIDE = 720, LIMIT = 170000;   /* عدد الصور، وأطول ضلع، وأقصى حجم للصورة بعد الضغط */
  const digits = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const arr = (v) => (v ? Object.keys(v).map((k) => v[k]) : []);

  const TYPES = {
    bride: { emoji: '👰', color: 'pink', label: 'توديع العزوبية', desc: 'سهرة البنات قبل الزواج', who: 'اسم العروس', star: () => 'العروس', title: (p) => 'توديع عزوبية ' + p.name },
    baby: { emoji: '🍼', color: 'teal', label: 'بيبي شاور', desc: 'استقبال المولود وكشف جنسه', who: 'اسم الماما', star: () => 'الماما', title: (p) => 'بيبي شاور ' + p.name },
    bday: { emoji: '🎂', color: 'violet', label: 'عيد ميلاد', desc: 'للكبار والصغار', who: 'اسم صاحب أو صاحبة العيد', star: (p) => (p.f ? 'صاحبة العيد' : 'صاحب العيد'), title: (p) => 'عيد ميلاد ' + p.name },
  };
  /* قالب النص: {n} اسم صاحبة الحفلة، و {مؤنث|مذكر} حسب الجنس */
  const T = (s, p) => String(s).replace(/\{n\}/g, p.name).replace(/\{([^|{}]*)\|([^{}]*)\}/g, (m, a, b) => (p.f ? a : b));

  /* ---------- أسئلة «مين يعرفها أكثر؟»: [المعرّف، السؤال، الخيارات] والمستضيف يختار الجواب الصح ---------- */
  const QA = {
    all: [
      ['drink', 'وش مشروب {n} المفضل؟', ['قهوة عربية', 'شاي', 'قهوة مختصة', 'كرك', 'عصير', 'موية وبس']],
      ['food', 'وش أكلة {n} المفضلة؟', ['كبسة', 'برجر', 'سوشي', 'باستا', 'مندي', 'بيتزا']],
      ['app', 'وش أكثر تطبيق {تفتحه|يفتحه} {n}؟', ['سناب شات', 'تيك توك', 'إنستقرام', 'واتساب', 'يوتيوب', 'إكس']],
      ['color', 'وش لون {n} المفضل؟', ['أسود', 'أبيض', 'وردي', 'أزرق', 'أخضر', 'بيج']],
      ['travel', 'وين {تتمنى|يتمنى} {n} {تسافر|يسافر}؟', ['المالديف', 'باريس', 'لندن', 'اليابان', 'تركيا', 'العُلا']],
      ['fear', 'وش أكثر شي يخوّف {n}؟', ['الحشرات', 'المرتفعات', 'الظلام', 'الطيارة', 'القطط', 'الإبر']],
      ['sweet', 'وش الحلا اللي ما {تقاومه|يقاومه} {n}؟', ['كنافة', 'شوكولاتة', 'آيسكريم', 'تشيز كيك', 'لقيمات', 'دونات']],
      ['sorry', 'لو {n} {زعلانة|زعلان}، وش اللي {يرضيها|يرضيه}؟', ['أكلة حلوة', 'هدية', 'كلمة حلوة', 'شوية وقت {لحالها|لحاله}', 'طلعة']],
      ['sleep', '{n} من أهل الصباح ولا من أهل السهر؟', ['من أهل الصباح', 'من أهل السهر']],
      ['season', 'وش فصل {n} المفضل؟', ['الشتاء', 'الصيف', 'الربيع', 'الخريف']],
      ['group', 'كيف {n} في قروب الواتساب؟', ['{أول وحدة ترد|أول واحد يرد}', '{تقرأ وما ترد|يقرأ وما يرد}', '{ترد بستيكرات بس|يرد بستيكرات بس}', '{مسوّية كتم للقروب|مسوّي كتم للقروب}']],
      ['late', '{n} والمواعيد؟', ['{توصل قبل الكل|يوصل قبل الكل}', 'على الوقت بالضبط', '{تتأخر شوي|يتأخر شوي}', '{آخر وحدة توصل|آخر واحد يوصل}']],
    ],
    bride: [
      ['honey', 'وين بيكون شهر العسل؟', ['المالديف', 'تركيا', 'أوروبا', 'شرق آسيا', 'داخل المملكة', 'لسا ما قرروا']],
      ['excite', 'وش أكثر شي متحمسة له {n} في الزواج؟', ['الفستان', 'الزفّة', 'شهر العسل', 'البيت الجديد', 'التصوير', 'البوفيه']],
      ['stress', 'وش أكثر شي موتّر {n} قبل الزواج؟', ['التجهيزات', 'الفستان', 'المعازيم', 'الميكب', 'ضيق الوقت', 'ولا شي، رايقة']],
      ['cry', 'مين بيبكي أكثر يوم الزواج؟', ['{n} نفسها', 'أمها', 'أخواتها', 'صديقاتها', 'أبوها']],
      ['cook', 'كيف {n} في المطبخ؟', ['شيف محترفة', 'تمشّي الحال', 'بيض مقلي وبس', 'تطلب من التطبيقات']],
      ['first', 'وش أول أكلة بتطبخها {n} في بيتها؟', ['كبسة', 'باستا', 'إندومي', 'بتطلب من برا']],
      ['ready', 'كم تحتاج {n} وقت عشان تجهز لمشوار؟', ['ربع ساعة', 'نص ساعة', 'ساعة', 'ساعتين وأكثر']],
      ['dress', 'وش قصّة فستان الزواج اللي تحبها {n}؟', ['منفوش', 'سمكة', 'ناعم وبسيط', 'بأكمام طويلة']],
    ],
    baby: [
      ['crave', 'وش أكثر شي تتوحّم عليه {n}؟', ['حامض', 'حلا', 'مخلل', 'شطة', 'ثلج', 'فواكه']],
      ['tell', 'مين أول شخص بشّرته {n} بالحمل؟', ['زوجها', 'أمها', 'أختها', 'صديقتها']],
      ['miss', 'وش أكثر شي مشتاقة له {n} بعد الولادة؟', ['النوم على بطنها', 'القهوة براحتها', 'السوشي', 'ملابسها القديمة', 'السفر']],
      ['kids', 'كم طفل تتمنى {n}؟', ['واحد ويكفي', 'اثنين', 'ثلاثة', 'أربعة وأكثر']],
      ['spoil', 'مين بيدلّع البيبي أكثر؟', ['أمه', 'أبوه', 'الجدّة', 'الخالات', 'العمّات']],
      ['buy', 'وش أول شي اشترته {n} للبيبي؟', ['ملابس', 'سرير', 'عربية', 'ألعاب', 'لسا ما اشترت شي']],
      ['look', 'البيبي بيطلع على مين؟', ['على أمه', 'على أبوه', 'خليط من الاثنين', 'على جدّه أو جدّته']],
      ['night', 'مين بيسهر مع البيبي بالليل؟', ['{n} لحالها', 'أبوه', 'بالتناوب', 'الجدّة']],
    ],
    bday: [
      ['gift', 'وش الهدية اللي {تتمناها|يتمناها} {n}؟', ['عطر', 'ساعة', 'جوال', 'سفرة', 'فلوس', 'ورد']],
      ['party', 'كيف {تحب|يحب} {n} {تحتفل|يحتفل} بعيد {ميلادها|ميلاده}؟', ['حفلة كبيرة', 'عشاء هادي', 'سفرة', '{ما تحب تحتفل|ما يحب يحتفل}']],
      ['cake', 'وش نكهة الكيكة اللي {تحبها|يحبها} {n}؟', ['شوكولاتة', 'فانيلا', 'ريد فلفت', 'لوتس', 'فواكه', 'زعفران']],
      ['dream', 'وش كان حلم {n} في الصغر؟', ['{دكتورة|دكتور}', '{معلمة|معلم}', '{طيّارة|طيّار}', '{لاعبة كورة|لاعب كورة}', '{مهندسة|مهندس}', '{فنانة|فنان}']],
      ['hobby', 'وش هواية {n}؟', ['القراءة', 'الرياضة', 'الطبخ', 'الألعاب', 'الرسم', 'التصوير']],
      ['million', 'لو {فازت|فاز} {n} بمليون، وش أول شي {تسويه|يسويه}؟', ['{تسافر|يسافر}', '{تشتري سيارة|يشتري سيارة}', '{تتصدّق|يتصدّق}', '{تستثمر|يستثمر}', '{تعزم الكل|يعزم الكل}']],
    ],
  };
  const presets = (type) => (QA[type] || []).concat(QA.all);

  /* ---------- سوالف الحفلة اللي تدخل في «مين فينا؟» و«دوّر الدلّة» ---------- */
  const EXTRA = {
    bride: {
      whois: ['بتبكي أول وحدة يوم الزواج', 'العروس الجاية', 'بترقص أكثر وحدة في الزواج', 'بتوصل متأخرة على الزواج', 'بتفقد {n} أكثر وحدة بعد الزواج', 'تعرف أسرار {n} كلها', 'بتاخذ أحلى صور في الزواج', 'بتزور {n} في بيتها الجديد أول وحدة', 'بتلبس كعب وتندم بعد ساعة', 'بتاكل من البوفيه قبل الكل', 'بتعطي {n} أحسن نصيحة زواج', 'جهّزت فستانها للزواج قبل العروس'],
      truth: ['وش أحلى ذكرى لك مع {n}؟', 'وش أول انطباع أخذتيه عن {n}؟', 'وش الشي اللي بتفقدينه في {n} بعد الزواج؟', 'وش النصيحة اللي تتمنين أحد قالها لك قبل الزواج؟', 'وش أكثر موقف ضحّكك مع {n}؟', 'وش الشي اللي ما يعرفه أحد عن صداقتك مع {n}؟'],
      dare: ['قلّدي {n} وهي معصبة، والباقين يحكمون.', 'قولي نصيحة زواج لـ{n} بصوت جدّة.', 'سوّي زفّة لـ{n} لمدة 10 ثواني.', 'امدحي {n} بثلاث جمل بدون ما تضحكين.', 'مثّلي كيف {n} بتطبخ أول عزيمة في بيتها.', 'غنّي مقطع من أغنية زفّة بأعلى صوتك.'],
    },
    baby: {
      whois: ['بتدلّع البيبي أكثر وحدة', 'بتكون الخالة المفضلة عند البيبي', 'بتشتري للبيبي ملابس أكثر من أمه', 'بتزور {n} بعد الولادة أول وحدة', 'بتعرف تسكّت البيبي إذا بكى', 'بتخاف تشيل البيبي أول مرة', 'بتصوّر البيبي أكثر من أمه', 'بتعلّم البيبي حركات ما ترضى عنها أمه', 'بتحفظ اسم البيبي قبل الكل', 'الماما الجاية', 'بتسهر مع {n} إذا البيبي ما نام', 'بتعطي نصايح أمومة وهي ما جرّبت'],
      truth: ['وش الاسم اللي تتوقعينه للبيبي؟', 'وش أحلى نصيحة أمومة سمعتيها؟', 'وش أغرب وحام سمعتي عنه؟', 'وش الشي اللي تتمنين البيبي ياخذه من {n}؟', 'وش أول هدية بتجيبينها للبيبي؟', 'وش أحلى ذكرى لك مع {n}؟'],
      dare: ['غنّي للبيبي أغنية نوم بصوت هادي.', 'قلّدي بكاء بيبي جوعان.', 'مثّلي كيف {n} بتغيّر أول حفاضة.', 'قولي «ماما» بخمس طرق مختلفة.', 'مثّلي أم تحاول تنوّم بيبي ما يبي ينام.', 'امدحي {n} كأنك تقدّمينها في برنامج.'],
    },
    bday: {
      whois: ['يعرف {n} أكثر واحد', 'بياكل أكبر قطعة من الكيكة', 'جاب أحلى هدية', 'نسي الهدية وبيتعذّر', 'بيغنّي «سنة حلوة» بأعلى صوت', 'يضحّك {n} أكثر واحد', 'أقدم واحد يعرف {n}', 'بيسهر لآخر الحفلة', 'بياخذ من الكيكة معه للبيت', 'بينسى عيد ميلاد {n} السنة الجاية', 'يتأخر دايم على مواعيده مع {n}', 'بيصوّر الحفلة كلها وما ينزّل شي'],
      truth: ['وش أحلى موقف لك مع {n}؟', 'وش أول مرة شفت فيها {n}؟', 'وش أكثر شي يعجبك في {n}؟', 'وش الهدية اللي تتمنى تعطيها {n} لو الميزانية مفتوحة؟', 'وش الشي اللي تعلّمته من {n}؟', 'وش أكثر موقف ضحّكك مع {n}؟'],
      dare: ['غنّ «سنة حلوة يا جميل» بصوت أوبرا.', 'قلّد {n} وهو يفتح الهدايا.', 'قل لـ{n} كلمة حلوة بثلاث لهجات.', 'اطفِ شموع وهمية بأكبر دراما.', 'امدح {n} كأنك معلّق مباراة.', 'ألّف بيت شعر عن {n} الحين.'],
    },
  };
  const WISH = {
    bride: 'اكتبي أمنية أو نصيحة لـ{n} قبل الزواج',
    baby: 'اكتبي أمنية للبيبي أو نصيحة لـ{n}',
    bday: 'اكتبوا أمنية أو كلمة حلوة لـ{n}',
  };

  /* ---------- أدوات ---------- */
  const typeOf = (p) => TYPES[p.type] || TYPES.bday;
  const title = (p) => typeOf(p).title(p);
  const randomKey = () => { const a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, (x) => (x % 36).toString(36)).join(''); };

  /* تصغير الصورة وضغطها على الجهاز قبل الرفع. لو بقيت كبيرة ننزّل الجودة ثم المقاس */
  const shrink = (file) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    const done = (d) => { URL.revokeObjectURL(url); if (d) res(d); else rej(new Error('bad')); };
    img.onload = () => {
      try {
        for (const side of [SIDE, 560, 420]) {
          const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
          for (let q = 0.76; q > 0.4; q -= 0.12) { const d = cv.toDataURL('image/jpeg', q); if (d.indexOf('data:image/jpeg') === 0 && d.length <= LIMIT) return done(d); }
        }
        done(null);
      } catch (e) { done(null); }
    };
    img.onerror = () => done(null);
    img.src = url;
  });

  const blank = (type) => ({ type, name: '', f: true, host: (Store.get('online', null) || {}).name || '', photos: [], ages: [], gender: '', ans: {}, custom: [] });
  const answered = (d) => presets(d.type).filter((x) => d.ans[x[0]]).length + d.custom.length;
  const toPriv = (d) => {
    const ans = {}; presets(d.type).forEach((x) => { if (d.ans[x[0]]) ans[x[0]] = String(d.ans[x[0]]).slice(0, 40); });
    return {
      ans, custom: d.custom.slice(0, 12),
      ages: d.photos.map((_, i) => { const v = digits(d.ages[i]); return v === '' ? -1 : Math.min(99, Number(v)); }),
      gender: d.type === 'baby' ? d.gender || '' : '',
    };
  };
  const remember = (code, k, p) => {
    const list = (Store.get('hafla:list', []) || []).filter((x) => x.code !== code);
    list.unshift({ code, k, name: p.name, type: p.type, f: !!p.f, at: Date.now() });
    Store.set('hafla:list', list.slice(0, 8));
  };

  /* ---------- معالج التجهيز (للإنشاء والتعديل) ---------- */
  function wizard(ctx, draft, opt) {
    const save = () => { if (!opt.edit) Store.set('hafla:draft', draft); };
    const ty = TYPES[draft.type];
    const person = () => ({ type: draft.type, name: draft.name.trim().replace(/\s+/g, ' ') || 'صاحبة الحفلة', f: draft.type === 'bday' ? !!draft.f : true });

    function details() {
      ctx.dirty = true;
      const name = h('input.inp', { id: 'hf-name', type: 'text', maxLength: 16, autocomplete: 'off', placeholder: ty.who, 'aria-label': ty.who, value: draft.name, oninput(e) { draft.name = e.target.value; }, onchange: save });
      const host = opt.edit ? null : h('input.inp', { id: 'hf-host', type: 'text', maxLength: 14, autocomplete: 'off', placeholder: 'اسمك أنت', 'aria-label': 'اسمك أنت', value: draft.host, oninput(e) { draft.host = e.target.value; }, onchange: save });
      const grid = h('div.ph-grid');
      const busy = h('p.muted.small', { role: 'status' });
      const file = h('input', { id: 'hf-file', type: 'file', accept: 'image/*', multiple: true, hidden: true, async onchange() {
        const files = [...file.files].slice(0, MAXP - draft.photos.length); file.value = '';
        if (!files.length) return;
        busy.textContent = 'نجهّز الصور…'; let failed = 0;
        for (const f of files) { try { draft.photos.push(await shrink(f)); draft.ages.push(''); } catch (e) { failed++; } }
        busy.textContent = failed ? `${failed === 1 ? 'صورة وحدة' : failed + ' صور'} ما قدرنا نقرأها. جرّبوا صورة ثانية.` : '';
        Sound.play('pop'); save(); draw();
      } });
      const draw = () => grid.replaceChildren(
        ...draft.photos.map((d, i) => h('div.ph',
          h('img', { src: d, alt: 'صورة ' + (i + 1) }), i === 0 ? h('span.ph-tag', 'الغلاف') : null,
          h('button.ph-x', { type: 'button', 'aria-label': 'حذف الصورة ' + (i + 1), onclick() { draft.photos.splice(i, 1); draft.ages.splice(i, 1); Sound.play('tap'); save(); draw(); } }, '✕'),
          h('input.inp', { type: 'text', inputMode: 'numeric', maxLength: 2, placeholder: 'العمر؟', 'aria-label': 'العمر في الصورة ' + (i + 1), value: digits(draft.ages[i]), oninput(e) { draft.ages[i] = digits(e.target.value); }, onchange: save }))),
        draft.photos.length < MAXP ? h('button.ph-add', { type: 'button', onclick() { file.click(); } }, h('span', { 'aria-hidden': 'true' }, '＋'), draft.photos.length ? 'صور زيادة' : 'أضيفوا صور') : null);
      draw();
      const next = () => {
        draft.name = draft.name.trim().replace(/\s+/g, ' ');
        if (!draft.name) { SH.toast('اكتبوا ' + ty.who + ' أول'); name.focus(); return; }
        if (host) { draft.host = draft.host.trim().replace(/\s+/g, ' '); if (!draft.host) { SH.toast('اكتبوا اسمكم أول'); host.focus(); return; } }
        Sound.play('pop'); save(); questions();
      };
      ctx.view(
        h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, ty.emoji), h('h1', ty.label), h('p', opt.edit ? 'عدّلوا اللي تبون، والتغيير يوصل للضيوف مباشرة.' : 'خطوة 1 من 2: الاسم والصور.')),
        h('div.card',
          h('div.field', h('span.label', ty.who), name),
          draft.type === 'bday' ? h('div.field', h('span.label', 'الحفلة لـ'), SH.seg([[true, 'بنت'], [false, 'ولد']], !!draft.f, (v) => { draft.f = v; save(); })) : null,
          host ? h('div.field', h('span.label', 'اسمك أنت (اللي يطلع للضيوف)'), host) : null),
        h('div.card', h('h3', 'الصور'),
          h('p.muted.small', `حتى ${MAXP} صور، وأول صورة هي غلاف الحفلة. اكتبوا العمر تحت كل صورة عشان تشتغل فقرة «${T('كم كان {عمرها|عمره}؟', person())}».`),
          grid, busy, file),
        draft.type === 'baby' ? h('div.card', h('h3', 'كشف جنس المولود'),
          h('p.muted.small', 'لو تبون فقرة الكشف، اختاروا هنا. الجواب يبقى على جوالكم وما يشوفه أحد لين لحظة الكشف.'),
          SH.seg([['', 'بدون كشف'], ['g', '💗 بنت'], ['b', '💙 ولد']], draft.gender || '', (v) => { draft.gender = v; save(); })) : null,
        h('div.sticky-cta', h('div.row',
          h('button.btn', { type: 'button', style: { flex: '0 1 110px' }, onclick() { Sound.play('tap'); opt.onCancel(); } }, opt.edit ? 'إلغاء' : 'رجوع'),
          h('button.btn.btn-primary.btn-xl', { type: 'button', onclick: next }, 'التالي: الأسئلة')))
      );
    }

    function questions() {
      const p = person();
      const count = h('span.pill.gold', '');
      const upd = () => { count.textContent = `جاوبتوا على ${answered(draft)}`; };
      const cards = presets(draft.type).map(([id, q, opts]) => {
        const list = opts.map((o) => T(o, p));
        const other = h('input.inp', { type: 'text', maxLength: 40, autocomplete: 'off', placeholder: 'جواب ثاني؟ اكتبوه هنا', 'aria-label': 'جواب ثاني', value: draft.ans[id] && !list.includes(draft.ans[id]) ? draft.ans[id] : '',
          oninput(e) { const v = e.target.value.trim(); if (v) draft.ans[id] = v; else if (!list.includes(draft.ans[id])) delete draft.ans[id]; paint(); upd(); }, onchange: save });
        const chips = h('div.seg', list.map((o) => h('button', { type: 'button', onclick() { Sound.play('tap'); if (draft.ans[id] === o) delete draft.ans[id]; else { draft.ans[id] = o; other.value = ''; } paint(); upd(); save(); } }, o)));
        const paint = () => [...chips.children].forEach((b, i) => b.setAttribute('aria-pressed', String(draft.ans[id] === list[i])));
        paint();
        return h('div.card.qa', h('p.qa-q', T(q, p)), chips, other);
      });

      /* أسئلتكم الخاصة */
      const cq = h('input.inp', { id: 'hf-cq', type: 'text', maxLength: 90, autocomplete: 'off', placeholder: T('السؤال، مثل: وش اسم أعز {صديقاتها|أصحابه}؟', p), 'aria-label': 'السؤال' });
      const ca = h('input.inp', { id: 'hf-ca', type: 'text', maxLength: 40, autocomplete: 'off', placeholder: 'الجواب الصح', 'aria-label': 'الجواب الصح' });
      const cw = [0, 1, 2].map((i) => h('input.inp', { id: 'hf-cw' + i, type: 'text', maxLength: 40, autocomplete: 'off', placeholder: 'جواب غلط' + (i ? ' (اختياري)' : ''), 'aria-label': 'جواب غلط ' + (i + 1) }));
      const own = h('div.own-list');
      const drawOwn = () => own.replaceChildren(...draft.custom.map((c, i) => h('div.own-item', h('span.t', c.q, h('small', '✓ ' + c.a)),
        h('button.x', { type: 'button', 'aria-label': 'حذف السؤال', onclick() { draft.custom.splice(i, 1); Sound.play('tap'); save(); drawOwn(); upd(); } }, '✕'))));
      const addOwn = () => {
        const q = cq.value.trim(), a = ca.value.trim(), w = [...new Set(cw.map((x) => x.value.trim()).filter((x) => x && x !== a))];
        if (!q || !a) { SH.toast('اكتبوا السؤال وجوابه الصح'); (q ? ca : cq).focus(); return; }
        if (!w.length) { SH.toast('اكتبوا جواب غلط واحد على الأقل'); cw[0].focus(); return; }
        if (draft.custom.length >= 12) { SH.toast('وصلتوا الحد: 12 سؤال خاص'); return; }
        draft.custom.push({ q, a, w }); [cq, ca].concat(cw).forEach((x) => { x.value = ''; });
        Sound.play('good'); save(); drawOwn(); upd(); cq.focus();
      };
      drawOwn(); upd();

      const status = h('p.muted.center.small', { role: 'status' });
      let busy = false;
      const finish = async () => {
        if (busy) return;
        if (answered(draft) < 3 && !(await SH.confirm(`فقرة «${T('مين يعرف {n} أكثر؟', p)}» تحتاج 3 أجوبة على الأقل. تكمّلون بدونها؟`, 'نكمّل بدونها', 'نرجع نجاوب'))) return;
        busy = true; status.textContent = opt.edit ? 'نحفظ التعديلات…' : 'نجهّز الحفلة ونرفع الصور…'; Sound.play('pop');
        try { await opt.onDone(draft); } catch (e) { busy = false; status.textContent = ''; Sound.play('bad'); SH.toast(SH.onlineJoinError(e)); }
      };
      ctx.view(
        h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '💡'), h('h1', T('مين يعرف {n} أكثر؟', p)), h('p', opt.edit ? 'عدّلوا الأجوبة أو زيدوا أسئلة.' : T('خطوة 2 من 2: جاوبوا عن {n}، أو خلّوا {n} {تجاوب بنفسها|يجاوب بنفسه} قبل الحفلة. الضيوف يتسابقون مين يعرف الأجوبة.', p))),
        h('div.hud', count, h('span.muted.small', 'جاوبوا على اللي تبون وتخطّوا الباقي')),
        cards,
        h('div.card', h('h3', 'أسئلتكم الخاصة'), h('p.muted.small', 'سؤال ما يعرف جوابه إلا القريبين؟ اكتبوه مع جوابه الصح وأجوبة غلط تلخبط الضيوف.'),
          h('div.field', cq, ca, cw, h('button.btn.btn-sm', { type: 'button', onclick: addOwn }, '＋ أضيفوا السؤال')), own),
        status,
        h('div.sticky-cta', h('div.row',
          h('button.btn', { type: 'button', style: { flex: '0 1 110px' }, onclick() { Sound.play('tap'); save(); details(); } }, 'رجوع'),
          h('button.btn.btn-primary.btn-xl', { id: 'hf-done', type: 'button', onclick: finish }, opt.edit ? 'احفظوا التعديلات' : '🎉 جهّزوا الحفلة')))
      );
    }
    details();
  }

  /* ---------- صفحة «حفلتكم» ---------- */
  function home(ctx) {
    ctx.dirty = false;
    const draft = Store.get('hafla:draft', null);
    const list = Store.get('hafla:list', []) || [];
    const start = (d) => wizard(ctx, d, {
      onCancel() { home(ctx); },
      async onDone(dr) {
        const p = { type: dr.type, name: dr.name, f: dr.type === 'bday' ? !!dr.f : true, pv: 1 };
        const key = randomKey();
        const code = await SH.onlineJoin(ctx, { create: true, name: dr.host, key, party: { meta: p, priv: toPriv(dr), photos: dr.photos } });
        remember(code, key, p); Store.set('hafla:draft', null);
      },
    });
    const status = h('p.muted.center.small', { role: 'status' });
    let busy = false;
    const enter = async (x) => {
      if (busy) return;
      const name = ((Store.get('online', null) || {}).name || '').trim();
      busy = true; status.textContent = 'جاري الدخول للحفلة…'; Sound.play('pop');
      try { await SH.onlineJoin(ctx, { name: name || 'المستضيف', code: x.code, key: x.k }); }
      catch (e) {
        busy = false; status.textContent = ''; Sound.play('bad'); SH.toast(e && e.message === 'noroom' ? 'هالحفلة انتهت وما عادت موجودة' : SH.onlineJoinError(e));
        if (e && e.message === 'noroom') { Store.set('hafla:list', list.filter((y) => y.code !== x.code)); home(ctx); }
      }
    };
    /* حذف نهائي: نمسح الصور والأجوبة من الخادم (لو الحفلة حفلتنا) ثم نشيلها من القائمة */
    const forget = async (x) => {
      Sound.play('tap');
      if (busy || !(await SH.confirm(`نحذف «${title(x)}» نهائياً مع صورها وأمنياتها؟ الضيوف ما راح يقدرون يدخلونها بعدها.`, 'احذفوها', 'خلّوها'))) return;
      busy = true; status.textContent = 'نحذف الحفلة…';
      try {
        const net = await SH.net(), base = 'rooms/' + x.code, m = await net.get(base + '/meta');
        if (m && m.host === net.uid) { for (const part of ['vault', 'secret', 'state', 'key', 'meta']) await net.set(`${base}/${part}`, null); }
        Store.set('hafla:list', list.filter((y) => y.code !== x.code)); SH.toast('انحذفت الحفلة');
      } catch (e) { SH.toast('ما قدرنا نحذفها الحين. تأكدوا من النت وجرّبوا مرة ثانية'); }
      home(ctx);
    };
    ctx.view(
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🎉'), h('h1', 'حفلتكم على شبّة'), h('p', 'حطّوا صور صاحبة الحفلة وجاوبوا عن أسئلتها، والضيوف يلعبون من جوالاتهم فقرات كلها عنها.')),
      draft && TYPES[draft.type] ? h('div.card', h('h3', 'عندكم حفلة ما كملت'), h('p.muted', `${TYPES[draft.type].emoji} ${TYPES[draft.type].label}${draft.name ? ' · ' + draft.name : ''}`),
        h('div.row', h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); start(Object.assign(blank(draft.type), draft)); } }, 'كمّلوا تجهيزها'),
          h('button.btn', { type: 'button', onclick() { Sound.play('tap'); Store.set('hafla:draft', null); home(ctx); } }, 'امسحوها'))) : null,
      h('p.label', { style: { margin: '0' } }, 'وش المناسبة؟'),
      h('div.hf-types', Object.keys(TYPES).map((k) => h('button.hf-type.dye-' + TYPES[k].color, { id: 'hf-type-' + k, type: 'button', onclick() { Sound.play('pop'); start(blank(k)); } },
        h('span.e', { 'aria-hidden': 'true' }, TYPES[k].emoji), h('b', TYPES[k].label), h('small', TYPES[k].desc)))),
      list.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, 'حفلاتكم الجاهزة'),
        h('div.own-list', list.map((x) => h('div.own-item',
          h('button.t', { type: 'button', style: { textAlign: 'start' }, onclick() { enter(x); } }, `${typeOf(x).emoji} ${title(x)}`, h('small', 'اضغطوا للدخول')),
          h('button.x', { type: 'button', 'aria-label': 'احذفوا الحفلة', onclick() { forget(x); } }, '🗑️')))), status) : null,
      h('div.card', h('h3', 'كيف تمشي؟'), h('ol.steps', [
        'تختارون المناسبة، وتحطّون الاسم والصور، وتجاوبون عن أسئلة صاحبة الحفلة.',
        'ترسلون رابط الدعوة للضيوف، وكل واحد يدخل من جواله. ما يدخل إلا اللي معه الرابط.',
        'تشغّلون الفقرات وحدة ورا الثانية: مين يعرفها أكثر؟ كم كان عمرها في الصورة؟ دفتر الأمنيات، وغيرها.',
        'في الآخر تتويج نجمة الحفلة، ودفتر أمنيات تحفظونه ذكرى.',
      ].map((s) => h('li', s))))
    );
  }

  /* ---------- صفحة الحفلة داخل الغرفة ---------- */
  const zoom = (src) => { const m = SH.modal([h('img.card-preview', { src, alt: 'صورة من الحفلة' }), h('button.btn.btn-block', { type: 'button', onclick() { m.close(); } }, 'تم')]); };
  const ORDER = ['knows', 'ages', 'whois', 'wishes', 'reveal'];

  function edit(R) {
    const p = R.party, pp = R.pp || {}, old = R.photos.slice();
    const draft = Object.assign(blank(p.type), {
      name: p.name, f: !!p.f, photos: old.slice(), gender: pp.gender || '', ans: Object.assign({}, pp.ans || {}), custom: arr(pp.custom),
      ages: old.map((_, i) => { const a = (pp.ages || [])[i]; return a == null || a < 0 ? '' : String(a); }),
    });
    R.leave();
    wizard(R.ctx, draft, {
      edit: true,
      onCancel() { R.back(); },
      async onDone(d) {
        const changed = d.photos.length !== old.length || d.photos.some((x, i) => x !== old[i]);
        await R.setPriv(toPriv(d));
        if (changed) await R.vault.set('photos', d.photos.length ? d.photos : null);
        const np = { name: d.name, f: p.type === 'bday' ? !!d.f : true, pv: (p.pv || 0) + (changed ? 1 : 0) };
        await R.setParty(np);
        remember(R.code, (Store.get('online', null) || {}).k || '', Object.assign({}, p, np));
        SH.toast('انحفظت التعديلات'); R.back();
      },
    });
  }

  async function wishBook(R) {
    Sound.play('pop');
    let list = [];
    try { list = arr(await R.vault.get('wishes')); } catch (e) { /* نعرضه فاضي */ }
    const p = R.party;
    let blob = null;
    if (list.length) keepsake(p, R.photos[0], list).then((b) => { blob = b; });
    const m = SH.modal([
      h('h3', '💌 دفتر الأمنيات'),
      list.length ? h('div.wish-list', list.map((w) => h('div.wish', h('p', w.t), h('b', '— ' + w.n)))) : h('p.muted', 'الدفتر فاضي للحين. شغّلوا فقرة «دفتر الأمنيات» والضيوف يكتبون.'),
      h('div.row',
        list.length ? h('button.btn.btn-gold', { type: 'button', onclick() { Sound.play('pop'); shareKeep(p, blob, list, R.photos[0]); } }, '📥 احفظوه صورة') : null,
        h('button.btn', { type: 'button', onclick() { m.close(); } }, 'تم')),
    ]);
  }

  function lobby(R) {
    const p = R.party, ty = typeOf(p), host = R.isHost(), me = R.me, meta = R.meta, done = meta.done || {};
    const n = R.here().length, cover = R.photos[0], stars = R.starBoard(), starName = ty.star(p);
    const hero = h('div.hf-hero',
      h('div.hf-cover', cover ? h('img', { src: cover, alt: p.name }) : h('span', { 'aria-hidden': 'true' }, ty.emoji), cover ? h('i', { 'aria-hidden': 'true' }, ty.emoji) : null),
      h('p.eyebrow', ty.label), h('h1', p.name),
      p.g ? h('span.pill.gold', p.g === 'g' ? '💗 البيبي بنت' : '💙 البيبي ولد') : null,
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: R.invite }, '📤 أرسلوا رابط الدعوة'),
      h('p.muted.small', 'حفلة خاصة: ما يدخلها إلا اللي معه الرابط.'));
    const strip = R.photos.length > 1 ? h('div.hf-strip', R.photos.map((d, i) => h('button', { type: 'button', 'aria-label': 'كبّروا الصورة ' + (i + 1), onclick() { Sound.play('tap'); zoom(d); } }, h('img', { src: d, alt: '' })))) : null;
    const chip = (x) => {
      const isStar = x.id === p.star;
      const text = x.name + (isStar ? ' ' + ty.emoji : '') + (x.id === meta.host ? ' 👑' : '') + (x.id === me ? ' (أنت)' : '');
      const cls = 'score' + (x.on === false ? '.out' : '') + (isStar ? '.on' : '');
      return host
        ? h('button.' + cls, { type: 'button', style: { '--c': R.colorOf(x.id) }, 'aria-pressed': String(isStar), onclick() { Sound.play('tap'); R.setParty({ star: isStar ? null : x.id }); } }, h('i'), h('span', text))
        : h('div.' + cls, { style: { '--c': R.colorOf(x.id) } }, h('i'), h('span', text));
    };
    const people = h('div.card', h('h3', `الموجودين (${n})`), h('div.scores', R.list().map(chip)),
      host ? h('p.muted.small', { style: { marginTop: '10px' } }, p.star
        ? T(`${R.nameOf(p.star)} {هي|هو} ${starName}: {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}. اضغطوا {اسمها|اسمه} لو تبون تشيلون التاج.`, p)
        : T(`${starName} معكم في الحفلة؟ اضغطوا على {اسمها|اسمه} عشان {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}.`, p)) : null);

    const book = done.wishes ? h('button.btn.btn-block', { type: 'button', onclick() { wishBook(R); } }, '💌 دفتر الأمنيات') : null;
    if (!host) {
      return [hero, strip, people, stars ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, '⭐ نجوم الحفلة'), stars) : null,
        book, h('p.muted.center', 'جهّزوا جوالاتكم… الفقرة الجاية على وشك تبدأ.')];
    }
    const acts = ORDER.map((id) => SH.onlineGames.find((g) => g.id === id)).filter((g) => g && (g.party ? R.offered(g) : true));
    const rest = SH.onlineGames.filter((g) => !g.party && !ORDER.includes(g.id));
    const row = (g, i) => {
      const why = n < g.min ? `تحتاج ${g.min} لاعبين` : g.ready ? g.ready(R) : null;
      return h('button.hf-act' + (done[g.id] ? '.done' : ''), { id: 'act-' + g.id, type: 'button', disabled: !!why, onclick() { Sound.play('pop'); R.act(() => g.start(R)); } },
        h('span.st', done[g.id] ? '✓' : String(i + 1)), h('span.e', { 'aria-hidden': 'true' }, g.emoji),
        h('span.nm', R.label(g), h('small', why || (g.pdesc ? g.pdesc(R) : g.desc))), h('span.go', done[g.id] ? 'نعيدها' : 'ابدأ'));
    };
    return [hero, strip, people,
      h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, 'فقرات الحفلة'), h('div.hf-acts', acts.map(row))),
      stars ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, '⭐ نجوم الحفلة'), stars,
        h('button.btn.btn-gold.btn-block', { id: 'act-finale', type: 'button', onclick() { Sound.play('pop'); R.act(() => finale.start(R)); } }, '🏆 تتويج نجوم الحفلة')) : null,
      book,
      h('details.more', h('summary', 'ألعاب شبّة الثانية'), R.gameTiles(rest)),
      h('button.btn.btn-sm.btn-ghost', { id: 'hf-edit', type: 'button', style: { alignSelf: 'center' }, onclick() { Sound.play('tap'); edit(R); } }, '✏️ عدّلوا الحفلة (الصور والأسئلة)'),
    ];
  }

  /* ---------- الفقرات ---------- */
  const specHint = (R) => (R.me === R.party.star ? T('هالفقرة عنك! {تفرّجي وشوفي مين تعرفك صح|تفرّج وشوف مين يعرفك صح}.', R.party) : 'دخلتوا والفقرة شغّالة، تفرّجوا لين تخلص.');

  /* مين يعرفها أكثر؟ */
  const knowsQs = (R, n) => {
    const p = R.party, pp = R.pp || {}, ans = pp.ans || {}, mk = SH.onlineMk, tag = typeOf(p).star(p);
    const own = arr(pp.custom).map((c) => mk('سؤال خاص', c.q, c.a, arr(c.w).slice(0, 3), 'الجواب: ' + c.a));
    const pre = presets(p.type).filter((x) => ans[x[0]]).map((x) => {
      const a = ans[x[0]];
      return mk(tag, T(x[1], p), a, shuffle(x[2].map((o) => T(o, p)).filter((o) => o !== a)).slice(0, 3), 'الجواب: ' + a);
    });
    return shuffle(shuffle(own).concat(shuffle(pre)).slice(0, n));
  };
  const knowsCount = (R) => { const pp = R.pp || {}, ans = pp.ans || {}; return presets(R.party.type).filter((x) => ans[x[0]]).length + arr(pp.custom).length; };
  SH.onlineQuiz({
    id: 'knows', emoji: '💡', name: 'مين يعرفها أكثر؟', desc: 'أسئلة عنها، والأسرع ياخذ نقاط أكثر', total: 10, secs: 20, party: true,
    title: (R) => `مين يعرف ${R.party.name} أكثر؟`,
    pdesc: (R) => T('أسئلة {عنها|عنه}، والأسرع ياخذ نقاط أكثر', R.party),
    who: (R) => R.guests(), make: knowsQs, specHint,
    ready: (R) => (knowsCount(R) >= 3 ? null : 'جاوبوا على 3 أسئلة على الأقل من «عدّلوا الحفلة»'),
  });

  /* كم كان عمرها؟ */
  const agePhotos = (R) => { const ages = (R.pp && R.pp.ages) || []; return R.photos.map((d, i) => ({ i, age: ages[i] })).filter((x) => x.age != null && x.age >= 0); };
  SH.onlineNumbers({
    id: 'ages', emoji: '📸', name: 'كم كان عمرها؟', desc: 'خمّنوا العمر من الصورة، والأقرب يفوز', party: true,
    title: (R) => T('كم كان {عمرها|عمره}؟', R.party),
    who: (R) => R.guests(), specHint,
    ready: (R) => (agePhotos(R).length >= 2 ? null : 'أضيفوا صورتين على الأقل واكتبوا العمر تحتها من «عدّلوا الحفلة»'),
    make: (R) => shuffle(agePhotos(R)).slice(0, 6).map((x) => ({ t: T('كم كان عمر {n} في هالصورة؟', R.party), a: x.age, u: 'سنة', p: x.i })),
  });

  /* دفتر الأمنيات */
  const wishes = {
    id: 'wishes', emoji: '💌', name: 'دفتر الأمنيات', desc: 'كل واحد يكتب أمنية، وتنحفظ ذكرى', min: 2, party: true, watch: true,
    async start(R) {
      const ids = R.guests();
      if (!ids.length) { SH.toast('ما فيه ضيوف يكتبون للحين'); return; }
      await R.put({ game: 'wishes', step: 'write', who: ids, got: 0 });
    },
    async collect(R) {
      const got = R.got();
      const list = shuffle(Object.keys(got).filter((id) => got[id])).map((id) => ({ id, t: String(got[id]).slice(0, 200) }));
      if (!list.length) { SH.toast('ما أحد كتب أمنية للحين'); return; }
      /* نحفظها في الدفتر (واللي كتب قبل تتحدّث أمنيته) */
      let old = [];
      try { old = arr(await R.vault.get('wishes')); } catch (e) { /* نبدأ دفتر جديد */ }
      const book = old.filter((w) => !list.some((x) => x.id === w.id)).concat(list.map((x) => ({ id: x.id, n: R.nameOf(x.id), t: x.t }))).slice(-40);
      await R.vault.set('wishes', book);
      await R.put({ game: 'wishes', step: 'show', who: R.state.who, list, i: 0, open: false });
    },
    async next(R) {
      const s = R.state;
      if (s.i + 1 >= s.list.length) return R.put({ game: 'wishes', step: 'end', who: s.who, list: s.list });
      await R.step({ i: s.i + 1, open: false });
    },
    auto: { write(R) { if (R.allIn()) R.act(() => wishes.collect(R)); else R.syncGot(); } },
    view(R) {
      const s = R.state, ui = R.ui, mem = R.mem, p = R.party, me = R.me;
      if (s.step === 'write') {
        const ask = h('div.prompt', { style: { minHeight: '0' } }, h('span.tag', 'دفتر الأمنيات'), T(WISH[p.type] || WISH.bday, p));
        const close = (cls) => R.hostBtn('نقرأ الأمنيات الحين', () => wishes.collect(R), cls);
        if (!s.who.includes(me)) return [ask, h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '💌'), h('div.big', me === p.star ? T('الضيوف يكتبون لك…', p) : 'الضيوف يكتبون…'), R.waiting('كتبوا')), close()];
        if (ui.sent != null) return [ask, h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, '💌'), h('div.big', 'وصلت أمنيتك'), R.waiting('ننتظر الباقين')), close('.btn-ghost')];
        ui.freeze = true;   /* لا نعيد رسم الشاشة والواحد يكتب */
        return [ask,
          h('textarea.inp.ta', { id: 'wish', maxLength: 160, rows: 4, placeholder: 'اكتبوا من القلب…', 'aria-label': 'الأمنية', value: mem.wish || '', oninput(e) { mem.wish = e.target.value; } }),
          h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { const v = (mem.wish || '').trim().replace(/\s+/g, ' '); if (!v) { SH.toast('اكتبوا الأمنية أول'); return; } ui.freeze = false; mem.wish = ''; R.send(v); } }, 'أرسلوا الأمنية 💌'),
          close('.btn-ghost')];
      }
      if (s.step === 'show') {
        const w = s.list[s.i], last = s.i + 1 >= s.list.length;
        return [h('div.hud', h('span.pill', `أمنية ${s.i + 1} من ${s.list.length}`)),
          h('div.wish.lg', h('p', w.t), s.open ? h('span.pill', h('i.tdot', { style: { background: R.colorOf(w.id), marginInlineEnd: '0' } }), R.nameOf(w.id)) : h('span.pill', 'مين كتبها؟ 🤔')),
          h('div.spacer'),
          s.open ? R.hostBtn(last ? 'خلّصنا الأمنيات' : 'الأمنية التالية', () => wishes.next(R)) : R.hostBtn('اكشفوا مين كتبها', () => R.step({ open: true })),
          R.isHost() || s.open ? null : h('p.muted.center', 'خمّنوا مين كتبها قبل الكشف!')];
      }
      const list = (s.list || []).map((w) => ({ n: R.nameOf(w.id), t: w.t }));
      if (mem.keepN !== s.n) { mem.keepN = s.n; mem.keep = null; keepsake(p, R.photos[0], list).then((b) => { mem.keep = b; }); }
      return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, '💌'), h('div.big', 'دفتر أمنيات ' + p.name)),
        h('div.wish-list', list.map((w) => h('div.wish', h('p', w.t), h('b', '— ' + w.n)))),
        h('button.btn.btn-gold.btn-block', { type: 'button', onclick() { Sound.play('pop'); shareKeep(p, mem.keep, list, R.photos[0]); } }, '📥 احفظوا الدفتر صورة'),
        h('div.spacer'), R.endButtons(() => wishes.start(R))];
    },
  };
  SH.onlineGame(wishes);

  /* بنت ولا ولد؟ */
  const SIDE_OF = { g: ['💗', 'بنت', 'فريق البنت'], b: ['💙', 'ولد', 'فريق الولد'] };
  const reveal = {
    id: 'reveal', emoji: '🎀', name: 'بنت ولا ولد؟', desc: 'صوّتوا، وبعدها لحظة الكشف', min: 2, party: true, types: ['baby'], watch: true,
    ready: (R) => (R.pp && R.pp.gender ? null : 'اختاروا جنس المولود من «عدّلوا الحفلة»'),
    start: (R) => R.put({ game: 'reveal', step: 'vote', who: R.hereIds(), got: 0 }),
    teams: (R) => R.step({ step: 'teams', votes: R.got(), got: 0 }),
    drum: (R) => R.step({ step: 'drum', at: R.now() + 4200 }),
    async open(R) {
      const g = R.pp && R.pp.gender;
      if (!g) { SH.toast('ما اخترتوا جنس المولود'); return; }
      await R.step({ step: 'end', gender: g });
      await R.setParty({ g });
    },
    auto: {
      vote(R) { if (R.allIn()) R.act(() => reveal.teams(R)); else R.syncGot(); },
      drum(R) { if (R.now() >= R.state.at) R.act(() => reveal.open(R)); },
    },
    view(R) {
      const s = R.state, ui = R.ui, votes = s.votes || {};
      const team = (k) => { const ids = Object.keys(votes).filter((id) => votes[id] === k); return h('div.rv-team.' + k, h('span.e', SIDE_OF[k][0]), h('b', `${SIDE_OF[k][2]} (${ids.length})`), h('small', ids.map((id) => R.nameOf(id)).join('، ') || 'ولا أحد')); };
      if (s.step === 'vote') {
        if (!s.who.includes(R.me)) return [h('div.pass', h('div.big', 'التصويت شغّال…'), R.waiting('صوّتوا'))];
        if (ui.sent != null) return [h('div.pass', h('span', { style: { fontSize: '76px', lineHeight: '1.2' } }, SIDE_OF[ui.sent][0]), h('div.big', 'أنت مع ' + SIDE_OF[ui.sent][2]), R.waiting('ننتظر الباقين')), R.hostBtn('نقفل التصويت', () => reveal.teams(R), '.btn-ghost')];
        return [h('div.center', h('p.eyebrow', 'توقّعكم'), h('div.big', 'البيبي بنت ولا ولد؟')),
          h('div.rv-pick', ['g', 'b'].map((k) => h('button.rv-opt.' + k, { type: 'button', onclick() { R.send(k); } }, h('span.e', SIDE_OF[k][0]), SIDE_OF[k][1])))];
      }
      if (s.step === 'teams') return [h('div.center', h('div.big', 'انقسمت الحفلة!')), h('div.rv-teams', team('g'), team('b')), h('div.spacer'),
        R.hostBtn('🥁 لحظة الكشف!', () => reveal.drum(R)), R.isHost() ? null : h('p.muted.center', 'استعدوا للحظة الكشف…')];
      if (s.step === 'drum') {
        const num = h('div.rv-count', '🥁');
        ui.fast = () => { const left = Math.ceil((s.at - R.now()) / 1000), c = left > 3 ? '🥁' : left > 0 ? String(left) : '✨'; if (c !== ui.c) { ui.c = c; num.textContent = c; Sound.play(left > 3 ? 'tock' : 'tick'); buzz(40); } };
        ui.fast();
        return [h('div.pass', h('p.eyebrow', 'بنت ولا ولد؟'), num, h('p.muted', 'ثواني ونعرف…'))];
      }
      const g = s.gender === 'b' ? 'b' : 'g', win = Object.keys(votes).filter((id) => votes[id] === g).map((id) => R.nameOf(id));
      if (R.mem.rv !== s.n) { R.mem.rv = s.n; Sound.play('win'); buzz([60, 40, 60, 40, 200]); SH.confetti(220); }
      return [h('div.rv-end.' + g, h('span.e', { 'aria-hidden': 'true' }, SIDE_OF[g][0]), h('div.huge', SIDE_OF[g][1] + '!'), h('p', `مبروك يا ${R.party.name} 🎉`)),
        h('div.note', win.length ? [h('b', 'توقّعوها صح: '), win.join('، ')] : 'ولا أحد توقّعها! مفاجأة للكل.'),
        h('div.spacer'), R.hostBtn('نرجع للحفلة', () => R.toLobby())];
    },
  };
  SH.onlineGame(reveal);

  /* تتويج نجوم الحفلة */
  const finale = {
    id: 'finale', emoji: '🏆', name: 'تتويج الحفلة', desc: '', min: 1, party: true, watch: true,
    start: (R) => R.put({ game: 'finale', step: 'end', who: R.hereIds() }),
    view(R) {
      const s = R.state, p = R.party, st = R.stars, ids = Object.keys(st).filter((id) => R.players[id]).sort((a, b) => st[b] - st[a]);
      if (!ids.length) return [h('div.pass', h('div.big', 'ما فيه نجوم للحين'), h('p.muted', 'العبوا فقرة فيها نقاط أول.')), R.hostBtn('نرجع للحفلة', () => R.toLobby())];
      const top = ids.filter((id) => st[id] === st[ids[0]]), medals = ['🥇', '🥈', '🥉'];
      const head = top.map((id) => R.nameOf(id)).join(' و ');
      let place = 0;
      const card = { game: title(p), emoji: typeOf(p).emoji, icon: '🌟', kicker: top.length > 1 ? 'نجوم الحفلة' : 'نجمة الحفلة', headline: head, award: null,
        rows: ids.map((id, i) => { if (i > 0 && st[id] < st[ids[i - 1]]) place = i; return { name: R.nameOf(id), score: '⭐ ' + st[id], medal: medals[place] || String(place + 1) }; }) };
      if (R.mem.fin !== s.n) { R.mem.fin = s.n; R.mem.finBlob = null; Sound.play('win'); buzz([60, 40, 60, 40, 160]); SH.confetti(); if (SH.cardBlob) SH.cardBlob(card).then((b) => { R.mem.finBlob = b; }); }
      return [h('div.podium', h('span.crown', { 'aria-hidden': 'true' }, '🌟'), h('p.eyebrow', card.kicker), h('div.who', head), h('span.award', title(p))),
        R.board(st, null, ids),
        h('div.spacer'),
        SH.share ? h('button.btn.btn-gold.btn-block', { type: 'button', onclick() { Sound.play('pop'); SH.share(card, R.mem.finBlob); } }, '📤 شاركوا التتويج') : null,
        R.hostBtn('نرجع للحفلة', () => R.toLobby(), '.btn')];
    },
  };
  SH.onlineGame(finale);

  /* ---------- دفتر الأمنيات كصورة للذكرى ---------- */
  const TONES = { bride: ['#FFE3EE', '#F9B8D0', '#B4245F'], baby: ['#E2F7F5', '#B5E6E2', '#0D6F6B'], bday: ['#ECE6FF', '#C9BBFA', '#4A2FB8'] };
  function wrap(c, text, max) {
    const lines = []; let line = '';
    String(text).split(/\s+/).forEach((w) => { const t = line ? line + ' ' + w : w; if (line && c.measureText(t).width > max) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }
  async function keepsake(p, cover, list) {
    try {
      const W = 1080, PAD = 80, tone = TONES[p.type] || TONES.bday, items = list.slice(0, 14);
      try { await Promise.all([document.fonts.load('400 90px Lalezar', 'شبّة'), document.fonts.load('600 40px "Readex Pro"', 'شبّة')]); } catch (e) { /* نكمّل بالخط الاحتياطي */ }
      const BODY = '"Readex Pro", Tahoma, Arial, sans-serif', DISPLAY = 'Lalezar, "Readex Pro", Tahoma, sans-serif';
      const m = document.createElement('canvas').getContext('2d'); m.font = `500 38px ${BODY}`;
      const blocks = items.map((w) => ({ w, lines: wrap(m, w.t, W - PAD * 2 - 90) }));
      const top = cover ? 560 : 400, H = top + blocks.reduce((sum, b) => sum + b.lines.length * 58 + 118, 0) + 150;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d'); c.direction = 'rtl'; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, tone[0]); bg.addColorStop(1, tone[1]); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255, 255, 255, .55)';
      for (let i = 0; i < 46; i++) { c.beginPath(); c.arc((i * 397) % W, (i * 263) % H, 5 + (i % 4) * 3, 0, 7); c.fill(); }
      let y = 90;
      if (cover) {
        const img = new Image(); img.src = cover; await img.decode();
        const r = 140, cx = W / 2, cy = y + r, k = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
        c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.closePath(); c.clip();
        c.drawImage(img, cx - (img.naturalWidth * k) / 2, cy - (img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k); c.restore();
        c.lineWidth = 10; c.strokeStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
        y = cy + r + 20;
      }
      c.fillStyle = tone[2]; c.font = `400 86px ${DISPLAY}`; c.fillText('دفتر أمنيات ' + p.name, W / 2, y + 96, W - PAD * 2);
      c.font = `600 34px ${BODY}`; c.fillText(typeOf(p).emoji + ' ' + typeOf(p).label, W / 2, y + 152);
      y = top;
      blocks.forEach((b) => {
        const bh = b.lines.length * 58 + 92;
        c.fillStyle = 'rgba(255, 255, 255, .9)'; c.beginPath();
        const x = PAD, r = 34; c.moveTo(x + r, y); c.arcTo(x + W - PAD * 2, y, x + W - PAD * 2, y + bh, r); c.arcTo(x + W - PAD * 2, y + bh, x, y + bh, r); c.arcTo(x, y + bh, x, y, r); c.arcTo(x, y, x + W - PAD * 2, y, r); c.closePath(); c.fill();
        c.textAlign = 'right'; c.fillStyle = '#2A2140'; c.font = `500 38px ${BODY}`;
        b.lines.forEach((ln, i) => c.fillText(ln, W - PAD - 44, y + 62 + i * 58));
        c.fillStyle = tone[2]; c.font = `700 32px ${BODY}`; c.textAlign = 'left'; c.fillText('— ' + b.w.n, PAD + 44, y + bh - 26);
        c.textAlign = 'center'; y += bh + 26;
      });
      c.fillStyle = tone[2]; c.font = `600 30px ${BODY}`;
      c.fillText(list.length > items.length ? `ومعها ${list.length - items.length} أمنيات ثانية · شبّة` : 'من حفلتكم على شبّة', W / 2, H - 60);
      return await new Promise((res) => cv.toBlob(res, 'image/png'));
    } catch (e) { return null; }
  }
  async function shareKeep(p, ready, list, cover) {
    const blob = ready || (list ? await keepsake(p, cover, list) : null);
    if (!blob) { SH.toast('ما قدرنا نجهّز الصورة على هالجهاز'); return; }
    SH.shareBlob(blob, { file: 'amani.png', text: 'دفتر أمنيات ' + p.name + ' 💌', title: 'دفتر الأمنيات', alt: 'دفتر أمنيات ' + p.name });
  }

  /* ---------- واجهة يستخدمها online.js وباقي الألعاب ---------- */
  SH.hafla = {
    lobby,
    skin: (p) => ({ emoji: typeOf(p).emoji, name: title(p), color: typeOf(p).color, how: [
      'المستضيف يشغّل فقرات الحفلة وحدة ورا الثانية، وكل واحد يجاوب من جواله.',
      T('{صاحبة|صاحب} الحفلة {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}، {لأنها تعرف|لأنه يعرف} الأجوبة.', p),
      'أول ثلاثة في كل فقرة ياخذون نجوم، وفي الآخر تتويج نجوم الحفلة.',
      'الحفلة خاصة: ما يدخلها إلا اللي معه رابط الدعوة.',
    ] }),
    inviteHero: (p) => [h('span.e', { 'aria-hidden': 'true' }, typeOf(p).emoji), h('h1', title(p)), h('p', 'أنتم معزومين! اكتبوا اسمكم وادخلوا الحفلة.')],
    inviteText: (p) => `أنتم معزومين على ${title(p)} 🎉 ادخلوا من الرابط، وجهّزوا جوالاتكم للفقرات:`,
    extra: (p, kind) => ((EXTRA[p.type] || {})[kind] || []).map((s) => T(s, p)),
    types: TYPES,
  };

  SH.add({
    id: 'hafla', hidden: true, name: 'حفلتكم على شبّة', emoji: '🎉', color: 'pink', moods: [],
    tagline: 'توديع عزوبية، بيبي شاور، عيد ميلاد: فقرات كلها عن صاحبة الحفلة.',
    leaveMsg: 'تطلعون؟ اللي جهّزتوه محفوظ على هالجوال وتقدرون ترجعون له.',
    how: [
      'اختاروا المناسبة، وحطّوا اسم صاحبة الحفلة وصورها، وجاوبوا عن أسئلتها.',
      'أرسلوا رابط الدعوة للضيوف، وكل واحد يدخل من جواله.',
      'شغّلوا الفقرات، وفي الآخر تتويج نجوم الحفلة ودفتر أمنيات للذكرى.',
      'جهّزوا الحفلة وشغّلوها من نفس الجوال، لأن التجهيز محفوظ عليه.',
    ],
    start(ctx) {
      if (SH.online && SH.online.available()) return home(ctx);
      ctx.view(h('div.pass', h('span', { style: { fontSize: '72px', lineHeight: '1.2' } }, '🎉'), h('div.big', 'الحفلات قريباً'), h('p.muted', 'نجهّزها الحين.')),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { ctx.home(); } }, 'رجوع للمكتبة'));
    },
  });
})();

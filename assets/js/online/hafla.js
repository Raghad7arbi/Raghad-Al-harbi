/* شبّة — حفلتكم وفعالياتكم: مناسبات الأهل والأصحاب (توديع عزوبية، بيبي شاور، عيد ميلاد) ومناسبات الدوام (فعالية الفريق، توديع زميل، تكريم، ترحيب).
   المنظّم يجهّزها (صور، أجوبة، مجال الشغل)، والضيوف يدخلون برابط دعوة خاص ويلعبون فقرات مخصّصة لهم.
   هي غرفة أونلاين عادية (online.js) فوقها:
     meta.party { type, name, f, star, pv, g, field, tn, tm, tnm }   بيانات تظهر للضيوف
        star = اللي عنه المناسبة لو كان موجود · pv = رقم نسخة الصور · field = مجال الشغل · tn/tm/tnm = عدد الفرق وتوزيعها وأسماؤها
     secret/المستضيف/p { ans, custom, ages, gender }   الأجوبة، تبقى عند المستضيف
     vault/photos و vault/wishes                    الصور ودفتر الأمنيات أو جدار الشكر، لمن معه رابط الدعوة فقط */
(function () {
  'use strict';
  const { h, Sound, buzz, Store, shuffle, PALETTE } = SH;
  const MAXP = 8, SIDE = 720, LIMIT = 170000;   /* عدد الصور، وأطول ضلع، وأقصى حجم للصورة بعد الضغط */
  const digits = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const arr = (v) => (v ? Object.keys(v).map((k) => v[k]) : []);

  /* group: home مناسبات خاصة و work للدوام · gender: نسأل هي ولا هو · office: مناسبة دوام عن شخص · team: فعالية عن الفريق كله
     order: ترتيب الفقرات في البرنامج · note: اسم فقرة الدفتر · book: عنوان الدفتر */
  const PERSON_ORDER = ['knows', 'ages', 'whois', 'wishes', 'reveal'];
  const guest = (p) => (p.f ? 'ضيفة الشرف' : 'ضيف الشرف');
  const TYPES = {
    bride: { group: 'home', emoji: '👰', color: 'pink', label: 'توديع العزوبية', desc: 'سهرة البنات قبل الزواج', who: 'اسم العروس', star: () => 'العروس', title: (p) => 'توديع عزوبية ' + p.name, book: (p) => 'دفتر أمنيات ' + p.name },
    baby: { group: 'home', emoji: '🍼', color: 'teal', label: 'بيبي شاور', desc: 'استقبال المولود وكشف جنسه', who: 'اسم الماما', star: () => 'الماما', title: (p) => 'بيبي شاور ' + p.name, book: (p) => 'دفتر أمنيات ' + p.name },
    bday: { group: 'home', gender: true, emoji: '🎂', color: 'violet', label: 'عيد ميلاد', desc: 'للكبار والصغار', who: 'اسم صاحب أو صاحبة العيد', star: (p) => (p.f ? 'صاحبة العيد' : 'صاحب العيد'), title: (p) => 'عيد ميلاد ' + p.name, book: (p) => 'دفتر أمنيات ' + p.name },
    team: { group: 'work', team: true, emoji: '🤝', color: 'green', label: 'فعالية الفريق', desc: 'تيم بلدنق وأنشطة للفريق كله', who: 'اسم الفريق أو الشركة', star: () => '', title: (p) => 'فعالية ' + p.name, book: (p) => 'جدار الشكر · ' + p.name, order: ['lie', 'knows', 'fieldq', 'whois', 'wyr', 'thanks'] },
    farewell: { group: 'work', office: true, gender: true, emoji: '👋', color: 'sky', label: 'توديع زميل', desc: 'آخر يوم يستاهل ذكرى', who: 'اسم الزميل أو الزميلة', star: guest, title: (p) => 'توديع ' + p.name, note: 'دفتر الوداع', book: (p) => 'دفتر وداع ' + p.name },
    honor: { group: 'work', office: true, gender: true, emoji: '🏅', color: 'gold', label: 'تكريم وترقية', desc: 'احتفلوا بإنجاز زميل', who: 'اسم الزميل أو الزميلة', star: guest, title: (p) => 'تكريم ' + p.name, note: 'دفتر التقدير', book: (p) => 'كلمات تقدير لـ' + p.name },
    welcome: { group: 'work', office: true, gender: true, emoji: '🙌', color: 'orange', label: 'ترحيب بزميل جديد', desc: 'تعرّفوا عليه من أول يوم', who: 'اسم الزميل أو الزميلة', star: guest, title: (p) => 'ترحيب بـ' + p.name, note: 'دفتر الترحيب', book: (p) => 'دفتر ترحيب ' + p.name },
  };
  const PERSON = Object.keys(TYPES).filter((k) => !TYPES[k].team);
  /* قالب النص: {n} الاسم، و {مؤنث|مذكر} حسب الجنس */
  const T = (s, p) => String(s).replace(/\{n\}/g, p.name).replace(/\{([^|{}]*)\|([^{}]*)\}/g, (m, a, b) => (p.f ? a : b));

  /* ---------- الأسئلة الجاهزة: [المعرّف، السؤال، الخيارات] والمنظّم يختار الجواب الصح.
     لو الخيارات نص ('year' أو 'count') فالجواب رقم يكتبه المنظّم والخيارات الغلط تتولّد لحالها ---------- */
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
    /* مناسبات الدوام عن شخص: أسئلة مشتركة، ثم الخاصة بكل مناسبة */
    office: [
      ['coffee', 'وش طلب {n} من الكوفي؟', ['قهوة سوداء', 'لاتيه', 'فلات وايت', 'شاي', 'قهوة عربية', '{ما تشرب قهوة|ما يشرب قهوة}']],
      ['known', 'بإيش {مشهورة|مشهور} {n} في المكتب؟', ['{تحل أي مشكلة|يحل أي مشكلة}', '{ضحكتها تنسمع من بعيد|ضحكته تنسمع من بعيد}', '{قهوتها ما تفارق يدها|قهوته ما تفارق يده}', '{أول وحدة توصل|أول واحد يوصل}', '{دايم مشغولة|دايم مشغول}']],
      ['meet', 'كيف {n} في الاجتماعات؟', ['{تسمع وتكتب|يسمع ويكتب}', '{تسأل كثير|يسأل كثير}', '{تختصر وتخلّص|يختصر ويخلّص}', '{كاميرتها مقفلة دايم|كاميرته مقفلة دايم}']],
      ['peak', 'متى يكون {n} في {أحسن حالاتها|أحسن حالاته}؟', ['أول الصبح', 'بعد القهوة', 'بعد الغدا', 'آخر الدوام']],
      ['desk', 'كيف مكتب {n}؟', ['مرتّب دايم', 'فوضى منظّمة', 'مليان أكواب', 'ما عليه شي']],
      ['lunch', 'وش غدا {n} في الدوام؟', ['طلب من التطبيقات', 'أكل البيت', 'شي خفيف', '{تنسى تتغدى|ينسى يتغدى}']],
    ],
    farewell: [
      ['years', 'كم سنة {اشتغلت|اشتغل} {n} معنا؟', ['أقل من سنة', 'من سنة إلى 3', 'من 3 إلى 5', 'من 5 إلى 10', 'أكثر من 10']],
      ['miss', 'وش أكثر شي {بتفقده|بيفقده} {n} في المكتب؟', ['الزملاء', 'قهوة الصباح', 'سوالف الاستراحة', '{مكتبها|مكتبه}', 'ولا شي 😄']],
      ['next', 'وش أول شي {بتسويه|بيسويه} {n} بعد آخر يوم؟', ['{تنام لين الظهر|ينام لين الظهر}', '{تسافر|يسافر}', '{تبدأ الشغل الجديد على طول|يبدأ الشغل الجديد على طول}', '{تحذف تطبيق الإيميل|يحذف تطبيق الإيميل}']],
    ],
    honor: [
      ['secret', 'وش سر نجاح {n}؟', ['الالتزام بالوقت', 'العلاقة الحلوة مع الكل', 'الشغل بهدوء', '{ما تترك شي ناقص|ما يترك شي ناقص}', 'القهوة ☕']],
      ['after', 'وش أول شي {بتسويه|بيسويه} {n} بعد التكريم؟', ['{تعزم الفريق|يعزم الفريق}', '{تكلّم أهلها|يكلّم أهله}', '{ترجع تكمّل شغلها|يرجع يكمّل شغله}', '{تاخذ إجازة|ياخذ إجازة}']],
      ['years', 'كم سنة {صار لها|صار له} {n} معنا؟', ['أقل من سنة', 'من سنة إلى 3', 'من 3 إلى 5', 'من 5 إلى 10', 'أكثر من 10']],
    ],
    welcome: [
      ['from', 'من وين {جاية|جاي} {n}؟', ['من نفس مجالنا', 'من مجال قريب', 'من مجال مختلف تماماً', '{خريجة جديدة|خريج جديد}']],
      ['style', 'كيف {تحب|يحب} {n} {تشتغل|يشتغل}؟', ['بهدوء وسماعات', 'وسط الفريق والسوالف', 'الصبح بدري', 'آخر الدوام']],
      ['keen', 'وش أكثر شي {متحمسة له|متحمس له} {n} معنا؟', ['المشاريع الجديدة', 'الفريق', 'التعلّم', 'القهوة المجانية 😄']],
    ],
    /* فعالية الفريق: أرقام عن الشركة أو الفريق */
    team: [
      ['year', 'في أي سنة كانت بداية {n}؟', 'year'],
      ['staff', 'كم عدد الموظفين في {n} تقريباً؟', 'count'],
      ['branches', 'كم فرع أو مكتب عند {n}؟', 'count'],
    ],
  };
  const LITE = ['drink', 'food', 'travel', 'sweet', 'sleep', 'season', 'late'];   /* الأسئلة الشخصية اللي تناسب الدوام */
  const presets = (type) => {
    const ty = TYPES[type] || {};
    if (ty.team) return QA.team;
    if (ty.office) return (QA[type] || []).concat(QA.office, QA.all.filter((x) => LITE.includes(x[0])));
    return (QA[type] || []).concat(QA.all);
  };
  /* خيارات غلط قريبة من الرقم الصح (وبنفس دقّته عشان ما ينفضح) */
  const near = (a, kind) => {
    let c;
    if (kind === 'year') { const now = new Date().getFullYear(); c = [-6, -4, -3, -2, -1, 1, 2, 3, 4, 6].map((d) => a + d).filter((y) => y <= now && y > 1800); }
    else if (a <= 12) c = [-3, -2, -1, 1, 2, 3, 4].map((d) => a + d).filter((v) => v > 0);
    else { let g = 1; while (a % (g * 10) === 0 && g * 10 < a) g *= 10; c = [-0.4, -0.25, -0.12, 0.12, 0.25, 0.4, 0.6].map((k) => Math.max(g, Math.round((a + a * k) / g) * g)); }
    return shuffle([...new Set(c)].filter((v) => v !== a)).slice(0, 3).map(String);
  };

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
    farewell: {
      whois: ['بيفقد {n} أكثر واحد', 'بيرسل لـ{n} «وينك؟» بعد أسبوع', 'بياخذ مكتب {n}', 'يعرف {n} من أول يوم', 'بتدمع عينه في آخر لحظة', 'بيزور {n} في {شغلها|شغله} الجديد', 'تعلّم من {n} أكثر شي', 'بيلحق {n} بعد سنة'],
      truth: ['وش أول انطباع أخذته عن {n}؟', 'وش أحلى موقف صار لك مع {n} في الشغل؟', 'وش الشي اللي تعلّمته من {n}؟', 'وش أكثر شي بتفقده في {n}؟'],
      dare: ['قلّد {n} في الاجتماع والباقين يحكمون.', 'قل كلمة وداع لـ{n} كأنك مذيع أخبار.', 'لخّص مشوار {n} معنا في عشر ثواني.', 'ألّف إيميل وداع لـ{n} واقرأه بصوت عالي.'],
    },
    honor: {
      whois: ['فرحان لـ{n} أكثر واحد', 'بيطالب {n} بعزيمة', 'تعلّم من {n} أكثر شي', 'الجاي على التكريم', 'يعرف تعب {n} من ورا الكواليس', 'بيصوّر التكريم وينشره', 'صفّق بأعلى صوت', 'بيقول «أنا اللي {علّمتها|علّمته}»'],
      truth: ['وش أكثر شي يميّز {n} في الشغل؟', 'وش موقف شفت فيه {n} {تبدع|يبدع}؟', 'وش الشي اللي تتمنى تتعلمه من {n}؟', 'وش إنجازك اللي تفتخر فيه هالسنة؟'],
      dare: ['قدّم {n} كأنك مذيع في حفل جوائز.', 'امدح {n} بثلاث كلمات بس.', 'سوّ خطاب استلام جائزة لمدة 15 ثانية.', 'صفّق لـ{n} بأغرب طريقة.'],
    },
    welcome: {
      whois: ['بيعلّم {n} خبايا المكتب', 'بياخذ {n} على أحسن مطعم حول الدوام', 'بيعرّف {n} على الكل', 'بيسأل {n} أكثر أسئلة', 'كان مثل {n} في أول يوم', 'بيشارك {n} القهوة', 'بيحفظ اسم {n} آخر واحد', 'بينسى إن {n} {جديدة ويعطيها|جديد ويعطيه} شغل كثير'],
      truth: ['وش النصيحة اللي تعطيها {n} في أول أسبوع؟', 'وش أغرب شي صار لك في أول يوم دوام؟', 'وش الشي اللي تتمنى أحد قاله لك أول ما توظفت؟', 'وش أحلى شي في فريقنا؟'],
      dare: ['عرّف {n} على الفريق كأنك مرشد سياحي.', 'اشرح لـ{n} شغلك في جملة وحدة.', 'قل لـ{n} ثلاث قوانين غير مكتوبة في المكتب.', 'رحّب بـ{n} بثلاث لهجات.'],
    },
  };
  const WISH = {
    bride: 'اكتبي أمنية أو نصيحة لـ{n} قبل الزواج',
    baby: 'اكتبي أمنية للبيبي أو نصيحة لـ{n}',
    bday: 'اكتبوا أمنية أو كلمة حلوة لـ{n}',
    farewell: 'اكتبوا كلمة وداع أو أمنية لـ{n}',
    honor: 'اكتبوا كلمة تهنئة أو تقدير لـ{n}',
    welcome: 'اكتبوا ترحيب أو نصيحة لـ{n} في أول {أيامها|أيامه}',
  };

  /* ---------- أدوات ---------- */
  const typeOf = (p) => TYPES[p.type] || TYPES.bday;
  const title = (p) => typeOf(p).title(p);
  const noun = (p) => (typeOf(p).group === 'work' ? 'فعالية' : 'حفلة');   /* تنكتب «الحفلة» أو «للحفلة» بإضافة ال أو لل */
  const noteName = (p) => typeOf(p).note || 'دفتر الأمنيات';
  const fieldRow = (p) => SH.OFFICE.list.find((x) => x[0] === p.field) || SH.OFFICE.list[0];
  const fieldOf = (p) => SH.OFFICE.fields[p.field] || null;
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

  const blank = (type) => ({ type, name: '', f: true, field: 'general', host: (Store.get('online', null) || {}).name || '', photos: [], ages: [], gender: '', ans: {}, custom: [] });
  const answered = (d) => presets(d.type).filter((x) => d.ans[x[0]]).length + d.custom.length;
  const toPriv = (d) => {
    const ans = {}; presets(d.type).forEach((x) => { if (d.ans[x[0]]) ans[x[0]] = String(d.ans[x[0]]).slice(0, 40); });
    return {
      ans, custom: d.custom.slice(0, 12),
      ages: d.photos.map((_, i) => { const v = digits(d.ages[i]); return v === '' ? -1 : Math.min(99, Number(v)); }),
      gender: d.type === 'baby' ? d.gender || '' : '',
    };
  };
  /* البيانات العامة اللي تنكتب في meta.party من المسودة */
  const toPublic = (d) => { const ty = TYPES[d.type], p = { name: d.name, f: ty.gender ? !!d.f : true }; if (ty.team) p.field = d.field || 'general'; return p; };
  const remember = (code, k, p) => {
    const list = (Store.get('hafla:list', []) || []).filter((x) => x.code !== code);
    list.unshift({ code, k, name: p.name, type: p.type, f: !!p.f, at: Date.now() });
    Store.set('hafla:list', list.slice(0, 8));
  };

  /* ---------- معالج التجهيز (للإنشاء والتعديل) ---------- */
  function wizard(ctx, draft, opt) {
    const save = () => { if (!opt.edit) Store.set('hafla:draft', draft); };
    const ty = TYPES[draft.type], Noun = 'ال' + noun(draft);
    const person = () => ({ type: draft.type, name: draft.name.trim().replace(/\s+/g, ' ') || (ty.team ? 'الفريق' : 'صاحبة الحفلة'), f: ty.gender ? !!draft.f : true });
    const quizName = (p) => (ty.team ? `تعرفون ${p.name}؟` : T('مين يعرف {n} أكثر؟', p));

    function details() {
      ctx.dirty = true;
      const name = h('input.inp', { id: 'hf-name', type: 'text', maxLength: ty.team ? 22 : 16, autocomplete: 'off', placeholder: ty.who, 'aria-label': ty.who, value: draft.name, oninput(e) { draft.name = e.target.value; }, onchange: save });
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
          ty.team ? null : h('input.inp', { type: 'text', inputMode: 'numeric', maxLength: 2, placeholder: 'العمر؟', 'aria-label': 'العمر في الصورة ' + (i + 1), value: digits(draft.ages[i]), oninput(e) { draft.ages[i] = digits(e.target.value); }, onchange: save }))),
        draft.photos.length < MAXP ? h('button.ph-add', { type: 'button', onclick() { file.click(); } }, h('span', { 'aria-hidden': 'true' }, '＋'), draft.photos.length ? 'صور زيادة' : 'أضيفوا صور') : null);
      draw();
      const next = () => {
        draft.name = draft.name.trim().replace(/\s+/g, ' ');
        if (!draft.name) { SH.toast('اكتبوا ' + ty.who + ' أول'); name.focus(); return; }
        if (host) { draft.host = draft.host.trim().replace(/\s+/g, ' '); if (!draft.host) { SH.toast('اكتبوا اسمكم أول'); host.focus(); return; } }
        Sound.play('pop'); save(); questions();
      };
      ctx.view(
        h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, ty.emoji), h('h1', ty.label), h('p', opt.edit ? 'عدّلوا اللي تبون، والتغيير يوصل للكل مباشرة.' : 'خطوة 1 من 2: الاسم والصور.')),
        h('div.card',
          h('div.field', h('span.label', ty.who), name),
          ty.gender ? h('div.field', h('span.label', ty.office ? 'المناسبة لـ' : 'الحفلة لـ'), SH.seg(ty.office ? [[true, 'زميلة'], [false, 'زميل']] : [[true, 'بنت'], [false, 'ولد']], !!draft.f, (v) => { draft.f = v; save(); })) : null,
          ty.team ? h('div.field', h('span.label', 'مجال الشغل'), SH.seg(SH.OFFICE.list.map((x) => [x[0], x[1] + ' ' + x[2]]), draft.field || 'general', (v) => { draft.field = v; save(); }),
            h('p.muted.small', 'الأسئلة والكلمات في الفقرات تتخصّص على مجالكم.')) : null,
          host ? h('div.field', h('span.label', 'اسمك أنت (اللي يطلع للكل)'), host) : null),
        h('div.card', h('h3', ty.team ? 'الشعار والصور' : 'الصور'),
          h('p.muted.small', ty.team ? `اختياري: حتى ${MAXP} صور، وأول صورة هي غلاف الفعالية، مثل شعار الشركة أو صورة الفريق.`
            : `حتى ${MAXP} صور، وأول صورة هي غلاف ${Noun}. اكتبوا العمر تحت كل صورة عشان تشتغل فقرة «${T('كم كان {عمرها|عمره}؟', person())}».`),
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
        /* سؤال جوابه رقم: المنظّم يكتب الرقم الصح بس */
        if (typeof opts === 'string') {
          const year = opts === 'year', now = new Date().getFullYear();
          return h('div.card.qa', h('p.qa-q', T(q, p)), h('input.inp', { id: 'hf-num-' + id, type: 'text', inputMode: 'numeric', maxLength: year ? 4 : 6, autocomplete: 'off', placeholder: year ? 'مثل: 2015' : 'اكتبوا الرقم', 'aria-label': T(q, p), value: draft.ans[id] || '',
            oninput(e) { const v = Number(digits(e.target.value)); if (v > 0 && (!year || (v > 1800 && v <= now))) draft.ans[id] = String(v); else delete draft.ans[id]; upd(); }, onchange: save }));
        }
        const list = opts.map((o) => T(o, p));
        const other = h('input.inp', { type: 'text', maxLength: 40, autocomplete: 'off', placeholder: 'جواب ثاني؟ اكتبوه هنا', 'aria-label': 'جواب ثاني', value: draft.ans[id] && !list.includes(draft.ans[id]) ? draft.ans[id] : '',
          oninput(e) { const v = e.target.value.trim(); if (v) draft.ans[id] = v; else if (!list.includes(draft.ans[id])) delete draft.ans[id]; paint(); upd(); }, onchange: save });
        const chips = h('div.seg', list.map((o) => h('button', { type: 'button', onclick() { Sound.play('tap'); if (draft.ans[id] === o) delete draft.ans[id]; else { draft.ans[id] = o; other.value = ''; } paint(); upd(); save(); } }, o)));
        const paint = () => [...chips.children].forEach((b, i) => b.setAttribute('aria-pressed', String(draft.ans[id] === list[i])));
        paint();
        return h('div.card.qa', h('p.qa-q', T(q, p)), chips, other);
      });

      /* أسئلتكم الخاصة */
      const cq = h('input.inp', { id: 'hf-cq', type: 'text', maxLength: 90, autocomplete: 'off', placeholder: ty.team ? 'السؤال، مثل: وش اسم أول منتج لنا؟' : T('السؤال، مثل: وش اسم أعز {صديقاتها|أصحابه}؟', p), 'aria-label': 'السؤال' });
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
        if (answered(draft) < 3 && !(await SH.confirm(`فقرة «${quizName(p)}» تحتاج 3 أسئلة على الأقل. تكمّلون بدونها؟`, 'نكمّل بدونها', 'نرجع نجاوب'))) return;
        busy = true; status.textContent = opt.edit ? 'نحفظ التعديلات…' : 'نجهّز كل شي ونرفع الصور…'; Sound.play('pop');
        try { await opt.onDone(draft); } catch (e) { busy = false; status.textContent = ''; Sound.play('bad'); SH.toast(SH.onlineJoinError(e)); }
      };
      ctx.view(
        h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '💡'), h('h1', quizName(p)), h('p', opt.edit ? 'عدّلوا الأجوبة أو زيدوا أسئلة.'
          : ty.team ? 'خطوة 2 من 2: اكتبوا أرقام وأسئلة عن الشركة والفريق، والكل يتسابق عليها.'
            : T('خطوة 2 من 2: جاوبوا عن {n}، أو خلّوا {n} {تجاوب بنفسها|يجاوب بنفسه} قبل. الكل يتسابق مين يعرف الأجوبة.', p))),
        h('div.hud', count, h('span.muted.small', ty.team ? 'اكتبوا الرقم الصح، والخيارات الغلط علينا' : 'جاوبوا على اللي تبون وتخطّوا الباقي')),
        cards,
        h('div.card', h('h3', ty.team ? 'أسئلتكم عن الشركة والفريق' : 'أسئلتكم الخاصة'),
          h('p.muted.small', ty.team ? 'سؤال عن تاريخ الشركة، منتجاتها، أو مواقف الفريق؟ اكتبوه مع جوابه الصح وأجوبة غلط تلخبط.' : 'سؤال ما يعرف جوابه إلا القريبين؟ اكتبوه مع جوابه الصح وأجوبة غلط تلخبط.'),
          h('div.field', cq, ca, cw, h('button.btn.btn-sm', { type: 'button', onclick: addOwn }, '＋ أضيفوا السؤال')), own),
        status,
        h('div.sticky-cta', h('div.row',
          h('button.btn', { type: 'button', style: { flex: '0 1 110px' }, onclick() { Sound.play('tap'); save(); details(); } }, 'رجوع'),
          h('button.btn.btn-primary.btn-xl', { id: 'hf-done', type: 'button', onclick: finish }, opt.edit ? 'احفظوا التعديلات' : '🎉 جهّزوا ' + Noun)))
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
        const p = Object.assign({ type: dr.type, pv: 1 }, toPublic(dr));
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
      busy = true; status.textContent = 'جاري الدخول…'; Sound.play('pop');
      try { await SH.onlineJoin(ctx, { name: name || 'المستضيف', code: x.code, key: x.k }); }
      catch (e) {
        busy = false; status.textContent = ''; Sound.play('bad'); SH.toast(e && e.message === 'noroom' ? 'هذي انتهت وما عادت موجودة' : SH.onlineJoinError(e));
        if (e && e.message === 'noroom') { Store.set('hafla:list', list.filter((y) => y.code !== x.code)); home(ctx); }
      }
    };
    /* حذف نهائي: نمسح الصور والأجوبة من الخادم (لو كانت لنا) ثم نشيلها من القائمة */
    const forget = async (x) => {
      Sound.play('tap');
      if (busy || !(await SH.confirm(`نحذف «${title(x)}» نهائياً مع صورها وكلماتها؟ ما أحد راح يقدر يدخلها بعدها.`, 'احذفوها', 'خلّوها'))) return;
      busy = true; status.textContent = 'نحذف…';
      try {
        const net = await SH.net(), base = 'rooms/' + x.code, m = await net.get(base + '/meta');
        if (m && m.host === net.uid) { for (const part of ['vault', 'secret', 'state', 'key', 'meta']) await net.set(`${base}/${part}`, null); }
        Store.set('hafla:list', list.filter((y) => y.code !== x.code)); SH.toast('انحذفت');
      } catch (e) { SH.toast('ما قدرنا نحذفها الحين. تأكدوا من النت وجرّبوا مرة ثانية'); }
      home(ctx);
    };
    const tiles = (group) => h('div.hf-types' + (group === 'work' ? '.two' : ''), Object.keys(TYPES).filter((k) => TYPES[k].group === group).map((k) => h('button.hf-type.dye-' + TYPES[k].color, { id: 'hf-type-' + k, type: 'button', onclick() { Sound.play('pop'); start(blank(k)); } },
      h('span.e', { 'aria-hidden': 'true' }, TYPES[k].emoji), h('b', TYPES[k].label), h('small', TYPES[k].desc))));
    ctx.view(
      h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🎉'), h('h1', 'حفلتكم على شبّة'), h('p', 'مناسبة خاصة أو فعالية للفريق: تجهّزونها مرة، والكل يلعب من جواله فقرات مخصّصة لكم.')),
      draft && TYPES[draft.type] ? h('div.card', h('h3', 'عندكم تجهيز ما كمل'), h('p.muted', `${TYPES[draft.type].emoji} ${TYPES[draft.type].label}${draft.name ? ' · ' + draft.name : ''}`),
        h('div.row', h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); start(Object.assign(blank(draft.type), draft)); } }, 'كمّلوا تجهيزها'),
          h('button.btn', { type: 'button', onclick() { Sound.play('tap'); Store.set('hafla:draft', null); home(ctx); } }, 'امسحوها'))) : null,
      h('p.label', { style: { margin: '0' } }, 'مناسبات الأهل والأصحاب'), tiles('home'),
      h('p.label', { style: { margin: '0' } }, 'الدوام والفريق'), tiles('work'),
      list.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, 'حفلاتكم الجاهزة'),
        h('div.own-list', list.map((x) => h('div.own-item',
          h('button.t', { type: 'button', style: { textAlign: 'start' }, onclick() { enter(x); } }, `${typeOf(x).emoji} ${title(x)}`, h('small', 'اضغطوا للدخول')),
          h('button.x', { type: 'button', 'aria-label': 'احذفوها نهائياً', onclick() { forget(x); } }, '🗑️')))), status) : null,
      h('div.card', h('h3', 'كيف تمشي؟'), h('ol.steps', [
        'تختارون المناسبة، وتحطّون الاسم والصور، وتجاوبون عن الأسئلة.',
        'ترسلون رابط الدعوة، وكل واحد يدخل من جواله. ما يدخل إلا اللي معه الرابط.',
        'تشغّلون الفقرات وحدة ورا الثانية، والنجوم تتجمّع من فقرة لفقرة.',
        'في الآخر تتويج، ودفتر كلمات تحفظونه ذكرى.',
      ].map((s) => h('li', s))))
    );
  }

  /* ---------- الصفحة داخل الغرفة ---------- */
  const zoom = (src) => { const m = SH.modal([h('img.card-preview', { src, alt: 'صورة' }), h('button.btn.btn-block', { type: 'button', onclick() { m.close(); } }, 'تم')]); };

  function edit(R) {
    const p = R.party, pp = R.pp || {}, old = R.photos.slice();
    const draft = Object.assign(blank(p.type), {
      name: p.name, f: !!p.f, field: p.field || 'general', photos: old.slice(), gender: pp.gender || '', ans: Object.assign({}, pp.ans || {}), custom: arr(pp.custom),
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
        const np = Object.assign(toPublic(d), { pv: (p.pv || 0) + (changed ? 1 : 0) });
        await R.setParty(np);
        remember(R.code, (Store.get('online', null) || {}).k || '', Object.assign({}, p, np));
        SH.toast('انحفظت التعديلات'); R.back();
      },
    });
  }

  const byline = (w) => (w.to ? `من ${w.n} إلى ${w.to}` : '— ' + w.n);
  async function wishBook(R) {
    Sound.play('pop');
    let list = [];
    try { list = arr(await R.vault.get('wishes')); } catch (e) { /* نعرضه فاضي */ }
    const p = R.party;
    let blob = null;
    if (list.length) keepsake(p, R.photos[0], list).then((b) => { blob = b; });
    const m = SH.modal([
      h('h3', typeOf(p).book(p)),
      list.length ? h('div.wish-list', list.map((w) => h('div.wish', h('p', w.t), h('b', byline(w))))) : h('p.muted', 'فاضي للحين.'),
      h('div.row',
        list.length ? h('button.btn.btn-gold', { type: 'button', onclick() { Sound.play('pop'); shareKeep(p, blob, list, R.photos[0]); } }, '📥 احفظوه صورة') : null,
        h('button.btn', { type: 'button', onclick() { m.close(); } }, 'تم')),
    ]);
  }

  /* ----- الفرق داخل فعالية الفريق: النجوم تتجمّع لكل فريق ----- */
  const TEAMS = ['الصقور', 'النشامى', 'الفرسان', 'الذيابة'];
  const teamName = (p, i) => arr(p.tnm)[i] || TEAMS[i];
  const teamOf = (p, id) => { const i = (p.tm || {})[id]; return p.tn && i != null && i < p.tn ? i : -1; };
  const teamTotals = (R) => { const p = R.party, st = R.stars, tot = Array.from({ length: p.tn || 0 }, () => 0); Object.keys(st).forEach((id) => { const i = teamOf(p, id); if (i >= 0) tot[i] += st[id]; }); return tot; };
  const split = (R, n) => {
    const tm = {}; shuffle(R.list().map((x) => x.id)).forEach((id, i) => { tm[id] = i % (n || 1); });
    return R.setParty({ tn: n, tm: n ? tm : null });
  };
  const renameTeams = (R) => {
    const p = R.party, inputs = Array.from({ length: p.tn }, (_, i) => h('input.inp', { type: 'text', maxLength: 16, autocomplete: 'off', value: teamName(p, i), 'aria-label': 'اسم الفريق ' + (i + 1) }));
    const m = SH.modal([h('h3', 'أسماء الفرق'), h('p.muted.small', 'مثل أسماء الإدارات أو الأقسام.'), h('div.field', inputs),
      h('div.row', h('button.btn.btn-primary', { type: 'button', onclick() { R.setParty({ tnm: inputs.map((x, i) => x.value.trim() || TEAMS[i]) }); m.close(); } }, 'حفظ'), h('button.btn', { type: 'button', onclick() { m.close(); } }, 'إلغاء'))]);
  };
  function teamsCard(R) {
    const p = R.party, host = R.isHost(), me = R.me, tot = teamTotals(R), all = R.list();
    const who = (x) => x.name + (x.id === R.meta.host ? ' 👑' : '') + (x.id === me ? ' (أنت)' : '');
    return h('div.card', h('h3', 'دوري الفرق'),
      h('div.tm-list', Array.from({ length: p.tn }, (_, i) => h('div.tm', { style: { '--c': PALETTE[i] } },
        h('div.tm-h', h('b', teamName(p, i)), h('span', '⭐ ' + tot[i])),
        h('div.tm-m', all.filter((x) => teamOf(p, x.id) === i).map((x) => (host
          ? h('button.score' + (x.on === false ? '.out' : ''), { type: 'button', style: { '--c': PALETTE[i] }, 'aria-label': `انقلوا ${x.name} للفريق اللي بعده`, onclick() { Sound.play('tap'); R.setParty({ tm: Object.assign({}, p.tm, { [x.id]: (i + 1) % p.tn }) }); } }, h('i'), h('span', who(x)))
          : h('div.score' + (x.on === false ? '.out' : '') + (x.id === me ? '.on' : ''), { style: { '--c': PALETTE[i] } }, h('i'), h('span', who(x))))))))),
      host ? h('p.muted.small', { style: { marginTop: '10px' } }, 'اضغطوا على أي اسم عشان ينتقل للفريق اللي بعده.') : null);
  }

  function lobby(R) {
    const p = R.party, ty = typeOf(p), host = R.isHost(), me = R.me, meta = R.meta, done = meta.done || {};
    const n = R.here().length, cover = R.photos[0], stars = R.starBoard(), starName = ty.star(p), Noun = 'ال' + noun(p), field = ty.team ? fieldRow(p) : null;
    const hero = h('div.hf-hero',
      h('div.hf-cover', cover ? h('img', { src: cover, alt: p.name }) : h('span', { 'aria-hidden': 'true' }, ty.emoji), cover ? h('i', { 'aria-hidden': 'true' }, ty.emoji) : null),
      h('p.eyebrow', ty.label), h('h1', p.name),
      field && field[0] !== 'general' ? h('span.pill', field[1] + ' ' + field[2]) : null,
      p.g ? h('span.pill.gold', p.g === 'g' ? '💗 البيبي بنت' : '💙 البيبي ولد') : null,
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: R.invite }, '📤 أرسلوا رابط الدعوة'),
      h('p.muted.small', `${noun(p) === 'حفلة' ? 'حفلة خاصة' : 'فعالية خاصة'}: ما يدخلها إلا اللي معه الرابط.`));
    const strip = R.photos.length > 1 ? h('div.hf-strip', R.photos.map((d, i) => h('button', { type: 'button', 'aria-label': 'كبّروا الصورة ' + (i + 1), onclick() { Sound.play('tap'); zoom(d); } }, h('img', { src: d, alt: '' })))) : null;
    const chip = (x) => {
      const isStar = !ty.team && x.id === p.star;
      const text = x.name + (isStar ? ' ' + ty.emoji : '') + (x.id === meta.host ? ' 👑' : '') + (x.id === me ? ' (أنت)' : '');
      const cls = 'score' + (x.on === false ? '.out' : '') + (isStar ? '.on' : '');
      return host && !ty.team
        ? h('button.' + cls, { type: 'button', style: { '--c': R.colorOf(x.id) }, 'aria-pressed': String(isStar), onclick() { Sound.play('tap'); R.setParty({ star: isStar ? null : x.id }); } }, h('i'), h('span', text))
        : h('div.' + cls, { style: { '--c': R.colorOf(x.id) } }, h('i'), h('span', text));
    };
    const people = ty.team && p.tn ? teamsCard(R) : h('div.card', h('h3', `الموجودين (${n})`), h('div.scores', R.list().map(chip)),
      host && !ty.team ? h('p.muted.small', { style: { marginTop: '10px' } }, p.star
        ? T(`${R.nameOf(p.star)} {هي|هو} ${starName}: {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}. اضغطوا {اسمها|اسمه} لو تبون تشيلون التاج.`, p)
        : T(`${starName} معكم؟ اضغطوا على {اسمها|اسمه} عشان {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}.`, p)) : null);
    /* تقسيم الفرق (للمستضيف في فعالية الفريق) */
    const teamCtl = host && ty.team ? h('div.card', h('div.field', h('span.label', 'تبون فرق تتنافس؟ (مثل الإدارات)'),
      SH.seg([[0, 'بدون فرق'], [2, 'فريقين'], [3, '3 فرق'], [4, '4 فرق']], p.tn || 0, (v) => { split(R, v); })),
      p.tn ? h('div.row', { style: { marginTop: '10px' } },
        h('button.btn.btn-sm', { type: 'button', onclick() { Sound.play('pop'); split(R, p.tn); } }, '🔀 وزّعوا من جديد'),
        h('button.btn.btn-sm', { type: 'button', onclick() { Sound.play('tap'); renameTeams(R); } }, '✏️ أسماء الفرق')) : null) : null;
    const myTeam = ty.team && p.tn && !host && teamOf(p, me) >= 0 ? h('p.center', h('span.pill.gold', 'أنت مع ' + teamName(p, teamOf(p, me)))) : null;

    const starsBox = stars ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, '⭐ نجوم ' + Noun), stars,
      host ? h('button.btn.btn-gold.btn-block', { id: 'act-finale', type: 'button', onclick() { Sound.play('pop'); R.act(() => finale.start(R)); } }, '🏆 تتويج نجوم ' + Noun) : null) : null;
    const book = done.wishes || done.thanks ? h('button.btn.btn-block', { type: 'button', onclick() { wishBook(R); } }, ty.team ? '🙏 جدار الشكر' : '💌 ' + noteName(p)) : null;
    if (!host) return [hero, strip, myTeam, people, starsBox, book, h('p.muted.center', 'جهّزوا جوالاتكم… الفقرة الجاية على وشك تبدأ.')];

    const order = ty.order || PERSON_ORDER;
    const acts = order.map((id) => SH.onlineGames.find((g) => g.id === id)).filter((g) => g && (g.party ? R.offered(g) : true));
    const rest = SH.onlineGames.filter((g) => !g.party && !order.includes(g.id));
    const row = (g, i) => {
      const why = n < g.min ? `تحتاج ${g.min} لاعبين` : g.ready ? g.ready(R) : null;
      return h('button.hf-act' + (done[g.id] ? '.done' : ''), { id: 'act-' + g.id, type: 'button', disabled: !!why, onclick() { Sound.play('pop'); R.act(() => g.start(R)); } },
        h('span.st', done[g.id] ? '✓' : String(i + 1)), h('span.e', { 'aria-hidden': 'true' }, g.emoji),
        h('span.nm', R.label(g), h('small', why || (g.pdesc ? g.pdesc(R) : g.desc))), h('span.go', done[g.id] ? 'نعيدها' : 'ابدأ'));
    };
    return [hero, strip, people, teamCtl,
      h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, 'فقرات ' + Noun), h('div.hf-acts', acts.map(row))),
      starsBox, book,
      h('details.more', h('summary', 'ألعاب شبّة الثانية'), R.gameTiles(rest)),
      h('button.btn.btn-sm.btn-ghost', { id: 'hf-edit', type: 'button', style: { alignSelf: 'center' }, onclick() { Sound.play('tap'); edit(R); } }, `✏️ عدّلوا ${Noun} (الصور والأسئلة)`),
    ];
  }

  /* ---------- الفقرات ---------- */
  const backTo = (R) => 'نرجع لل' + noun(R.party);
  const editHint = (R) => `«عدّلوا ال${noun(R.party)}»`;
  const specHint = (R) => (R.me === R.party.star ? T('هالفقرة عنك! {تفرّجي وشوفي مين تعرفك صح|تفرّج وشوف مين يعرفك صح}.', R.party) : 'دخلتوا والفقرة شغّالة، تفرّجوا لين تخلص.');

  /* مين يعرفها أكثر؟ (وفي فعالية الفريق: تعرفون شركتكم؟) */
  const knowsQs = (R, n) => {
    const p = R.party, ty = typeOf(p), pp = R.pp || {}, ans = pp.ans || {}, mk = SH.onlineMk, tag = ty.team ? p.name : ty.star(p);
    const own = arr(pp.custom).map((c) => mk('سؤال خاص', c.q, c.a, arr(c.w).slice(0, 3), 'الجواب: ' + c.a));
    const pre = presets(p.type).filter((x) => ans[x[0]]).map((x) => {
      const a = String(ans[x[0]]);
      const wrong = typeof x[2] === 'string' ? near(Number(a), x[2]) : shuffle(x[2].map((o) => T(o, p)).filter((o) => o !== a)).slice(0, 3);
      return mk(tag, T(x[1], p), a, wrong, 'الجواب: ' + a);
    });
    return shuffle(shuffle(own).concat(shuffle(pre)).slice(0, n));
  };
  const knowsCount = (R) => { const pp = R.pp || {}, ans = pp.ans || {}; return presets(R.party.type).filter((x) => ans[x[0]]).length + arr(pp.custom).length; };
  SH.onlineQuiz({
    id: 'knows', emoji: '💡', name: 'مين يعرفها أكثر؟', desc: 'أسئلة عنها، والأسرع ياخذ نقاط أكثر', total: 10, secs: 20, party: true,
    title: (R) => (typeOf(R.party).team ? `تعرفون ${R.party.name}؟` : `مين يعرف ${R.party.name} أكثر؟`),
    pdesc: (R) => (typeOf(R.party).team ? 'أرقام وأسئلة عن الشركة والفريق' : T('أسئلة {عنها|عنه}، والأسرع ياخذ نقاط أكثر', R.party)),
    who: (R) => R.guests(), make: knowsQs, specHint,
    ready: (R) => (knowsCount(R) >= 3 ? null : `جاوبوا على 3 أسئلة على الأقل من ${editHint(R)}`),
  });

  /* كم كان عمرها؟ */
  const agePhotos = (R) => { const ages = (R.pp && R.pp.ages) || []; return R.photos.map((d, i) => ({ i, age: ages[i] })).filter((x) => x.age != null && x.age >= 0); };
  SH.onlineNumbers({
    id: 'ages', emoji: '📸', name: 'كم كان عمرها؟', desc: 'خمّنوا العمر من الصورة، والأقرب يفوز', party: true, types: PERSON,
    title: (R) => T('كم كان {عمرها|عمره}؟', R.party),
    who: (R) => R.guests(), specHint,
    ready: (R) => (agePhotos(R).length >= 2 ? null : `أضيفوا صورتين على الأقل واكتبوا العمر تحتها من ${editHint(R)}`),
    make: (R) => shuffle(agePhotos(R)).slice(0, 6).map((x) => ({ t: T('كم كان عمر {n} في هالصورة؟', R.party), a: x.age, u: 'سنة', p: x.i })),
  });

  /* فطاحلة المجال: أسئلة من مجال شغل الفريق ومعها شوية من أسئلة الدوام العامة */
  SH.onlineQuiz({
    id: 'fieldq', emoji: '🧠', name: 'فطاحلة المجال', desc: 'أسئلة من مجال شغلكم، والأسرع يكسب', total: 8, secs: 20, party: true, types: ['team'],
    title: (R) => (fieldOf(R.party) ? 'فطاحلة المجال' : 'فطاحلة الدوام'),
    pdesc: (R) => (fieldOf(R.party) ? `أسئلة في ${fieldRow(R.party)[2]}، والأسرع يكسب` : 'أسئلة عامة عن الدوام، والأسرع يكسب'),
    make: (R, n) => {
      const F = fieldOf(R.party), G = SH.OFFICE.general.quiz, row = fieldRow(R.party), gen = '💼 الدوام';
      const rows = F ? shuffle(F.quiz).slice(0, 6).map((q) => [q, row[1] + ' ' + row[2]]).concat(shuffle(G).slice(0, 2).map((q) => [q, gen])) : shuffle(G).map((q) => [q, gen]);
      return shuffle(rows).slice(0, n).map(([q, tag]) => SH.onlineMk(tag, q[0], q[1], q.slice(2, 5)));
    },
  });

  /* الكلمات المكتوبة: دفتر الأمنيات (الكل يكتب لصاحب المناسبة) وكلمة شكر (كل واحد يكتب لزميل ينسحب له) */
  function notes(def) {
    const one = def.pair ? 'كلمة' : 'أمنية', many = def.pair ? 'الكلمات' : 'الأمنيات';
    const g = {
      id: def.id, emoji: def.emoji, name: def.name, desc: def.desc, min: 2, party: true, types: def.types, title: def.title, watch: true,
      async start(R) {
        const ids = def.pair ? R.hereIds() : R.guests();
        if (ids.length < (def.pair ? 2 : 1)) { SH.toast('ما فيه أحد يكتب للحين'); return; }
        let to = null;
        if (def.pair) { const o = shuffle(ids); to = {}; o.forEach((id, i) => { to[id] = o[(i + 1) % o.length]; }); }
        await R.put({ game: def.id, step: 'write', who: ids, to, got: 0 });
      },
      async collect(R) {
        const s = R.state, got = R.got();
        const list = shuffle(Object.keys(got).filter((id) => got[id])).map((id) => { const x = { id, t: String(got[id]).slice(0, 200) }; if (s.to && s.to[id]) x.to = s.to[id]; return x; });
        if (!list.length) { SH.toast('ما أحد كتب للحين'); return; }
        /* نحفظها في الدفتر (واللي كتب قبل لنفس الشخص تتحدّث كلمته) */
        let old = [];
        try { old = arr(await R.vault.get('wishes')); } catch (e) { /* نبدأ دفتر جديد */ }
        const same = (w, x) => w.id === x.id && (w.tid || '') === (x.to || '');
        const fresh = list.map((x) => { const e = { id: x.id, n: R.nameOf(x.id), t: x.t }; if (x.to) { e.tid = x.to; e.to = R.nameOf(x.to); } return e; });
        await R.vault.set('wishes', old.filter((w) => !list.some((x) => same(w, x))).concat(fresh).slice(-40));
        await R.put({ game: def.id, step: 'show', who: s.who, list, i: 0, open: false });
      },
      async next(R) {
        const s = R.state;
        if (s.i + 1 >= s.list.length) return R.put({ game: def.id, step: 'end', who: s.who, list: s.list });
        await R.step({ i: s.i + 1, open: false });
      },
      auto: { write(R) { if (R.allIn()) R.act(() => g.collect(R)); else R.syncGot(); } },
      view(R) {
        const s = R.state, ui = R.ui, mem = R.mem, p = R.party, me = R.me, key = 'note:' + def.id;
        if (s.step === 'write') {
          const text = def.pair ? 'اكتب كلمة شكر أو تقدير لـ' + R.nameOf((s.to || {})[me]) : T(WISH[p.type] || WISH.bday, p);
          const ask = h('div.prompt', { style: { minHeight: '0' } }, h('span.tag', R.label(g)), s.who.includes(me) || !def.pair ? text : 'كل واحد يكتب كلمة شكر لزميل');
          const close = (cls) => R.hostBtn(`نقرأ ${many} الحين`, () => g.collect(R), cls);
          if (!s.who.includes(me)) return [ask, h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, def.emoji), h('div.big', !def.pair && me === p.star ? 'الكل يكتب لك…' : 'الكل يكتب…'), R.waiting('كتبوا')), close()];
          if (ui.sent != null) return [ask, h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, def.emoji), h('div.big', def.pair ? 'وصلت كلمتك' : 'وصلت أمنيتك'), R.waiting('ننتظر الباقين')), close('.btn-ghost')];
          ui.freeze = true;   /* لا نعيد رسم الشاشة والواحد يكتب */
          return [ask,
            h('textarea.inp.ta', { id: 'wish', maxLength: 160, rows: 4, placeholder: 'اكتبوا من القلب…', 'aria-label': 'النص', value: mem[key] || '', oninput(e) { mem[key] = e.target.value; } }),
            h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { const v = (mem[key] || '').trim().replace(/\s+/g, ' '); if (!v) { SH.toast('اكتبوا أول'); return; } ui.freeze = false; mem[key] = ''; R.send(v); } }, def.pair ? 'أرسلوا الكلمة 🙏' : 'أرسلوا الأمنية 💌'),
            close('.btn-ghost')];
        }
        if (s.step === 'show') {
          const w = s.list[s.i], last = s.i + 1 >= s.list.length;
          return [h('div.hud', h('span.pill', `${one} ${s.i + 1} من ${s.list.length}`)),
            h('div.wish.lg', w.to ? h('span.pill.gold', 'إلى ' + R.nameOf(w.to)) : null, h('p', w.t),
              s.open ? h('span.pill', h('i.tdot', { style: { background: R.colorOf(w.id), marginInlineEnd: '0' } }), R.nameOf(w.id)) : h('span.pill', 'مين كتبها؟ 🤔')),
            h('div.spacer'),
            s.open ? R.hostBtn(last ? `خلّصنا ${many}` : `ال${one} التالية`, () => g.next(R)) : R.hostBtn('اكشفوا مين كتبها', () => R.step({ open: true })),
            R.isHost() || s.open ? null : h('p.muted.center', 'خمّنوا مين كتبها قبل الكشف!')];
        }
        const list = (s.list || []).map((w) => ({ n: R.nameOf(w.id), t: w.t, to: w.to ? R.nameOf(w.to) : '' }));
        if (mem.keepN !== s.n) { mem.keepN = s.n; mem.keep = null; keepsake(p, R.photos[0], list).then((b) => { mem.keep = b; }); }
        return [h('div.center', h('span', { style: { fontSize: '70px', lineHeight: '1.2' } }, def.emoji), h('div.big', typeOf(p).book(p))),
          h('div.wish-list', list.map((w) => h('div.wish', h('p', w.t), h('b', byline(w))))),
          h('button.btn.btn-gold.btn-block', { type: 'button', onclick() { Sound.play('pop'); shareKeep(p, mem.keep, list, R.photos[0]); } }, def.pair ? '📥 احفظوا جدار الشكر صورة' : '📥 احفظوا الدفتر صورة'),
          h('div.spacer'), R.endButtons(() => g.start(R))];
      },
    };
    SH.onlineGame(g);
    return g;
  }
  notes({ id: 'wishes', emoji: '💌', name: 'دفتر الأمنيات', desc: 'كل واحد يكتب كلمة، وتنحفظ ذكرى', types: PERSON, title: (R) => noteName(R.party) });
  notes({ id: 'thanks', emoji: '🙏', name: 'كلمة شكر', desc: 'كل واحد يكتب كلمة تقدير لزميل، وتنحفظ على جدار الشكر', types: ['team'], pair: true });

  /* بنت ولا ولد؟ */
  const SIDE_OF = { g: ['💗', 'بنت', 'فريق البنت'], b: ['💙', 'ولد', 'فريق الولد'] };
  const reveal = {
    id: 'reveal', emoji: '🎀', name: 'بنت ولا ولد؟', desc: 'صوّتوا، وبعدها لحظة الكشف', min: 2, party: true, types: ['baby'], watch: true,
    ready: (R) => (R.pp && R.pp.gender ? null : `اختاروا جنس المولود من ${editHint(R)}`),
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
        h('div.spacer'), R.hostBtn(backTo(R), () => R.toLobby())];
    },
  };
  SH.onlineGame(reveal);

  /* التتويج: نجوم الأفراد، ولو فيه فرق فالفايز هو الفريق */
  const finale = {
    id: 'finale', emoji: '🏆', name: 'التتويج', desc: '', min: 1, party: true, watch: true,
    start: (R) => R.put({ game: 'finale', step: 'end', who: R.hereIds() }),
    view(R) {
      const s = R.state, p = R.party, st = R.stars, ids = Object.keys(st).filter((id) => R.players[id]).sort((a, b) => st[b] - st[a]), Noun = 'ال' + noun(p);
      if (!ids.length) return [h('div.pass', h('div.big', 'ما فيه نجوم للحين'), h('p.muted', 'العبوا فقرة فيها نقاط أول.')), R.hostBtn(backTo(R), () => R.toLobby())];
      const medals = ['🥇', '🥈', '🥉'], ranked = (keys, val, name) => { let place = 0; return keys.map((k, i) => { if (i > 0 && val(k) < val(keys[i - 1])) place = i; return { name: name(k), score: '⭐ ' + val(k), medal: medals[place] || String(place + 1) }; }); };
      const teams = typeOf(p).team && p.tn ? teamTotals(R) : null;
      let head, kicker, rows, extra = null;
      if (teams) {
        const order = teams.map((_, i) => i).sort((a, b) => teams[b] - teams[a]), best = order.filter((i) => teams[i] === teams[order[0]]);
        head = best.map((i) => teamName(p, i)).join(' و '); kicker = best.length > 1 ? 'تعادل بين الفرق!' : 'الفريق الفايز';
        rows = ranked(order, (i) => teams[i], (i) => teamName(p, i));
        extra = [h('div.rank', order.map((i, k) => h('div.rank-row', { style: { '--i': k } }, h('span.m', rows[k].medal), h('span.n', h('i.tdot', { style: { background: PALETTE[i] } }), teamName(p, i)), h('span.s', String(teams[i]))))),
          h('p.label', { style: { margin: '0' } }, '⭐ نجوم الأفراد')];
      } else {
        const top = ids.filter((id) => st[id] === st[ids[0]]);
        head = top.map((id) => R.nameOf(id)).join(' و '); kicker = top.length > 1 ? 'نجوم ' + Noun : (noun(p) === 'حفلة' ? 'نجمة الحفلة' : 'نجم الفعالية');
        rows = ranked(ids, (id) => st[id], (id) => R.nameOf(id));
      }
      const card = { game: title(p), emoji: typeOf(p).emoji, icon: '🌟', kicker, headline: head, award: null, rows };
      if (R.mem.fin !== s.n) { R.mem.fin = s.n; R.mem.finBlob = null; Sound.play('win'); buzz([60, 40, 60, 40, 160]); SH.confetti(); if (SH.cardBlob) SH.cardBlob(card).then((b) => { R.mem.finBlob = b; }); }
      return [h('div.podium', h('span.crown', { 'aria-hidden': 'true' }, '🌟'), h('p.eyebrow', kicker), h('div.who', head), h('span.award', title(p))),
        extra, R.board(st, null, ids),
        h('div.spacer'),
        SH.share ? h('button.btn.btn-gold.btn-block', { type: 'button', onclick() { Sound.play('pop'); SH.share(card, R.mem.finBlob); } }, '📤 شاركوا التتويج') : null,
        R.hostBtn(backTo(R), () => R.toLobby(), '.btn')];
    },
  };
  SH.onlineGame(finale);

  /* ---------- الدفتر كصورة للذكرى ---------- */
  const TONES = {
    bride: ['#FFE3EE', '#F9B8D0', '#B4245F'], baby: ['#E2F7F5', '#B5E6E2', '#0D6F6B'], bday: ['#ECE6FF', '#C9BBFA', '#4A2FB8'],
    team: ['#E3F5EC', '#B5E2CB', '#0B5E41'], farewell: ['#E4EEFF', '#BBD3FA', '#1C52B4'], honor: ['#FFF3D1', '#FFDF8A', '#8A5A00'], welcome: ['#FFE9D4', '#FFC993', '#9A4A05'],
  };
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
      c.fillStyle = tone[2]; c.font = `400 86px ${DISPLAY}`; c.fillText(typeOf(p).book(p), W / 2, y + 96, W - PAD * 2);
      c.font = `600 34px ${BODY}`; c.fillText(typeOf(p).emoji + ' ' + typeOf(p).label, W / 2, y + 152);
      y = top;
      blocks.forEach((b) => {
        const bh = b.lines.length * 58 + 92;
        c.fillStyle = 'rgba(255, 255, 255, .9)'; c.beginPath();
        const x = PAD, r = 34; c.moveTo(x + r, y); c.arcTo(x + W - PAD * 2, y, x + W - PAD * 2, y + bh, r); c.arcTo(x + W - PAD * 2, y + bh, x, y + bh, r); c.arcTo(x, y + bh, x, y, r); c.arcTo(x, y, x + W - PAD * 2, y, r); c.closePath(); c.fill();
        c.textAlign = 'right'; c.fillStyle = '#2A2140'; c.font = `500 38px ${BODY}`;
        b.lines.forEach((ln, i) => c.fillText(ln, W - PAD - 44, y + 62 + i * 58));
        c.fillStyle = tone[2]; c.font = `700 32px ${BODY}`; c.textAlign = 'left'; c.fillText(byline(b.w), PAD + 44, y + bh - 26, W - PAD * 2 - 88);
        c.textAlign = 'center'; y += bh + 26;
      });
      c.fillStyle = tone[2]; c.font = `600 30px ${BODY}`;
      c.fillText((list.length > items.length ? `ومعها ${list.length - items.length} ثانية · ` : '') + (noun(p) === 'حفلة' ? 'من حفلتكم على شبّة' : 'من فعاليتكم على شبّة'), W / 2, H - 60);
      return await new Promise((res) => cv.toBlob(res, 'image/png'));
    } catch (e) { return null; }
  }
  async function shareKeep(p, ready, list, cover) {
    const blob = ready || (list ? await keepsake(p, cover, list) : null);
    if (!blob) { SH.toast('ما قدرنا نجهّز الصورة على هالجهاز'); return; }
    const name = typeOf(p).book(p);
    SH.shareBlob(blob, { file: 'shabbah-book.png', text: name, title: name, alt: name });
  }

  /* ---------- واجهة يستخدمها online.js وباقي الألعاب ---------- */
  const pickN = (a, n) => shuffle(a).slice(0, n);
  SH.hafla = {
    lobby, noun, types: TYPES,
    skin: (p) => ({ emoji: typeOf(p).emoji, name: title(p), color: typeOf(p).color, how: typeOf(p).team ? [
      'المستضيف يشغّل الفقرات وحدة ورا الثانية، وكل واحد يجاوب من جواله.',
      'أول ثلاثة في كل فقرة ياخذون نجوم. ولو قسّمتوا فرق، نجوم كل واحد تنحسب لفريقه.',
      'الفعالية خاصة: ما يدخلها إلا اللي معه رابط الدعوة.',
    ] : [
      'المستضيف يشغّل الفقرات وحدة ورا الثانية، وكل واحد يجاوب من جواله.',
      T(`${typeOf(p).office ? '{ضيفة|ضيف} الشرف' : '{صاحبة|صاحب} الحفلة'} {تتفرّج|يتفرّج} في الفقرات اللي {عنها|عنه}، {لأنها تعرف|لأنه يعرف} الأجوبة.`, p),
      'أول ثلاثة في كل فقرة ياخذون نجوم، وفي الآخر التتويج.',
      `ال${noun(p)} خاصة: ما يدخلها إلا اللي معه رابط الدعوة.`,
    ] }),
    inviteHero: (p) => [h('span.e', { 'aria-hidden': 'true' }, typeOf(p).emoji), h('h1', title(p)), h('p', `أنتم معزومين! اكتبوا اسمكم وادخلوا ال${noun(p)}.`)],
    inviteText: (p) => `أنتم معزومين على ${title(p)} 🎉 ادخلوا من الرابط، وجهّزوا جوالاتكم للفقرات:`,
    /* سوالف المناسبة اللي تدخل في «مين فينا؟» و«لو خيّروك» و«دوّر الدلّة» */
    extra(p, kind) {
      const ty = typeOf(p), O = SH.OFFICE.general, F = fieldOf(p);
      if (ty.team) {
        if (kind === 'whois') return (F ? pickN(F.whois, 4) : []).concat(pickN(O.whois, F ? 4 : 8));
        if (kind === 'wyr') return shuffle((F ? F.wyr : []).concat(O.wyr));
        return kind === 'truth' || kind === 'dare' ? O[kind].slice() : [];
      }
      const own = ((EXTRA[p.type] || {})[kind] || []).map((s) => T(s, p));
      return ty.office && (kind === 'truth' || kind === 'dare') ? own.concat(O[kind]) : own;
    },
    /* كلمات الدوام والمجال لـ«مين الدخيل؟» و«بدون كلام»: [المعرّف، الإيموجي، الاسم، الكلمات] */
    words(p) {
      if (typeOf(p).group !== 'work') return [];
      const F = fieldOf(p), row = fieldRow(p), out = [['x-office', '💼', 'الدوام', SH.OFFICE.general.words]];
      if (F) out.push(['x-field', row[1], row[2], F.words]);
      return out;
    },
    /* المستضيف: اللي دخل بعد تقسيم الفرق ينضاف لأصغر فريق */
    tick(R) {
      const p = R.party;
      if (!p || !p.tn || !R.isHost()) return;
      const miss = R.list().filter((x) => teamOf(p, x.id) < 0).map((x) => x.id), key = miss.join(',');
      if (!miss.length) { R.mem.tmKey = ''; return; }
      if (R.mem.tmKey === key) return;
      R.mem.tmKey = key;
      const tm = Object.assign({}, p.tm || {}), size = Array.from({ length: p.tn }, () => 0);
      Object.keys(tm).forEach((id) => { if (tm[id] < p.tn) size[tm[id]]++; });
      miss.forEach((id) => { const i = size.indexOf(Math.min(...size)); tm[id] = i; size[i]++; });
      R.setParty({ tm });
    },
  };

  SH.add({
    id: 'hafla', hidden: true, name: 'حفلتكم على شبّة', emoji: '🎉', color: 'pink', moods: [],
    tagline: 'مناسبات الأهل والأصحاب وفعاليات الدوام: فقرات مخصّصة لكم.',
    leaveMsg: 'تطلعون؟ اللي جهّزتوه محفوظ على هالجوال وتقدرون ترجعون له.',
    how: [
      'اختاروا المناسبة، وحطّوا الاسم والصور، وجاوبوا عن الأسئلة.',
      'أرسلوا رابط الدعوة، وكل واحد يدخل من جواله.',
      'شغّلوا الفقرات، وفي الآخر تتويج ودفتر كلمات للذكرى.',
      'جهّزوها وشغّلوها من نفس الجوال، لأن التجهيز محفوظ عليه.',
    ],
    start(ctx) {
      if (SH.online && SH.online.available()) return home(ctx);
      ctx.view(h('div.pass', h('span', { style: { fontSize: '72px', lineHeight: '1.2' } }, '🎉'), h('div.big', 'قريباً'), h('p.muted', 'نجهّزها الحين.')),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { ctx.home(); } }, 'رجوع للمكتبة'));
    },
  });
})();

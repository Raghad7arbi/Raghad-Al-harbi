/* شبّة — اللعب أونلاين: غرفة برمز، وكل واحد يلعب من جواله.
   بيانات الغرفة (rooms/الرمز):
     meta    { host, created }            يكتبها المستضيف مرة وحدة
     players { uid: { name, c, at, on } } كل لاعب يكتب نفسه
     state   { game, step, n, ... }       الحالة العامة، يكتبها المستضيف فقط
     inbox   { uid: { n, v } }            ردّ كل لاعب على الخطوة رقم n
     secret  { uid: {...} }               معلومة خاصة لكل لاعب (مثل كلمة السالفة)، و h للمستضيف نفسه
   وللحفلات الخاصة (hafla.js): meta.party { type, name, f, star, pv } و secret/المستضيف/p (أجوبة الحفلة)
     key     مفتاح الدعوة السرّي (ما يقرأه أحد)   pass { uid: المفتاح } يكتبه الضيف من رابط الدعوة
     vault   { photos, wishes }           ما ينقرأ إلا لمن مفتاحه صحيح
   جهاز المستضيف هو اللي يحرّك اللعبة: يقرأ الردود ويكتب الحالة الجاية.

   كل لعبة أونلاين تتسجّل بـ SH.onlineGame({ id, emoji, name, desc, min, start(R), auto: { الخطوة(R) }, view(R) })
   و R هو واجهة الغرفة (تحت). الألعاب نفسها في ملفات play-*.js */
(function () {
  'use strict';
  const { h, Sound, buzz, Store, rnd, PALETTE } = SH;
  const params = new URLSearchParams(location.search);
  const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');

  SH.onlineGames = [];
  SH.onlineGame = (g) => { SH.onlineGames.push(g); };

  /* ---------- الدخول ----------
     o: { name, code, key, create, party: { meta, priv, photos } }
     الحفلة الخاصة: مفتاح الدعوة ينكتب مرة وحدة، وكل من يدخل يثبت إنه يعرفه (pass) قبل ما يقرأ أي شي */
  async function join(ctx, o) {
    const net = await SH.net();
    let room = o.code, key = o.key || '';
    if (o.create) {
      for (let k = 0; k < 8; k++) { room = String(100000 + rnd(900000)); if (!(await net.get(`rooms/${room}/meta`))) break; }
      const meta = { host: net.uid, created: net.now() };
      if (o.party) meta.party = o.party.meta; else key = '';
      await net.set(`rooms/${room}/meta`, meta);
      if (o.party) { await net.set(`rooms/${room}/key`, key); await net.set(`rooms/${room}/pass/${net.uid}`, key); }
      await net.set(`rooms/${room}/state`, { game: 'lobby', n: 0 });
      if (o.party) {
        await net.set(`rooms/${room}/secret/${net.uid}`, { p: o.party.priv });
        await net.set(`rooms/${room}/vault/photos`, o.party.photos.length ? o.party.photos : null);
      }
    } else {
      const m = await net.get(`rooms/${room}/meta`);
      if (!m) throw new Error('noroom');
      if (!m.party) key = ''; else if (!key) throw new Error('nokey');
    }
    Store.set('online', { name: o.name, code: room, k: key });
    await openRoom(ctx, net, room, o.name, key);
    return room;
  }
  const joinError = (e) => {
    const m = e && e.message;
    return m === 'noroom' ? 'ما لقينا غرفة بهذا الرمز' : m === 'nokey' ? 'هذي حفلة خاصة. ادخلوا من رابط الدعوة' : m === 'badkey' ? 'رابط الدعوة مو صحيح. اطلبوا الرابط من جديد' : 'ما قدرنا نتصل. تأكدوا من النت وجرّبوا مرة ثانية';
  };
  SH.onlineJoin = join; SH.onlineJoinError = joinError;

  /* ---------- شاشة الدخول ---------- */
  function entry(ctx) {
    const saved = Store.get('online', null) || {};
    const room0 = digits(params.get('room')), invited = room0.length === 6 && !!params.get('k');
    const name = h('input.inp', { id: 'on-name', type: 'text', maxLength: 14, autocomplete: 'off', placeholder: 'اسمك', 'aria-label': 'اسمك', value: saved.name || '' });
    const code = h('input.inp', { id: 'on-code', type: 'text', inputMode: 'numeric', maxLength: 6, autocomplete: 'off', placeholder: 'رمز الغرفة (6 أرقام)', 'aria-label': 'رمز الغرفة', value: room0 || saved.code || '' });
    const status = h('p.muted.center.small', { role: 'status' });
    let busy = false;
    const go = async (create) => {
      if (busy) return;
      const nm = name.value.trim().replace(/\s+/g, ' ');
      const cd = invited ? room0 : digits(code.value);
      if (!nm) { SH.toast('اكتبوا الاسم أول'); name.focus(); return; }
      if (!create && cd.length !== 6) { SH.toast('رمز الغرفة 6 أرقام'); code.focus(); return; }
      busy = true; status.textContent = 'جاري الاتصال…'; Sound.play('pop');
      try {
        await join(ctx, { name: nm, code: cd, create, key: create ? '' : (cd === room0 && params.get('k')) || (saved.code === cd ? saved.k : '') || '' });
      } catch (e) {
        busy = false; status.textContent = ''; Sound.play('bad'); SH.toast(joinError(e));
      }
    };
    const hero = h('div.intro-hero', h('span.e', { 'aria-hidden': 'true' }, '🌐'), h('h1', 'العبوا أونلاين'), h('p', 'واحد يسوّي غرفة ويرسل رمزها، والباقين يدخلون من جوالاتهم.'));
    /* رابط دعوة لحفلة: نعرض اسم الحفلة، والدخول بالاسم بس */
    if (invited) {
      hero.replaceChildren(h('span.e', { 'aria-hidden': 'true' }, '🎉'), h('h1', 'حيّاكم في الحفلة'), h('p', 'اكتبوا اسمكم وادخلوا.'));
      SH.net().then((net) => net.get(`rooms/${room0}/meta`)).then((m) => { if (m && m.party && SH.hafla && hero.isConnected) hero.replaceChildren(...SH.hafla.inviteHero(m.party)); }).catch(() => {});
    }
    ctx.view(
      hero,
      h('div.card', h('div.field', h('span.label', 'الاسم اللي يطلع للباقين'), name)),
      invited ? h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { go(false); } }, 'ادخلوا الحفلة 🎉')
        : [h('div.card', h('div.field', h('span.label', 'عندكم رمز غرفة؟'), code,
          h('button.btn.btn-primary.btn-block', { type: 'button', onclick() { go(false); } }, 'ادخل الغرفة'))),
        h('button.btn.btn-gold.btn-xl.btn-block', { type: 'button', onclick() { go(true); } }, '＋ سوّ غرفة جديدة')],
      status
    );
  }

  /* ---------- الغرفة ---------- */
  async function openRoom(ctx, net, code, myName, key) {
    const base = 'rooms/' + code, me = net.uid;
    let meta = null, players = {}, state = null, inbox = {}, secret = null, party = null;
    let ui = {}, acting = -1, inboxOff = null, conn = true, lastKey = '', lastScene = '', sync = '', awarded = -1;
    let photos = [], pv = -1, skin = '', away = false, marked = '';
    const mem = {};   /* ذاكرة محلية تبقى بين الخطوات (مثل اللي ينكتب في «إنسان حيوان») */
    const box = h('div.view');

    if (key) await net.set(`${base}/pass/${me}`, key).catch(() => {});   /* إثبات إننا دخلنا من رابط الدعوة */
    /* الانضمام (أو الرجوع بنفس المكان) */
    const before = (await net.get(base + '/players')) || {};
    const old = before[me];
    try {
      await net.set(`${base}/players/${me}`, { name: myName, c: old ? old.c : Object.keys(before).length % PALETTE.length, at: old ? old.at : net.now(), on: true });
    } catch (e) { throw new Error(key ? 'badkey' : 'net'); }
    /* ما نبدّل الشاشة إلا بعد نجاح الدخول، عشان لو انرفض تبقى شاشة الدخول قدامه */
    ctx.show(box); ctx.dirty = true;

    const list = () => Object.keys(players).map((id) => Object.assign({ id }, players[id])).sort((a, b) => a.at - b.at);
    const here = () => list().filter((p) => p.on !== false);
    const nameOf = (id) => (players[id] ? players[id].name : 'لاعب');
    const colorOf = (id) => PALETTE[(players[id] ? players[id].c : 0) % PALETTE.length];
    const isOn = (id) => !!players[id] && players[id].on !== false;
    const isHost = () => !!meta && meta.host === me;
    const who = () => (state && state.who) || [];
    const playing = () => who().includes(me);
    const active = () => who().filter(isOn);
    const got = () => { const m = {}; who().forEach((id) => { const x = inbox[id]; if (x && x.n === state.n) m[id] = x.v; }); return m; };
    const allIn = (ids) => { const g = got(), a = (ids || who()).filter(isOn); return a.length > 0 && a.every((id) => id in g); };
    const put = (next) => net.set(base + '/state', Object.assign({}, next, { n: (state ? state.n : 0) + 1 }));
    const send = (v) => {
      ui.sent = v; Sound.play('pop'); buzz(20);
      net.set(`${base}/inbox/${me}`, { n: state.n, v }).catch(() => { ui.sent = undefined; SH.toast('ما وصل ردّك، جرّبوا مرة ثانية'); render(); });
      render();
    };
    /* انتقال يسوّيه المستضيف مرة وحدة لكل خطوة. لو ما غيّر الحالة (مثل نقص اللاعبين) نسمح بالمحاولة مرة ثانية */
    const act = async (fn) => {
      if (!state || acting === state.n) return;
      const n0 = (acting = state.n);
      try { await fn(); if (state && state.n === n0) acting = -1; } catch (e) { acting = -1; SH.toast('انقطع الاتصال، جرّبوا مرة ثانية'); }
    };
    /* عدّاد «كم واحد ردّ» يشوفه الكل. نتذكّر آخر قيمة كتبناها عشان ما نكرر الكتابة */
    const syncGot = () => {
      const c = Object.keys(got()).length, k = state.n + ':' + c;
      if (k === sync || (state.got || 0) === c) return;
      sync = k; net.update(base + '/state', { got: c });
    };
    const game = () => (state ? SH.onlineGames.find((g) => g.id === state.game) : null);
    const toLobby = () => put({ game: 'lobby' });
    const label = (g) => (g.title ? g.title(R) : g.name);
    /* فقرات الحفلة تظهر في غرف الحفلات فقط، وحسب نوع المناسبة */
    const offered = (g) => (g.party ? !!party && (!g.types || g.types.includes(party.type)) : true);
    const link = () => location.origin + location.pathname + '?room=' + code + (key ? '&k=' + encodeURIComponent(key) : '') + '#online';
    const invite = async () => {
      Sound.play('pop');
      const text = party && SH.hafla ? SH.hafla.inviteText(party) : `تعالوا العبوا معنا في شبّة! رمز الغرفة: ${code}`;
      try { if (navigator.share) { await navigator.share({ title: 'شبّة', text, url: link() }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${text}\n${link()}`); SH.toast('انسخ الرابط، أرسلوه للقروب'); } catch (e) { SH.toast(party ? 'ما قدرنا ننسخ الرابط' : 'رمز الغرفة: ' + code); }
    };
    /* الحفلة: نلبّس الصفحة لونها واسمها، ونجيب الصور لو تغيّرت */
    const loadParty = () => {
      party = (meta && meta.party) || null;
      if (!party || !SH.hafla) return;
      const sk = [party.type, party.name, party.f].join('|');
      if (sk !== skin) { skin = sk; ctx.setGame(SH.hafla.skin(party)); }
      if ((party.pv || 0) !== pv) { pv = party.pv || 0; net.get(base + '/vault/photos').then((v) => { photos = v ? Object.keys(v).map((k) => v[k]) : []; render(); }).catch(() => {}); }
    };

    /* ===== عناصر واجهة مشتركة ===== */
    const hostBtn = (label, fn, cls) => (isHost() ? h('button.btn.btn-block' + (cls || '.btn-primary.btn-xl'), { type: 'button', onclick() { Sound.play('pop'); act(fn); } }, label) : null);
    const waiting = (text) => h('p.muted.center', text + (state.got != null ? ` (${state.got} من ${active().length})` : ''));
    const board = (scores, sub, ids) => {
      const rows = (ids || who()).map((id) => ({ id, s: (scores && scores[id]) || 0 })).sort((a, b) => b.s - a.s);
      return h('div.rank', rows.map((r, i) => h('div.rank-row', { style: { '--i': i } }, h('span.m', String(i + 1)), h('span.n', h('i.tdot', { style: { background: colorOf(r.id) } }), nameOf(r.id), sub && sub[r.id] ? h('small', sub[r.id]) : null), h('span.s', String(r.s)))));
    };
    const pickPlayer = (ids) => h('div.votes-grid', ids.map((id) => h('button.vote', { type: 'button', style: { '--c': colorOf(id) }, onclick() { send(id); } }, nameOf(id))));
    const endButtons = (again) => (isHost() ? h('div.row',
      h('button.btn.btn-primary', { type: 'button', onclick() { Sound.play('pop'); act(again); } }, '🔁 جولة جديدة'),
      h('button.btn', { type: 'button', onclick() { Sound.play('tap'); act(toLobby); } }, party ? 'نرجع للحفلة' : 'نغيّر اللعبة')) : h('p.muted.center', party ? 'ننتظر الفقرة الجاية…' : 'المستضيف يختار: جولة جديدة أو لعبة ثانية.'));
    const left = (ends) => Math.max(0, Math.ceil((ends - net.now()) / 1000));
    /* عدّاد وقت يتحدّث لحاله: نص (دقيقة:ثانية) أو شريط */
    const clock = (ends) => { const el = h('span.pill', ''); const up = () => { const s = left(ends); el.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.classList.toggle('gold', s <= 5); }; ui.clocks.push(up); up(); return el; };
    const bar = (ends, dur) => { const el = h('div.bar', h('i')); const up = () => { const p = Math.max(0, Math.min(1, (ends - net.now()) / dur)); el.style.setProperty('--p', String(p)); el.classList.toggle('low', p * dur <= 5000); }; ui.clocks.push(up); up(); return el; };

    /* واجهة الغرفة اللي تستخدمها الألعاب */
    const R = {
      net, me, code, mem,
      get state() { return state; }, get ui() { return ui; }, get secret() { return secret; }, get priv() { return (secret && secret.h) || null; }, get players() { return players; },
      get meta() { return meta; }, get party() { return party; }, get stars() { return (meta && meta.stars) || {}; },
      get photos() { return photos; }, get pp() { return (secret && secret.p) || null; },
      vault: { get: (p) => net.get(`${base}/vault/${p}`), set: (p, v) => net.set(`${base}/vault/${p}`, v) },
      setParty: (obj) => net.update(base + '/meta/party', obj), setPriv: (p) => net.update(`${base}/secret/${me}`, { p }),
      /* ضيوف الفقرة: الموجودين بدون صاحبة الحفلة (هي تتفرج لأنها تعرف الأجوبة) */
      guests: () => here().map((p) => p.id).filter((id) => !party || id !== party.star),
      link, invite, offered, label, ctx,
      /* شاشة مؤقتة فوق الغرفة (مثل تعديل الحفلة)، و back ترجّع الغرفة */
      leave: () => { away = true; }, back: () => { away = false; ctx.show(box); lastKey = ''; render(); },
      now: () => net.now(), list, here, hereIds: () => here().map((p) => p.id), nameOf, colorOf, isOn, isHost, who, active, got, allIn,
      put, step: (patch) => put(Object.assign({}, state, patch)), patch: (obj) => net.update(base + '/state', obj),
      send, act, syncGot, render: () => render(), toLobby,
      /* توزيع جديد لكل الخانات الخاصة (ونحافظ على أجوبة الحفلة عند المستضيف) */
      deal: (map) => { const m = Object.assign({}, map); if (secret && secret.p) m[me] = Object.assign({}, m[me], { p: secret.p }); return net.set(base + '/secret', m); },
      tell: (uid, obj) => net.update(`${base}/secret/${uid}`, obj),      /* معلومة خاصة للاعب واحد */
      keep: (obj) => net.update(`${base}/secret/${me}`, { h: obj }),     /* معلومة يحتفظ بها المستضيف لنفسه */
      hostBtn, waiting, board, pickPlayer, endButtons, left, clock, bar,
    };

    /* لما تخلص لعبة فيها نقاط، أول ثلاثة ياخذون 3 و2 و1 نجمة في ترتيب الغرفة */
    function award() {
      const sc = state.scores || {}, ranked = who().filter((id) => (sc[id] || 0) > 0).sort((a, b) => sc[b] - sc[a]);
      const stars = Object.assign({}, (meta && meta.stars) || {}); let place = 0;
      ranked.forEach((id, i) => { if (i > 0 && sc[id] < sc[ranked[i - 1]]) place = i; if (place < 3) stars[id] = (stars[id] || 0) + (3 - place); });
      net.update(base + '/meta', { stars: Object.keys(stars).length ? stars : null, an: state.n });
    }
    function tick() {
      if (!isHost() || !state) return;
      if (state.step === 'end' && state.scores && meta && meta.an !== state.n && awarded !== state.n) { awarded = state.n; award(); }
      const g = game();
      /* فقرة حفلة خلصت: نعلّم عليها في برنامج الحفلة */
      if (party && g && state.step === 'end' && marked !== state.game && !((meta && meta.done) || {})[state.game]) { marked = state.game; net.update(base + '/meta/done', { [state.game]: true }); }
      const fn = g && g.auto && g.auto[state.step];
      if (fn && acting !== state.n) fn(R);
    }

    /* ترتيب النجوم اللي تجمّعت من الألعاب */
    const starBoard = () => { const st = R.stars, ids = Object.keys(st).filter((id) => players[id]); return ids.length ? board(st, null, ids) : null; };
    const gameTiles = (games) => { const n = here().length; return h('div.tiles', games.map((g) => h('button.pickt', { type: 'button', disabled: n < g.min, title: g.desc, onclick() { Sound.play('pop'); act(() => g.start(R)); } },
      h('span.e', g.emoji), label(g), h('small', n < g.min ? `تحتاج ${g.min} لاعبين` : g.desc)))); };
    R.starBoard = starBoard; R.gameTiles = gameTiles;
    function lobbyView() {
      const n = here().length, stars = starBoard();
      return [
        h('div.center', h('p.eyebrow', 'رمز الغرفة'), h('div.room-code', code), h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: invite }, '📤 أرسلوا الدعوة')),
        h('div.card', h('h3', `الموجودين (${n})`), h('div.scores', list().map((p) => h('div.score' + (p.on === false ? '.out' : ''), { style: { '--c': PALETTE[p.c % PALETTE.length] } }, h('i'), h('span', p.name + (p.id === meta.host ? ' 👑' : '') + (p.id === me ? ' (أنت)' : '')))))),
        stars ? h('div', { style: { display: 'grid', gap: '8px' } }, h('p.label', { style: { margin: '0' } }, '⭐ نجوم الغرفة'), stars) : null,
        isHost()
          ? h('div', { style: { display: 'grid', gap: '10px' } }, h('p.label', { style: { margin: '0' } }, 'اختاروا اللعبة'), gameTiles(SH.onlineGames.filter(offered)))
          : h('p.muted.center', 'ننتظر المستضيف يختار اللعبة…'),
      ];
    }

    function render() {
      if (away) return;
      if (!state || !meta) { box.replaceChildren(h('div.pass', h('div.big', 'جاري الدخول للغرفة…'))); return; }
      const key = `${state.game}:${state.step || ''}:${state.n}`;
      if (ui.key !== key) ui = { key };
      /* لعبة فيها كتابة: ما نعيد رسم الشاشة والواحد يكتب، نحدّث الأجزاء المتغيّرة بس */
      if (key === lastKey && ui.freeze) { if (ui.soft) ui.soft(); return; }
      ui.clocks = [];
      const g = game();
      const hostHere = isOn(meta.host);
      /* اللي مو في الجولة يشوف شاشة انتظار، إلا في فقرات الحفلة (watch) فيتفرّج عليها */
      const body = !g ? (party && SH.hafla ? SH.hafla.lobby(R) : lobbyView())
        : !playing() && !g.watch ? [h('div.pass', h('span', { style: { fontSize: '64px', lineHeight: '1.2' } }, g.emoji), h('div.big', 'اللعبة شغّالة'), h('p.muted', 'تدخلون مع الجولة الجاية. خلّوا الصفحة مفتوحة.'))]
          : g.view(R);
      const tmp = h('div',
        h('div.hud', party ? null : h('span.pill.gold', 'غرفة ' + code), g ? h('span.pill' + (party ? '.gold' : ''), g.emoji + ' ' + label(g)) : party ? h('span.pill.gold', '🎉 الحفلة') : null, h('span.pill', '👥 ' + here().length)),
        conn ? null : h('div.note', h('b', 'انقطع الاتصال عندكم. '), 'نحاول نرجّعه، تأكدوا من النت.'),
        !conn || hostHere || isHost() ? null : h('div.note', 'المستضيف مو متصل الحين. ننتظر رجوعه…'),
        body,
        g && isHost() && state.step !== 'end' ? h('button.btn.btn-sm.btn-ghost', { type: 'button', style: { alignSelf: 'center' }, async onclick() { Sound.play('tap'); if (await SH.confirm(party ? 'تنهون الفقرة وترجعون للحفلة؟' : 'تنهون اللعبة وترجعون للغرفة؟', party ? 'نرجع للحفلة' : 'نرجع للغرفة', 'نكمّل')) act(toLobby); } }, party ? 'نرجع للحفلة' : 'نغيّر اللعبة') : null);
      box.replaceChildren(...tmp.childNodes);
      lastKey = key;
      const scene = g && g.calm && state.step !== 'end' ? state.game : [state.game, state.step, state.i, state.t, state.round].join(':');
      if (scene !== lastScene) { lastScene = scene; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; window.scrollTo(0, 0); }
    }

    /* الاستماع للتغييرات */
    const offs = [
      net.on(base + '/meta', (v) => {
        meta = v; loadParty();
        if (isHost() && !inboxOff) inboxOff = net.on(base + '/inbox', (x) => { inbox = x || {}; tick(); });
        render(); tick();
      }),
      net.on(base + '/players', (v) => { players = v || {}; render(); tick(); }),
      net.on(base + '/state', (v) => { state = v; render(); tick(); }),
      net.on(`${base}/secret/${me}`, (v) => { secret = v; render(); tick(); }),
      net.connected((ok) => {
        conn = ok;
        if (ok) { net.onDisconnect(`${base}/players/${me}/on`, false); net.update(`${base}/players/${me}`, { on: true }); }
        render();
      }),
    ];
    ctx.interval(() => { if (ui.fast) ui.fast(); }, 40);
    ctx.interval(() => { (ui.clocks || []).forEach((f) => f()); tick(); }, 250);
    ctx.onCleanup(() => { offs.forEach((off) => off()); if (inboxOff) inboxOff(); net.update(`${base}/players/${me}`, { on: false }).catch(() => {}); });
  }

  SH.add({
    id: 'online', hidden: true, name: 'العبوا أونلاين', emoji: '🌐', color: 'sky', moods: [],
    tagline: 'واحد يسوّي غرفة، والباقين يدخلون من جوالاتهم برمزها.',
    leaveMsg: 'تطلعون من الغرفة؟ تقدرون ترجعون لها بنفس الرمز.',
    how: [
      'واحد يسوّي غرفة ويرسل رمزها أو رابطها للباقين، وكل واحد يدخل من جواله.',
      'اللي سوّى الغرفة هو المستضيف: يختار اللعبة ويحرّك الجولات. لو طلع توقف اللعبة لين يرجع.',
      'تشتغل والكل في نفس المجلس، أو كل واحد في مكان مع مكالمة جماعية.',
    ],
    start(ctx) {
      if (SH.online.available()) return entry(ctx);
      ctx.view(h('div.pass', h('span', { style: { fontSize: '72px', lineHeight: '1.2' } }, '🌐'), h('div.big', 'اللعب أونلاين قريباً'), h('p.muted', 'نجهّز الغرف الحين. إلى ذلك الوقت، كل الألعاب تشتغل على جوال واحد.')),
        h('button.btn.btn-primary.btn-xl.btn-block', { type: 'button', onclick() { ctx.home(); } }, 'رجوع للمكتبة'));
    },
  });

  /* رابط دعوة فيه رمز الغرفة يفتح شاشة الدخول مباشرة */
  if (params.get('room') && !location.hash && SH.online.available()) location.hash = '#online';
})();

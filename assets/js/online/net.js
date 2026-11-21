/* شبّة — طبقة الاتصال للّعب أونلاين.
   واجهة وحدة فوق Firebase Realtime Database، ومعها محاكاة محلية بين تبويبات نفس المتصفح
   (تشتغل بإضافة ?net=local للرابط) عشان نجرّب ونختبر بدون خادم. */
(function () {
  'use strict';
  const LOCAL = new URLSearchParams(location.search).get('net') === 'local';

  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل ' + src));
    document.head.append(s);
  });

  async function firebaseNet() {
    if (!window.firebase) {
      await loadScript('assets/vendor/firebase-app-compat.js');
      await loadScript('assets/vendor/firebase-auth-compat.js');
      await loadScript('assets/vendor/firebase-database-compat.js');
    }
    const fb = window.firebase;
    if (!fb.apps.length) fb.initializeApp(SH.FIREBASE);
    const cred = await fb.auth().signInAnonymously();
    const db = fb.database();
    let offset = 0;
    db.ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });
    const on = (path, cb) => {
      const r = db.ref(path);
      const fn = r.on('value', (s) => cb(s.val()), () => cb(null));
      return () => r.off('value', fn);
    };
    return {
      uid: cred.user.uid,
      now: () => Date.now() + offset,
      get: (p) => db.ref(p).get().then((s) => s.val()),
      set: (p, v) => db.ref(p).set(v),
      update: (p, v) => db.ref(p).update(v),
      on,
      onDisconnect: (p, v) => db.ref(p).onDisconnect().set(v),
      connected: (cb) => on('.info/connected', (v) => cb(!!v)),
    };
  }

  /* المحاكاة المحلية: كل تبويب يحتفظ بنسخة من البيانات في الذاكرة، والتغييرات تنتقل بين التبويبات
     كعمليات (مسار وقيمة) عبر BroadcastChannel. الحفظ في localStorage فقط عشان التبويب الجديد يبدأ بآخر نسخة. */
  function localNet() {
    const KEY = 'shabbah:netdb';
    const ch = new BroadcastChannel('shabbah-net');
    const subs = new Set();
    const leave = [];
    let uid = sessionStorage.getItem('shabbah:netuid');
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('shabbah:netuid', uid); }
    let db = {};
    try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { db = {}; }
    const at = (path) => { const v = path.split('/').reduce((o, k) => (o == null ? null : o[k]), db); return v == null ? null : JSON.parse(JSON.stringify(v)); };
    const put = ([path, v]) => {
      const ks = path.split('/'); let o = db;
      ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
      if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
    };
    /* نبلّغ المستمع فقط إذا تغيّرت قيمته، مثل Firebase */
    const fire = () => { [...subs].forEach((s) => { const v = at(s.path), j = JSON.stringify(v); if (j !== s.last && subs.has(s)) { s.last = j; s.cb(v); } }); };
    const commit = (ops) => { ops.forEach(put); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* مو مهم */ } ch.postMessage(ops); fire(); };
    ch.onmessage = (e) => { e.data.forEach(put); fire(); };
    addEventListener('pagehide', () => { if (leave.length) commit(leave); });
    return {
      uid,
      now: () => Date.now(),
      get: async (p) => at(p),
      set: async (p, v) => commit([[p, v]]),
      update: async (p, o) => commit(Object.keys(o).map((k) => [p + '/' + k, o[k]])),
      on: (path, cb) => { const s = { path, cb, last: undefined }; subs.add(s); setTimeout(() => { if (subs.has(s) && s.last === undefined) { const v = at(path); s.last = JSON.stringify(v); cb(v); } }, 0); return () => subs.delete(s); },
      onDisconnect: (p, v) => { leave.push([p, v]); },
      connected: (cb) => { setTimeout(() => cb(true), 0); return () => {}; },
    };
  }

  let ready = null;
  SH.online = { available: () => LOCAL || !!SH.FIREBASE, local: LOCAL };
  /* اتصال واحد يُعاد استخدامه طول الجلسة */
  SH.net = () => (ready = ready || (LOCAL ? Promise.resolve(localNet()) : firebaseNet()).catch((e) => { ready = null; throw e; }));
  if (LOCAL) SH.net();   /* نفتح القناة من أول الصفحة عشان ما تفوتنا تغييرات التبويبات الثانية */
})();

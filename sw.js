/* شبّة — عامل الخدمة: يخزّن الملفات عشان الموقع يشتغل بدون نت */
const CACHE = 'shabbah-v6';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/core.js', 'assets/js/share.js', 'assets/js/engines.js',
  'assets/js/data/trivia.js', 'assets/js/data/quiz.js', 'assets/js/data/words.js', 'assets/js/data/social.js',
  'assets/js/data/trivia-2.js', 'assets/js/data/quiz-2.js', 'assets/js/data/words-2.js', 'assets/js/data/social-2.js',
  'assets/js/games/trivia.js', 'assets/js/games/outsider.js', 'assets/js/games/charades.js', 'assets/js/games/social.js',
  'assets/js/games/quizzes.js', 'assets/js/games/party.js', 'assets/js/games/skill.js', 'assets/js/games/tour.js', 'assets/js/games/mine.js',
  'assets/js/online/config.js', 'assets/js/online/net.js', 'assets/js/online/online.js',
  'assets/fonts/lalezar-arabic-400-normal.woff2', 'assets/fonts/lalezar-latin-400-normal.woff2',
  'assets/fonts/readex-pro-arabic-wght-normal.woff2', 'assets/fonts/readex-pro-latin-wght-normal.woff2',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/* نعرض النسخة المخزّنة فوراً ونحدّثها من الشبكة في الخلفية */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

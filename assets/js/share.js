/* شبّة — بطاقة النتيجة: صورة جاهزة للمشاركة في الواتساب والسناب */
(function () {
  'use strict';
  const { h } = SH;
  const W = 1080, H = 1350, BAND = 54;
  const DISPLAY = 'Lalezar, "Readex Pro", Tahoma, sans-serif';
  const BODY = '"Readex Pro", Tahoma, Arial, sans-serif';

  function sadu(c, y) {
    const s = BAND / 28, w = W / s;
    const diamond = (cx, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx, 14 - ry); c.lineTo(cx + rx, 14); c.lineTo(cx, 14 + ry); c.lineTo(cx - rx, 14); c.closePath(); c.fill(); };
    c.save(); c.translate(0, y); c.scale(s, s);
    c.fillStyle = '#1B1730'; c.fillRect(0, 0, w, 28);
    c.fillStyle = '#FFF6E6'; c.fillRect(0, 0, w, 3); c.fillRect(0, 25, w, 3);
    c.fillStyle = '#D8343B'; c.fillRect(0, 3, w, 3); c.fillRect(0, 22, w, 3);
    for (let x = 0; x < w + 56; x += 56) { diamond(x + 14, 8, 6, '#D8343B'); diamond(x + 42, 8, 6, '#FFF6E6'); diamond(x + 28, 4, 5, '#F58A1F'); diamond(x, 4, 5, '#F58A1F'); }
    c.restore();
  }

  function box(c, x, y, w, hgt, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + hgt, r); c.arcTo(x + w, y + hgt, x, y + hgt, r); c.arcTo(x, y + hgt, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* يكتب النص ويصغّره لين يدخل في العرض المتاح */
  function write(c, str, x, y, o) {
    let size = o.size;
    do { c.font = `${o.weight || 600} ${size}px ${o.font || BODY}`; if (c.measureText(str).width <= (o.max || W - 160)) break; size -= 4; } while (size > 22);
    c.textAlign = o.align || 'center'; c.fillStyle = o.color; c.fillText(str, x, y);
    return size;
  }

  /* d: { game, emoji, icon, kicker, headline, award, rows: [{ name, score, medal }] } */
  SH.resultCard = async function (d) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    try { await Promise.all([document.fonts.load('400 120px Lalezar', 'شبّة'), document.fonts.load('600 40px "Readex Pro"', 'شبّة')]); } catch (e) { /* نكمّل بالخط الاحتياطي */ }
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const day = SH.isDay();
    c.direction = 'rtl'; c.textBaseline = 'alphabetic';

    /* الخلفية */
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, v('--bg')); bg.addColorStop(1, v('--bg2'));
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W * 0.82, 120, 0, W * 0.82, 120, 760);
    glow.addColorStop(0, day ? 'rgba(255, 176, 46, .40)' : 'rgba(255, 138, 31, .26)'); glow.addColorStop(1, 'rgba(255, 138, 31, 0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    if (!day) {
      c.fillStyle = 'rgba(255, 246, 230, .8)';
      [[90, 150, 3], [220, 420, 2], [150, 760, 2.5], [960, 520, 2], [1000, 900, 3], [70, 1130, 2], [880, 1190, 2.5], [520, 110, 2], [330, 980, 2]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
    }
    sadu(c, 0); sadu(c, H - BAND);

    /* الشعار */
    c.font = `400 156px ${DISPLAY}`; c.textAlign = 'center';
    c.fillStyle = 'rgba(120, 30, 10, .5)'; c.fillText('شبّة', W / 2, 206);
    const fire = c.createLinearGradient(0, 74, 0, 216);
    fire.addColorStop(0.1, '#FFE38F'); fire.addColorStop(0.45, '#FFB02E'); fire.addColorStop(0.75, '#FF6A2B'); fire.addColorStop(1, '#E2343B');
    c.fillStyle = fire; c.fillText('شبّة', W / 2, 199);
    write(c, 'ألعاب الجَمعة السعودية', W / 2, 280, { size: 34, color: v('--muted') });

    /* اسم اللعبة */
    const label = `${d.emoji} ${d.game}`;
    c.font = `400 44px ${DISPLAY}`;
    const pw = Math.min(W - 200, c.measureText(label).width + 90);
    box(c, (W - pw) / 2, 308, pw, 74, 37); c.fillStyle = v('--surface'); c.fill();
    write(c, label, W / 2, 361, { size: 44, font: DISPLAY, weight: 400, color: v('--ink'), max: pw - 50 });

    /* الفايز (بدون ترتيب ننزّله لوسط البطاقة) */
    let y = d.rows.length ? 504 : 680;
    c.font = `400 112px ${BODY}`; c.textAlign = 'center'; c.fillStyle = v('--ink'); c.fillText(d.icon, W / 2, y);
    y += 62; write(c, d.kicker, W / 2, y, { size: 36, weight: 700, color: v('--accent'), max: W - 140 });
    y += 114; write(c, d.headline, W / 2, y, { size: d.rows.length ? 118 : 130, font: DISPLAY, weight: 400, color: day ? '#C0650A' : '#FFC83D', max: W - 140 });
    if (d.award) {
      y += 34;
      c.font = `700 34px ${BODY}`;
      const aw = Math.min(W - 200, c.measureText(d.award).width + 80);
      box(c, (W - aw) / 2, y, aw, 64, 32); c.fillStyle = '#FFC83D'; c.fill();
      write(c, d.award, W / 2, y + 44, { size: 34, weight: 700, color: '#33230A', max: aw - 44 });
      y += 64;
    }

    /* الترتيب: نعرض اللي يكفيه المكان (حتى 6) */
    if (d.rows.length) {
      const top = y + 40, room = H - BAND - 92 - top, gap = 14;
      let n = Math.min(d.rows.length, 6);
      while (n > 1 && (room - gap * (n - 1)) / n < 54) n--;
      const rh = Math.min(88, (room - gap * (n - 1)) / n);
      const fs = Math.round(rh * 0.42);
      d.rows.slice(0, n).forEach((r, i) => {
        const ry = top + i * (rh + gap), first = i === 0;
        box(c, 90, ry, W - 180, rh, Math.min(26, rh / 2)); c.fillStyle = first ? '#FFC83D' : v('--surface'); c.fill();
        const ink = first ? '#33230A' : v('--ink'), base = ry + rh / 2 + fs * 0.36;
        write(c, r.medal, W - 150, base, { size: fs + 4, font: DISPLAY, weight: 400, color: ink, max: 80 });
        write(c, r.name, W - 205, base, { size: fs, weight: 700, color: ink, align: 'right', max: W - 520 });
        write(c, r.score, 130, base, { size: fs + 8, font: DISPLAY, weight: 400, color: ink, align: 'left', max: 200 });
      });
    }

    /* العنوان */
    const site = /^https?:$/.test(location.protocol) ? (location.host + location.pathname).replace(/(index\.html)?$/, '').replace(/\/$/, '') : '';
    write(c, site ? 'العبوها معنا: ' + site : 'العبوها معنا في شبّة', W / 2, H - BAND - 34, { size: 30, color: v('--muted'), max: W - 160 });
    return cv;
  };

  /* يشارك الصورة مباشرة لو الجهاز يدعم، وإلا يعرضها للحفظ والتنزيل */
  SH.cardBlob = async function (d) {
    try { const cv = await SH.resultCard(d); return await new Promise((res) => cv.toBlob(res, 'image/png')); } catch (e) { return null; }
  };

  /* o: { file, text, title, alt } */
  SH.shareBlob = async function (blob, o) {
    try {
      const file = new File([blob], o.file, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: o.text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(blob);
    const m = SH.modal([
      h('h3', o.title),
      h('img.card-preview', { src: url, alt: o.alt }),
      h('p.muted.small.center', 'اضغطوا مطوّلاً على الصورة لحفظها، أو نزّلوها من الزر.'),
      h('div.row',
        h('a.btn.btn-gold', { href: url, download: o.file }, '⬇️ تنزيل الصورة'),
        h('button.btn', { type: 'button', onclick() { m.close(); setTimeout(() => URL.revokeObjectURL(url), 400); } }, 'تم')),
    ]);
  };

  SH.share = async function (d, ready) {
    const blob = ready || (await SH.cardBlob(d));
    if (!blob) { SH.toast('ما قدرنا نجهّز الصورة على هالجهاز'); return; }
    return SH.shareBlob(blob, { file: 'shabbah.png', text: `${d.emoji} ${d.game} في شبّة: ${d.headline}`, title: 'بطاقة النتيجة', alt: 'بطاقة نتيجة ' + d.game });
  };
})();

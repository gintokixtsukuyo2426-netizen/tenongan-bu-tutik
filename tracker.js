/**
 * Heatmap Tracker - tahap 1 (pengumpul data)
 * Merekam posisi klik, elemen yang diklik, scroll depth, dan durasi.
 * TIDAK membaca isi form (nama pembeli, dll).
 * Pasang di landing page: <script src="tracker.js"></script> sebelum </body>
 */
(function () {
  // === PENGATURAN ===
  var API_URL = 'https://script.google.com/macros/s/AKfycbzuwu--if6qM-2noPwhKM_llrdYAso4Jn8qRhPL0PSa8mUJgMY5chE5j8vhcoy_DArE/exec'; // URL /exec yang sama dengan rotator
  var HALAMAN = 'landing';                       // nama halaman ini di data
  // ==================

  if (API_URL.indexOf('script.google.com') === -1) return; // belum diisi: tracker mati
       if (window.self !== window.top) return; // jangan merekam saat dibuka di halaman heatmap

  var q = new URLSearchParams(location.search);
  var iklan = {
    sumber: q.get('utm_source') || q.get('src') || '',
    kampanye: q.get('utm_campaign') || '',
    adset: q.get('utm_term') || '',
    iklan: q.get('utm_content') || ''
  };

  var sesi = ambilSesi();
  var mulai = Date.now();
  var klikBaru = [];
  var totalKlik = 0;
  var scrollMax = 0;
  var scrollTerkirim = -1;
  var menunggu = false;

  function ambilSesi() {
    try {
      var s = sessionStorage.getItem('hm_sesi');
      if (!s) {
        s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionStorage.setItem('hm_sesi', s);
      }
      return s;
    } catch (e) {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
  }

  function tinggiDokumen() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }

  function lebarDokumen() {
    return Math.max(document.documentElement.scrollWidth, window.innerWidth);
  }

  // Deskripsi elemen: tag, id, teks tombol/link, judul kartu, dan bagian halaman
  function deskripsi(el) {
    var t = el.closest ? (el.closest('a, button, input, select, textarea, label, [id]') || el) : el;
    var tag = t.tagName ? t.tagName.toLowerCase() : 'elemen';
    var hasil = tag + (t.id ? '#' + t.id : '');
    if (tag === 'a' || tag === 'button') {
      var teks = (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (teks) hasil += ' "' + teks + '"';
    }
    var kartu = t.closest('.menu-card, .card, .testi-card, .order-card');
    var judul = kartu ? kartu.querySelector('h2, h3, h4') : null;
    if (judul) hasil += ' [' + judul.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) + ']';
    var bagian = t.closest('section[id]');
    if (bagian) hasil += ' @' + bagian.id;
    return hasil;
  }

  function ukurScroll() {
    var terlihat = (window.pageYOffset || document.documentElement.scrollTop) + window.innerHeight;
    var persen = Math.min(100, Math.round(terlihat / tinggiDokumen() * 100));
    if (persen > scrollMax) scrollMax = persen;
  }

  document.addEventListener('click', function (ev) {
    if (totalKlik >= 200) return; // batas per kunjungan
    totalKlik++;
    klikBaru.push({
      x: Math.round(ev.pageX / lebarDokumen() * 1000) / 1000,
      y: Math.round(ev.pageY),
      el: deskripsi(ev.target)
    });
  }, true);

  window.addEventListener('scroll', function () {
    if (menunggu) return;
    menunggu = true;
    requestAnimationFrame(function () { ukurScroll(); menunggu = false; });
  }, { passive: true });

  function kirim() {
    ukurScroll();
    if (klikBaru.length === 0 && scrollMax === scrollTerkirim) return; // tidak ada yang baru

    var isi = JSON.stringify({
      sesi: sesi,
      halaman: HALAMAN,
      sumber: iklan.sumber,
      kampanye: iklan.kampanye,
      adset: iklan.adset,
      iklan: iklan.iklan,
      vw: document.documentElement.clientWidth,
      dh: tinggiDokumen(),
      scroll: scrollMax,
      detik: Math.round((Date.now() - mulai) / 1000),
      totalKlik: totalKlik,
      klik: klikBaru
    });
    klikBaru = [];
    scrollTerkirim = scrollMax;

    var terkirim = false;
    try {
      if (navigator.sendBeacon) {
        terkirim = navigator.sendBeacon(API_URL, new Blob([isi], { type: 'text/plain;charset=UTF-8' }));
      }
    } catch (e) {}
    if (!terkirim) {
      try {
        fetch(API_URL, { method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'text/plain' }, body: isi });
      } catch (e) {}
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') kirim();
  });
  window.addEventListener('pagehide', kirim);
  setInterval(kirim, 30000); // jaga-jaga untuk browser in-app yang tidak memicu pagehide

  ukurScroll();
})();

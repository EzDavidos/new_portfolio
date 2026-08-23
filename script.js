/* ============================================================
   David Naumenko — landing
   Состояние шапки, мобильное меню, scroll reveal, активный пункт
   навигации и живые значения статус-рейла.
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- шапка ---------- */
  var header = document.getElementById('header');
  var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 12); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- мобильное меню ---------- */
  var burger = document.querySelector('.burger');
  var sheet = document.getElementById('sheet');

  function setSheet(open) {
    sheet.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  burger.addEventListener('click', function () { setSheet(sheet.hidden); });
  sheet.addEventListener('click', function (e) { if (e.target.closest('a')) setSheet(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheet.hidden) setSheet(false);
  });
  window.matchMedia('(min-width: 860px)').addEventListener('change', function (e) {
    if (e.matches && !sheet.hidden) setSheet(false);
  });

  /* ============================================================
     СТАТУС-РЕЙЛ — живые значения
     Показываем только то, что действительно правда: местное время
     Нячанга и число дней с запуска. Ничего не выдумываем; если JS
     не отработал, в разметке остаются прочерки, а не ложные данные.
     ============================================================ */
  var rail = document.querySelector('.rail__inner');

  // дни в проде — считаем от даты запуска в атрибуте data-since на рейле.
  // Дата живёт в одном месте: её же число показывает блок про 100ловую.
  var days = null;
  if (rail) {
    var since = new Date(rail.dataset.since + 'T00:00:00+07:00');
    if (!isNaN(since)) {
      var d = Math.floor((Date.now() - since.getTime()) / 86400000);
      if (d >= 0) days = d;
    }
  }

  if (days !== null) {
    // 1 день / 2 дня / 5 дней — иначе счётчик читается коряво
    var t10 = days % 10, t100 = days % 100, word;
    if (t10 === 1 && t100 !== 11) word = 'день';
    else if (t10 >= 2 && t10 <= 4 && (t100 < 12 || t100 > 14)) word = 'дня';
    else word = 'дней';

    var daysEl = rail.querySelector('[data-days]');
    if (daysEl) daysEl.textContent = days + ' ' + word;

    // в блоке продукта слово уже стоит в подписи — там нужна голая цифра
    Array.prototype.forEach.call(document.querySelectorAll('[data-days-num]'), function (el) {
      el.textContent = days;
    });
  }

  // часы Нячанга — реальное местное время, а не эмуляция.
  // Их два: в статус-рейле и в футере.
  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    var fmt = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    var tick = function () {
      var now = fmt.format(new Date()) + ' ICT';
      Array.prototype.forEach.call(clocks, function (el) { el.textContent = now; });
    };
    tick();
    // раз в 15 с: минута успевает смениться, а таймер почти ничего не стоит
    setInterval(tick, 15000);
  }

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    var bySection = new Map();
    reveals.forEach(function (el) {
      var sec = el.closest('section') || document.body;
      var n = bySection.get(sec) || 0;
      bySection.set(sec, n + 1);
      el.style.transitionDelay = Math.min(n, 5) * 60 + 'ms';
      io.observe(el);
    });

    // Первая проверка наблюдателя проходит до загрузки веб-шрифтов.
    // Шрифты приходят, вёрстка съезжает — и элемент, уже стоящий на
    // экране, остаётся с opacity:0 навсегда, потому что скроллить
    // нечего. Поэтому досматриваем видимое вручную после load и шрифтов.
    var showVisible = function () {
      reveals.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    };
    window.addEventListener('load', showVisible);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(showVisible);
  }

  /* ---------- видео-демо: не крутим его без нужды ----------
     autoplay стоит в разметке, но с prefers-reduced-motion ролик
     останавливаем на постере, а за экраном — ставим на паузу,
     чтобы не жечь батарею на телефоне. */
  Array.prototype.forEach.call(document.querySelectorAll('.shot--video'), function (v) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.removeAttribute('autoplay');
      v.pause();
      return;
    }
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 }).observe(v);
  });

  /* ---------- активный пункт навигации ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    targets.forEach(function (t) { navIO.observe(t); });
  }
})();

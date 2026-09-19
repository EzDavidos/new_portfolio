/* ============================================================
   David Naumenko — landing
   Состояние шапки, мобильное меню, scroll reveal, активный пункт
   навигации и живые значения статус-рейла.
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- строки интерфейса ----------
     Тексты, которые рисует сам скрипт. Страница каждого языка своя
     (/uk/, /en/), а script.js один на всех — поэтому язык берём с
     <html lang>, а переводы держим здесь. Новый язык — новый ключ с
     тем же набором строк; {n}, {tg} и {old} подставляются на месте. */
  var STR = {
    ru: {
      prevShot: 'Предыдущий экран',
      nextShot: 'Следующий экран',
      shotNo: 'Экран {n}: ',
      zoomHint: 'Нажмите, чтобы увеличить',
      tgLink: 'напишите в Telegram',
      formEmpty: 'Заполните все три поля — так я пойму, с чем помочь и куда ответить.',
      formSending: 'Отправляю…',
      formFail: 'Не получилось отправить. Текст на месте — попробуйте ещё раз или {tg}.',
      hotPrice: 'Горячая цена',
      hotWas: ', горячая цена, было ${old}'
    },
    vi: {
      prevShot: 'Màn hình trước',
      nextShot: 'Màn hình sau',
      shotNo: 'Màn hình {n}: ',
      zoomHint: 'Chạm để phóng to',
      tgLink: 'nhắn cho mình qua Telegram',
      formEmpty: 'Hãy điền cả ba ô — để mình hiểu cần giúp gì và trả lời vào đâu.',
      formSending: 'Đang gửi…',
      formFail: 'Gửi không thành công. Nội dung vẫn còn đây — hãy thử lại hoặc {tg}.',
      hotPrice: 'Giá ưu đãi',
      hotWas: ', giá ưu đãi, trước đây là ${old}'
    },
    en: {
      prevShot: 'Previous screen',
      nextShot: 'Next screen',
      shotNo: 'Screen {n}: ',
      zoomHint: 'Tap to zoom',
      tgLink: 'message me on Telegram',
      formEmpty: 'Fill in all three fields — that way I will know what to help with and where to reply.',
      formSending: 'Sending…',
      formFail: 'Could not send. Your text is still here — try again or {tg}.',
      hotPrice: 'Hot price',
      hotWas: ', hot price, was ${old}'
    },
    uk: {
      prevShot: 'Попередній екран',
      nextShot: 'Наступний екран',
      shotNo: 'Екран {n}: ',
      zoomHint: 'Натисніть, щоб збільшити',
      tgLink: 'напишіть у Telegram',
      formEmpty: 'Заповніть усі три поля — так я зрозумію, з чим допомогти і куди відповісти.',
      formSending: 'Надсилаю…',
      formFail: 'Не вдалося надіслати. Текст на місці — спробуйте ще раз або {tg}.',
      hotPrice: 'Гаряча ціна',
      hotWas: ', гаряча ціна, було ${old}'
    }
  };
  var T = STR[document.documentElement.lang] || STR.ru;

  /* ---------- аналитика GA4 + согласие на cookies ----------
     Пока человек не выбрал, gtag.js не грузится вовсе и cookies нет:
     события ждут в pending. «Принять» — накопленное уходит, gtag.js
     грузится после отрисовки, когда браузер свободен; «Отклонить» —
     накопленное выбрасывается. Выбор живёт в localStorage 12 месяцев,
     потом баннер спросит снова. Рекламные сигналы запрещены всегда. */
  var GA_ID = 'G-2BSQFHXPFP';
  var CONSENT_KEY = 'dn_consent';
  var CONSENT_TTL = 365 * 864e5;
  var analytics = null;   // null — ещё не выбрал
  var gaOn = false;
  var pending = [];

  window.dataLayer = window.dataLayer || [];
  var gtag = function () { window.dataLayer.push(arguments); };

  var gaStart = function () {
    window['ga-disable-' + GA_ID] = false;
    if (gaOn) { gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    gaOn = true;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID);
    pending.forEach(function (e) { gtag('event', e[0], e[1]); });
    pending = [];
    var add = function () {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(s);
    };
    var idle = function () {
      if ('requestIdleCallback' in window) requestIdleCallback(add, { timeout: 3000 });
      else setTimeout(add, 1500);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle);
  };

  // отзыв согласия: GA замолкает, его cookies стираются
  var gaStop = function () {
    pending = [];
    if (gaOn) {
      gtag('consent', 'update', { analytics_storage: 'denied' });
      window['ga-disable-' + GA_ID] = true;
    }
    var host = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^_ga(_|$)/.test(name)) return;
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
        document.cookie = name + '=; Max-Age=0; path=/' + d;
      });
    });
  };

  var setAnalytics = function (on) {
    analytics = on;
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: on, at: Date.now() })); } catch (e) {}
    if (on) gaStart(); else gaStop();
  };

  try {
    var saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (saved && Date.now() - saved.at < CONSENT_TTL) analytics = !!saved.analytics;
  } catch (e) {}
  if (analytics) gaStart();

  var track = function (name, params) {
    if (analytics) gtag('event', name, params || {});
    else if (analytics === null && pending.length < 50) pending.push([name, params || {}]);
  };

  // Нажатия на Telegram — с местом, откуда нажали. В окне кейса место — id кейса.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="https://t.me/davidnaumenko"]');
    if (!a) return;
    var where;
    if (a.closest('#case')) where = document.getElementById('case').dataset.case || 'case';
    else if (a.closest('.request, .request__done')) where = 'form';
    else if (a.closest('.plan')) where = a.closest('.plan').id;
    else if (a.closest('footer')) where = 'footer';
    else {
      var box = a.closest('#header, #sheet, section[id]');
      where = box ? ({ header: 'header', sheet: 'menu', top: 'hero', contact: 'final' })[box.id] || box.id : 'other';
    }
    track('tg_click', { location: where });
  });

  // глубина прокрутки: по разу за визит
  var depth = [50, 90];
  var onDepth = function () {
    var seen = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
    while (depth.length && seen >= depth[0]) track('scroll_' + depth.shift());
    if (!depth.length) window.removeEventListener('scroll', onDepth);
  };
  window.addEventListener('scroll', onDepth, { passive: true });

  /* ---------- cookie-баннер ----------
     Сам всплывает, пока выбора нет. Из футера («Настройки cookies») и по
     ссылке /#cookies со страницы политики открывается сразу с настройками —
     там же согласие можно отозвать. */
  var cc = document.getElementById('cookies');
  if (cc) {
    var ccPrefs = document.getElementById('cc-prefs');
    var ccBox = document.getElementById('cc-analytics');
    var ccBtn = function (k) { return cc.querySelector('[data-cc="' + k + '"]'); };
    var ccFrom = null;   // откуда открыли — туда вернуть фокус

    var ccMode = function (prefs) {
      ccPrefs.hidden = !prefs;
      ccBtn('accept').hidden = ccBtn('reject').hidden = ccBtn('prefs').hidden = prefs;
      ccBtn('save').hidden = !prefs;
      ccBtn('prefs').setAttribute('aria-expanded', String(prefs));
    };
    var ccOpen = function (prefs) {
      ccBox.checked = analytics === true;
      ccMode(prefs);
      cc.hidden = false;
      if (prefs) ccBox.focus();
    };

    cc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cc]');
      if (!b) return;
      if (b.dataset.cc === 'prefs') { ccMode(true); ccBox.focus(); return; }
      setAnalytics(b.dataset.cc === 'accept' || b.dataset.cc === 'save' && ccBox.checked);
      cc.hidden = true;
      if (ccFrom) { ccFrom.focus(); ccFrom = null; }
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cookie-settings]');
      if (!t) return;
      e.preventDefault();
      ccFrom = t;
      ccOpen(true);
    });

    if (location.hash === '#cookies') {
      history.replaceState(null, '', location.pathname + location.search);
      ccOpen(true);
    } else if (analytics === null) ccOpen(false);
  }

  /* ---------- шапка ---------- */
  var header = document.getElementById('header');
  var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 12); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- тема ----------
     Стартовую тему ставит скрипт в <head> (до отрисовки). Здесь только
     переключатель: нажатие запоминает выбор, и дальше сайт держит его.
     Пока выбора нет, тема идёт за системой — в том числе если её
     переключили при открытой странице. Вода в water.js смотрит на
     атрибут data-scheme сама. */
  var SCHEME_KEY = 'dn_scheme';
  var root = document.documentElement;
  var schemeBtn = document.querySelector('.scheme');
  var schemeMeta = document.querySelector('meta[name="theme-color"]');
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)');

  function setScheme(s, smooth) {
    var go = function () {
      root.setAttribute('data-scheme', s);
      if (schemeMeta) schemeMeta.content = s === 'dark' ? '#1E2334' : '#0C7A5D';
      if (schemeBtn) schemeBtn.setAttribute('aria-pressed', String(s === 'dark'));
    };
    // плавная смена — снимком страницы, там где браузер это умеет
    if (smooth && !reduced && document.startViewTransition) document.startViewTransition(go);
    else go();
  }

  if (schemeBtn) {
    schemeBtn.setAttribute('aria-pressed', String(root.getAttribute('data-scheme') === 'dark'));
    schemeBtn.addEventListener('click', function () {
      var s = root.getAttribute('data-scheme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(SCHEME_KEY, s); } catch (e) {}
      setScheme(s, true);
    });
  }
  sysDark.addEventListener('change', function (e) {
    var saved = null;
    try { saved = localStorage.getItem(SCHEME_KEY); } catch (err) {}
    if (saved !== 'light' && saved !== 'dark') setScheme(e.matches ? 'dark' : 'light', true);
  });

  /* ---------- язык ----------
     Список языков — нативный <details>, он раскрывается и без скрипта.
     Здесь только три мелочи: закрыть по клику мимо и по Esc и дотащить
     открытый раздел (якорь) до выбранной версии страницы. */
  var langBox = document.querySelector('[data-lang]');
  if (langBox) {
    document.addEventListener('click', function (e) {
      if (langBox.open && !langBox.contains(e.target)) langBox.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && langBox.open) {
        langBox.open = false;
        langBox.querySelector('summary').focus();
      }
    });
    langBox.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lang-to]');
      if (a && location.hash) a.hash = location.hash.slice(1);
    });
  }

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
     Нячанга. Ничего не выдумываем; если JS не отработал, в разметке
     остаётся прочерк, а не ложные данные.
     ============================================================ */
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

  /* ---------- масштаб гомографии в мокапе FlyGuru ----------
     matrix3d в .fgh__screen задана в пикселях канвы мокапа (1151px).
     CSS сам поделить ширину сцены на 1151 не умеет, поэтому коэффициент
     приходит отсюда. До первого замера --fgh-k = 0, и ролик не виден:
     лучше пустой экран, чем ролик во всю страницу. */
  var fghStage = document.querySelector('.fgh__stage');
  if (fghStage) {
    var setK = function () {
      fghStage.style.setProperty('--fgh-k', fghStage.clientWidth / 1151);
    };
    setK();
    if ('ResizeObserver' in window) new ResizeObserver(setK).observe(fghStage);
    else window.addEventListener('resize', setK);
    /* ResizeObserver ловит не всё: если первый замер попал на кадр до
       раскладки, ширина сцены дальше может не измениться, и коэффициент
       застрянет неверным. Дешевле пересчитать ещё раз по загрузке. */
    window.addEventListener('load', setK);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setK);
  }

  /* ============================================================
     ОКНО КЕЙСА
     Наполнение лежит в <template id="case-<id>"> рядом с карточкой:
     пока окно не открыто, его картинки не грузятся вовсе. Открыть
     можно кнопкой с data-case="<id>" или ссылкой #case-<id> — такую
     удобно сразу скинуть клиенту. «Назад» на телефоне закрывает окно,
     а не уводит с сайта: при открытии в историю кладётся шаг с хэшем.
     ============================================================ */
  var cv = document.getElementById('case');
  if (cv && typeof cv.showModal === 'function') {
    var cvId = cv.querySelector('[data-cv-id]');
    var cvBody = cv.querySelector('[data-cv-body]');
    var cvZoom = cv.querySelector('.cv__zoom');
    var cvSheet = cv.querySelector('.cv__sheet');
    var cvPhone = window.matchMedia('(max-width: 859px)');
    var cvPushed = false;
    var cvCur = null;   // id открытого кейса
    var g = null;       // лента текущего кейса

    var arrowSvg = function (d) {
      return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="' + d +
        '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };

    // Размер кадра считается здесь, а не в CSS: кадр ограничен и высотой
    // сцены, и шириной экрана, а пропорция у ПК- и телефонной версии
    // одного экрана разная. Размеры берутся из атрибутов width/height,
    // поэтому раскладка готова до загрузки картинок и не прыгает.
    var cvLayout = function () {
      cvPlace();
      if (!g) return;
      var H = g.probe.offsetHeight, MW = g.probe.offsetWidth, phone = cvPhone.matches;
      g.slides.forEach(function (s) {
        var src = s.querySelector('source'), img = s.querySelector('img');
        var el = phone && src ? src : img;
        var r = el.getAttribute('width') / el.getAttribute('height');
        var h = Math.min(H, MW / r), w = h * r;
        img.style.width = Math.round(w) + 'px';
        img.style.height = Math.round(h) + 'px';
        s.style.width = phone ? '' : Math.round(w) + 'px';
        s.classList.toggle('is-wide', phone && r > 1.2);
      });
      var gap = parseFloat(getComputedStyle(g.track).columnGap) || 0;
      var tw = g.track.clientWidth, n = g.slides.length;
      var pad = function (s) { return Math.max(0, (tw - s.offsetWidth) / 2 - gap) + 'px'; };
      g.track.style.setProperty('--cv-pl', pad(g.slides[0]));
      g.track.style.setProperty('--cv-pr', pad(g.slides[n - 1]));
      cvGo(g.on, true);
    };

    var cvSet = function (i) {
      if (!g || i === g.on && g.slides[i].classList.contains('is-on')) return;
      g.on = i;
      g.slides.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
      g.count.textContent = (i + 1) + ' / ' + g.slides.length;
      g.prev.disabled = i === 0;
      g.next.disabled = i === g.slides.length - 1;
      g.thumbs.forEach(function (t, k) { t.setAttribute('aria-current', String(k === i)); });
      var t = g.thumbs[i], box = t.parentNode;
      if (t.offsetLeft < box.scrollLeft || t.offsetLeft + t.offsetWidth > box.scrollLeft + box.clientWidth) {
        box.scrollLeft = t.offsetLeft - (box.clientWidth - t.offsetWidth) / 2;
      }
      var ch = g.slides[i].dataset.chapter;
      g.chapters.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.chapter === ch)); });
    };

    var cvGo = function (i, instant) {
      if (!g) return;
      i = Math.max(0, Math.min(g.slides.length - 1, i));
      var s = g.slides[i];
      // пока лента плавно едет к кадру, промежуточные кадры не считаются
      // активными — иначе быстрые нажатия стрелки теряются по дороге
      g.lock = i;
      clearTimeout(g.lockT);
      g.lockT = setTimeout(cvUnlock, 1500);
      g.track.scrollTo({
        left: s.offsetLeft + s.offsetWidth / 2 - g.track.clientWidth / 2,
        behavior: instant || reduced ? 'auto' : 'smooth'
      });
      cvSet(i);
    };

    // снимается по scrollend; таймер — запасной путь для Safari, где этого события нет
    var cvUnlock = function () {
      if (!g || g.lock === null) return;
      clearTimeout(g.lockT);
      g.lock = null;
      cvScroll();
    };

    // активный кадр — тот, чей центр ближе к центру ленты
    var cvTick = false;
    var cvScroll = function () {
      if (cvTick) return;
      cvTick = true;
      requestAnimationFrame(function () {
        cvTick = false;
        if (!g) return;
        var c = g.track.scrollLeft + g.track.clientWidth / 2, best = 0, dist = Infinity;
        g.slides.forEach(function (s, k) {
          var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - c);
          if (d < dist) { dist = d; best = k; }
        });
        if (g.lock !== null) { if (best !== g.lock) return; g.lock = null; }
        cvSet(best);
      });
    };

    var cvBuild = function () {
      var track = cvBody.querySelector('.cv__track');
      if (!track) { g = null; return; }
      var slides = Array.prototype.slice.call(track.querySelectorAll('.cv__slide'));

      // Первыми идут кадры под текущий экран: на телефоне — телефонные,
      // на десктопе — ПК. Широкий кадр на телефоне — полоса с пустотой
      // под ней, а на десктопе открывать кейс с узкого телефона незачем.
      // Порядок меняется внутри главы, чтобы главы не перемешались; главы,
      // где такие кадры есть, идут первыми. Какой кадр телефонный, решает
      // то, что он покажет сейчас: у пары <source> на телефоне это
      // телефонная версия, на десктопе — ПК.
      var phone = cvPhone.matches;
      var fits = function (s) {
        var src = s.querySelector('source'), img = s.querySelector('img');
        var el = phone && src ? src : img;
        return (el.getAttribute('width') / el.getAttribute('height') < 1.2) === phone;
      };
      var names = [];
      slides.forEach(function (s) { if (names.indexOf(s.dataset.chapter) < 0) names.push(s.dataset.chapter); });
      var hasFit = function (n) { return slides.some(function (s) { return s.dataset.chapter === n && fits(s); }); };
      names = names.filter(hasFit).concat(names.filter(function (n) { return !hasFit(n); }));
      var order = [];
      names.forEach(function (n) {
        var inCh = slides.filter(function (s) { return s.dataset.chapter === n; });
        order = order.concat(inCh.filter(fits), inCh.filter(function (s) { return !fits(s); }));
      });
      order.forEach(function (s) { track.appendChild(s); });
      slides = order;

      var stage = document.createElement('div');
      stage.className = 'cv__stage';
      track.parentNode.insertBefore(stage, track);
      stage.appendChild(track);
      var probe = document.createElement('div');
      probe.className = 'cv__probe';
      probe.setAttribute('aria-hidden', 'true');
      stage.appendChild(probe);

      var prev = document.createElement('button'), next = document.createElement('button');
      prev.type = next.type = 'button';
      prev.className = 'cv__arrow cv__arrow--prev';
      next.className = 'cv__arrow cv__arrow--next';
      prev.setAttribute('aria-label', T.prevShot);
      next.setAttribute('aria-label', T.nextShot);
      prev.innerHTML = arrowSvg('M12.5 4.5 7 10l5.5 5.5');
      next.innerHTML = arrowSvg('M7.5 4.5 13 10l-5.5 5.5');
      stage.appendChild(prev);
      stage.appendChild(next);

      // строка над лентой: главы и счётчик
      var row = document.createElement('div');
      row.className = 'cv__row';
      var chapBox = document.createElement('div');
      chapBox.className = 'cv__chapters';
      var chapters = [];
      slides.forEach(function (s, k) {
        var name = s.dataset.chapter;
        if (!name) return;
        var b = chapters.filter(function (x) { return x.dataset.chapter === name; })[0];
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'cv__chapter';
          b.dataset.chapter = name;
          b.dataset.first = k;
          b.dataset.n = 0;
          chapters.push(b);
          chapBox.appendChild(b);
        }
        b.dataset.n = +b.dataset.n + 1;
        b.textContent = name + ' ';
        var num = document.createElement('span');
        num.textContent = b.dataset.n;
        b.appendChild(num);
      });
      var count = document.createElement('span');
      count.className = 'cv__count';
      row.appendChild(chapBox);
      row.appendChild(count);
      stage.parentNode.insertBefore(row, stage);

      // превью — уменьшенные копии рядом с кадром: <имя>-t.webp
      var thumbBox = document.createElement('div');
      thumbBox.className = 'cv__thumbs';
      var thumbs = slides.map(function (s, k) {
        var img = s.querySelector('img'), b = document.createElement('button');
        b.type = 'button';
        b.className = 'cv__thumb';
        b.setAttribute('aria-label', T.shotNo.replace('{n}', k + 1) + (s.querySelector('b') || {}).textContent);
        var ti = document.createElement('img');
        ti.alt = '';
        ti.loading = 'lazy';
        ti.decoding = 'async';
        ti.src = img.getAttribute('src').replace(/\.webp$/, '-t.webp');
        b.appendChild(ti);
        b.addEventListener('click', function () { cvGo(k); });
        thumbBox.appendChild(b);
        return b;
      });
      stage.parentNode.insertBefore(thumbBox, stage.nextSibling);

      slides.forEach(function (s, k) {
        var hint = document.createElement('span');
        hint.className = 'cv__zoomhint';
        hint.textContent = T.zoomHint;
        s.appendChild(hint);
        s.addEventListener('click', function () {
          if (k !== g.on) { cvGo(k); return; }
          if (s.classList.contains('is-wide')) cvZoomOpen(s.querySelector('img'));
        });
      });
      chapters.forEach(function (b) { b.addEventListener('click', function () { cvGo(+b.dataset.first); }); });
      prev.addEventListener('click', function () { cvGo(g.on - 1); });
      next.addEventListener('click', function () { cvGo(g.on + 1); });
      track.addEventListener('scroll', cvScroll, { passive: true });
      track.addEventListener('scrollend', cvUnlock);

      // На ПК лента может начинаться не с первого кадра (data-start): узкие
      // телефонные кадры иначе стоят с пустой половиной ленты слева.
      // На телефоне кадр один на экран, там начинаем с первого
      var start = phone ? 0 : Math.max(0, slides.findIndex(function (s) { return s.hasAttribute('data-start'); }));
      g = { track: track, slides: slides, probe: probe, prev: prev, next: next,
            count: count, thumbs: thumbs, chapters: chapters, on: start, lock: null, lockT: 0 };
      cvLayout();
    };

    var cvZoomOpen = function (img) {
      var z = cvZoom.querySelector('img');
      z.src = img.currentSrc || img.src;
      z.alt = img.alt;
      cvZoom.hidden = false;
      cvZoom.scrollLeft = 0;
      cvZoom.querySelector('button').focus();
      track('gallery_open', { case_id: cvCur });
    };
    // Шапка окна ложится ровно на шапку сайта, лист — под ней той же
    // ширины. Размеры снимаются с настоящей шапки, а не считаются в CSS:
    // при открытии страница получает отступ под скроллбар и шапка сдвигается.
    var cvPlace = function () {
      var hdr = document.getElementById('header');
      var inner = hdr && hdr.querySelector('.header__inner');
      if (!inner) return;
      var r = inner.getBoundingClientRect();
      cv.style.setProperty('--cv-x', r.left + 'px');
      cv.style.setProperty('--cv-w', r.width + 'px');
      cv.style.setProperty('--cv-top', r.top + 'px');
      cv.style.setProperty('--cv-hh', r.height + 'px');
    };
    var cvZoomClose = function () { cvZoom.hidden = true; };
    cvZoom.addEventListener('click', cvZoomClose);

    // наполнить окно кейсом; при смене раскладки телефон/десктоп
    // вызывается повторно, потому что меняется порядок кадров
    var cvFill = function (id) {
      var tpl = document.getElementById('case-' + id);
      if (!tpl) return false;
      if (g) clearTimeout(g.lockT);
      cvId.textContent = '';
      cvBody.textContent = '';
      cvBody.appendChild(tpl.content.cloneNode(true));
      var head = cvBody.querySelector('.cv__id');
      if (head) { while (head.firstChild) cvId.appendChild(head.firstChild); head.remove(); }
      var title = cvId.querySelector('.cv__title');
      if (title) cv.setAttribute('aria-labelledby', title.id);
      cv.dataset.theme = tpl.dataset.theme || id;
      cv.dataset.case = id;
      cvCur = id;
      if (cv.open) cvBuild();
      return true;
    };

    var cvShow = function (id) {
      if (cvClosing) cvDone();
      if (!cvFill(id)) return false;

      // страница под окном не прокручивается; ширину скроллбара возвращаем
      // отступом, иначе страница под листом дёргается вбок. Запирается
      // <html>, а не <body>: body с overflow: hidden становится контейнером
      // прокрутки, и липкая шапка уезжает из-под листа
      var sbw = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = 'hidden';
      if (sbw > 0) document.body.style.paddingRight = sbw + 'px';

      cvPlace();
      cv.showModal();
      track('case_open', { case_id: id });
      // фокус на сам лист, а не на первую кнопку: иначе после первой же
      // стрелки на «Обсудить проект» загорается рамка фокуса. Лист же
      // и прокручивается — клавиши листают подробности
      cvSheet.focus({ preventScroll: true });
      cvSheet.scrollTop = 0;
      cvBuild();
      return true;
    };

    // закрытие доигрывает анимацию из CSS (.is-closing), потом закрывает окно
    var cvClosing = 0;
    var cvDone = function () {
      clearTimeout(cvClosing);
      cvClosing = 0;
      cv.classList.remove('is-closing');
      if (cv.open) cv.close();
    };
    var cvHide = function () {
      if (cvClosing) return;
      cvZoomClose();
      if (cv.open && !reduced) {
        cv.classList.add('is-closing');
        cvClosing = setTimeout(cvDone, 340);
      } else cvDone();
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      cvPushed = false;
      cvCur = null;
      if (g) clearTimeout(g.lockT);
      g = null;
    };

    var cvOpen = function (id) {
      if (cv.open && !cvClosing || !cvShow(id)) return;
      history.pushState({ cv: id }, '', '#case-' + id);
      cvPushed = true;
    };
    var cvClose = function () { if (cvPushed) history.back(); else cvHide(); };

    document.addEventListener('click', function (e) {
      // у самого окна тоже есть data-case (для аналитики) — клики внутри него
      // не перехватываем, иначе ссылки в окне не открываются
      var t = e.target.closest('[data-case]');
      if (!t || t === cv) return;
      e.preventDefault();
      cvOpen(t.dataset.case);
    });
    cv.querySelector('[data-cv-close]').addEventListener('click', cvClose);
    cv.addEventListener('cancel', function (e) {
      e.preventDefault();
      if (!cvZoom.hidden) cvZoomClose(); else cvClose();
    });
    // клик мимо листа закрывает окно
    cv.addEventListener('click', function (e) { if (e.target === cv) cvClose(); });
    // стрелки слушаем на документе, а не на окне: при открытии по ссылке
    // браузер после загрузки уводит фокус на body, мимо окна
    document.addEventListener('keydown', function (e) {
      if (!cv.open || !g || !cvZoom.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); cvGo(g.on + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); cvGo(g.on - 1); }
    });

    window.addEventListener('popstate', function () {
      var m = /^#case-([\w-]+)$/.exec(location.hash);
      if (m && m[1] === cvCur) return;
      if (cv.open) cvHide();
      if (m && cvShow(m[1])) cvPushed = true;
    });
    window.addEventListener('resize', function () { if (cv.open) cvLayout(); });
    cvPhone.addEventListener('change', function () {
      if (!cv.open || cvClosing) return;
      cvFill(cvCur);
      cvSheet.scrollTop = 0;
    });

    // открыли сайт по ссылке на кейс: сначала шаг без хэша, чтобы «Назад»
    // из окна вернул на страницу, а не на прошлый сайт
    var m0 = /^#case-([\w-]+)$/.exec(location.hash);
    if (m0 && document.getElementById('case-' + m0[1])) {
      history.replaceState(null, '', location.pathname + location.search);
      cvOpen(m0[1]);
      window.addEventListener('load', function () {
        if (cv.open && !cv.contains(document.activeElement)) cvSheet.focus({ preventScroll: true });
      });
    }
  }

  /* ---------- ленты со вкладками: тарифы, поддержка, шаги ---------- */
  // Сами ленты — чистый CSS (scroll-snap); скрипт включает вкладки над ними,
  // подсвечивает пункт, который сейчас в ленте, и перелистывает по нажатию.
  // Лента — общий родитель карточек, на которые указывают aria-controls.
  Array.prototype.forEach.call(document.querySelectorAll('.swipe-tabs'), function (nav) {
    var tabs = Array.prototype.slice.call(nav.querySelectorAll('[aria-controls]'));
    var items = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (!items.length || items.indexOf(null) !== -1) return;
    var track = items[0].parentElement;

    var setCurrent = function (item) {
      tabs.forEach(function (t, i) { t.setAttribute('aria-current', items[i] === item ? 'true' : 'false'); });
    };
    // После нажатия подсветка держится на выбранной вкладке, пока лента
    // едет: на планшете вторая карточка может упереться в конец ленты.
    var picked = null, pickTimer = 0;
    var release = function () { picked = null; };
    track.addEventListener('scrollend', release);
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        picked = items[i];
        clearTimeout(pickTimer);
        pickTimer = setTimeout(release, 900); // Safari без scrollend
        var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
        var left = track.scrollLeft + items[i].getBoundingClientRect().left - track.getBoundingClientRect().left - pad;
        track.scrollTo({ left: left, behavior: reduced ? 'auto' : 'smooth' });
        setCurrent(items[i]);
      });
    });

    // Текущий — тот, что стоит у левого края ленты; в самом конце ленты —
    // последний: на планшете видно две карточки, и до края он не доедет.
    var tick = false;
    var sync = function () {
      tick = false;
      if (picked) { setCurrent(picked); return; }
      var edge = track.getBoundingClientRect().left + (parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0);
      var cur = items[0];
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) {
        cur = items[items.length - 1];
      } else {
        items.forEach(function (it) {
          if (Math.abs(it.getBoundingClientRect().left - edge) < Math.abs(cur.getBoundingClientRect().left - edge)) cur = it;
        });
      }
      setCurrent(cur);
    };
    track.addEventListener('scroll', function () {
      if (!tick) { tick = true; requestAnimationFrame(sync); }
    }, { passive: true });
    nav.hidden = false;
  });

  /* ---------- форма заявки ----------
     Шлёт JSON в Worker (worker/src/index.js), тот пересылает в Telegram.
     При ошибке введённое остаётся на месте, рядом — путь в Telegram. */
  var request = document.querySelector('.request');
  if (request) {
    var reqDone = document.querySelector('.request__done');
    var reqStatus = request.querySelector('.request__status');
    var reqBtn = request.querySelector('[type="submit"]');
    var reqFields = ['name', 'contact', 'task'].map(function (n) { return request.elements[n]; });
    var tgLink = '<a href="https://t.me/davidnaumenko" target="_blank" rel="noopener">' + T.tgLink + '</a>';

    var setStatus = function (html, isError) {
      reqStatus.innerHTML = html;
      reqStatus.classList.toggle('is-error', !!isError);
    };

    request.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });

    request.addEventListener('submit', function (e) {
      e.preventDefault();
      if (request.getAttribute('aria-busy') === 'true') return;

      var empty = reqFields.filter(function (f) { return !f.value.trim(); });
      if (empty.length) {
        empty.forEach(function (f) { f.setAttribute('aria-invalid', 'true'); });
        setStatus(T.formEmpty, true);
        empty[0].focus();
        return;
      }

      // Откуда пришёл человек — едет в заявку. Страница одна, переходы по
      // ней меняют только хэш, так что UTM-метки весь визит лежат в адресе.
      var q = new URLSearchParams(location.search), utm = {};
      ['source', 'medium', 'campaign'].forEach(function (k) {
        if (q.get('utm_' + k)) utm[k] = q.get('utm_' + k);
      });
      var ref = document.referrer.indexOf(location.origin) === 0 ? '' : document.referrer;
      var payload = { website: request.elements.website.value, ref: ref, utm: utm };
      reqFields.forEach(function (f) { payload[f.name] = f.value.trim(); });

      var btnText = reqBtn.textContent;
      request.setAttribute('aria-busy', 'true');
      reqBtn.textContent = T.formSending;
      setStatus('');

      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 15000);

      fetch(request.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl && ctrl.signal
      })
        .then(function (res) { if (!res.ok) throw new Error(res.status); })
        .then(function () {
          track('generate_lead');
          request.hidden = true;
          reqDone.hidden = false;
          reqDone.focus();
        })
        .catch(function () {
          setStatus(T.formFail.replace('{tg}', tgLink), true);
        })
        .then(function () {
          clearTimeout(timer);
          request.removeAttribute('aria-busy');
          reqBtn.textContent = btnText;
        });
    });
  }

  /* ---------- барабан цен ----------
     Счётчик в карточках тарифов: у каждой цифры свой ролик 0–9 в три круга.
     Значения и названия комплектаций — из кнопок .kit__chip, стартовое —
     у кнопки с aria-pressed="true". Когда карточка появляется на экране,
     барабан один раз раскручивается и встаёт на стартовую цену; дальше —
     стрелки, свайп вбок, кнопки комплектаций или клавиши. data-hot на
     .drum — на какой цене гореть, data-old — зачёркнутая старая цена. */
  var FIRE = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6.4.6c.3 2-1.6 2.7-1.6 4.4 0 .8.5 1.3 1 1.3.7 0 1-.6.9-1.6 1.4.9 2.3 2.2 2.3 3.6C9 10.2 7.7 11.4 6 11.4S3 10.2 3 8.5C3 5.8 5.6 4.3 6.4.6z"/></svg>';

  Array.prototype.forEach.call(document.querySelectorAll('[data-drum]'), function (box) {
    var plan = box.closest('.plan');
    var win = box.querySelector('.drum__win');
    var arrows = box.querySelectorAll('.drum__arrow');
    var chips = Array.prototype.slice.call(plan.querySelectorAll('.kit__chip'));
    var lists = Array.prototype.slice.call(plan.querySelectorAll('.kit__list'));
    var vals = chips.map(function (c) { return Number(c.dataset.v); });
    var hot = Number(box.dataset.hot) || null;
    var i = 0, busy = false, normT;
    chips.forEach(function (c, k) { if (c.getAttribute('aria-pressed') === 'true') i = k; });

    // окно: «$» + ролики под самую длинную цену + пламя
    var len = String(Math.max.apply(null, vals)).length, strip = '', r;
    for (r = 0; r < 30; r++) strip += '<span>' + (r % 10) + '</span>';
    var cols = '';
    for (r = 0; r < len; r++) cols += '<span class="drum__col"><span class="drum__strip">' + strip + '</span></span>';
    win.innerHTML = '<span class="drum__cur" aria-hidden="true">$</span><span class="drum__cols" aria-hidden="true">' + cols + '</span>' +
      '<span class="drum__flame" aria-hidden="true"><i></i><i></i><i></i></span>' +
      (hot ? '<span class="drum__embers" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : '');
    if (hot) {
      var off = box.dataset.old ? Math.round((1 - hot / Number(box.dataset.old)) * 100) : 0;
      box.insertAdjacentHTML('beforeend', '<span class="drum__hot" aria-hidden="true">' +
        (box.dataset.old ? '<span class="drum__old">$' + box.dataset.old + '</span>' : '') +
        '<span class="drum__badge">' + FIRE + T.hotPrice + (off ? ' −' + off + '%' : '') + '</span></span>');
    }
    var colEls = Array.prototype.slice.call(win.querySelectorAll('.drum__col'));
    var pos = colEls.map(function () { return 10; });
    win.setAttribute('aria-valuemin', vals[0]);
    win.setAttribute('aria-valuemax', vals[vals.length - 1]);

    // позиция в em — не зависит от того, загрузился ли уже шрифт
    var setCol = function (k, p, dur, ease) {
      var st = colEls[k].firstChild.style;
      st.transition = dur ? 'transform ' + dur + 's ' + ease : 'none';
      st.transform = 'translateY(' + (-p * 1.2) + 'em)';
      pos[k] = p;
    };
    var digits = function (n) {
      var t = String(vals[n]);
      while (t.length < len) t = ' ' + t;
      return t.split('');
    };
    // после движения ролики возвращаются в средний круг, чтобы было куда ехать
    var normalize = function (delay) {
      clearTimeout(normT);
      normT = setTimeout(function () { pos.forEach(function (p, k) { setCol(k, 10 + p % 10); }); }, delay);
    };
    // dir: 1 — дороже, цифры катятся вверх; −1 — дешевле, вниз
    var roll = function (n, dir, mode) {
      digits(n).forEach(function (ch, k) {
        colEls[k].classList.toggle('is-off', ch === ' ');
        if (ch === ' ') return;
        var d = Number(ch), cur = pos[k] % 10;
        if (mode === 'instant') { setCol(k, 10 + d); return; }
        if (mode === 'spin') {
          setCol(k, cur);
          colEls[k].offsetHeight;
          setCol(k, 20 + d, 1.1 + k * .28, 'cubic-bezier(.12,.62,.2,1.02)');
          return;
        }
        if (pos[k] < 10 || pos[k] >= 20) { setCol(k, 10 + cur); colEls[k].offsetHeight; }
        if (d === cur) return;
        setCol(k, dir > 0 ? (d > cur ? 10 + d : 20 + d) : (d < cur ? 10 + d : d), .55 + k * .06, 'cubic-bezier(.3,1.3,.5,1)');
      });
      normalize(mode === 'spin' ? 1300 + len * 280 : 800);
    };
    var sync = function () {
      box.classList.toggle('is-hot', !busy && vals[i] === hot);
      lists.forEach(function (l) { l.classList.toggle('is-on', Number(l.dataset.v) === vals[i]); });
      chips.forEach(function (c, k) {
        c.setAttribute('aria-pressed', String(k === i));
        c.classList.toggle('is-fire', vals[k] === hot);
      });
      arrows[0].disabled = i === 0;
      arrows[1].disabled = i === vals.length - 1;
      win.setAttribute('aria-valuenow', vals[i]);
      win.setAttribute('aria-valuetext', '$' + vals[i] + ', ' + chips[i].textContent +
        (vals[i] === hot && box.dataset.old ? T.hotWas.replace('{old}', box.dataset.old) : ''));
    };
    var go = function (n) {
      if (n < 0 || n >= vals.length || n === i || busy) return;
      var dir = n > i ? 1 : -1;
      i = n;
      roll(i, dir, 'step');
      sync();
    };

    roll(i, 1, 'instant');
    sync();

    Array.prototype.forEach.call(arrows, function (a) {
      a.addEventListener('click', function () { go(i + Number(a.dataset.step)); });
    });
    chips.forEach(function (c, k) { c.addEventListener('click', function () { go(k); }); });
    win.addEventListener('keydown', function (e) {
      var n = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: vals.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      go(Math.max(0, Math.min(vals.length - 1, n)));
    });
    // свайп влево — дороже, как листание дальше по списку
    var sx = null;
    win.addEventListener('pointerdown', function (e) { sx = e.clientX; win.setPointerCapture(e.pointerId); });
    win.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) >= 22) go(i + (dx < 0 ? 1 : -1));
    });
    win.addEventListener('pointercancel', function () { sx = null; });

    // раскрутка — один раз, когда карточка видна; в ленте тарифов на
    // телефоне соседняя карточка раскрутится, когда её долистают
    if (reduced || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      busy = true;
      sync();
      roll(i, 1, 'spin');
      setTimeout(function () { busy = false; sync(); }, 1100 + (len - 1) * 280 + 120);
    }, { threshold: .6 });
    io.observe(win);
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

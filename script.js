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
      prev.setAttribute('aria-label', 'Предыдущий экран');
      next.setAttribute('aria-label', 'Следующий экран');
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
        b.setAttribute('aria-label', 'Экран ' + (k + 1) + ': ' + (s.querySelector('b') || {}).textContent);
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
        hint.textContent = 'Нажмите, чтобы увеличить';
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

      g = { track: track, slides: slides, probe: probe, prev: prev, next: next,
            count: count, thumbs: thumbs, chapters: chapters, on: 0, lock: null, lockT: 0 };
      cvLayout();
    };

    var cvZoomOpen = function (img) {
      var z = cvZoom.querySelector('img');
      z.src = img.currentSrc || img.src;
      z.alt = img.alt;
      cvZoom.hidden = false;
      cvZoom.scrollLeft = 0;
      cvZoom.querySelector('button').focus();
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
      cvCur = id;
      if (cv.open) cvBuild();
      return true;
    };

    var cvShow = function (id) {
      if (cvClosing) cvDone();
      if (!cvFill(id)) return false;

      // страница под окном не прокручивается; ширину скроллбара возвращаем
      // отступом, иначе страница под листом дёргается вбок
      var sbw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (sbw > 0) document.body.style.paddingRight = sbw + 'px';

      cv.showModal();
      // фокус на само окно, а не на первую кнопку: иначе после первой же
      // стрелки на «Обсудить проект» загорается рамка фокуса
      cv.focus();
      cv.scrollTop = 0;
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
        cvClosing = setTimeout(cvDone, 260);
      } else cvDone();
      document.body.style.overflow = '';
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
      var t = e.target.closest('[data-case]');
      if (!t) return;
      e.preventDefault();
      cvOpen(t.dataset.case);
    });
    cv.querySelector('[data-cv-close]').addEventListener('click', cvClose);
    cv.addEventListener('cancel', function (e) {
      e.preventDefault();
      if (!cvZoom.hidden) cvZoomClose(); else cvClose();
    });
    // клик по затемнению вокруг листа (на десктопе лист не во весь экран)
    cv.addEventListener('click', function (e) {
      if (e.target !== cv) return;
      var r = cv.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cvClose();
    });
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
      cv.scrollTop = 0;
    });

    // открыли сайт по ссылке на кейс: сначала шаг без хэша, чтобы «Назад»
    // из окна вернул на страницу, а не на прошлый сайт
    var m0 = /^#case-([\w-]+)$/.exec(location.hash);
    if (m0 && document.getElementById('case-' + m0[1])) {
      history.replaceState(null, '', location.pathname + location.search);
      cvOpen(m0[1]);
      window.addEventListener('load', function () {
        if (cv.open && !cv.contains(document.activeElement)) cv.focus();
      });
    }
  }

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

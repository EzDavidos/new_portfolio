'use strict';
/* Сборка языковых версий сайта.

   Запуск:  node build.js

   Русские страницы (index.html, privacy.html) правят руками — они и есть
   источник вёрстки. Для каждого языка из i18n/config.js скрипт берёт их,
   подменяет тексты из i18n/<код>.json и кладёт результат в свою папку
   (/uk/index.html, /en/index.html, /en/privacy.html). Заодно правит то,
   что от языка зависит:
     · <html lang>, canonical, og:url, og:locale и hreflang;
     · относительные ссылки на ассеты — на абсолютные от корня, иначе из
       подпапки они ведут в никуда («./» не трогаем: он уже указывает
       в папку своего языка);
     · ссылку на политику конфиденциальности — по config.js;
     · список языков в шапке и отметку текущего.

   Если на странице появился текст, которого нет в словаре, сборка ПАДАЕТ
   и называет строки. Это защита от «на украинской версии висит старая
   цена»: молча собрать наполовину переведённую страницу нельзя.
   Порядок после правки текстов: node i18n/extract.js → перевести пустые
   значения → node build.js. */

var fs = require('fs');
var path = require('path');
var lib = require('./i18n/lib.js');
var cfg = require('./i18n/config.js');

var root = __dirname;
var keep = new Set(JSON.parse(fs.readFileSync(path.join(root, 'i18n/keep.json'), 'utf8')));
var source = cfg.langs.filter(function (l) { return l.source; })[0];

var rel = function (l, page) { return '/' + (l.dir ? l.dir + '/' : '') + (page === 'index.html' ? '' : page); };
var abs = function (l, page) { return cfg.site + rel(l, page); };

/* Кто ещё есть на этой странице: политика живёт не на всех языках. */
var on = function (page) { return cfg.langs.filter(function (l) { return l.pages.indexOf(page) >= 0; }); };

/* Блок «языки» в шапке: один и тот же список, меняется только отметка. */
function langsBlock(cur, page) {
  return on(page).map(function (l) {
    return '<li><a class="lang__item" href="' + rel(l, page) + '"' +
      ' hreflang="' + l.code + '" data-lang-to="' + l.code + '"' +
      (l.code === cur.code ? ' aria-current="true"' : '') +
      '><b>' + l.label + '</b>' + l.name + '</a></li>';
  });
}

/* Блок hreflang плюс og:locale:alternate — остальные языки этой страницы.
   og:locale:alternate ставим только там, где есть сам og:locale: на
   странице политики Open Graph нет вовсе. */
function altsBlock(cur, page, og) {
  var langs = on(page);
  var out = langs.map(function (l) {
    return '<link rel="alternate" hreflang="' + l.code + '" href="' + abs(l, page) + '">';
  });
  out.push('<link rel="alternate" hreflang="x-default" href="' + abs(source, page) + '">');
  if (og) langs.forEach(function (l) {
    if (l.code !== cur.code) out.push('<meta property="og:locale:alternate" content="' + l.locale + '">');
  });
  return out;
}

/* Замена между метками <!-- i18n:имя --> … <!-- /i18n:имя --> с сохранением
   отступа открывающей метки. Меток нет — страница их и не просит. */
function region(html, name, lines) {
  var re = new RegExp('([ \\t]*)(<!-- i18n:' + name + ' -->)[\\s\\S]*?(<!-- /i18n:' + name + ' -->)');
  if (!re.test(html)) return html;
  return html.replace(re, function (_m, pad, open, close) {
    return pad + open + '\n' + lines.map(function (s) { return pad + s; }).join('\n') + '\n' + pad + close;
  });
}

/* Подмена значения атрибута. required — падать, если такого тега нет. */
function attr(html, re, value, required) {
  if (!re.test(html)) {
    if (required) throw new Error('не найдено в исходнике: ' + re);
    return html;
  }
  return html.replace(re, function (_m, a, b) { return a + value + b; });
}

/* 0. Строки, которые рисует сам script.js, живут в нём же (словарь STR).
   Забыть их для нового языка легко, а заметно это только на живой
   странице — где-нибудь в подписи «Горячая цена». Поэтому проверяем
   заранее и до сборки. */
var scriptSrc = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
var noStrings = cfg.langs.filter(function (l) {
  return !new RegExp('\\n    ' + l.code + ': \\{').test(scriptSrc);
}).map(function (l) { return l.code; });
if (noStrings.length) {
  console.error('в script.js нет словаря STR для: ' + noStrings.join(', ') +
                ' — страница соберётся, но кнопки и ошибки формы будут на русском');
  process.exit(1);
}

/* 1. Русские страницы: обновляем только списки языков — тексты в них свои. */
source.pages.forEach(function (page) {
  var file = path.join(root, page);
  var was = fs.readFileSync(file, 'utf8');
  var now = region(region(was, 'langs', langsBlock(source, page)), 'alts',
    altsBlock(source, page, /og:locale"/.test(was)));
  if (now !== was) {
    fs.writeFileSync(file, now);
    console.log(page + ': списки языков обновлены');
  }
});

/* 2. Остальные языки. */
var failed = false;

cfg.langs.filter(function (l) { return !l.source; }).forEach(function (l) {
  var dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n/' + l.code + '.json'), 'utf8'));
  var missing = [];

  var pick = function (k) {
    if (keep.has(k)) return null;
    if (dict[k]) return dict[k];
    if (missing.indexOf(k) < 0) missing.push(k);
    return null;
  };

  // из подпапки относительный путь ведёт в никуда — делаем его от корня;
  // «./» и «../» оставляем: они и должны считаться от папки языка
  var rootAbs = function (v) {
    if (!v || /^([a-z]+:|\/\/|\/|#|\.{1,2}\/)/i.test(v)) return null;
    return '/' + v;
  };

  var out = {};
  l.pages.forEach(function (page) {
    var src = fs.readFileSync(path.join(root, page), 'utf8');

    out[page] = lib.transform(src, {
      onText: pick,
      onAttr: pick,
      onUrl: function (v, name) {
        if (name === 'srcset') {
          return v.split(',').map(function (p) {
            var t = p.trim().split(/\s+/);
            return (rootAbs(t[0]) || t[0]) + (t[1] ? ' ' + t[1] : '');
          }).join(', ');
        }
        var a = rootAbs(v) || v;
        // политика конфиденциальности у каждого языка своя
        if (a.indexOf('/privacy.html') === 0) return l.privacy + a.slice('/privacy.html'.length);
        return a === v ? null : a;
      }
    });
  });

  if (missing.length) {
    failed = true;
    console.error('\n' + l.code + ': нет перевода для ' + missing.length + ' строк — страницы не собраны:');
    missing.forEach(function (k) { console.error('  · ' + k); });
    console.error('  Прогоните `node i18n/extract.js` и заполните пустые значения в i18n/' + l.code + '.json\n');
    return;
  }

  l.pages.forEach(function (page) {
    var html = out[page];
    html = attr(html, /(<html lang=")[^"]*(")/, l.code, true);
    html = attr(html, /(<link rel="canonical" href=")[^"]*(")/, abs(l, page), true);
    html = attr(html, /(<meta property="og:url" content=")[^"]*(")/, abs(l, page));
    html = attr(html, /(<meta property="og:locale" content=")[^"]*(")/, l.locale);
    html = attr(html, /(<span class="lang__cur" data-lang-cur>)[^<]*(<\/span>)/, l.label);
    html = region(html, 'langs', langsBlock(l, page));
    html = region(html, 'alts', altsBlock(l, page, /og:locale"/.test(html)));

    html = html.replace(/^<!doctype html>\n/i,
      '<!doctype html>\n<!-- Страница собрана автоматически: node build.js.\n' +
      '     Править надо ' + page + ' (вёрстка и русский текст) и i18n/' + l.code + '.json (перевод),\n' +
      '     а не этот файл — следующая сборка перезапишет его. -->\n');

    fs.mkdirSync(path.join(root, l.dir), { recursive: true });
    fs.writeFileSync(path.join(root, l.dir, page), html);
    console.log(l.dir + '/' + page + ': собрано');
  });
});

if (failed) process.exit(1);

'use strict';
/* Сборка языковых версий сайта.

   Запуск:  node build.js

   Русская страница — index.html, её правят руками, она и есть источник
   вёрстки. Для каждого языка из i18n/config.js скрипт берёт этот файл,
   подменяет тексты из i18n/<код>.json и кладёт результат в свою папку
   (/uk/index.html). Заодно правит то, что от языка зависит:
     · <html lang>, canonical, og:url, og:locale и hreflang;
     · относительные ссылки на ассеты — на абсолютные от корня, иначе из
       подпапки они ведут в никуда;
     · список языков в шапке и отметку текущего.

   Если в index.html появился текст, которого нет в словаре, сборка
   ПАДАЕТ и называет строки. Это защита от «на украинской версии висит
   старая цена»: молча собрать наполовину переведённую страницу нельзя.
   Правильный порядок после правки текстов: node i18n/extract.js →
   перевести пустые значения → node build.js. */

var fs = require('fs');
var path = require('path');
var lib = require('./i18n/lib.js');
var cfg = require('./i18n/config.js');

var root = __dirname;
var keep = new Set(JSON.parse(fs.readFileSync(path.join(root, 'i18n/keep.json'), 'utf8')));

var url = function (l) { return cfg.site + '/' + (l.dir ? l.dir + '/' : ''); };

/* Блок «языки» в шапке. Один и тот же список на всех страницах,
   меняется только отметка текущего языка. */
function langsBlock(cur) {
  return cfg.langs.map(function (l) {
    return '<li><a class="lang__item" href="' + (l.dir ? '/' + l.dir + '/' : '/') + '"' +
      ' hreflang="' + l.code + '" data-lang-to="' + l.code + '"' +
      (l.code === cur.code ? ' aria-current="true"' : '') +
      '><b>' + l.label + '</b>' + l.name + '</a></li>';
  });
}

/* Блок hreflang: одинаков везде, плюс og:locale:alternate — остальные языки. */
function altsBlock(cur) {
  var out = cfg.langs.map(function (l) {
    return '<link rel="alternate" hreflang="' + l.code + '" href="' + url(l) + '">';
  });
  var def = cfg.langs.filter(function (l) { return l.source; })[0];
  out.push('<link rel="alternate" hreflang="x-default" href="' + url(def) + '">');
  cfg.langs.forEach(function (l) {
    if (l.code !== cur.code) out.push('<meta property="og:locale:alternate" content="' + l.locale + '">');
  });
  return out;
}

/* Замена содержимого между метками <!-- i18n:имя --> … <!-- /i18n:имя -->
   с сохранением отступа, с которым стоит открывающая метка. */
function region(html, name, lines) {
  var re = new RegExp('([ \\t]*)(<!-- i18n:' + name + ' -->)[\\s\\S]*?(<!-- /i18n:' + name + ' -->)');
  if (!re.test(html)) throw new Error('в index.html нет меток i18n:' + name);
  return html.replace(re, function (_m, pad, open, close) {
    return pad + open + '\n' + lines.map(function (s) { return pad + s; }).join('\n') + '\n' + pad + close;
  });
}

function attr(html, re, value) {
  if (!re.test(html)) throw new Error('не найдено в index.html: ' + re);
  return html.replace(re, function (_m, a, b) { return a + value + b; });
}

var src = fs.readFileSync(path.join(root, cfg.source), 'utf8');
var source = cfg.langs.filter(function (l) { return l.source; })[0];

/* 1. Русская страница: обновляем только списки языков — тексты в ней свои. */
var ru = region(src, 'langs', langsBlock(source));
ru = region(ru, 'alts', altsBlock(source));
if (ru !== src) {
  fs.writeFileSync(path.join(root, cfg.source), ru);
  console.log(cfg.source + ': списки языков обновлены');
}
src = ru;

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

  // ссылка ведёт в корень сайта: из /uk/ относительный путь уже не работает
  var abs = function (v) {
    if (!v || /^([a-z]+:|\/\/|\/|#)/i.test(v)) return null;
    return '/' + v;
  };

  var out = lib.transform(src, {
    onText: pick,
    onAttr: pick,
    onUrl: function (v, name) {
      if (name === 'srcset') {
        var parts = v.split(',').map(function (p) {
          var t = p.trim().split(/\s+/);
          var a = abs(t[0]);
          return (a || t[0]) + (t[1] ? ' ' + t[1] : '');
        });
        return parts.join(', ');
      }
      var a = abs(v);
      // политика конфиденциальности у каждого языка своя
      if ((a || v).indexOf('/privacy.html') === 0 && l.privacy !== '/privacy.html') {
        return l.privacy + (a || v).slice('/privacy.html'.length);
      }
      return a;
    }
  });

  if (missing.length) {
    failed = true;
    console.error('\n' + l.code + ': нет перевода для ' + missing.length + ' строк — страница не собрана:');
    missing.forEach(function (k) { console.error('  · ' + k); });
    console.error('  Прогоните `node i18n/extract.js` и заполните пустые значения в i18n/' + l.code + '.json\n');
    return;
  }

  out = attr(out, /(<html lang=")[^"]*(")/, l.code);
  out = attr(out, /(<link rel="canonical" href=")[^"]*(")/, url(l));
  out = attr(out, /(<meta property="og:url" content=")[^"]*(")/, url(l));
  out = attr(out, /(<meta property="og:locale" content=")[^"]*(")/, l.locale);
  out = attr(out, /(<span class="lang__cur" data-lang-cur>)[^<]*(<\/span>)/, l.label);
  out = region(out, 'langs', langsBlock(l));
  out = region(out, 'alts', altsBlock(l));

  out = out.replace(/^<!doctype html>\n/i,
    '<!doctype html>\n<!-- Страница собрана автоматически: node build.js.\n' +
    '     Править надо index.html (вёрстка и русский текст) и i18n/' + l.code + '.json (перевод),\n' +
    '     а не этот файл — следующая сборка перезапишет его. -->\n');

  var dir = path.join(root, l.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), out);
  console.log(l.dir + '/index.html: собрано (' + Object.keys(dict).length + ' строк перевода)');
});

if (failed) process.exit(1);

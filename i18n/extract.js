'use strict';
/* Собирает из русских страниц все переводимые строки и раскладывает их
   по словарям i18n/<код>.json.

   Запуск:  node i18n/extract.js
   Что делает:
     · новые строки добавляет со значением "" (их видно как пустые);
     · уже переведённые оставляет на месте;
     · строки, которых в исходниках больше нет (Давид поменял текст),
       переносит в i18n/<код>.obsolete.json — чтобы старый перевод можно
       было подправить, а не писать заново.
   Каждый язык получает строки только тех страниц, которые на нём
   собираются (см. pages в config.js). Порядок ключей — как в документе,
   поэтому diff читается сверху вниз. */

var fs = require('fs'), path = require('path');
var lib = require('./lib.js');
var cfg = require('./config.js');

var root = path.join(__dirname, '..');

/* keep.json — строки, одинаковые во всех языках: названия, стек, имена. */
var keepSet = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'keep.json'), 'utf8')));

/* строки одной страницы, в порядке документа */
function strings(page) {
  var html = fs.readFileSync(path.join(root, page), 'utf8');
  var order = [], seen = new Set();
  var add = function (k) { if (!seen.has(k)) { seen.add(k); order.push(k); } return null; };
  lib.transform(html, { onText: add, onAttr: add });
  return order;
}

var cache = {};
var pageStrings = function (p) { return (cache[p] = cache[p] || strings(p)); };

cfg.langs.filter(function (l) { return !l.source; }).forEach(function (l) {
  var live = [], seen = new Set();
  l.pages.forEach(function (p) {
    pageStrings(p).forEach(function (k) {
      if (!keepSet.has(k) && !seen.has(k)) { seen.add(k); live.push(k); }
    });
  });

  var file = path.join(__dirname, l.code + '.json');
  var old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

  var next = {}, added = 0;
  live.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(old, k)) next[k] = old[k];
    else { next[k] = ''; added++; }
  });

  var gone = Object.keys(old).filter(function (k) { return !(k in next) && old[k]; });
  if (gone.length) {
    var obsFile = path.join(__dirname, l.code + '.obsolete.json');
    var obs = fs.existsSync(obsFile) ? JSON.parse(fs.readFileSync(obsFile, 'utf8')) : {};
    gone.forEach(function (k) { obs[k] = old[k]; });
    fs.writeFileSync(obsFile, JSON.stringify(obs, null, 2) + '\n');
  }

  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  var empty = live.filter(function (k) { return !next[k]; }).length;
  console.log(l.code + ' (' + l.pages.join(', ') + '): всего ' + live.length +
              ' · новых ' + added + ' · без перевода ' + empty +
              (gone.length ? ' · в obsolete ушло ' + gone.length : ''));
});

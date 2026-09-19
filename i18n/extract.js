'use strict';
/* Собирает из index.html все переводимые строки и раскладывает их по
   словарям i18n/<код>.json.

   Запуск:  node i18n/extract.js
   Что делает:
     · новые строки добавляет со значением "" (их видно как пустые);
     · уже переведённые оставляет на месте;
     · строки, которых в index.html больше нет (Давид поменял текст),
       переносит в i18n/<код>.obsolete.json — чтобы старый перевод можно
       было подправить, а не писать заново.
   Порядок ключей — как в документе, поэтому diff читается сверху вниз. */

var fs = require('fs'), path = require('path');
var lib = require('./lib.js');
var cfg = require('./config.js');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, cfg.source), 'utf8');

/* keep.json — строки, одинаковые во всех языках: названия, стек, имена. */
var keepPath = path.join(__dirname, 'keep.json');
var keep = fs.existsSync(keepPath) ? JSON.parse(fs.readFileSync(keepPath, 'utf8')) : [];
var keepSet = new Set(keep);

var order = [], seen = new Set();
var add = function (k) { if (!seen.has(k)) { seen.add(k); order.push(k); } };

lib.transform(html, {
  onText: function (k) { add(k); return null; },
  onAttr: function (k) { add(k); return null; }
});

var live = order.filter(function (k) { return !keepSet.has(k); });
console.log('строк в index.html: ' + order.length + ' · из них в keep.json: ' + (order.length - live.length));

cfg.langs.filter(function (l) { return !l.source; }).forEach(function (l) {
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
  console.log(l.code + ': всего ' + live.length + ' · новых ' + added + ' · без перевода ' + empty +
              (gone.length ? ' · в obsolete ушло ' + gone.length : ''));
});

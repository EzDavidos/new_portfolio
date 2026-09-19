'use strict';
/* Общая часть i18n-инструментов: разбор index.html на куски и обход
   переводимых мест. Отдельного HTML-парсера в проекте нет и не нужно —
   страница своя, разметка предсказуемая, поэтому здесь маленький
   сканер на ~80 строк вместо зависимости из npm.

   Переводимая единица — ОТДЕЛЬНЫЙ ТЕКСТОВЫЙ УЗЕЛ (и значения нескольких
   атрибутов), а не innerHTML блока. Так в словарь не попадают теги,
   классы и ссылки: поменяли href или класс — словарь цел. Обратная
   сторона: в предложении, разорванном <br> или <em>, каждый кусок
   переводится отдельно, и порядок кусков менять нельзя. */

/* Атрибуты, которые видит человек. data-chapter — названия глав в ленте
   кейса, их рисует script.js. */
var ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'data-chapter', 'aria-description'];

/* Атрибуты со ссылками: в собранных страницах они переезжают в подпапку
   (/uk/), поэтому build.js делает их абсолютными от корня. */
var URLS = ['href', 'src', 'srcset', 'poster', 'action'];

/* meta, которые уходят в поиск и в превью ссылки */
var META = ['description', 'og:title', 'og:description', 'og:image:alt'];

/* Разбор на куски: текст, тег, комментарий, содержимое <script>/<style>. */
function tokenize(html) {
  var out = [], i = 0, n = html.length;
  while (i < n) {
    var lt = html.indexOf('<', i);
    if (lt < 0) { out.push({ t: 'text', v: html.slice(i) }); break; }
    if (lt > i) out.push({ t: 'text', v: html.slice(i, lt) });

    if (html.substr(lt, 4) === '<!--') {
      var ce = html.indexOf('-->', lt);
      ce = ce < 0 ? n : ce + 3;
      out.push({ t: 'skip', v: html.slice(lt, ce) });
      i = ce; continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      var de = html.indexOf('>', lt);
      de = de < 0 ? n : de + 1;
      out.push({ t: 'skip', v: html.slice(lt, de) });
      i = de; continue;
    }

    // конец тега ищем с оглядкой на кавычки: '>' внутри значения не считается
    var j = lt + 1, q = 0;
    while (j < n) {
      var c = html[j];
      if (q) { if (c === q) q = 0; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    var src = html.slice(lt, j + 1);
    var m = /^<\/?\s*([a-zA-Z][^\s/>]*)/.exec(src);
    var name = m ? m[1].toLowerCase() : '';
    out.push({ t: 'tag', v: src, name: name, close: src[1] === '/', self: /\/>$/.test(src) });
    i = j + 1;

    // внутренности script/style — сырой текст, его не трогаем
    if (!out[out.length - 1].close && !out[out.length - 1].self && (name === 'script' || name === 'style')) {
      var mm = new RegExp('</\\s*' + name + '\\s*>', 'i').exec(html.slice(i));
      var end = mm ? i + mm.index : n;
      out.push({ t: 'skip', v: html.slice(i, end) });
      i = end;
    }
  }
  return out;
}

/* Ключ словаря: текст узла без краёв и с одним пробелом вместо переносов.
   &nbsp; остаётся в ключе как есть — он часть текста и решает, где нельзя
   рвать строку. */
function key(text) { return text.replace(/\s+/g, ' ').trim(); }

/* Есть ли в строке буквы. Сущности (&nbsp;) сначала убираем, иначе их
   латиница выдаёт «Ч» за текст. */
function hasLetters(s) {
  return /\p{L}/u.test(s.replace(/&[a-zA-Z]+;|&#\d+;/g, ' '));
}

function metaKind(tagSrc) {
  var m = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tagSrc);
  return m ? m[1].toLowerCase() : null;
}

/* Обход страницы. Колбэки возвращают строку-замену или null («не трогать»).
     onText(key, rawNode)            — текстовый узел
     onAttr(key, attrName, tagName)  — значение атрибута
     onTag(token)                    — сам тег целиком (для build)
   Внутрь <svg> не заходим: там нет текста для человека. */
function transform(html, cb) {
  var out = '', svg = 0;
  tokenize(html).forEach(function (tk) {
    if (tk.t === 'skip') { out += tk.v; return; }

    if (tk.t === 'text') {
      if (svg || !cb.onText) { out += tk.v; return; }
      var k = key(tk.v);
      if (!k || !hasLetters(k)) { out += tk.v; return; }
      var res = cb.onText(k);
      if (res == null) { out += tk.v; return; }
      var edge = /^(\s*)[\s\S]*?(\s*)$/.exec(tk.v);
      out += edge[1] + res + edge[2];
      return;
    }

    if (tk.name === 'svg') { if (tk.close) svg = Math.max(0, svg - 1); else if (!tk.self) svg++; }
    var src = tk.v;
    if (!svg && !tk.close && cb.onAttr) {
      src = src.replace(/([a-zA-Z_:@][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g,
        function (full, name, _q, dq, sq) {
          var val = dq === undefined ? sq : dq;
          var low = name.toLowerCase();
          var ok = ATTRS.indexOf(low) >= 0 ||
                   (low === 'content' && tk.name === 'meta' && META.indexOf(metaKind(tk.v)) >= 0);
          if (!ok) {
            if (cb.onUrl && URLS.indexOf(low) >= 0) {
              var u = cb.onUrl(val, low, tk.name);
              if (u != null && u !== val) return name + '=' + (dq === undefined ? "'" : '"') + u + (dq === undefined ? "'" : '"');
            }
            return full;
          }
          var k2 = key(val);
          if (!k2 || !hasLetters(k2)) return full;
          var res2 = cb.onAttr(k2, low, tk.name);
          if (res2 == null) return full;
          return name + '=' + (dq === undefined ? "'" : '"') + res2 + (dq === undefined ? "'" : '"');
        });
    }
    if (cb.onTag) { var r = cb.onTag(Object.assign({}, tk, { v: src })); if (r != null) src = r; }
    out += src;
  });
  return out;
}

module.exports = { tokenize: tokenize, transform: transform, key: key, hasLetters: hasLetters, ATTRS: ATTRS, META: META, URLS: URLS };

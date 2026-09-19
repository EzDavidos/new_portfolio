'use strict';
/* Языки сайта. Русский — источник: его страницы лежат в корне и правятся
   руками, остальные собирает build.js из словарей i18n/<код>.json.

   Добавить язык = добавить сюда строку, прогнать `node i18n/extract.js`,
   перевести пустые значения в i18n/<код>.json и собрать `node build.js`.
   Список в переключателе и hreflang строятся отсюда же.

   pages   — какие страницы собираем на этом языке. Политику решено
             держать только на русском и английском: юридический текст на
             шести языках — лишний риск, ошибка в формулировке хуже, чем
             ссылка на понятную версию.
   privacy — куда ведёт ссылка на политику с этого языка.
   name    — самоназвание, оно никогда не переводится. */
module.exports = {
  site: 'https://davidnaumenko.com',

  langs: [
    { code: 'ru', dir: '',   label: 'RU', name: 'Русский',    locale: 'ru_RU',
      privacy: '/privacy.html',    pages: ['index.html', 'privacy.html'], source: true },

    { code: 'uk', dir: 'uk', label: 'UK', name: 'Українська', locale: 'uk_UA',
      privacy: '/en/privacy.html', pages: ['index.html'] },

    { code: 'en', dir: 'en', label: 'EN', name: 'English',    locale: 'en_US',
      privacy: '/en/privacy.html', pages: ['index.html', 'privacy.html'] }
  ]
};

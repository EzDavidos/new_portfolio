'use strict';
/* Языки сайта. Русский — источник: его страница лежит в корне и правится
   руками, остальные собирает build.js из словарей i18n/<код>.json.

   Добавить язык = добавить сюда строку, перевести i18n/<код>.json и
   прогнать `node build.js`. Список в переключателе строится отсюда же. */
module.exports = {
  site: 'https://davidnaumenko.com',
  source: 'index.html',

  langs: [
    // name — самоназвание, оно никогда не переводится
    { code: 'ru', dir: '',   label: 'RU', name: 'Русский',    locale: 'ru_RU', privacy: '/privacy.html', source: true },
    { code: 'uk', dir: 'uk', label: 'UK', name: 'Українська', locale: 'uk_UA', privacy: '/privacy.html' }
  ]
};

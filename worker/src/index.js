/* Приём заявок с формы на davidnaumenko.com.
   Проверяет, что запрос пришёл с сайта и поля в порядке, и пересылает
   заявку сообщением в Telegram. Токен бота живёт только в секретах
   Cloudflare — во фронтенд он не попадает. */

const LIMITS = { name: 80, contact: 120, task: 2000 };
const MAX_BODY = 10000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
    if (!cors['Access-Control-Allow-Origin']) return reply(403, { ok: false, error: 'origin' });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'size' });

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply(400, { ok: false, error: 'json' });
    }

    // Скрытое поле-ловушка: человек его не видит, бот заполняет. Отвечаем
    // «ок», чтобы бот не понял, что его отсеяли, и ничего не пересылаем.
    if (str(data.website)) return reply(200, { ok: true });

    const lead = {};
    for (const key of Object.keys(LIMITS)) {
      lead[key] = str(data[key]);
      if (!lead[key] || lead[key].length > LIMITS[key]) {
        return reply(422, { ok: false, error: 'field', field: key });
      }
    }

    const lines = [
      '📩 Заявка с сайта',
      '',
      `Имя: ${lead.name}`,
      `Контакт: ${lead.contact}`,
      '',
      'Задача:',
      lead.task,
    ];

    const source = sourceLines(data);
    if (source.length) lines.push('', ...source);

    const tg = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text: lines.join('\n'),
        link_preview_options: { is_disabled: true },
      }),
    });

    if (!tg.ok) {
      console.error('telegram', tg.status, await tg.text());
      return reply(502, { ok: false, error: 'telegram' });
    }
    return reply(200, { ok: true });
  },
};

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Откуда пришёл человек: UTM-метки и сайт-источник. Всё необязательное.
function sourceLines(data) {
  const out = [];
  const utm = data.utm && typeof data.utm === 'object' ? data.utm : {};
  const tags = ['source', 'medium', 'campaign']
    .map((k) => str(utm[k]).slice(0, 100))
    .filter(Boolean);
  if (tags.length) out.push(`Метки: ${tags.join(' / ')}`);
  const ref = str(data.ref).slice(0, 300);
  if (ref) out.push(`Пришёл с: ${ref}`);
  return out;
}

/**
 * Ragic proxy - Cloudflare Worker
 *
 * Klucz API Ragica NIGDY nie trafia do przegladarki. Strona wola ten worker,
 * worker doklada klucz (sekret RAGIC_API_KEY) i zwraca sam JSON.
 *
 * Wywolanie:
 *   GET /ragic?sheet=wys&recordId=35025
 */

// Biala lista arkuszy - przegladarka moze poprosic TYLKO o te sciezki.
// Dzieki temu proxy nie jest uniwersalna bramka do calego konta Ragic.
const SHEETS = {
  wys:      'AMAZINGGIRL/wys/1',
  szwalnia: 'AMAZINGGIRL/szwalnia-mg/80',
};

const RAGIC_HOST = 'https://eu3.ragic.com';

// Skad wolno wolac (naglowek Origin). Mozna nadpisac zmienna ALLOWED_ORIGINS
// (lista rozdzielona przecinkami) bez zmiany kodu.
const DEFAULT_ORIGINS = ['https://amazinggirluipath.github.io'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }
    const url = new URL(request.url);
    const sheet = url.searchParams.get('sheet') || '';
    const recordId = url.searchParams.get('recordId') || '';

    // Walidacja wejscia idzie PRZED sprawdzeniem sekretu - smieciowe zapytanie
    // nie ma powodu dowiadywac sie niczego o konfiguracji workera.
    if (!Object.prototype.hasOwnProperty.call(SHEETS, sheet)) {
      return json({ error: 'Nieznany parametr sheet' }, 400, cors);
    }
    if (!/^\d{1,12}$/.test(recordId)) {
      return json({ error: 'Nieprawidlowy recordId' }, 400, cors);
    }
    if (!env.RAGIC_API_KEY) {
      return json({ error: 'Brak sekretu RAGIC_API_KEY w konfiguracji workera' }, 500, cors);
    }

    const target =
      RAGIC_HOST + '/' + SHEETS[sheet] + '/' + recordId +
      '?api&v=3&naming=fname&APIKey=' + encodeURIComponent(env.RAGIC_API_KEY);

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 0 },
      });
    } catch (err) {
      return json({ error: 'Nie udalo sie polaczyc z Ragic API' }, 502, cors);
    }

    const body = await upstream.text();

    // Ragic przy bledzie autoryzacji potrafi zwrocic HTML zamiast JSON -
    // lepiej powiedziec to wprost niz podac stronie smieci do JSON.parse.
    const looksLikeJson = /^\s*[[{]/.test(body);
    if (!upstream.ok || !looksLikeJson) {
      return json(
        { error: 'Ragic API zwrocilo blad', status: upstream.status },
        502,
        cors
      );
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};

function corsHeaders(origin, allowed) {
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowed.indexOf(origin) !== -1) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

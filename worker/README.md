# Ragic proxy (Cloudflare Worker)

Trzyma klucz API Ragica po stronie serwera. Strony na GitHub Pages wołają ten
worker zamiast Ragica bezpośrednio, więc w publicznym repo nie ma żadnego sekretu.

```
przeglądarka  ──►  worker (ma klucz)  ──►  eu3.ragic.com
   (bez klucza)         sekret CF
```

## Wdrożenie

Wymagany Node.js. W katalogu `worker/`:

```bash
npm install -g wrangler      # jednorazowo
wrangler login               # otworzy przeglądarkę, zaloguj się do Cloudflare
wrangler secret put RAGIC_API_KEY
# wklej NOWY klucz z Ragic (stary, ten z historii gita, musi być unieważniony)
wrangler deploy
```

`wrangler deploy` wypisze adres, np.:

```
https://ragic-proxy.twoja-nazwa.workers.dev
```

Ten adres wklej w obu plikach HTML jako `CONFIG.API_URL`, dopisując `/ragic`:

- `index.html` → `API_URL: 'https://ragic-proxy.twoja-nazwa.workers.dev/ragic'`
- `etykiety-produktowe.html` → to samo

Potem commit + push. GitHub Pages przebuduje się w ~1 minutę.

## Test

```bash
curl "https://ragic-proxy.twoja-nazwa.workers.dev/ragic?sheet=wys&recordId=40474"
```

Powinien wrócić JSON rekordu. Bez `sheet` albo z nienumerycznym `recordId` -
błąd 400.

## Konfiguracja

| Co | Gdzie | Uwagi |
|---|---|---|
| `RAGIC_API_KEY` | sekret Cloudflare | `wrangler secret put RAGIC_API_KEY` - nigdy w repo |
| `ALLOWED_ORIGINS` | `wrangler.toml` → `[vars]` | lista po przecinku; skąd wolno wołać |
| lista arkuszy | `src/index.js` → `SHEETS` | biała lista, tylko te ścieżki są osiągalne |

Nowy arkusz = dopisz wpis do `SHEETS` i `wrangler deploy`.

## Czego to NIE robi

Endpoint proxy jest publiczny - kto zna adres, może odpytać o rekord z arkuszy
z listy `SHEETS`. To świadomy kompromis: strony są otwierane z Ragica bez
żadnego tokenu, więc nie ma czym uwierzytelnić użytkownika. Istotne jest to, że
wyciec może najwyżej odczyt dwóch arkuszy, a nie klucz dający dostęp do całego
konta Ragic.

Dodatkowe ograniczenie ryzyka (zalecane): wystaw klucz API osobnemu
użytkownikowi Ragic z uprawnieniem tylko do odczytu tych dwóch arkuszy, zamiast
używać klucza konta administracyjnego.

`ALLOWED_ORIGINS` blokuje wywołania z cudzych stron w przeglądarce (CORS), ale
nie zatrzyma `curl`-a - nagłówek `Origin` można sobie ustawić dowolnie.

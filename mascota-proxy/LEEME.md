# Rocky, el copiloto — proxy en Cloudflare Workers

La página de RPL (GitHub Pages) **no puede guardar la clave de la API de Claude**: cualquiera la vería. Este Worker la guarda como secreto y reenvía las preguntas a Claude.

```
Navegador (RPL)  ──POST /v1/messages──▶  Worker (este proyecto)  ──▶  API de Claude
  SDK de Anthropic                         clave secreta, modelo,
  con baseURL = Worker                     prompt, herramientas, límites
```

## Qué decide el Worker (y no el navegador)

| Qué | Dónde se cambia |
|---|---|
| Modelo (`claude-haiku-5-5` por defecto) | `MODEL` en `wrangler.toml` |
| Largo máximo y esfuerzo de las respuestas | `MAX_TOKENS`, `EFFORT` en `wrangler.toml` |
| Personalidad y reglas del copiloto | `src/prompt.ts` |
| Herramientas (ver diseño, simular cambio) | `src/tools.ts`; se ejecutan en el navegador |
| Páginas que pueden usarlo | `ALLOWED_ORIGINS` en `wrangler.toml` |

Del navegador solo toma la conversación (`messages`), y la revisa en `src/guard.ts`.

## Protecciones

1. **Grupo**: el alumno elige su grupo (501, 502, 503 o 504) y el navegador lo manda en el encabezado `x-rpl-group`; si no está en `GROUPS`, responde 400. No es una contraseña: sirve para repartir y contar las preguntas por grupo.
2. **Origen**: solo responde a las páginas de `ALLOWED_ORIGINS`.
3. **Por minuto**: 8 preguntas por alumno (`PER_MINUTE`) y 60 por red/IP (`PER_IP`); se cambian en `[[ratelimits]]`.
4. **Por día**, con el día de Culiacán: 40 por alumno (`DAILY_PER_STUDENT`), 900 por grupo (`DAILY_PER_GROUP`) y 3000 en total (`DAILY_TOTAL`).
5. **Tamaño**: máximo 40 mensajes, 64 KB y 4000 caracteres por pregunta; solo texto y resultados de herramientas (nada de imágenes ni documentos).
6. **Tope de gasto**: ponlo también en la consola de Claude (Settings → Limits). Es el freno definitivo.

> **Quién es "un alumno"**: cada navegador guarda un identificador anónimo al azar (`rpl.copilot.device`) y lo manda en `x-rpl-device`. Así un salón entero que sale por la misma IP del Tec no comparte un solo límite. Si un alumno borra los datos del navegador obtiene otro identificador; los topes por grupo, el total y el tope por IP siguen protegiendo el saldo. Sin identificador válido (una copia vieja de la página) se cuenta por IP. Si un salón lleno ve "muy ocupado en tu red", sube el `limit` de `PER_IP`.

> Como no hay contraseña, cualquiera que abra la página puede usar el copiloto. Lo que acota el gasto son los límites de arriba y el tope en la consola de Claude.

### Cambiar los grupos (por ejemplo, el próximo semestre)

Edita la lista en **dos** lugares y publica los dos:
- `GROUPS` en `wrangler.toml` → `npm run deploy`
- `COPILOT_GROUPS` en `src/ui/copilot/groups.ts` de la app → push a `main`

## Probar en local

```bash
cd mascota-proxy
npm install
cp .dev.vars.example .dev.vars   # y pon tu clave real
npm run dev                      # http://localhost:8787
```

`curl http://localhost:8787/health` debe responder `{"ok":true,...}`.

## Publicar (una sola vez)

```bash
cd mascota-proxy
npx wrangler login                                   # abre el navegador para entrar a Cloudflare
npx wrangler kv namespace create QUOTA               # copia el id que imprime en wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY            # pega la clave de la consola de Claude
npm run deploy                                       # imprime la URL: https://rpl-copiloto.<tu-cuenta>.workers.dev
```

## Cuánto cuesta

Cloudflare Workers (plan gratuito): 100 000 peticiones al día, de sobra para el grupo.
Claude con `claude-haiku-5-5`: alrededor de USD 0.001 por pregunta, unos USD 3–4 por semana con 90 alumnos haciendo 30 preguntas cada uno.

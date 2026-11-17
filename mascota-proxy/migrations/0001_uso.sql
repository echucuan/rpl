-- Uso del RPL para la investigación del profesor: sin nombres ni datos personales.
-- "device" es el identificador anónimo al azar de cada navegador; "grp" el grupo que eligió (501–504).

-- Lo que pasa en el simulador, sumado por minuto: tiempo activo por pantalla, clics, cambios, vistas…
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,          -- ms (UTC) en que el navegador envió el lote
  day     TEXT    NOT NULL,          -- día en Culiacán, AAAA-MM-DD
  device  TEXT    NOT NULL,
  grp     TEXT    NOT NULL DEFAULT '',
  session TEXT    NOT NULL,          -- una visita (una pestaña abierta)
  kind    TEXT    NOT NULL,          -- start | time | view | click | edit | rocky_open | rocky_read | rocky_unread
  route   TEXT    NOT NULL DEFAULT '',
  target  TEXT    NOT NULL DEFAULT '',
  value   REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_day ON events (day);
CREATE INDEX IF NOT EXISTS events_device ON events (device);

-- Cada vuelta de Rocky: la pregunta (la primera vuelta de cada turno), lo que respondió y las herramientas que usó.
CREATE TABLE IF NOT EXISTS rocky (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  day         TEXT    NOT NULL,
  device      TEXT    NOT NULL,
  grp         TEXT    NOT NULL,
  turn        TEXT    NOT NULL,      -- una pregunta del alumno y todas las vueltas de su respuesta
  question    TEXT    NOT NULL DEFAULT '',
  answer      TEXT    NOT NULL DEFAULT '',
  tools       TEXT    NOT NULL DEFAULT '',
  in_tokens   INTEGER NOT NULL DEFAULT 0,
  out_tokens  INTEGER NOT NULL DEFAULT 0,
  ms          INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'ok' -- ok | error
);
CREATE INDEX IF NOT EXISTS rocky_day ON rocky (day);
CREATE INDEX IF NOT EXISTS rocky_turn ON rocky (turn);

-- Saldo estimado de Claude en la página de datos: el gasto se calcula con los tokens de cada vuelta de Rocky.
-- La caché cuesta distinto (leer ~0.1×, escribir ~1.25× la entrada normal), así que se guarda aparte; las filas
-- anteriores quedan en 0 y cuentan como entrada normal (estimación un poco alta). in_tokens sigue siendo el total.
ALTER TABLE rocky ADD COLUMN cache_read  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rocky ADD COLUMN cache_write INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rocky ADD COLUMN model       TEXT    NOT NULL DEFAULT ''; -- '' = el MODEL actual del Worker

-- Recargas de crédito en la consola de Claude, anotadas a mano en la página de datos.
-- Saldo estimado = suma de recargas − gasto estimado desde la primera recarga.
CREATE TABLE IF NOT EXISTS credit (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,           -- ms (UTC) desde los que cuenta esta recarga
  usd   REAL    NOT NULL,
  note  TEXT    NOT NULL DEFAULT ''
);

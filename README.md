# Rocket Physics Lab (RPL)

Simulador web de cohetes para las prácticas de física del Tecnológico de Monterrey, Campus Sinaloa.

- **Cohetes Estes:** diseño pieza por pieza (catálogo Estes o piezas impresas en PLA Aero con su peso medido) o a partir de un kit, con los motores Estes y sus curvas de empuje reales.
- **Cohetes de agua:** botella Topo Chico de 1.5 L, lanzador de boca completa, hasta 90 psi.
- Estabilidad (Barrowman), vuelo vertical con arrastre, apertura del paracaídas, gráficas y comparación con el altímetro Estes o un archivo CSV (PASCO).
- Los diseños se guardan en el navegador de cada alumno y se pueden descargar.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/rpl/
npm test         # pruebas de física (validadas contra OpenRocket 24.12)
npm run build    # sitio estático en dist/
```

Los datos de motores y piezas (`src/data/`) se regeneran desde una instalación de OpenRocket:

```bash
npm run data -- "C:\Program Files\OpenRocket\jar\OpenRocket-24.12.jar"
```

## Licencias

- Código: GPL-3.0-or-later.
- Catálogo de piezas Estes: bases de datos de componentes de OpenRocket (Apache-2.0).
- Curvas de empuje: base de datos de motores de OpenRocket (datos de ThrustCurve.org / NAR).
- Tipografía: Inter (SIL Open Font License). Neue Haas Grotesk se usa solo si está instalada en el equipo de quien visita; sus archivos no se publican.
- Logotipo del Tecnológico de Monterrey: uso institucional, sujeto al Manual de Identidad.

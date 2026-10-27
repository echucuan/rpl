# Rocket Physics Lab Sinaloa (RPL)

Simulador web de cohetes para las prácticas de física del Tecnológico de Monterrey, Campus Sinaloa, con la metodología Física → Matemáticas → Computación.

**Abrir el simulador:** https://echucuan.github.io/rpl/

- **Rocket Tec (combustible sólido):** motor Estes A10-3T, nariz, aletas y porta motor impresos en PLA, cuerpo de una hoja carta de opalina enrollada, paracaídas Estes de 24" y altímetro Estes en la nariz.
- **Rocket Challenge (agua):** botella Topo Chico de 1.5 L, lanzador de boca completa, hasta 90 psi.
- Estabilidad (Barrowman), vuelo vertical con arrastre, lecciones por fase del vuelo con código en MATLAB y script de MATLAB descargable.
- Comparación con el altímetro Estes o un archivo CSV (PASCO).
- Cada alumno guarda su diseño como archivo `.rpl.json` en su computadora; la aplicación avisa antes de salir con cambios sin descargar y guarda un borrador de recuperación solo en su navegador.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/rpl/
npm test         # pruebas de la física y del guardado
npm run build    # sitio estático en dist/
```

Cada push a `main` corre las pruebas y, si pasan, publica el sitio en GitHub Pages (`.github/workflows/deploy.yml`). En el repositorio, **Settings → Pages → Source** debe estar en **GitHub Actions**.

## Licencias y créditos

- Código: GPL-3.0-or-later.
- Especificaciones de productos: Estes Industries (estesrockets.com).
- Curva de empuje del A10-3T: prueba de certificación de la NAR, publicada en ThrustCurve.org.
- Tipografía: Inter (SIL Open Font License). Neue Haas Grotesk se usa solo si está instalada en el equipo de quien visita; sus archivos no se publican.
- Logotipo del Tecnológico de Monterrey: uso institucional, sujeto al Manual de Identidad. Logotipos Rocket Tec y Rocket Challenge: del Campus Sinaloa.

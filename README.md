# Rocket Physics Lab (RPL)

Simulador web de cohetes para las prácticas de física del Tecnológico de Monterrey, Campus Sinaloa, con la metodología Física → Matemáticas → Computación.

- **Rocket Tec (combustible sólido):** motor Estes A10-3T, nariz, aletas y porta motor impresos en PLA, cuerpo de una hoja carta de opalina enrollada, paracaídas Estes de 24" y altímetro Estes en la nariz.
- **Rocket Challenge (agua):** botella Topo Chico de 1.5 L, lanzador de boca completa, hasta 90 psi.
- Estabilidad (Barrowman), vuelo vertical con arrastre, lecciones por fase del vuelo con código en MATLAB y script de MATLAB descargable.
- Comparación con el altímetro Estes o un archivo CSV (PASCO). Los diseños se guardan en el navegador de cada alumno.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/rpl/
npm test         # pruebas de la física contra soluciones exactas
npm run build    # sitio estático en dist/
```

## Licencias y créditos

- Código: GPL-3.0-or-later.
- Especificaciones de productos: Estes Industries (estesrockets.com).
- Curva de empuje del A10-3T: prueba de certificación de la NAR, publicada en ThrustCurve.org.
- Tipografía: Inter (SIL Open Font License). Neue Haas Grotesk se usa solo si está instalada en el equipo de quien visita; sus archivos no se publican.
- Logotipo del Tecnológico de Monterrey: uso institucional, sujeto al Manual de Identidad. Logotipos Rocket Tec y Rocket Challenge: del Campus Sinaloa.

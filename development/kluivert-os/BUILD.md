# KLUIVERT OS — compilar y verificar el portfolio

Los archivos que publica GitHub Pages (`index.html`, `kpc-game.html` y `pdfs/` en la raíz del repositorio) **no se editan a mano**. `index.html`, `kpc-game.html` y `pdfs/Kluivert_Personal_Mission_Statement.pdf` se generan a partir de `development/kluivert-os/src/` con un único comando, sin dependencias externas (solo Node.js). Los 11 certificados de `pdfs/` son archivos ya optimizados (ver más abajo).

GitHub Pages **no publica** la carpeta `development/`: está excluida en `_config.yml`, en la raíz del repositorio.

## Estructura

```
development/kluivert-os/
  BUILD.md                 este documento
  src/
    site/
      styles/              10-base.css · 20-content.css · 30-overrides.css · 40-responsive.css
      markup/              10-icons.html · 20-screens.html · 30-app-templates.html
      scripts/             runtime.js (intro, Kian's Room, arranque, KLUIVERT OS, router) · app-hydrate.js
    assets/                retrato, 3 páginas del CV y 11 miniaturas de certificados (se incrustan en index.html)
    content/               mission.json — declaración de misión de 7HHEP.EXE (fuente única de la app y del PDF)
    game/                  kpc-game.es.html — KPC GAME original (en español)
  tools/
    build.js               compila index.html, kpc-game.html y el PDF de la misión en la raíz del repositorio
    translate-game.js      traduce los textos de KPC GAME al inglés (la lógica no se toca)
    verify/
      check-scripts.js     comprueba la sintaxis de todos los <script> de un HTML
      text-only-diff.js    demuestra que dos versiones solo difieren en textos/comentarios
      scan-spanish.js      busca restos de texto en español
      check-mission-pdf.js lee el texto del PDF de la misión y comprueba que coincide con mission.json
    pdf/
      mission-pdf.js       genera pdfs/Kluivert_Personal_Mission_Statement.pdf (A4, texto real, determinista)
      optimize-certificates.ps1   receta exacta de optimización de los 11 certificados
      pdfimg.py · ImgTool.cs · SigSheet.cs   herramientas que usa la receta
```

## Requisitos

| Para | Necesitas |
|---|---|
| Compilar la web | Node.js 18 o superior |
| Reproducir los PDF optimizados | Windows con PowerShell 5.1 y Python 3 (solo la biblioteca estándar) |
| Trabajar con el repositorio | Git (y opcionalmente GitHub CLI) |

## Reconstruir desde cero

```
git clone https://github.com/TS-klay27/IPOPortfolioklay.git
cd IPOPortfolioklay/development/kluivert-os
node tools/build.js --check      # 1. comprobar que la raíz está al día (no escribe nada)
node tools/build.js              # 2. regenerar index.html y kpc-game.html en la raíz
```

`--check` compila en una carpeta temporal, compara byte a byte con `index.html`, `kpc-game.html` y `pdfs/Kluivert_Personal_Mission_Statement.pdf` de la raíz y termina con código 1 si algo difiere. Para compilar en otra carpeta: `node tools/build.js --out <carpeta>`.

Durante la compilación, `build.js`:
1. junta los estilos, las plantillas y el código, e inserta `app-hydrate.js` en `runtime.js` de forma segura (sin `String.replace` de texto);
2. genera el PDF de la misión a partir de `src/content/mission.json`, lee su texto para comprobar que está completo y rellena los marcadores `%%MISSION_…%%` de 7HHEP.EXE con el mismo texto;
3. incrusta las imágenes de `src/assets/` como `data:` URI;
4. genera `kpc-game.html` en inglés a partir de `src/game/kpc-game.es.html`;
5. comprueba la sintaxis de todos los scripts y se detiene si encuentra un error, un marcador sin resolver o un bloque de código alterado.

### 7HHEP.EXE
- Se registra como las demás apps: entrada `'7hhep'` en `APPS` (`runtime.js`), plantilla `tpl-7hhep` (`30-app-templates.html`), comportamiento en el bloque `k === '7hhep'` de `app-hydrate.js` y estilos `.hx-*` en `20-content.css`.
- Para cambiar la declaración de misión se edita **solo** `src/content/mission.json`; la app y el PDF se actualizan juntos al compilar. Las frases de `highlights` se resaltan en la app (el texto no cambia; el PDF queda sin resaltar) y la compilación falla si alguna no aparece en el texto.
- Las escenas (montaña, escritorio, ciudad, cairn, rocas, guijarros, arena) son SVG vectorial dentro de la plantilla (`<symbol id="hx-art-…">`); estrellas, edificios y guijarros se dibujan al abrir la app con una semilla fija. No hay imágenes externas ni dependencias.
- El progreso «My Journey» solo vive en memoria mientras la ventana está abierta: no se guarda nada en el navegador.

## Verificar

```
node tools/build.js --check
node tools/verify/check-scripts.js ../../index.html
node tools/verify/check-scripts.js ../../kpc-game.html
node tools/verify/text-only-diff.js src/game/kpc-game.es.html ../../kpc-game.html    # 0 líneas con cambios de código
node tools/verify/scan-spanish.js ../../kpc-game.html
node tools/verify/check-mission-pdf.js                                                 # texto del PDF = mission.json
```

### Certificados (solo si cambian los originales)
Los 11 PDF de certificados de `pdfs/` ya están optimizados y **no se regeneran en cada compilación**. Los originales (39,32 MB) **no se guardan en el repositorio**. Para reproducirlos a partir de los originales:
```
powershell -ExecutionPolicy Bypass -File tools\pdf\optimize-certificates.ps1 -Source <carpeta con los originales> -Out <carpeta nueva>
```
Con la misma receta (1654 px y calidad 88; el certificado 10 a 1800 px y calidad 90) los 11 archivos salen idénticos byte a byte a los publicados.

## Reglas

1. **Kian's Room no se modifica.** Su código es el bloque `KIAN'S ROOM` de `src/site/scripts/runtime.js`.
2. **KPC GAME conserva su lógica.** Solo cambian sus textos, a través de `tools/translate-game.js`.
3. **Nunca se inserta código con `.replace(texto, códigoComoTexto)`**, porque JavaScript convierte `$$` en `$`. Se usa `inject()` o una función.
4. **El tamaño publicado** (raíz sin `development/`) debe quedar por debajo de 25 MB.
5. **Antes de cada commit** se ejecuta `node tools/build.js --check`.
6. **El sistema operativo se llama KLUIVERT OS** en la documentación, los títulos y la interfaz.

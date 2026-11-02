# Marte 3D — PEDIDO 1

## Contexto

La carpeta está vacía (solo `CLAUDE.md` y `prompt.md`). El objetivo del curso es construir
incrementalmente una simulación 3D del rover Perseverance. Este primer pedido es la base:
un proyecto Vite + Three.js corriendo en el navegador, con un paisaje marciano "de película"
(dunas, rocas, cielo caramelo con polvo, sol de tarde cálido con sombras suaves, Fobos y Deimos)
y un script `npm run check` que valide el resultado automáticamente con Playwright.

Prioridad declarada por el usuario: **algo visible en menos de 2 minutos** tras aprobar,
y luego mejorar en máximo 3 rondas de verificación.

## Entorno verificado

- Node v24.22.0 / npm 11.19.1
- Playwright ya tiene Chromium en caché: `~/.cache/ms-playwright/chromium-1248` → **no se descarga ningún navegador**
  (se instala `playwright` con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` y se usa el ejecutable en caché).
- Nota: el Chrome del sistema es el de Windows (`/mnt/c/.../chrome.exe`); un Playwright de Linux
  no puede manejar un `.exe` de Windows, así que se usa el Chromium ya presente en caché. Mismo
  resultado y cero descargas.

## Fase A — Visible rápido (objetivo < 2 min)

1. `npm create vite@latest . -- --template vanilla` + `npm i three` (vanilla JS, sin TS, sin framework).
2. `vite.config.js`: `server: { host: true, port: 5173 }` para que funcione en el navegador de VS Code.
3. `src/main.js` mínimo pero ya con el look pedido:
   - Renderer con `ACESFilmicToneMapping`, `outputColorSpace` sRGB, sombras `PCFSoftShadowMap`.
   - Cielo: `fog` color caramelo (`#d9a173`) + gran esfera invertida con `ShaderMaterial` de
     gradiente vertical (horizonte cálido → cenit más pálido/azulado como en Marte real).
   - Terreno: `PlaneGeometry` segmentado, desplazado por ruido fBm (función de ruido propia,
     ~30 líneas, sin dependencias) → dunas; `vertexColors` para variar el tono del regolito.
   - Sol de tarde: `DirectionalLight` cálida baja en el horizonte + `HemisphereLight` tenue
     para el rebote del polvo; `shadow.mapSize` 2048 y `radius` alto para sombras suaves.
   - Rocas: `IcosahedronGeometry` deformada, repartida con `InstancedMesh` (~200) sobre el terreno.
   - Fobos y Deimos: dos esferas pequeñas, texturadas por color/deformación, con tamaños y
     alturas distintas en el cielo.
   - `OrbitControls` (desde `three/examples/jsm/controls/OrbitControls.js`) y `resize` handler.
4. `npm run dev` en background e informar la URL.

## Fase B — `npm run check`

- `scripts/check.mjs` (ESM, Node puro):
  - Lanza `chromium` con `executablePath` del caché y `headless: true`, viewport 1280×720.
  - Escucha `console` y `pageerror`; navega a `http://localhost:5173`, espera a que
    `window.__sceneReady` sea `true` (bandera que `main.js` pone tras el primer frame) con timeout.
  - Guarda `check/screenshot.png` y `check/console.json`; imprime resumen y sale con
    código ≠ 0 si hubo errores.
- `package.json`: `"check": "node scripts/check.mjs"`.
- `.gitignore`: `node_modules`, `check/`.

## Fase C — Rondas de mejora (máx. 3)

Tras cada mejora grande: `npm run check`, **leer la captura con el tool Read** y corregir.

- Ronda 1: ajustar exposición/tone mapping, altura del sol y niebla si la imagen sale lavada u oscura.
- Ronda 2: polvo en suspensión (`Points` con sprite radial y deriva lenta), rayos de luz suaves
  en el horizonte, y densidad/escala de rocas y dunas.
- Ronda 3: pulido final — contraste del cielo, visibilidad de ambas lunas, rendimiento (fps estable).

Criterio de "listo": `npm run check` sin errores de consola y la captura mostrando
dunas, rocas, cielo caramelo polvoriento, luz cálida con sombras largas y las dos lunas.

## Archivos a crear

- `index.html`, `src/main.js`, `src/style.css`
- `src/terrain.js` (ruido fBm + geometría), `src/sky.js` (shader de cielo), `src/moons.js`
- `vite.config.js`, `scripts/check.mjs`, `package.json`, `.gitignore`

## Verificación end-to-end

1. `npm run dev` → abrir `http://localhost:5173` en el navegador de VS Code; la escena se ve y
   se puede orbitar con el mouse.
2. `npm run check` → exit 0, `check/console.json` vacío de errores, `check/screenshot.png` con todo lo pedido.

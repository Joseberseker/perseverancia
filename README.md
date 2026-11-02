# 🔴 Perseverancia — Marte en el navegador

Un atardecer en el cráter Jezero, renderizado en tiempo real con **Three.js**, con el
rover **Perseverance** de la NASA conducible a escala real.

![Paisaje marciano con el sol de tarde y las dos lunas](docs/capturas/paisaje.png)

> Proyecto hecho como práctica del **Curso de Claude Code para Programadores** (Platzi).
> Toda la escena es procedural: no hay texturas descargadas ni mapas de altura externos.
> Lo único que se descarga es el modelo 3D oficial del rover.

---

## Qué tiene

- **Terreno procedural** de 700 × 700 m con dunas, generado con simplex noise y fBm
  escritos a mano, sin dependencias.
- **Cielo con shader propio**: caramelo polvoriento, banda de polvo en el horizonte y
  el halo azulado que el polvo fino de Marte produce alrededor del sol al atardecer.
- **Fobos y Deimos** modeladas con cráteres de perfil geológico real.
- **El rover Perseverance** de la NASA, a su tamaño real de 3 metros.
- **Conducción con WASD**, con el rover inclinándose según la pendiente.
- **Huellas de las ruedas** con el patrón de galones de los grousers reales.
- **Verificación automática** con `npm run check`: abre la página en un Chrome
  headless, guarda una captura y falla si hay errores de consola.

## Capturas

| El rover a escala real | El rastro de huellas |
|---|---|
| ![El rover Perseverance sobre las dunas](docs/capturas/rover.png) | ![Rastro de huellas sobre la arena](docs/capturas/huellas.png) |

**Fobos**, con su cráter dominante tipo Stickney:

![Fobos vista de cerca](docs/capturas/lunas.png)

## Cómo ejecutarlo

```bash
npm install
npm run dev          # http://localhost:5173
```

### Controles

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` o flechas | Conducir |
| `Shift` | Turbo |
| `C` | Devolver la cámara detrás del rover |
| `T` | Borrar las huellas |
| `R` | Volver al punto de inicio |
| Ratón | Arrastrar para orbitar, rueda para acercar |

### Verificación

```bash
npm run check
```

Abre la página en un Chromium headless (el que Playwright ya tenga en caché, **sin
descargar navegadores**), espera a que la escena termine de renderizar, guarda
`check/screenshot.png` y `check/console.json`, y sale con código ≠ 0 si hubo errores
de consola. Útil para CI y para revisar un cambio sin abrir el navegador.

## Cómo está hecho

```
src/
  main.js       escena, luces, cámara y bucle de render
  noise.js      simplex noise 2D + fBm, sin dependencias
  terrain.js    campo de altura (dunas, erosión, rizos) y malla del terreno
  sky.js        shader de la cúpula del cielo
  textures.js   normal maps y mapas de rugosidad procedurales, sin costura
  rocks.js      rocas repartidas con InstancedMesh
  moons.js      Fobos y Deimos con cráteres
  dust.js       polvo en suspensión
  rover.js      carga del GLB, escala real y conducción
  tracks.js     huellas de las ruedas
scripts/
  check.mjs     verificación automática con Playwright
public/
  models/       el GLB del rover
  draco/        decodificador Draco servido en local
```

### Tres detalles que costaron encontrarse

**1. `IcosahedronGeometry` no viene indexada.** Cada triángulo tiene sus propios
vértices, así que `computeVertexNormals()` produce *flat shading* por mucho detalle
que se le ponga. Las lunas y las rocas se veían facetadas hasta que pasaron por
`mergeVertices()` para soldar los vértices duplicados.

**2. Su parámetro `detail` no crece como `4ⁿ`,** sino que subdivide cada arista en
`detail + 1`, de modo que los vértices van como `(detail + 1)²`. Un `detail: 5` daba
362 vértices, no diez mil.

**3. Los normal maps procedurales tienen que repetir sin costura.** Se construyen como
suma de ondas con **frecuencias enteras** sobre el cuadro `[0,1)`: así son periódicos
por construcción y se pueden tilear sobre el terreno sin que se vea la junta.

### Decisiones conscientes

- **La velocidad no es real.** El Perseverance se mueve a 0.042 m/s (152 metros por
  hora). A esa velocidad esto sería injugable, así que conduce a 2.6 m/s.
- **Las dunas tampoco.** Están a ~3 m de altura para que el rover pueda subirlas y
  guarden proporción con él.
- **Las lunas se ven más grandes** de lo que se verían desde la superficie de Marte.
  Licencia poética para que se aprecien los cráteres.

## Créditos

- Modelo 3D del rover: [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
  — *Mars 2020 Perseverance Rover*.
- Decodificador Draco: incluido en [three.js](https://github.com/mrdoob/three.js).
- Todo lo demás (terreno, cielo, lunas, rocas, polvo, huellas) es procedural.

## Tecnologías

Three.js · Vite · JavaScript (sin framework) · GLSL · Playwright

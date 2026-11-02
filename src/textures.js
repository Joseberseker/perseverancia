import * as THREE from 'three'

// Mapas de normales procedurales generados en canvas.
//
// Se construyen como suma de ondas con frecuencias ENTERAS sobre el cuadro
// [0,1): eso los hace periódicos por construcción, así que repiten sin costura
// por mucho que se tileen sobre el terreno.

function makeDeterministicRandom(seed) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Conjunto de ondas: dirección, frecuencia entera, amplitud y fase.
function buildWaves(rand, { waves, minFreq, maxFreq, falloff, anisotropy }) {
  const out = []
  for (let i = 0; i < waves; i++) {
    const f = Math.round(THREE.MathUtils.lerp(minFreq, maxFreq, (i / waves) ** 1.4))
    const angle = rand() * Math.PI * 2
    // anisotropy = 1 → ondas en cualquier dirección (roca)
    // anisotropy < 1 → ondas alineadas, como los rizos de arena del viento
    // Una de cada tres ondas ignora la dirección dominante: rompe el
    // patrón de rayas perfectas y deja algo más parecido a grano de arena.
    const k = i % 3 === 0 ? 1.0 : anisotropy
    const dirX = Math.cos(angle)
    const dirZ = Math.sin(angle) * k
    const len = Math.hypot(dirX, dirZ) || 1
    out.push({
      fx: Math.max(1, Math.round((dirX / len) * f)),
      fy: Math.round((dirZ / len) * f),
      amp: 1 / f ** falloff,
      phase: rand() * Math.PI * 2,
    })
  }
  return out
}

function heightFieldFromWaves(size, waves) {
  const h = new Float32Array(size * size)
  const TAU = Math.PI * 2
  let min = Infinity
  let max = -Infinity

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      let sum = 0
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i]
        sum += w.amp * Math.sin(TAU * (w.fx * u + w.fy * v) + w.phase)
      }
      h[y * size + x] = sum
      if (sum < min) min = sum
      if (sum > max) max = sum
    }
  }

  const span = Math.max(1e-6, max - min)
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - min) / span
  return h
}

// Sobel con índices envolventes -> normal map tileable.
function normalMapFromHeight(h, size, strength) {
  const data = new Uint8ClampedArray(size * size * 4)
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))

      const nx = dx * strength
      const ny = dy * strength
      const len = Math.hypot(nx, ny, 1)
      const i = (y * size + x) * 4
      data[i] = ((nx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

// Mapa en escala de grises (para rugosidad): más claro = más rugoso.
function grayMapFromHeight(h, size, contrast, floor) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let i = 0; i < h.length; i++) {
    const v = (THREE.MathUtils.clamp((h[i] - 0.5) * contrast + 0.5, 0, 1) * (1 - floor) + floor) * 255
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

let sandCache = null
let rockCache = null

// Arena: rizos finos y alineados, como los que deja el viento marciano.
export function sandMaps(size = 512) {
  if (sandCache) return sandCache
  const rand = makeDeterministicRandom(4711)
  const h = heightFieldFromWaves(
    size,
    buildWaves(rand, { waves: 34, minFreq: 6, maxFreq: 120, falloff: 1.0, anisotropy: 0.5 }),
  )
  sandCache = {
    normalMap: normalMapFromHeight(h, size, 1.5),
    roughnessMap: grayMapFromHeight(h, size, 0.5, 0.8),
  }
  return sandCache
}

// Roca: picado isótropo, sin dirección dominante.
export function rockMaps(size = 512) {
  if (rockCache) return rockCache
  const rand = makeDeterministicRandom(90210)
  const h = heightFieldFromWaves(
    size,
    buildWaves(rand, { waves: 36, minFreq: 4, maxFreq: 110, falloff: 0.95, anisotropy: 1.0 }),
  )
  rockCache = {
    normalMap: normalMapFromHeight(h, size, 3.4),
    roughnessMap: grayMapFromHeight(h, size, 0.6, 0.75),
  }
  return rockCache
}

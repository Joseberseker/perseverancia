import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeNoise2D } from './noise.js'

// Fobos y Deimos: cuerpos irregulares con cráteres de verdad.
// El perfil de cada cráter es el clásico: suelo hundido, borde elevado y
// manto de eyecta que se desvanece hacia afuera.

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

function randomCraters(rand, count, radius, hero = 0) {
  const craters = []
  if (hero > 0) {
    // Cráter dominante (en Fobos sería Stickney).
    craters.push({
      dir: new THREE.Vector3(0.72, 0.28, 0.63).normalize(),
      arc: hero * radius * Math.PI * 0.5,
      depth: hero * radius * 0.42,
    })
  }
  for (let i = 0; i < count; i++) {
    // Dirección uniforme sobre la esfera.
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const s = Math.sqrt(1 - z * z)
    const dir = new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z)
    // Muchos pequeños, pocos grandes.
    const size = THREE.MathUtils.lerp(0.06, 0.42, rand() ** 2.6)
    craters.push({
      dir,
      arc: size * radius * Math.PI * 0.5, // radio del cráter medido sobre la superficie
      depth: size * radius * 0.42,
    })
  }
  return craters
}

// Perfil radial del cráter. t = distancia / radio del cráter.
// Suelo plano, pared empinada y labio marcado: sin ese borde los cráteres
// se leen como abolladuras en vez de impactos.
function craterProfile(t) {
  if (t < 0.68) return -0.85 // suelo
  if (t < 1.0) {
    const k = (t - 0.68) / 0.32
    return -0.85 + 1.3 * (k * k * (3 - 2 * k)) // pared -> labio (+0.45)
  }
  return 0.45 * Math.exp(-(t - 1) * 5.5) // eyecta, cae rápido
}

function rockyBody(radius, detail, { bumpiness, craterCount, seed, hero = 0 }) {
  // IcosahedronGeometry viene SIN índice: cada triángulo tiene vértices
  // propios, así que computeVertexNormals() daría flat shading por mucho
  // detalle que pongamos. mergeVertices() los suelda y permite normales
  // suaves de verdad.
  const raw = new THREE.IcosahedronGeometry(radius, detail)
  raw.deleteAttribute('uv')
  raw.deleteAttribute('normal')
  const geometry = mergeVertices(raw)
  const noise = makeNoise2D(seed)
  const rand = makeDeterministicRandom(seed)
  const craters = randomCraters(rand, craterCount, radius, hero)

  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()

  const base = new THREE.Color('#ab9e92')
  const dark = new THREE.Color('#6d635b')
  const bright = new THREE.Color('#c4b8ab')
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.copy(v).normalize()

    // Forma general: patata, no esfera. Las tres escalas van multiplicadas
    // por bumpiness; si la fina se escapa, el cuerpo parece una piña.
    const big = noise(n.x * 1.3 + 10, n.z * 1.3 - 4) * 0.6 + noise(n.y * 1.1, n.x * 1.1) * 0.4
    const medium = noise(n.x * 2.6, n.y * 2.6 + n.z * 1.2) * 0.2
    const fine = noise(n.x * 6.0, n.y * 6.0 + n.z * 2.5) * 0.045

    // Cráteres acumulados.
    let crater = 0
    for (let k = 0; k < craters.length; k++) {
      const cr = craters[k]
      const cos = THREE.MathUtils.clamp(n.dot(cr.dir), -1, 1)
      const arcDist = Math.acos(cos) * radius
      if (arcDist > cr.arc * 2.2) continue
      crater += craterProfile(arcDist / cr.arc) * cr.depth
    }
    crater = THREE.MathUtils.clamp(crater, -radius * 0.34, radius * 0.16)

    const relief = (big + medium + fine) * bumpiness * radius
    v.setLength(radius + relief + crater)
    pos.setXYZ(i, v.x, v.y, v.z)

    // Albedo: suelos de cráter oscuros, bordes y eyecta más claros.
    const k = THREE.MathUtils.clamp(crater / (radius * 0.14), -1, 1)
    c.copy(base)
    if (k < 0) c.lerp(dark, -k * 0.85)
    else c.lerp(bright, k * 0.8)
    c.offsetHSL(0, 0, medium * 0.1)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function placeOnSky(mesh, distance, azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  const el = THREE.MathUtils.degToRad(elevationDeg)
  mesh.position.set(
    Math.cos(el) * Math.sin(az) * distance,
    Math.sin(el) * distance,
    Math.cos(el) * Math.cos(az) * distance,
  )
}

export function createMoons() {
  const group = new THREE.Group()
  group.name = 'lunas'

  const material = () =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0.0,
      fog: false,
    })

  // Fobos: el grande, con Stickney como cráter dominante.
  const phobos = new THREE.Mesh(
    rockyBody(22, 44, { bumpiness: 0.17, craterCount: 46, seed: 555, hero: 0.62 }),
    material(),
  )
  phobos.name = 'fobos'
  phobos.rotation.set(0.4, 1.1, 0.2)
  placeOnSky(phobos, 760, 199, 14)

  // Deimos: más pequeño, más liso (su regolito rellena los cráteres).
  const deimos = new THREE.Mesh(
    rockyBody(10, 32, { bumpiness: 0.15, craterCount: 26, seed: 909 }),
    material(),
  )
  deimos.name = 'deimos'
  deimos.rotation.set(-0.6, 0.3, 0.9)
  placeOnSky(deimos, 900, 178, 27)

  group.add(phobos, deimos)
  group.userData.fobos = phobos
  group.userData.deimos = deimos
  return group
}

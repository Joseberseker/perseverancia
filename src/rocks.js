import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeNoise2D } from './noise.js'

function rockGeometry(detail, bumpiness, seed) {
  // Soldamos vértices para poder tener normales suaves (ver moons.js).
  const raw = new THREE.IcosahedronGeometry(1, detail)
  raw.deleteAttribute('uv')
  raw.deleteAttribute('normal')
  const geometry = mergeVertices(raw)
  const noise = makeNoise2D(seed)
  const pos = geometry.attributes.position
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    // Todas las escalas multiplicadas por bumpiness y sin frecuencias
    // altas sueltas: si no, al subir el teselado la roca se vuelve un erizo.
    const a = noise(n.x * 1.8, n.z * 1.8)
    const b = noise(n.y * 4.2 + 7, n.x * 4.2 - 3)
    const c = noise(n.x * 8.5 - 5, n.y * 8.5 + n.z * 3.5)
    v.setLength(1 + (a + b * 0.4 + c * 0.13) * bumpiness)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  geometry.computeVertexNormals()
  return geometry
}

const PALETTE = ['#8a5c42', '#7a5747', '#a57149', '#6d5244', '#b8855d']

// Rocas repartidas con InstancedMesh: muchas piedras, pocos draw calls.
export function createRocks(height, { count = 1100, area = 420, seed = 31 } = {}) {
  const variants = [
    { geo: rockGeometry(5, 0.3, seed + 1), share: 0.5, size: [0.5, 1.6] },
    { geo: rockGeometry(7, 0.42, seed + 2), share: 0.36, size: [1.0, 3.4] },
    { geo: rockGeometry(10, 0.22, seed + 3), share: 0.14, size: [2.6, 7.0] },
  ]

  const group = new THREE.Group()
  group.name = 'rocas'
  const rand = makeDeterministicRandom(seed)
  const color = new THREE.Color()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()

  for (const variant of variants) {
    const n = Math.round(count * variant.share)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 })
    const mesh = new THREE.InstancedMesh(variant.geo, material, n)
    mesh.castShadow = true
    mesh.receiveShadow = true

    for (let i = 0; i < n; i++) {
      // Distribución en disco, más densa lejos del centro para dejar
      // despejado el punto de vista inicial.
      const r = 10 + Math.sqrt(rand()) * area
      const a = rand() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r

      const scale = THREE.MathUtils.lerp(variant.size[0], variant.size[1], rand() ** 1.6)
      const y = height(x, z) + scale * 0.32 // apenas enterrada

      p.set(x, y, z)
      e.set(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI)
      q.setFromEuler(e)
      s.set(scale * (0.8 + rand() * 0.5), scale * (0.55 + rand() * 0.45), scale * (0.8 + rand() * 0.5))
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)

      color.set(PALETTE[Math.floor(rand() * PALETTE.length)])
      color.offsetHSL(0, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.12)
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)
  }

  return group
}

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

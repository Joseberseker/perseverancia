import * as THREE from 'three'
import { makeNoise2D, makeFbm } from './noise.js'
import { sandMaps } from './textures.js'

// La escena está en METROS: el rover mide 3 m de largo.
export const TERRAIN_SIZE = 700

// Campo de altura: relieve amplio + campo de dunas + rizos de arena.
export function createHeightField(seed = 1337) {
  const fbm = makeFbm(makeNoise2D(seed), 5)
  const warp = makeFbm(makeNoise2D(seed + 91), 3)
  const mask = makeFbm(makeNoise2D(seed + 457), 3)

  return function height(x, z) {
    // Relieve de fondo: lomas suaves y una cuenca abierta.
    let h = fbm(x * 0.006, z * 0.006) * 11

    // Dunas transversales: crestas sinusoidales deformadas por ruido.
    const w = warp(x * 0.005, z * 0.005)
    const phase = x * 0.1 + z * 0.03 + w * 7.5
    const crest = 0.5 + 0.5 * Math.sin(phase)
    // Perfil asimétrico (barlovento tendido, sotavento corto) y dunas que
    // aparecen y desaparecen según una máscara de baja frecuencia.
    const duneMask = THREE.MathUtils.clamp(mask(x * 0.003, z * 0.003) * 0.75 + 0.55, 0, 1)
    h += Math.pow(crest, 1.8) * 3.2 * duneMask

    // Erosión de media escala: quiebra la suavidad de los flancos.
    h += fbm(x * 0.03, z * 0.03) * 0.9

    // Rizos de arena transversales a la duna, y grano fino.
    const ripple = 0.5 + 0.5 * Math.sin(x * 1.1 + z * 0.42 + w * 26.0 + fbm(x * 0.09, z * 0.09) * 4.0)
    h += ripple * 0.045 * duneMask
    h += fbm(x * 0.17, z * 0.17) * 0.22
    h += fbm(x * 0.62, z * 0.62) * 0.07
    h += fbm(x * 2.3, z * 2.3) * 0.022

    return h
  }
}

const COL_DARK = new THREE.Color('#5e3222')
const COL_MID = new THREE.Color('#a85c38')
const COL_LIGHT = new THREE.Color('#d8a071')
const COL_DUST = new THREE.Color('#e8bd91')

export function createTerrain(height, segments = 700) {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const mottle = makeFbm(makeNoise2D(2024), 4)

  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const y = height(pos.getX(i), pos.getZ(i))
    pos.setY(i, y)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // Color por altura relativa + manchones, para que el regolito no sea plano.
  const span = Math.max(1e-6, maxY - minY)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / span, 0, 1)
    const m = mottle(x * 0.012, z * 0.012) * 0.5 + 0.5

    c.copy(COL_DARK).lerp(COL_MID, THREE.MathUtils.smoothstep(t, 0.05, 0.6))
    c.lerp(COL_LIGHT, THREE.MathUtils.smoothstep(t, 0.45, 0.95))
    // Polvo claro acumulado en las crestas.
    c.lerp(COL_DUST, THREE.MathUtils.smoothstep(t, 0.82, 1.0) * 0.45)
    c.offsetHSL(0, (m - 0.5) * 0.05, (m - 0.5) * 0.09)

    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const { normalMap, roughnessMap } = sandMaps()
  normalMap.repeat.set(90, 90) // ~7.8 m por baldosa
  roughnessMap.repeat.set(90, 90)

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    normalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.name = 'terreno'
  return mesh
}

import * as THREE from 'three'

// Huellas de las ruedas. Las ruedas del Perseverance llevan grousers
// (travesaños) en zigzag, así que la marca es un patrón de galones.
function texturaHuella() {
  const w = 128
  const h = 64
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  // Galones claros = zonas hundidas por los travesaños.
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (let i = -1; i < 7; i++) {
    const x = (i * w) / 6
    ctx.beginPath()
    ctx.moveTo(x, 2)
    ctx.lineTo(x + 11, h / 2)
    ctx.lineTo(x, h - 2)
    ctx.stroke()
  }

  // Bordes de la rodada, un poco marcados.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(0, 0, w, 3)
  ctx.fillRect(0, h - 3, w, 3)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

// Dos rodadas (izquierda y derecha), cada una un anillo circular de marcas
// que se reciclan: así el rastro es largo sin que crezca la memoria.
export function createTracks({ porRodada = 420, anchoRueda = 0.4, largoMarca = 0.34, separacion = 2.1 } = {}) {
  const total = porRodada * 2
  const geometry = new THREE.PlaneGeometry(anchoRueda, largoMarca)
  geometry.rotateX(-Math.PI / 2) // tumbada sobre el suelo

  const alphaMap = texturaHuella()
  const material = new THREE.MeshStandardMaterial({
    color: '#4e2f20',
    alphaMap,
    transparent: true,
    opacity: 0.85,
    roughness: 1.0,
    metalness: 0.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, total)
  mesh.name = 'huellas'
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  // Todas empiezan ocultas (escala 0).
  const cero = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < total; i++) mesh.setMatrixAt(i, cero)
  mesh.instanceMatrix.needsUpdate = true

  let cursor = 0
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const qTilt = new THREE.Quaternion()
  const qYaw = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const escala = new THREE.Vector3(1, 1, 1)
  const UP = new THREE.Vector3(0, 1, 0)
  const lateral = new THREE.Vector3()

  // Deja un par de marcas (rodada izquierda y derecha) en esta posición.
  // `via` es la separación real entre las ruedas de un eje; si no llega,
  // se usa la de fábrica.
  function marcar(pos, rumbo, normal, via = separacion) {
    qTilt.setFromUnitVectors(UP, normal)
    qYaw.setFromAxisAngle(UP, rumbo)
    q.copy(qTilt).multiply(qYaw)

    // Eje lateral del rover, perpendicular al rumbo.
    lateral.set(Math.cos(rumbo), 0, -Math.sin(rumbo))

    for (const lado of [-1, 1]) {
      p.copy(pos).addScaledVector(lateral, (lado * via) / 2)
      p.y += 0.04 // justo encima del suelo, sin z-fighting
      m.compose(p, q, escala)
      mesh.setMatrixAt(cursor, m)
      cursor = (cursor + 1) % total
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  function limpiar() {
    for (let i = 0; i < total; i++) mesh.setMatrixAt(i, cero)
    mesh.instanceMatrix.needsUpdate = true
    cursor = 0
  }

  return { mesh, marcar, limpiar }
}

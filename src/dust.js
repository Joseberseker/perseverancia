import * as THREE from 'three'

function dustSprite() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 228, 196, 0.95)')
  g.addColorStop(0.45, 'rgba(234, 186, 140, 0.35)')
  g.addColorStop(1, 'rgba(234, 186, 140, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Polvo en suspensión: partículas que derivan lento con el viento.
export function createDust({ count = 3400, radius = 320, height = 85 } = {}) {
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * radius
    const a = Math.random() * Math.PI * 2
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = Math.random() ** 2.6 * height + 1.0
    positions[i * 3 + 2] = Math.sin(a) * r
    speeds[i] = 1.4 + Math.random() * 3.2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    map: dustSprite(),
    size: 1.7,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.NormalBlending,
    color: '#e6b589',
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'polvo'
  points.frustumCulled = false

  points.userData.update = (dt) => {
    const pos = geometry.attributes.position
    const arr = pos.array
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      arr[i3] += speeds[i] * dt
      arr[i3 + 1] += Math.sin(arr[i3] * 0.05 + i) * 0.08 * dt
      if (arr[i3] > radius) arr[i3] -= radius * 2
    }
    pos.needsUpdate = true
  }

  return points
}

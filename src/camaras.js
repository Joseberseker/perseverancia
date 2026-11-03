import * as THREE from 'three'
import { CAMARAS } from './fotos.js'

// --------------------------------------------------------------------------
// Puntos de cámara sobre el modelo
// --------------------------------------------------------------------------
// Cuatro piezas del GLB de la NASA llevan encima un punto que late. Al pasar
// el ratón dicen su nombre; al hacer clic, Percy "dispara" y sale una foto
// real suya. Los puntos van colgados del grupo del rover, así que viajan con
// él, y se dibujan sin test de profundidad para que no se los coma el chasis.

function texturaPunto() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')

  // Núcleo cálido que se desvanece.
  const halo = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  halo.addColorStop(0, 'rgba(255,255,255,1)')
  halo.addColorStop(0.18, 'rgba(255,236,200,0.95)')
  halo.addColorStop(0.42, 'rgba(255,170,90,0.45)')
  halo.addColorStop(1, 'rgba(255,140,60,0)')
  g.fillStyle = halo
  g.fillRect(0, 0, s, s)

  // Anillo fino, para que se lea como "pulsa aquí" y no como una chispa.
  g.strokeStyle = 'rgba(255,225,190,0.9)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2)
  g.stroke()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const TAM_BASE = 0.04 // fracción de la distancia a la cámara
const TAM_MIN = 0.14
const TAM_MAX = 0.42

// Mastcam-Z y las Navcam viven las dos en la cabeza del mástil, a 5 cm una de
// otra: sus puntos se taparían y el ratón siempre pulsaría el mismo. Los
// separamos a lo ancho del rover, que es donde hay sitio en la cabeza.
const SEPARACION = 0.46 // m entre puntos

export function crearCamarasDePercy(rover, { camera, dom, onDisparo }) {
  // Ojo: Box3.setFromObject solo actualiza la matriz del propio objeto, no la
  // de sus padres. Si el rover ya se ha colocado sobre el terreno y no se ha
  // dibujado un cuadro todavía, las cajas salen en un sistema y worldToLocal
  // deshace en otro, y los puntos acaban flotando lejos del rover.
  rover.group.updateMatrixWorld(true)

  const grupo = new THREE.Group()
  grupo.name = 'puntos-camara'
  rover.group.add(grupo)
  grupo.updateMatrixWorld(true)

  const textura = texturaPunto()
  const puntos = []
  const centro = new THREE.Vector3()
  const caja = new THREE.Box3()

  for (const ficha of CAMARAS) {
    const pieza = rover.modelo.getObjectByName(ficha.pieza)
    if (!pieza) {
      console.warn(`[cámaras] no encontré la pieza "${ficha.pieza}" en el modelo`)
      continue
    }
    caja.setFromObject(pieza)
    if (caja.isEmpty()) continue
    caja.getCenter(centro)
    rover.group.worldToLocal(centro)

    const material = new THREE.SpriteMaterial({
      map: textura,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    })
    const sprite = new THREE.Sprite(material)
    sprite.name = `punto_${ficha.pieza}`
    sprite.position.copy(centro)
    sprite.renderOrder = 10
    sprite.userData.ficha = ficha
    grupo.add(sprite)

    puntos.push({ ficha, sprite, material, hover: 0, fase: Math.random() * Math.PI * 2 })
  }

  // Si dos puntos quedan encima, los apartamos a lo ancho (eje X del rover):
  // la cabeza del mástil tiene 69 cm de ancho, así que siguen sobre su pieza.
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    let movido = false
    for (let i = 0; i < puntos.length; i++) {
      for (let j = i + 1; j < puntos.length; j++) {
        const a = puntos[i].sprite.position
        const b = puntos[j].sprite.position
        const d = a.distanceTo(b)
        if (d >= SEPARACION) continue
        const empuje = (SEPARACION - d) / 2 + 0.001
        // A lo largo de la horizontal que los separa; si están en la misma
        // vertical, a lo ancho del rover.
        let ex = a.x - b.x
        let ez = a.z - b.z
        if (Math.hypot(ex, ez) < 1e-3) { ex = 1; ez = 0 }
        const n = Math.hypot(ex, ez)
        a.x += (ex / n) * empuje
        a.z += (ez / n) * empuje
        b.x -= (ex / n) * empuje
        b.z -= (ez / n) * empuje
        movido = true
      }
    }
    if (!movido) break
  }

  // --- Ratón -------------------------------------------------------------
  // La prueba de acierto se hace en pantalla, no con un rayo contra el sprite:
  // el punto dibujado mide pocos píxeles y exigir acertarle exactamente hace
  // que se escape. Con un margen fijo en píxeles se pulsa siempre igual de
  // fácil, esté el rover cerca o lejos.
  const RADIO_CLIC = 26 // px
  const puntero = new THREE.Vector2()
  const mundo = new THREE.Vector3()
  const proyectado = new THREE.Vector3()
  let encima = null
  let abajo = null
  let activo = true

  const tip = document.createElement('div')
  tip.className = 'camara-tip'
  tip.setAttribute('aria-hidden', 'true')
  document.body.appendChild(tip)

  function aPuntero(ev) {
    const r = dom.getBoundingClientRect()
    puntero.x = ((ev.clientX - r.left) / r.width) * 2 - 1
    puntero.y = -((ev.clientY - r.top) / r.height) * 2 + 1
  }

  function impactado() {
    const r = dom.getBoundingClientRect()
    const px = ((puntero.x + 1) / 2) * r.width
    const py = ((1 - puntero.y) / 2) * r.height
    let mejor = null
    let d2 = Infinity
    for (const p of puntos) {
      p.sprite.getWorldPosition(mundo)
      proyectado.copy(mundo).project(camera)
      if (proyectado.z > 1) continue // detrás de la cámara
      const sx = ((proyectado.x + 1) / 2) * r.width
      const sy = ((1 - proyectado.y) / 2) * r.height
      const d = (sx - px) ** 2 + (sy - py) ** 2
      if (d < d2) {
        d2 = d
        mejor = p
      }
    }
    return mejor && d2 <= RADIO_CLIC * RADIO_CLIC ? mejor : null
  }

  function onMove(ev) {
    if (!activo) return
    aPuntero(ev)
    const p = impactado()
    encima = p
    dom.style.cursor = p ? 'pointer' : ''
    if (p) {
      tip.textContent = p.ficha.nombre
      tip.classList.add('visible')
      tip.style.transform = `translate(${ev.clientX + 16}px, ${ev.clientY - 14}px)`
    } else {
      tip.classList.remove('visible')
    }
  }

  function onDown(ev) {
    if (!activo) return
    abajo = { x: ev.clientX, y: ev.clientY }
  }

  function onUp(ev) {
    if (!activo || !abajo) return
    const quieto = Math.hypot(ev.clientX - abajo.x, ev.clientY - abajo.y) < 6
    abajo = null
    if (!quieto) return // estaba orbitando, no pulsando
    aPuntero(ev)
    const p = impactado()
    if (p) {
      tip.classList.remove('visible')
      onDisparo?.(p.ficha, p)
    }
  }

  function onSalir() {
    encima = null
    tip.classList.remove('visible')
  }

  dom.addEventListener('pointermove', onMove)
  dom.addEventListener('pointerdown', onDown)
  dom.addEventListener('pointerup', onUp)
  dom.addEventListener('pointerleave', onSalir)

  // --- Latido ------------------------------------------------------------
  let t = 0
  function actualizar(dt) {
    t += dt
    for (const p of puntos) {
      const objetivo = p === encima ? 1 : 0
      p.hover += (objetivo - p.hover) * Math.min(1, dt * 12)

      p.sprite.getWorldPosition(mundo)
      const dist = camera.position.distanceTo(mundo)
      const latido = 1 + 0.14 * Math.sin(t * 2.6 + p.fase)
      const tam = THREE.MathUtils.clamp(dist * TAM_BASE, TAM_MIN, TAM_MAX) * latido * (1 + p.hover * 0.55)
      p.sprite.scale.set(tam, tam, 1)
      p.material.opacity = (0.62 + 0.18 * Math.sin(t * 2.6 + p.fase)) * (1 + p.hover * 0.6)
    }
  }

  // Dónde cae un punto en la pantalla (lo usa npm run check para hacer clic).
  function puntoEnPantalla(pieza) {
    const p = puntos.find((x) => x.ficha.pieza === pieza)
    if (!p) return null
    p.sprite.getWorldPosition(proyectado)
    proyectado.project(camera)
    const r = dom.getBoundingClientRect()
    return {
      x: r.left + ((proyectado.x + 1) / 2) * r.width,
      y: r.top + ((1 - proyectado.y) / 2) * r.height,
      visible: proyectado.z < 1 && Math.abs(proyectado.x) <= 1 && Math.abs(proyectado.y) <= 1,
    }
  }

  // Dónde está el punto en el mundo (para encuadrarlo con la cámara).
  function posicionEnMundo(pieza) {
    const p = puntos.find((x) => x.ficha.pieza === pieza)
    if (!p) return null
    const v = new THREE.Vector3()
    p.sprite.getWorldPosition(v)
    return { x: v.x, y: v.y, z: v.z }
  }

  function bloquear(v) {
    activo = !v
    if (v) onSalir()
  }

  function dispose() {
    dom.removeEventListener('pointermove', onMove)
    dom.removeEventListener('pointerdown', onDown)
    dom.removeEventListener('pointerup', onUp)
    dom.removeEventListener('pointerleave', onSalir)
    tip.remove()
    textura.dispose()
    for (const p of puntos) p.material.dispose()
  }

  return { grupo, puntos, actualizar, puntoEnPantalla, posicionEnMundo, bloquear, dispose }
}

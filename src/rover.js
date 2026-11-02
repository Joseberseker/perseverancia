import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Medidas reales del Perseverance (NASA): 3.0 m de largo, 2.7 m de ancho,
// 2.2 m de alto hasta la cubierta. La escena está en metros.
export const LARGO_REAL = 3.0

// Nombres que delatan una pieza óptica en el modelo de la NASA.
const RE_CAMARA = /cam|navcam|hazcam|mastcam|supercam|watson|sherloc|pixl|lens|optic/i
const RE_FERRETERIA = /bracket|mounting|cover|wiring|screw|bolt|washer|nut_|_nut|clamp|harness/i

export async function loadRover(url = '/models/perseverance.glb') {
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/') // decodificador servido local, sin CDN
  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  const gltf = await loader.loadAsync(url)
  draco.dispose()

  const modelo = gltf.scene

  // --- Escala real -------------------------------------------------------
  // El GLB no viene en metros, así que medimos y escalamos por el lado
  // horizontal más largo.
  const caja = new THREE.Box3().setFromObject(modelo)
  const tam = caja.getSize(new THREE.Vector3())
  const largoCrudo = tam.z // el eje largo del modelo de la NASA es Z
  const escala = LARGO_REAL / largoCrudo
  modelo.scale.setScalar(escala)

  // --- Apoyarlo en el suelo ---------------------------------------------
  const cajaEscalada = new THREE.Box3().setFromObject(modelo)
  const centro = cajaEscalada.getCenter(new THREE.Vector3())
  modelo.position.x -= centro.x
  modelo.position.z -= centro.z
  modelo.position.y -= cajaEscalada.min.y // las ruedas tocan y = 0

  modelo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
      if (o.material) o.material.envMapIntensity = 0.5
    }
  })

  // El grupo externo es el que movemos; dentro queda el modelo ya centrado.
  const group = new THREE.Group()
  group.name = 'rover'
  group.add(modelo)

  // --- Piezas de cámara --------------------------------------------------
  const camaras = []
  modelo.traverse((o) => {
    if (!o.name || !RE_CAMARA.test(o.name)) return
    if (RE_FERRETERIA.test(o.name)) return // soportes y tapas, no ópticas
    camaras.push({ nombre: o.name, tipo: o.type, objeto: o })
  })

  const medidas = {
    escala,
    crudo: { x: +tam.x.toFixed(2), y: +tam.y.toFixed(2), z: +tam.z.toFixed(2) },
    real: {
      largo: +((cajaEscalada.max.z - cajaEscalada.min.z)).toFixed(2),
      ancho: +((cajaEscalada.max.x - cajaEscalada.min.x)).toFixed(2),
      alto: +((cajaEscalada.max.y - cajaEscalada.min.y)).toFixed(2),
    },
  }

  return { group, modelo, camaras, medidas }
}

// --------------------------------------------------------------------------
// Conducción
// --------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0)

// El Perseverance real va a 0.042 m/s (152 m/h). A esa velocidad esto sería
// injugable, así que conducimos a una velocidad "de película".
const VEL_MAX = 2.6
const VEL_MAX_TURBO = 6.5
const ACELERACION = 4.5
const FRENADO = 6.0
const VEL_GIRO = 1.5 // rad/s

// Busca cerca del origen el punto más llano para empezar: arrancar en la
// ladera de una duna deja al rover ladeado y queda feo.
function puntoLlano(height, radio = 45, paso = 3) {
  let mejor = { x: 0, z: 0, pendiente: Infinity }
  for (let x = -radio; x <= radio; x += paso) {
    for (let z = -radio; z <= radio; z += paso) {
      const e = 1.5
      const dx = height(x + e, z) - height(x - e, z)
      const dz = height(x, z + e) - height(x, z - e)
      const pendiente = Math.hypot(dx, dz)
      if (pendiente < mejor.pendiente) mejor = { x, z, pendiente }
    }
  }
  return mejor
}

export function createRoverController(group, height, { onTrack } = {}) {
  const inicio = puntoLlano(height)
  const teclas = new Set()
  const estado = {
    pos: new THREE.Vector3(inicio.x, 0, inicio.z),
    rumbo: Math.PI, // mirando hacia -Z, con el sol a la derecha
    velocidad: 0,
    distancia: 0,
  }

  const onKeyDown = (e) => {
    if (e.repeat) return
    teclas.add(e.code)
    if (e.code === 'KeyR') reset()
  }
  const onKeyUp = (e) => teclas.delete(e.code)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  function reset() {
    estado.pos.set(inicio.x, 0, inicio.z)
    estado.rumbo = Math.PI
    estado.velocidad = 0
  }

  // Normal del terreno por diferencias finitas: para que el rover se
  // incline siguiendo la pendiente en vez de flotar horizontal.
  const normal = new THREE.Vector3()
  // Radio del orden del propio rover: así no reacciona a cada rizo de arena.
  function normalEn(x, z, e = 1.4) {
    normal
      .set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e))
      .normalize()
    return normal
  }

  const qTilt = new THREE.Quaternion()
  const qYaw = new THREE.Quaternion()
  const qObjetivo = new THREE.Quaternion()
  const ultimaHuella = new THREE.Vector3(0, 0, 0)
  let huellaIniciada = false

  function update(dt) {
    const adelante = teclas.has('KeyW') || teclas.has('ArrowUp')
    const atras = teclas.has('KeyS') || teclas.has('ArrowDown')
    const izq = teclas.has('KeyA') || teclas.has('ArrowLeft')
    const der = teclas.has('KeyD') || teclas.has('ArrowRight')
    const turbo = teclas.has('ShiftLeft') || teclas.has('ShiftRight')

    const velMax = turbo ? VEL_MAX_TURBO : VEL_MAX

    if (adelante) estado.velocidad += ACELERACION * dt
    else if (atras) estado.velocidad -= ACELERACION * dt
    else {
      // Rozamiento del regolito.
      const signo = Math.sign(estado.velocidad)
      estado.velocidad -= signo * Math.min(Math.abs(estado.velocidad), FRENADO * dt)
    }
    estado.velocidad = THREE.MathUtils.clamp(estado.velocidad, -velMax * 0.5, velMax)

    // Gira en el sitio o en marcha; el sentido se invierte en retroceso.
    if (izq || der) {
      const dir = (izq ? 1 : 0) - (der ? 1 : 0)
      const enMarcha = Math.abs(estado.velocidad) > 0.05
      const factor = enMarcha ? Math.sign(estado.velocidad) : 1
      estado.rumbo += dir * VEL_GIRO * dt * factor
    }

    if (Math.abs(estado.velocidad) > 1e-4) {
      const avance = estado.velocidad * dt
      estado.pos.x += Math.sin(estado.rumbo) * avance
      estado.pos.z += Math.cos(estado.rumbo) * avance
      estado.distancia += Math.abs(avance)
    }

    // La altura es la mayor de las cuatro esquinas: el chasis se apoya en
    // el punto más alto del terreno que cubre, no en su centro.
    const hx = 1.3
    const hz = 1.5
    const c = Math.sin(estado.rumbo)
    const s2 = Math.cos(estado.rumbo)
    let suma = 0
    for (const [dx, dz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {
      const wx = estado.pos.x + dx * s2 + dz * c
      const wz = estado.pos.z - dx * c + dz * s2
      suma += height(wx, wz)
    }
    // Promedio, no máximo: con el máximo el rover levita sobre el punto más
    // alto en cuanto pisa una ladera.
    estado.pos.y = suma / 4 + 0.1 // despeje de la suspensión
    group.position.copy(estado.pos)

    // Orientación: primero el rumbo, luego la inclinación del terreno.
    const n = normalEn(estado.pos.x, estado.pos.z)
    qTilt.setFromUnitVectors(UP, n)
    qYaw.setFromAxisAngle(UP, estado.rumbo)
    qObjetivo.copy(qTilt).multiply(qYaw)
    group.quaternion.slerp(qObjetivo, Math.min(1, dt * 8))

    // Huellas: una tanda cada 0.3 m recorridos.
    if (onTrack && Math.abs(estado.velocidad) > 0.05) {
      if (!huellaIniciada) {
        ultimaHuella.copy(estado.pos)
        huellaIniciada = true
      } else if (estado.pos.distanceTo(ultimaHuella) >= 0.3) {
        onTrack(estado.pos, estado.rumbo, n)
        ultimaHuella.copy(estado.pos)
      }
    }
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  return { estado, update, reset, dispose }
}

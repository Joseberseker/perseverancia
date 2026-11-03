import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { montarRuedas, medirRuedas } from './wheels.js'

// Medidas reales del Perseverance (NASA): 3.0 m de largo, 2.7 m de ancho,
// 2.2 m de alto hasta la cubierta. La escena está en metros.
export const LARGO_REAL = 3.0

// Datos reales de la movilidad, los que gobiernan la física de abajo.
export const FICHA = {
  masa: 1025, // kg
  gravedad: 3.721, // m/s² en Marte
  ruedaDiametro: 0.525, // m
  velocidadNASA: 0.042, // m/s (152 m/h), la velocidad real de crucero
  pendienteMax: 30, // grados: el límite certificado de la NASA
}

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

  // --- Separar las seis ruedas ------------------------------------------
  // Antes de escalar: el GLB las trae fundidas en una sola malla y sin huesos.
  const montaje = montarRuedas(modelo)

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

  // Medidas de las ruedas ya en metros de escena.
  const ruedas = medirRuedas(group, montaje)

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
      largo: +(cajaEscalada.max.z - cajaEscalada.min.z).toFixed(2),
      ancho: +(cajaEscalada.max.x - cajaEscalada.min.x).toFixed(2),
      alto: +(cajaEscalada.max.y - cajaEscalada.min.y).toFixed(2),
    },
    movilidad: ruedas
      ? {
          ruedas: ruedas.ruedas.length,
          diametro: +(ruedas.radio * 2).toFixed(3),
          ancho: +ruedas.ancho.toFixed(3),
          via: +ruedas.via.toFixed(3),
          batalla: +ruedas.batalla.toFixed(3),
        }
      : null,
  }

  return { group, modelo, camaras, medidas, ruedas }
}

// --------------------------------------------------------------------------
// Conducción con la mecánica del Perseverance
// --------------------------------------------------------------------------
// Tres cosas definen cómo se mueve el rover de verdad y están modeladas aquí:
//
// 1. SEIS RUEDAS MOTRICES. Cada una tiene su propio motor y gira a su propia
//    velocidad: en una curva las de fuera recorren más que las de dentro.
//    La velocidad de giro sale de rodar sin resbalar, ω = v / radio.
//
// 2. CUATRO RUEDAS DIRECTRICES. Solo las de las esquinas giran; las dos
//    centrales van fijas. Los actuadores son lentos, así que el rover tiene
//    que colocar las ruedas ANTES de poder girar. Con las cuatro apuntando
//    tangentes a un círculo, gira sobre sí mismo sin avanzar.
//
// 3. SUSPENSIÓN ROCKER-BOGIE, sin muelles. Por cada lado hay un balancín
//    (rocker) con la rueda delantera en un extremo y un bogie en el otro, y
//    el bogie lleva las ruedas media y trasera. Un diferencial atravesado en
//    el chasis une los dos balancines: el cabeceo del cuerpo es el PROMEDIO
//    de los dos lados. Por eso el chasis se mantiene casi plano mientras las
//    ruedas suben y bajan por separado.

const UP = new THREE.Vector3(0, 1, 0)
const EJE_X = new THREE.Vector3(1, 0, 0)
const EJE_Z = new THREE.Vector3(0, 0, 1)

// El Perseverance real va a 0.042 m/s. A esa velocidad esto sería injugable,
// así que conducimos a velocidad "de película" y dejamos la real en la tecla V.
const VEL_MAX = 2.6
const VEL_MAX_TURBO = 6.5
const VEL_GIRO = 1.2 // rad/s girando en arco
const VEL_GIRO_SITIO = 0.8 // rad/s girando sobre sí mismo
const VEL_ACTUADOR = 1.6 // rad/s de los actuadores de dirección
const DIR_MAX = THREE.MathUtils.degToRad(80)
const FRENADO = 3.2 // m/s²: los reductores no son reversibles, frena en seco

// Tracción rueda-regolito. Con MU = 0.55 el empuje máximo es 0.55·g = 2.05 m/s²
// y la cuenta "empuje − g·sen(pendiente) > 0" se anula sobre los 33°: muy cerca
// del límite de 30° que la NASA le da al rover.
const MU = 0.55
const RESISTENCIA = 0.09 // rodadura en arena suelta, en fracciones de g
const RECORRIDO_SUSP = 0.085 // m de carrera visible de cada rueda

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

export function createRoverController(group, height, { onTrack, ruedas } = {}) {
  const inicio = puntoLlano(height)
  const teclas = new Set()

  const estado = {
    pos: new THREE.Vector3(inicio.x, 0, inicio.z),
    rumbo: Math.PI, // mirando hacia -Z, con el sol a la derecha
    velocidad: 0,
    distancia: 0,
    // Mecánica
    cabeceo: 0, // rad, positivo morro arriba
    balanceo: 0, // rad, positivo lado izquierdo arriba
    giroReal: 0, // rad/s de guiñada efectiva
    deslizamiento: 0, // fracción de patinaje de las ruedas
    rpm: 0, // vueltas por minuto, promedio de las seis
    modo: 'parado', // parado | recto | arco | sitio
    velocidadReal: false, // tecla V: 0.042 m/s, la de verdad
    ruedas: ruedas ? ruedas.ruedas : [],
  }

  const onKeyDown = (e) => {
    if (e.repeat) return
    teclas.add(e.code)
    if (e.code === 'KeyR') reset()
    if (e.code === 'KeyV') estado.velocidadReal = !estado.velocidadReal
  }
  const onKeyUp = (e) => teclas.delete(e.code)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  function reset() {
    estado.pos.set(inicio.x, 0, inicio.z)
    estado.rumbo = Math.PI
    estado.velocidad = 0
    estado.cabeceo = 0
    estado.balanceo = 0
    for (const r of estado.ruedas) {
      r.anguloDireccion = 0
      r.anguloGiro = 0
      r.rodado = 0
      r.recorrido = 0
      r.rpm = 0
    }
  }

  // --- Geometría de la suspensión ----------------------------------------
  // Si por lo que sea no se pudieron separar las ruedas, el controlador sigue
  // funcionando con el plano del terreno, como antes.
  const hayRuedas = !!ruedas && ruedas.ruedas.length === 6
  const radio = hayRuedas ? ruedas.radio : 0.2625
  const via = hayRuedas ? ruedas.via : 2.3
  const lados = hayRuedas
    ? {
        izq: [0, 1, 2].map((f) => ruedas.porLado.izq.find((r) => r.fila === f)),
        der: [0, 1, 2].map((f) => ruedas.porLado.der.find((r) => r.fila === f)),
      }
    : null

  const contactos = (hayRuedas ? ruedas.ruedas : []).map(() => ({ x: 0, y: 0, z: 0 }))
  const previstos = contactos.map(() => 0)

  // Pone en `contactos` la altura del terreno bajo cada rueda.
  function medirContactos() {
    const s = Math.sin(estado.rumbo)
    const c = Math.cos(estado.rumbo)
    for (let i = 0; i < contactos.length; i++) {
      const p = ruedas.ruedas[i].pos
      const wx = estado.pos.x + p.x * c + p.z * s
      const wz = estado.pos.z - p.x * s + p.z * c
      contactos[i].x = wx
      contactos[i].z = wz
      contactos[i].y = height(wx, wz)
    }
  }

  // Ángulos del balancín y del bogie de un lado, y altura del punto donde ese
  // balancín cuelga del chasis.
  function ladoRockerBogie(trio) {
    const [del, med, tras] = trio
    const hDel = contactos[ruedas.ruedas.indexOf(del)].y
    const hMed = contactos[ruedas.ruedas.indexOf(med)].y
    const hTras = contactos[ruedas.ruedas.indexOf(tras)].y

    // Bogie: barra corta entre la rueda media y la trasera.
    const zBogie = (med.pos.z + tras.pos.z) / 2
    const hBogie = (hMed + hTras) / 2
    const bogie = Math.atan2(hMed - hTras, med.pos.z - tras.pos.z)

    // Balancín: de la rueda delantera al pivote del bogie.
    const largo = del.pos.z - zBogie
    const rocker = Math.atan2(hDel - hBogie, largo)

    // El chasis cuelga del balancín a la altura de la rueda media.
    const t = largo !== 0 ? (med.pos.z - zBogie) / largo : 0.5
    return { rocker, bogie, apoyo: hBogie + t * (hDel - hBogie) }
  }

  const normal = new THREE.Vector3()
  function normalEn(x, z, e = 1.4) {
    normal
      .set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e))
      .normalize()
    return normal
  }

  const qYaw = new THREE.Quaternion()
  const qCabeceo = new THREE.Quaternion()
  const qBalanceo = new THREE.Quaternion()
  const qObjetivo = new THREE.Quaternion()
  const qSuelo = new THREE.Quaternion()
  const arriba = new THREE.Vector3()
  const puntoLocal = new THREE.Vector3()
  const ultimaHuella = new THREE.Vector3(0, 0, 0)
  let huellaIniciada = false

  function update(dt) {
    dt = Math.min(dt, 0.1)

    const adelante = teclas.has('KeyW') || teclas.has('ArrowUp')
    const atras = teclas.has('KeyS') || teclas.has('ArrowDown')
    const izq = teclas.has('KeyA') || teclas.has('ArrowLeft')
    const der = teclas.has('KeyD') || teclas.has('ArrowRight')
    const turbo = teclas.has('ShiftLeft') || teclas.has('ShiftRight')

    const velMax = estado.velocidadReal
      ? FICHA.velocidadNASA
      : turbo
        ? VEL_MAX_TURBO
        : VEL_MAX

    // --- Longitudinal: empuje, gravedad y rozamiento ---------------------
    // La pendiente es la del cuadro anterior; a 60 fps no se nota.
    const inclinacion = Math.hypot(estado.cabeceo, estado.balanceo)
    const cuesta = -FICHA.gravedad * Math.sin(estado.cabeceo) // <0 cuesta arriba
    const traccion = MU * FICHA.gravedad * Math.cos(inclinacion)
    const rozamiento = RESISTENCIA * FICHA.gravedad * Math.cos(inclinacion)

    if (adelante || atras) {
      const empuje = (adelante ? 1 : -0.6) * traccion
      estado.velocidad += (empuje + cuesta) * dt
      const signo = Math.sign(estado.velocidad)
      estado.velocidad -= signo * Math.min(Math.abs(estado.velocidad), rozamiento * dt)
    } else {
      // Motores parados: los reductores del Perseverance no son reversibles,
      // así que se queda clavado incluso en cuesta.
      const signo = Math.sign(estado.velocidad)
      estado.velocidad -= signo * Math.min(Math.abs(estado.velocidad), FRENADO * dt)
    }
    estado.velocidad = THREE.MathUtils.clamp(estado.velocidad, -velMax * 0.5, velMax)

    // Patinaje: en llano un 3%, hasta un 40% al borde del límite de 30°.
    const subiendo = Math.max(0, -Math.sin(estado.cabeceo))
    estado.deslizamiento =
      adelante || atras
        ? THREE.MathUtils.clamp(0.03 + 0.37 * (subiendo / Math.sin(Math.PI / 6)), 0, 0.4)
        : 0

    // --- Dirección: cuatro ruedas, actuadores lentos ---------------------
    const mando = (izq ? 1 : 0) - (der ? 1 : 0)
    const enMarcha = Math.abs(estado.velocidad) > 0.12
    let giroDeseado = 0
    if (mando) {
      giroDeseado = enMarcha
        ? mando * VEL_GIRO * Math.sign(estado.velocidad)
        : mando * VEL_GIRO_SITIO
    }
    if (estado.velocidadReal) giroDeseado *= 0.25

    estado.modo = mando
      ? enMarcha
        ? 'arco'
        : 'sitio'
      : Math.abs(estado.velocidad) > 0.05
        ? 'recto'
        : 'parado'

    // Ángulo ideal de cada rueda: el que la pone tangente al arco que describe
    // el rover. La velocidad de un punto (x, z) del chasis que avanza a v y
    // guiña a ψ es (ψ·z, v − ψ·x), así que basta apuntar la rueda ahí. Con
    // v = 0 sale el patrón en X del giro sobre sí mismo.
    let alineacion = 1
    if (hayRuedas) {
      let suma = 0
      let cuenta = 0
      for (const r of ruedas.ruedas) {
        let objetivo = 0
        if (r.dirige) {
          objetivo = Math.atan2(giroDeseado * r.pos.z, estado.velocidad - giroDeseado * r.pos.x)
          // Una rueda es simétrica: δ y δ±180° son la misma recta.
          if (objetivo > Math.PI / 2) objetivo -= Math.PI
          else if (objetivo < -Math.PI / 2) objetivo += Math.PI
          objetivo = THREE.MathUtils.clamp(objetivo, -DIR_MAX, DIR_MAX)
        }
        const paso = VEL_ACTUADOR * dt
        const diferencia = objetivo - r.anguloDireccion
        r.anguloDireccion += THREE.MathUtils.clamp(diferencia, -paso, paso)
        if (r.dirige) {
          suma += Math.max(0, Math.cos(objetivo - r.anguloDireccion))
          cuenta++
        }
      }
      // Hasta que las ruedas no estén colocadas, el rover no gira.
      if (cuenta) alineacion = suma / cuenta
    }

    estado.giroReal = giroDeseado * alineacion
    estado.rumbo += estado.giroReal * dt

    // --- Traslación ------------------------------------------------------
    if (Math.abs(estado.velocidad) > 1e-5) {
      const avance = estado.velocidad * dt
      estado.pos.x += Math.sin(estado.rumbo) * avance
      estado.pos.z += Math.cos(estado.rumbo) * avance
      estado.distancia += Math.abs(avance)
    }

    // --- Postura: rocker-bogie con diferencial ---------------------------
    if (hayRuedas) {
      medirContactos()

      const li = ladoRockerBogie(lados.izq)
      const ld = ladoRockerBogie(lados.der)

      // El diferencial promedia los dos balancines: ese es el cabeceo del
      // chasis, y por eso el cuerpo se mueve la mitad que las ruedas.
      const cabeceo = (li.rocker + ld.rocker) / 2
      const balanceo = Math.atan2(li.apoyo - ld.apoyo, via)

      // Suavizado corto: el campo de alturas tiene rizos de centímetros.
      const k = 1 - Math.exp(-dt * 9)
      estado.cabeceo += (cabeceo - estado.cabeceo) * k
      estado.balanceo += (balanceo - estado.balanceo) * k

      // Giro al rumbo y luego la postura. Rotar +X baja el morro, de ahí el
      // signo; rotar +Z levanta el lado izquierdo.
      qYaw.setFromAxisAngle(UP, estado.rumbo)
      qCabeceo.setFromAxisAngle(EJE_X, -estado.cabeceo)
      qBalanceo.setFromAxisAngle(EJE_Z, estado.balanceo)
      qObjetivo.copy(qYaw).multiply(qCabeceo).multiply(qBalanceo)
      group.quaternion.copy(qObjetivo)

      // Altura del chasis: la que deja el promedio de las seis ruedas en el
      // suelo. Con el modelo apoyado en y = 0, el contacto de cada rueda es su
      // propio (x, 0, z) girado por la postura.
      qSuelo.copy(qCabeceo).multiply(qBalanceo)
      let sumaPrevista = 0
      let sumaReal = 0
      for (let i = 0; i < contactos.length; i++) {
        const p = ruedas.ruedas[i].pos
        puntoLocal.set(p.x, 0, p.z).applyQuaternion(qSuelo)
        previstos[i] = puntoLocal.y
        sumaPrevista += puntoLocal.y
        sumaReal += contactos[i].y
      }
      const n = contactos.length
      estado.pos.y = sumaReal / n - sumaPrevista / n
      group.position.copy(estado.pos)

      // Carrera de cada rueda: lo que le falta para tocar su propio suelo.
      // Los brazos del GLB son una pieza rígida, así que la carrera visible se
      // queda en ±8,5 cm para que la rueda no se despegue del balancín.
      for (let i = 0; i < n; i++) {
        const r = ruedas.ruedas[i]
        const sobra = contactos[i].y - (estado.pos.y + previstos[i])
        r.recorrido = THREE.MathUtils.clamp(sobra, -RECORRIDO_SUSP, RECORRIDO_SUSP)
      }

      arriba.copy(UP).applyQuaternion(qSuelo)
    } else {
      // Respaldo: el plano del terreno, como en la primera versión.
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
      estado.pos.y = suma / 4 + 0.1
      group.position.copy(estado.pos)
      const nn = normalEn(estado.pos.x, estado.pos.z)
      qCabeceo.setFromUnitVectors(UP, nn)
      qYaw.setFromAxisAngle(UP, estado.rumbo)
      qObjetivo.copy(qCabeceo).multiply(qYaw)
      group.quaternion.slerp(qObjetivo, Math.min(1, dt * 8))
      arriba.copy(nn)
    }

    // --- Rodadura de cada rueda ------------------------------------------
    // Seis motores independientes: la velocidad de cada rueda sale de la
    // cinemática del sólido rígido, así que en una curva las de fuera giran
    // más deprisa que las de dentro. ω = v_rueda · (1 + patinaje) / radio.
    if (hayRuedas) {
      let sumaRpm = 0
      for (const r of ruedas.ruedas) {
        const vx = estado.giroReal * r.pos.z
        const vz = estado.velocidad - estado.giroReal * r.pos.x
        const rodadura =
          vx * Math.sin(r.anguloDireccion) + vz * Math.cos(r.anguloDireccion)
        const omega = (rodadura * (1 + estado.deslizamiento)) / r.radio
        // Sin envolver en 2*pi: asi el angulo acumulado sirve de cuentavueltas
        // y se puede comprobar el diferencial de la curva.
        r.anguloGiro += omega * dt
        r.rodado += Math.abs(omega) * r.radio * dt
        r.rpm = (omega * 60) / (Math.PI * 2)
        sumaRpm += Math.abs(r.rpm)

        // A los pivotes.
        r.direccion.rotation.y = r.anguloDireccion
        r.giro.rotation.x = r.anguloGiro
        r.base.position.y = r.origenLocal.y + r.recorrido * r.aLocal
      }
      estado.rpm = sumaRpm / ruedas.ruedas.length
    }

    // --- Huellas ---------------------------------------------------------
    // Una tanda cada 0.3 m, a la vía real de las ruedas.
    if (onTrack && Math.abs(estado.velocidad) > 0.05) {
      if (!huellaIniciada) {
        ultimaHuella.copy(estado.pos)
        huellaIniciada = true
      } else if (estado.pos.distanceTo(ultimaHuella) >= 0.3) {
        onTrack(estado.pos, estado.rumbo, arriba, via)
        ultimaHuella.copy(estado.pos)
      }
    }
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  return { estado, update, reset, dispose, ruedas }
}

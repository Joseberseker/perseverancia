// Tiempo que tarda la luz en ir de la Tierra a Marte.
//
// Se calcula de verdad: posiciones heliocéntricas de ambos planetas con los
// elementos orbitales keplerianos aproximados del JPL (válidos 1800-2050),
// distancia entre ambos, y distancia / velocidad de la luz.

const UA_KM = 149597870.7
const C_KM_S = 299792.458
const J2000 = 2451545.0

// Elementos orbitales del JPL: [valor en J2000, variación por siglo].
// a (UA), e, I (°), L (°), longitud del perihelio (°), longitud del nodo (°).
const ELEMENTOS = {
  tierra: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    nodo: [0.0, 0.0],
  },
  marte: {
    a: [1.52371034, 0.00001847],
    e: [0.09339410, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    nodo: [49.55953891, -0.29257343],
  },
}

const grados = (r) => (r * 180) / Math.PI
const radianes = (g) => (g * Math.PI) / 180

export function fechaAJuliana(date) {
  return date.getTime() / 86400000 + 2440587.5
}

// Posición heliocéntrica eclíptica, en UA.
function posicionHeliocentrica(cuerpo, siglos) {
  const el = ELEMENTOS[cuerpo]
  const a = el.a[0] + el.a[1] * siglos
  const e = el.e[0] + el.e[1] * siglos
  const I = radianes(el.I[0] + el.I[1] * siglos)
  const L = el.L[0] + el.L[1] * siglos
  const peri = el.peri[0] + el.peri[1] * siglos
  const nodo = radianes(el.nodo[0] + el.nodo[1] * siglos)

  // Argumento del perihelio y anomalía media, normalizada a [-180, 180].
  const omega = radianes(peri) - nodo
  let M = ((((L - peri) % 360) + 540) % 360) - 180
  M = radianes(M)

  // Ecuación de Kepler, por Newton-Raphson.
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }

  // Coordenadas en el plano de la órbita.
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)

  // Rotación al plano de la eclíptica.
  const cosO = Math.cos(omega)
  const sinO = Math.sin(omega)
  const cosN = Math.cos(nodo)
  const sinN = Math.sin(nodo)
  const cosI = Math.cos(I)
  const sinI = Math.sin(I)

  return {
    x: (cosO * cosN - sinO * sinN * cosI) * xp + (-sinO * cosN - cosO * sinN * cosI) * yp,
    y: (cosO * sinN + sinO * cosN * cosI) * xp + (-sinO * sinN + cosO * cosN * cosI) * yp,
    z: sinO * sinI * xp + cosO * sinI * yp,
  }
}

// Distancia Tierra-Marte en UA para una fecha dada.
export function distanciaTierraMarte(date = new Date()) {
  const siglos = (fechaAJuliana(date) - J2000) / 36525
  const t = posicionHeliocentrica('tierra', siglos)
  const m = posicionHeliocentrica('marte', siglos)
  return Math.hypot(m.x - t.x, m.y - t.y, m.z - t.z)
}

// Tiempo de luz en segundos.
export function tiempoDeLuz(date = new Date()) {
  return (distanciaTierraMarte(date) * UA_KM) / C_KM_S
}

export { UA_KM, grados }

// --------------------------------------------------------------------------
// Proveedor de telemetría
// --------------------------------------------------------------------------

import { solAFecha, solActual } from './nasaWaypoints.js'

export const PROVEEDOR_LUZ = 'Cálculo orbital en vivo (elementos JPL)'

export function crearProveedorLuz({ intervaloMs = 1000 } = {}) {
  const aplica = (objeto) => objeto?.key === 'luz'

  return {
    nombre: PROVEEDOR_LUZ,

    supportsMetadata: aplica,
    getMetadata() {
      return {
        proveedor: PROVEEDOR_LUZ,
        values: [
          { key: 'sol', nombre: 'Sol de misión', unidad: 'sol', hints: { domain: 1 } },
          {
            key: 'luz',
            nombre: 'Tiempo de luz a la Tierra',
            unidad: 's',
            significado:
              'Lo que tarda una orden en llegar desde la Tierra. Por eso Percy no se conduce en directo: para cuando ves una piedra, ya la pasó.',
            hints: { range: 1 },
          },
        ],
      }
    },

    // Histórico: el tiempo de luz a lo largo de toda la misión. La onda que
    // se ve es la Tierra y Marte acercándose y alejándose cada 26 meses.
    supportsRequest: aplica,
    async request() {
      const hasta = Math.ceil(solActual())
      const paso = Math.max(1, Math.round(hasta / 240))
      const puntos = []
      for (let sol = 0; sol <= hasta; sol += paso) {
        puntos.push({ sol, luz: tiempoDeLuz(solAFecha(sol)) })
      }
      return puntos
    },

    // En vivo: se recalcula cada segundo con la fecha real.
    supportsSubscribe: aplica,
    subscribe(objeto, callback) {
      const emitir = () => callback({ sol: solActual(), luz: tiempoDeLuz(new Date()) })
      emitir()
      const id = setInterval(emitir, intervaloMs)
      return () => clearInterval(id)
    },
  }
}

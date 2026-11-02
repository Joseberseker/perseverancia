// Proveedor de telemetría con el historial REAL de manejos del Perseverance.
//
// Fuente: NASA MMGIS, la misma capa que alimenta el mapa público "Where is
// Perseverance". Cada waypoint es una parada del rover desde el sol 13.
// El servidor envía Access-Control-Allow-Origin: *, así que el navegador
// puede leerlo directamente, sin proxy ni copia local.

export const RUTA_NASA = '/mmgis-maps/M20/Layers/json/M20_waypoints.json'

// Por el proxy del servidor de desarrollo (ver vite.config.js). Si no hay
// proxy —por ejemplo en un build estático— se reintenta contra la URL
// original, que funciona cuando CloudFront devuelve la variante correcta.
export const URL_WAYPOINTS = '/nasa/waypoints.json'
export const URL_WAYPOINTS_DIRECTA = 'https://mars.nasa.gov' + RUTA_NASA

export const PROVEEDOR = 'NASA MMGIS · M20_waypoints'

// Perseverance amartizó el 18 de febrero de 2021 a las 20:55 UTC.
export const AMARTIZAJE_MS = Date.UTC(2021, 1, 18, 20, 55, 0)
// Un sol marciano dura 24 h 39 min 35.244 s.
export const SOL_MS = 88775244

export const solAFecha = (sol) => new Date(AMARTIZAJE_MS + sol * SOL_MS)
export const solActual = () => (Date.now() - AMARTIZAJE_MS) / SOL_MS

// Los tres datos que sacamos del historial.
const CAMPOS = {
  distancia: {
    prop: 'dist_total_m',
    nombre: 'Distancia recorrida',
    unidad: 'm',
    formato: 'distancia',
    // La odometría nunca retrocede, pero 129 de los 708 waypoints traen
    // dist_total_m = 0: son marcas de "site increment, no motion", no
    // lecturas reales. Se arrastra el máximo para que la curva sea la de
    // verdad y no un sierra.
    acumulado: true,
    significado:
      'Lo que Percy lleva rodado sobre Marte desde que bajó. Cada escalón de la gráfica es un día que decidió moverse.',
  },
  altura: {
    prop: 'elev_geoid',
    nombre: 'Altura del terreno',
    unidad: 'm',
    formato: 'metros',
    significado:
      'Su altura respecto al nivel de referencia de Marte. Siempre negativa: Jezero es un cráter. La subida del final es Percy trepando el borde.',
  },
  inclinacion: {
    prop: 'tilt',
    nombre: 'Inclinación',
    unidad: '°',
    significado:
      'Cuánto se ladeó el rover en cada parada. Los picos son laderas de verdad; por encima de 30° el rover correría peligro de volcar.',
  },
}

export const CLAVES_NASA = Object.keys(CAMPOS)

let promesaDatos = null

// Se descarga UNA vez y los tres datos comparten el resultado.
async function cargarWaypoints(fetchImpl = fetch) {
  let geojson
  try {
    const respuesta = await fetchImpl(URL_WAYPOINTS)
    if (!respuesta.ok) throw new Error(`NASA MMGIS respondió ${respuesta.status}`)
    geojson = await respuesta.json()
  } catch (errorProxy) {
    const respuesta = await fetchImpl(URL_WAYPOINTS_DIRECTA)
    if (!respuesta.ok) throw new Error(`NASA MMGIS respondió ${respuesta.status}`)
    geojson = await respuesta.json()
  }
  const puntos = geojson.features
    .map((f) => f.properties)
    .filter((p) => p && Number.isFinite(p.sol))
    .sort((a, b) => a.sol - b.sol)

  if (puntos.length === 0) throw new Error('El GeoJSON de la NASA no traía waypoints')
  return puntos
}

export function crearProveedorNASA({ fetchImpl } = {}) {
  const aplica = (objeto) => CLAVES_NASA.includes(objeto?.key)

  return {
    nombre: PROVEEDOR,

    supportsMetadata: aplica,
    getMetadata(objeto) {
      const campo = CAMPOS[objeto.key]
      return {
        proveedor: PROVEEDOR,
        values: [
          {
            key: 'sol',
            nombre: 'Sol de misión',
            unidad: 'sol',
            hints: { domain: 1 },
          },
          {
            key: objeto.key,
            nombre: campo.nombre,
            unidad: campo.unidad,
            formato: campo.formato,
            significado: campo.significado,
            hints: { range: 1 },
          },
        ],
      }
    },

    supportsRequest: aplica,
    async request(objeto) {
      promesaDatos = promesaDatos ?? cargarWaypoints(fetchImpl ?? fetch)
      const puntos = await promesaDatos
      const campo = CAMPOS[objeto.key]
      let maximo = -Infinity
      return puntos
        .filter((p) => Number.isFinite(p[campo.prop]))
        .map((p) => {
          let valor = p[campo.prop]
          if (campo.acumulado) {
            maximo = Math.max(maximo, valor)
            valor = maximo
          }
          return { sol: p.sol, [objeto.key]: valor }
        })
    },
  }
}

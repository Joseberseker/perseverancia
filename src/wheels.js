import * as THREE from 'three'

// --------------------------------------------------------------------------
// Las seis ruedas, separadas del modelo de la NASA
// --------------------------------------------------------------------------
// El GLB oficial trae las seis ruedas FUNDIDAS en un único nodo
// ("Wheels_objs": 34.788 vértices repartidos en 3 primitivas) y sin huesos.
// No existía ningún objeto que se pudiera rotar: por eso las ruedas no giraban.
//
// Aquí partimos esa malla en seis agrupando los triángulos por su posición
// (k-medias con k=6 en el plano x/z) y le montamos a cada rueda su propia
// jerarquía de pivotes:
//
//   base       → sube y baja: recorrido de la suspensión
//    └ direccion → gira sobre el eje vertical: solo las 4 de las esquinas
//       └ giro     → rueda sobre el palier: las 6, cada una a su velocidad
//          └ mallas de esa rueda, con el origen puesto en el palier
//
// Convenio del modelo (verificado contra el GLB: hazcams_front está en z=+0.97
// y el RTG en z=-1.25): el morro mira a +Z y el eje vertical es +Y. Con esa
// terna, la izquierda del rover es +X y el palier va en el eje X.

const NODO_RUEDAS = 'Wheels_objs'
const NOMBRE_FILA = ['delantera', 'media', 'trasera']

// --------------------------------------------------------------------------
// Utilidades de geometría
// --------------------------------------------------------------------------

// Centroide de cada triángulo, ya llevado al espacio del nodo de las ruedas.
function centroidesDeTriangulos(geometria, rel) {
  const pos = geometria.attributes.position
  const index = geometria.index
  const nTri = (index ? index.count : pos.count) / 3
  const salida = new Float32Array(nTri * 3)
  const v = new THREE.Vector3()
  for (let t = 0; t < nTri; t++) {
    let x = 0
    let y = 0
    let z = 0
    for (let k = 0; k < 3; k++) {
      const i = index ? index.getX(t * 3 + k) : t * 3 + k
      v.fromBufferAttribute(pos, i).applyMatrix4(rel)
      x += v.x
      y += v.y
      z += v.z
    }
    salida[t * 3] = x / 3
    salida[t * 3 + 1] = y / 3
    salida[t * 3 + 2] = z / 3
  }
  return salida
}

function masCercano(centros, x, z) {
  let mejor = 0
  let d2 = Infinity
  for (let k = 0; k < centros.length; k++) {
    const dx = centros[k].x - x
    const dz = centros[k].z - z
    const d = dx * dx + dz * dz
    if (d < d2) {
      d2 = d
      mejor = k
    }
  }
  return mejor
}

// k-medias en el plano x/z. Las ruedas son seis islas bien separadas, así que
// con semillas en los seis sitios esperados converge en pocas vueltas. Usamos
// k-medias y no componentes conexas porque así cualquier trozo suelto (tornillo,
// tapa) cae en la rueda más cercana en vez de romper el agrupamiento.
function agruparEnSeis(piezas) {
  let xMin = Infinity
  let xMax = -Infinity
  let zMin = Infinity
  let zMax = -Infinity
  for (const p of piezas) {
    for (let i = 0; i < p.centroides.length; i += 3) {
      const x = p.centroides[i]
      const z = p.centroides[i + 2]
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (z < zMin) zMin = z
      if (z > zMax) zMax = z
    }
  }

  const xMedio = (xMin + xMax) / 2
  const extZ = zMax - zMin
  const centros = []
  for (const x of [(xMin + xMedio) / 2, (xMedio + xMax) / 2]) {
    for (const f of [1 / 6, 1 / 2, 5 / 6]) centros.push({ x, z: zMin + extZ * f })
  }

  for (let vuelta = 0; vuelta < 16; vuelta++) {
    const acum = centros.map(() => ({ x: 0, z: 0, n: 0 }))
    for (const p of piezas) {
      for (let i = 0; i < p.centroides.length; i += 3) {
        const k = masCercano(centros, p.centroides[i], p.centroides[i + 2])
        acum[k].x += p.centroides[i]
        acum[k].z += p.centroides[i + 2]
        acum[k].n++
      }
    }
    let movimiento = 0
    for (let k = 0; k < centros.length; k++) {
      if (!acum[k].n) continue
      const nx = acum[k].x / acum[k].n
      const nz = acum[k].z / acum[k].n
      movimiento += Math.abs(nx - centros[k].x) + Math.abs(nz - centros[k].z)
      centros[k].x = nx
      centros[k].z = nz
    }
    if (movimiento < 1e-4) break
  }

  return centros
}

// Copia a una geometría nueva solo los triángulos de esta rueda, con los
// vértices remapeados (se mantiene indexada, sin duplicar) y el origen
// trasladado al palier.
function subgeometria(geometria, rel, triangulos, origen) {
  const pos = geometria.attributes.position
  const index = geometria.index
  const mapa = new Map()
  const indices = []

  for (const t of triangulos) {
    for (let k = 0; k < 3; k++) {
      const viejo = index ? index.getX(t * 3 + k) : t * 3 + k
      let nuevo = mapa.get(viejo)
      if (nuevo === undefined) {
        nuevo = mapa.size
        mapa.set(viejo, nuevo)
      }
      indices.push(nuevo)
    }
  }

  const n = mapa.size
  const salida = new THREE.BufferGeometry()
  const matrizNormales = new THREE.Matrix3().getNormalMatrix(rel)
  const v = new THREE.Vector3()

  for (const nombre of Object.keys(geometria.attributes)) {
    const a = geometria.attributes[nombre]
    const datos = new Float32Array(n * a.itemSize)
    for (const [viejo, nuevo] of mapa) {
      if (nombre === 'position') {
        v.fromBufferAttribute(a, viejo).applyMatrix4(rel).sub(origen)
        datos[nuevo * 3] = v.x
        datos[nuevo * 3 + 1] = v.y
        datos[nuevo * 3 + 2] = v.z
      } else if (nombre === 'normal') {
        v.fromBufferAttribute(a, viejo).applyMatrix3(matrizNormales).normalize()
        datos[nuevo * 3] = v.x
        datos[nuevo * 3 + 1] = v.y
        datos[nuevo * 3 + 2] = v.z
      } else {
        for (let k = 0; k < a.itemSize; k++) {
          datos[nuevo * a.itemSize + k] = a.getComponent(viejo, k)
        }
      }
    }
    salida.setAttribute(nombre, new THREE.BufferAttribute(datos, a.itemSize))
  }

  salida.setIndex(
    n > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1),
  )
  salida.computeBoundingSphere()
  return salida
}

// --------------------------------------------------------------------------
// Montaje
// --------------------------------------------------------------------------

export function montarRuedas(modelo, { nombreNodo = NODO_RUEDAS } = {}) {
  const nodo = modelo.getObjectByName(nombreNodo)
  if (!nodo) {
    console.warn(`[ruedas] no encontré el nodo "${nombreNodo}" en el modelo`)
    return null
  }

  modelo.updateMatrixWorld(true)

  const mallas = []
  nodo.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position) mallas.push(o)
  })
  if (!mallas.length) return null

  // Todo se mide en el espacio local del nodo de las ruedas.
  const inversa = new THREE.Matrix4().copy(nodo.matrixWorld).invert()
  const piezas = mallas.map((malla) => {
    const rel = new THREE.Matrix4().multiplyMatrices(inversa, malla.matrixWorld)
    return { malla, rel, centroides: centroidesDeTriangulos(malla.geometry, rel) }
  })

  const centros = agruparEnSeis(piezas)

  // Reparto definitivo: a qué rueda va cada triángulo, y caja de cada rueda.
  const cajas = centros.map(() => new THREE.Box3())
  const v = new THREE.Vector3()
  for (const p of piezas) {
    p.triangulos = centros.map(() => [])
    const pos = p.malla.geometry.attributes.position
    const index = p.malla.geometry.index
    const nTri = p.centroides.length / 3
    for (let t = 0; t < nTri; t++) {
      const k = masCercano(centros, p.centroides[t * 3], p.centroides[t * 3 + 2])
      p.triangulos[k].push(t)
      for (let j = 0; j < 3; j++) {
        const i = index ? index.getX(t * 3 + j) : t * 3 + j
        cajas[k].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(p.rel))
      }
    }
  }

  // Origen de cada rueda = centro de su caja (el palier). El radio sale del
  // corte circular, que vive en el plano y/z porque el palier va en x.
  const tam = new THREE.Vector3()
  const info = centros.map((c, k) => {
    const origen = cajas[k].getCenter(new THREE.Vector3())
    cajas[k].getSize(tam)
    return { origen, radio: (tam.y + tam.z) / 4, ancho: tam.x }
  })

  // Nombres: +X es la izquierda del rover, +Z el morro.
  const ordenZ = [...info.keys()].sort((a, b) => info[b].origen.z - info[a].origen.z)
  const fila = new Array(info.length)
  ordenZ.forEach((k, i) => {
    fila[k] = Math.floor(i / 2) // de dos en dos: delanteras, medias, traseras
  })

  const padre = nodo.isMesh ? nodo.parent : nodo
  const ruedas = []

  for (let k = 0; k < info.length; k++) {
    const { origen, radio, ancho } = info[k]
    const lado = origen.x > 0 ? 'izq' : 'der'
    const f = fila[k]
    const nombre = `rueda_${lado}_${NOMBRE_FILA[f]}`

    const base = new THREE.Group()
    base.name = `${nombre}_base`
    base.position.copy(origen)

    const direccion = new THREE.Group()
    direccion.name = `${nombre}_direccion`

    const giro = new THREE.Group()
    giro.name = `${nombre}_giro`

    base.add(direccion)
    direccion.add(giro)
    padre.add(base)

    for (const p of piezas) {
      const tris = p.triangulos[k]
      if (!tris.length) continue
      const malla = new THREE.Mesh(
        subgeometria(p.malla.geometry, p.rel, tris, origen),
        p.malla.material,
      )
      malla.name = `${nombre}_${p.malla.name || 'malla'}`
      malla.castShadow = true
      malla.receiveShadow = true
      giro.add(malla)
    }

    ruedas.push({
      nombre,
      lado,
      fila: f,
      // Solo las cuatro de las esquinas tienen actuador de dirección; las dos
      // centrales del Perseverance no giran, van fijas.
      dirige: f !== 1,
      base,
      direccion,
      giro,
      origenLocal: origen.clone(),
      radioLocal: radio,
      anchoLocal: ancho,
      // Estado que escribe el controlador.
      anguloDireccion: 0,
      anguloGiro: 0,
      rodado: 0,
      rpm: 0,
      recorrido: 0,
    })
  }

  // Fuera la malla original: ya está repartida en las seis.
  for (const p of piezas) {
    p.malla.parent?.remove(p.malla)
    p.malla.geometry.dispose()
  }

  ruedas.sort((a, b) => a.fila - b.fila || (a.lado === 'izq' ? -1 : 1))
  return { ruedas, nodo }
}

// --------------------------------------------------------------------------
// Medidas en metros de escena
// --------------------------------------------------------------------------
// El montaje vive dentro del modelo, que está escalado. Esto traduce las
// medidas locales a los metros de la escena y da al controlador la posición
// de cada rueda en el sistema del rover.
export function medirRuedas(group, montaje) {
  if (!montaje) return null
  group.updateMatrixWorld(true)

  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const escala = new THREE.Vector3()

  for (const rueda of montaje.ruedas) {
    rueda.base.matrixWorld.decompose(p, q, escala)
    group.worldToLocal(p)
    rueda.pos = p.clone() // en el sistema del rover, en metros
    rueda.escala = escala.x
    rueda.radio = rueda.radioLocal * escala.x
    rueda.ancho = rueda.anchoLocal * escala.x
    // Para convertir metros de escena a unidades locales del modelo.
    rueda.aLocal = 1 / escala.x
  }

  const izq = montaje.ruedas.filter((r) => r.lado === 'izq')
  const der = montaje.ruedas.filter((r) => r.lado === 'der')
  const media = (lista, campo) => lista.reduce((a, r) => a + campo(r), 0) / lista.length

  const delanteras = montaje.ruedas.filter((r) => r.fila === 0)
  const traseras = montaje.ruedas.filter((r) => r.fila === 2)

  return {
    ruedas: montaje.ruedas,
    radio: media(montaje.ruedas, (r) => r.radio),
    ancho: media(montaje.ruedas, (r) => r.ancho),
    via: Math.abs(media(izq, (r) => r.pos.x) - media(der, (r) => r.pos.x)),
    batalla: Math.abs(media(delanteras, (r) => r.pos.z) - media(traseras, (r) => r.pos.z)),
    porLado: { izq, der },
  }
}

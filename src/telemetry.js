// Una TelemetryAPI mínima, con el mismo patrón que NASA Open MCT.
//
// La idea que copiamos: la API no sabe nada de los datos. Tú registras un
// PROVEEDOR —un objeto suelto, sin clase ni interfaz— y la API lo clasifica
// según los métodos que tenga:
//
//   supportsMetadata / getMetadata   -> qué campos hay, su nombre y su unidad
//   supportsRequest  / request       -> el histórico, de un tirón
//   supportsSubscribe / subscribe    -> el valor en vivo, gota a gota
//
// Y no adivina qué campo es el tiempo: cada campo lo declara con una PISTA
// (`hints`), `domain` para el eje del tiempo y `range` para los valores.
// Equivale a TelemetryAPI.js:167 y TelemetryMetadataManager.js:100 en Open MCT.

function crearGestorDeMetadatos(metadata, proveedorPorDefecto) {
  // Si un campo no declara prioridad, usa su posición en el array.
  const values = metadata.values.map((v, i) => ({
    ...v,
    hints: { priority: i, ...v.hints },
  }))

  return {
    values,
    proveedor: metadata.proveedor ?? proveedorPorDefecto,

    // Devuelve los campos que tienen TODAS las pistas pedidas, ordenados
    // por el valor de esa pista: domain:1 gana a domain:2.
    valuesForHints(hints) {
      return values
        .filter((v) => hints.every((h) => v.hints[h] !== undefined))
        .sort((a, b) => {
          for (const h of hints) {
            const d = a.hints[h] - b.hints[h]
            if (d !== 0) return d
          }
          return 0
        })
    },

    campoTiempo() {
      return this.valuesForHints(['domain'])[0]
    },
    campoValor() {
      return this.valuesForHints(['range'])[0]
    },
  }
}

export function crearTelemetryAPI() {
  const proveedoresMetadatos = []
  const proveedoresHistorico = []
  const proveedoresEnVivo = []

  function addProvider(provider) {
    // unshift: el último registrado gana, igual que en Open MCT.
    if (provider.supportsMetadata) proveedoresMetadatos.unshift(provider)
    if (provider.supportsRequest) proveedoresHistorico.unshift(provider)
    if (provider.supportsSubscribe) proveedoresEnVivo.unshift(provider)
    return provider
  }

  function getMetadata(objeto) {
    const p = proveedoresMetadatos.find((x) => x.supportsMetadata(objeto))
    if (!p) return null
    return crearGestorDeMetadatos(p.getMetadata(objeto), p.nombre)
  }

  async function request(objeto, opciones = {}) {
    const p = proveedoresHistorico.find((x) => x.supportsRequest(objeto, opciones))
    if (!p) return []
    return p.request(objeto, opciones)
  }

  function subscribe(objeto, callback, opciones = {}) {
    const p = proveedoresEnVivo.find((x) => x.supportsSubscribe(objeto, opciones))
    if (!p) return () => {}
    return p.subscribe(objeto, callback, opciones) ?? (() => {})
  }

  return { addProvider, getMetadata, request, subscribe }
}

// Los "domain objects": cada dato de Percy es uno.
export function objetoDeTelemetria(key, type = 'percy.telemetria') {
  return { identifier: { namespace: 'percy', key }, key, type }
}

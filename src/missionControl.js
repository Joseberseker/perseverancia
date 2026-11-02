// Control de misión: el panel que muestra la telemetría real de Percy.
//
// No sabe de dónde salen los datos. Le pasas la TelemetryAPI y una lista de
// objetos, y para cada uno: pide los metadatos (nombre, unidad, proveedor,
// qué campo es el tiempo y cuál el valor), pide el histórico para la gráfica
// y se suscribe si el proveedor ofrece valor en vivo.

const FORMATOS = {
  // Elige el formateador el campo `formato` de los metadatos; si no lo hay,
  // la unidad declarada.
  distancia: (v) =>
    Math.abs(v) >= 1000
      ? `${(v / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km`
      : `${v.toLocaleString('es', { maximumFractionDigits: 1 })} m`,
  metros: (v) => `${v.toLocaleString('es', { maximumFractionDigits: 0 })} m`,
  m: (v) => `${v.toLocaleString('es', { maximumFractionDigits: 1 })} m`,
  '°': (v) => `${v.toLocaleString('es', { maximumFractionDigits: 1 })}°`,
  s: (v) => `${Math.floor(v / 60)} min ${String(Math.round(v % 60)).padStart(2, '0')} s`,
  sol: (v) => `sol ${Math.round(v)}`,
}

const formatear = (valor, campo) =>
  Number.isFinite(valor)
    ? (FORMATOS[campo.formato] ?? FORMATOS[campo.unidad] ?? ((v) => `${v} ${campo.unidad}`))(valor)
    : '—'

// --- Gráfica de toda la misión -------------------------------------------
function dibujarGrafica(canvas, puntos, claveX, claveY) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || 280
  const h = canvas.clientHeight || 46
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  if (puntos.length < 2) return

  const xs = puntos.map((p) => p[claveX])
  const ys = puntos.map((p) => p[claveY])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const spanX = x1 - x0 || 1
  const spanY = y1 - y0 || 1
  const pad = 3

  const px = (v) => ((v - x0) / spanX) * (w - 2 * pad) + pad
  const py = (v) => h - pad - ((v - y0) / spanY) * (h - 2 * pad)

  // Relleno bajo la curva.
  ctx.beginPath()
  ctx.moveTo(px(xs[0]), h)
  for (let i = 0; i < puntos.length; i++) ctx.lineTo(px(xs[i]), py(ys[i]))
  ctx.lineTo(px(xs[xs.length - 1]), h)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(232, 150, 92, 0.34)')
  grad.addColorStop(1, 'rgba(232, 150, 92, 0.02)')
  ctx.fillStyle = grad
  ctx.fill()

  // La línea.
  ctx.beginPath()
  for (let i = 0; i < puntos.length; i++) {
    const X = px(xs[i])
    const Y = py(ys[i])
    if (i === 0) ctx.moveTo(X, Y)
    else ctx.lineTo(X, Y)
  }
  ctx.strokeStyle = '#f0a868'
  ctx.lineWidth = 1.4
  ctx.lineJoin = 'round'
  ctx.stroke()

  // El punto de ahora.
  const ux = px(xs[xs.length - 1])
  const uy = py(ys[ys.length - 1])
  ctx.beginPath()
  ctx.arc(ux, uy, 2.6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffe6cf'
  ctx.fill()
}

// --- Panel ----------------------------------------------------------------
export function createMissionControl({ telemetry, objetos, solActual }) {
  const raiz = document.createElement('section')
  raiz.id = 'control-mision'
  raiz.innerHTML = `
    <header>
      <h2>Control de misión</h2>
      <p class="sub"><span id="cm-sol">—</span> · <span class="vivo">● en vivo</span></p>
    </header>
    <div class="cm-lista"></div>
    <footer><kbd>T</kbd> ocultar</footer>
  `
  const lista = raiz.querySelector('.cm-lista')

  const estado = { datos: [], listos: 0, visible: true }
  const desuscribir = []

  for (const objeto of objetos) {
    const metadatos = telemetry.getMetadata(objeto)
    if (!metadatos) continue

    const campoTiempo = metadatos.campoTiempo()
    const campoValor = metadatos.campoValor()

    const tarjeta = document.createElement('article')
    tarjeta.className = 'cm-dato'
    tarjeta.dataset.dato = objeto.key
    tarjeta.innerHTML = `
      <div class="cm-cab">
        <span class="cm-nombre">${campoValor.nombre}</span>
        <span class="cm-unidad">${campoValor.unidad}</span>
      </div>
      <div class="cm-valor">cargando…</div>
      <canvas class="cm-grafica" aria-hidden="true"></canvas>
      <p class="cm-significado">${campoValor.significado ?? ''}</p>
      <p class="cm-proveedor">${metadatos.proveedor}</p>
    `
    lista.appendChild(tarjeta)

    const elValor = tarjeta.querySelector('.cm-valor')
    const elGrafica = tarjeta.querySelector('.cm-grafica')

    const registro = {
      key: objeto.key,
      nombre: campoValor.nombre,
      unidad: campoValor.unidad,
      proveedor: metadatos.proveedor,
      significado: campoValor.significado ?? '',
      valor: null,
      puntos: 0,
      enVivo: false,
      estado: 'cargando',
      error: null,
    }
    estado.datos.push(registro)

    const pintarValor = (v) => {
      registro.valor = v
      elValor.textContent = formatear(v, campoValor)
    }

    // 1) El histórico -> la gráfica de toda la misión.
    telemetry
      .request(objeto)
      .then((puntos) => {
        if (!puntos || puntos.length === 0) throw new Error('sin datos')
        registro.puntos = puntos.length
        registro.estado = 'listo'
        estado.listos++
        pintarValor(puntos[puntos.length - 1][campoValor.key])
        dibujarGrafica(elGrafica, puntos, campoTiempo.key, campoValor.key)
        tarjeta.classList.add('listo')
        // Redibuja si cambia el tamaño del panel.
        registro.redibujar = () => dibujarGrafica(elGrafica, puntos, campoTiempo.key, campoValor.key)
      })
      .catch((err) => {
        registro.estado = 'error'
        registro.error = err.message
        elValor.textContent = 'sin datos'
        tarjeta.classList.add('error')
        console.error(`[control de misión] ${objeto.key}:`, err)
      })

    // 2) El valor en vivo, si el proveedor lo ofrece.
    const parar = telemetry.subscribe(objeto, (dato) => {
      registro.enVivo = true
      pintarValor(dato[campoValor.key])
    })
    desuscribir.push(parar)
  }

  const elSol = raiz.querySelector('#cm-sol')
  const refrescarSol = () => {
    elSol.textContent = `Sol ${Math.floor(solActual())}`
  }
  refrescarSol()
  const idSol = setInterval(refrescarSol, 60000)

  function toggle(mostrar = !estado.visible) {
    estado.visible = mostrar
    raiz.classList.toggle('oculto', !mostrar)
    if (mostrar) for (const d of estado.datos) d.redibujar?.()
  }

  function dispose() {
    clearInterval(idSol)
    for (const p of desuscribir) p?.()
    raiz.remove()
  }

  return { el: raiz, estado, toggle, dispose }
}

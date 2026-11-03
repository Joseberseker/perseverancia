import { CREDITO } from './fotos.js'

// --------------------------------------------------------------------------
// El visor de fotos
// --------------------------------------------------------------------------
// Al pulsar un punto de cámara: obturador, flash y la foto que se revela poco
// a poco, como un papel en el cuarto oscuro. Se queda unos segundos, grande.
// Clic para ampliarla, Esc para volver al juego, flechas para pasar fotos.

const SEGUNDOS_EN_PANTALLA = 9
const MS_REVELADO = 1900

// Sol 0 del Perseverance = el amartizaje.
function haceCuanto(utc) {
  const dias = Math.round((Date.now() - Date.parse(utc)) / 86400000)
  if (!Number.isFinite(dias)) return ''
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

function el(tag, clase, padre) {
  const n = document.createElement(tag)
  if (clase) n.className = clase
  if (padre) padre.appendChild(n)
  return n
}

export function crearVisor({ onAbrir, onCerrar } = {}) {
  // --- Obturador: dos cortinillas y un fogonazo -------------------------
  const obturador = el('div', 'obturador')
  obturador.id = 'obturador'
  el('div', 'obturador-hoja arriba', obturador)
  el('div', 'obturador-hoja abajo', obturador)
  const fogonazo = el('div', 'obturador-flash', obturador)
  document.body.appendChild(obturador)

  // --- Tarjeta de la foto ------------------------------------------------
  const visor = el('div', 'visor')
  visor.id = 'visor'
  const fondo = el('div', 'visor-fondo', visor)
  const marco = el('figure', 'visor-marco', visor)
  const lienzo = el('div', 'visor-lienzo', marco)
  const img = el('img', 'visor-img', lienzo)
  img.alt = ''
  img.decoding = 'async'
  const grano = el('div', 'visor-grano', lienzo)
  const pie = el('figcaption', 'visor-pie', marco)
  const titulo = el('div', 'visor-camara', pie)
  const texto = el('div', 'visor-texto', pie)
  const meta = el('div', 'visor-meta', pie)
  const barra = el('div', 'visor-barra', marco)
  const barraInterior = el('i', null, barra)
  const nav = el('div', 'visor-nav', marco)
  const flechas = el('span', 'visor-flechas', nav)
  flechas.innerHTML = '<kbd>←</kbd><kbd>→</kbd>'
  const contador = el('span', 'visor-contador', nav)
  const pista = el('div', 'visor-pista', marco)
  const pintarPista = () => {
    pista.innerHTML =
      (estado.ampliada ? 'clic para reducir' : 'clic para ampliar') +
      ' \u00b7 <kbd>Esc</kbd> para volver'
  }
  document.body.appendChild(visor)

  const estado = {
    abierto: false,
    ampliada: false,
    camara: null,
    indice: 0,
    cargando: false,
    error: null,
    foto: null,
  }

  let temporizador = null
  let revelando = null

  function pararReloj() {
    if (temporizador) clearTimeout(temporizador)
    temporizador = null
    barra.classList.remove('corriendo')
  }

  function arrancarReloj() {
    pararReloj()
    if (estado.ampliada) return
    // Reiniciar la animación de la barra.
    barraInterior.style.animation = 'none'
    void barraInterior.offsetWidth
    barraInterior.style.animation = ''
    barra.classList.add('corriendo')
    temporizador = setTimeout(cerrar, SEGUNDOS_EN_PANTALLA * 1000)
  }

  function pintar() {
    const c = estado.camara
    const f = estado.foto
    if (!c || !f) return
    pintarPista()
    titulo.textContent = c.nombre
    texto.textContent = f.pie
    meta.textContent = `Sol ${f.sol} · ${haceCuanto(f.utc)} · ${CREDITO}`
    contador.textContent = `${estado.indice + 1} / ${c.fotos.length}`
    nav.style.visibility = c.fotos.length > 1 ? '' : 'hidden'
  }

  // Carga la imagen y la revela. Devuelve una promesa para que npm run check
  // pueda esperarla.
  function revelar(foto) {
    estado.cargando = true
    estado.error = null
    lienzo.classList.remove('revelada')
    lienzo.classList.add('revelando')
    img.removeAttribute('src')

    revelando = new Promise((resolve) => {
      const previa = new Image()
      previa.decoding = 'async'
      previa.onload = () => {
        img.src = foto.url
        img.width = previa.naturalWidth
        img.height = previa.naturalHeight
        estado.cargando = false
        // Un cuadro para que el navegador la pinte antes de soltar el velo.
        requestAnimationFrame(() => {
          lienzo.classList.remove('revelando')
          lienzo.classList.add('revelada')
          // El reloj arranca ahora: los segundos en pantalla se cuentan desde
          // que la foto se ve, no desde que se pidió a la NASA.
          arrancarReloj()
          setTimeout(resolve, MS_REVELADO)
        })
      }
      previa.onerror = () => {
        estado.cargando = false
        estado.error = 'No pude traer la foto de la NASA'
        texto.textContent = estado.error
        lienzo.classList.remove('revelando')
        arrancarReloj()
        resolve()
      }
      previa.src = foto.url
    })
    return revelando
  }

  function mostrar(indice, { conObturador = false } = {}) {
    const c = estado.camara
    if (!c) return Promise.resolve()
    estado.indice = (indice + c.fotos.length) % c.fotos.length
    estado.foto = c.fotos[estado.indice]
    pintar()
    pararReloj()
    const p = revelar(estado.foto)
    if (conObturador) disparo()
    return p
  }

  // Cortinillas + fogonazo. Es puro CSS: aquí solo se reinicia la animación.
  function disparo() {
    obturador.classList.remove('disparando')
    void obturador.offsetWidth
    obturador.classList.add('disparando')
    fogonazo.style.animation = 'none'
    void fogonazo.offsetWidth
    fogonazo.style.animation = ''
  }

  function abrir(camara) {
    estado.camara = camara
    estado.abierto = true
    estado.ampliada = false
    visor.classList.remove('ampliada')
    visor.classList.add('abierto')
    onAbrir?.(camara)
    return mostrar(0, { conObturador: true })
  }

  function cerrar() {
    if (!estado.abierto) return
    pararReloj()
    estado.abierto = false
    estado.ampliada = false
    visor.classList.remove('abierto', 'ampliada')
    onCerrar?.()
  }

  function ampliar(v = !estado.ampliada) {
    if (!estado.abierto) return
    estado.ampliada = v
    visor.classList.toggle('ampliada', v)
    pintarPista()
    if (v) pararReloj()
    else arrancarReloj()
  }

  const pasar = (d) => (estado.abierto ? mostrar(estado.indice + d) : Promise.resolve())

  // --- Entrada -----------------------------------------------------------
  marco.addEventListener('click', (e) => {
    e.stopPropagation()
    ampliar()
  })
  fondo.addEventListener('click', cerrar)

  function onKey(e) {
    if (!estado.abierto) return
    if (e.code === 'Escape') { e.preventDefault(); cerrar() }
    else if (e.code === 'ArrowRight') { e.preventDefault(); pasar(1) }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); pasar(-1) }
    else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); ampliar() }
  }
  // En captura: así llega antes que el controlador del rover.
  window.addEventListener('keydown', onKey, true)

  function dispose() {
    window.removeEventListener('keydown', onKey, true)
    pararReloj()
    visor.remove()
    obturador.remove()
  }

  return {
    estado,
    abrir,
    cerrar,
    ampliar,
    pasar,
    dispose,
    // Para npm run check: esperar a que la foto esté revelada.
    listo: () => revelando ?? Promise.resolve(),
    get imagen() { return img },
  }
}

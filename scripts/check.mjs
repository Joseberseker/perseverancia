// npm run check — abre la página en un Chromium headless YA instalado en el
// caché de Playwright (no descarga navegadores), guarda una captura y lista
// los errores de consola.
import { chromium } from 'playwright'
import { mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'check')
const URL_APP = process.env.CHECK_URL || 'http://localhost:5173/'

// Busca un Chromium en el caché local; nunca descarga nada.
function findBrowser() {
  try {
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch {}

  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cache)) return null
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const d of dirs) {
    const candidate = join(cache, d, 'chrome-linux', 'chrome')
    if (existsSync(candidate)) return candidate
  }
  return null
}

const executablePath = findBrowser()
if (!executablePath) {
  console.error('✗ No encontré un Chromium en el caché de Playwright y no se descargará ninguno.')
  process.exit(2)
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 810 } })

const logs = []
const errors = []

// Ruido conocido del renderizador por software: no cuenta como error.
const BENIGN = [
  /swiftshader/i,
  /SharedImageManager/i,
  /GroupMarkerNotSet/i,
  /Automatic fallback to software webgl/i,
]
const isBenign = (text) => BENIGN.some((re) => re.test(text))

page.on('console', (msg) => {
  const entry = { tipo: msg.type(), texto: msg.text() }
  logs.push(entry)
  if ((msg.type() === 'error' || msg.type() === 'warning') && !isBenign(msg.text())) {
    if (msg.type() === 'error') errors.push(entry)
  }
})
page.on('pageerror', (err) => {
  const entry = { tipo: 'pageerror', texto: err.message, stack: err.stack }
  logs.push(entry)
  errors.push(entry)
})
page.on('requestfailed', (req) => {
  const entry = { tipo: 'requestfailed', texto: `${req.url()} — ${req.failure()?.errorText}` }
  logs.push(entry)
  errors.push(entry)
})

let listo = false
let diag = null
let telemetria = null
let ocultaConT = null
let movilidad = null
let fotos = null

const DATOS_ESPERADOS = ['distancia', 'altura', 'inclinacion', 'luz']

try {
  await page.goto(URL_APP, { waitUntil: 'load', timeout: 30000 })
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30000 })
  listo = true

  // Los 4 datos del control de misión piden datos a la NASA por la red,
  // así que se esperan aparte de la escena.
  await page.waitForFunction(
    (claves) => {
      const t = window.__telemetria
      if (!t) return false
      return claves.every((k) => t.datos.find((d) => d.key === k)?.estado === 'listo')
    },
    DATOS_ESPERADOS,
    { timeout: 45000 },
  )
  telemetria = await page.evaluate(() =>
    window.__telemetria.datos.map(({ key, nombre, unidad, proveedor, valor, puntos, enVivo, estado: e, error }) => ({
      key, nombre, unidad, proveedor, valor, puntos, enVivo, estado: e, error,
    })),
  )

  // La tecla T tiene que ocultarlo y volver a mostrarlo.
  const visibleAlInicio = await page.evaluate(() => window.__telemetria.visible)
  await page.keyboard.press('KeyT')
  await page.waitForTimeout(350)
  const trasOcultar = await page.evaluate(() => ({
    estado: window.__telemetria.visible,
    claseOculto: document.getElementById('control-mision')?.classList.contains('oculto'),
  }))
  await page.keyboard.press('KeyT')
  await page.waitForTimeout(350)
  const trasMostrar = await page.evaluate(() => window.__telemetria.visible)
  ocultaConT =
    visibleAlInicio === true &&
    trasOcultar.estado === false &&
    trasOcultar.claseOculto === true &&
    trasMostrar === true


  // --- Las ruedas tienen que girar -------------------------------------
  // Ojo: con SwiftShader la pagina va a 1-8 fps, asi que el dt real no
  // acumula nada. Movemos el rover desde dentro, con pasos de 1/60 s.
  movilidad = await page.evaluate(async () => {
    const app = window.__app
    const d = app?.driver
    if (!d || !d.estado.ruedas.length) return { ok: false, motivo: 'no hay ruedas separadas' }

    const foto = () => d.estado.ruedas.map((r) => r.anguloGiro)
    const antes = foto()

    // 1) Recto: 120 pasos con W pulsada.
    const tecla = (code, tipo) =>
      window.dispatchEvent(new KeyboardEvent(tipo, { code, bubbles: true }))
    tecla('KeyW', 'keydown')
    for (let i = 0; i < 120; i++) d.update(1 / 60)
    const recto = {
      avance: d.estado.distancia,
      velocidad: d.estado.velocidad,
      rpm: d.estado.rpm,
      giros: foto().map((a, i) => Math.abs(a - antes[i])),
    }

    // 2) Arco: con A pulsada las ruedas de fuera tienen que girar mas.
    tecla('KeyA', 'keydown')
    const base = foto()
    for (let i = 0; i < 120; i++) d.update(1 / 60)
    const curva = foto().map((a, i) => a - base[i])
    const porNombre = {}
    d.estado.ruedas.forEach((r, i) => { porNombre[r.nombre] = curva[i] })
    const direcciones = d.estado.ruedas.map((r) => ({
      nombre: r.nombre, dirige: r.dirige, grados: (r.anguloDireccion * 180) / Math.PI,
    }))
    tecla('KeyA', 'keyup')
    tecla('KeyW', 'keyup')

    // 3) Giro sobre si mismo: parado y con A, las cuatro esquinas se cruzan.
    for (let i = 0; i < 60; i++) d.update(1 / 60)
    tecla('KeyA', 'keydown')
    const rumboAntes = d.estado.rumbo
    for (let i = 0; i < 180; i++) d.update(1 / 60)
    const sitio = {
      modo: d.estado.modo,
      girados: ((d.estado.rumbo - rumboAntes) * 180) / Math.PI,
      direcciones: d.estado.ruedas.map((r) => ({
        nombre: r.nombre, grados: (r.anguloDireccion * 180) / Math.PI,
      })),
    }
    tecla('KeyA', 'keyup')
    for (let i = 0; i < 60; i++) d.update(1 / 60)

    return {
      ok: true,
      numRuedas: d.estado.ruedas.length,
      directrices: d.estado.ruedas.filter((r) => r.dirige).length,
      radio: d.estado.ruedas[0].radio,
      recto,
      curva: porNombre,
      direcciones,
      sitio,
      cabeceo: (d.estado.cabeceo * 180) / Math.PI,
      balanceo: (d.estado.balanceo * 180) / Math.PI,
      recorridos: d.estado.ruedas.map((r) => r.recorrido),
    }
  })


  // --- Las cámaras tienen que abrir fotos reales ------------------------
  // Clic de verdad con el ratón sobre el punto que brilla, no una llamada
  // interna: así se comprueba también el raycaster.
  fotos = { camaras: [], capturaConFoto: null }
  const piezas = await page.evaluate(() => window.__camarasPercy?.piezas ?? null)
  if (!piezas || !piezas.length) {
    fotos.error = 'No se montaron los puntos de cámara'
  } else {
    for (const pieza of piezas) {
      // Encuadrar el punto: lo ponemos en el centro de la pantalla y
      // esperamos a que se dibuje un cuadro, porque project() usa las
      // matrices que actualiza el render.
      const framesAntes = await page.evaluate(() => window.__diag.frames)
      await page.evaluate((p) => {
        const { camera, controls } = window.__app
        const m = window.__camarasPercy.posicionEnMundo(p)
        if (!m) return
        camera.position.set(m.x + 2.4, m.y + 1.1, m.z + 2.8)
        controls.target.set(m.x, m.y, m.z)
        controls.update()
      }, pieza)
      await page.waitForFunction((f) => window.__diag.frames > f + 2, framesAntes, { timeout: 20000 })
      const punto = await page.evaluate((p) => window.__camarasPercy.puntoEnPantalla(p), pieza)
      const registro = { pieza, punto }

      if (punto && punto.visible) {
        // A una esquina primero: si el ratón ya estaba ahí, el navegador no
        // emite pointermove y la etiqueta no llegaría a aparecer.
        await page.mouse.move(12, 12)
        await page.waitForTimeout(60)
        await page.mouse.move(punto.x, punto.y)
        await page.waitForTimeout(200)
        registro.etiqueta = await page.evaluate(() => {
          const t = document.querySelector('.camara-tip')
          return t && t.classList.contains('visible') ? t.textContent : null
        })
        await page.mouse.click(punto.x, punto.y)
      } else {
        // El punto quedó fuera de cuadro: abrimos igual para no dejar la
        // cámara sin probar, y lo decimos en el informe.
        registro.sinPunto = true
        await page.evaluate((p) => window.__camarasPercy.abrir(p), pieza)
      }

      // Esperar a que la foto de la NASA esté cargada y revelada.
      try {
        await page.waitForFunction(
          () => {
            const e = window.__camarasPercy?.estado
            const i = window.__camarasPercy?.imagen
            return e?.abierto && !e.cargando && (!!e.error || (i && i.naturalWidth > 0))
          },
          null,
          { timeout: 25000 },
        )
      } catch {}

      Object.assign(
        registro,
        await page.evaluate(() => {
          const e = window.__camarasPercy.estado
          const i = window.__camarasPercy.imagen
          const pie = document.querySelector('.visor-meta')?.textContent ?? ''
          return {
            abierto: e.abierto,
            camara: e.camara?.nombre ?? null,
            total: e.camara?.fotos.length ?? 0,
            fotoId: e.foto?.id ?? null,
            sol: e.foto?.sol ?? null,
            ancho: i?.naturalWidth ?? 0,
            alto: i?.naturalHeight ?? 0,
            src: i?.currentSrc || i?.src || '',
            meta: pie,
            error: e.error,
          }
        }),
      )

      // La primera cámara deja la captura con la foto abierta. Se hace aquí,
      // con la foto ya revelada y antes de tocar las flechas: si se pasa de
      // foto primero, se retrata el hueco mientras baja la siguiente.
      if (!fotos.capturaConFoto && registro.ancho > 0) {
        await page.evaluate(() => window.__camarasPercy.ampliar(true))
        // Esperar a que se dibujen un par de cuadros de verdad: con el
        // renderizador por software un setTimeout no garantiza ni uno.
        const f0 = await page.evaluate(() => window.__diag.frames)
        await page.waitForFunction((f) => window.__diag.frames > f + 2, f0, { timeout: 30000 })
        registro.amplia = await page.evaluate(() => window.__camarasPercy.estado.ampliada)
        registro.pintada = await page.evaluate(() => {
          const m = document.querySelector('.visor-marco')
          const i = document.querySelector('.visor-img')
          const r = m.getBoundingClientRect()
          return {
            ancho: Math.round(r.width), alto: Math.round(r.height),
            dentro: r.width > 300 && r.height > 200 && r.top >= 0 && r.bottom <= window.innerHeight,
            alto: Math.round(r.height),
            pantalla: window.innerHeight,
            revelada: document.querySelector('.visor-lienzo').classList.contains('revelada'),
            imagen: i.naturalWidth,
          }
        })
        await page.screenshot({ path: join(OUT, 'foto-abierta.png'), timeout: 90000 })
        fotos.capturaConFoto = join(OUT, 'foto-abierta.png')
      }

      // Las flechas pasan a la siguiente foto de esa misma cámara.
      if (registro.total > 1) {
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(700)
        const sig = await page.evaluate(() => window.__camarasPercy.estado.foto?.id ?? null)
        registro.pasaConFlechas = !!sig && sig !== registro.fotoId
      }

      // Esc devuelve al juego.
      await page.keyboard.press('Escape')
      await page.waitForTimeout(700)
      registro.cierraConEsc = await page.evaluate(() => window.__camarasPercy.estado.abierto === false)

      fotos.camaras.push(registro)
    }
  }

  // Devolver la cámara a un encuadre normal: la prueba de las cámaras la
  // deja pegada a una pieza y la captura general saldría en primerísimo plano.
  await page.evaluate(() => {
    const { camera, controls, rover } = window.__app
    const p = rover.group.position
    const rumbo = window.__app.driver.estado.rumbo
    camera.position.set(p.x - Math.sin(rumbo) * 11, p.y + 5.5, p.z - Math.cos(rumbo) * 11)
    controls.target.set(p.x, p.y + 1.1, p.z)
    controls.update()
  })

  // Deja correr unos frames para que el polvo y el damping se asienten.
  await page.waitForTimeout(1200)
  diag = await page.evaluate(() => window.__diag)
  await page.screenshot({ path: join(OUT, 'screenshot.png'), timeout: 90000 })
} catch (err) {
  errors.push({ tipo: 'check', texto: err.message })
  try {
    await page.screenshot({ path: join(OUT, 'screenshot.png'), timeout: 90000 })
  } catch {}
}

await browser.close()

writeFileSync(
  join(OUT, 'console.json'),
  JSON.stringify({ url: URL_APP, listo, diag, telemetria, ocultaConT, movilidad, fotos, errores: errors, logs }, null, 2),
)

console.log(`\nnavegador : ${executablePath}`)
console.log(`url       : ${URL_APP}`)
console.log(`escena    : ${listo ? 'renderizó ✓' : 'NO renderizó ✗'}`)
if (diag) console.log(`diag      : ${diag.frames} frames, ${diag.objetos} objetos en escena`)
console.log(`captura   : ${join(OUT, 'screenshot.png')}`)
console.log(`consola   : ${logs.length} mensajes → ${join(OUT, 'console.json')}`)

// --- Control de misión ----------------------------------------------------
console.log('')
if (telemetria) {
  console.log('control de misión:')
  for (const clave of DATOS_ESPERADOS) {
    const d = telemetria.find((x) => x.key === clave)
    if (!d) {
      console.log(`  ✗ ${clave} — no apareció`)
      errors.push({ tipo: 'telemetria', texto: `El dato "${clave}" no apareció en el panel` })
      continue
    }
    if (d.estado !== 'listo' || !Number.isFinite(d.valor) || d.puntos < 2) {
      console.log(`  ✗ ${d.nombre} — estado=${d.estado} valor=${d.valor} puntos=${d.puntos}`)
      errors.push({ tipo: 'telemetria', texto: `El dato "${clave}" no trae números reales` })
      continue
    }
    const vivo = d.enVivo ? ' · en vivo' : ''
    console.log(
      `  ✓ ${d.nombre.padEnd(26)} ${String(d.valor.toFixed(2)).padStart(12)} ${d.unidad.padEnd(4)} ` +
        `${String(d.puntos).padStart(4)} puntos  [${d.proveedor}]${vivo}`,
    )
  }
} else {
  console.log('control de misión: ✗ no cargó')
  errors.push({ tipo: 'telemetria', texto: 'El control de misión no llegó a cargar' })
}

if (ocultaConT === true) {
  console.log('tecla T    : oculta y vuelve a mostrar ✓')
} else if (ocultaConT === false) {
  console.log('tecla T    : NO oculta el panel ✗')
  errors.push({ tipo: 'telemetria', texto: 'La tecla T no oculta el control de misión' })
}

// --- Movilidad ------------------------------------------------------------
console.log('')
if (!movilidad || !movilidad.ok) {
  console.log(`movilidad : ✗ ${movilidad?.motivo || 'no se pudo medir'}`)
  errors.push({ tipo: 'movilidad', texto: movilidad?.motivo || 'No se pudo medir la movilidad' })
} else {
  const m = movilidad
  console.log('movilidad:')
  const falla = (texto) => {
    console.log(`  ✗ ${texto}`)
    errors.push({ tipo: 'movilidad', texto })
  }

  if (m.numRuedas === 6) console.log(`  ✓ 6 ruedas separadas del GLB (radio ${m.radio.toFixed(3)} m)`)
  else falla(`Esperaba 6 ruedas y hay ${m.numRuedas}`)

  if (m.directrices === 4) console.log('  ✓ 4 ruedas directrices, 2 centrales fijas')
  else falla(`Esperaba 4 ruedas directrices y hay ${m.directrices}`)

  // Rodar sin resbalar: 2 s de marcha tienen que mover las seis ruedas.
  const minGiro = Math.min(...m.recto.giros)
  if (minGiro > 0.5) {
    console.log(
      `  ✓ las 6 ruedas giran al avanzar (mínimo ${minGiro.toFixed(2)} rad en 2 s, ` +
        `${m.recto.rpm.toFixed(1)} rpm a ${m.recto.velocidad.toFixed(2)} m/s)`,
    )
  } else {
    falla(`Alguna rueda no gira: mínimo ${minGiro.toFixed(3)} rad en 2 s de marcha`)
  }

  // En un arco a la izquierda, las ruedas de la derecha recorren mas.
  const sum = (lado) =>
    Object.entries(m.curva)
      .filter(([n]) => n.includes(`_${lado}_`))
      .reduce((a, [, v]) => a + v, 0)
  const dentro = sum('izq')
  const fuera = sum('der')
  if (fuera > dentro + 0.05) {
    console.log(`  ✓ en curva las de fuera giran más (${fuera.toFixed(2)} rad vs ${dentro.toFixed(2)})`)
  } else {
    falla(`El diferencial de curva no se nota: fuera ${fuera.toFixed(2)} rad, dentro ${dentro.toFixed(2)}`)
  }

  // Direccion: solo las esquinas, y las centrales a cero.
  const centrales = m.direcciones.filter((d) => !d.dirige)
  const esquinas = m.direcciones.filter((d) => d.dirige)
  const maxEsquina = Math.max(...esquinas.map((d) => Math.abs(d.grados)))
  const maxCentral = Math.max(...centrales.map((d) => Math.abs(d.grados)))
  if (maxEsquina > 3 && maxCentral < 0.01) {
    console.log(`  ✓ solo dirigen las esquinas (hasta ${maxEsquina.toFixed(1)}°, centrales a 0°)`)
  } else {
    falla(`Dirección rara: esquinas ${maxEsquina.toFixed(1)}°, centrales ${maxCentral.toFixed(2)}°`)
  }

  // Giro sobre si mismo: patron en X y el rover rota de verdad.
  const ang = Object.fromEntries(m.sitio.direcciones.map((d) => [d.nombre, d.grados]))
  const cruzadas =
    Math.sign(ang.rueda_izq_delantera) !== Math.sign(ang.rueda_der_delantera) &&
    Math.sign(ang.rueda_izq_delantera) !== Math.sign(ang.rueda_izq_trasera)
  if (m.sitio.modo === 'sitio' && Math.abs(m.sitio.girados) > 20 && cruzadas) {
    console.log(
      `  ✓ gira sobre sí mismo ${m.sitio.girados.toFixed(0)}° en 3 s, ruedas en X ` +
        `(${ang.rueda_izq_delantera.toFixed(0)}° / ${ang.rueda_der_delantera.toFixed(0)}°)`,
    )
  } else {
    falla(
      `Giro sobre sí mismo: modo=${m.sitio.modo} girados=${m.sitio.girados.toFixed(1)}° ` +
        `patrón en X=${cruzadas}`,
    )
  }

  // Rocker-bogie: cada rueda con su propia carrera.
  const carreras = m.recorridos.map((v) => +v.toFixed(3))
  const distintas = new Set(carreras).size
  console.log(
    `  ${distintas > 1 ? '✓' : '·'} rocker-bogie: cabeceo ${m.cabeceo.toFixed(1)}°, ` +
      `balanceo ${m.balanceo.toFixed(1)}°, carreras [${carreras.join(', ')}] m`,
  )
}

// --- Cámaras y fotos reales -----------------------------------------------
console.log('')
if (!fotos || fotos.error || !fotos.camaras.length) {
  console.log(`cámaras   : ✗ ${fotos?.error || 'no se pudieron probar'}`)
  errors.push({ tipo: 'fotos', texto: fotos?.error || 'No se pudieron probar las cámaras' })
} else {
  console.log('cámaras de Percy:')
  const falla = (texto) => {
    console.log(`  ✗ ${texto}`)
    errors.push({ tipo: 'fotos', texto })
  }
  for (const c of fotos.camaras) {
    if (c.error) { falla(`${c.pieza}: ${c.error}`); continue }
    if (!c.abierto && !c.cierraConEsc) { falla(`${c.pieza}: no llegó a abrir`); continue }
    if (!(c.ancho > 0)) { falla(`${c.pieza}: la foto no cargó (${c.src || 'sin src'})`); continue }

    const avisos = []
    if (c.sinPunto) avisos.push('punto fuera de cuadro')
    else if (!c.etiqueta) avisos.push('sin etiqueta al pasar el ratón')
    if (c.total > 1 && !c.pasaConFlechas) avisos.push('las flechas no pasan foto')
    if (!c.cierraConEsc) avisos.push('Esc no cierra')

    console.log(
      `  ${avisos.length ? '·' : '✓'} ${String(c.camara || c.pieza).padEnd(18)} ` +
        `sol ${String(c.sol).padEnd(5)} ${c.ancho}×${c.alto}  ${c.total} fotos` +
        (avisos.length ? `  (${avisos.join(', ')})` : ''),
    )
    if (c.meta) console.log(`      ${c.meta}`)
    // Lo que de verdad pide el encargo: Esc devuelve al juego y la foto es real.
    if (!c.cierraConEsc) falla(`${c.pieza}: Esc no devuelve al juego`)
  }

  const abiertas = fotos.camaras.filter((c) => c.ancho > 0).length
  if (abiertas === fotos.camaras.length) {
    console.log(`  ✓ las ${abiertas} cámaras abren una foto real`)
  } else {
    falla(`Solo ${abiertas} de ${fotos.camaras.length} cámaras abrieron foto`)
  }

  const pintada = fotos.camaras.find((c) => c.pintada)?.pintada
  if (pintada) {
    if (pintada.dentro && pintada.revelada && pintada.imagen > 0) {
      console.log(`  \u2713 tarjeta ampliada en pantalla: ${pintada.ancho}\u00d7${pintada.alto} px, foto revelada`)
    } else {
      falla(`La tarjeta no quedó visible al ampliar: ${JSON.stringify(pintada)}`)
    }
  }
  if (fotos.capturaConFoto) console.log(`  captura con la foto abierta: ${fotos.capturaConFoto}`)
  else falla('No se guardó la captura con la foto abierta')
}

if (errors.length) {
  console.log(`\n✗ ${errors.length} error(es):`)
  for (const e of errors.slice(0, 20)) console.log(`  [${e.tipo}] ${e.texto}`)
  process.exit(1)
}

console.log('\n✓ Sin errores de consola.')

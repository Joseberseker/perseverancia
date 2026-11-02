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

try {
  await page.goto(URL_APP, { waitUntil: 'load', timeout: 30000 })
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30000 })
  listo = true
  // Deja correr unos frames para que el polvo y el damping se asienten.
  await page.waitForTimeout(1200)
  diag = await page.evaluate(() => window.__diag)
  await page.screenshot({ path: join(OUT, 'screenshot.png') })
} catch (err) {
  errors.push({ tipo: 'check', texto: err.message })
  try {
    await page.screenshot({ path: join(OUT, 'screenshot.png') })
  } catch {}
}

await browser.close()

writeFileSync(
  join(OUT, 'console.json'),
  JSON.stringify({ url: URL_APP, listo, diag, errores: errors, logs }, null, 2),
)

console.log(`\nnavegador : ${executablePath}`)
console.log(`url       : ${URL_APP}`)
console.log(`escena    : ${listo ? 'renderizó ✓' : 'NO renderizó ✗'}`)
if (diag) console.log(`diag      : ${diag.frames} frames, ${diag.objetos} objetos en escena`)
console.log(`captura   : ${join(OUT, 'screenshot.png')}`)
console.log(`consola   : ${logs.length} mensajes → ${join(OUT, 'console.json')}`)

if (errors.length) {
  console.log(`\n✗ ${errors.length} error(es):`)
  for (const e of errors.slice(0, 20)) console.log(`  [${e.tipo}] ${e.texto}`)
  process.exit(1)
}

console.log('\n✓ Sin errores de consola.')

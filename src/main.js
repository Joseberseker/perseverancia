import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createHeightField, createTerrain } from './terrain.js'
import { createSky } from './sky.js'
import { createRocks } from './rocks.js'
import { createMoons } from './moons.js'
import { createDust } from './dust.js'
import { createTracks } from './tracks.js'
import { loadRover, createRoverController, FICHA } from './rover.js'
import { crearTelemetryAPI, objetoDeTelemetria } from './telemetry.js'
import { crearProveedorNASA, CLAVES_NASA, solActual } from './providers/nasaWaypoints.js'
import { crearProveedorLuz } from './providers/lightTime.js'
import { createMissionControl } from './missionControl.js'

// La escena está en metros. El rover mide 3 m de largo.

// --- Dirección del sol: tarde marciana, muy bajo sobre el horizonte -------
function dirFromSky(azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  const el = THREE.MathUtils.degToRad(elevationDeg)
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).normalize()
}

const SUN_DIR = dirFromSky(152, 7)

// --- Renderer -------------------------------------------------------------
const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap

// --- Escena ---------------------------------------------------------------
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(new THREE.Color('#d09663'), 0.0032)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 4000)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 3
controls.maxDistance = 120
controls.maxPolarAngle = (Math.PI / 2) * 0.99

scene.add(createSky(SUN_DIR))

// --- Luces ----------------------------------------------------------------
// Sol de tarde: cálido, rasante, con sombras largas y suaves. El frustum de
// sombra es estrecho y viaja con el rover, para que su sombra sea nítida.
const sun = new THREE.DirectionalLight(new THREE.Color('#ffb97a'), 3.1)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.camera.left = -55
sun.shadow.camera.right = 55
sun.shadow.camera.top = 55
sun.shadow.camera.bottom = -55
sun.shadow.camera.near = 1
sun.shadow.camera.far = 400
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.05
sun.shadow.radius = 2.5
sun.shadow.blurSamples = 10
scene.add(sun)
scene.add(sun.target)

const bounce = new THREE.HemisphereLight(
  new THREE.Color('#e3a771'),
  new THREE.Color('#7a4228'),
  1.0,
)
scene.add(bounce)

const fill = new THREE.DirectionalLight(new THREE.Color('#9db0c4'), 0.8)
fill.position.copy(SUN_DIR).multiplyScalar(-400).setY(180)
scene.add(fill)

// --- Terreno, rocas, lunas y polvo ---------------------------------------
const height = createHeightField(1337)
scene.add(createTerrain(height))
scene.add(createRocks(height))

const dust = createDust({ radius: 220, height: 40 })
scene.add(dust)

const moons = createMoons()
scene.add(moons)

const tracks = createTracks()
scene.add(tracks.mesh)

// --- Rover ----------------------------------------------------------------
const hud = document.getElementById('hud')
const estadoHud = document.getElementById('hud-estado')

// Expuesto para depurar desde la consola o desde npm run check.
window.__app = { scene, camera, controls, renderer, sun, moons, tracks, SUN_DIR }

let rover = null
let driver = null

function colocarCamaraDetras(inmediato = false) {
  if (!rover) return
  const pos = rover.group.position
  const rumbo = driver.estado.rumbo
  // Detrás = sentido opuesto al avance.
  const destino = new THREE.Vector3(
    pos.x - Math.sin(rumbo) * 7.5,
    pos.y + 3.2,
    pos.z - Math.cos(rumbo) * 7.5,
  )
  if (inmediato) camera.position.copy(destino)
  else camera.position.lerp(destino, 0.12)
  controls.target.set(pos.x, pos.y + 1.1, pos.z)
  controls.update()
}

let orbitando = false
controls.addEventListener("start", () => { orbitando = true })
controls.addEventListener("end", () => { orbitando = false })

loadRover()
  .then((resultado) => {
    rover = resultado
    scene.add(rover.group)

    driver = createRoverController(rover.group, height, {
      ruedas: rover.ruedas,
      onTrack: (pos, rumbo, normal, via) => tracks.marcar(pos, rumbo, normal, via),
    })

    // Posición inicial sobre el terreno.
    driver.update(0)
    colocarCamaraDetras(true)

    // --- Piezas de cámara del rover, a la consola ------------------------
    const nombres = rover.camaras.map((c) => c.nombre)
    console.log(
      `%c🔭 Piezas de cámara del Perseverance (${nombres.length})`,
      'font-weight:bold;color:#d98a5c',
    )
    for (const c of rover.camaras) console.log(`   · ${c.nombre}  (${c.tipo})`)
    console.log(
      `%c🛻 Escala real: ${rover.medidas.real.largo} m largo × ${rover.medidas.real.ancho} m ancho × ${rover.medidas.real.alto} m alto` +
        `  (factor ${rover.medidas.escala.toExponential(3)})`,
      'color:#d98a5c',
    )

    // --- Movilidad: las seis ruedas separadas del GLB --------------------
    if (rover.ruedas) {
      const m = rover.medidas.movilidad
      console.log(
        `%c\u2699\ufe0f Movilidad rocker-bogie: ${m.ruedas} ruedas motrices, 4 directrices`,
        'font-weight:bold;color:#d98a5c',
      )
      console.log(
        `   rueda \u00f8 ${m.diametro} m (real 0.525) \u00b7 ancho ${m.ancho} m \u00b7 ` +
          `v\u00eda ${m.via} m \u00b7 batalla ${m.batalla} m`,
      )
      console.table(
        rover.ruedas.ruedas.map((r) => ({
          rueda: r.nombre,
          lado: r.lado,
          fila: ['delantera', 'media', 'trasera'][r.fila],
          dirige: r.dirige,
          x: +r.pos.x.toFixed(3),
          z: +r.pos.z.toFixed(3),
          radio: +r.radio.toFixed(3),
        })),
      )
      console.log(
        `   masa ${FICHA.masa} kg \u00b7 g = ${FICHA.gravedad} m/s\u00b2 \u00b7 ` +
          `pendiente m\u00e1x ${FICHA.pendienteMax}\u00b0 \u00b7 ` +
          `velocidad real NASA ${FICHA.velocidadNASA} m/s (tecla V)`,
      )
      window.__ruedas = rover.ruedas.ruedas
    } else {
      console.warn('No pude separar las ruedas del modelo: conduzco con el modo simple.')
    }

    window.__camarasRover = nombres
    window.__app.rover = rover
    window.__app.driver = driver
    window.__app.tracks = tracks

    hud.classList.add('listo')
  })
  .catch((err) => {
    console.error('No se pudo cargar el rover:', err)
    if (estadoHud) estadoHud.textContent = 'Error al cargar el rover: ' + err.message
  })

// --- Entrada --------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') colocarCamaraDetras(true)
  if (e.code === 'KeyB') tracks.limpiar()
  if (e.code === 'KeyT') control.toggle()
})

// --- Control de misión ----------------------------------------------------
// Telemetría real de Percy, con el patrón de proveedores de NASA Open MCT.
const telemetry = crearTelemetryAPI()
telemetry.addProvider(crearProveedorNASA())
telemetry.addProvider(crearProveedorLuz())

const control = createMissionControl({
  telemetry,
  objetos: [...CLAVES_NASA, 'luz'].map((k) => objetoDeTelemetria(k)),
  solActual,
})
document.body.appendChild(control.el)

window.__telemetria = control.estado
window.__app.telemetry = telemetry
window.__app.control = control

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

// --- Bucle ----------------------------------------------------------------
let last = performance.now()
let frames = 0
const delta = new THREE.Vector3()
const objetivo = new THREE.Vector3()
const destinoCam = new THREE.Vector3()

function animate() {
  const now = performance.now()
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  dust.userData.update(dt)

  if (driver) {
    driver.update(dt)

    // El punto de mira va siempre sobre el rover, y la cámara acompaña
    // esa traslación para no quedarse atrás.
    const pos = rover.group.position
    objetivo.set(pos.x, pos.y + 1.1, pos.z)
    delta.copy(objetivo).sub(controls.target)
    controls.target.copy(objetivo)
    camera.position.add(delta)

    // En marcha vuelve sola detrás del rover; si el usuario está
    // arrastrando el ratón, mandan sus manos.
    const rumbo = driver.estado.rumbo
    if (!orbitando && Math.abs(driver.estado.velocidad) > 0.25) {
      const dist = camera.position.distanceTo(controls.target)
      destinoCam.set(
        pos.x - Math.sin(rumbo) * dist * 0.93,
        objetivo.y + dist * 0.36,
        pos.z - Math.cos(rumbo) * dist * 0.93,
      )
      camera.position.lerp(destinoCam, 1 - Math.exp(-dt * 1.4))
    }

    // El foco de sombra viaja con el rover.
    sun.target.position.copy(rover.group.position)
    sun.position.copy(rover.group.position).addScaledVector(SUN_DIR, 200)
    sun.target.updateMatrixWorld()

    if (estadoHud) {
      const e = driver.estado
      const partes = [
        `${e.velocidad.toFixed(e.velocidadReal ? 3 : 1)} m/s`,
        `${e.rpm.toFixed(1)} rpm`,
        `pendiente ${THREE.MathUtils.radToDeg(e.cabeceo).toFixed(0)}°`,
        `${e.distancia.toFixed(0)} m`,
      ]
      if (e.deslizamiento > 0.08) partes.push(`patina ${(e.deslizamiento * 100).toFixed(0)}%`)
      if (e.modo === 'sitio') partes.push('giro sobre sí mismo')
      if (e.velocidadReal) partes.push('velocidad real NASA')
      estadoHud.textContent = partes.join(' · ')
    }
  } else {
    sun.position.copy(SUN_DIR).multiplyScalar(200)
  }

  controls.update()
  renderer.render(scene, camera)

  frames++
  // La escena solo se declara lista cuando el rover ya está puesto.
  if (frames > 2 && rover) window.__sceneReady = true
  window.__diag = {
    frames,
    objetos: scene.children.length,
    rover: rover ? rover.medidas : null,
    camarasRover: rover ? rover.camaras.map((c) => c.nombre) : null,
    movilidad:
      driver && driver.estado.ruedas.length
        ? {
            ruedas: driver.estado.ruedas.map((r) => ({
              nombre: r.nombre,
              dirige: r.dirige,
              radio: +r.radio.toFixed(4),
              giro: +r.anguloGiro.toFixed(4),
              vueltas: +(r.anguloGiro / (Math.PI * 2)).toFixed(2),
              rodado: +r.rodado.toFixed(2),
              direccion: +r.anguloDireccion.toFixed(4),
              rpm: +r.rpm.toFixed(2),
              recorrido: +r.recorrido.toFixed(4),
            })),
            velocidad: driver.estado.velocidad,
            rpm: driver.estado.rpm,
            cabeceo: driver.estado.cabeceo,
            balanceo: driver.estado.balanceo,
            deslizamiento: driver.estado.deslizamiento,
            modo: driver.estado.modo,
          }
        : null,
  }
  requestAnimationFrame(animate)
}

animate()

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createHeightField, createTerrain } from './terrain.js'
import { createSky } from './sky.js'
import { createRocks } from './rocks.js'
import { createMoons } from './moons.js'
import { createDust } from './dust.js'

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
scene.fog = new THREE.FogExp2(new THREE.Color('#d09663'), 0.0021)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 4000)
camera.position.set(18, 13, 86)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 26, -20)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 25
controls.maxDistance = 280
controls.maxPolarAngle = Math.PI / 2 * 0.99
controls.update()

scene.add(createSky(SUN_DIR))

// --- Luces ----------------------------------------------------------------
// Sol de tarde: cálido, rasante, con sombras largas y suaves.
const sun = new THREE.DirectionalLight(new THREE.Color('#ffb97a'), 3.1)
sun.position.copy(SUN_DIR).multiplyScalar(600)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.camera.left = -220
sun.shadow.camera.right = 220
sun.shadow.camera.top = 220
sun.shadow.camera.bottom = -220
sun.shadow.camera.near = 1
sun.shadow.camera.far = 1800
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.9
sun.shadow.radius = 2.5
sun.shadow.blurSamples = 10
scene.add(sun)
scene.add(sun.target)

// Rebote del polvo atmosférico: cielo caramelo arriba, regolito abajo.
const bounce = new THREE.HemisphereLight(
  new THREE.Color('#e3a771'),
  new THREE.Color('#7a4228'),
  1.0,
)
scene.add(bounce)

// Relleno frío muy tenue desde el lado opuesto, para que las sombras no
// queden negras y conserven detalle.
const fill = new THREE.DirectionalLight(new THREE.Color('#9db0c4'), 0.8)
fill.position.copy(SUN_DIR).multiplyScalar(-400).setY(180)
scene.add(fill)

// --- Terreno, rocas, lunas y polvo ---------------------------------------
const height = createHeightField(1337)
scene.add(createTerrain(height))
scene.add(createRocks(height))
const dust = createDust()
scene.add(dust)

const moons = createMoons()
scene.add(moons)

// Expuesto para depurar e inspeccionar desde la consola o desde npm run check.
window.__app = { scene, camera, controls, renderer, sun, moons, SUN_DIR }

// --- Bucle ----------------------------------------------------------------
let last = performance.now()
let frames = 0

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

function animate() {
  const now = performance.now()
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  dust.userData.update(dt)
  controls.update()
  renderer.render(scene, camera)

  frames++
  if (frames === 2) window.__sceneReady = true
  window.__diag = { frames, objetos: scene.children.length }
  requestAnimationFrame(animate)
}

animate()

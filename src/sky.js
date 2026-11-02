import * as THREE from 'three'

// Cúpula de cielo: caramelo polvoriento con el halo azulado que el polvo fino
// de Marte produce alrededor del sol al atardecer.
const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHaze;
  uniform vec3 uHalo;
  uniform vec3 uGlow;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);

    // Gradiente vertical: caramelo abajo, ocre más profundo arriba.
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.68));

    // Banda de polvo pegada al horizonte.
    float band = 1.0 - smoothstep(0.0, 0.16, abs(d.y));
    col = mix(col, uHaze, band * 0.75);

    // Halo frío alrededor del sol (dispersión del polvo marciano).
    float sd = max(dot(d, uSunDir), 0.0);
    col = mix(col, uHalo, pow(sd, 6.0) * 0.8);

    // Núcleo luminoso.
    col += uGlow * pow(sd, 90.0) * 1.6;
    col += uGlow * pow(sd, 1400.0) * 4.0;

    // Oscurece bajo el horizonte para que no brille el suelo lejano.
    col *= mix(0.55, 1.0, smoothstep(-0.25, 0.02, d.y));

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createSky(sunDir) {
  const geometry = new THREE.SphereGeometry(2400, 48, 32)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uZenith: { value: new THREE.Color('#8a5334') },
      uHorizon: { value: new THREE.Color('#d59a63') },
      uHaze: { value: new THREE.Color('#edc08f') },
      uHalo: { value: new THREE.Color('#a9bcc6') },
      uGlow: { value: new THREE.Color('#fff1d6') },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'cielo'
  mesh.frustumCulled = false
  return mesh
}

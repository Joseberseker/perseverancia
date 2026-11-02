import { defineConfig } from 'vite'

const RUTA_LOCAL = '/nasa/waypoints.json'
const URL_NASA = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json'

// El historial de manejos de la NASA no se puede pedir desde el navegador:
//   1. El servidor manda Access-Control-Allow-Origin: *, pero con
//      `Vary: Origin` detrás de CloudFront. La CDN sirve variantes cacheadas
//      SIN esa cabecera y el fetch falla por CORS de forma intermitente.
//   2. Un proxy que reenvíe la petición tampoco sirve: con las cabeceras del
//      navegador (Referer, Sec-Fetch-*, client hints) CloudFront responde 403.
//
// Así que lo descarga Node y lo sirve como si fuera nuestro. Mismo dato, misma
// URL de origen, y queda cacheado en memoria para las siguientes recargas.
// Usa solo lo que Vite ya trae: no hace falta instalar nada.
function waypointsDeLaNASA() {
  let cache = null

  const servir = async (req, res) => {
    try {
      if (!cache) {
        const respuesta = await fetch(URL_NASA, {
          headers: { accept: 'application/json', 'user-agent': 'perseverancia-sim/0.1' },
        })
        if (!respuesta.ok) throw new Error(`NASA MMGIS respondió ${respuesta.status}`)
        cache = await respuesta.text()
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.end(cache)
    } catch (err) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: String(err.message || err), fuente: URL_NASA }))
    }
  }

  return {
    name: 'nasa-waypoints',
    // Ojo: con cuerpo de flecha estos hooks DEVUELVEN el connect app, que es
    // una función, y Vite la trataría como hook posterior y la llamaría sin
    // argumentos. Tienen que devolver undefined.
    configureServer(server) {
      server.middlewares.use(RUTA_LOCAL, servir)
    },
    configurePreviewServer(server) {
      server.middlewares.use(RUTA_LOCAL, servir)
    },
  }
}

export default defineConfig({
  plugins: [waypointsDeLaNASA()],
  server: { host: true, port: 5173, strictPort: true },
  preview: { port: 4173 },
})

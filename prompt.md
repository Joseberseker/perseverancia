PEDIDO 1

Estamos en una carpeta vacía. Crea un proyecto con Vite y Three.js y prende el servidor apenas puedas. Yo lo veo en vio en el navegador de VsCode.

Quiero un paisaje de Marte que se vea de película: dunas, rocas, cielo color caramelo con polvo, un sol de tarde con luz cálida y sombras suaves, y las dos lunas de Marte.

Que se vea algo en menos de 2 minutos después de aprobar el plan y después lo mejoras. Para revisarte, crea npm run check: abre la página en un Chrome invisible (Playwright con mi Chrom, sin descargar navegadores), guarda una captura y lista los errores de consola. Córrelo tras cada mejora grande,m mira la captura y corrige. Máximo 3 rondas. Listo cuando no haya errores y la captura muestre todo lo pedido.


PEDIDO 2

Ahora trae el rover de verdad. Descarga el modelo 3D oficial de Perseverance de la NASA en public/models/: https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Mars%202020%20Perseverance%20Rover/Mars%202020%20Perseverance%20Rover.glb

Ponlo a tamaño real sobre el terreno. Que se maneje con las treclas WASD, deje huellas y la cámara lo siga.

En la consola, escribe los nombres de las piezas que son cámaras. Las usaremos al final.


PEDIDO 3

Clona https://github.com/nasa/openmct. Es el software de control de misión de la NASA. No lo conozco y quiero entender la telemetría de nuestro Percy ahí.

Usa dos subagentes en paralelo: uno mapea la arquitectura (el núcleo y los plugins) y otro sigue el viaje de un dato de telemetría, desde el proveedor hasta que aparece en una gráfica.

Con eso, hazme un artefacto para entenderlo en lenguaje simple: arranca con una frase que lo explica fácilmente y luego un mapa-del-repo.html con un diagrama de cajas y flechas (cada caja con su archivo:línea), las 5 piezas clave y una sección "Cómo conectamos Percy". En español simple. No instales nada ni cambies su repo. Antes de entregar, abre 3 archivo:línea al azar y confirma que coinciden.


PEDIDO 4

Ahora aplícalo a nuestro juego: arma un control de misión dentro de la simulación, con el patrón que encontraste en Open MCT (cada dato con su nombre, unidad y proveedor) y 4 datos reales de Percy:
- Distancia recorrida, altura del terreno e inclinación, del historial de manejos de la NASA: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
- Tiempo de luz entre la Tierra y Marte, calculado en vivo.
Cada dato con su valor, una gráfica de toda la misión y una frase simple de qué significa. Que se sienta parte del juego y que la tecla T lo oculte. No instales nada. Sin fotos: esas son del acto 3.

Listo cuando: los 4 muestran números reales y T lo oculta. Amplía npm run check para que confirme que los 4 cargaron y que la consola no tiene errores.

PEDIDO 5

Ahora la experiencia mágica: que las cámaras de Percy tomen fotos reales de Marte.
- Muestra 4 cámaras como puntos que brillan sobre sus piezas del modelo (Mastcam_Z_cams, NavCams, hazcams_front, WATSON), con su nombre al pasar el mouse.
- Al hacer clic: obturador y flash, y la foto se revela poco a poco. Se queda quieta unos segundos, grande y fácil de ver; clic para ampliar, Esc para volver al juego, flechas para ver más fotos de esa cámara.
- Fotos de esta API: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&num=100&page=0&order=sol+desc (por cámara: &search=&7CNAVCAM_LEFT%7C)
- De cada cámara, las más impresionantes de los últimos días: a color, que se sienta Marte (horizonte, el brazo sobre el suelo, rocas de cerca). Nada de cielo vacio, sol, calibración ni miniaturas. Descarga y mira las fotos antes de escoger.
- Cada foto dice cámara, sol y hace cuántos días.

Listo cuando: cada cámara abre una foto real. Amplía npm run check para que haga clic en una cámara y guarde la captura con la foto abierta.
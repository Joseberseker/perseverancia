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
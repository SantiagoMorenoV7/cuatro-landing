# Cuatro: landing page multimedia

Landing de un producto ficticio, **Cuatro**, una app para aprender cuatro llanero en 8 semanas.
Proyecto individual de Sistemas Multimedia (UCC Villavicencio). Sitio estático: HTML, CSS y JavaScript sin frameworks.

## Cómo desplegarla en Vercel

**Opción A, con GitHub (recomendada):**
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta (`index.html` debe quedar en la raíz).
2. Entra a vercel.com, elige **Add New → Project** e importa el repositorio.
3. En *Framework Preset* deja **Other**. No hace falta comando de build ni carpeta de salida.
4. Dale **Deploy**. En un minuto tienes la URL `https://tu-proyecto.vercel.app`.

**Opción B, desde la terminal:**
```bash
npm i -g vercel
cd cuatro
vercel --prod
```

Para probarla en tu computador antes: `npx serve .` y abre la dirección que te muestra.
(Abriendo `index.html` con doble clic también funciona, pero el espectro de audio en vivo y los saltos del video necesitan un servidor.)

## Los 7 componentes multimedia y dónde están

En la página hay un botón flotante **"Ver componentes multimedia"** que marca cada sección con los componentes que usa. Sirve para la exposición.

| Componente | Dónde | Qué hace |
|---|---|---|
| **Texto** | Toda la página | Titular, beneficios, precios, preguntas frecuentes |
| **Gráficos** | Diapasón en SVG, gráfico "La ruta de 8 semanas", formas de onda, íconos | Muestran acordes, progreso y sonido |
| **Imágenes** | Ilustración del llano y las tres pantallas de la app | Presentan el producto |
| **Video** | "La lección 1, completa y gratis" | Tutorial de 21 s con audio sincronizado y capítulos |
| **Audio** | El cuatro del inicio (síntesis en vivo), "Semana 1 vs Semana 8" y el afinador con micrófono | El cuatro suena de verdad; las grabaciones comparan el antes y el después |
| **Animación** | Cuerdas que vibran, entrada del titular, gráfico que se dibuja, espectro | Responden a lo que hace el usuario |
| **Interactividad** | Tocar el cuatro, acordes, golpe de joropo, reto, capítulos del video, semanas del gráfico, precios | El usuario prueba el producto antes de comprarlo |

## Respuestas para la actividad

- **¿Qué componentes multimedia utiliza?** Los siete: texto, gráficos, imágenes, video, audio, animación e interactividad.
- **¿Cuál es el componente principal?** El audio. El producto es enseñar a tocar un instrumento, así que todo gira alrededor de cómo suena.
- **¿Cómo se integran?** El audio y la interactividad están unidos en el cuatro del inicio: al pasar el mouse por las cuerdas, se genera el sonido (audio), las cuerdas vibran (animación) y los dedos se dibujan en el diapasón (gráficos). El video combina gráficos, animación y audio sincronizado. Los reproductores juntan audio con su forma de onda (gráfico).
- **¿Cuál impacta más la experiencia?** La interactividad del cuatro: el visitante toca el instrumento en los primeros segundos, antes de leer nada.
- **¿Qué pasa si eliminamos uno?** Sin audio la página pierde su sentido: el cuatro queda mudo y la comparación semana 1 vs semana 8 desaparece. Sin interactividad, la página solo describe el producto en vez de dejar probarlo. Sin video, no se ve cómo es una lección real.

## Lo nuevo

- **Cielo llanero**: estrellas detrás del cuatro que brillan más fuerte cuando suena, y una estrella fugaz cuando el golpe va con fuerza.
- **Ondas de sonido** que salen de la boca del cuatro con cada cuerda.
- **Acompaña una canción**: Seis por derecho y Pajarillo cambian de acorde solos, compás por compás, con el compás actual iluminado. Se agregó el acorde Fa#7.
- **Afinador**: con el micrófono detecta la nota (algoritmo YIN) y la aguja indica si subir o bajar; también tiene notas de referencia de cada cuerda.
- **Atardecer**: el llano está en capas y, al bajar, el sol se oculta detrás de los morichales y cae la noche.
- Los títulos se revelan al llegar a cada sección y las pantallas de la app se inclinan con el mouse.

## Pensada para celular

- En pantallas pequeñas el cuatro se pone **vertical**, con la cejuela arriba y los acordes en una columna al lado, como en una app de instrumento. Se rasguea deslizando el dedo de lado a lado; deslizar hacia arriba o abajo sigue haciendo scroll.
- En Android el teléfono **vibra suave** con cada cuerda.
- El video cambia a una **versión cuadrada** con letra más grande.
- El gráfico se redibuja para pantalla angosta, la galería tiene indicador de página, el menú se abre en pantalla completa y el plan principal sale primero.
- El botón "Ver componentes" aparece al bajar, para no tapar el instrumento.

## Cómo está hecho

- `js/cuatro.js`: síntesis de cuerdas con el algoritmo **Karplus-Strong** en Web Audio API, afinación real del cuatro (La3, Re4, Fa#4, Si3), golpe de joropo en 3/4 con maracas y bajo, y el reto.
- `js/main.js`: controles del video, reproductores de audio con espectro (AnalyserNode), gráfico SVG y precios.
- `assets/`: el video, el audio y las imágenes se generaron por código para este proyecto (sin material con derechos de autor). Tipografía: Bricolage Grotesque (licencia OFL).
- Accesible con teclado (`1`–`6` cambian de acorde, `Espacio` rasguea) y respeta "reducir movimiento".

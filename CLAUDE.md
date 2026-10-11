# Phony Business

Juego de fiesta multijugador en 3D para navegador (parodia de un call center nocturno).
Three.js r186 + Rapier (WASM) + postprocessing; Vite 8.

## Comandos
- `npm install`
- `npm run dev`: servidor de desarrollo (http://localhost:5173)
- `npm run build`: genera `dist/phony-business.html` (un solo archivo autocontenido)
- `npm run build:artifact`: genera `dist-artifact/artifact.html` (versión para el artifact de claude.ai)
- `npm run relay`: relay opcional para el multijugador (`server/relay.mjs`)
- Smoke test: `python3 tests/shotjs.py file://$PWD/dist/phony-business.html out.png 1280 720 120 "js"` (Playwright)

## Notas
- El bundle tiene que ser ASCII en las regex: usar `/\p{M}/gu` y no rangos `̀-ͯ` (el minificador los convierte en bytes crudos).
- La URL de pago de la tienda de tokens se define al compilar: `VITE_STORE_URL=https://... npm run build` (la comisión es del 5 %, en `src/ai/store.js`).
- IA: el jugador trae su propio proveedor (Config → IA); sin IA se usa el cerebro offline `src/ai/scripted.js`.
- Cerebro offline: conversación con memoria por llamada (`call.sb`: quién llama, por qué, pruebas, la pregunta que el personaje dejó pendiente). Da el dato si la confianza alcanza el umbral, duda y pregunta cerca del umbral, cuestiona y corta lejos de él. Las líneas en español usan `[vos|usted]` según `mark.formal`; ninguna línea se repite en una llamada.
- Estafas en tono de parodia: todos los datos son claramente falsos (SSN 000-, tarjetas 0000), sin instrucciones reales de estafa ni marcas reales; al final de cada llamada hay un repaso de las señales de alerta.
- Voces: TTS del navegador, prioriza las voces "Natural"/"Online". Nada de clonar voces de famosos.
- Voz propia: Matías (personaje `matias`) habla con el perfil "Mi Voz" del dev a través de la app Voicebox local (`src/voice/voicebox.js`, puerto 17493; en `npm run dev` va por el puente `/voicebox` de `vite.config.js`). Sin Voicebox, voz del navegador. Solo ese perfil, no otros.
- PC del juego (`src/ui/desktop.js`): skin retro estilo XP ("Luna"), scopeado a `.pc` en `src/styles.css` (barra azul, Inicio verde, barras de título azules, fondo tipo Bliss). Apps para perder el tiempo en `src/ui/apps.js`: Buscaminas, Snake (Viborita) y Phony Feed (scroll vertical de clips inventados). Reportan progreso con `game.onArcade(app, name, n)` → `Calls.arcadeProgress`, para los desafíos `kind: 'arcade'` (ganar Buscaminas, 12 en Snake, 6 clips). Sin marcas reales.
- Cazaestafadores: cualquier cliente puede serlo en secreto (`TUNE.baiterChance`, se decide al sonar el teléfono: `ring.bt` → `call.baiter`). Sus datos y pagos son truchos; su PC lo delata (`BAITER_PC` en `src/ui/desktop.js`). Ningún personaje lo es siempre.
- Personajes: `MARKS` en `src/ai/marks.js` (27). Cada uno trae `photo` y `wall` para su PC; `formal: true` si trata de usted. Las palabras se comparan con `wordMatcher` (palabras cortas completas: "ip" no está en "ship").
- Voz y llamadas: el mic solo se pausa por la voz del cliente propio (no por el jefe ni compañeros) y al pausarse envía lo dicho en vez de borrarlo. Si la IA falla o tarda (15 s), contesta ese turno el cerebro de repuesto (`Calls.coverTurn`) y lo pendiente siempre se envía.
- Multijugador: el anfitrión es quien abrió la oficina (la hora de entrada `bn` que publica cada jugador; a igual hora, el id más bajo). Él fija la duración del turno (lobby → `game.shiftMin`, opciones en `TUNE.shiftChoices`) y la cuota, que escala con la duración; los demás las copian.
- Micrófono abierto: el medidor tiene compuerta contra el piso de ruido (`Mic.sample`) y el reconocedor descarta lo que llega sin voz detectada (`ears.vad`); durante una llamada el ambiente y la música bajan (`audio.setDuck`).
- Rendimiento (en celular el cuello de botella es la CPU por objeto dibujado, no la GPU):
  - Calidad `low` = camino móvil: sin post-procesado (tone mapping en los materiales), luces `lite` (sin luces de área ni de monitores), pantallas de escritorio y horizonte a menor resolución (`texScale`). Los celulares arrancan ahí.
  - El autoajuste (`Game.frameStats`) corre toda la sesión y solo baja: calidad y después resolución (`renderer.dynScale`, hasta 65 %).
  - Personajes: `cullCharacters` oculta los que están fuera de cámara; de lejos, las piezas chicas pasan a la capa 1 (`Rig.setDetail`) y nunca hacen sombra.
  - Las matrices se actualizan una vez por cuadro (`scene.matrixWorldAutoUpdate = false`); lo estático está congelado (`matrixAutoUpdate = false`).
  - HUD y etiquetas escriben DOM solo si el valor cambió; nunca leer layout (`offsetWidth`, `clientWidth`) dentro del loop.
  - Medir con Chrome headless + GPU real + CPU 4× + celular apaisado (en vertical aparece el cartel de girar y el render baja a 4 fps a propósito).
  - Pendiente conocido (previo): en `ultra`, N8AO loguea advertencias WebGL de formato de textura al arrancar.
- Micrófono: una sola sesión de SpeechRecognition por turno (`src/voice/stt.js`), que se silencia en vez de cortarse, para no volver a pedir permiso.

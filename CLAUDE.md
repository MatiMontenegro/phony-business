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
- Estafas en tono de parodia: todos los datos son claramente falsos (SSN 000-, tarjetas 0000), sin instrucciones reales de estafa ni marcas reales; al final de cada llamada hay un repaso de las señales de alerta.
- Voces: TTS del navegador, prioriza las voces "Natural"/"Online". Nada de clonar voces de famosos.
- Micrófono: una sola sesión de SpeechRecognition por turno (`src/voice/stt.js`), que se silencia en vez de cortarse, para no volver a pedir permiso.

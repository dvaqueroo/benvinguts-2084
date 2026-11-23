# Benvinguts al 2084

Joc seriós estàtic, preparat per publicar-se a GitHub Pages. No cal compilar-lo ni instal·lar dependències.

Per provar-lo en local, executa `python3 -m http.server 8000` en aquesta carpeta i obre `http://localhost:8000/`.

Per publicar-lo a GitHub Pages, puja el contingut d'aquesta carpeta a la branca principal i configura Pages perquè serveixi la carpeta arrel (`/`). Les rutes són relatives.

## Estructura

```
index.html            entrada del joc
manifest.webmanifest  PWA
sw.js                 service worker (ús sense connexió; puja VERSION a cada canvi)
js/three.min.js       three.js 0.169
js/app.js             holograma (Canvas 2D de reserva + WebGL), orbe WebGL i joc
fonts/                Sansation i Unbounded (woff2)
img/                  logo, marca, raigs, icona i imatge fixa de la ciutat
```

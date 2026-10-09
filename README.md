# Winamp Offline — Ionic + Angular + Capacitor

Reproductor local para Android con estética inspirada en Winamp clásico y biblioteca moderna. No integra SDK publicitarios, analítica ni streaming.

## Funciones implementadas en esta versión

- Importación de archivos locales de audio (MP3, M4A, WAV, OGG, FLAC y AAC, según soporte del dispositivo).
- Guarda los archivos importados dentro de una biblioteca IndexedDB de la app. La lista y los archivos persisten al cerrar y volver a abrir la app.
- Reproducción, pausa, anterior/siguiente, barra de progreso, aleatorio y repetir.
- Eliminar canciones importadas de la biblioteca de la app.
- Integración inicial con `@jofr/capacitor-media-session` para notificación multimedia, acciones de reproducción y servicio en segundo plano en Android.
- Sin anuncios integrados por este proyecto. Esto no elimina anuncios que pudieran aparecer en el sistema operativo u otras aplicaciones.

## Requisitos

- Node.js 20 LTS recomendado (Node 18+ puede funcionar con estas versiones).
- Android Studio con Android SDK instalado.
- Java compatible con la versión de Android Gradle Plugin que cree Capacitor.

## Paso 1: instalar dependencias

Abre una terminal en la carpeta donde está `package.json`:

```bash
npm install
```

## Paso 2: probar la interfaz en el notebook

```bash
npm start
```

La versión web sirve para revisar la interfaz. La reproducción en segundo plano y la notificación multimedia se deben validar en un teléfono Android real.

## Paso 3: crear el proyecto Android (solo la primera vez)

```bash
npx cap add android
```

Si ya existe la carpeta `android`, no vuelvas a ejecutar `cap add android`.

## Paso 4: sincronizar y abrir Android Studio

```bash
npm run android:sync
npx cap open android
```

Cada vez que cambies el código web, ejecuta `npm run android:sync` antes de volver a probar en Android Studio.

## Paso 5: generar APK de prueba

En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**. Cuando termine, busca normalmente:

`android/app/build/outputs/apk/debug/app-debug.apk`

Transfiere ese APK al teléfono e instálalo. Para distribuir una versión final, genera un APK firmado desde **Build > Generate Signed Bundle / APK** y guarda la clave de firma en un lugar seguro.

## Prueba de funcionamiento offline

1. Instala la app en Android.
2. Importa un MP3 desde el selector de archivos del teléfono.
3. Reproduce la canción y espera unos segundos.
4. Cierra y vuelve a abrir la app: la canción debe seguir en la biblioteca.
5. Activa modo avión y vuelve a reproducir el archivo.
6. Con la música sonando, bloquea la pantalla y comprueba que continúa, y que aparecen controles en la notificación/pantalla bloqueada.

## Límites conocidos / siguientes mejoras

- La persistencia local guarda una copia de los archivos importados dentro del espacio privado de la app; no escanea automáticamente todas las carpetas de Android. Para añadir música nueva, usa **Importar**.
- La compatibilidad de formatos depende del decodificador del dispositivo.
- La integración de controles multimedia está conectada en el código, pero se debe comprobar en un dispositivo real con la versión concreta de Android. No se puede garantizar el comportamiento en segundo plano sin esa prueba.
- Aún no hay lectura de etiquetas ID3 (artista/álbum/caratula), ecualizador DSP real ni visualizador de audio real; las barras son decorativas.
- El paquete `@jofr/capacitor-media-session` tiene licencia GPL-3.0. Antes de publicar o redistribuir la app, revisa las obligaciones de esa licencia y si encaja con la forma en que quieres distribuir el proyecto.

## Publicación para descarga directa

Puedes alojar el APK firmado en tu sitio web HTTPS y ofrecer un enlace de descarga. No hace falta un servidor para la música: la biblioteca está guardada localmente en cada teléfono. El APK de depuración sirve para probar, pero para compartir con otras personas es preferible un APK firmado de versión final.

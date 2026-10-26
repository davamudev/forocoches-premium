# Changelog

Todos los cambios relevantes de Forocoches Premium. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [1.5.0] - 2026-10-27

### Añadido
- **Hilos por página** (experimental): nueva opción en Config (40/80/120/160) que carga los hilos de las páginas siguientes del foro en el mismo listado.
- **Comodín `*` en palabras clave**: `polit*` oculta "politica", "politicos"...
- **Logs de depuración** en la consola del navegador activando `localStorage.fc_debug = '1'`.

### Cambiado
- Las palabras clave coinciden por **palabra completa**: "culo" ya no oculta "vehículo" y las categorías predefinidas dejan de ocultar títulos que no tienen nada que ver.
- **Sincronizar** con la lista de ignorados de FC ahora **fusiona** las dos listas (añade los de FC y conserva los locales) en lugar de reemplazar la local.
- Con la lista de ignorados vacía, la sincronización automática se hace como mucho **una vez al día** en lugar de en cada carga de página.

### Corregido
- "Ignorar" en los diseños de PC añadía al usuario a **Contactos** en lugar de a Ignorados.
- Falso **OP** al entrar en otra página del hilo desde un enlace a un mensaje ("Ir al último mensaje", "Ver mensaje", después de responder).
- El OP dejaba de resaltarse en la página 2 y siguientes al alternar entre hilos: ahora se recuerda el OP de los últimos 200 hilos.
- Sincronizar con la sesión caducada o un error de red **borraba la lista local** de ignorados.
- "Ocultar hilos por autor" no detectaba autores con **ñ, acentos o espacios** en PC nuevo (desktop-v2).
- Quitar una palabra no volvía a mostrar el hilo hasta recargar, y el resumen "Hilos ocultos" perdía entradas.
- En listados sin hilos el script se ejecutaba en bucle (~7 veces por segundo) mostrando avisos.
- Importar un JSON mal formado podía romper el script o impedir guardar la configuración: ahora se valida y se rechaza entero si algo no cuadra.
- Notas de usuarios llamados como "constructor" o "\_\_proto\_\_" no se guardaban o devolvían valores incorrectos.
- Cada apertura del popup de notas dejaba un listener sin eliminar.
- Detección del diseño en el perfil y en la lista de ignorados de los diseños mobile-v2, desktop-v1 y desktop-v2.

### Seguridad
- El mensaje de la Pole se inserta en el editor **como texto**, nunca como HTML (podía venir de un fichero importado).

### Interno
- Tests automáticos (Vitest + jsdom) sobre los 16 HTML de referencia y CI en GitHub Actions.
- `npm run build` ejecuta antes el typecheck; Vite actualizado a 6.4.5.
- Release automática al hacer merge a `master` con la versión de `package.json`.

## [1.4.0] - 2026-07-04

### Corregido
- Panel alineado a la izquierda en todos los diseños (mobile-v1 heredaba `text-align:center` de la página).
- Eliminados contenedores vacíos de anuncios (`.cajasprin`) en desktop-v1 que quedaban visibles al desactivar el resaltado del OP.

## [1.3.0] - 2026-07-03

### Añadido
- **Resaltado de mensajes del OP**: fondo naranja y etiqueta "📌 OP" en los mensajes del autor del hilo. Compatible con los 4 diseños.
- **Grupos de resaltado** de hilos por usuario y por palabra, con color propio (pestaña Resaltado).
- Fondo blanco en las citas dentro de los mensajes del OP (mobile-v2, desktop-v1 y desktop-v2).

### Cambiado
- Pestañas del panel con el mismo ancho e indicador de pestaña activa.
- "Ocultar avisos" se integra en "Bloquear publicidad".
- Eliminada la pestaña Logs del panel.

### Corregido
- Esquinas del resaltado del OP en mobile-v1 y maquetación del resaltado en desktop-v1.
- El borde coral izquierdo de mobile-v2 interfería con el resaltado del OP.
- Icono de notas 1px más pequeño en mobile-v1 y mobile-v2.

## [1.2.0] - 2026-07-01

### Añadido
- **Notas por usuario**: notas personales desde los mensajes (junto a Denunciar) y desde el perfil, con editor en popup. Funciona en los 4 diseños.

### Corregido
- Ya no se oculta el aviso de cookies (`#infocookie`) al bloquear publicidad.

## [1.1.0] - 2026-06-30

### Añadido
- **Compatibilidad con PC**: soporte para PC antiguo (desktop-v1) y PC nuevo (desktop-v2), con detección automática de los 4 diseños del foro.
- **Bloqueo de publicidad**: optidigital, banners, skyscraper, promos, avisos y noticias promocionadas, contenedores vacíos y botón nativo de subir. Configurable desde el panel.
- Pole: scroll automático a la caja de respuesta.

### Corregido
- Pole en desktop-v2: el mensaje se escribe en el editor WYSIWYG sin mostrar el textarea oculto.
- Resumen de hilos ocultos en desktop-v2.

## [1.0.0] - 2026-06-24

Primera versión pública (solo diseños móviles).

### Añadido
- Ocultar hilos por palabras clave en el título y por autor, con resumen de hilos ocultados.
- Resaltar hilos sin respuestas con color configurable.
- Ocultar mensajes de usuarios ignorados, con placeholder opcional.
- Botón **Ignorar** en cada mensaje: añade al usuario a la lista local y a la de Forocoches.
- Botón **Pole**: busca el primer hilo sin respuestas (hasta 35 páginas) y envía el mensaje configurado.
- Panel flotante con pestañas Usuarios, Palabras (con categorías predefinidas), Config y Logs; exportar/importar.
- Botones flotantes de subir y bajar.

[1.5.0]: https://github.com/davamudev/forocoches-premium/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/davamudev/forocoches-premium/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/davamudev/forocoches-premium/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/davamudev/forocoches-premium/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/davamudev/forocoches-premium/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/davamudev/forocoches-premium/releases/tag/v1.0.0

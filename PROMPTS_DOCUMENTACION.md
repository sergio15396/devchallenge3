# Documentación Extensiva de Prompts - Penalty Arena

## Introducción

Este documento describe de forma detallada los prompts principales realizados con Copilot (el integrado en VSCode) durante el desarrollo del proyecto **Penalty Arena**, un juego multiplayer de penales en tiempo real. Se presenta la evolución del proyecto desde el enunciado inicial, pasando por la creación de un MVP, hasta la implementación de todas sus funcionalidades.

---

## Fase Previa: Creación del MVP (Minimum Viable Product)

### Objetivo:
Antes de realizar los prompts específicos, se creó un MVP básico del proyecto para identificar qué preguntas debían hacerse con mayor precisión. Este MVP incluía:

1. **Estructura básica del servidor:** Un servidor Node.js simple con rutas básicas
2. **HTML mínimo:** Una página simple con inputs para nombres y botones
3. **Lógica básica de turnos:** Sistema simple para dos jugadores
4. **Estilos esenciales:** CSS mínimo para que funcionara visualmente

### Propósito del MVP:
El MVP permitió:
- Identificar los componentes core necesarios (servidor, cliente, comunicación)
- Definir el flujo del juego con más claridad
- Reconocer problemas técnicos antes de implementar funcionalidades complejas
- Establecer prioridades en los prompts posteriores
- Experimentar con tecnologías (Socket.io vs. alternativas)

### Insight Obtenido:
El MVP reveló que la comunicación en tiempo real era crítica y que una arquitectura de eventos (Socket.io) era la mejor opción, en lugar de polling o peticiones HTTP.

---

## 1. Enunciado Original del Proyecto

**Objetivo:** Crear un juego básico de futbol, concretamente de lanzamiento de penales, para dos jugadores jugando desde máquinas diferentes.

### Reglas Principales:
- Cada jugador debe elegir:
  - **Cómo tirar:** altura (baja/media/alta) y dirección (izquierda/centro/derecha)
  - **Cómo parar:** altura (baja/media/alta) y dirección (izquierda/centro/derecha)

### Sistema de Puntuación:
- **0 puntos:** El portero no acierta ni la altura ni la dirección del tiro
- **1 punto:** El portero acierta solo la altura O la dirección
- **2 puntos:** El portero acierta tanto la altura como la dirección

### Requisitos Técnicos:
- Juego para dos jugadores simultáneamente
- Comunicación asíncrona entre máquinas
- Cálculo de puntuaciones de ambos porteros

---

## Con el MVP ya hecho, empezamos con los prompts para continuar el proyecto:

## Prompt 1: "Implementar servidor con Node.js, Express y Socket.io"

### Problema Estratégico:
El enunciado requería que dos jugadores en máquinas diferentes jugaran simultáneamente. Sin embargo, surgían preguntas críticas:
- **¿Cómo se comunican los clientes con el servidor?** (HTTP, WebSocket, etc.)
- **¿Cómo se sincronizan los movimientos de dos jugadores?**
- **¿Cómo se gestiona el estado de múltiples partidas simultáneas?**
- **¿Cómo se evita que dos jugadores comiencen una partida sin oponente?**

### Solución Aportada:
Implementación de una arquitectura basada en eventos con Socket.io:

**Componentes Core:**
1. **Servidor Express + Socket.io** para comunicación bidireccional en tiempo real
2. **Sistema de matchmaking** que mantiene una lista de jugadores esperando
3. **Gestión de partidas** mediante un Map que almacena estado de cada juego
4. **Eventos Socket.io** para sincronizar acciones entre clientes y servidor

**Lógica Implementada:**
- Cuando un jugador busca partida, se añade a `waitingPlayers`
- Si hay otro esperando, se crea una partida inmediatamente
- Si no hay, el jugador espera a que otro se conecte
- Cada partida tiene ID único y estado propio (ronda, movimientos, puntuaciones)
- El servidor calcula puntuaciones basadas en las reglas definidas

**Eventos Socket.io Definidos:**
- `findMatch`: Buscar oponente
- `makeMove`: Enviar tiro y parada
- `matchFound`: Notificar inicio de partida
- `roundResult`: Enviar resultado de ronda
- `gameEnd`: Notificar fin de partida
- `nextRound`: Avanzar a siguiente ronda

### Problemas Técnicos Resueltos:
- ✅ Comunicación en tiempo real entre jugadores
- ✅ Sincronización de estado de partida
- ✅ Gestión de múltiples partidas simultáneas
- ✅ Cálculo confiable de puntuaciones (en el servidor, no en cliente)
- ✅ Manejo de desconexiones de jugadores

### Por Qué Esta Solución:
Socket.io se eligió sobre alternativas porque:
- Proporciona comunicación **bidireccional** (servidor puede enviar datos sin que cliente pregunte)
- Es **escalable** (puede manejar miles de conexiones simultáneas)
- Tiene **fallback automático** a polling si WebSocket no está disponible
- Ofrece **eventos nombrados** (más legible que HTTP RESTful)
- Permite **salas** para aislar partidas

---

## Prompt 2: "Crear sistema de selección interactiva en portería (grid 3x3)"

### Problema Técnico:
Los jugadores necesitaban seleccionar altura y dirección del tiro/parada, pero ¿cómo hacerlo intuitivamente?
- Las opciones eran: dropdowns, radio buttons, o clickear directamente en la portería
- Los radio buttons serían tediosos (6 opciones por acción)
- Dropdowns no son intuitivos para un juego

### Decisión de Diseño:
Se eligió **hacer la portería interactiva** (clickeable) para mejor UX.

### Solución Aportada:
Sistema de grid 3x3 superpuesto sobre imagen de portería:

**Algoritmo de Detección:**
1. Colocar un `<div>` overlay invisible sobre la imagen
2. Al hacer clic, calcular posición relativa del mouse
3. Convertir píxeles a porcentajes (0-100%)
4. Mapear porcentajes a zonas:
   - Y < 33% = Altura "alta"
   - Y entre 33-67% = Altura "media"  
   - Y > 67% = Altura "baja"
   - (Mismo para X con dirección)
5. Crear 9 divs con data-attributes (data-height, data-direction)
6. Mostrar visualmente qué zona está seleccionada

**Características Implementadas:**
- Detección precisa de zona mediante cálculo de coordenadas
- Feedback visual inmediato (zona resaltada)
- Texto indicando selección ("Baja - Derecha")
- Funciones para convertir zona a número (1-9) para animaciones
- Posibilidad de cambiar selección antes de enviar movimiento

### Problemas Resueltos:
- ✅ UX intuitiva (usuarios entienden sin instrucciones)
- ✅ Cálculos precisos de zona
- ✅ Retroalimentación visual clara
- ✅ Compatibilidad con cualquier tamaño de imagen

### Desafíos Superados:
- **Responsive design:** Grid debe adaptarse a diferentes tamaños de pantalla
- **Precisión:** Usar `getBoundingClientRect()` para coordenadas exactas
- **Performance:** Crear overlay una sola vez, no en cada clic

---

## Prompt 3: "Implementar animaciones de resultado con el portero"

### Problema de Comunicación Visual:
Cuando se calcula el resultado, ¿cómo comunica el juego qué pasó?
- ¿Mostrar solo números?
- ¿Mostrar dónde fue el tiro vs. dónde paró?
- ¿Cómo hacer evidente si fue gol o parada?

### Solución Aportada:
Sistema de animaciones CSS que visualiza el resultado:

**Componentes:**
1. **Sprites del portero:** 9 imágenes (p1.png hasta p9.png) mostrando portero en cada zona
2. **Animación de pelota:** Imagen que se mueve desde centro hacia zona de tiro
3. **Cambio de portero:** Portero se mueve desde p5 (centro) hacia zona donde paró
4. **Keyframes CSS:** Animaciones de 3 segundos con transiciones suaves

**Lógica:**
- Zona de tiro determina dónde va la pelota
- Zona de parada determina dónde se mueve el portero
- Si ambas zonas coinciden → parada efectiva (visual clara)
- Si no coinciden → gol evidente (pelota pasa al lado del portero)

**Ventajas:**
- Retroalimentación **visual inmediata**
- Jugadores entienden qué pasó sin leer texto
- **Atractivo visualmente** (gamification)
- Permite **reproducción de animación** sin recalcular

### Problemas Técnicos Resueltos:
- ✅ Cálculo correcto de posiciones basado en zonas
- ✅ Animaciones sincronizadas
- ✅ Performance (usar CSS, no JavaScript)
- ✅ Reproducción sin recargar datos

### Cálculos Implementados:
- `getZoneNumber()`: Convierte (altura, dirección) a número 1-9
- `getZonePosition()`: Calcula posición % de zona para pelota
- `getPorterPosition()`: Calcula posición % de portero (con escala reducida)
- `getZoneAnimationClass()`: Selecciona animación CSS según zona

---

## Prompt 4: "Sistema de una ronda única con comunicación asíncrona"

### Problema de Estructura de Juego:
El enunciado original requería **comunicación asíncrona** entre jugadores, lo que planteaba un desafío arquitectónico:
- ¿Cómo estructurar una partida competitiva?
- ¿Múltiples rondas o una sola ronda?
- ¿Cómo cumplir con el requisito de asincronía?

### Decisión Crítica: Una Sola Ronda

**Problema con múltiples rondas (5 rondas):**
Inicialmente se implementó un sistema de 5 rondas, pero se descubrió un problema fundamental:
- **Espera síncrona:** El jugador tenía que esperar al rival entre cada ronda
- **No asíncrono:** No podía hacer todos sus tiros y paradas a la vez
- **Violación del requisito:** Esto no cumplía con el requisito de "Comunicación asíncrona" del proyecto

**Solución Final: Una sola ronda**
Se cambió a **1 ronda única** donde:
- Ambos jugadores pueden hacer su movimiento (tiro + parada) **simultáneamente**
- No hay espera entre rondas
- La comunicación es verdaderamente **asíncrona**: cada jugador envía su movimiento cuando está listo
- El servidor espera a recibir ambos movimientos y luego calcula el resultado

### Solución Aportada:
Estructura de partida con **una sola ronda**:

**En el Servidor:**
- Array `game.moves[]` almacena movimientos de la ronda
- Variables `currentRound` y `maxRounds` (maxRounds = 1 por defecto)
- Puntuaciones se calculan una vez recibidos ambos movimientos
- Al recibir ambos movimientos, se determina ganador y emite `gameEnd`

**En el Cliente:**
- Interfaz muestra "Ronda 1 de 1"
- Ambos jugadores pueden seleccionar tiro y parada simultáneamente
- No hay espera entre rondas: comunicación completamente asíncrona
- Pantalla final muestra ganador y puntuaciones

**Flujo Completo:**
1. Ambos jugadores hacen tiro+parada **simultáneamente** (sin esperar al otro)
2. Cuando ambos han enviado, el servidor calcula puntuación
3. Se muestra resultado y ganador

### Problemas Resueltos:
- ✅ Comunicación verdaderamente asíncrona (requisito del proyecto)
- ✅ Jugadores no tienen que esperar entre rondas
- ✅ Movimientos simultáneos permitidos
- ✅ Determinación inequívoca de ganador
- ✅ Cumplimiento del requisito de "Comunicación asíncrona"

### Desafío Importante:
**Sincronización asíncrona:** El servidor debe esperar a que AMBOS jugadores envíen movimientos antes de procesar, pero cada jugador puede enviar cuando quiera (asíncrono). Se implementó un sistema de validación donde:
- Cuando Jugador 1 envía movimiento, se almacena (no se procesa aún)
- Cuando Jugador 2 envía movimiento, se activa cálculo inmediatamente
- Si un jugador intenta enviar dos movimientos, se rechaza
- **Clave:** Ambos pueden enviar en cualquier momento, sin esperar turnos

---

## Prompt 5: "Sistema de desempate (Tiebreaker) dinámico"

### Problema Estratégico de Juego:
¿Qué pasa si la partida de 1 ronda termina en empate?
- Opción A: Declarar empate (poco satisfactorio)
- Opción B: Automáticamente añadir ronda extra
- Opción C: Permitir a jugadores optar por desempate

### Solución Aportada:
Sistema de desempate opcional con sincronización:

**Arquitectura:**
1. Si la ronda termina en empate, mostrar botón "Desempatar"
2. Cada jugador puede solicitar desempate independientemente
3. Ambas solicitudes se guardan en `game.tiebreakerRequests` (Set)
4. Cuando ambos soliciten, se añade una ronda extra a `maxRounds` (de 1 a 2)
5. Array de movimientos se expande dinámicamente

**Flujos Posibles:**
- Jugador A solicita, Jugador B rechaza → Se muestra empate
- Ambos solicitan → Ronda de desempate obligatoria (ronda 2)
- Nadie solicita → Empate definitivo

**Sincronización:**
- Set `tiebreakerRequests` previene duplicados
- Timeouts se cancelan cuando se detecta desempate
- UI se actualiza automáticamente en ambos clientes

**Sistema de Timeouts Inteligente:**
- **Si hay ganador:** La partida se elimina automáticamente después de **30 segundos** de finalizar
- **Si hay empate:** La partida se elimina automáticamente después de **2 minutos** de finalizar (para dar tiempo suficiente a desempatar)
- **Al solicitar desempate:** El timeout de eliminación se cancela automáticamente (incluso si solo un jugador lo solicita)
- **Timeout de desempate:** Si solo un jugador solicita desempate, hay un timeout de **2 minutos** para que el otro jugador acepte. Si no acepta, se cancela la solicitud y se programa la eliminación de la partida

### Problemas Técnicos Resueltos:
- ✅ Manejo dinámico de rondas extra
- ✅ Sincronización de solicitudes entre jugadores
- ✅ Prevención de duplicados
- ✅ Cancelación inteligente de timeouts pendientes
- ✅ UI consistente en ambos clientes
- ✅ Gestión de timeouts diferenciada según resultado (ganador vs. empate)
- ✅ Protección contra eliminación prematura cuando se solicita desempate

### Por Qué Esta Aproximación:
Se eligió el sistema optional (en lugar de automático) porque:
- Respeta la voluntad de los jugadores
- Permite empates "válidos" si ambos quieren
- Añade elemento estratégico (¿arriesgar en desempate?)

---

## Prompt 6: "Sistema de buscar nueva partida"

### Problema Práctico:
Después de que una partida termina, los jugadores querían jugar otra, pero:
- Necesidad de resetear estado completamente
- Buscar un nuevo oponente (no necesariamente el mismo)
- Limpiar todos los resultados de la partida anterior

### Solución Aportada:
Sistema de "Buscar partida" que resetea todo y busca un nuevo oponente:

**Implementación:**
1. Botón "Buscar partida" aparece en pantalla final
2. Resetea completamente el estado de la partida anterior:
   - `currentGameId` a null
   - `currentRound` a 1
   - Puntuaciones a 0
   - Estadísticas (`statsUI`) a valores iniciales
   - Limpia animaciones y resultados visuales
3. Desconecta y reconecta el socket para buscar nueva partida
4. Emite `findMatch` con el mismo nombre de jugador
5. Transición a pantalla de espera para buscar nuevo oponente

**Limpieza Completa:**
- Se resetean todos los marcadores en el DOM
- Se ocultan resultados de ronda y animaciones
- Se limpian selecciones de zonas
- Se ocultan botones de desempate y estadísticas
- Se resetean datos de animación pendientes

### Problemas Técnicos Resueltos:
- ✅ Reset completo del estado de partida
- ✅ Búsqueda de nuevo oponente (no necesariamente el mismo)
- ✅ Limpieza exhaustiva de UI y estado
- ✅ Reconexión de socket para nueva partida
- ✅ Transición suave a pantalla de espera

### Decisión de Diseño:
Se eligió buscar nueva partida (en lugar de revancha con el mismo oponente) porque:
- Permite jugar con diferentes oponentes
- Simplifica el flujo (no requiere sincronización de confirmación dual)
- Resetea completamente el estado, evitando problemas de estado residual

---

## Prompt 7: "Modales informativos (puntuación y estadísticas)"

### Problema de Experiencia del Usuario:
Los jugadores necesitaban entender:
1. **Reglas de puntuación:** ¿Por qué 0, 1 o 2 puntos?
2. **Estadísticas personales:** ¿Cómo me ha ido en la partida?

### Solución Aportada:
Dos modales educativos:

**Modal de Puntuación:**
- Accesible desde pantalla de juego
- Muestra las 3 reglas claramente
- Cierre por botón X, clic fuera, o ESC
- No interrumpe el juego (overlay)

**Modal de Estadísticas:**
- Accesible desde pantalla final
- Muestra estadísticas de ambos jugadores:
  - Aciertos completos (2 puntos)
  - Aciertos parciales (1 punto)
  - Fallos (0 puntos)
  - Porcentaje de acierto: `(full + partial) / attempts * 100`
- Display en grid de dos columnas

**Tracking de Estadísticas:**
- Objeto `statsUI` acumula datos durante la partida
- En cada ronda, se calcula tipo de acierto:
  - `getHitType()` compara zona de tiro vs. zona de parada
  - Incrementa contador correspondiente (full, partial, miss)
- Se calcula porcentaje al final de partida

### Problemas Resueltos:
- ✅ Educación del usuario sobre reglas
- ✅ Feedback de desempeño personal
- ✅ Tracking preciso de estadísticas
- ✅ Cálculos correctos de porcentaje
- ✅ UI clara y legible

### Beneficio Psicológico:
Las estadísticas permiten:
- Jugadores ven progreso/mejora
- Motivación para buscar nuevas partidas
- Comparación con oponente

---

## Prompt 8: "Navegación de pantallas con sincronización de estado visual"

### Problema de Arquitectura:
El proyecto tiene 4 pantallas diferentes. ¿Cómo manejar transiciones?
- Mostrar/ocultar elementos (messy)
- Crear elementos nuevos (ineficiente)
- O un sistema centralizado de navegación

### Solución Aportada:
Función centralizada `showScreen()` que maneja:

**Lógica:**
1. Oculta TODAS las pantallas (remove clase `.active`)
2. Muestra SOLO la nueva (add clase `.active`)
3. Actualiza clase del body: `startScreen-active`, `gameScreen-active`, etc.
4. Limpia estados específicos de pantalla (remove animaciones, resultados)

**Ventajas:**
- **Single source of truth** para estado de navegación
- **Consistencia:** Todos los cambios de pantalla usan misma función
- **Facilita debugging:** Un lugar para añadir logs
- **CSS reactivo:** Estilos condicionados por clase de body

**Uso en Socket.io:**
- `socket.on('matchFound')` → `showScreen('gameScreen')`
- `socket.on('gameEnd')` → `showScreen('endScreen')`
- Botón "Salir" → `showScreen('startScreen')`

### Problemas Resueltos:
- ✅ Transiciones claras entre pantallas
- ✅ Estado visual sincronizado
- ✅ Fácil de mantener y debuggear
- ✅ Extensible para nuevas pantallas

---

## Prompt 9: "Accesibilidad con teclado - Juego completamente navegable sin mouse"

### Problema de Accesibilidad:
El juego inicialmente solo era accesible mediante clics del mouse, lo que excluía a usuarios que:
- Prefieren usar teclado por comodidad o eficiencia
- Tienen limitaciones motoras que dificultan el uso del mouse
- Usan lectores de pantalla u otras tecnologías asistivas
- Navegan en dispositivos sin mouse o touchpad

### Solución Aportada:
Sistema completo de accesibilidad con teclado que permite jugar sin usar el mouse:

**Implementación de Navegación por Teclado:**

1. **Zonas Focusables:**
   - Cada zona de la portería tiene `tabindex="0"` para ser navegable con Tab
   - Atributo `role="button"` para lectores de pantalla
   - `aria-label` descriptivo que indica el tipo (Tiro/Parada) y posición (Altura - Dirección)

2. **Navegación con Teclas:**
   - **Tab**: Navegar entre zonas en orden lógico (de izquierda a derecha, de arriba a abajo)
   - **Flechas (↑↓←→)**: Navegar entre zonas adyacentes
   - **Home/End**: Ir al inicio/fin de la fila actual
   - **Enter/Espacio**: Seleccionar la zona actual

3. **Función `handleZoneKeydown`:**
   - Maneja todos los eventos de teclado
   - Previene comportamiento por defecto de teclas de navegación
   - Calcula la zona adyacente según la tecla presionada
   - Mueve el foco automáticamente a la nueva zona
   - Llama a `handleZoneClick` cuando se presiona Enter/Espacio

4. **Estilos Visuales de Foco:**
   - Outline azul visible cuando una zona tiene foco
   - Resaltado de zona con foco (background y border)
   - Estilos diferentes para zona con foco vs. zona seleccionada
   - Compatible con preferencias de accesibilidad del sistema

**Características de Accesibilidad:**
- ✅ Navegación completa sin mouse
- ✅ Feedback visual claro del foco
- ✅ Compatible con lectores de pantalla (aria-labels descriptivos)
- ✅ Mantiene funcionalidad de mouse (no rompe UX existente)
- ✅ Orden lógico de navegación con Tab
- ✅ Atajos de teclado intuitivos (flechas para movimiento)

### Problemas Técnicos Resueltos:
- ✅ Cálculo correcto de zonas adyacentes para navegación con flechas
- ✅ Manejo de límites (no salir del grid 3x3)
- ✅ Sincronización entre foco visual y selección
- ✅ Limpieza de foco al resetear selecciones
- ✅ Prevención de comportamientos por defecto del navegador

### Beneficios de Accesibilidad:
- **Inclusividad:** El juego es accesible para más usuarios
- **Eficiencia:** Usuarios avanzados pueden jugar más rápido con teclado
- **Compatibilidad:** Funciona en dispositivos sin mouse o touchpad
- **Estándares:** Cumple con pautas WCAG para accesibilidad web
- **Flexibilidad:** Los usuarios pueden elegir su método de interacción preferido

### Implementación Técnica:
```javascript
// Cada zona es focusable
zone.setAttribute('tabindex', '0');
zone.setAttribute('role', 'button');
zone.setAttribute('aria-label', 'Tiro: Alta Izquierda. Presiona Enter o Espacio para seleccionar.');

// Navegación con teclado
zone.addEventListener('keydown', (ev) => {
    handleZoneKeydown(ev, zone, overlay, type);
});
```

**CSS para foco visual:**
```css
.zone-overlay .zone:focus {
    outline: 3px solid var(--secondary-color);
    outline-offset: 2px;
    background: rgba(52,152,219,0.3);
    border-color: var(--secondary-color);
    box-shadow: 0 0 12px rgba(52,152,219,0.5);
}
```

### Impacto en la Experiencia de Usuario:
Esta implementación transforma el juego de ser exclusivamente dependiente del mouse a ser completamente accesible con teclado, cumpliendo con estándares modernos de accesibilidad web y permitiendo que más usuarios puedan disfrutar del juego.

---

## Nota Final: Prompts secundarios y su rol en la solución

Durante el desarrollo, además de los nueve prompts principales documentados arriba, emergieron numerosos prompts secundarios. Estos no eran simples "ajustes estéticos": en muchos casos fueron preguntas puntuales, comprobaciones, depuraciones y micro-decisiones que permitieron que las soluciones principales funcionaran de forma robusta en escenarios reales.

A continuación se desarrolla en profundidad cómo surgieron esos prompts secundarios, qué tipos de problemas resolvían, ejemplos concretos asociados a cada prompt principal y buenas prácticas aprendidas.

1) ¿Por qué aparecen prompts secundarios?
- Los prompts principales definen la arquitectura y la funcionalidad core, pero la implementación práctica siempre revela casos límite, incompatibilidades y detalles de UX que no se ven hasta que se prueban. Los prompts secundarios abordan esos puntos concretos, por ejemplo validar inputs, manejar errores de red, ajustar tiempos de animación o mejorar accesibilidad.

2) Tipos comunes de prompts secundarios
- **Robustez y errores:** manejo de desconexiones, timeouts, reintentos y limpieza de partidas huérfanas.
- **Sincronización fina:** asegurar que el servidor y ambos clientes tengan el mismo estado frente a condiciones de carrera (por ejemplo, evitar doble envío de movimiento).
- **Performance y optimización:** reducir repaints/reflows en animaciones, lazy-loading de sprites, optimizar listeners.
- **UX y accesibilidad:** añadir feedback visual, soporte para teclado, mejorar contrastes, y cierres alternativos de modales (ESC / clic fuera).
- **Compatibilidad:** adaptar overlay de 3x3 a la imagen.
- **Instrumentación y logs:** añadir mensajes de log y métricas para depurar y entender patrones de fallo.

3) Ejemplos concretos (por prompt principal)
- **Prompt 1 (Servidor / Socket.io):** prompts secundarios para:
  - manejar desconexiones abruptas (emitir `opponentDisconnected` y limpiar `Map` de partidas);
  - prevenir partidas huérfanas (timeout para jugadores que nunca completan conexión);
  - validar datos entrantes (`makeMove`) y rechazar formatos inválidos.
  Beneficio: estas pequeñas comprobaciones evitaron corrupciones de estado y partidas bloqueadas.

- **Prompt 2 (Grid 3x3):** prompts secundarios para:
  - ajustar el algoritmo de cálculo a `getBoundingClientRect()` para distintos contenedores;
  - añadir soporte para controles por teclado para accesibilidad;
  - mejorar la detección en pantallas táctiles (tolerancia de presión y tamaño mínimo de hit area).
  Beneficio: incrementó la precisión del input y la compatibilidad con dispositivos móviles.

- **Prompt 3 (Animaciones):** prompts secundarios para:
  - sincronizar tiempos entre CSS keyframes y eventos JS (callbacks al terminar la animación);
  - ofrecer fallback visual si la sprite no carga (use de CSS shapes o icono simple);
  - reducir tamaño de sprites y usar `will-change` para mejorar performance.
  Beneficio: animaciones más suaves, menos flicker y menor latencia perceptiva.

- **Prompt 4 (Rondas y puntuación):** prompts secundarios para:
  - evitar doble conteo si un cliente reenvía movimiento por error;
  - bloquear envío hasta que la ronda esté activa;
  - persistencia temporal del estado en memoria para evitar pérdida en reinicios cortos.
  Beneficio: puntuaciones consistentes y eliminación de discrepancias entre clientes.

- **Prompt 5 (Desempate):** prompts secundarios para:
  - temporizadores de confirmación de desempate (para no esperar indefinidamente);
  - mensajes claros en UI sobre el estado de la petición de desempate;
  - manejo de casos donde un jugador pide desempate y luego se desconecta.
  Beneficio: flujo de desempate claro y tolerantemente sincronizado.

- **Prompt 6 (Buscar partida):** prompts secundarios para:
  - cancelar timeouts pendientes que podrían interferir con la nueva búsqueda;
  - reestablecer correctamente el estado del cliente (limpiar animaciones y listeners temporales);
  - limpiar completamente estadísticas y resultados de la partida anterior;
  - asegurar que el socket se reconecte correctamente para buscar nuevo oponente.
  Beneficio: transición fiable a una nueva búsqueda de partida sin efectos colaterales.

- **Prompt 7 (Modales):** prompts secundarios para:
  - accesibilidad (foco inicial en modal, restauración del foco al cerrarlo);
  - evitar que los modales bloqueen eventos de juego si se usan en pantalla activa;
  - animaciones de apertura/cierre con `prefers-reduced-motion` respetado.
  Beneficio: modales usables y accesibles sin romper la experiencia de juego.

- **Prompt 8 (Navegación):** prompts secundarios para:
  - limpiar clases residuales en el `body` que afectaban estilos globales;
  - coordinar el estado visual con animaciones que debían reiniciarse al mostrar una pantalla;
  - condicionar la visibilidad del `footer` según clase del `body` de forma centralizada.
  Beneficio: navegación predecible y sin fugas de estilos.

4) Cómo los prompts secundarios ayudan a converger hacia la solución
- Iteración incremental: cada prompt secundario es típicamente una pequeña hipótesis—se prueba, se valida y se integra. Este flujo de micro-iteraciones permite probar asumciones rápidamente.
- Aislamiento de fallos: al dividir problemas en prompts secundarios más pequeños se reduce la superficie de fallo y es más fácil identificar la causa raíz.
- Documentación implícita: muchos prompts secundarios sirven como recordatorio técnico de por qué se tomó una decisión (ej. limpiar timeouts), lo cual es valioso para futuros mantenedores.

5) Recomendaciones y buenas prácticas (lecciones aprendidas)
- Mantener el servidor como fuente de verdad: validar todo lo que llegue del cliente.
- Centralizar limpieza de recursos: una función que cancele timeouts, listeners y estados temporales simplifica la búsqueda de nueva partida.

6) Conclusión 
Los prompts secundarios complementan a los prompts principales y transforman una solución válida en una solución robusta, usable y mantenible. Mantenerlos documentados ayuda a entender por qué existen ciertas comprobaciones, timeouts o ajustes, y acelera el trabajo futuro sobre el proyecto.

---

## Síntesis de Soluciones Core

| Componente | Reto Principal | Solución | Prompt |
|-----------|----------------|----------|--------|
| **Comunicación** | Dos máquinas diferentes | Socket.io eventos | #1 |
| **Selección** | UX intuitiva para movimientos | Grid 3x3 interactivo | #2 |
| **Visualización** | Comunicar resultado claramente | Animaciones con sprites | #3 |
| **Estructura** | Partida competitiva con comunicación asíncrona | Sistema de una ronda única (movimientos simultáneos) | #4 |
| **Empates** | ¿Qué pasa con puntuaciones iguales? | Desempate dinámico opcional | #5 |
| **Buscar partida** | Jugar otra con nuevo oponente | Reset completo y búsqueda | #6 |
| **Educación** | Usuarios entienden reglas/progreso | Modales informativos | #7 |
| **Navegación** | Múltiples pantallas | Función centralizada showScreen() | #8 |
| **Accesibilidad** | Juego accesible para todos | Navegación completa con teclado | #9 |

---

## Evolución Metodológica

### Fase 1: Arquitectura Base (Prompts #1-2)
- Definición de protocolo de comunicación
- UX de selección de movimientos
- **Decisión crítica:** Socket.io como backbone del proyecto

### Fase 2: Experiencia Visual (Prompts #3-4)
- Retroalimentación visual inmediata
- Estructura de juego competitiva
- **Decisión crítica:** Animaciones con sprites para claridad
- **Cambio arquitectónico importante:** De 5 rondas a 1 ronda para cumplir requisito de comunicación asíncrona

### Fase 3: Profundidad de Juego (Prompts #5-6)
- Manejo de casos especiales (empates)
- Búsqueda de nueva partida como feature core
- **Decisión crítica:** Reset completo y búsqueda de nuevo oponente

### Fase 4: Pulido y UX (Prompts #7-9)
- Educación del usuario
- Consistencia de navegación
- Accesibilidad completa con teclado
- **Decisión crítica:** Centralización de lógica de UI y accesibilidad inclusiva

---

## Problemas Críticos que Se Evitaron

### 1. Race Conditions en Rondas
**Problema:** ¿Qué si un jugador envía movimiento dos veces?
**Solución:** Validar que ambos jugadores envíen exactamente una vez por ronda

### 2. Estado Inconsistente entre Clientes
**Problema:** ¿Qué si servidor y cliente desincronizados?
**Solución:** Servidor es fuente de verdad (calcula puntuaciones, no cliente)

### 3. Timeouts Huérfanos y Gestión Inteligente
**Problema:** ¿Qué si se busca nueva partida pero hay timeout de fin pendiente? ¿Qué pasa si un jugador tarda en desempatar?
**Solución:** 
- Cancelar TODOS los timeouts antes de buscar nueva partida
- Sistema de timeouts diferenciado: **30 segundos** si hay ganador, **2 minutos** si hay empate (para dar tiempo a desempatar)
- Cancelación automática del timeout de eliminación cuando se solicita desempate
- Timeout de **2 minutos** para aceptación de desempate si solo un jugador lo solicita

### 4. Pérdida de Conexión
**Problema:** ¿Qué si un jugador se desconecta a mitad de partida?
**Solución:** Emitir evento `opponentDisconnected` para cerrar partida en otro cliente

---

## Conclusiones

El desarrollo de Penalty Arena se basó en:

1. **MVP como brújula:** Identificar problemas antes de soluciones
2. **Prompts estratégicos:** Cada prompt aborda un componente major, no tweaks visuales
3. **Decisiones arquitectónicas conscientes:** Socket.io, servidor como autoridad, funciones centralizadas
4. **Sincronización como tema transversal:** Desempate y navegación usan patrones similares; búsqueda de partida requiere reset completo
5. **Simplicidad deliberada:** 3x3 grid es más simple que dropdowns pero más efectivo
6. **Cumplimiento de requisitos:** Cambio de 5 rondas a 1 ronda para garantizar comunicación asíncrona verdadera
7. **Accesibilidad inclusiva:** El juego es completamente jugable con teclado, cumpliendo estándares WCAG

**Lección importante aprendida:** Inicialmente se implementó un sistema de 5 rondas, pero se descubrió que esto violaba el requisito fundamental de "Comunicación asíncrona" del proyecto, ya que los jugadores tenían que esperar al rival entre cada ronda. El cambio a una sola ronda permitió que ambos jugadores enviaran sus movimientos simultáneamente, cumpliendo verdaderamente con el requisito de asincronía.

El resultado es un juego con arquitectura sólida, escalable, y mantenible, con potencial para expansiones futuras (rangos de jugadores, estadísticas persistentes, más modos, etc.).

## Mejoras

En un futuro se podría implementar:

1. **Personalización de portero/tirador:** Cambiar color o añadir equipamiento deportivo diferente customizable
2. **Implementar torneos o leaderboards:** Hacer el juego más competitivo para los jugadores exigentes

# Sobre la IA

Sorprendentemente, la IA ha dado unos muy buenos resultados con los prompts hechos a partir del MVP, con los prompts secundarios mencionados se acabó de completar el proyecto. A veces duplicaba código, sobretodo en el CSS, en ese aspecto hemos decidido limpiar y ordenar los ficheros manualmente, probar y modificar en la consola del navegador inspeccionando los elementos hasta encontrar los errores y utilizar los logs para saber dónde fallaba el programa. 

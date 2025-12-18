# ⚽ Juego de Penaltis - Fútbol

Un juego de penaltis interactivo para dos jugadores en el que cada jugador debe elegir cómo chutar y cómo detener el penal del contrario.

## 📋 Reglas del Juego

Cada jugador debe elegir:
- **Para chutar**: Altura (baja/mediana/alta) y Dirección (izquierda/centro/derecha)
- **Para parar**: Altura (baja/mediana/alta) y Dirección (izquierda/centro/derecha)

### Sistema de puntuación

- **0 puntos**: Si el portero no acierta ni la altura ni la dirección del tiro contrario
- **1 punto**: Si el portero acierta sólo la altura O sólo la dirección
- **2 puntos**: Si el portero acierta tanto la altura como la dirección

El jugador con más puntos gana la partida.

Abre el navegador en `https://devchallenge3.joanysergio.xyz/`

## 🎮 Cómo Jugar

1. Introduce tu nombre y haz clic en "Buscar partida"
2. Espera a que se encuentre un oponente
3. En cada ronda, selecciona:
   - Cómo chutarás (altura y dirección)
   - Cómo intentarás parar el penal del contrario (altura y dirección)
4. Envía tu movimiento y espera el resultado
5. Después de 1 ronda, se mostrará el ganador (o más en caso de empate si se decide continuar)

## 🛠️ Tecnologías

- **Backend**: Node.js con Express y Socket.io
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Comunicación**: WebSocket (Socket.io) para comunicación en tiempo real

## 📁 Estructura del Proyecto

```
devchallenge3heh/
├── server.js                 # Servidor Node.js con la lógica del juego
├── package.json              # Dependencias del proyecto
├── public/
│   ├── index.html            # Interfaz de usuario
│   ├── styles.css            # Estilos CSS
│   └── app.js                # Lógica del cliente
├── PROMPTS_DOCUMENTACION.md  # Documentación del proyecto
└── README.md                 # Este archivo
```

## ✨ Características

- ✅ Comunicación en tiempo real entre jugadores
- ✅ Interfaz moderna y responsive
- ✅ Diseño atractivo con animaciones
- ✅ Accesibilidad por teclado totalmente funcional
- ✅ Gestión de errores y desconexiones
- ✅ Sistema de matchmaking automático

## 📝 Notas

- El servidor gestiona automáticamente las partidas y la sincronización entre jugadores
- **Gestión de timeouts:**
  - Si hay ganador: Las partidas se limpian automáticamente **30 segundos** después de finalizar
  - Si hay empate: Las partidas se limpian automáticamente **2 minutos** después de finalizar (para dar tiempo a desempatar)
  - Si se solicita desempate, el timeout de eliminación se cancela automáticamente
  - Si solo un jugador solicita desempate, hay un timeout de **2 minutos** para que el otro jugador acepte
- Si un jugador se desconecta, el otro jugador será notificado

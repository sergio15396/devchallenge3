/* ==================== 1. INICIALIZACIÓN Y VARIABLES GLOBALES ==================== */

const socket = io();

// Estado global de la partida
let currentGameId = null;
let isPlayer1 = false;
let playerName = "";
let currentRound = 1;
let maxRounds = 1;
let serverPlayer1Name = "";
let serverPlayer2Name = "";
let exitedManually = false;

// Variables de control de animaciones
let waitingForAnimations = false;
let pendingNextRound = null;
let currentAnimationData = null;
let pendingGameEndData = null;
let awaitingFinalScreen = false;

// Estadísticas acumuladas
let statsUI = {
    player1: { full: 0, partial: 0, miss: 0, attempts: 0 },
    player2: { full: 0, partial: 0, miss: 0, attempts: 0 }
};

/* ==================== 2. ELEMENTOS DEL DOM ==================== */

// Pantallas principales
const startScreen = document.getElementById("startScreen");
const waitingScreen = document.getElementById("waitingScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");

// Controles generales
const playerNameInput = document.getElementById("playerName");
const findMatchBtn = document.getElementById("findMatchBtn");
const cancelSearchBtn = document.getElementById("cancelSearchBtn");
const submitMoveBtn = document.getElementById("submitMoveBtn");
const notification = document.getElementById("notification");

// Pantalla de espera y resultados
const waitingOpponent = document.getElementById("waitingOpponent");
const roundResult = document.getElementById("roundResult");

// Botones de acción
const playAgainBtn = document.getElementById("playAgainBtn");
const tiebreakerBtn = document.getElementById("tiebreakerBtn");
const continueRoundBtn = document.getElementById("continueRoundBtn");
const replayAnimationBtn = document.getElementById("replayAnimationBtn");
const exitGameBtn = document.getElementById("exitGameBtn");

// Modales
const scoringInfoBtn = document.getElementById("scoringInfoBtn");
const scoringModal = document.getElementById("scoringModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const statsModal = document.getElementById("statsModal");
const viewStatsBtn = document.getElementById("viewStatsBtn");
const closeStatsModalBtn = document.getElementById("closeStatsModalBtn");
const closeStatsBtn = document.getElementById("closeStatsBtn");

// Elementos de portería
const shootGoal = document.getElementById("shootGoal");
const saveGoal = document.getElementById("saveGoal");
const shootHeightInput = document.getElementById("shootHeight");
const shootDirectionInput = document.getElementById("shootDirection");
const saveHeightInput = document.getElementById("saveHeight");
const saveDirectionInput = document.getElementById("saveDirection");
const shootSelectedText = document.getElementById("shootSelectedText");
const saveSelectedText = document.getElementById("saveSelectedText");
const shootZoneOverlay = document.getElementById("shootZoneOverlay");
const saveZoneOverlay = document.getElementById("saveZoneOverlay");

// Variables para la selección de zonas
let selectedShootZone = null;
let selectedSaveZone = null;

/* ==================== 3. LISTENERS DE EVENTOS ==================== */

// Botones principales
findMatchBtn.addEventListener("click", findMatch);
cancelSearchBtn.addEventListener("click", cancelSearch);
submitMoveBtn.addEventListener("click", submitMove);

// Botones de acción en pantalla final
playAgainBtn.addEventListener("click", () => {
    playAgainBtn.disabled = true;
    
    // Resetear todos los resultados de la partida anterior
    statsUI = {
        player1: { full: 0, partial: 0, miss: 0, attempts: 0 },
        player2: { full: 0, partial: 0, miss: 0, attempts: 0 }
    };
    
    currentAnimationData = null;
    pendingGameEndData = null;
    awaitingFinalScreen = false;
    
    // Limpiar el estado de la partida anterior
    currentGameId = null;
    currentRound = 1;
    exitedManually = false;
    
    // Resetear marcadores en el DOM
    resetScoreDisplays(currentRound);
    
    // Ocultar resultados de ronda
    if (roundResult) roundResult.classList.add("hidden");
    if (waitingOpponent) waitingOpponent.classList.add("hidden");
    
    // Limpiar animaciones
    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const zoneIndicator1 = document.getElementById('zoneIndicator1');
    const zoneIndicator2 = document.getElementById('zoneIndicator2');
    if (ball1) ball1.style.opacity = '0';
    if (ball2) ball2.style.opacity = '0';
    if (zoneIndicator1) zoneIndicator1.style.opacity = '0';
    if (zoneIndicator2) zoneIndicator2.style.opacity = '0';
    
    // Limpiar clases de resultados
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }
    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }
    
    // Limpiar selecciones
    clearGoalSelections();
    
    // Ocultar botón de desempate y estadísticas al buscar nueva partida
    if (tiebreakerBtn) {
        tiebreakerBtn.classList.add("hidden");
        tiebreakerBtn.disabled = false;
    }
    const finalStatsEl = document.getElementById('finalStats');
    const viewStatsBtnEl = document.getElementById('viewStatsBtn');
    if (finalStatsEl) finalStatsEl.classList.add('hidden');
    if (viewStatsBtnEl) viewStatsBtnEl.classList.add('hidden');
    
    // Buscar nueva partida con el mismo nombre
    // No es necesario desconectar/reconectar si el socket ya está conectado
    if (playerName && playerName.trim()) {
        showNotification("Buscando nueva partida...", "info");
        showScreen('waitingScreen');
        
        // Si el socket no está conectado, esperar a que se conecte antes de buscar partida
        if (!socket.connected) {
            socket.connect();
            socket.once('connect', () => {
                socket.emit('findMatch', playerName);
            });
        } else {
            socket.emit('findMatch', playerName);
        }
    } else {
        // Si no hay nombre guardado, volver a la pantalla inicial
        resetGame();
    }
});

continueRoundBtn.addEventListener("click", continueToNextRound);
replayAnimationBtn.addEventListener("click", replayAnimation);

exitGameBtn.addEventListener("click", () => {
    exitedManually = true;
    clearGoalSelections();
    currentGameId = null;
    currentRound = 1;
    showScreen("startScreen");
    playerNameInput.value = "";
    playerNameInput.focus();
    setTimeout(() => {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 100);
});

tiebreakerBtn.addEventListener("click", () => {
    if (!currentGameId) {
        showNotification("No se encontró la partida. No se puede desempatar.", "error");
        return;
    }
    
    if (!socket.connected) {
        showNotification("No hay conexión con el servidor. Intentando reconectar...", "error");
        socket.connect();
        return;
    }
    
    // Deshabilitar el botón temporalmente para evitar múltiples clics
    tiebreakerBtn.disabled = true;
    
    console.log("Solicitando desempate para gameId:", currentGameId);
    socket.emit("requestTiebreaker", { gameId: currentGameId });
    showNotification("Has solicitado desempate. Esperando que el oponente también lo solicite...", "info");
});

// Modales de información
scoringInfoBtn.addEventListener("click", () => {
    scoringModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
    scoringModal.classList.add("hidden");
});

scoringModal.addEventListener("click", (e) => {
    if (e.target === scoringModal) {
        scoringModal.classList.add("hidden");
    }
});

// Modales de estadísticas
viewStatsBtn.addEventListener("click", () => {
    statsModal.classList.remove("hidden");
});

closeStatsModalBtn.addEventListener("click", () => {
    statsModal.classList.add("hidden");
});

closeStatsBtn.addEventListener("click", () => {
    statsModal.classList.add("hidden");
});

statsModal.addEventListener("click", (e) => {
    if (e.target === statsModal) {
        statsModal.classList.add("hidden");
    }
});

// Teclas especiales
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!scoringModal.classList.contains("hidden")) {
            scoringModal.classList.add("hidden");
        }
        if (!statsModal.classList.contains("hidden")) {
            statsModal.classList.add("hidden");
        }
    }
});

playerNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        findMatch();
    }
});

/* ==================== 4. FUNCIONES DE NAVEGACIÓN DE PANTALLAS ==================== */

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
        screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
    
    document.body.classList.remove("startScreen-active", "waitingScreen-active", "gameScreen-active", "endScreen-active");
    document.body.classList.add(screenId + "-active");
    
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }
}

/* ==================== 5. FUNCIONES DE INTERFAZ DE USUARIO ==================== */

function showNotification(message, type = "info") {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove("hidden");
    setTimeout(() => {
        notification.classList.add("hidden");
    }, 3000);
}

function formatMove(move) {
    const heightText = {
        baja: "Baja",
        media: "Media",
        alta: "Alta",
    };

    const directionText = {
        izquierda: "Izquierda",
        centro: "Centro",
        derecha: "Derecha",
    };

    return `${heightText[move.height]} - ${directionText[move.direction]}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatNameWithIcon(name, showIcon = false) {
    const safe = escapeHtml(name || '');
    if (showIcon) {
        return `${safe} <span class="user-icon">(<i class="fa fa-user" aria-hidden="true"></i>)</span>`;
    }
    return safe;
}

function updateLocalIconDisplay() {
    const p1Icon = document.querySelector('#player1Name .user-icon');
    const p2Icon = document.querySelector('#player2Name .user-icon');
    if (p1Icon) p1Icon.classList.add('hidden');
    if (p2Icon) p2Icon.classList.add('hidden');

    if (typeof isPlayer1 === 'boolean') {
        if (isPlayer1) {
            if (p1Icon) p1Icon.classList.remove('hidden');
        } else {
            if (p2Icon) p2Icon.classList.remove('hidden');
        }
    }
}

function resetScoreDisplays(roundValue = 1) {
    const p1ScoreEl = document.getElementById("player1Score");
    const p2ScoreEl = document.getElementById("player2Score");
    const totalPlayer1ScoreEl = document.getElementById("totalPlayer1Score");
    const totalPlayer2ScoreEl = document.getElementById("totalPlayer2Score");
    const finalPlayer1ScoreEl = document.getElementById("finalPlayer1Score");
    const finalPlayer2ScoreEl = document.getElementById("finalPlayer2Score");
    const currentRoundEl = document.getElementById("currentRound");
    const maxRoundsEl = document.getElementById("maxRounds");

    if (p1ScoreEl) p1ScoreEl.textContent = "0";
    if (p2ScoreEl) p2ScoreEl.textContent = "0";
    if (totalPlayer1ScoreEl) totalPlayer1ScoreEl.textContent = "0";
    if (totalPlayer2ScoreEl) totalPlayer2ScoreEl.textContent = "0";
    if (finalPlayer1ScoreEl) finalPlayer1ScoreEl.textContent = "0";
    if (finalPlayer2ScoreEl) finalPlayer2ScoreEl.textContent = "0";
    if (currentRoundEl) currentRoundEl.textContent = String(roundValue);
    if (maxRoundsEl && maxRounds) maxRoundsEl.textContent = String(maxRounds);
}

function clearGoalSelections() {
    selectedShootZone = null;
    selectedSaveZone = null;
    shootHeightInput.value = "";
    shootDirectionInput.value = "";
    saveHeightInput.value = "";
    saveDirectionInput.value = "";
    shootSelectedText.textContent = "";
    saveSelectedText.textContent = "";

    shootZoneOverlay.querySelectorAll(".zone").forEach((z) => {
        z.classList.remove("selected");
        z.blur(); // Quitar foco de teclado
    });
    saveZoneOverlay.querySelectorAll(".zone").forEach((z) => {
        z.classList.remove("selected");
        z.blur(); // Quitar foco de teclado
    });
}

/* ==================== 6. FUNCIONES DE LÓGICA DE JUEGO ==================== */

function findMatch() {
    const name = playerNameInput.value.trim();
    if (!name) {
        showNotification("Introduce un nombre para continuar", "error");
        playerNameInput.focus();
        return;
    }

    // Resetear todos los resultados de la partida anterior
    statsUI = {
        player1: { full: 0, partial: 0, miss: 0, attempts: 0 },
        player2: { full: 0, partial: 0, miss: 0, attempts: 0 }
    };
    
    currentAnimationData = null;
    pendingGameEndData = null;
    awaitingFinalScreen = false;
    currentRound = 1;
    
    // Resetear marcadores en el DOM
    resetScoreDisplays(currentRound);
    
    // Ocultar resultados de ronda
    if (roundResult) roundResult.classList.add("hidden");
    if (waitingOpponent) waitingOpponent.classList.add("hidden");
    
    // Limpiar animaciones
    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const zoneIndicator1 = document.getElementById('zoneIndicator1');
    const zoneIndicator2 = document.getElementById('zoneIndicator2');
    if (ball1) ball1.style.opacity = '0';
    if (ball2) ball2.style.opacity = '0';
    if (zoneIndicator1) zoneIndicator1.style.opacity = '0';
    if (zoneIndicator2) zoneIndicator2.style.opacity = '0';
    
    // Limpiar clases de resultados
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }
    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }
    
    // Limpiar selecciones
    clearGoalSelections();

    playerName = name;
    showScreen("waitingScreen");
    
    // Verificar conexión antes de emitir
    if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
            socket.emit("findMatch", playerName);
        });
    } else {
        socket.emit("findMatch", playerName);
    }
    
    playerNameInput.value = "";
    try { playerNameInput.blur(); } catch (e) {}
}

function cancelSearch() {
    showScreen("startScreen");
}

function submitMove() {
    if (!selectedShootZone || !selectedSaveZone) {
        showNotification("Selecciona las zonas de la portería", "error");
        return;
    }

    if (!socket.connected) {
        showNotification("No hay conexión con el servidor. Intentando reconectar...", "error");
        socket.connect();
        return;
    }

    const move = {
        gameId: currentGameId,
        shoot: {
            height: selectedShootZone.height,
            direction: selectedShootZone.direction,
        },
        save: {
            height: selectedSaveZone.height,
            direction: selectedSaveZone.direction,
        },
    };

    socket.emit("makeMove", move);
    submitMoveBtn.disabled = true;
    document.querySelector(".move-selection").style.pointerEvents = "none";
    waitingOpponent.classList.remove("hidden");
    if (gameScreen) gameScreen.classList.add('waiting-results');
}

function resetGame() {
    exitedManually = false;
    clearGoalSelections();
    currentGameId = null;
    currentRound = 1;
    showScreen("startScreen");
    playerNameInput.value = "";
    playerNameInput.focus();

    const p1Icon = document.querySelector('#player1Name .user-icon');
    const p2Icon = document.querySelector('#player2Name .user-icon');
    if (p1Icon) p1Icon.classList.add('hidden');
    if (p2Icon) p2Icon.classList.add('hidden');

    setTimeout(() => {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 100);
}

function checkFormComplete() {
    const shootComplete = selectedShootZone !== null;
    const saveComplete = selectedSaveZone !== null;
    submitMoveBtn.disabled = !(shootComplete && saveComplete);
}

function getHitType(shootMove, saveMove) {
    const heightMatch = shootMove.height === saveMove.height;
    const directionMatch = shootMove.direction === saveMove.direction;

    if (heightMatch && directionMatch) {
        return {
            type: "total",
            text: "Total",
            class: "total",
            description: "Ha acertado la altura y la dirección",
        };
    } else if (heightMatch) {
        return {
            type: "partial",
            text: "Parcial",
            class: "partial",
            description: "Ha acertado sólo la altura",
        };
    } else if (directionMatch) {
        return {
            type: "partial",
            text: "Parcial",
            class: "partial",
            description: "Ha acertado sólo la dirección",
        };
    } else {
        return {
            type: "miss",
            text: "Fallado",
            class: "miss",
            description: "No ha acertado ni la altura ni la dirección",
        };
    }
}

/* ==================== 7. FUNCIONES DE ZONAS (PORTERÍA) ==================== */

function initializeGoals() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            setupGoalInteractivity(shootGoal, "shoot");
            setupGoalInteractivity(saveGoal, "save");
        });
    } else {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }

    shootGoal.addEventListener("load", () => {
        setupGoalInteractivity(shootGoal, "shoot");
    }, { once: true });

    saveGoal.addEventListener("load", () => {
        setupGoalInteractivity(saveGoal, "save");
    }, { once: true });
}

function setupGoalInteractivity(imgElement, type) {
    const overlay = type === "shoot" ? shootZoneOverlay : saveZoneOverlay;
    overlay.innerHTML = "";

    const wrapper = imgElement.parentElement;
    if (wrapper) {
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
    }

    if (imgElement.complete && imgElement.naturalWidth > 0) {
        createZoneGrid(imgElement, overlay, type);
    } else {
        imgElement.addEventListener("load", () => {
            createZoneGrid(imgElement, overlay, type);
        }, { once: true });
    }

    imgElement.removeEventListener("click", imgElement._goalClickHandler);
    imgElement._goalClickHandler = (e) => {
        handleGoalClick(e, imgElement, type);
    };
    imgElement.addEventListener("click", imgElement._goalClickHandler);
}

function createZoneGrid(imgElement, overlay, type) {
    if (!imgElement.complete || imgElement.naturalWidth === 0) {
        imgElement.addEventListener("load", () => createZoneGrid(imgElement, overlay, type), { once: true });
        return;
    }

    requestAnimationFrame(() => {
        const rect = imgElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (width === 0 || height === 0) {
            setTimeout(() => createZoneGrid(imgElement, overlay, type), 100);
            return;
        }

        overlay.innerHTML = "";

        const zoneWidth = width / 3;
        const zoneHeight = height / 3;
        const heights = ["alta", "media", "baja"];
        const directions = ["izquierda", "centro", "derecha"];

        // Crear todas las zonas primero
        const zones = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const zone = document.createElement("div");
                zone.className = "zone";
                zone.style.left = `${col * zoneWidth}px`;
                zone.style.top = `${row * zoneHeight}px`;
                zone.style.width = `${zoneWidth}px`;
                zone.style.height = `${zoneHeight}px`;
                zone.dataset.height = heights[row];
                zone.dataset.direction = directions[col];
                zone.dataset.row = row;
                zone.dataset.col = col;
                
                // Hacer la zona accesible con teclado
                zone.setAttribute('tabindex', '0');
                zone.setAttribute('role', 'button');
                const heightText = { alta: "Alta", media: "Media", baja: "Baja" };
                const directionText = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };
                const typeText = type === "shoot" ? "Tiro" : "Parada";
                zone.setAttribute('aria-label', `${typeText}: ${heightText[heights[row]]} ${directionText[directions[col]]}. Presiona Enter o Espacio para seleccionar.`);
                
                zone.style.pointerEvents = 'auto';
                
                // Click con mouse
                zone.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    handleZoneClick(zone, type);
                });
                
                // Navegación y selección con teclado
                zone.addEventListener('keydown', (ev) => {
                    ev.stopPropagation();
                    handleZoneKeydown(ev, zone, overlay, type);
                });
                
                zones.push(zone);
            }
        }
        
        // Añadir todas las zonas al overlay en orden
        zones.forEach(zone => overlay.appendChild(zone));

        overlay.style.pointerEvents = 'auto';
        
        overlay.removeEventListener('mousemove', overlay._overlayHoverHandler);
        overlay.removeEventListener('mouseleave', overlay._overlayLeaveHandler);
        
        overlay._overlayHoverHandler = (e) => {
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

            const relX = x / rect.width;
            const relY = y / rect.height;

            let height = 'media', direction = 'centro';
            if (relY < 0.333) height = 'alta';
            else if (relY < 0.667) height = 'media';
            else height = 'baja';

            if (relX < 0.333) direction = 'izquierda';
            else if (relX < 0.667) direction = 'centro';
            else direction = 'derecha';

            overlay.querySelectorAll('.zone.hover').forEach(z => z.classList.remove('hover'));
            const hoverZone = overlay.querySelector(`.zone[data-height="${height}"][data-direction="${direction}"]`);
            if (hoverZone) hoverZone.classList.add('hover');
        };

        overlay._overlayLeaveHandler = () => {
            overlay.querySelectorAll('.zone.hover').forEach(z => z.classList.remove('hover'));
        };

        overlay.addEventListener('mousemove', overlay._overlayHoverHandler);
        overlay.addEventListener('mouseleave', overlay._overlayLeaveHandler);

        imgElement.removeEventListener('mousemove', imgElement._zoneHoverHandler);
        imgElement.removeEventListener('mouseleave', imgElement._zoneLeaveHandler);

        imgElement._zoneHoverHandler = (e) => {
            const rect = imgElement.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

            const relX = x / rect.width;
            const relY = y / rect.height;

            let height = 'media', direction = 'centro';
            if (relY < 0.333) height = 'alta';
            else if (relY < 0.667) height = 'media';
            else height = 'baja';

            if (relX < 0.333) direction = 'izquierda';
            else if (relX < 0.667) direction = 'centro';
            else direction = 'derecha';

            overlay.querySelectorAll('.zone.hover').forEach(z => z.classList.remove('hover'));
            const hoverZone = overlay.querySelector(`.zone[data-height="${height}"][data-direction="${direction}"]`);
            if (hoverZone) hoverZone.classList.add('hover');
        };

        imgElement._zoneLeaveHandler = () => {
            overlay.querySelectorAll('.zone.hover').forEach(z => z.classList.remove('hover'));
        };

        imgElement.addEventListener('mousemove', imgElement._zoneHoverHandler);
        imgElement.addEventListener('mouseleave', imgElement._zoneLeaveHandler);
    });
}

function handleGoalClick(e, imgElement, type) {
    const rect = imgElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        return;
    }

    const relX = x / rect.width;
    const relY = y / rect.height;

    let height, direction;

    if (relY < 0.333) {
        height = "alta";
    } else if (relY < 0.667) {
        height = "media";
    } else {
        height = "baja";
    }

    if (relX < 0.333) {
        direction = "izquierda";
    } else if (relX < 0.667) {
        direction = "centro";
    } else {
        direction = "derecha";
    }

    if (type === "shoot") {
        selectedShootZone = { height, direction };
        shootHeightInput.value = height;
        shootDirectionInput.value = direction;
        updateSelectedZone("shoot", height, direction);
    } else {
        selectedSaveZone = { height, direction };
        saveHeightInput.value = height;
        saveDirectionInput.value = direction;
        updateSelectedZone("save", height, direction);
    }

    checkFormComplete();

    const heightText = { baja: "Baja", media: "Media", alta: "Alta" };
    const directionText = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };
    showNotification(`${heightText[height]} - ${directionText[direction]}`, "info");
}

function handleZoneClick(zoneEl, type) {
    if (!zoneEl) return;
    const height = zoneEl.dataset.height;
    const direction = zoneEl.dataset.direction;

    if (type === "shoot") {
        selectedShootZone = { height, direction };
        shootHeightInput.value = height;
        shootDirectionInput.value = direction;
        updateSelectedZone("shoot", height, direction);
    } else {
        selectedSaveZone = { height, direction };
        saveHeightInput.value = height;
        saveDirectionInput.value = direction;
        updateSelectedZone("save", height, direction);
    }

    checkFormComplete();

    const heightText = { baja: "Baja", media: "Media", alta: "Alta" };
    const directionText = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };
    showNotification(`${heightText[height]} - ${directionText[direction]}`, "info");
}

function handleZoneKeydown(ev, zoneEl, overlay, type) {
    if (!zoneEl) return;
    
    const currentRow = parseInt(zoneEl.dataset.row);
    const currentCol = parseInt(zoneEl.dataset.col);
    let newRow = currentRow;
    let newCol = currentCol;
    let shouldSelect = false;
    
    switch(ev.key) {
        case 'Enter':
        case ' ':
            ev.preventDefault();
            shouldSelect = true;
            break;
        case 'ArrowUp':
            ev.preventDefault();
            newRow = Math.max(0, currentRow - 1);
            break;
        case 'ArrowDown':
            ev.preventDefault();
            newRow = Math.min(2, currentRow + 1);
            break;
        case 'ArrowLeft':
            ev.preventDefault();
            newCol = Math.max(0, currentCol - 1);
            break;
        case 'ArrowRight':
            ev.preventDefault();
            newCol = Math.min(2, currentCol + 1);
            break;
        case 'Home':
            ev.preventDefault();
            newCol = 0;
            break;
        case 'End':
            ev.preventDefault();
            newCol = 2;
            break;
        default:
            return; // No hacer nada para otras teclas
    }
    
    if (shouldSelect) {
        // Seleccionar la zona actual
        handleZoneClick(zoneEl, type);
    } else if (newRow !== currentRow || newCol !== currentCol) {
        // Navegar a la nueva zona
        const targetZone = overlay.querySelector(
            `.zone[data-row="${newRow}"][data-col="${newCol}"]`
        );
        if (targetZone) {
            targetZone.focus();
        }
    }
}

function updateSelectedZone(type, height, direction) {
    const overlay = type === "shoot" ? shootZoneOverlay : saveZoneOverlay;
    const selectedText = type === "shoot" ? shootSelectedText : saveSelectedText;

    overlay.querySelectorAll(".zone").forEach((zone) => {
        zone.classList.remove("selected");
    });

    overlay.querySelectorAll(".zone").forEach((zone) => {
        if (zone.dataset.height === height && zone.dataset.direction === direction) {
            zone.classList.add("selected");
        }
    });

    const heightText = { baja: "Baja", media: "Media", alta: "Alta" };
    const directionText = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };
    selectedText.textContent = `${heightText[height]} - ${directionText[direction]}`;
}

/* ==================== 8. FUNCIONES DE ANIMACIONES ==================== */

function getZoneNumber(height, direction) {
    const heightMap = { alta: 0, media: 1, baja: 2 };
    const directionMap = { izquierda: 0, centro: 1, derecha: 2 };
    const zoneNum = heightMap[height] * 3 + directionMap[direction] + 1;
    return zoneNum;
}

function getZonePosition(zoneNum) {
    const row = Math.floor((zoneNum - 1) / 3);
    const col = (zoneNum - 1) % 3;
    const zoneWidth = 33.33;
    const zoneHeight = 33.33;
    const xPercent = col * zoneWidth + zoneWidth / 2;
    const invertedRow = 2 - row;
    const yPercent = invertedRow * zoneHeight + zoneHeight / 2;
    return { x: xPercent, y: yPercent };
}

function getZoneAnimationClass(zoneNum) {
    const row = Math.floor((zoneNum - 1) / 3);
    const col = (zoneNum - 1) % 3;

    if (row === 0 && col === 0) return "zone-top-left";
    if (row === 0 && col === 1) return "zone-top";
    if (row === 0 && col === 2) return "zone-top-right";
    if (row === 1 && col === 0) return "zone-left";
    if (row === 1 && col === 1) return "";
    if (row === 1 && col === 2) return "zone-right";
    if (row === 2 && col === 0) return "zone-bottom-left";
    if (row === 2 && col === 1) return "zone-bottom";
    if (row === 2 && col === 2) return "zone-bottom-right";
    return "";
}

function getPorterPosition(zoneNum, shrink = 1) {
    const row = Math.floor((zoneNum - 1) / 3);
    const col = (zoneNum - 1) % 3;
    const zoneWidth = 33.33;
    const zoneHeight = 33.33;

    let leftPercent = col * zoneWidth + zoneWidth / 2;
    let topPercent = row * zoneHeight + zoneHeight / 2;

    if (zoneNum === 5) {
        topPercent = row * zoneHeight + zoneHeight * 1.1;
    }

    if (shrink && shrink < 1) {
        const centerLeft = 1 * zoneWidth + zoneWidth / 2;
        let centerTop = 1 * zoneHeight + zoneHeight / 2;
        centerTop = 1 * zoneHeight + zoneHeight * 1.1;

        leftPercent = centerLeft + (leftPercent - centerLeft) * shrink;
        topPercent = centerTop + (topPercent - centerTop) * shrink;
    }

    return { left: leftPercent, top: topPercent };
}

function showPlayerResult(playerNum, shootMove, saveMove, score, playerName) {
    const ballId = `ball${playerNum}`;
    const ball = document.getElementById(ballId);
    const zoneIndicatorId = `zoneIndicator${playerNum}`;
    const zoneIndicator = document.getElementById(zoneIndicatorId);
    const animNameId = `animPlayer${playerNum}Name`;
    const animPointsId = `animPlayer${playerNum}Points`;

    if (!ball || !zoneIndicator) {
        console.error(`Elements not found for player ${playerNum}`);
        return;
    }

    if (document.getElementById(animNameId)) {
        document.getElementById(animNameId).textContent = playerName;
    }

    const shootZoneNum = getZoneNumber(shootMove.height, shootMove.direction);
    const ballPosition = getPorterPosition(shootZoneNum);

    const saveZoneNum = getZoneNumber(saveMove.height, saveMove.direction);
    const porterPosition = getPorterPosition(saveZoneNum, 0.8);
    const centerPosition = getPorterPosition(5);

    zoneIndicator.className = "zone-indicator show";
    zoneIndicator.style.left = `${centerPosition.left}%`;
    zoneIndicator.style.top = `${centerPosition.top}%`;
    zoneIndicator.style.transform = "translate(-50%, -50%) scale(0.22)";
    zoneIndicator.src = `img/p5.png`;
    zoneIndicator.alt = `Porter zona 5`;
    zoneIndicator.style.opacity = "1";

    const animationClass = getZoneAnimationClass(saveZoneNum);
    if (animationClass) {
        zoneIndicator.classList.add(animationClass);
    }

    setTimeout(() => {
        zoneIndicator.style.transition = "left 3s ease-out, top 3s ease-out";
        zoneIndicator.style.left = `${porterPosition.left}%`;
        zoneIndicator.style.top = `${porterPosition.top}%`;
        zoneIndicator.src = `img/p${saveZoneNum}.png`;
        zoneIndicator.alt = `Porter zona ${saveZoneNum}`;
    }, 50);

    const position8 = getPorterPosition(8);
    const startTop = position8.top + 10;

    let ballTop = ballPosition.top;
    const row = Math.floor((shootZoneNum - 1) / 3);
    if (row === 1) {
        const position4 = getPorterPosition(4);
        ballTop = position4.top;
    }

    const dir = shootMove.direction;
    let ballLeft = ballPosition.left;
    const lateralOffset = 3;
    if (dir === "izquierda") {
        ballLeft = Math.max(0, ballLeft - lateralOffset);
    } else if (dir === "derecha") {
        ballLeft = Math.min(100, ballLeft + lateralOffset);
    }

    ball.style.left = "50%";
    ball.style.top = `${startTop}%`;
    ball.style.transform = "translate(-50%, -50%)";
    ball.style.opacity = "1";

    setTimeout(() => {
        ball.style.transition = "left 3s ease-out, top 3s ease-out";
        ball.style.left = `${ballLeft}%`;
        ball.style.top = `${ballTop}%`;
    }, 50);

    setTimeout(() => {
        ball.style.transition = "";
    }, 3050);
}

function replayAnimation() {
    if (!currentAnimationData) {
        console.log("No animation data to replay");
        return;
    }

    const { moveForPlayer1, moveForPlayer2, uiPlayer1Name, uiPlayer2Name, pointsP1, pointsP2 } = currentAnimationData;

    const ball1 = document.getElementById("ball1");
    const ball2 = document.getElementById("ball2");
    const zoneIndicator1 = document.getElementById("zoneIndicator1");
    const zoneIndicator2 = document.getElementById("zoneIndicator2");
    const centerPos = getPorterPosition(5);

    [ball1, ball2].forEach(ball => {
        if (ball) {
            ball.style.transition = "none";
            ball.style.opacity = "0";
        }
    });

    [zoneIndicator1, zoneIndicator2].forEach(porter => {
        if (porter) {
            porter.className = "zone-indicator";
            porter.style.transition = "none";
            porter.style.left = `${centerPos.left}%`;
            porter.style.top = `${centerPos.top}%`;
            porter.style.transform = "translate(-50%, -50%) scale(0.22)";
            porter.src = "img/p5.png";
            porter.style.opacity = "1";
        }
    });

    if (replayAnimationBtn) replayAnimationBtn.style.display = "none";

    setTimeout(() => {
        showPlayerResult(1, moveForPlayer2.shoot, moveForPlayer1.save, pointsP1, uiPlayer1Name);
        showPlayerResult(2, moveForPlayer1.shoot, moveForPlayer2.save, pointsP2, uiPlayer2Name);

        setTimeout(() => {
            if (replayAnimationBtn) {
                replayAnimationBtn.style.display = "block";
                replayAnimationBtn.disabled = false;
            }
        }, 3500);
    }, 100);

    setTimeout(() => {
        if (replayAnimationBtn) {
            replayAnimationBtn.style.display = "block";
        }
    }, 3100);
}

/* ==================== 9. SOCKET.IO LISTENERS ==================== */

socket.on("waitingForMatch", () => {
    showNotification("Buscando oponente...", "info");
});

socket.on('rematchNotAvailable', (data) => {
    showNotification(data.message || 'Partida no encontrada. Buscando oponente...', 'info');
    if (playerName && playerName.trim()) {
        showScreen('waitingScreen');
        // Si el socket no está conectado, esperar a que se conecte antes de buscar partida
        if (!socket.connected) {
            socket.connect();
            socket.once('connect', () => {
                socket.emit('findMatch', playerName);
            });
        } else {
            socket.emit('findMatch', playerName);
        }
    } else {
        resetGame();
    }
});

socket.on('rematchTimeout', (data) => {
    showNotification(data.message || 'El oponente no ha aceptado jugar de nuevo. Volviendo a la pantalla inicial...', 'error');
    
    // Habilitar el botón de nuevo
    if (playAgainBtn) {
        playAgainBtn.disabled = false;
    }
    
    // Limpiar estado
    currentGameId = null;
    currentRound = 1;
    
    // Volver a la pantalla inicial
    setTimeout(() => {
        resetGame();
    }, 2000); // Esperar 2 segundos para que el usuario vea el mensaje
});

socket.on('tiebreakerNotAvailable', (data) => {
    showNotification(data.message || 'Desempate no disponible', 'error');
});

socket.on("matchFound", (data) => {
    // Verificar que el socket sigue conectado antes de procesar el match
    if (!socket.connected) {
        console.warn('Match encontrado pero socket desconectado. Intentando reconectar...');
        socket.connect();
        // Esperar a que se reconecte antes de continuar
        socket.once('connect', () => {
            // Re-emitir findMatch para buscar nueva partida
            if (playerName && playerName.trim()) {
                socket.emit('findMatch', playerName);
            }
        });
        return;
    }
    
    currentGameId = data.gameId;
    isPlayer1 = data.isPlayer1;
    
    // Resetear todos los resultados de la partida anterior
    statsUI = {
        player1: { full: 0, partial: 0, miss: 0, attempts: 0 },
        player2: { full: 0, partial: 0, miss: 0, attempts: 0 }
    };
    
    currentAnimationData = null;
    pendingGameEndData = null;
    awaitingFinalScreen = false;
    currentRound = 1;
    
    // Resetear marcadores en el DOM
    resetScoreDisplays(currentRound);
    
    // Limpiar estado de animaciones y resultados
    if (roundResult) roundResult.classList.add("hidden");
    if (waitingOpponent) waitingOpponent.classList.add("hidden");
    
    // Ocultar animaciones de pelotas y porteros
    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const zoneIndicator1 = document.getElementById('zoneIndicator1');
    const zoneIndicator2 = document.getElementById('zoneIndicator2');
    if (ball1) ball1.style.opacity = '0';
    if (ball2) ball2.style.opacity = '0';
    if (zoneIndicator1) zoneIndicator1.style.opacity = '0';
    if (zoneIndicator2) zoneIndicator2.style.opacity = '0';
    
    // Asegurar que move-selection esté visible
    const moveSelection = document.querySelector(".move-selection");
    if (moveSelection) {
        moveSelection.style.display = "block";
        moveSelection.style.opacity = "1";
        moveSelection.style.pointerEvents = "auto";
    }
    
    // Limpiar clases de resultados
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }
    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }
    
    showScreen("gameScreen");
    showNotification(`¡Partida encontrada! Oponente: ${data.opponent}`, "success");

    const p1TextEl = document.querySelector('#player1Name .player-name-text');
    const p2TextEl = document.querySelector('#player2Name .player-name-text');
    if (isPlayer1) {
        if (p1TextEl) p1TextEl.textContent = playerName;
        if (p2TextEl) p2TextEl.textContent = data.opponent;
    } else {
        if (p1TextEl) p1TextEl.textContent = data.opponent;
        if (p2TextEl) p2TextEl.textContent = playerName;
    }

    updateLocalIconDisplay();
    
    // Limpiar selecciones
    clearGoalSelections();

    setTimeout(() => {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 100);
});

socket.on("gameStart", (data) => {
    maxRounds = data.maxRounds;
    currentRound = 1;
    if (data.gameId) currentGameId = data.gameId;
    
    // Asegurar que estamos en la pantalla de juego antes de modificar elementos
    if (!gameScreen || !gameScreen.classList.contains('active')) {
        showScreen("gameScreen");
    }
    
    const currentRoundEl = document.getElementById("currentRound");
    const maxRoundsEl = document.getElementById("maxRounds");
    if (currentRoundEl) currentRoundEl.textContent = currentRound;
    if (maxRoundsEl) maxRoundsEl.textContent = maxRounds;

    serverPlayer1Name = data.player1;
    serverPlayer2Name = data.player2;

    const p1El = document.querySelector('#player1Name .player-name-text');
    const p2El = document.querySelector('#player2Name .player-name-text');
    if (p1El) p1El.textContent = serverPlayer1Name;
    if (p2El) p2El.textContent = serverPlayer2Name;

    updateLocalIconDisplay();

    resetScoreDisplays(currentRound);

    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }

    clearGoalSelections();

    shootZoneOverlay.querySelectorAll(".zone").forEach((z) => {
        z.classList.remove("selected");
    });
    saveZoneOverlay.querySelectorAll(".zone").forEach((z) => {
        z.classList.remove("selected");
    });

    submitMoveBtn.disabled = true;
    const moveSelection = document.querySelector(".move-selection");
    if (moveSelection) {
        moveSelection.style.display = "block";
        moveSelection.style.opacity = "1";
        moveSelection.style.pointerEvents = "auto";
    }
    if (waitingOpponent) waitingOpponent.classList.add("hidden");
    if (roundResult) roundResult.classList.add("hidden");
    
    // Asegurar que las animaciones estén ocultas
    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const zoneIndicator1 = document.getElementById('zoneIndicator1');
    const zoneIndicator2 = document.getElementById('zoneIndicator2');
    if (ball1) ball1.style.opacity = '0';
    if (ball2) ball2.style.opacity = '0';
    if (zoneIndicator1) zoneIndicator1.style.opacity = '0';
    if (zoneIndicator2) zoneIndicator2.style.opacity = '0';
    
    // Asegurar que gameScreen no tenga clases de resultados
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }

    setTimeout(() => {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 100);
    
    if (playAgainBtn) {
        playAgainBtn.disabled = false;
        playAgainBtn.textContent = "Buscar partida";
    }
    if (continueRoundBtn) {
        continueRoundBtn.disabled = false;
        continueRoundBtn.style.display = "none";
    }
    if (tiebreakerBtn) {
        tiebreakerBtn.classList.add("hidden");
    }

    statsUI = {
        player1: { full: 0, partial: 0, miss: 0, attempts: 0 },
        player2: { full: 0, partial: 0, miss: 0, attempts: 0 }
    };
    
    const statP1NameEl = document.getElementById('statP1Name');
    const statP2NameEl = document.getElementById('statP2Name');
    if (statP1NameEl) statP1NameEl.textContent = (document.querySelector('#player1Name .player-name-text') || {textContent: ''}).textContent;
    if (statP2NameEl) statP2NameEl.textContent = (document.querySelector('#player2Name .player-name-text') || {textContent: ''}).textContent;
    
    if (document.getElementById("endScreen") && document.getElementById("endScreen").classList.contains("active")) {
        showScreen("gameScreen");
    }
    
    const finalStatsEl = document.getElementById('finalStats');
    if (finalStatsEl) finalStatsEl.classList.add('hidden');
});

socket.on("moveReceived", () => {
    showNotification("Movimiento enviado. Esperando al oponente...", "info");
});

socket.on("roundResult", (data) => {
    console.log("ROUND RESULT recibido:", data);
    
    waitingOpponent.classList.add("hidden");
    roundResult.classList.remove("hidden");
    if (gameScreen) gameScreen.classList.add('showing-results');

    const gameContent = document.querySelector(".game-content");
    if (gameContent) gameContent.classList.add("show-results");

    const moveSelection = document.querySelector(".move-selection");
    if (moveSelection) moveSelection.style.display = "none";

    const uiPlayer1Name = (document.querySelector('#player1Name .player-name-text') || {textContent: ''}).textContent;
    const uiPlayer2Name = (document.querySelector('#player2Name .player-name-text') || {textContent: ''}).textContent;
    let moveForPlayer1, moveForPlayer2;
    
    if (serverPlayer1Name === uiPlayer1Name) {
        moveForPlayer1 = data.player1Move;
        moveForPlayer2 = data.player2Move;
    } else {
        moveForPlayer1 = data.player2Move;
        moveForPlayer2 = data.player1Move;
    }

    function computePoints(shootMove, saveMove) {
        const heightMatch = shootMove.height === saveMove.height;
        const directionMatch = shootMove.direction === saveMove.direction;
        if (heightMatch && directionMatch) return 2;
        if (heightMatch || directionMatch) return 1;
        return 0;
    }

    const pointsP1 = computePoints(moveForPlayer2.shoot, moveForPlayer1.save);
    const pointsP2 = computePoints(moveForPlayer1.shoot, moveForPlayer2.save);

    const p1ScoreEl = document.getElementById("player1Score");
    const p2ScoreEl = document.getElementById("player2Score");
    const prevP1 = parseInt(p1ScoreEl.textContent || "0");
    const prevP2 = parseInt(p2ScoreEl.textContent || "0");
    const newP1Score = prevP1 + pointsP1;
    const newP2Score = prevP2 + pointsP2;

    p1ScoreEl.textContent = String(newP1Score);
    p2ScoreEl.textContent = String(newP2Score);

    const animName1 = document.getElementById('animPlayer1Name');
    const animName2 = document.getElementById('animPlayer2Name');
    if (animName1) animName1.innerHTML = formatNameWithIcon(uiPlayer1Name, !!isPlayer1);
    if (animName2) animName2.innerHTML = formatNameWithIcon(uiPlayer2Name, !isPlayer1);

    const resultDetails = roundResult.querySelector(".result-details");
    const totalScores = roundResult.querySelector(".total-scores");
    const resultPlayer1Name = document.getElementById("resultPlayer1Name");
    const resultPlayer1Shoot = document.getElementById("resultPlayer1Shoot");
    const resultPlayer1Save = document.getElementById("resultPlayer1Save");
    const resultPlayer1Points = document.getElementById("resultPlayer1Points");
    const resultPlayer2Name = document.getElementById("resultPlayer2Name");
    const resultPlayer2Shoot = document.getElementById("resultPlayer2Shoot");
    const resultPlayer2Save = document.getElementById("resultPlayer2Save");
    const resultPlayer2Points = document.getElementById("resultPlayer2Points");

    resultPlayer1Name.textContent = 'Detalles';
    resultPlayer1Save.textContent = formatMove(moveForPlayer1.save);
    resultPlayer1Shoot.textContent = formatMove(moveForPlayer1.shoot);
    resultPlayer1Points.textContent = String(pointsP1);

    resultPlayer2Name.textContent = 'Detalles';
    resultPlayer2Save.textContent = formatMove(moveForPlayer2.save);
    resultPlayer2Shoot.textContent = formatMove(moveForPlayer2.shoot);
    resultPlayer2Points.textContent = String(pointsP2);

    const hit1 = getHitType(moveForPlayer2.shoot, moveForPlayer1.save);
    const hit2 = getHitType(moveForPlayer1.shoot, moveForPlayer2.save);
    statsUI.player1.attempts++;
    statsUI.player2.attempts++;
    if (hit1.type === 'total') statsUI.player1.full++; else if (hit1.type === 'partial') statsUI.player1.partial++; else statsUI.player1.miss++;
    if (hit2.type === 'total') statsUI.player2.full++; else if (hit2.type === 'partial') statsUI.player2.partial++; else statsUI.player2.miss++;

    const totalPlayer1ScoreEl = document.getElementById("totalPlayer1Score");
    const totalPlayer2ScoreEl = document.getElementById("totalPlayer2Score");
    if (totalPlayer1ScoreEl) totalPlayer1ScoreEl.textContent = String(newP1Score);
    if (totalPlayer2ScoreEl) totalPlayer2ScoreEl.textContent = String(newP2Score);

    const centerPos = getPorterPosition(5);
    ["zoneIndicator1", "zoneIndicator2"].forEach(id => {
        const porter = document.getElementById(id);
        if (porter) {
            porter.className = "zone-indicator";
            porter.src = "img/p5.png";
            porter.style.opacity = "1";
            porter.style.left = `${centerPos.left}%`;
            porter.style.top = `${centerPos.top}%`;
            porter.style.transform = "translate(-50%, -50%) scale(0.22)";
        }
    });

    ["ball1", "ball2"].forEach(id => {
        const ball = document.getElementById(id);
        if (ball) ball.style.opacity = "0";
    });

    if (replayAnimationBtn) replayAnimationBtn.style.display = "none";

    if (resultDetails) resultDetails.style.display = "none";
    if (totalScores) totalScores.style.display = "none";
    if (continueRoundBtn) continueRoundBtn.style.display = "none";

    currentAnimationData = {
        moveForPlayer1,
        moveForPlayer2,
        uiPlayer1Name,
        uiPlayer2Name,
        pointsP1,
        pointsP2
    };

    showPlayerResult(1, moveForPlayer2.shoot, moveForPlayer1.save, pointsP1, uiPlayer1Name);
    showPlayerResult(2, moveForPlayer1.shoot, moveForPlayer2.save, pointsP2, uiPlayer2Name);

    setTimeout(() => {
        if (resultDetails) {
            resultDetails.style.display = "grid";
            resultDetails.style.animation = "fadeIn 0.5s ease-in";
        }
        if (totalScores) {
            totalScores.style.display = "block";
            totalScores.style.animation = "fadeIn 0.5s ease-in";
        }
        if (continueRoundBtn) {
            continueRoundBtn.textContent = "Continuar";
            continueRoundBtn.style.display = "block";
            continueRoundBtn.style.animation = "fadeIn 0.5s ease-in";
            continueRoundBtn.disabled = false;
        }
        if (replayAnimationBtn) {
            replayAnimationBtn.style.display = "block";
            replayAnimationBtn.style.animation = "fadeIn 0.5s ease-in";
            replayAnimationBtn.disabled = false;
        }
    }, 3500);
});

socket.on("nextRound", (data) => {
    console.log("NEXT ROUND recibido:", data);
});

socket.on("waitingRematch", (data) => {
    showNotification(data.message || "Esperando al oponente...", "info");
});

socket.on("waitingFinal", (data) => {
    showNotification(data.message || "Esperando al oponente...", "info");
});

socket.on("gameEnd", (data) => {
    console.log("GAME END recibido:", data);
    
    if (roundResult && !roundResult.classList.contains('hidden')) {
        pendingGameEndData = data;
        awaitingFinalScreen = true;

        const playAgainBtnEl = document.getElementById("playAgainBtn");
        const tiebreakerBtnEl = document.getElementById("tiebreakerBtn");
        const exitGameBtnEl = document.getElementById("exitGameBtn");
        if (playAgainBtnEl) { playAgainBtnEl.disabled = false; playAgainBtnEl.style.display = 'block'; }
        if (tiebreakerBtnEl) tiebreakerBtnEl.disabled = false;
        if (exitGameBtnEl) { exitGameBtnEl.disabled = false; exitGameBtnEl.style.display = 'block'; }

        showNotification('Resultado final guardado. Pulsa "Continuar" para ver la pantalla final.', 'info');
        return;
    }

    // Asegurar que estamos en la pantalla final antes de modificar elementos
    if (!endScreen || !endScreen.classList.contains('active')) {
        showScreen("endScreen");
    }

    const p1ScoreEl = document.getElementById("player1Score");
    const p2ScoreEl = document.getElementById("player2Score");
    const uiFinalP1Score = parseInt(p1ScoreEl ? (p1ScoreEl.textContent || "0") : "0");
    const uiFinalP2Score = parseInt(p2ScoreEl ? (p2ScoreEl.textContent || "0") : "0");
    const uiFinalP1Name = (document.querySelector('#player1Name .player-name-text') || {textContent: 'Player 1'}).textContent || "Player 1";
    const uiFinalP2Name = (document.querySelector('#player2Name .player-name-text') || {textContent: 'Player 2'}).textContent || "Player 2";
    
    const finalPlayer1NameEl = document.getElementById("finalPlayer1Name");
    const finalPlayer1ScoreEl = document.getElementById("finalPlayer1Score");
    const finalPlayer2NameEl = document.getElementById("finalPlayer2Name");
    const finalPlayer2ScoreEl = document.getElementById("finalPlayer2Score");
    
    if (finalPlayer1NameEl) finalPlayer1NameEl.innerHTML = formatNameWithIcon(uiFinalP1Name, !!isPlayer1);
    if (finalPlayer1ScoreEl) finalPlayer1ScoreEl.textContent = String(uiFinalP1Score);
    if (finalPlayer2NameEl) finalPlayer2NameEl.innerHTML = formatNameWithIcon(uiFinalP2Name, !isPlayer1);
    if (finalPlayer2ScoreEl) finalPlayer2ScoreEl.textContent = String(uiFinalP2Score);

    const winnerTextEl = document.getElementById("winnerText");
    const tiebreakerBtnEl = document.getElementById("tiebreakerBtn");
    const playAgainBtnEl = document.getElementById("playAgainBtn");
    const exitGameBtnEl = document.getElementById("exitGameBtn");
    const finalStatsEl = document.getElementById('finalStats');
    const viewStatsBtnEl = document.getElementById('viewStatsBtn');

    if (!winnerTextEl || !tiebreakerBtnEl || !playAgainBtnEl || !exitGameBtnEl) {
        console.error("Elementos de la pantalla final no encontrados");
        return;
    }

    const uiWinner = uiFinalP1Score > uiFinalP2Score ? 'player1' : uiFinalP2Score > uiFinalP1Score ? 'player2' : null;
    if (uiWinner === null) {
        // Empate: no mostrar estadísticas y mostrar botón de desempate
        winnerTextEl.textContent = "🤝 ¡Empate! 🤝";
        winnerTextEl.className = "winner-text tie";
        tiebreakerBtnEl.classList.remove("hidden");
        if (finalStatsEl) finalStatsEl.classList.add('hidden');
        if (viewStatsBtnEl) viewStatsBtnEl.classList.add('hidden');
    } else {
        // Hay ganador: mostrar estadísticas y ocultar botón de desempate
        const iWon = (uiWinner === 'player1' && isPlayer1) || (uiWinner === 'player2' && !isPlayer1);
        if (iWon) {
            winnerTextEl.textContent = "🎉 ¡Has ganado! 🎉";
            winnerTextEl.className = "winner-text win";
        } else {
            winnerTextEl.textContent = "😔 ¡Has perdido! 😔";
            winnerTextEl.className = "winner-text lose";
        }
        tiebreakerBtnEl.classList.add("hidden");
        // Solo mostrar estadísticas si hay un ganador
        if (data.winner) {
            renderFinalStats();
        } else {
            if (finalStatsEl) finalStatsEl.classList.add('hidden');
            if (viewStatsBtnEl) viewStatsBtnEl.classList.add('hidden');
        }
    }

    playAgainBtnEl.disabled = false;
    playAgainBtnEl.style.display = "block";
    tiebreakerBtnEl.disabled = false;
    exitGameBtnEl.disabled = false;
    exitGameBtnEl.style.display = "block";
});

socket.on("tiebreakerRound", (data) => {
    console.log("=== TIEBREAKER ROUND recibido ===", data);
    console.log("Pantalla actual antes del cambio:", document.querySelector('.screen.active')?.id);

    // Asegurar que currentGameId se mantenga
    if (data.gameId) {
        currentGameId = data.gameId;
        console.log("currentGameId actualizado a:", currentGameId);
    }

    currentRound = data.round;
    maxRounds = data.maxRounds;
    const currentRoundEl = document.getElementById("currentRound");
    const maxRoundsEl = document.getElementById("maxRounds");
    if (currentRoundEl) currentRoundEl.textContent = currentRound;
    if (maxRoundsEl) maxRoundsEl.textContent = maxRounds;
    console.log(`Ronda actualizada: ${currentRound} de ${maxRounds}`);

    // Ocultar el botón de desempate y habilitarlo para futuros usos
    if (tiebreakerBtn) {
        tiebreakerBtn.classList.add("hidden");
        tiebreakerBtn.disabled = false; // Resetear el estado del botón
        console.log("Botón de desempate ocultado");
    }

    // Ocultar la pantalla final y mostrar la pantalla de juego
    console.log("Cambiando a gameScreen para ronda de desempate");
    showScreen("gameScreen");
    console.log("Pantalla después del cambio:", document.querySelector('.screen.active')?.id);

    const moveSelection = document.querySelector(".move-selection");
    if (moveSelection) {
        moveSelection.style.display = "block";
        moveSelection.style.opacity = "1";
        moveSelection.style.pointerEvents = "auto";
        console.log("move-selection configurado y visible");
    } else {
        console.error("ERROR: move-selection no encontrado!");
    }

    if (roundResult) {
        roundResult.classList.add("hidden");
        console.log("roundResult ocultado");
    }
    if (waitingOpponent) {
        waitingOpponent.classList.add("hidden");
        console.log("waitingOpponent ocultado");
    }
    
    // Asegurar que gameScreen esté en el estado correcto
    if (gameScreen) {
        gameScreen.classList.remove('waiting-results', 'showing-results');
    }
    
    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }

    clearGoalSelections();

    if (shootZoneOverlay) {
        shootZoneOverlay.querySelectorAll('.zone').forEach(z => z.classList.remove('selected'));
    }
    if (saveZoneOverlay) {
        saveZoneOverlay.querySelectorAll('.zone').forEach(z => z.classList.remove('selected'));
    }

    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const zoneIndicator1 = document.getElementById('zoneIndicator1');
    const zoneIndicator2 = document.getElementById('zoneIndicator2');
    if (ball1) { ball1.style.opacity = '0'; ball1.style.transition = ''; }
    if (ball2) { ball2.style.opacity = '0'; ball2.style.transition = ''; }
    if (zoneIndicator1) { zoneIndicator1.className = 'zone-indicator'; zoneIndicator1.src = 'img/p5.png'; }
    if (zoneIndicator2) { zoneIndicator2.className = 'zone-indicator'; zoneIndicator2.src = 'img/p5.png'; }

    if (submitMoveBtn) {
        submitMoveBtn.disabled = true; // Se habilitará cuando se seleccionen ambas zonas
    }

    // Mostrar notificación solo una vez
    showNotification("🏆 Ronda de desempate! Selecciona tus movimientos. 🏆", "success");
    
    // Asegurar que el botón de "Buscar partida" esté oculto
    if (playAgainBtn) {
        playAgainBtn.style.display = "none";
    }
    
    const statP1NameEl = document.getElementById('statP1Name');
    const statP2NameEl = document.getElementById('statP2Name');
    if (statP1NameEl) statP1NameEl.textContent = (document.querySelector('#player1Name .player-name-text') || {textContent: ''}).textContent;
    if (statP2NameEl) statP2NameEl.textContent = (document.querySelector('#player2Name .player-name-text') || {textContent: ''}).textContent;
    
    // Inicializar interactividad de las porterías
    setTimeout(() => {
        console.log("Inicializando interactividad de porterías para desempate");
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 100);
});

socket.on("waitingTiebreaker", (data) => {
    console.log("Waiting tiebreaker:", data.message);
    showNotification(data.message, "info");
});

socket.on("opponentRequestedTiebreaker", (data) => {
    console.log("Oponente solicitó desempate");
    // Solo mostrar notificación si estamos en la pantalla final (no en gameScreen)
    if (endScreen && endScreen.classList.contains("active")) {
        // Cuando el oponente solicita desempate, mostrar mensaje claro al jugador
        if (tiebreakerBtn && !tiebreakerBtn.classList.contains("hidden")) {
            // Asegurar que el botón esté habilitado para que el jugador pueda hacer clic
            tiebreakerBtn.disabled = false;
            showNotification("El oponente ha solicitado desempate. Haz clic en 'Desempatar' para aceptar.", "info");
        } else {
            showNotification("El oponente ha solicitado desempate.", "info");
        }
    }
});

socket.on("opponentDisconnected", () => {
    showNotification("Tu oponente se ha desconectado", "error");
    if (!exitedManually) {
        setTimeout(() => {
            resetGame();
        }, 30000);
    }
});

// Manejo de desconexión del socket
socket.on('disconnect', (reason) => {
    console.log('Socket desconectado:', reason);
    if (currentGameId && !exitedManually) {
        showNotification("Conexión perdida. Intentando reconectar...", "error");
    }
});

// Manejo de reconexión del socket
socket.on('connect', () => {
    console.log('Socket conectado');
    if (currentGameId && !exitedManually) {
        showNotification("Conexión restablecida", "success");
    }
});

// Manejo de errores de conexión
socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error);
    if (currentGameId && !exitedManually) {
        showNotification("Error de conexión. Reintentando...", "error");
    }
});

/* ==================== 10. FUNCIONES DE UTILIDAD ==================== */

function continueToNextRound() {
    if (awaitingFinalScreen && pendingGameEndData) {
        const data = pendingGameEndData;
        pendingGameEndData = null;
        awaitingFinalScreen = false;

        const p1ScoreEl = document.getElementById("player1Score");
        const p2ScoreEl = document.getElementById("player2Score");
        const uiFinalP1Score = parseInt(p1ScoreEl ? (p1ScoreEl.textContent || "0") : "0");
        const uiFinalP2Score = parseInt(p2ScoreEl ? (p2ScoreEl.textContent || "0") : "0");
        const uiFinalP1Name = (document.querySelector('#player1Name .player-name-text') || {textContent: 'Player 1'}).textContent || "Player 1";
        const uiFinalP2Name = (document.querySelector('#player2Name .player-name-text') || {textContent: 'Player 2'}).textContent || "Player 2";
        
        const finalPlayer1NameEl = document.getElementById("finalPlayer1Name");
        const finalPlayer1ScoreEl = document.getElementById("finalPlayer1Score");
        const finalPlayer2NameEl = document.getElementById("finalPlayer2Name");
        const finalPlayer2ScoreEl = document.getElementById("finalPlayer2Score");
        
        if (finalPlayer1NameEl) finalPlayer1NameEl.innerHTML = formatNameWithIcon(uiFinalP1Name, !!isPlayer1);
        if (finalPlayer1ScoreEl) finalPlayer1ScoreEl.textContent = String(uiFinalP1Score);
        if (finalPlayer2NameEl) finalPlayer2NameEl.innerHTML = formatNameWithIcon(uiFinalP2Name, !isPlayer1);
        if (finalPlayer2ScoreEl) finalPlayer2ScoreEl.textContent = String(uiFinalP2Score);

        // Asegurar que estamos en la pantalla final antes de modificar elementos
        showScreen('endScreen');
        
        const winnerTextEl = document.getElementById("winnerText");
        const tiebreakerBtnEl = document.getElementById('tiebreakerBtn');
        const finalStatsEl = document.getElementById('finalStats');
        const viewStatsBtnEl = document.getElementById('viewStatsBtn');
        
        if (!winnerTextEl) {
            console.error("Elemento winnerText no encontrado");
            return;
        }
        
        const uiWinner = uiFinalP1Score > uiFinalP2Score ? 'player1' : uiFinalP2Score > uiFinalP1Score ? 'player2' : null;
        if (uiWinner === null) {
            // Empate: no mostrar estadísticas y mostrar botón de desempate
            winnerTextEl.textContent = "🤝 ¡Empate! 🤝";
            winnerTextEl.className = "winner-text tie";
            if (tiebreakerBtnEl) tiebreakerBtnEl.classList.remove('hidden');
            if (finalStatsEl) finalStatsEl.classList.add('hidden');
            if (viewStatsBtnEl) viewStatsBtnEl.classList.add('hidden');
        } else {
            // Hay ganador: mostrar estadísticas y ocultar botón de desempate
            const iWon = (uiWinner === 'player1' && isPlayer1) || (uiWinner === 'player2' && !isPlayer1);
            if (iWon) {
                winnerTextEl.textContent = "🎉 ¡Has ganado! 🎉";
                winnerTextEl.className = "winner-text win";
            } else {
                winnerTextEl.textContent = "😔 ¡Has perdido! 😔";
                winnerTextEl.className = "winner-text lose";
            }
            if (tiebreakerBtnEl) tiebreakerBtnEl.classList.add('hidden');
            // Solo mostrar estadísticas si hay un ganador
            if (data.winner) {
                renderFinalStats();
            } else {
                if (finalStatsEl) finalStatsEl.classList.add('hidden');
                if (viewStatsBtnEl) viewStatsBtnEl.classList.add('hidden');
            }
        }
        return;
    }

    currentRound++;
    const currentRoundEl = document.getElementById("currentRound");
    if (currentRoundEl) currentRoundEl.textContent = currentRound;

    if (roundResult) roundResult.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove('showing-results');
    
    const gameContent = document.querySelector(".game-content");
    if (gameContent) {
        gameContent.classList.remove("show-results");
    }
    
    const moveSelection = document.querySelector(".move-selection");
    if (moveSelection) {
        moveSelection.style.display = "block";
    }
    
    clearGoalSelections();
    
    document.querySelectorAll(".zone").forEach(z => z.classList.remove("selected"));
    
    const centerPos = getPorterPosition(5);
    ["zoneIndicator1", "zoneIndicator2"].forEach(id => {
        const porter = document.getElementById(id);
        if (porter) {
            porter.className = "zone-indicator";
            porter.src = "img/p5.png";
            porter.style.left = `${centerPos.left}%`;
            porter.style.top = `${centerPos.top}%`;
            porter.style.transform = "translate(-50%, -50%) scale(0.22)";
        }
    });
    
    ["ball1", "ball2"].forEach(id => {
        const ball = document.getElementById(id);
        if (ball) ball.style.opacity = "0";
    });
    
    if (continueRoundBtn) continueRoundBtn.style.display = "none";
    if (replayAnimationBtn) replayAnimationBtn.style.display = "none";
    
    if (moveSelection) {
        moveSelection.style.opacity = "1";
        moveSelection.style.pointerEvents = "auto";
    }
    if (submitMoveBtn) {
        submitMoveBtn.disabled = true;
    }
    
    setTimeout(() => {
        setupGoalInteractivity(shootGoal, "shoot");
        setupGoalInteractivity(saveGoal, "save");
    }, 800);
}

function renderFinalStats() {
    const finalStatsEl = document.getElementById('finalStats');
    
    const statP1NameModalEl = document.getElementById('statP1NameModal');
    const statP2NameModalEl = document.getElementById('statP2NameModal');

    const p1Name = (document.querySelector('#player1Name .player-name-text') || {textContent: ''}).textContent;
    const p2Name = (document.querySelector('#player2Name .player-name-text') || {textContent: ''}).textContent;

    if (statP1NameModalEl) statP1NameModalEl.textContent = p1Name;
    if (statP2NameModalEl) statP2NameModalEl.textContent = p2Name;

    const p1 = statsUI.player1;
    const p2 = statsUI.player2;
    
    const statP1FullEl = document.getElementById('statP1FullModal');
    const statP1PartialEl = document.getElementById('statP1PartialModal');
    const statP1MissEl = document.getElementById('statP1MissModal');
    const statP2FullEl = document.getElementById('statP2FullModal');
    const statP2PartialEl = document.getElementById('statP2PartialModal');
    const statP2MissEl = document.getElementById('statP2MissModal');
    
    if (statP1FullEl) statP1FullEl.textContent = String(p1.full);
    if (statP1PartialEl) statP1PartialEl.textContent = String(p1.partial);
    if (statP1MissEl) statP1MissEl.textContent = String(p1.miss);
    if (statP2FullEl) statP2FullEl.textContent = String(p2.full);
    if (statP2PartialEl) statP2PartialEl.textContent = String(p2.partial);
    if (statP2MissEl) statP2MissEl.textContent = String(p2.miss);

    const pct1 = p1.attempts > 0 ? Math.round(((p1.full + p1.partial) / p1.attempts) * 100) : 0;
    const pct2 = p2.attempts > 0 ? Math.round(((p2.full + p2.partial) / p2.attempts) * 100) : 0;
    
    const statP1PctEl = document.getElementById('statP1PctModal');
    const statP2PctEl = document.getElementById('statP2PctModal');
    if (statP1PctEl) statP1PctEl.textContent = pct1 + '%';
    if (statP2PctEl) statP2PctEl.textContent = pct2 + '%';

    if (viewStatsBtn) {
        viewStatsBtn.classList.remove('hidden');
    }
}

/* ==================== 11. INICIALIZACIÓN AL CARGAR ==================== */

initializeGoals();

/* =================== 12. GARANTIZAR CLASE BODY AL CARGAR ==================== */

;(function ensureBodyScreenClassOnLoad() {
    function applyActiveScreen() {
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id) {
            // Usa showScreen para mantener la lógica consistente (limpia clases y aplica body class)
            try {
                showScreen(activeScreen.id);
            } catch (e) {
                // En caso de error (por ejemplo, showScreen no está definido aún), aplicar clase manualmente
                document.body.classList.add(activeScreen.id + '-active');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyActiveScreen);
    } else {
        applyActiveScreen();
    }
})();

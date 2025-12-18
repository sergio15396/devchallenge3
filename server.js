/* ==================== 1. IMPORTACIONES Y CONFIGURACIÓN ==================== */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ==================== 2. ESTADO GLOBAL ==================== */
const games = new Map(); // gameId -> { player1, player2, scores, currentRound, maxRounds }
const waitingPlayers = new Map(); // socketId -> { socket, playerName }

/* ==================== 3. FUNCIONES UTILITARIAS ==================== */

/**
 * Calcula la puntuación de un jugador en función de su tiro y la parada del oponente
 * @param {Object} shoot - Movimiento de tiro { height, direction }
 * @param {Object} save - Movimiento de parada { height, direction }
 * @returns {number} 2 puntos (total), 1 punto (parcial), 0 puntos (fallo)
 */
function calculateScore(shoot, save) {
    const heightMatch = shoot.height === save.height;
    const directionMatch = shoot.direction === save.direction;

    if (heightMatch && directionMatch) {
        return 2; // Acierta altura y dirección
    } else if (heightMatch || directionMatch) {
        return 1; // Acierta solo uno
    } else {
        return 0; // No acierta nada
    }
}

/**
 * Genera un ID único para una partida
 * @returns {string} ID de partida en formato aleatorio
 */
function createGameId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
}

/**
 * Inicializa o reinicializa el estado interno de una partida
 * @param {Object} game - Objeto de partida
 * @param {number} maxRounds - Número máximo de rondas (default: 1)
 */
function initializeGameState(game, maxRounds = 1) {
    game.maxRounds = maxRounds;
    game.currentRound = 0;
    game.moves = Array(maxRounds).fill(null);
    game.tiebreakerRequests = new Set();
    game.rematchRequests = new Set();
    game.status = 'playing';
}

/* ==================== 4. SOCKET.IO CONEXIÓN ==================== */
io.on('connection', (socket) => {
    console.log('Nou jugador connectat:', socket.id);

    /* ==================== 4.1 BÚSQUEDA DE PARTIDA ==================== */
    socket.on('findMatch', (playerName) => {
        if (waitingPlayers.size > 0) {
            // Hay un jugador esperando: crear partida inmediatamente
            const [waitingSocketId, waitingPlayer] = Array.from(waitingPlayers.entries())[0];
            const waitingSocket = waitingPlayer.socket;

            // Verificar que ambos sockets estén conectados antes de crear la partida
            const waitingSocketStillConnected = io.sockets.sockets.has(waitingSocketId);
            const currentSocketConnected = io.sockets.sockets.has(socket.id);

            if (!waitingSocketStillConnected || !currentSocketConnected) {
                // Si alguno de los sockets se desconectó, limpiar y añadir el nuevo jugador a la lista de espera
                if (!waitingSocketStillConnected) {
                    waitingPlayers.delete(waitingSocketId);
                    console.log(`Socket ${waitingSocketId} ya no está conectado, eliminado de la lista de espera`);
                }
                // Añadir el nuevo jugador a la lista de espera
                waitingPlayers.set(socket.id, { socket, playerName });
                socket.emit('waitingForMatch');
                console.log(`Jugador ${playerName} esperando partida...`);
                return;
            }

            // Crear partida
            const gameId = createGameId();
            const game = {
                player1: { socketId: waitingSocketId, name: waitingPlayer.playerName, score: 0 },
                player2: { socketId: socket.id, name: playerName, score: 0 }
            };

            // Inicializar el estado completo de la partida
            initializeGameState(game, 1);

            games.set(gameId, game);

            // Asignar jugadores a la sala
            waitingSocket.join(gameId);
            socket.join(gameId);

            // Eliminar de la lista de espera
            waitingPlayers.delete(waitingSocketId);

            // Notificar a ambos jugadores
            waitingSocket.emit('matchFound', { gameId, opponent: playerName, isPlayer1: true });
            socket.emit('matchFound', { gameId, opponent: waitingPlayer.playerName, isPlayer1: false });

            // Iniciar partida
            io.to(gameId).emit('gameStart', {
                gameId,
                player1: game.player1.name,
                player2: game.player2.name,
                maxRounds: game.maxRounds
            });

            console.log(`Partida creada: ${gameId} entre ${waitingPlayer.playerName} y ${playerName}`);
        } else {
            // Añadir a la lista de espera
            waitingPlayers.set(socket.id, { socket, playerName });
            socket.emit('waitingForMatch');
            console.log(`Jugador ${playerName} esperando partida...`);
        }
    });

    /* ==================== 4.2 ENVÍO DE MOVIMIENTOS ==================== */
    socket.on('makeMove', (data) => {
        const { gameId, shoot, save } = data;
        const game = games.get(gameId);

        if (!game) {
            socket.emit('error', { message: 'Partida no encontrada' });
            return;
        }

        const isPlayer1 = game.player1.socketId === socket.id;
        const playerKey = isPlayer1 ? 'player1' : 'player2';

        // Guardar movimiento
        if (!game.moves[game.currentRound]) {
            game.moves[game.currentRound] = {};
        }

        game.moves[game.currentRound][playerKey] = { shoot, save };

        // Verificar si ambos jugadores han realizado su movimiento
        const roundMoves = game.moves[game.currentRound];
        if (roundMoves.player1 && roundMoves.player2) {
            // Calcular puntuaciones
            const player1Score = calculateScore(roundMoves.player1.shoot, roundMoves.player2.save);
            const player2Score = calculateScore(roundMoves.player2.shoot, roundMoves.player1.save);

            game.player1.score += player1Score;
            game.player2.score += player2Score;

            // Enviar resultado de la ronda actual
            io.to(gameId).emit('roundResult', {
                round: game.currentRound + 1,
                player1Move: {
                    shoot: roundMoves.player1.shoot,
                    save: roundMoves.player1.save,
                    score: player1Score
                },
                player2Move: {
                    shoot: roundMoves.player2.shoot,
                    save: roundMoves.player2.save,
                    score: player2Score
                },
                totalScores: {
                    player1: game.player1.score,
                    player2: game.player2.score
                }
            });

            game.currentRound++;

            // Verificar si hemos completado todas las rondas según maxRounds dinámico
            if (game.currentRound >= game.maxRounds) {
                // Partida acabada - esperar a que las animaciones del cliente terminen
                const winner = game.player1.score > game.player2.score ? game.player1.name :
                    game.player2.score > game.player1.score ? game.player2.name : null;

                // Clear any previously scheduled end timeout to avoid duplicate emits
                if (game.endTimeoutId) {
                    clearTimeout(game.endTimeoutId);
                    delete game.endTimeoutId;
                }

                // Esperar 3500ms para que los clientes muestren la animación completa
                game.endTimeoutId = setTimeout(() => {
                    if (!games.has(gameId)) return;
                    const g = games.get(gameId);
                    if (!g) return;
                    if (g.currentRound < g.maxRounds) {
                        // Se añadió otra ronda (p. ej., desempate) — no terminar ahora
                        delete g.endTimeoutId;
                        return;
                    }

                    io.to(gameId).emit('gameEnd', {
                        winner,
                        finalScores: {
                            player1: { name: g.player1.name, score: g.player1.score },
                            player2: { name: g.player2.name, score: g.player2.score }
                        }
                    });

                    // Marcar el juego como terminado, pero permitir desempate
                    // No establecer status a 'finished' aquí para permitir desempate

                    // Limpiar partida después de un tiempo (solo si no hay desempate)
                    // Si hay empate, dar más tiempo (2 minutos) para permitir desempate
                    const deleteTimeout = winner === null ? 120000 : 30000; // 2 minutos si empate, 30 segundos si hay ganador
                    g.deleteTimeoutId = setTimeout(() => {
                        // Verificar si se solicitó desempate antes de eliminar
                        if (g.status === 'playing' && g.currentRound < g.maxRounds) {
                            return; // No eliminar si hay desempate pendiente
                        }
                        // Verificar si hay solicitudes de desempate pendientes
                        if (g.tiebreakerRequests && g.tiebreakerRequests.size > 0) {
                            return; // No eliminar si hay solicitudes de desempate
                        }
                        
                        // Notificar a los jugadores que la partida ha sido eliminada por timeout
                        io.to(gameId).emit('gameDeleted', { 
                            message: 'La partida ha expirado. Volviendo a la pantalla principal...' 
                        });
                        
                        games.delete(gameId);
                        console.log(`Game ${gameId} deleted after timeout`);
                    }, deleteTimeout);

                    delete g.endTimeoutId;
                }, 3500);
            } else {
                // Siguiente ronda disponible
                io.to(gameId).emit('nextRound', {
                    round: game.currentRound + 1,
                    maxRounds: game.maxRounds
                });
            }
        } else {
            // Esperando al otro jugador
            socket.emit('moveReceived', { waitingForOpponent: true });
        }
    });

    /* ==================== 4.3 SISTEMA DE DESEMPATE ==================== */
    socket.on('requestTiebreaker', (data) => {
        const { gameId } = data;
        const game = games.get(gameId);
        if (!game) {
            console.log(`Tiebreaker request but game ${gameId} not found`);
            socket.emit('tiebreakerNotAvailable', { message: 'Partida no encontrada' });
            return;
        }

        // Verificar que el juego no haya terminado definitivamente
        if (game.status === 'finished') {
            socket.emit('tiebreakerNotAvailable', { message: 'La partida ya ha terminado' });
            return;
        }

        if (!game.tiebreakerRequests) game.tiebreakerRequests = new Set();

        if (game.tiebreakerRequests.has(socket.id)) {
            socket.emit('waitingTiebreaker', { message: "Ya has solicitado desempate. Esperando al oponente..." });
            return;
        }

        console.log(`Tiebreaker request from ${socket.id} for game ${gameId}`);
        game.tiebreakerRequests.add(socket.id);

        // Cancelar timeout de eliminación cuando se solicita desempate (incluso si solo uno lo solicita)
        if (game.deleteTimeoutId) {
            clearTimeout(game.deleteTimeoutId);
            delete game.deleteTimeoutId;
            console.log(`Cancelled delete timeout for game ${gameId} due to tiebreaker request`);
        }

        // Confirmar al solicitante
        socket.emit('waitingTiebreaker', { message: "Has solicitado desempate. Esperando que el oponente también lo solicite..." });
        // Informar al otro jugador (excluyendo al solicitante)
        socket.to(gameId).emit('opponentRequestedTiebreaker', { requester: socket.id });

        // Verificar si ambos jugadores han solicitado desempate
        if (game.tiebreakerRequests.size === 2) {
            console.log(`Both players requested tiebreaker for game ${gameId}`);
            
            // Cancelar timeout de desempate si existe
            if (game.tiebreakerTimeoutId) {
                clearTimeout(game.tiebreakerTimeoutId);
                delete game.tiebreakerTimeoutId;
            }
            
            // Borrar solicitudes y cancelar cualquier fin programado
            game.tiebreakerRequests.clear();

            // Si había un timeout de fin pendiente, cancelarlo
            if (game.endTimeoutId) {
                clearTimeout(game.endTimeoutId);
                delete game.endTimeoutId;
            }
            if (game.deleteTimeoutId) {
                clearTimeout(game.deleteTimeoutId);
                delete game.deleteTimeoutId;
            }

            // Restablecer el estado del juego a 'playing' si estaba terminado
            game.status = 'playing';

            // Ampliar maxRounds y asegurar que el array de movimientos pueda contener la ronda extra
            game.maxRounds = game.currentRound + 1;
            while (game.moves.length < game.maxRounds) game.moves.push(null);

            console.log(`=== EMITIENDO tiebreakerRound ===`);
            console.log(`Game ID: ${gameId}`);
            console.log(`Round: ${game.currentRound + 1}`);
            console.log(`Max Rounds: ${game.maxRounds}`);
            console.log(`Jugadores en la sala: ${game.player1.name} y ${game.player2.name}`);
            
            io.to(gameId).emit('tiebreakerRound', {
                gameId: gameId,
                round: game.currentRound + 1,
                maxRounds: game.maxRounds
            });
            
            console.log(`Evento tiebreakerRound emitido a la sala ${gameId}`);
        } else {
            console.log(`Tiebreaker request received. Current requests: ${game.tiebreakerRequests.size}/2`);
            
            // Si solo un jugador ha solicitado desempate, iniciar timeout de 2 minutos
            // Si el otro jugador no acepta en ese tiempo, cancelar la solicitud y eliminar la partida
            if (game.tiebreakerTimeoutId) {
                clearTimeout(game.tiebreakerTimeoutId);
            }
            
            game.tiebreakerTimeoutId = setTimeout(() => {
                if (!games.has(gameId)) return;
                const g = games.get(gameId);
                if (!g) return;
                
                // Si ambos jugadores no han aceptado en 2 minutos, cancelar desempate
                if (g.tiebreakerRequests && g.tiebreakerRequests.size < 2) {
                    console.log(`Tiebreaker timeout for game ${gameId} - not all players accepted`);
                    
                    // Limpiar solicitudes de desempate
                    g.tiebreakerRequests.clear();
                    delete g.tiebreakerTimeoutId;
                    
                    // Programar eliminación de la partida después de un tiempo adicional
                    const winner = g.player1.score > g.player2.score ? g.player1.name :
                        g.player2.score > g.player1.score ? g.player2.name : null;
                    const deleteTimeout = winner === null ? 30000 : 30000; // 30 segundos adicionales
                    g.deleteTimeoutId = setTimeout(() => {
                        // Notificar a los jugadores que la partida ha sido eliminada por timeout
                        io.to(gameId).emit('gameDeleted', { 
                            message: 'La partida ha expirado. Volviendo a la pantalla principal...' 
                        });
                        
                        games.delete(gameId);
                        console.log(`Game ${gameId} deleted after tiebreaker timeout`);
                    }, deleteTimeout);
                }
            }, 120000); // 2 minutos para que el otro jugador acepte
        }
    });

    /* ==================== 4.4 SISTEMA DE REVANCHA ==================== */
    socket.on('requestRematch', (data) => {
        const { gameId } = data;
        const game = games.get(gameId);
        if (!game) {
            console.log(`Rematch request but game ${gameId} not found`);
            socket.emit('rematchNotAvailable', { message: 'Partida no encontrada' });
            return;
        }

        if (!game.rematchRequests) game.rematchRequests = new Set();

        // Evitar duplicados
        if (game.rematchRequests.has(socket.id)) {
            socket.emit('waitingRematch', { message: "Ya has solicitado jugar de nuevo. Esperando al oponente..." });
            return;
        }

        // Comprobar conexión de los dos sockets
        const s1 = io.sockets.sockets.get(game.player1.socketId);
        const s2 = io.sockets.sockets.get(game.player2.socketId);
        if (!s1 || !s2) {
            socket.emit('error', { message: "El oponente no está conectado. No se puede repetir la partida." });
            return;
        }

        console.log(`Rematch requested by ${socket.id} for game ${gameId}`);
        game.rematchRequests.add(socket.id);

        // Cancelar cualquier timeout de rematch anterior
        if (game.rematchTimeoutId) {
            clearTimeout(game.rematchTimeoutId);
            delete game.rematchTimeoutId;
        }

        // Confirmar al solicitante
        socket.emit('waitingRematch', { message: "Has solicitado jugar de nuevo. Esperando al oponente..." });
        // Informar al otro jugador
        io.to(gameId).emit('opponentRequestedRematch', { requester: socket.id });

        if (game.rematchRequests.size === 2) {
            console.log(`Both players requested rematch for game ${gameId}`);
            
            // Cancelar timeout de rematch si existe
            if (game.rematchTimeoutId) {
                clearTimeout(game.rematchTimeoutId);
                delete game.rematchTimeoutId;
            }
            
            // Resetear partida utilizando la inicialización centralizada
            if (game.endTimeoutId) {
                clearTimeout(game.endTimeoutId);
                delete game.endTimeoutId;
            }
            if (game.deleteTimeoutId) {
                clearTimeout(game.deleteTimeoutId);
                delete game.deleteTimeoutId;
            }

            initializeGameState(game, 1);
            game.player1.score = 0;
            game.player2.score = 0;

            console.log(`Game ${gameId} reinitialized for rematch. maxRounds=${game.maxRounds}`);

            io.to(gameId).emit('gameStart', {
                gameId,
                player1: game.player1.name,
                player2: game.player2.name,
                maxRounds: game.maxRounds
            });
        } else {
            // Si solo un jugador ha solicitado rematch, iniciar timeout de 30 segundos
            game.rematchTimeoutId = setTimeout(() => {
                if (!games.has(gameId)) return;
                const g = games.get(gameId);
                if (!g) return;
                
                // Si ambos jugadores no han aceptado en 30 segundos, cancelar rematch
                if (g.rematchRequests && g.rematchRequests.size < 2) {
                    console.log(`Rematch timeout for game ${gameId} - not all players accepted`);
                    
                    // Limpiar solicitudes de rematch
                    g.rematchRequests.clear();
                    delete g.rematchTimeoutId;
                    
                    // Notificar a ambos jugadores que el rematch fue cancelado
                    io.to(gameId).emit('rematchTimeout', {
                        message: 'El oponente no ha aceptado jugar de nuevo. Volviendo a la pantalla inicial...'
                    });
                }
            }, 30000); // 30 segundos
        }
    });

    /* ==================== 4.5 DESCONEXIÓN ==================== */
    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        // Eliminar de la lista de espera
        if (waitingPlayers.has(socket.id)) {
            waitingPlayers.delete(socket.id);
        }

        // Eliminar de partidas activas
        for (const [gameId, game] of games.entries()) {
            if (game.player1.socketId === socket.id || game.player2.socketId === socket.id) {
                // Cancelar cualquier timeout de rematch pendiente
                if (game.rematchTimeoutId) {
                    clearTimeout(game.rematchTimeoutId);
                    delete game.rematchTimeoutId;
                }
                
                // Cancelar cualquier timeout de desempate pendiente
                if (game.tiebreakerTimeoutId) {
                    clearTimeout(game.tiebreakerTimeoutId);
                    delete game.tiebreakerTimeoutId;
                }
                
                // Limpiar solicitudes de desempate del jugador desconectado
                if (game.tiebreakerRequests) {
                    game.tiebreakerRequests.delete(socket.id);
                }
                
                const opponentSocketId = game.player1.socketId === socket.id ?
                    game.player2.socketId : game.player1.socketId;
                io.to(opponentSocketId).emit('opponentDisconnected');
                games.delete(gameId);
                break;
            }
        }
    });
});

/* ==================== 5. INICIO DEL SERVIDOR ==================== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escoltant al port ${PORT}`);
    console.log(`Obre http://localhost:${PORT} al navegador`);
});

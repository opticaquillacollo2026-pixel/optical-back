// src/socket/index.js
const { Server } = require('socket.io');
const http = require('http');

let io = null;

/**
 * Inicializa el servidor WebSocket
 * @param {http.Server} server - Servidor HTTP de Express
 */
const initSocket = (server) => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:8080",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Middleware de autenticación
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token no proporcionado'));
    }
    // Aquí puedes validar el token si quieres
    socket.userId = socket.handshake.auth.userId;
    socket.negocioId = socket.handshake.auth.negocioId;
    socket.tiendaId = socket.handshake.auth.tiendaId;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Unirse a salas según negocio/tienda
    if (socket.negocioId) {
      socket.join(`negocio_${socket.negocioId}`);
    }
    if (socket.tiendaId && socket.tiendaId !== 'todas') {
      socket.join(`tienda_${socket.tiendaId}`);
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  console.log('✅ WebSocket Server inicializado');
  return io;
};

/**
 * Obtiene la instancia de io
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no inicializado');
  }
  return io;
};

/**
 * Emite un evento a todos los clientes o a una sala específica
 * @param {string} event - Nombre del evento
 * @param {*} data - Datos a enviar
 * @param {Object} options - Opciones de emisión
 * @param {string} options.room - Sala específica (opcional)
 * @param {string} options.negocioId - ID del negocio (opcional)
 * @param {string} options.tiendaId - ID de la tienda (opcional)
 */
const emitEvent = (event, data, options = {}) => {
  try {
    const socketIO = getIO();
    
    if (options.room) {
      socketIO.to(options.room).emit(event, data);
    } else if (options.negocioId) {
      const room = `negocio_${options.negocioId}`;
      socketIO.to(room).emit(event, data);
      // También emitir a todos para actualizaciones globales
      socketIO.emit(event, { ...data, _global: true });
    } else {
      socketIO.emit(event, data);
    }
  } catch (error) {
    console.error('Error emitiendo evento WebSocket:', error);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitEvent
};
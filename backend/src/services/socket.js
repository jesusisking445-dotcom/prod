const logger = require('../utils/logger');

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    socket.on('join-chat', (conversationId) => {
      socket.join(`chat-${conversationId}`);
      logger.debug(`User ${socket.id} joined chat ${conversationId}`);
    });

    socket.on('send-message', (data) => {
      io.to(`chat-${data.conversationId}`).emit('new-message', {
        id: data.id,
        sender: data.sender,
        content: data.content,
        timestamp: new Date(),
        conversationId: data.conversationId
      });
    });

    socket.on('typing', (data) => {
      socket.to(`chat-${data.conversationId}`).emit('user-typing', {
        userId: data.userId,
        conversationId: data.conversationId
      });
    });

    socket.on('stop-typing', (data) => {
      socket.to(`chat-${data.conversationId}`).emit('user-stop-typing', {
        userId: data.userId,
        conversationId: data.conversationId
      });
    });

    socket.on('message-read', (data) => {
      io.to(`chat-${data.conversationId}`).emit('message-read-receipt', {
        messageId: data.messageId,
        userId: data.userId
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: ${error}`);
    });
  });
};

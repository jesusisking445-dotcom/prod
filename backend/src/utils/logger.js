const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getTimestamp = () => new Date().toISOString();

const formatLog = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: getTimestamp(),
    level,
    message,
    ...meta
  });
};

const logger = {
  info: (message, meta) => {
    console.log(`[INFO] ${message}`);
    fs.appendFileSync(
      path.join(logsDir, 'app.log'),
      formatLog('INFO', message, meta) + '\n'
    );
  },

  error: (message, meta) => {
    console.error(`[ERROR] ${message}`);
    fs.appendFileSync(
      path.join(logsDir, 'error.log'),
      formatLog('ERROR', message, meta) + '\n'
    );
  },

  warn: (message, meta) => {
    console.warn(`[WARN] ${message}`);
    fs.appendFileSync(
      path.join(logsDir, 'app.log'),
      formatLog('WARN', message, meta) + '\n'
    );
  },

  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`);
    }
    fs.appendFileSync(
      path.join(logsDir, 'debug.log'),
      formatLog('DEBUG', message, meta) + '\n'
    );
  }
};

module.exports = logger;

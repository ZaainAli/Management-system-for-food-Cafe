const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Determine log directory — use a fallback if electron app is not available (e.g., during testing)
let logDir;
let isPackaged = false;
try {
  const { app } = require('electron');
  logDir = path.join(app.getPath('userData'), 'logs');
  isPackaged = app.isPackaged;
} catch {
  logDir = path.join(process.cwd(), 'logs');
}

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
    }),
  ],
});

// Add console transport only when stdout/stderr are available (avoid EPIPE in packaged apps)
const stdoutWritable = !!(process.stdout && process.stdout.writable && !process.stdout.destroyed);
const stderrWritable = !!(process.stderr && process.stderr.writable && !process.stderr.destroyed);
if (process.env.NODE_ENV !== 'production' && !isPackaged && stdoutWritable && stderrWritable) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;

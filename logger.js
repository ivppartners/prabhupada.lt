/**
 * Configurations of logger.
 */
const winston = require('winston');
require('winston-daily-rotate-file');

var transport1 = new winston.transports.DailyRotateFile({
  level: 'info',
  filename: './logs/access-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

var transport2 = new winston.transports.DailyRotateFile({
  level: 'error',
  filename: './logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

var consoleTransport = new winston.transports.Console({
  level: 'debug',
  handleExceptions: true,
  json: false,
  colorize: true
});

var logger = winston.createLogger({
  level: 'info',
  transports: [transport1, transport2, consoleTransport]
});

logger.info('Logger started');

module.exports = logger;

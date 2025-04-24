/**
 * Simple logger utility to break circular dependencies
 */

// Simple in-memory log queue for initialization phase
const logQueue: Array<{level: string, source: string, message: string}> = [];

// Flag to indicate if storage is ready
let storageReady = false;
let storageInstance: any = null;

/**
 * Initialize the logger with storage instance
 */
export function initLogger(storage: any) {
  storageReady = true;
  storageInstance = storage;
  
  // Process any queued logs
  while (logQueue.length > 0) {
    const log = logQueue.shift();
    if (log) {
      storageInstance.createLog(log).catch((error: Error) => {
        console.error('Failed to process queued log:', error);
      });
    }
  }
}

/**
 * Log a message - will queue it if storage is not yet ready
 */
export function log(level: string, source: string, message: string) {
  const logEntry = { level, source, message };
  
  if (storageReady && storageInstance) {
    storageInstance.createLog(logEntry).catch((error: Error) => {
      console.error('Failed to log message:', error);
    });
  } else {
    // Queue for later processing
    logQueue.push(logEntry);
    // Also log to console during initialization
    console.log(`[${level}] [${source}] ${message}`);
  }
}

// Convenience methods
export const logInfo = (source: string, message: string) => log('INFO', source, message);
export const logWarn = (source: string, message: string) => log('WARN', source, message);
export const logError = (source: string, message: string) => log('ERROR', source, message);
export const logDebug = (source: string, message: string) => log('DEBUG', source, message);
// Sistema de logging avanzado y métricas para IOSoccer Bot
const fs = require('fs');
const path = require('path');

class AdvancedLogger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'logs');
        this.metricsFile = path.join(this.logDir, 'metrics.json');
        this.errorFile = path.join(this.logDir, 'errors.log');
        this.infoFile = path.join(this.logDir, 'info.log');
        this.debugFile = path.join(this.logDir, 'debug.log');
        
        // Crear directorio de logs si no existe
        this.ensureLogDir();
        
        // Métricas del sistema
        this.metrics = this.loadMetrics();
        
        // Buffer para logs (para mejor rendimiento)
        this.logBuffer = [];
        this.bufferFlushInterval = setInterval(() => this.flushLogBuffer(), 5000);
    }
    
    ensureLogDir() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.error('No se pudo crear directorio de logs:', error.message);
        }
    }
    
    loadMetrics() {
        try {
            if (fs.existsSync(this.metricsFile)) {
                return JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error cargando métricas:', error.message);
        }
        
        // Métricas por defecto
        return {
            startTime: Date.now(),
            totalQueries: 0,
            successfulQueries: 0,
            failedQueries: 0,
            jsonRepairs: 0,
            cacheHits: 0,
            cacheMisses: 0,
            serverStats: {},
            errors: {},
            performance: {
                avgResponseTime: 0,
                slowestQuery: { time: 0, server: '', timestamp: 0 },
                fastestQuery: { time: Infinity, server: '', timestamp: 0 }
            }
        };
    }
    
    saveMetrics() {
        try {
            fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
        } catch (error) {
            console.error('Error guardando métricas:', error.message);
        }
    }
    
    log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            metadata,
            pid: process.pid
        };
        
        // Console output con colores
        const coloredMessage = this.colorizeLog(level, `[${timestamp}] [${level.toUpperCase()}] ${message}`);
        console.log(coloredMessage);
        
        // Agregar al buffer
        this.logBuffer.push(logEntry);
        
        // Flush inmediato para errores críticos
        if (level === 'ERROR' || level === 'FATAL') {
            this.flushLogBuffer();
        }
        
        // Actualizar métricas
        if (level === 'ERROR') {
            this.updateErrorMetrics(message, metadata);
        }
    }
    
    colorizeLog(level, message) {
        const colors = {
            'ERROR': '\x1b[31m',   // Rojo
            'FATAL': '\x1b[41m',   // Fondo rojo
            'WARNING': '\x1b[33m', // Amarillo
            'INFO': '\x1b[36m',    // Cian
            'DEBUG': '\x1b[37m',   // Blanco
            'SUCCESS': '\x1b[32m'  // Verde
        };
        
        const color = colors[level] || '\x1b[0m';
        return `${color}${message}\x1b[0m`;
    }
    
    flushLogBuffer() {
        if (this.logBuffer.length === 0) return;
        
        try {
            const entries = [...this.logBuffer];
            this.logBuffer = [];
            
            // Separar por nivel de log
            const errorEntries = entries.filter(e => e.level === 'ERROR' || e.level === 'FATAL');
            const infoEntries = entries.filter(e => e.level === 'INFO' || e.level === 'SUCCESS');
            const debugEntries = entries.filter(e => e.level === 'DEBUG' || e.level === 'WARNING');
            
            // Escribir a archivos correspondientes
            if (errorEntries.length > 0) {
                this.appendToFile(this.errorFile, errorEntries);
            }
            if (infoEntries.length > 0) {
                this.appendToFile(this.infoFile, infoEntries);
            }
            if (debugEntries.length > 0) {
                this.appendToFile(this.debugFile, debugEntries);
            }
            
        } catch (error) {
            console.error('Error escribiendo logs:', error.message);
        }
    }
    
    appendToFile(filename, entries) {
        try {
            const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
            fs.appendFileSync(filename, logLines);
        } catch (error) {
            console.error(`Error escribiendo a ${filename}:`, error.message);
        }
    }
    
    updateErrorMetrics(message, metadata) {
        const errorKey = this.categorizeError(message);
        this.metrics.errors[errorKey] = (this.metrics.errors[errorKey] || 0) + 1;
        this.saveMetrics();
    }
    
    categorizeError(message) {
        if (message.includes('timeout') || message.includes('Timeout')) return 'timeouts';
        if (message.includes('RCON') || message.includes('connection')) return 'connection_errors';
        if (message.includes('JSON') || message.includes('parse')) return 'json_errors';
        if (message.includes('A2S')) return 'a2s_errors';
        return 'other_errors';
    }
    
    // Métodos de conveniencia
    error(message, metadata = {}) {
        this.log('ERROR', message, metadata);
    }
    
    warning(message, metadata = {}) {
        this.log('WARNING', message, metadata);
    }
    
    info(message, metadata = {}) {
        this.log('INFO', message, metadata);
    }
    
    debug(message, metadata = {}) {
        this.log('DEBUG', message, metadata);
    }
    
    success(message, metadata = {}) {
        this.log('SUCCESS', message, metadata);
    }
    
    fatal(message, metadata = {}) {
        this.log('FATAL', message, metadata);
    }
    
    // Métricas específicas
    recordQuery(serverName, success, responseTime, metadata = {}) {
        this.metrics.totalQueries++;
        
        if (success) {
            this.metrics.successfulQueries++;
        } else {
            this.metrics.failedQueries++;
        }
        
        // Actualizar estadísticas del servidor
        if (!this.metrics.serverStats[serverName]) {
            this.metrics.serverStats[serverName] = {
                queries: 0,
                successes: 0,
                failures: 0,
                avgResponseTime: 0,
                lastSuccess: null,
                lastFailure: null
            };
        }
        
        const serverStats = this.metrics.serverStats[serverName];
        serverStats.queries++;
        
        if (success) {
            serverStats.successes++;
            serverStats.lastSuccess = Date.now();
        } else {
            serverStats.failures++;
            serverStats.lastFailure = Date.now();
        }
        
        // Actualizar tiempos de respuesta
        if (responseTime > 0) {
            const oldAvg = this.metrics.performance.avgResponseTime;
            const totalQueries = this.metrics.totalQueries;
            this.metrics.performance.avgResponseTime = ((oldAvg * (totalQueries - 1)) + responseTime) / totalQueries;
            
            serverStats.avgResponseTime = ((serverStats.avgResponseTime * (serverStats.queries - 1)) + responseTime) / serverStats.queries;
            
            // Actualizar récords
            if (responseTime > this.metrics.performance.slowestQuery.time) {
                this.metrics.performance.slowestQuery = {
                    time: responseTime,
                    server: serverName,
                    timestamp: Date.now()
                };
            }
            
            if (responseTime < this.metrics.performance.fastestQuery.time) {
                this.metrics.performance.fastestQuery = {
                    time: responseTime,
                    server: serverName,
                    timestamp: Date.now()
                };
            }
        }
        
        this.saveMetrics();
        
        this.debug(`Query recorded`, {
            server: serverName,
            success,
            responseTime,
            ...metadata
        });
    }
    
    recordJsonRepair(serverName, repairType, originalSize, repairedSize) {
        this.metrics.jsonRepairs++;
        this.info(`JSON reparado exitosamente`, {
            server: serverName,
            repairType,
            originalSize,
            repairedSize,
            reduction: originalSize - repairedSize
        });
        this.saveMetrics();
    }
    
    recordCacheEvent(type, key, metadata = {}) {
        if (type === 'hit') {
            this.metrics.cacheHits++;
        } else if (type === 'miss') {
            this.metrics.cacheMisses++;
        }
        
        this.debug(`Cache ${type}`, { key, ...metadata });
        this.saveMetrics();
    }
    
    getMetricsReport() {
        const uptime = Date.now() - this.metrics.startTime;
        const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
        
        const report = {
            uptime: `${uptimeHours} horas`,
            queries: {
                total: this.metrics.totalQueries,
                successful: this.metrics.successfulQueries,
                failed: this.metrics.failedQueries,
                successRate: this.metrics.totalQueries > 0 
                    ? `${((this.metrics.successfulQueries / this.metrics.totalQueries) * 100).toFixed(2)}%`
                    : '0%'
            },
            performance: {
                avgResponseTime: `${this.metrics.performance.avgResponseTime.toFixed(2)}ms`,
                slowestQuery: `${this.metrics.performance.slowestQuery.time.toFixed(2)}ms (${this.metrics.performance.slowestQuery.server})`,
                fastestQuery: this.metrics.performance.fastestQuery.time !== Infinity 
                    ? `${this.metrics.performance.fastestQuery.time.toFixed(2)}ms (${this.metrics.performance.fastestQuery.server})`
                    : 'N/A'
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
                    ? `${((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2)}%`
                    : '0%'
            },
            repairs: this.metrics.jsonRepairs,
            errors: this.metrics.errors,
            servers: Object.keys(this.metrics.serverStats).map(name => ({
                name,
                ...this.metrics.serverStats[name],
                successRate: `${((this.metrics.serverStats[name].successes / this.metrics.serverStats[name].queries) * 100).toFixed(2)}%`
            }))
        };
        
        return report;
    }
    
    cleanup() {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
        }
        this.flushLogBuffer();
        this.saveMetrics();
    }
}

// Singleton instance
const logger = new AdvancedLogger();

// Cleanup en exit
process.on('exit', () => logger.cleanup());
process.on('SIGINT', () => {
    logger.info('Recibida señal SIGINT, cerrando logger...');
    logger.cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('Recibida señal SIGTERM, cerrando logger...');
    logger.cleanup();
    process.exit(0);
});

module.exports = logger;

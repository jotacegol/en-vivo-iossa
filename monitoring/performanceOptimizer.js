const logger = require('./logger');
const metrics = require('./metrics');
const cache = require('./cache');

/**
 * Sistema avanzado de optimización de rendimiento para IOSoccer Bot
 * Gestiona recursos, optimiza consultas y mejora el rendimiento general
 */
class PerformanceOptimizer {
    
    constructor() {
        this.initialized = false;
        this.optimizations = new Map();
        this.resourceMonitor = null;
        this.performanceHistory = [];
        this.thresholds = {
            memory: {
                warning: 500 * 1024 * 1024, // 500MB
                critical: 1024 * 1024 * 1024 // 1GB
            },
            cpu: {
                warning: 70, // 70%
                critical: 90  // 90%
            },
            responseTime: {
                fast: 100,    // < 100ms
                medium: 500,  // 100-500ms
                slow: 1000,   // 500ms-1s
                critical: 5000 // > 5s
            }
        };
    }

    /**
     * Inicializa el optimizador de rendimiento
     * @param {Object} config - Configuración del optimizador
     */
    initialize(config = {}) {
        if (this.initialized) {
            logger.warning('Performance optimizer already initialized');
            return;
        }

        try {
            // Configurar thresholds personalizados
            if (config.thresholds) {
                this.thresholds = { ...this.thresholds, ...config.thresholds };
            }

            // Iniciar monitoreo de recursos
            this.startResourceMonitoring();

            // Configurar optimizaciones automáticas
            this.setupAutoOptimizations();

            // Configurar limpieza periódica
            this.setupPeriodicCleanup();

            this.initialized = true;
            logger.info('Performance optimizer initialized successfully', {
                thresholds: this.thresholds,
                autoOptimizations: true
            });

        } catch (error) {
            logger.error('Failed to initialize performance optimizer', error);
            throw error;
        }
    }

    /**
     * Inicia el monitoreo continuo de recursos del sistema
     */
    startResourceMonitoring() {
        // Monitorear cada 30 segundos
        this.resourceMonitor = setInterval(() => {
            this.collectPerformanceMetrics();
        }, 30000);

        // Colectar métricas iniciales
        this.collectPerformanceMetrics();
    }

    /**
     * Recolecta métricas de rendimiento del sistema
     */
    collectPerformanceMetrics() {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const timestamp = Date.now();

            const metricsData = {
                timestamp,
                memory: {
                    rss: memUsage.rss,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime(),
                activeConnections: this.getActiveConnectionCount(),
                cacheStats: cache.getStats(),
                queryStats: this.getQueryStats()
            };

            // Guardar en historial (mantener solo las últimas 100 entradas)
            this.performanceHistory.push(metricsData);
            if (this.performanceHistory.length > 100) {
                this.performanceHistory.shift();
            }

            // Registrar métricas en el sistema de metrics
            metrics.recordGauge('memory_usage_rss', memUsage.rss);
            metrics.recordGauge('memory_usage_heap', memUsage.heapUsed);
            metrics.recordGauge('cpu_usage_user', cpuUsage.user);
            metrics.recordGauge('cpu_usage_system', cpuUsage.system);
            metrics.recordGauge('uptime_seconds', process.uptime());

            // Verificar y aplicar optimizaciones si es necesario
            this.checkAndApplyOptimizations(metricsData);

        } catch (error) {
            logger.error('Error collecting performance metrics', error);
        }
    }

    /**
     * Verifica métricas y aplica optimizaciones automáticas
     * @param {Object} metricsData - Datos de métricas actuales
     */
    checkAndApplyOptimizations(metricsData) {
        // Optimización de memoria
        if (metricsData.memory.rss > this.thresholds.memory.warning) {
            this.optimizeMemoryUsage(metricsData);
        }

        // Optimización de cache
        if (metricsData.cacheStats.hitRate < 0.7) { // < 70% hit rate
            this.optimizeCacheStrategy();
        }

        // Optimización de conexiones
        if (metricsData.activeConnections > 50) {
            this.optimizeConnectionPooling();
        }

        // Garbage collection sugerido
        if (metricsData.memory.heapUsed > this.thresholds.memory.warning) {
            this.suggestGarbageCollection();
        }
    }

    /**
     * Optimiza el uso de memoria
     * @param {Object} metricsData - Datos de métricas
     */
    optimizeMemoryUsage(metricsData) {
        const optimizationKey = 'memory_optimization';
        
        // Evitar optimizar demasiado frecuentemente
        if (this.optimizations.has(optimizationKey)) {
            const lastOptimization = this.optimizations.get(optimizationKey);
            if (Date.now() - lastOptimization < 60000) { // 1 minuto
                return;
            }
        }

        logger.info('Applying memory optimization', {
            currentMemory: Math.round(metricsData.memory.rss / 1024 / 1024) + 'MB',
            threshold: Math.round(this.thresholds.memory.warning / 1024 / 1024) + 'MB'
        });

        // Limpiar cache expirado
        cache.cleanup();

        // Limpiar historial de rendimiento si es muy grande
        if (this.performanceHistory.length > 50) {
            this.performanceHistory.splice(0, this.performanceHistory.length - 50);
        }

        // Sugerir garbage collection si está disponible
        if (global.gc) {
            global.gc();
            logger.debug('Garbage collection triggered');
        }

        this.optimizations.set(optimizationKey, Date.now());
        metrics.incrementCounter('optimization_applied', { type: 'memory' });
    }

    /**
     * Optimiza la estrategia de cache
     */
    optimizeCacheStrategy() {
        const optimizationKey = 'cache_optimization';
        
        if (this.optimizations.has(optimizationKey)) {
            const lastOptimization = this.optimizations.get(optimizationKey);
            if (Date.now() - lastOptimization < 120000) { // 2 minutos
                return;
            }
        }

        logger.info('Optimizing cache strategy');

        // Obtener estadísticas del cache
        const stats = cache.getStats();
        
        // Si el hit rate es bajo, ajustar TTLs
        if (stats.hitRate < 0.5) {
            logger.info('Low cache hit rate detected, extending TTL for frequently accessed items');
            // Nota: Esta funcionalidad se implementaría en el cache
            cache.optimizeTTL();
        }

        // Limpiar entradas menos usadas
        cache.evictLeastUsed();

        this.optimizations.set(optimizationKey, Date.now());
        metrics.incrementCounter('optimization_applied', { type: 'cache' });
    }

    /**
     * Optimiza el pooling de conexiones
     */
    optimizeConnectionPooling() {
        const optimizationKey = 'connection_optimization';
        
        if (this.optimizations.has(optimizationKey)) {
            const lastOptimization = this.optimizations.get(optimizationKey);
            if (Date.now() - lastOptimization < 180000) { // 3 minutos
                return;
            }
        }

        logger.info('Optimizing connection pooling');

        // Nota: Esta funcionalidad se implementaría con un pool de conexiones real
        // Por ahora, registramos la necesidad de optimización
        
        this.optimizations.set(optimizationKey, Date.now());
        metrics.incrementCounter('optimization_applied', { type: 'connections' });
    }

    /**
     * Sugiere ejecución de garbage collection
     */
    suggestGarbageCollection() {
        const optimizationKey = 'gc_suggestion';
        
        if (this.optimizations.has(optimizationKey)) {
            const lastSuggestion = this.optimizations.get(optimizationKey);
            if (Date.now() - lastSuggestion < 300000) { // 5 minutos
                return;
            }
        }

        if (global.gc) {
            global.gc();
            logger.debug('Garbage collection executed');
            metrics.incrementCounter('gc_triggered');
        } else {
            logger.debug('Garbage collection suggested but not available');
        }

        this.optimizations.set(optimizationKey, Date.now());
    }

    /**
     * Configura optimizaciones automáticas
     */
    setupAutoOptimizations() {
        // Optimización cada 5 minutos
        setInterval(() => {
            this.performScheduledOptimizations();
        }, 5 * 60 * 1000);

        logger.debug('Auto-optimizations scheduled every 5 minutes');
    }

    /**
     * Realiza optimizaciones programadas
     */
    performScheduledOptimizations() {
        try {
            // Limpiar cache expirado
            const cacheCleanup = cache.cleanup();
            
            // Optimizar métricas
            metrics.cleanup();

            // Limpiar logs antiguos si hay demasiados en memoria
            logger.cleanup();

            logger.debug('Scheduled optimizations completed', {
                cacheEntriesRemoved: cacheCleanup.removed,
                timestamp: new Date().toISOString()
            });

            metrics.incrementCounter('scheduled_optimization_completed');

        } catch (error) {
            logger.error('Error during scheduled optimization', error);
        }
    }

    /**
     * Configura limpieza periódica de recursos
     */
    setupPeriodicCleanup() {
        // Limpieza profunda cada hora
        setInterval(() => {
            this.performDeepCleanup();
        }, 60 * 60 * 1000);

        logger.debug('Deep cleanup scheduled every hour');
    }

    /**
     * Realiza limpieza profunda de recursos
     */
    performDeepCleanup() {
        try {
            const startTime = Date.now();

            // Limpiar historial de rendimiento muy antiguo
            if (this.performanceHistory.length > 50) {
                this.performanceHistory.splice(0, this.performanceHistory.length - 50);
            }

            // Limpiar optimizaciones muy antiguas
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            for (const [key, timestamp] of this.optimizations.entries()) {
                if (timestamp < oneHourAgo) {
                    this.optimizations.delete(key);
                }
            }

            // Ejecutar garbage collection si está disponible
            if (global.gc) {
                global.gc();
            }

            const duration = Date.now() - startTime;
            logger.info('Deep cleanup completed', {
                duration: duration + 'ms',
                performanceHistorySize: this.performanceHistory.length,
                activeOptimizations: this.optimizations.size
            });

            metrics.incrementCounter('deep_cleanup_completed');
            metrics.recordHistogram('deep_cleanup_duration', duration);

        } catch (error) {
            logger.error('Error during deep cleanup', error);
        }
    }

    // =================== MÉTODOS DE ANÁLISIS ===================

    /**
     * Analiza el rendimiento de consultas
     * @param {string} operation - Tipo de operación
     * @param {number} duration - Duración en milisegundos
     * @param {boolean} success - Si la operación fue exitosa
     */
    analyzeQueryPerformance(operation, duration, success) {
        // Clasificar rendimiento
        let performanceLevel = 'critical';
        if (duration < this.thresholds.responseTime.fast) {
            performanceLevel = 'excellent';
        } else if (duration < this.thresholds.responseTime.medium) {
            performanceLevel = 'good';
        } else if (duration < this.thresholds.responseTime.slow) {
            performanceLevel = 'fair';
        } else if (duration < this.thresholds.responseTime.critical) {
            performanceLevel = 'poor';
        }

        // Registrar métricas
        metrics.recordHistogram('query_performance', duration, {
            operation,
            level: performanceLevel,
            success: success.toString()
        });

        // Log si el rendimiento es preocupante
        if (performanceLevel === 'poor' || performanceLevel === 'critical') {
            logger.warning('Poor query performance detected', {
                operation,
                duration: duration + 'ms',
                level: performanceLevel,
                success
            });
        }

        return performanceLevel;
    }

    /**
     * Obtiene estadísticas de rendimiento
     * @returns {Object} Estadísticas completas
     */
    getPerformanceStats() {
        const currentMetrics = this.performanceHistory.length > 0 
            ? this.performanceHistory[this.performanceHistory.length - 1]
            : null;

        const memoryUsageMB = currentMetrics 
            ? Math.round(currentMetrics.memory.rss / 1024 / 1024)
            : 0;

        return {
            current: {
                memory: {
                    usedMB: memoryUsageMB,
                    heapUsedMB: currentMetrics 
                        ? Math.round(currentMetrics.memory.heapUsed / 1024 / 1024)
                        : 0,
                    status: this.getMemoryStatus(currentMetrics?.memory.rss || 0)
                },
                uptime: Math.round(process.uptime()),
                activeConnections: currentMetrics?.activeConnections || 0,
                cache: currentMetrics?.cacheStats || cache.getStats()
            },
            history: {
                dataPoints: this.performanceHistory.length,
                timeSpan: this.performanceHistory.length > 0 
                    ? Math.round((Date.now() - this.performanceHistory[0].timestamp) / 1000 / 60) + ' minutes'
                    : 'No data'
            },
            optimizations: {
                applied: this.optimizations.size,
                lastOptimization: this.getLastOptimizationTime()
            },
            thresholds: this.thresholds,
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * Obtiene el estado de la memoria
     * @param {number} memoryUsage - Uso actual de memoria
     * @returns {string} Estado de la memoria
     */
    getMemoryStatus(memoryUsage) {
        if (memoryUsage > this.thresholds.memory.critical) {
            return 'CRITICAL';
        } else if (memoryUsage > this.thresholds.memory.warning) {
            return 'WARNING';
        } else {
            return 'OK';
        }
    }

    /**
     * Obtiene la hora de la última optimización
     * @returns {string} Tiempo desde la última optimización
     */
    getLastOptimizationTime() {
        if (this.optimizations.size === 0) {
            return 'Never';
        }

        let lastTime = 0;
        for (const timestamp of this.optimizations.values()) {
            if (timestamp > lastTime) {
                lastTime = timestamp;
            }
        }

        const minutesAgo = Math.round((Date.now() - lastTime) / 1000 / 60);
        return minutesAgo + ' minutes ago';
    }

    /**
     * Genera recomendaciones de optimización
     * @returns {Array} Lista de recomendaciones
     */
    generateRecommendations() {
        const recommendations = [];
        const currentMetrics = this.performanceHistory.length > 0 
            ? this.performanceHistory[this.performanceHistory.length - 1]
            : null;

        if (!currentMetrics) {
            return ['No hay suficientes datos para generar recomendaciones'];
        }

        // Recomendaciones de memoria
        if (currentMetrics.memory.rss > this.thresholds.memory.warning) {
            recommendations.push('Considerar aumentar la frecuencia de limpieza de memoria');
        }

        // Recomendaciones de cache
        if (currentMetrics.cacheStats.hitRate < 0.7) {
            recommendations.push('Optimizar estrategia de cache para mejorar hit rate');
        }

        if (currentMetrics.cacheStats.size > 1000) {
            recommendations.push('Considerar reducir el tamaño máximo del cache');
        }

        // Recomendaciones de conexiones
        if (currentMetrics.activeConnections > 30) {
            recommendations.push('Implementar pooling de conexiones más eficiente');
        }

        // Recomendaciones de uptime
        if (currentMetrics.uptime > 7 * 24 * 60 * 60) { // 7 días
            recommendations.push('Considerar reinicio programado para liberar recursos');
        }

        if (recommendations.length === 0) {
            recommendations.push('El rendimiento está dentro de los parámetros normales');
        }

        return recommendations;
    }

    // =================== MÉTODOS AUXILIARES ===================

    /**
     * Obtiene el número de conexiones activas
     * @returns {number} Número de conexiones activas
     */
    getActiveConnectionCount() {
        // Nota: En una implementación real, esto obtendría el conteo real de conexiones
        return Math.floor(Math.random() * 10); // Simulación
    }

    /**
     * Obtiene estadísticas de consultas
     * @returns {Object} Estadísticas de consultas
     */
    getQueryStats() {
        return {
            total: metrics.getCounter('query_success') + metrics.getCounter('query_error'),
            successful: metrics.getCounter('query_success'),
            failed: metrics.getCounter('query_error'),
            averageResponseTime: metrics.getHistogramAverage('query_duration') || 0
        };
    }

    /**
     * Detiene el optimizador y limpia recursos
     */
    shutdown() {
        if (this.resourceMonitor) {
            clearInterval(this.resourceMonitor);
            this.resourceMonitor = null;
        }

        // Limpiar todas las optimizaciones programadas
        // Nota: En una implementación real, se limpiarían todos los intervalos

        this.initialized = false;
        logger.info('Performance optimizer shut down');
    }

    /**
     * Fuerza una optimización inmediata
     * @param {string} type - Tipo de optimización ('memory', 'cache', 'all')
     */
    forceOptimization(type = 'all') {
        logger.info(`Forcing ${type} optimization`);

        switch (type) {
            case 'memory':
                this.optimizeMemoryUsage({ memory: { rss: this.thresholds.memory.warning + 1 } });
                break;
            case 'cache':
                this.optimizeCacheStrategy();
                break;
            case 'connections':
                this.optimizeConnectionPooling();
                break;
            case 'all':
                this.optimizeMemoryUsage({ memory: { rss: this.thresholds.memory.warning + 1 } });
                this.optimizeCacheStrategy();
                this.optimizeConnectionPooling();
                this.performScheduledOptimizations();
                break;
            default:
                logger.warning('Unknown optimization type:', type);
        }

        metrics.incrementCounter('forced_optimization', { type });
    }
}

// Crear instancia singleton
const performanceOptimizer = new PerformanceOptimizer();

// Exportar la instancia y la clase
module.exports = {
    PerformanceOptimizer,
    optimizer: performanceOptimizer
};

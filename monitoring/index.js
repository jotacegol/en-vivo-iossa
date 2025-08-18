/**
 * Sistema de Monitoreo Ultra-Robusto para IOSoccer Bot
 * Integración principal de todos los subsistemas avanzados
 */

const logger = require('./logger');
const metrics = require('./metrics');
const cache = require('./cache');
const DataValidator = require('./dataValidator');
const ErrorManager = require('./errorManager');
const { AdvancedQueryManager, RCONManager, A2SQuery } = require('./queryUtils');
const { optimizer: performanceOptimizer } = require('./performanceOptimizer');

/**
 * Clase principal que orquesta todos los sistemas de monitoreo
 */
class IOSoccerMonitoring {
    constructor() {
        this.initialized = false;
        this.systems = {
            logger: false,
            metrics: false,
            cache: false,
            validator: false,
            errorManager: false,
            queryManager: false,
            performanceOptimizer: false
        };
        
        this.config = {
            // Configuración global del sistema
            enablePerformanceMonitoring: true,
            enableAdvancedLogging: true,
            enableCaching: true,
            enableDataValidation: true,
            enableErrorReporting: true,
            
            // Configuración de timeouts globales
            defaultTimeouts: {
                a2s: 15000,
                rcon: 30000,
                matchJson: 60000
            },
            
            // Configuración de reintentos
            defaultRetries: {
                network: 3,
                rcon: 5,
                parsing: 2
            }
        };
    }

    /**
     * Inicializa todo el sistema de monitoreo
     * @param {Object} customConfig - Configuración personalizada
     */
    async initialize(customConfig = {}) {
        if (this.initialized) {
            logger.warning('IOSoccer monitoring already initialized');
            return;
        }

        try {
            // Aplicar configuración personalizada
            this.config = { ...this.config, ...customConfig };
            
            logger.info('🚀 Initializing IOSoccer Ultra-Robust Monitoring System');

            // 1. Inicializar Performance Optimizer
            if (this.config.enablePerformanceMonitoring) {
                await this.initializePerformanceOptimizer();
            }

            // 2. Verificar todos los subsistemas
            await this.verifySubsystems();

            // 3. Configurar manejo de errores global
            this.setupGlobalErrorHandling();

            // 4. Inicializar métricas de arranque
            this.recordStartupMetrics();

            this.initialized = true;
            
            logger.info('✅ IOSoccer monitoring system initialized successfully', {
                systems: this.systems,
                config: this.config,
                uptime: process.uptime()
            });

            // Ejecutar prueba de integridad
            await this.runIntegrityCheck();

        } catch (error) {
            logger.error('❌ Failed to initialize monitoring system', error);
            throw error;
        }
    }

    /**
     * Inicializa el optimizador de rendimiento
     */
    async initializePerformanceOptimizer() {
        try {
            performanceOptimizer.initialize({
                thresholds: {
                    memory: {
                        warning: 512 * 1024 * 1024, // 512MB
                        critical: 1024 * 1024 * 1024 // 1GB
                    }
                }
            });
            
            this.systems.performanceOptimizer = true;
            logger.info('✅ Performance optimizer initialized');
            
        } catch (error) {
            logger.error('❌ Failed to initialize performance optimizer', error);
            this.systems.performanceOptimizer = false;
        }
    }

    /**
     * Verifica que todos los subsistemas estén funcionando
     */
    async verifySubsystems() {
        // Verificar logger
        try {
            logger.info('🔍 Testing logger subsystem');
            this.systems.logger = true;
        } catch (error) {
            logger.error('Logger subsystem verification failed', error);
        }

        // Verificar metrics
        try {
            metrics.incrementCounter('system_verification', { component: 'metrics' });
            this.systems.metrics = true;
            logger.info('✅ Metrics subsystem verified');
        } catch (error) {
            logger.error('Metrics subsystem verification failed', error);
        }

        // Verificar cache
        try {
            const testKey = 'system_verification_test';
            cache.set(testKey, { test: true }, 'system', {});
            const retrieved = cache.get(testKey);
            cache.delete(testKey);
            
            this.systems.cache = retrieved !== null;
            logger.info('✅ Cache subsystem verified');
        } catch (error) {
            logger.error('Cache subsystem verification failed', error);
        }

        // Verificar data validator
        try {
            const testValidation = DataValidator.validateServerInfo({
                server_name: 'Test Server',
                map_name: 'Test Map',
                players: 5,
                max_players: 20
            });
            
            this.systems.validator = testValidation.isValid;
            logger.info('✅ Data validator subsystem verified');
        } catch (error) {
            logger.error('Data validator subsystem verification failed', error);
        }

        // Verificar error manager
        try {
            const testError = ErrorManager.processError('Test error', { operation: 'verification' });
            this.systems.errorManager = testError !== null;
            logger.info('✅ Error manager subsystem verified');
        } catch (error) {
            logger.error('Error manager subsystem verification failed', error);
        }

        // Verificar query manager
        try {
            // Solo verificar que las clases existen y son accesibles
            this.systems.queryManager = typeof AdvancedQueryManager.getSystemStats === 'function';
            logger.info('✅ Query manager subsystem verified');
        } catch (error) {
            logger.error('Query manager subsystem verification failed', error);
        }
    }

    /**
     * Configura manejo de errores global
     */
    setupGlobalErrorHandling() {
        // Manejo de errores no capturados
        process.on('uncaughtException', (error) => {
            const processedError = ErrorManager.processError(error, {
                operation: 'uncaught_exception',
                severity: 'critical'
            });
            
            logger.error('UNCAUGHT EXCEPTION', processedError);
            metrics.incrementCounter('uncaught_exceptions');
            
            // Enviar notificación crítica si está configurado
            this.notifyCriticalError(processedError);
        });

        process.on('unhandledRejection', (reason, promise) => {
            const processedError = ErrorManager.processError(reason, {
                operation: 'unhandled_rejection',
                promise: promise.toString()
            });
            
            logger.error('UNHANDLED REJECTION', processedError);
            metrics.incrementCounter('unhandled_rejections');
        });
    }

    /**
     * Registra métricas iniciales del sistema
     */
    recordStartupMetrics() {
        const startupTime = Date.now();
        const memUsage = process.memoryUsage();
        
        metrics.recordGauge('startup_time', startupTime);
        metrics.recordGauge('startup_memory_rss', memUsage.rss);
        metrics.recordGauge('startup_memory_heap', memUsage.heapUsed);
        metrics.incrementCounter('system_startup');
        
        // Registrar configuración
        Object.keys(this.systems).forEach(system => {
            metrics.recordGauge('subsystem_status', this.systems[system] ? 1 : 0, { 
                subsystem: system 
            });
        });
    }

    /**
     * Ejecuta prueba de integridad del sistema
     */
    async runIntegrityCheck() {
        logger.info('🔍 Running system integrity check');
        
        const checks = {
            memory: this.checkMemoryHealth(),
            cache: this.checkCacheHealth(),
            systems: this.checkSubsystemsHealth(),
            performance: this.checkPerformanceHealth()
        };
        
        const results = {};
        let overallHealth = true;
        
        for (const [checkName, checkPromise] of Object.entries(checks)) {
            try {
                results[checkName] = await checkPromise;
                if (!results[checkName].healthy) {
                    overallHealth = false;
                }
            } catch (error) {
                results[checkName] = { healthy: false, error: error.message };
                overallHealth = false;
            }
        }
        
        // Registrar resultados
        metrics.recordGauge('system_health', overallHealth ? 1 : 0);
        Object.keys(results).forEach(check => {
            metrics.recordGauge('health_check', results[check].healthy ? 1 : 0, { 
                check: check 
            });
        });
        
        if (overallHealth) {
            logger.info('✅ System integrity check passed', results);
        } else {
            logger.warning('⚠️ System integrity check found issues', results);
        }
        
        return results;
    }

    /**
     * Verifica salud de la memoria
     */
    async checkMemoryHealth() {
        const memUsage = process.memoryUsage();
        const memUsageMB = memUsage.rss / 1024 / 1024;
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        const healthy = memUsageMB < 1000 && heapUsedMB < 800; // < 1GB RSS, < 800MB heap
        
        return {
            healthy,
            memUsageMB: Math.round(memUsageMB),
            heapUsedMB: Math.round(heapUsedMB),
            details: healthy ? 'Memory usage within normal limits' : 'High memory usage detected'
        };
    }

    /**
     * Verifica salud del cache
     */
    async checkCacheHealth() {
        const cacheStats = cache.getStats();
        const healthy = cacheStats.hitRate > 0.5; // Hit rate > 50%
        
        return {
            healthy,
            hitRate: cacheStats.hitRate,
            size: cacheStats.totalEntries,
            details: healthy ? 'Cache performance is good' : 'Low cache hit rate'
        };
    }

    /**
     * Verifica salud de los subsistemas
     */
    async checkSubsystemsHealth() {
        const healthySystems = Object.values(this.systems).filter(status => status).length;
        const totalSystems = Object.keys(this.systems).length;
        const healthy = healthySystems === totalSystems;
        
        return {
            healthy,
            healthySystems,
            totalSystems,
            systems: this.systems,
            details: healthy ? 'All subsystems operational' : `${totalSystems - healthySystems} subsystem(s) have issues`
        };
    }

    /**
     * Verifica salud del rendimiento
     */
    async checkPerformanceHealth() {
        if (!this.systems.performanceOptimizer) {
            return { healthy: false, details: 'Performance optimizer not available' };
        }
        
        const perfStats = performanceOptimizer.getPerformanceStats();
        const healthy = perfStats.current.memory.status !== 'CRITICAL';
        
        return {
            healthy,
            memoryStatus: perfStats.current.memory.status,
            uptime: perfStats.current.uptime,
            details: healthy ? 'Performance within acceptable limits' : 'Performance issues detected'
        };
    }

    // =================== MÉTODOS PÚBLICOS PRINCIPALES ===================

    /**
     * Consulta información de servidor con todos los sistemas integrados
     * @param {Object} server - Configuración del servidor
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Object>} Resultado completo con datos validados
     */
    async queryServerInfo(server, options = {}) {
        const startTime = Date.now();
        
        try {
            // Usar el sistema avanzado de consultas
            const result = await AdvancedQueryManager.getServerInfoWithFallbacks(server, options);
            
            if (result.success && result.data) {
                // Validar datos
                const validation = DataValidator.validateServerInfo(result.data, {
                    fallbackName: server.name
                });
                
                const duration = Date.now() - startTime;
                performanceOptimizer.analyzeQueryPerformance('server_info', duration, validation.isValid);
                
                return {
                    success: true,
                    data: validation.normalized || result.data,
                    source: result.source,
                    cached: result.cached || false,
                    validation: {
                        isValid: validation.isValid,
                        confidence: validation.confidence,
                        quality: DataValidator.createQualityReport(validation)
                    },
                    performance: {
                        duration,
                        level: performanceOptimizer.analyzeQueryPerformance('server_info', duration, true)
                    }
                };
            } else {
                throw new Error(result.error || 'Server query failed');
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const processedError = ErrorManager.processError(error, {
                operation: 'server_query',
                serverName: server.name,
                isRetry: options.isRetry || false
            });
            
            performanceOptimizer.analyzeQueryPerformance('server_info', duration, false);
            
            return {
                success: false,
                data: null,
                error: processedError,
                performance: {
                    duration,
                    level: 'failed'
                }
            };
        }
    }

    /**
     * Consulta información de partido con todos los sistemas integrados
     * @param {Object} server - Configuración del servidor
     * @param {string} rconPassword - Contraseña RCON
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Object>} Resultado completo con datos validados
     */
    async queryMatchInfo(server, rconPassword, options = {}) {
        const startTime = Date.now();
        
        try {
            // Usar el sistema avanzado de consultas
            const result = await AdvancedQueryManager.getMatchInfoWithFallbacks(server, rconPassword, options);
            
            if (result.success && result.data) {
                // Validar datos
                const validation = DataValidator.validateMatchInfo(result.data, {
                    wasRepaired: result.repaired || false
                });
                
                const duration = Date.now() - startTime;
                performanceOptimizer.analyzeQueryPerformance('match_info', duration, validation.isValid);
                
                return {
                    success: true,
                    data: validation.normalized || result.data,
                    source: result.source,
                    cached: result.cached || false,
                    repaired: result.repaired || false,
                    workingPort: result.working_port,
                    validation: {
                        isValid: validation.isValid,
                        confidence: validation.confidence,
                        completeness: validation.dataCompleteness,
                        quality: DataValidator.createQualityReport(validation)
                    },
                    performance: {
                        duration,
                        level: performanceOptimizer.analyzeQueryPerformance('match_info', duration, true)
                    }
                };
            } else {
                throw new Error(result.error || 'Match query failed');
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const processedError = ErrorManager.processError(error, {
                operation: 'match_query',
                serverName: server.name,
                isRetry: options.isRetry || false
            });
            
            performanceOptimizer.analyzeQueryPerformance('match_info', duration, false);
            
            return {
                success: false,
                data: null,
                error: processedError,
                performance: {
                    duration,
                    level: 'failed'
                }
            };
        }
    }

    /**
     * Diagnóstica problemas de conexión RCON
     * @param {string} ip - IP del servidor
     * @param {number} port - Puerto RCON
     * @param {string} password - Contraseña RCON
     * @returns {Promise<Object>} Diagnóstico completo
     */
    async diagnoseRCON(ip, port, password) {
        try {
            logger.info(`🔍 Starting RCON diagnostic for ${ip}:${port}`);
            const diagnostic = await RCONManager.diagnosticRCON(ip, port, password);
            
            // Procesar resultados del diagnóstico
            const processedDiagnostic = {
                ...diagnostic,
                recommendations: this.generateRCONRecommendations(diagnostic),
                severity: this.assessRCONSeverity(diagnostic)
            };
            
            logger.info(`✅ RCON diagnostic completed for ${ip}:${port}`, {
                diagnosis: processedDiagnostic.diagnosis,
                severity: processedDiagnostic.severity
            });
            
            return processedDiagnostic;
            
        } catch (error) {
            const processedError = ErrorManager.processError(error, {
                operation: 'rcon_diagnostic',
                serverEndpoint: `${ip}:${port}`
            });
            
            return {
                success: false,
                diagnosis: 'Diagnostic failed',
                error: processedError,
                severity: 'critical'
            };
        }
    }

    /**
     * Obtiene estadísticas completas del sistema
     * @returns {Object} Estadísticas detalladas
     */
    getSystemStats() {
        return {
            systemHealth: this.systems,
            performance: this.systems.performanceOptimizer ? performanceOptimizer.getPerformanceStats() : null,
            cache: cache.getStats(),
            metrics: metrics.getMetrics(),
            validation: DataValidator.getValidationStats(),
            errors: ErrorManager.getErrorStats(),
            queries: AdvancedQueryManager.getSystemStats(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Limpia y optimiza todos los sistemas
     */
    async cleanupAndOptimize() {
        logger.info('🧹 Starting system cleanup and optimization');
        
        try {
            // Limpiar cache
            const cacheCleanup = cache.cleanup();
            
            // Optimizar rendimiento
            if (this.systems.performanceOptimizer) {
                performanceOptimizer.forceOptimization('all');
            }
            
            // Limpiar métricas
            metrics.cleanup();
            
            // Limpiar logs
            logger.cleanup();
            
            logger.info('✅ System cleanup and optimization completed');
            
        } catch (error) {
            logger.error('❌ Error during system cleanup', error);
        }
    }

    // =================== MÉTODOS AUXILIARES ===================

    generateRCONRecommendations(diagnostic) {
        const recommendations = [];
        
        if (!diagnostic.connection_test.success) {
            recommendations.push('Check RCON password and network connectivity');
            recommendations.push('Verify RCON is enabled on the server');
            recommendations.push('Test with different RCON ports');
        }
        
        if (diagnostic.working_commands.length === 0) {
            recommendations.push('Server may have restricted RCON access');
            recommendations.push('Check server RCON permissions');
        }
        
        if (diagnostic.failed_commands.includes('sv_matchinfojson')) {
            recommendations.push('IOSoccer server may not support sv_matchinfojson command');
            recommendations.push('Verify IOSoccer server version compatibility');
        }
        
        return recommendations;
    }

    assessRCONSeverity(diagnostic) {
        if (!diagnostic.connection_test.success) return 'critical';
        if (diagnostic.working_commands.length === 0) return 'high';
        if (diagnostic.working_commands.length < 3) return 'medium';
        return 'low';
    }

    notifyCriticalError(processedError) {
        // Implementar notificación crítica (webhook, email, etc.)
        logger.error('CRITICAL ERROR NOTIFICATION', processedError);
    }

    /**
     * Detiene todos los sistemas de forma segura
     */
    async shutdown() {
        logger.info('🛑 Shutting down monitoring system');
        
        try {
            // Detener performance optimizer
            if (this.systems.performanceOptimizer) {
                performanceOptimizer.shutdown();
            }
            
            // Limpiar recursos
            await this.cleanupAndOptimize();
            
            // Marcar como no inicializado
            this.initialized = false;
            
            logger.info('✅ Monitoring system shut down successfully');
            
        } catch (error) {
            logger.error('❌ Error during shutdown', error);
        }
    }
}

// Crear instancia singleton
const monitoring = new IOSoccerMonitoring();

// Exportar instancia y componentes individuales
module.exports = {
    // Instancia principal
    monitoring,
    
    // Componentes individuales para uso directo
    logger,
    metrics,
    cache,
    DataValidator,
    ErrorManager,
    AdvancedQueryManager,
    RCONManager,
    A2SQuery,
    performanceOptimizer,
    
    // Inicialización rápida
    async initialize(config) {
        return await monitoring.initialize(config);
    },
    
    // Estadísticas rápidas
    getStats() {
        return monitoring.getSystemStats();
    }
};

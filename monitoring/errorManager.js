const logger = require('./logger');
const metrics = require('./metrics');

/**
 * Sistema avanzado de manejo de errores user-friendly para IOSoccer Bot
 * Convierte errores técnicos en mensajes comprensibles para usuarios de Discord
 */
class ErrorManager {
    
    // Categorías de errores
    static ERROR_CATEGORIES = {
        NETWORK: 'network',
        RCON: 'rcon',
        PARSING: 'parsing',
        VALIDATION: 'validation',
        SYSTEM: 'system',
        DISCORD: 'discord',
        TIMEOUT: 'timeout',
        PERMISSION: 'permission'
    };

    // Niveles de severidad
    static SEVERITY_LEVELS = {
        LOW: 'low',           // Problemas menores que no impiden funcionalidad
        MEDIUM: 'medium',     // Problemas que afectan parcialmente
        HIGH: 'high',         // Problemas que impiden funcionalidad principal
        CRITICAL: 'critical'  // Problemas que rompen completamente el bot
    };

    /**
     * Procesa un error y genera respuesta user-friendly
     * @param {Error|string} error - Error original
     * @param {Object} context - Contexto del error
     * @param {Object} options - Opciones adicionales
     * @returns {Object} Error procesado con mensaje user-friendly
     */
    static processError(error, context = {}, options = {}) {
        const startTime = Date.now();
        
        try {
            // Normalizar error
            const normalizedError = this.normalizeError(error, context);
            
            // Clasificar error
            const classification = this.classifyError(normalizedError, context);
            
            // Generar mensaje user-friendly
            const userMessage = this.generateUserMessage(classification, context, options);
            
            // Generar sugerencias de solución
            const suggestions = this.generateSuggestions(classification, context);
            
            // Crear respuesta completa
            const processedError = {
                // Información técnica (para logs)
                technical: {
                    originalError: error,
                    message: normalizedError.message,
                    stack: normalizedError.stack,
                    code: normalizedError.code,
                    category: classification.category,
                    severity: classification.severity,
                    timestamp: Date.now(),
                    context: context
                },
                
                // Información para el usuario
                user: {
                    message: userMessage.primary,
                    details: userMessage.details,
                    emoji: userMessage.emoji,
                    color: this.getSeverityColor(classification.severity)
                },
                
                // Información para desarrollador/admin
                admin: {
                    category: classification.category,
                    severity: classification.severity,
                    confidence: classification.confidence,
                    suggestions: suggestions,
                    canRetry: classification.canRetry,
                    estimatedFixTime: classification.estimatedFixTime
                },
                
                // Métricas
                metrics: {
                    processingTime: Date.now() - startTime,
                    errorId: this.generateErrorId()
                }
            };
            
            // Registrar error
            this.logError(processedError);
            
            // Actualizar métricas
            this.updateMetrics(processedError);
            
            return processedError;
            
        } catch (processingError) {
            // Error al procesar error (meta-error)
            logger.error('Error processing error', processingError);
            
            return this.createFallbackError(error, context);
        }
    }

    /**
     * Normaliza diferentes tipos de errores a un formato consistente
     * @param {Error|string} error - Error original
     * @param {Object} context - Contexto del error
     * @returns {Object} Error normalizado
     */
    static normalizeError(error, context) {
        if (typeof error === 'string') {
            return {
                message: error,
                stack: null,
                code: null,
                name: 'StringError'
            };
        }
        
        if (error instanceof Error) {
            return {
                message: error.message || 'Unknown error',
                stack: error.stack,
                code: error.code || error.errno,
                name: error.name || 'Error'
            };
        }
        
        if (typeof error === 'object' && error !== null) {
            return {
                message: error.message || error.error || 'Object error',
                stack: error.stack || null,
                code: error.code || error.errno || error.status,
                name: error.name || 'ObjectError'
            };
        }
        
        return {
            message: 'Unknown error type',
            stack: null,
            code: null,
            name: 'UnknownError'
        };
    }

    /**
     * Clasifica el error en categoría, severidad y características
     * @param {Object} normalizedError - Error normalizado
     * @param {Object} context - Contexto del error
     * @returns {Object} Clasificación del error
     */
    static classifyError(normalizedError, context) {
        const classification = {
            category: this.ERROR_CATEGORIES.SYSTEM,
            severity: this.SEVERITY_LEVELS.MEDIUM,
            confidence: 80,
            canRetry: false,
            estimatedFixTime: null,
            isTemporary: false,
            requiresAdminAttention: false
        };

        const errorMessage = (normalizedError.message || '').toLowerCase();
        const errorCode = normalizedError.code;

        // Clasificación por mensaje/patrón
        if (this.isNetworkError(errorMessage, errorCode)) {
            classification.category = this.ERROR_CATEGORIES.NETWORK;
            classification.severity = this.SEVERITY_LEVELS.HIGH;
            classification.canRetry = true;
            classification.isTemporary = true;
            classification.estimatedFixTime = '1-5 minutos';
            classification.confidence = 90;
        }
        
        else if (this.isRCONError(errorMessage, errorCode, context)) {
            classification.category = this.ERROR_CATEGORIES.RCON;
            classification.severity = this.SEVERITY_LEVELS.HIGH;
            classification.canRetry = true;
            classification.estimatedFixTime = '2-10 minutos';
            classification.requiresAdminAttention = true;
            classification.confidence = 85;
        }
        
        else if (this.isTimeoutError(errorMessage, errorCode)) {
            classification.category = this.ERROR_CATEGORIES.TIMEOUT;
            classification.severity = this.SEVERITY_LEVELS.MEDIUM;
            classification.canRetry = true;
            classification.isTemporary = true;
            classification.estimatedFixTime = '30 segundos - 2 minutos';
            classification.confidence = 95;
        }
        
        else if (this.isParsingError(errorMessage, context)) {
            classification.category = this.ERROR_CATEGORIES.PARSING;
            classification.severity = this.SEVERITY_LEVELS.MEDIUM;
            classification.canRetry = true;
            classification.isTemporary = true;
            classification.estimatedFixTime = '1-3 minutos';
            classification.confidence = 88;
        }
        
        else if (this.isValidationError(errorMessage, context)) {
            classification.category = this.ERROR_CATEGORIES.VALIDATION;
            classification.severity = this.SEVERITY_LEVELS.LOW;
            classification.canRetry = false;
            classification.estimatedFixTime = 'Inmediato';
            classification.confidence = 85;
        }
        
        else if (this.isPermissionError(errorMessage, errorCode)) {
            classification.category = this.ERROR_CATEGORIES.PERMISSION;
            classification.severity = this.SEVERITY_LEVELS.HIGH;
            classification.canRetry = false;
            classification.requiresAdminAttention = true;
            classification.estimatedFixTime = 'Requiere configuración';
            classification.confidence = 90;
        }
        
        else if (this.isDiscordError(errorMessage, errorCode, context)) {
            classification.category = this.ERROR_CATEGORIES.DISCORD;
            classification.severity = this.SEVERITY_LEVELS.MEDIUM;
            classification.canRetry = true;
            classification.isTemporary = true;
            classification.estimatedFixTime = '1-5 minutos';
            classification.confidence = 80;
        }

        // Ajustar severidad basada en contexto
        if (context.isRetry && context.attemptNumber > 3) {
            classification.severity = this.increaseSeverity(classification.severity);
        }

        if (context.affectedUsers > 10) {
            classification.severity = this.increaseSeverity(classification.severity);
            classification.requiresAdminAttention = true;
        }

        return classification;
    }

    /**
     * Genera mensaje user-friendly basado en la clasificación
     * @param {Object} classification - Clasificación del error
     * @param {Object} context - Contexto del error
     * @param {Object} options - Opciones de mensaje
     * @returns {Object} Mensaje user-friendly
     */
    static generateUserMessage(classification, context, options = {}) {
        const serverName = context.serverName || 'el servidor';
        const isRetry = context.isRetry || false;
        const compact = options.compact || false;

        const messages = {
            [this.ERROR_CATEGORIES.NETWORK]: {
                primary: `🌐 **Problema de Conexión**\nNo puedo conectarme a ${serverName} en este momento.`,
                details: compact ? null : 
                    `Esto suele ocurrir cuando:\n` +
                    `• El servidor está reiniciando\n` +
                    `• Hay problemas de red temporales\n` +
                    `• El servidor está sobrecargado\n\n` +
                    `${isRetry ? '🔄 **Reintentando automáticamente...**' : '⏳ **Intentaré de nuevo en unos segundos**'}`,
                emoji: '🌐'
            },
            
            [this.ERROR_CATEGORIES.RCON]: {
                primary: `🔐 **Problema de RCON**\nNo puedo obtener información detallada de ${serverName}.`,
                details: compact ? null :
                    `El servidor responde, pero el acceso administrativo (RCON) ${isRetry ? 'sigue' : 'está'} fallando.\n\n` +
                    `Posibles causas:\n` +
                    `• Contraseña RCON incorrecta o cambiada\n` +
                    `• Puerto RCON bloqueado o cambiado\n` +
                    `• Servidor en modo mantenimiento\n\n` +
                    `📞 **Un administrador ha sido notificado**`,
                emoji: '🔐'
            },
            
            [this.ERROR_CATEGORIES.TIMEOUT]: {
                primary: `⏰ **Tiempo de Espera Agotado**\n${serverName} está tardando mucho en responder.`,
                details: compact ? null :
                    `El servidor está online pero responde muy lento.\n\n` +
                    `${isRetry ? '🔄 **Aumentando tiempo de espera...**' : '⚡ **Intentando con más tiempo...**'}`,
                emoji: '⏰'
            },
            
            [this.ERROR_CATEGORIES.PARSING]: {
                primary: `📄 **Datos Incompletos**\nRecibí información parcial de ${serverName}.`,
                details: compact ? null :
                    `Los datos del partido llegaron cortados o dañados.\n\n` +
                    `🔧 **Reparando automáticamente...**\n` +
                    `${isRetry ? 'Reintentando con configuración optimizada' : 'Aplicando correcciones inteligentes'}`,
                emoji: '📄'
            },
            
            [this.ERROR_CATEGORIES.VALIDATION]: {
                primary: `⚠️ **Datos Inconsistentes**\nLa información de ${serverName} tiene algunos problemas.`,
                details: compact ? null :
                    `Los datos recibidos contienen inconsistencias menores.\n\n` +
                    `✅ **Datos normalizados y corregidos automáticamente**`,
                emoji: '⚠️'
            },
            
            [this.ERROR_CATEGORIES.PERMISSION]: {
                primary: `🚫 **Sin Permisos**\nNo tengo los permisos necesarios para esta operación.`,
                details: compact ? null :
                    `Necesito permisos adicionales para:\n` +
                    `• Enviar mensajes embebidos\n` +
                    `• Reaccionar con emojis\n` +
                    `• Acceder al canal\n\n` +
                    `👤 **Contacta con un administrador del servidor**`,
                emoji: '🚫'
            },
            
            [this.ERROR_CATEGORIES.DISCORD]: {
                primary: `💬 **Problema de Discord**\nDiscord está teniendo dificultades técnicas.`,
                details: compact ? null :
                    `Este es un problema temporal de Discord, no del bot.\n\n` +
                    `${isRetry ? '🔄 **Reintentando...**' : '⏳ **Esperaré un momento antes de reintentar**'}`,
                emoji: '💬'
            },
            
            [this.ERROR_CATEGORIES.SYSTEM]: {
                primary: `🔧 **Error del Sistema**\nHe encontrado un problema técnico inesperado.`,
                details: compact ? null :
                    `Se ha producido un error interno que estoy investigando.\n\n` +
                    `📝 **Error registrado automáticamente**\n` +
                    `🔔 **Desarrollador notificado**`,
                emoji: '🔧'
            }
        };

        const message = messages[classification.category] || messages[this.ERROR_CATEGORIES.SYSTEM];
        
        // Agregar información de severidad si es crítica
        if (classification.severity === this.SEVERITY_LEVELS.CRITICAL && !compact) {
            message.details = `🚨 **PROBLEMA CRÍTICO**\n\n${message.details}\n\n⚠️ **Funcionalidad temporalmente limitada**`;
        }

        return message;
    }

    /**
     * Genera sugerencias de solución basadas en la clasificación
     * @param {Object} classification - Clasificación del error
     * @param {Object} context - Contexto del error
     * @returns {Array} Lista de sugerencias
     */
    static generateSuggestions(classification, context) {
        const suggestions = [];

        switch (classification.category) {
            case this.ERROR_CATEGORIES.NETWORK:
                suggestions.push(
                    'Verificar conectividad de red',
                    'Revisar estado del servidor objetivo',
                    'Comprobar firewall/proxy',
                    'Esperar y reintentar en 1-2 minutos'
                );
                break;

            case this.ERROR_CATEGORIES.RCON:
                suggestions.push(
                    'Verificar contraseña RCON en configuración',
                    'Comprobar puertos RCON (27015, 27016, etc.)',
                    'Revisar configuración del servidor IOSoccer',
                    'Verificar que RCON esté habilitado',
                    'Reiniciar conexión RCON'
                );
                break;

            case this.ERROR_CATEGORIES.TIMEOUT:
                suggestions.push(
                    'Aumentar timeouts en configuración',
                    'Verificar carga del servidor',
                    'Comprobar latencia de red',
                    'Implementar reintentos con backoff'
                );
                break;

            case this.ERROR_CATEGORIES.PARSING:
                suggestions.push(
                    'Revisar formato de datos recibidos',
                    'Verificar versión del servidor IOSoccer',
                    'Comprobar reparación automática de JSON',
                    'Aumentar buffer de recepción'
                );
                break;

            case this.ERROR_CATEGORIES.PERMISSION:
                suggestions.push(
                    'Revisar permisos del bot en Discord',
                    'Verificar roles asignados',
                    'Comprobar permisos del canal',
                    'Reinvitar bot con permisos correctos'
                );
                break;

            case this.ERROR_CATEGORIES.DISCORD:
                suggestions.push(
                    'Verificar estado de Discord API',
                    'Esperar resolución automática',
                    'Reintentar con rate limiting',
                    'Comprobar límites de API'
                );
                break;

            default:
                suggestions.push(
                    'Revisar logs del sistema',
                    'Verificar configuración general',
                    'Reiniciar componentes del bot',
                    'Contactar soporte técnico'
                );
                break;
        }

        return suggestions;
    }

    // =================== MÉTODOS DE DETECCIÓN ===================

    static isNetworkError(message, code) {
        const networkPatterns = [
            'econnrefused', 'enotfound', 'enetunreach', 'ehostunreach',
            'connection refused', 'network error', 'dns', 'socket'
        ];
        const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH'];
        
        return networkPatterns.some(pattern => message.includes(pattern)) ||
               networkCodes.includes(code);
    }

    static isRCONError(message, code, context) {
        const rconPatterns = [
            'rcon', 'authentication', 'unauthorized', 'invalid password',
            'connection failed', 'unable to connect'
        ];
        
        return rconPatterns.some(pattern => message.includes(pattern)) ||
               context.operation === 'rcon';
    }

    static isTimeoutError(message, code) {
        const timeoutPatterns = [
            'timeout', 'timed out', 'etimeout', 'request timeout'
        ];
        const timeoutCodes = ['ETIMEOUT', 'ECONNRESET'];
        
        return timeoutPatterns.some(pattern => message.includes(pattern)) ||
               timeoutCodes.includes(code);
    }

    static isParsingError(message, context) {
        const parsingPatterns = [
            'json', 'parse', 'unexpected token', 'invalid json',
            'malformed', 'truncated', 'corrupt data'
        ];
        
        return parsingPatterns.some(pattern => message.includes(pattern)) ||
               context.operation === 'parsing';
    }

    static isValidationError(message, context) {
        const validationPatterns = [
            'validation', 'invalid data', 'missing field', 'format error'
        ];
        
        return validationPatterns.some(pattern => message.includes(pattern)) ||
               context.operation === 'validation';
    }

    static isPermissionError(message, code) {
        const permissionPatterns = [
            'permission', 'forbidden', 'unauthorized', 'access denied',
            'insufficient permissions', 'missing permissions'
        ];
        const permissionCodes = ['EPERM', '403', 403];
        
        return permissionPatterns.some(pattern => message.includes(pattern)) ||
               permissionCodes.includes(code);
    }

    static isDiscordError(message, code, context) {
        const discordPatterns = [
            'discord api', 'rate limit', 'unknown message', 'unknown channel',
            'missing access', 'discord', 'webhook'
        ];
        const discordCodes = [50001, 50013, 50014, 50035];
        
        return discordPatterns.some(pattern => message.includes(pattern)) ||
               discordCodes.includes(code) ||
               context.platform === 'discord';
    }

    // =================== MÉTODOS AUXILIARES ===================

    static increaseSeverity(currentSeverity) {
        const severityOrder = [
            this.SEVERITY_LEVELS.LOW,
            this.SEVERITY_LEVELS.MEDIUM,
            this.SEVERITY_LEVELS.HIGH,
            this.SEVERITY_LEVELS.CRITICAL
        ];
        
        const currentIndex = severityOrder.indexOf(currentSeverity);
        return severityOrder[Math.min(currentIndex + 1, severityOrder.length - 1)];
    }

    static getSeverityColor(severity) {
        const colors = {
            [this.SEVERITY_LEVELS.LOW]: '#57F287',      // Verde
            [this.SEVERITY_LEVELS.MEDIUM]: '#FEE75C',   // Amarillo
            [this.SEVERITY_LEVELS.HIGH]: '#ED4245',     // Rojo
            [this.SEVERITY_LEVELS.CRITICAL]: '#99334E'  // Rojo oscuro
        };
        
        return colors[severity] || '#747F8D'; // Gris por defecto
    }

    static generateErrorId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static logError(processedError) {
        const { technical, admin } = processedError;
        
        const logData = {
            errorId: processedError.metrics.errorId,
            category: technical.category,
            severity: technical.severity,
            message: technical.message,
            context: technical.context,
            suggestions: admin.suggestions.slice(0, 3), // Solo las primeras 3
            canRetry: admin.canRetry
        };

        switch (technical.severity) {
            case this.SEVERITY_LEVELS.CRITICAL:
                logger.error('CRITICAL ERROR', logData, technical.originalError);
                break;
            case this.SEVERITY_LEVELS.HIGH:
                logger.error('HIGH SEVERITY ERROR', logData, technical.originalError);
                break;
            case this.SEVERITY_LEVELS.MEDIUM:
                logger.warning('MEDIUM SEVERITY ERROR', logData);
                break;
            case this.SEVERITY_LEVELS.LOW:
                logger.info('LOW SEVERITY ERROR', logData);
                break;
            default:
                logger.warning('UNKNOWN SEVERITY ERROR', logData);
                break;
        }
    }

    static updateMetrics(processedError) {
        const { technical } = processedError;
        
        metrics.incrementCounter('error_processed', {
            category: technical.category,
            severity: technical.severity
        });
        
        metrics.recordHistogram('error_processing_time', 
            processedError.metrics.processingTime,
            { category: technical.category }
        );
        
        if (processedError.admin.requiresAdminAttention) {
            metrics.incrementCounter('admin_attention_required', {
                category: technical.category
            });
        }
    }

    static createFallbackError(originalError, context) {
        return {
            technical: {
                originalError: originalError,
                message: 'Error processing failed',
                category: this.ERROR_CATEGORIES.SYSTEM,
                severity: this.SEVERITY_LEVELS.CRITICAL,
                timestamp: Date.now(),
                context: context
            },
            user: {
                message: '🔧 **Error Crítico**\nSe ha producido un problema técnico grave.',
                details: 'El sistema de manejo de errores ha fallado. Un desarrollador ha sido notificado.',
                emoji: '🔧',
                color: this.getSeverityColor(this.SEVERITY_LEVELS.CRITICAL)
            },
            admin: {
                category: this.ERROR_CATEGORIES.SYSTEM,
                severity: this.SEVERITY_LEVELS.CRITICAL,
                confidence: 100,
                suggestions: ['Revisar logs inmediatamente', 'Reiniciar sistema', 'Contactar desarrollador'],
                canRetry: false,
                estimatedFixTime: 'Requiere intervención manual'
            },
            metrics: {
                processingTime: 0,
                errorId: this.generateErrorId()
            }
        };
    }

    /**
     * Crea un error user-friendly personalizado
     * @param {string} message - Mensaje principal
     * @param {string} category - Categoría del error
     * @param {string} severity - Severidad
     * @param {Object} options - Opciones adicionales
     * @returns {Object} Error procesado
     */
    static createCustomError(message, category, severity, options = {}) {
        const error = new Error(message);
        const context = {
            operation: options.operation || 'custom',
            ...options.context
        };
        
        return this.processError(error, context, options);
    }

    /**
     * Obtiene estadísticas de errores
     * @returns {Object} Estadísticas completas
     */
    static getErrorStats() {
        return {
            categories: Object.values(this.ERROR_CATEGORIES),
            severities: Object.values(this.SEVERITY_LEVELS),
            metrics: metrics.getMetrics(),
            recent_errors: metrics.getCounter('error_processed'),
            admin_attention_required: metrics.getCounter('admin_attention_required')
        };
    }
}

module.exports = ErrorManager;

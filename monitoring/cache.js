// Sistema de cache inteligente para IOSoccer Bot
const logger = require('./logger');

class IntelligentCache {
    constructor() {
        this.cache = new Map();
        this.metadata = new Map();
        
        // Configuración del cache
        this.config = {
            // TTL para diferentes tipos de datos (en milisegundos)
            ttl: {
                serverInfo: 30 * 1000,        // 30 segundos para info básica
                matchInfo: 15 * 1000,         // 15 segundos para info de partido
                playerStats: 60 * 1000,       // 60 segundos para estadísticas
                serverStatus: 45 * 1000,      // 45 segundos para status general
                errorStates: 5 * 60 * 1000    // 5 minutos para estados de error
            },
            maxSize: 1000,                    // Máximo número de entradas
            cleanupInterval: 30 * 1000        // Limpiar cache cada 30 segundos
        };
        
        // Iniciar limpieza automática
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
        
        logger.info('Cache inteligente iniciado', {
            maxSize: this.config.maxSize,
            ttlConfig: this.config.ttl
        });
    }
    
    generateKey(type, serverName, additionalParams = {}) {
        const baseKey = `${type}:${serverName}`;
        
        if (Object.keys(additionalParams).length === 0) {
            return baseKey;
        }
        
        // Crear clave determinística de parámetros adicionales
        const paramString = Object.keys(additionalParams)
            .sort()
            .map(key => `${key}=${additionalParams[key]}`)
            .join('&');
            
        return `${baseKey}:${paramString}`;
    }
    
    set(key, value, type = 'serverInfo', metadata = {}) {
        // Verificar límite de tamaño
        if (this.cache.size >= this.config.maxSize) {
            this.evictOldestEntries(Math.floor(this.config.maxSize * 0.1)); // Eliminar 10% más viejo
        }
        
        const now = Date.now();
        const ttl = this.config.ttl[type] || this.config.ttl.serverInfo;
        const expireAt = now + ttl;
        
        this.cache.set(key, {
            value,
            createdAt: now,
            expireAt,
            type,
            accessCount: 0,
            lastAccess: now
        });
        
        this.metadata.set(key, {
            size: JSON.stringify(value).length,
            ...metadata
        });
        
        logger.recordCacheEvent('set', key, { type, ttl, size: this.cache.size });
        
        logger.debug('Cache entry set', {
            key,
            type,
            expireAt: new Date(expireAt).toISOString(),
            cacheSize: this.cache.size
        });
    }
    
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            logger.recordCacheEvent('miss', key);
            return null;
        }
        
        const now = Date.now();
        
        // Verificar si expiró
        if (now > entry.expireAt) {
            this.cache.delete(key);
            this.metadata.delete(key);
            logger.recordCacheEvent('miss', key, { reason: 'expired' });
            return null;
        }
        
        // Actualizar estadísticas de acceso
        entry.accessCount++;
        entry.lastAccess = now;
        
        logger.recordCacheEvent('hit', key, {
            age: now - entry.createdAt,
            accessCount: entry.accessCount
        });
        
        return entry.value;
    }
    
    has(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return false;
        }
        
        // Verificar si expiró
        if (Date.now() > entry.expireAt) {
            this.cache.delete(key);
            this.metadata.delete(key);
            return false;
        }
        
        return true;
    }
    
    delete(key) {
        const deleted = this.cache.delete(key);
        this.metadata.delete(key);
        
        if (deleted) {
            logger.debug('Cache entry deleted', { key, cacheSize: this.cache.size });
        }
        
        return deleted;
    }
    
    clear() {
        const previousSize = this.cache.size;
        this.cache.clear();
        this.metadata.clear();
        
        logger.info('Cache cleared', { previousSize });
    }
    
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expireAt) {
                this.cache.delete(key);
                this.metadata.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            logger.debug('Cache cleanup completed', {
                cleanedEntries: cleanedCount,
                remainingEntries: this.cache.size
            });
        }
    }
    
    evictOldestEntries(count) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess) // Ordenar por último acceso
            .slice(0, count);
        
        for (const [key] of entries) {
            this.cache.delete(key);
            this.metadata.delete(key);
        }
        
        logger.debug('Cache eviction completed', {
            evictedEntries: count,
            remainingEntries: this.cache.size
        });
    }
    
    getServerInfoCached(serverName) {
        const key = this.generateKey('serverInfo', serverName);
        return this.get(key);
    }
    
    setServerInfoCached(serverName, serverInfo) {
        const key = this.generateKey('serverInfo', serverName);
        this.set(key, serverInfo, 'serverInfo', {
            serverName,
            status: serverInfo.status
        });
    }
    
    getMatchInfoCached(serverName, matchTime) {
        // Incluir tiempo del partido para cache más preciso
        const key = this.generateKey('matchInfo', serverName, { matchTime });
        return this.get(key);
    }
    
    setMatchInfoCached(serverName, matchInfo, matchTime) {
        const key = this.generateKey('matchInfo', serverName, { matchTime });
        this.set(key, matchInfo, 'matchInfo', {
            serverName,
            matchTime,
            period: matchInfo.period
        });
    }
    
    getErrorStateCached(serverName, errorType) {
        const key = this.generateKey('errorState', serverName, { errorType });
        return this.get(key);
    }
    
    setErrorStateCached(serverName, errorType, errorInfo) {
        const key = this.generateKey('errorState', serverName, { errorType });
        this.set(key, errorInfo, 'errorStates', {
            serverName,
            errorType,
            timestamp: Date.now()
        });
    }
    
    // Invalidar cache relacionado con un servidor
    invalidateServer(serverName) {
        let invalidatedCount = 0;
        
        for (const key of this.cache.keys()) {
            if (key.includes(serverName)) {
                this.cache.delete(key);
                this.metadata.delete(key);
                invalidatedCount++;
            }
        }
        
        logger.debug('Server cache invalidated', {
            serverName,
            invalidatedEntries: invalidatedCount
        });
        
        return invalidatedCount;
    }
    
    // Obtener estadísticas del cache
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let totalSize = 0;
        const typeStats = {};
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expireAt) {
                expiredCount++;
            }
            
            const metadata = this.metadata.get(key);
            if (metadata) {
                totalSize += metadata.size;
            }
            
            if (!typeStats[entry.type]) {
                typeStats[entry.type] = { count: 0, totalAccess: 0 };
            }
            typeStats[entry.type].count++;
            typeStats[entry.type].totalAccess += entry.accessCount;
        }
        
        return {
            totalEntries: this.cache.size,
            expiredEntries: expiredCount,
            totalSizeBytes: totalSize,
            avgSizePerEntry: this.cache.size > 0 ? Math.round(totalSize / this.cache.size) : 0,
            typeBreakdown: typeStats,
            hitRate: logger.metrics.cacheHits + logger.metrics.cacheMisses > 0
                ? ((logger.metrics.cacheHits / (logger.metrics.cacheHits + logger.metrics.cacheMisses)) * 100).toFixed(2)
                : 0
        };
    }
    
    // Implementar estrategia de pre-calentamiento para servidores frecuentes
    preWarm(serverNames) {
        logger.info('Iniciando pre-calentamiento de cache', {
            servers: serverNames.length
        });
        
        // Esta función sería llamada por el sistema principal para pre-cargar
        // datos de servidores que se consultan frecuentemente
    }
    
    // Método para debugging
    dumpCacheContents() {
        const contents = {};
        for (const [key, entry] of this.cache.entries()) {
            contents[key] = {
                type: entry.type,
                createdAt: new Date(entry.createdAt).toISOString(),
                expireAt: new Date(entry.expireAt).toISOString(),
                accessCount: entry.accessCount,
                lastAccess: new Date(entry.lastAccess).toISOString(),
                valuePreview: JSON.stringify(entry.value).substring(0, 100) + '...'
            };
        }
        return contents;
    }
    
    /**
     * Optimiza TTL para entradas frecuentemente accedidas
     */
    optimizeTTL() {
        const now = Date.now();
        let optimized = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            // Si la entrada se ha accedido frecuentemente, extender TTL
            if (entry.accessCount && entry.accessCount > 5) {
                const originalTTL = entry.expireAt - entry.createdAt;
                const newExpireAt = now + (originalTTL * 1.5); // 50% más tiempo
                entry.expireAt = newExpireAt;
                optimized++;
                
                logger.debug(`TTL optimized for frequently accessed key: ${key}`);
            }
        }
        
        logger.debug(`TTL optimization completed: ${optimized} entries optimized`);
        return { optimized };
    }
    
    /**
     * Expulsa las entradas menos usadas
     */
    evictLeastUsed() {
        const entries = Array.from(this.cache.entries())
            .filter(([key, entry]) => Date.now() <= entry.expireAt)
            .sort((a, b) => (a[1].accessCount || 0) - (b[1].accessCount || 0));
        
        const toEvict = Math.min(Math.floor(entries.length * 0.2), 10); // Expulsar hasta 20% o 10 entradas
        let evicted = 0;
        
        for (let i = 0; i < toEvict; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            this.metadata.delete(key);
            evicted++;
        }
        
        logger.debug(`Least used eviction completed: ${evicted} entries evicted`);
        return { evicted };
    }
    
    cleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanup();
        
        logger.info('Cache shutdown completed', {
            finalSize: this.cache.size
        });
    }
}

// Singleton instance
const cache = new IntelligentCache();

// Cleanup en exit
process.on('exit', () => cache.cleanup());
process.on('SIGINT', () => cache.cleanup());
process.on('SIGTERM', () => cache.cleanup());

module.exports = cache;

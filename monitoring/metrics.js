/**
 * Sistema de métricas enterprise-grade para IOSoccer Bot
 * Recolecta, procesa y almacena métricas de rendimiento en tiempo real
 */

const logger = require('./logger');

class MetricsSystem {
    constructor() {
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.startTime = Date.now();
        
        // Configuración
        this.config = {
            maxHistogramEntries: 1000,    // Máximo entradas por histograma
            aggregationInterval: 300000,  // 5 minutos agregación
            cleanupInterval: 600000,      // 10 minutos limpieza
            retentionTime: 3600000        // 1 hora retención
        };
        
        // Iniciar limpieza automática
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
        
        logger.info('Metrics system initialized', {
            counters: 0,
            gauges: 0,
            histograms: 0
        });
    }

    /**
     * Incrementa un contador
     * @param {string} name - Nombre del contador
     * @param {Object} labels - Labels para el contador
     * @param {number} value - Valor a incrementar (default: 1)
     */
    incrementCounter(name, labels = {}, value = 1) {
        const key = this.generateKey(name, labels);
        
        if (!this.counters.has(key)) {
            this.counters.set(key, {
                name,
                labels,
                value: 0,
                lastUpdated: Date.now(),
                created: Date.now()
            });
        }
        
        const counter = this.counters.get(key);
        counter.value += value;
        counter.lastUpdated = Date.now();
        
        logger.debug(`Counter incremented: ${name}`, {
            labels,
            value: counter.value,
            increment: value
        });
    }

    /**
     * Registra un gauge (valor instantáneo)
     * @param {string} name - Nombre del gauge
     * @param {number} value - Valor actual
     * @param {Object} labels - Labels para el gauge
     */
    recordGauge(name, value, labels = {}) {
        const key = this.generateKey(name, labels);
        
        this.gauges.set(key, {
            name,
            labels,
            value,
            lastUpdated: Date.now(),
            created: this.gauges.has(key) ? this.gauges.get(key).created : Date.now()
        });
        
        logger.debug(`Gauge recorded: ${name}`, {
            labels,
            value
        });
    }

    /**
     * Registra un valor en histograma (para duraciones, tamaños, etc.)
     * @param {string} name - Nombre del histograma
     * @param {number} value - Valor a registrar
     * @param {Object} labels - Labels para el histograma
     */
    recordHistogram(name, value, labels = {}) {
        const key = this.generateKey(name, labels);
        
        if (!this.histograms.has(key)) {
            this.histograms.set(key, {
                name,
                labels,
                values: [],
                count: 0,
                sum: 0,
                min: Number.MAX_VALUE,
                max: Number.MIN_VALUE,
                created: Date.now(),
                lastUpdated: Date.now()
            });
        }
        
        const histogram = this.histograms.get(key);
        
        // Agregar valor
        histogram.values.push({
            value,
            timestamp: Date.now()
        });
        
        // Actualizar estadísticas
        histogram.count++;
        histogram.sum += value;
        histogram.min = Math.min(histogram.min, value);
        histogram.max = Math.max(histogram.max, value);
        histogram.lastUpdated = Date.now();
        
        // Limitar tamaño del histograma
        if (histogram.values.length > this.config.maxHistogramEntries) {
            histogram.values.shift(); // Remover el más antiguo
        }
        
        logger.debug(`Histogram recorded: ${name}`, {
            labels,
            value,
            count: histogram.count,
            avg: histogram.sum / histogram.count
        });
    }

    /**
     * Obtiene el valor de un contador específico
     * @param {string} name - Nombre del contador
     * @param {Object} labels - Labels del contador
     * @returns {number} Valor del contador
     */
    getCounter(name, labels = {}) {
        const key = this.generateKey(name, labels);
        const counter = this.counters.get(key);
        return counter ? counter.value : 0;
    }

    /**
     * Obtiene el valor de un gauge específico
     * @param {string} name - Nombre del gauge
     * @param {Object} labels - Labels del gauge
     * @returns {number} Valor del gauge
     */
    getGauge(name, labels = {}) {
        const key = this.generateKey(name, labels);
        const gauge = this.gauges.get(key);
        return gauge ? gauge.value : null;
    }

    /**
     * Obtiene estadísticas de un histograma
     * @param {string} name - Nombre del histograma
     * @param {Object} labels - Labels del histograma
     * @returns {Object|null} Estadísticas del histograma
     */
    getHistogram(name, labels = {}) {
        const key = this.generateKey(name, labels);
        const histogram = this.histograms.get(key);
        
        if (!histogram || histogram.count === 0) {
            return null;
        }
        
        const sortedValues = histogram.values
            .map(v => v.value)
            .sort((a, b) => a - b);
            
        return {
            count: histogram.count,
            sum: histogram.sum,
            average: histogram.sum / histogram.count,
            min: histogram.min,
            max: histogram.max,
            p50: this.percentile(sortedValues, 50),
            p95: this.percentile(sortedValues, 95),
            p99: this.percentile(sortedValues, 99),
            lastUpdated: histogram.lastUpdated
        };
    }

    /**
     * Obtiene el promedio de un histograma
     * @param {string} name - Nombre del histograma
     * @param {Object} labels - Labels del histograma
     * @returns {number|null} Promedio del histograma
     */
    getHistogramAverage(name, labels = {}) {
        const histogram = this.getHistogram(name, labels);
        return histogram ? histogram.average : null;
    }

    /**
     * Obtiene todas las métricas del sistema
     * @returns {Object} Todas las métricas organizadas por tipo
     */
    getMetrics() {
        const metrics = {
            counters: {},
            gauges: {},
            histograms: {},
            system: {
                uptime: Date.now() - this.startTime,
                metricsCount: {
                    counters: this.counters.size,
                    gauges: this.gauges.size,
                    histograms: this.histograms.size,
                    total: this.counters.size + this.gauges.size + this.histograms.size
                },
                lastCleanup: this.lastCleanup || 'Never'
            }
        };

        // Procesar contadores
        for (const [key, counter] of this.counters.entries()) {
            const metricKey = this.formatMetricKey(counter.name, counter.labels);
            metrics.counters[metricKey] = {
                value: counter.value,
                lastUpdated: counter.lastUpdated
            };
        }

        // Procesar gauges
        for (const [key, gauge] of this.gauges.entries()) {
            const metricKey = this.formatMetricKey(gauge.name, gauge.labels);
            metrics.gauges[metricKey] = {
                value: gauge.value,
                lastUpdated: gauge.lastUpdated
            };
        }

        // Procesar histogramas
        for (const [key, histogram] of this.histograms.entries()) {
            const metricKey = this.formatMetricKey(histogram.name, histogram.labels);
            const stats = this.getHistogram(histogram.name, histogram.labels);
            metrics.histograms[metricKey] = stats;
        }

        return metrics;
    }

    /**
     * Obtiene métricas en formato Prometheus
     * @returns {string} Métricas en formato Prometheus
     */
    getPrometheusMetrics() {
        const lines = [];
        
        // Contadores
        for (const [key, counter] of this.counters.entries()) {
            const labels = this.formatPrometheusLabels(counter.labels);
            lines.push(`# TYPE ${counter.name} counter`);
            lines.push(`${counter.name}${labels} ${counter.value}`);
        }
        
        // Gauges
        for (const [key, gauge] of this.gauges.entries()) {
            const labels = this.formatPrometheusLabels(gauge.labels);
            lines.push(`# TYPE ${gauge.name} gauge`);
            lines.push(`${gauge.name}${labels} ${gauge.value}`);
        }
        
        // Histogramas
        for (const [key, histogram] of this.histograms.entries()) {
            const labels = this.formatPrometheusLabels(histogram.labels);
            const stats = this.getHistogram(histogram.name, histogram.labels);
            
            if (stats) {
                lines.push(`# TYPE ${histogram.name} histogram`);
                lines.push(`${histogram.name}_count${labels} ${stats.count}`);
                lines.push(`${histogram.name}_sum${labels} ${stats.sum}`);
                lines.push(`${histogram.name}_bucket{le="50"${labels.slice(1)} ${stats.p50}`);
                lines.push(`${histogram.name}_bucket{le="95"${labels.slice(1)} ${stats.p95}`);
                lines.push(`${histogram.name}_bucket{le="99"${labels.slice(1)} ${stats.p99}`);
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Limpia métricas antiguas y optimiza memoria
     */
    performCleanup() {
        const now = Date.now();
        const retentionTime = this.config.retentionTime;
        let cleaned = { counters: 0, gauges: 0, histograms: 0 };

        // Limpiar contadores antiguos (solo si no han sido actualizados)
        for (const [key, counter] of this.counters.entries()) {
            if (now - counter.lastUpdated > retentionTime && counter.value === 0) {
                this.counters.delete(key);
                cleaned.counters++;
            }
        }

        // Limpiar gauges antiguos
        for (const [key, gauge] of this.gauges.entries()) {
            if (now - gauge.lastUpdated > retentionTime) {
                this.gauges.delete(key);
                cleaned.gauges++;
            }
        }

        // Limpiar valores antiguos de histogramas
        for (const [key, histogram] of this.histograms.entries()) {
            const originalCount = histogram.values.length;
            histogram.values = histogram.values.filter(v => 
                now - v.timestamp <= retentionTime
            );
            
            if (histogram.values.length === 0) {
                this.histograms.delete(key);
                cleaned.histograms++;
            } else if (histogram.values.length !== originalCount) {
                // Recalcular estadísticas
                this.recalculateHistogramStats(histogram);
            }
        }

        this.lastCleanup = now;

        if (cleaned.counters > 0 || cleaned.gauges > 0 || cleaned.histograms > 0) {
            logger.info('Metrics cleanup completed', cleaned);
        }
    }

    /**
     * Limpieza manual del sistema de métricas
     */
    cleanup() {
        this.performCleanup();
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        return {
            counters: this.counters.size,
            gauges: this.gauges.size,
            histograms: this.histograms.size
        };
    }

    // =================== MÉTODOS AUXILIARES ===================

    /**
     * Genera clave única para métricas con labels
     */
    generateKey(name, labels) {
        if (Object.keys(labels).length === 0) {
            return name;
        }
        
        const sortedLabels = Object.keys(labels)
            .sort()
            .map(key => `${key}="${labels[key]}"`)
            .join(',');
            
        return `${name}{${sortedLabels}}`;
    }

    /**
     * Formatea clave de métrica para salida
     */
    formatMetricKey(name, labels) {
        if (Object.keys(labels).length === 0) {
            return name;
        }
        
        const labelStr = Object.keys(labels)
            .sort()
            .map(key => `${key}=${labels[key]}`)
            .join(',');
            
        return `${name}[${labelStr}]`;
    }

    /**
     * Formatea labels para Prometheus
     */
    formatPrometheusLabels(labels) {
        if (Object.keys(labels).length === 0) {
            return '';
        }
        
        const labelStr = Object.keys(labels)
            .sort()
            .map(key => `${key}="${labels[key]}"`)
            .join(',');
            
        return `{${labelStr}}`;
    }

    /**
     * Calcula percentil de un array ordenado
     */
    percentile(sortedValues, p) {
        if (sortedValues.length === 0) return 0;
        if (sortedValues.length === 1) return sortedValues[0];
        
        const index = (p / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        
        if (lower === upper) {
            return sortedValues[lower];
        }
        
        return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
    }

    /**
     * Recalcula estadísticas de histograma después de limpieza
     */
    recalculateHistogramStats(histogram) {
        if (histogram.values.length === 0) {
            histogram.count = 0;
            histogram.sum = 0;
            histogram.min = Number.MAX_VALUE;
            histogram.max = Number.MIN_VALUE;
            return;
        }

        histogram.count = histogram.values.length;
        histogram.sum = histogram.values.reduce((sum, v) => sum + v.value, 0);
        histogram.min = Math.min(...histogram.values.map(v => v.value));
        histogram.max = Math.max(...histogram.values.map(v => v.value));
    }

    /**
     * Resetea todas las métricas (usar con precaución)
     */
    reset() {
        const beforeCount = {
            counters: this.counters.size,
            gauges: this.gauges.size,  
            histograms: this.histograms.size
        };
        
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.startTime = Date.now();
        
        logger.warning('All metrics reset', beforeCount);
        
        return beforeCount;
    }

    /**
     * Obtiene estadísticas del sistema de métricas
     */
    getSystemStats() {
        const memoryEstimate = this.estimateMemoryUsage();
        
        return {
            uptime: Date.now() - this.startTime,
            counts: {
                counters: this.counters.size,
                gauges: this.gauges.size,
                histograms: this.histograms.size,
                total: this.counters.size + this.gauges.size + this.histograms.size
            },
            memory: {
                estimatedBytes: memoryEstimate,
                estimatedMB: Math.round(memoryEstimate / 1024 / 1024 * 100) / 100
            },
            performance: {
                lastCleanup: this.lastCleanup || 'Never',
                cleanupInterval: this.config.cleanupInterval,
                retentionTime: this.config.retentionTime
            }
        };
    }

    /**
     * Estima uso de memoria de las métricas
     */
    estimateMemoryUsage() {
        let bytes = 0;
        
        // Estimar contadores (asumiendo ~100 bytes por contador)
        bytes += this.counters.size * 100;
        
        // Estimar gauges (asumiendo ~80 bytes por gauge)
        bytes += this.gauges.size * 80;
        
        // Estimar histogramas (asumiendo ~50 bytes por valor + overhead)
        for (const histogram of this.histograms.values()) {
            bytes += histogram.values.length * 50 + 200; // 200 bytes overhead por histograma
        }
        
        return bytes;
    }
}

// Crear instancia singleton
const metrics = new MetricsSystem();

// Limpieza en exit
process.on('exit', () => metrics.cleanup());
process.on('SIGINT', () => metrics.cleanup());
process.on('SIGTERM', () => metrics.cleanup());

module.exports = metrics;

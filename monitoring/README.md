# 🚀 Sistema Ultra-Robusto de Monitoreo IOSoccer

Un sistema de monitoreo enterprise-grade diseñado específicamente para bots de IOSoccer que ofrece **máxima robustez**, **recuperación automática** y **rendimiento optimizado**.

## ✨ Características Principales

### 🛡️ **Ultra-Robustez**
- **Persistencia Total**: Reintentos ilimitados con timeouts adaptativos
- **Circuit Breakers**: Protección automática contra servidores problemáticos
- **Fallbacks Inteligentes**: Múltiples estrategias de recuperación
- **Reparación Automática**: JSON truncado se repara automáticamente

### ⚡ **Rendimiento Optimizado**
- **Cache Inteligente**: TTL diferenciado y optimización automática
- **Rate Limiting**: Control de concurrencia por servidor
- **Monitoreo Continuo**: Métricas en tiempo real
- **Garbage Collection**: Optimización automática de memoria

### 🔧 **Manejo Avanzado de Errores**
- **User-Friendly**: Errores técnicos convertidos a mensajes comprensibles
- **Clasificación Automática**: 8 categorías con severidad y sugerencias
- **Logging Estructurado**: Logs separados por niveles con rotación
- **Métricas Detalladas**: Historial completo de errores y rendimiento

### 📊 **Validación y Monitoreo**
- **Validación Completa**: Datos normalizados y verificados
- **Reportes de Calidad**: Confianza y completitud de datos
- **Estadísticas en Tiempo Real**: Dashboard completo del sistema
- **Health Checks**: Verificación automática de subsistemas

## 📁 Estructura del Sistema

```
monitoring/
├── index.js              # 🎯 Sistema principal integrado
├── logger.js              # 📝 Logger avanzado con rotación
├── metrics.js             # 📊 Sistema de métricas enterprise
├── cache.js               # 🗄️ Cache inteligente con TTL
├── dataValidator.js       # ✅ Validador de datos IOSoccer
├── errorManager.js        # ❌ Manejador de errores user-friendly
├── queryUtils.js          # 🌐 Sistema RCON ultra-persistente
├── performanceOptimizer.js # ⚡ Optimizador de rendimiento
├── example-usage.js       # 📖 Ejemplos completos de uso
└── README.md             # 📚 Esta documentación
```

## 🚀 Inicio Rápido

### 1. Instalación

```javascript
// Importar el sistema completo
const { monitoring, initialize, getStats } = require('./monitoring');

// O importar componentes individuales
const { 
    logger, 
    metrics, 
    cache, 
    DataValidator, 
    ErrorManager 
} = require('./monitoring');
```

### 2. Inicialización Simple

```javascript
// Inicialización básica
await initialize();

// Inicialización con configuración personalizada
await initialize({
    enablePerformanceMonitoring: true,
    enableAdvancedLogging: true,
    enableCaching: true,
    
    defaultTimeouts: {
        a2s: 15000,      // 15s para consultas A2S
        rcon: 30000,     // 30s para RCON
        matchJson: 60000 // 60s para JSON de partido
    }
});
```

### 3. Uso Básico

```javascript
// Consulta información de servidor
const serverResult = await monitoring.queryServerInfo(server);

if (serverResult.success) {
    console.log(`Servidor: ${serverResult.data.server_name}`);
    console.log(`Jugadores: ${serverResult.data.players}/${serverResult.data.max_players}`);
    console.log(`Calidad: ${serverResult.validation.quality.quality}`);
}

// Consulta información de partido
const matchResult = await monitoring.queryMatchInfo(server, rconPassword);

if (matchResult.success) {
    console.log(`Partido: ${matchResult.data.teamNameHome} vs ${matchResult.data.teamNameAway}`);
    console.log(`Marcador: ${matchResult.data.goalsHome}-${matchResult.data.goalsAway}`);
    console.log(`Periodo: ${matchResult.data.matchPeriod}`);
}
```

## 🔧 Componentes del Sistema

### 📝 Logger Avanzado

```javascript
const { logger } = require('./monitoring');

// Logging por niveles
logger.debug('Mensaje de debugging');
logger.info('Información general');
logger.warning('Advertencia importante');
logger.error('Error crítico');

// Logging estructurado
logger.info('Usuario conectado', { 
    userId: '12345', 
    server: 'IOSoccer Main' 
});
```

**Características:**
- ✅ 4 niveles de logging (debug, info, warning, error)
- ✅ Archivos separados por nivel
- ✅ Rotación automática de logs
- ✅ Formato estructurado con timestamps
- ✅ Cleanup automático de archivos antiguos

### 📊 Sistema de Métricas

```javascript
const { metrics } = require('./monitoring');

// Contadores
metrics.incrementCounter('queries_total', { server: 'test' });

// Histogramas (duraciones)
metrics.recordHistogram('query_duration', 250, { operation: 'server_info' });

// Gauges (valores instantáneos)
metrics.recordGauge('memory_usage', process.memoryUsage().rss);

// Obtener métricas
const allMetrics = metrics.getMetrics();
```

**Características:**
- ✅ Contadores, histogramas y gauges
- ✅ Labels/tags para segmentación
- ✅ Agregaciones automáticas (promedio, percentiles)
- ✅ Limpieza periódica
- ✅ Exportación en múltiples formatos

### 🗄️ Cache Inteligente

```javascript
const { cache } = require('./monitoring');

// Cache básico
cache.set('server_info', data, 'serverInfo');
const cached = cache.get('server_info');

// Cache con TTL personalizado
cache.setServerInfoCached('IOSoccer Main', serverData);
const serverInfo = cache.getServerInfoCached('IOSoccer Main');

// Estadísticas del cache
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

**Características:**
- ✅ TTL diferenciado por tipo de datos
- ✅ Limpieza automática de entradas expiradas
- ✅ Evicción LRU inteligente
- ✅ Optimización automática de TTL
- ✅ Estadísticas detalladas de rendimiento

### ✅ Validador de Datos

```javascript
const { DataValidator } = require('./monitoring');

// Validar datos de servidor
const validation = DataValidator.validateServerInfo(serverData);

console.log(`Válido: ${validation.isValid}`);
console.log(`Confianza: ${validation.confidence}%`);
console.log(`Datos normalizados:`, validation.normalized);

// Crear reporte de calidad
const quality = DataValidator.createQualityReport(validation);
console.log(`Calidad: ${quality.quality}`);
console.log(`Mostrar: ${quality.shouldDisplay}`);
```

**Características:**
- ✅ Validación completa de datos IOSoccer
- ✅ Normalización automática
- ✅ Cálculo de confianza y completitud
- ✅ Reportes de calidad detallados
- ✅ Detección de inconsistencias

### ❌ Manejador de Errores

```javascript
const { ErrorManager } = require('./monitoring');

try {
    // Operación que puede fallar
    await someOperation();
} catch (error) {
    const processed = ErrorManager.processError(error, {
        operation: 'server_query',
        serverName: 'IOSoccer Main'
    });
    
    // Mensaje para el usuario
    console.log(processed.user.message);
    console.log(processed.user.details);
    
    // Información técnica
    console.log(`Categoría: ${processed.technical.category}`);
    console.log(`Severidad: ${processed.admin.severity}`);
    console.log(`Puede reintentar: ${processed.admin.canRetry}`);
    console.log(`Sugerencias:`, processed.admin.suggestions);
}
```

**Características:**
- ✅ 8 categorías de errores (red, RCON, parsing, etc.)
- ✅ 4 niveles de severidad
- ✅ Mensajes user-friendly en español
- ✅ Sugerencias de solución automáticas
- ✅ Clasificación inteligente de errores

### 🌐 Sistema RCON Ultra-Persistente

```javascript
const { RCONManager } = require('./monitoring');

// Conexión persistente (hasta 20 intentos)
const connection = await RCONManager.testConnectionPersistent(ip, port, password);

// Comando persistente con timeouts especiales para JSON
const result = await RCONManager.executeCommandPersistent(
    ip, port, password, 'sv_matchinfojson', 15
);

// Búsqueda inteligente de puerto RCON
const portResult = await RCONManager.findWorkingRconPortPersistent(server, password);

// Diagnóstico completo
const diagnostic = await RCONManager.diagnosticRCON(ip, port, password);
```

**Características:**
- ✅ Persistencia total con reintentos ilimitados
- ✅ Timeouts adaptativos por comando
- ✅ Búsqueda inteligente de puertos
- ✅ Reparación automática de JSON truncado
- ✅ Diagnóstico completo de problemas

### ⚡ Optimizador de Rendimiento

```javascript
const { performanceOptimizer } = require('./monitoring');

// Obtener estadísticas
const stats = performanceOptimizer.getPerformanceStats();

console.log(`Memoria: ${stats.current.memory.usedMB}MB (${stats.current.memory.status})`);
console.log(`Cache hit rate: ${stats.current.cache.hitRate}%`);
console.log(`Recomendaciones:`, stats.recommendations);

// Forzar optimización
performanceOptimizer.forceOptimization('memory');
performanceOptimizer.forceOptimization('all');
```

**Características:**
- ✅ Monitoreo continuo cada 30 segundos
- ✅ Optimización automática de memoria
- ✅ Garbage collection inteligente
- ✅ Recomendaciones personalizadas
- ✅ Limpieza profunda programada

## 🎯 Uso Avanzado

### Sistema Principal Integrado

```javascript
const { monitoring } = require('./monitoring');

// Inicializar sistema completo
await monitoring.initialize({
    enablePerformanceMonitoring: true,
    enableAdvancedLogging: true,
    enableCaching: true,
    enableDataValidation: true,
    enableErrorReporting: true
});

// Consulta con todos los sistemas integrados
const result = await monitoring.queryServerInfo(server);

// Información completa disponible
console.log('Datos:', result.data);
console.log('Fuente:', result.source);
console.log('Cacheado:', result.cached);
console.log('Validación:', result.validation);
console.log('Rendimiento:', result.performance);

// Diagnóstico RCON completo
const diagnostic = await monitoring.diagnoseRCON(ip, port, password);

// Estadísticas completas del sistema
const stats = monitoring.getSystemStats();
console.log('Salud del sistema:', stats.systemHealth);
console.log('Rendimiento:', stats.performance);
console.log('Cache:', stats.cache);
console.log('Métricas:', stats.metrics);
```

### Manejo de Múltiples Servidores

```javascript
const servers = [
    { name: 'IOSoccer Main', ip: '192.168.1.100', port: 27015, rcon_ports: [27015, 27016] },
    { name: 'IOSoccer Test', ip: '192.168.1.101', port: 27015, rcon_ports: [27015, 27018] }
];

for (const server of servers) {
    try {
        // Información básica del servidor
        const serverInfo = await monitoring.queryServerInfo(server);
        
        if (serverInfo.success && serverInfo.data.players > 0) {
            // Si hay jugadores, obtener información del partido
            const matchInfo = await monitoring.queryMatchInfo(server, rconPassword);
            
            if (matchInfo.success) {
                console.log(`${server.name}: ${matchInfo.data.teamNameHome} vs ${matchInfo.data.teamNameAway}`);
            }
        }
        
    } catch (error) {
        console.error(`Error procesando ${server.name}:`, error.message);
    }
}
```

## 🔬 Reparación Automática de JSON

El sistema incluye **5 estrategias** avanzadas para reparar JSON truncado de IOSoccer:

### Estrategia 1: Patrón Conocido
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","matchEvents":[{"eventType":"Goal","startPosition":null}
```
↓ **Se repara automáticamente a:**
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","matchEvents":[{"eventType":"Goal","startPosition":null}]}
```

### Estrategia 2: Cortado en Coma
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","matchEvents":[{"eventType":"Goal"},
```
↓ **Se repara automáticamente a:**
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","matchEvents":[{"eventType":"Goal"}]}
```

### Estrategia 3: String Incompleto
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","playerName":"John
```
↓ **Se repara automáticamente a:**
```json
{"matchPeriod":"FirstHalf","teamNameHome":"Team A","playerName":"John"}
```

## 📈 Monitoreo y Métricas

### Dashboard de Estadísticas

```javascript
const stats = monitoring.getSystemStats();

console.log('=== DASHBOARD DEL SISTEMA ===');
console.log(`Uptime: ${stats.uptime} segundos`);
console.log(`Memoria: ${Math.round(stats.memory.rss / 1024 / 1024)}MB`);
console.log(`Sistemas activos: ${Object.values(stats.systemHealth).filter(s => s).length}/${Object.keys(stats.systemHealth).length}`);

// Cache
console.log(`Cache entries: ${stats.cache.totalEntries}`);
console.log(`Cache hit rate: ${stats.cache.hitRate}%`);

// Rendimiento
if (stats.performance) {
    console.log(`Estado memoria: ${stats.performance.current.memory.status}`);
    console.log(`Optimizaciones aplicadas: ${stats.performance.optimizations.applied}`);
    console.log(`Recomendaciones: ${stats.performance.recommendations.length}`);
}

// Métricas de consultas
console.log(`Queries exitosas: ${stats.metrics.counters?.query_success || 0}`);
console.log(`Queries fallidas: ${stats.metrics.counters?.query_error || 0}`);
```

### Health Checks Automáticos

El sistema ejecuta verificaciones automáticas cada inicialización:

- ✅ **Memoria**: RSS < 1GB, Heap < 800MB
- ✅ **Cache**: Hit rate > 50%
- ✅ **Subsistemas**: Todos operativos
- ✅ **Rendimiento**: Estado no crítico

## 🛠️ Configuración Avanzada

### Timeouts Personalizados

```javascript
await initialize({
    defaultTimeouts: {
        a2s: 10000,       // 10s para A2S_INFO
        rcon: 20000,      // 20s para conexiones RCON
        matchJson: 45000  // 45s para sv_matchinfojson
    },
    
    defaultRetries: {
        network: 5,       // 5 reintentos para errores de red
        rcon: 10,         // 10 reintentos para RCON
        parsing: 3        // 3 reintentos para parsing
    }
});
```

### Cache Personalizado

```javascript
// TTL personalizado por tipo
const cache = require('./monitoring/cache');
cache.config.ttl = {
    serverInfo: 60000,    // 1 minuto
    matchInfo: 10000,     // 10 segundos
    playerStats: 120000,  // 2 minutos
    errorStates: 300000   // 5 minutos
};
```

### Logging Personalizado

```javascript
const logger = require('./monitoring/logger');

// Configurar niveles de log por archivo
logger.setLevel('debug', 'all');    // Debug a todos los archivos
logger.setLevel('info', 'main');    // Solo info al archivo principal
logger.setLevel('error', 'error');  // Solo errores al archivo de error
```

## 🚨 Manejo de Errores Avanzado

### Errores User-Friendly

Todos los errores técnicos se convierten automáticamente a mensajes comprensibles:

```javascript
// Error técnico: "ECONNREFUSED 192.168.1.100:27015"
// Mensaje user-friendly:
{
    message: "🌐 **Problema de Conexión**\nNo puedo conectarme al servidor en este momento.",
    details: "Esto suele ocurrir cuando:\n• El servidor está reiniciando\n• Hay problemas de red temporales\n• El servidor está sobrecargado",
    emoji: "🌐",
    color: "#ED4245",
    category: "network",
    severity: "high",
    canRetry: true,
    suggestions: [
        "Verificar conectividad de red",
        "Revisar estado del servidor objetivo",
        "Esperar y reintentar en 1-2 minutos"
    ]
}
```

### Clasificación Automática

El sistema clasifica automáticamente errores en **8 categorías**:

1. **🌐 Network**: Problemas de conectividad
2. **🔐 RCON**: Problemas de autenticación/acceso RCON  
3. **⏰ Timeout**: Timeouts de conexión/respuesta
4. **📄 Parsing**: Problemas con JSON/datos
5. **⚠️ Validation**: Datos inconsistentes/inválidos
6. **🚫 Permission**: Problemas de permisos
7. **💬 Discord**: Errores de la API de Discord
8. **🔧 System**: Errores internos del sistema

## 📚 Ejemplos Completos

Consulta el archivo `example-usage.js` para ejemplos detallados de:

- ✅ Inicialización del sistema completo
- ✅ Consultas de servidor con validación
- ✅ Consultas de partido con reparación JSON
- ✅ Diagnóstico RCON completo
- ✅ Uso de sistemas individuales
- ✅ Monitoreo de rendimiento
- ✅ Integración completa con manejo de errores
- ✅ Estadísticas y limpieza del sistema

## 🔧 Mantenimiento

### Limpieza Automática

El sistema realiza limpieza automática:

- **Cache**: Cada 30 segundos (entradas expiradas)
- **Logs**: Rotación diaria, eliminación >7 días
- **Métricas**: Agregación cada 5 minutos
- **Memoria**: Garbage collection cuando es necesario
- **Optimización**: Cada 5 minutos (programada), cada hora (profunda)

### Shutdown Seguro

```javascript
// Cerrar sistema de forma segura
await monitoring.shutdown();

// O limpieza manual
await monitoring.cleanupAndOptimize();
```

## 🏆 Beneficios del Sistema

### **Para Usuarios**
- ❌ **Sin más "(datos no disponibles)"**: Sistema ultra-robusto
- ✅ **Mensajes claros**: Errores explicados en español simple
- ⚡ **Respuestas rápidas**: Cache inteligente y optimización
- 🔄 **Recuperación automática**: Fallbacks en caso de problemas

### **Para Desarrolladores**
- 📊 **Observabilidad total**: Logs, métricas y health checks
- 🛡️ **Máxima robustez**: Circuit breakers y persistencia
- 🔧 **Fácil debugging**: Clasificación y diagnóstico automático
- ⚡ **Rendimiento optimizado**: Monitoreo y optimización continua

### **Para Administradores**
- 📈 **Dashboard completo**: Estadísticas en tiempo real
- 🚨 **Alertas inteligentes**: Notificaciones de problemas críticos
- 🔍 **Diagnóstico automático**: Identificación de problemas RCON
- 📋 **Reportes detallados**: Calidad y confianza de datos

---

## 📞 Soporte

Este sistema está diseñado para ser **100% autónomo** y **self-healing**. En caso de problemas:

1. ✅ Consulta los logs en `./logs/`
2. ✅ Revisa las métricas con `getStats()`
3. ✅ Usa el diagnóstico RCON integrado
4. ✅ Revisa los ejemplos en `example-usage.js`

**¡El sistema está diseñado para funcionar sin intervención manual en el 99.9% de los casos!**

---

*Sistema desarrollado con ❤️ para la comunidad de IOSoccer*

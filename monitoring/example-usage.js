/**
 * EJEMPLO DE USO DEL SISTEMA ULTRA-ROBUSTO DE MONITOREO IOSoccer
 * 
 * Este archivo demuestra cómo utilizar todos los componentes del sistema
 * de monitoreo avanzado para el bot IOSoccer.
 */

// Importar el sistema completo
const { 
    monitoring,           // Sistema principal
    logger,              // Logger avanzado
    metrics,             // Sistema de métricas
    cache,               // Cache inteligente
    DataValidator,       // Validador de datos
    ErrorManager,        // Manejador de errores
    AdvancedQueryManager, // Gestor de consultas avanzado
    RCONManager,         // Gestor RCON persistente
    A2SQuery,            // Consultas A2S
    performanceOptimizer, // Optimizador de rendimiento
    initialize,          // Función de inicialización rápida
    getStats             // Estadísticas rápidas
} = require('./index');

// Configuración de ejemplo de servidores
const exampleServers = [
    {
        name: 'IOSoccer Main',
        ip: '192.168.1.100',
        port: 27015,
        rcon_ports: [27015, 27016, 27017]
    },
    {
        name: 'IOSoccer Test',
        ip: '192.168.1.101',  
        port: 27015,
        rcon_ports: [27015, 27018]
    }
];

const rconPassword = 'your_rcon_password_here';

/**
 * EJEMPLO 1: Inicialización del Sistema Completo
 */
async function example1_SystemInitialization() {
    console.log('\n=== EJEMPLO 1: Inicialización del Sistema ===');
    
    try {
        // Inicializar con configuración personalizada
        await initialize({
            enablePerformanceMonitoring: true,
            enableAdvancedLogging: true,
            enableCaching: true,
            enableDataValidation: true,
            enableErrorReporting: true,
            
            // Timeouts personalizados
            defaultTimeouts: {
                a2s: 12000,      // 12 segundos para A2S
                rcon: 25000,     // 25 segundos para RCON
                matchJson: 45000 // 45 segundos para JSON de partido
            }
        });
        
        console.log('✅ Sistema inicializado correctamente');
        
        // Obtener estadísticas del sistema
        const stats = getStats();
        console.log('📊 Estadísticas del sistema:', {
            uptime: `${stats.uptime} segundos`,
            memory: `${Math.round(stats.memory.rss / 1024 / 1024)}MB`,
            systemHealth: stats.systemHealth
        });
        
    } catch (error) {
        console.error('❌ Error inicializando sistema:', error.message);
    }
}

/**
 * EJEMPLO 2: Consulta de Información de Servidor
 */
async function example2_ServerInfoQuery() {
    console.log('\n=== EJEMPLO 2: Consulta de Información de Servidor ===');
    
    const server = exampleServers[0];
    
    try {
        // Consultar información del servidor con sistema completo
        const result = await monitoring.queryServerInfo(server);
        
        if (result.success) {
            console.log('✅ Información del servidor obtenida:', {
                serverName: result.data.server_name,
                map: result.data.map_name,
                players: `${result.data.players}/${result.data.max_players}`,
                source: result.source,
                cached: result.cached,
                validation: {
                    isValid: result.validation.isValid,
                    confidence: `${result.validation.confidence}%`,
                    quality: result.validation.quality.quality
                },
                performance: {
                    duration: `${result.performance.duration}ms`,
                    level: result.performance.level
                }
            });
        } else {
            console.log('❌ Error obteniendo información del servidor:', {
                error: result.error.user.message,
                category: result.error.technical.category,
                severity: result.error.admin.severity,
                canRetry: result.error.admin.canRetry,
                duration: `${result.performance.duration}ms`
            });
        }
        
    } catch (error) {
        console.error('💥 Excepción en consulta de servidor:', error.message);
    }
}

/**
 * EJEMPLO 3: Consulta de Información de Partido
 */
async function example3_MatchInfoQuery() {
    console.log('\n=== EJEMPLO 3: Consulta de Información de Partido ===');
    
    const server = exampleServers[0];
    
    try {
        // Consultar información del partido con sistema completo
        const result = await monitoring.queryMatchInfo(server, rconPassword);
        
        if (result.success) {
            console.log('✅ Información del partido obtenida:', {
                teams: `${result.data.teamNameHome} vs ${result.data.teamNameAway}`,
                score: `${result.data.goalsHome}-${result.data.goalsAway}`,
                period: result.data.matchPeriod,
                status: result.data.matchStatus,
                workingPort: result.workingPort,
                source: result.source,
                cached: result.cached,
                repaired: result.repaired,
                validation: {
                    isValid: result.validation.isValid,
                    confidence: `${result.validation.confidence}%`,
                    completeness: `${result.validation.completeness}%`,
                    quality: result.validation.quality.quality
                },
                performance: {
                    duration: `${result.performance.duration}ms`,
                    level: result.performance.level
                }
            });
        } else {
            console.log('❌ Error obteniendo información del partido:', {
                error: result.error.user.message,
                details: result.error.user.details,
                category: result.error.technical.category,
                severity: result.error.admin.severity,
                suggestions: result.error.admin.suggestions.slice(0, 2),
                duration: `${result.performance.duration}ms`
            });
        }
        
    } catch (error) {
        console.error('💥 Excepción en consulta de partido:', error.message);
    }
}

/**
 * EJEMPLO 4: Diagnóstico RCON
 */
async function example4_RCONDiagnostic() {
    console.log('\n=== EJEMPLO 4: Diagnóstico RCON ===');
    
    const server = exampleServers[0];
    
    try {
        // Realizar diagnóstico completo de RCON
        const diagnostic = await monitoring.diagnoseRCON(server.ip, server.rcon_ports[0], rconPassword);
        
        console.log('🔍 Diagnóstico RCON completado:', {
            diagnosis: diagnostic.diagnosis,
            severity: diagnostic.severity,
            connectionSuccess: diagnostic.connection_test?.success || false,
            workingCommands: diagnostic.working_commands?.length || 0,
            failedCommands: diagnostic.failed_commands?.length || 0,
            totalTime: `${diagnostic.total_time}s`,
            recommendations: diagnostic.recommendations?.slice(0, 3) || []
        });
        
    } catch (error) {
        console.error('💥 Excepción en diagnóstico RCON:', error.message);
    }
}

/**
 * EJEMPLO 5: Uso de Sistemas Individuales
 */
async function example5_IndividualSystems() {
    console.log('\n=== EJEMPLO 5: Uso de Sistemas Individuales ===');
    
    // A) Cache inteligente
    console.log('\n🗄️ Cache inteligente:');
    cache.set('test_key', { message: 'Hello Cache!' }, 'test');
    const cached = cache.get('test_key');
    console.log('Datos del cache:', cached);
    console.log('Estadísticas del cache:', {
        size: cache.getStats().totalEntries,
        hitRate: cache.getStats().hitRate
    });
    
    // B) Validación de datos
    console.log('\n✅ Validación de datos:');
    const serverData = {
        server_name: 'Test Server',
        map_name: 'pitch_day',
        players: 12,
        max_players: 20
    };
    
    const validation = DataValidator.validateServerInfo(serverData);
    console.log('Validación:', {
        isValid: validation.isValid,
        confidence: `${validation.confidence}%`,
        errors: validation.errors,
        warnings: validation.warnings
    });
    
    // C) Manejo de errores
    console.log('\n❌ Manejo de errores:');
    const testError = new Error('Test network error: ECONNREFUSED');
    const processedError = ErrorManager.processError(testError, {
        operation: 'test_query',
        serverName: 'Test Server'
    });
    
    console.log('Error procesado:', {
        userMessage: processedError.user.message,
        category: processedError.technical.category,
        severity: processedError.admin.severity,
        canRetry: processedError.admin.canRetry,
        suggestions: processedError.admin.suggestions.slice(0, 2)
    });
    
    // D) Métricas del sistema
    console.log('\n📊 Métricas del sistema:');
    metrics.incrementCounter('example_counter', { type: 'test' });
    metrics.recordHistogram('example_duration', 150, { operation: 'test' });
    
    const metricsData = metrics.getMetrics();
    console.log('Métricas registradas:', {
        counters: Object.keys(metricsData.counters || {}).length,
        histograms: Object.keys(metricsData.histograms || {}).length,
        gauges: Object.keys(metricsData.gauges || {}).length
    });
}

/**
 * EJEMPLO 6: Monitoreo de Rendimiento
 */
async function example6_PerformanceMonitoring() {
    console.log('\n=== EJEMPLO 6: Monitoreo de Rendimiento ===');
    
    try {
        // Obtener estadísticas de rendimiento
        const perfStats = performanceOptimizer.getPerformanceStats();
        
        console.log('📈 Rendimiento del sistema:', {
            memoryUsage: `${perfStats.current.memory.usedMB}MB`,
            memoryStatus: perfStats.current.memory.status,
            uptime: `${perfStats.current.uptime} segundos`,
            cacheHitRate: `${Math.round(perfStats.current.cache.hitRate * 100)}%`,
            optimizations: perfStats.optimizations.applied,
            lastOptimization: perfStats.optimizations.lastOptimization,
            recommendations: perfStats.recommendations.slice(0, 2)
        });
        
        // Forzar optimización si es necesario
        if (perfStats.current.memory.status === 'WARNING') {
            console.log('⚠️ Memoria alta detectada, forzando optimización...');
            performanceOptimizer.forceOptimization('memory');
        }
        
    } catch (error) {
        console.error('💥 Error obteniendo estadísticas de rendimiento:', error.message);
    }
}

/**
 * EJEMPLO 7: Integración Completa con Manejo de Errores
 */
async function example7_CompleteIntegration() {
    console.log('\n=== EJEMPLO 7: Integración Completa ===');
    
    for (const server of exampleServers) {
        console.log(`\n🔍 Procesando servidor: ${server.name}`);
        
        try {
            // 1. Intentar obtener información básica del servidor
            console.log('  📡 Obteniendo información básica...');
            const serverInfo = await monitoring.queryServerInfo(server);
            
            if (serverInfo.success) {
                console.log(`  ✅ ${serverInfo.data.server_name}: ${serverInfo.data.players}/${serverInfo.data.max_players} jugadores`);
                
                // 2. Si hay jugadores, intentar obtener información del partido
                if (serverInfo.data.players > 0) {
                    console.log('  🎮 Obteniendo información del partido...');
                    const matchInfo = await monitoring.queryMatchInfo(server, rconPassword);
                    
                    if (matchInfo.success) {
                        console.log(`  ⚽ Partido: ${matchInfo.data.teamNameHome} ${matchInfo.data.goalsHome}-${matchInfo.data.goalsAway} ${matchInfo.data.teamNameAway}`);
                    } else {
                        console.log(`  ❌ Error en partido: ${matchInfo.error.user.message}`);
                    }
                }
            } else {
                console.log(`  ❌ Error en servidor: ${serverInfo.error.user.message}`);
            }
            
        } catch (error) {
            console.error(`  💥 Excepción procesando ${server.name}:`, error.message);
        }
    }
}

/**
 * EJEMPLO 8: Estadísticas Finales y Limpieza
 */
async function example8_FinalStats() {
    console.log('\n=== EJEMPLO 8: Estadísticas Finales ===');
    
    try {
        // Obtener estadísticas completas del sistema
        const finalStats = getStats();
        
        console.log('📊 Resumen final del sistema:', {
            uptime: `${finalStats.uptime} segundos`,
            memory: `${Math.round(finalStats.memory.rss / 1024 / 1024)}MB RSS`,
            heap: `${Math.round(finalStats.memory.heapUsed / 1024 / 1024)}MB heap`,
            systemHealth: Object.values(finalStats.systemHealth).filter(h => h).length + '/' + Object.keys(finalStats.systemHealth).length + ' sistemas OK',
            cache: {
                entries: finalStats.cache?.totalEntries || 0,
                hitRate: Math.round(finalStats.cache?.hitRate || 0) + '%'
            },
            performance: finalStats.performance ? {
                memoryStatus: finalStats.performance.current.memory.status,
                recommendations: finalStats.performance.recommendations.length
            } : 'No disponible'
        });
        
        // Realizar limpieza y optimización final
        console.log('\n🧹 Limpiando sistema...');
        await monitoring.cleanupAndOptimize();
        
    } catch (error) {
        console.error('💥 Error en estadísticas finales:', error.message);
    }
}

/**
 * FUNCIÓN PRINCIPAL - EJECUTAR TODOS LOS EJEMPLOS
 */
async function runAllExamples() {
    console.log('🚀 INICIANDO EJEMPLOS DEL SISTEMA ULTRA-ROBUSTO IOSoccer');
    console.log('='.repeat(60));
    
    try {
        await example1_SystemInitialization();
        await example2_ServerInfoQuery();
        await example3_MatchInfoQuery();
        await example4_RCONDiagnostic();
        await example5_IndividualSystems();
        await example6_PerformanceMonitoring();
        await example7_CompleteIntegration();
        await example8_FinalStats();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TODOS LOS EJEMPLOS COMPLETADOS EXITOSAMENTE');
        
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ ERROR EJECUTANDO EJEMPLOS:', error.message);
    } finally {
        // Cerrar sistema de forma segura
        console.log('\n🛑 Cerrando sistema...');
        await monitoring.shutdown();
        console.log('👋 Sistema cerrado correctamente');
    }
}

// Exportar funciones para uso individual o ejecutar todas
module.exports = {
    example1_SystemInitialization,
    example2_ServerInfoQuery,
    example3_MatchInfoQuery,
    example4_RCONDiagnostic,
    example5_IndividualSystems,
    example6_PerformanceMonitoring,
    example7_CompleteIntegration,
    example8_FinalStats,
    runAllExamples
};

// Si se ejecuta directamente, correr todos los ejemplos
if (require.main === module) {
    runAllExamples().catch(console.error);
}

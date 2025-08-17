const dgram = require('dgram');
const { Rcon } = require('rcon-client');

// Función de logging mejorada
function logger(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

class A2SQuery {
    /**
     * Consulta información básica del servidor usando A2S_INFO con timeout aumentado
     * @param {string} ip - IP del servidor
     * @param {number} port - Puerto del servidor
     * @param {number} timeout - Timeout en milisegundos
     * @returns {Promise<Object|null>} Información del servidor o null si falla
     */
    static async queryServer(ip, port, timeout = 12000) { // Timeout aumentado de 5s a 12s
        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            
            const timeoutId = setTimeout(() => {
                client.close();
                logger('ERROR', `❌ A2S_INFO PERSISTENTE error ${ip}:${port}: timeout`);
                resolve(null);
            }, timeout);
            
            client.on('message', (data) => {
                clearTimeout(timeoutId);
                client.close();
                
                try {
                    // Parsear respuesta A2S_INFO
                    if (data.length < 25) {
                        resolve(null);
                        return;
                    }
                    
                    let offset = 6; // Skip header and protocol
                    
                    // Server name
                    const nameEnd = data.indexOf(0, offset);
                    if (nameEnd === -1) {
                        resolve(null);
                        return;
                    }
                    const serverName = data.subarray(offset, nameEnd).toString('utf-8');
                    offset = nameEnd + 1;
                    
                    // Map name
                    const mapEnd = data.indexOf(0, offset);
                    if (mapEnd === -1) {
                        resolve(null);
                        return;
                    }
                    const mapName = data.subarray(offset, mapEnd).toString('utf-8');
                    offset = mapEnd + 1;
                    
                    // Skip folder and game
                    for (let i = 0; i < 2; i++) {
                        const end = data.indexOf(0, offset);
                        if (end === -1) {
                            resolve(null);
                            return;
                        }
                        offset = end + 1;
                    }
                    
                    // Skip ID (2 bytes)
                    offset += 2;
                    
                    // Players and max_players
                    if (offset + 1 >= data.length) {
                        resolve(null);
                        return;
                    }
                    const players = data[offset];
                    const maxPlayers = data[offset + 1];
                    
                    logger('INFO', `✅ A2S_INFO PERSISTENTE ${ip}:${port} -> ${players}/${maxPlayers} en ${mapName}`);
                    
                    resolve({
                        server_name: serverName,
                        map_name: mapName,
                        players: players,
                        max_players: maxPlayers
                    });
                    
                } catch (error) {
                    logger('ERROR', `❌ Error parsing A2S_INFO de ${ip}:${port}: ${error.message}`);
                    resolve(null);
                }
            });
            
            client.on('error', (error) => {
                clearTimeout(timeoutId);
                client.close();
                logger('ERROR', `❌ A2S_INFO UDP error ${ip}:${port}: ${error.message}`);
                resolve(null);
            });
            
            try {
                // Enviar packet A2S_INFO
                const packet = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, ...Buffer.from('Source Engine Query\\0')]);
                client.send(packet, port, ip);
            } catch (error) {
                clearTimeout(timeoutId);
                client.close();
                logger('ERROR', `❌ Error enviando A2S_INFO a ${ip}:${port}: ${error.message}`);
                resolve(null);
            }
        });
    }
}

class RCONManager {
    /**
     * Prueba la conexión RCON con PERSISTENCIA TOTAL
     * @param {string} ip - IP del servidor
     * @param {number} port - Puerto RCON
     * @param {string} password - Contraseña RCON
     * @param {number|null} maxAttempts - Número máximo de intentos (null = ilimitado)
     * @returns {Promise<Object>} Resultado de la prueba
     */
    static async testConnectionPersistent(ip, port, password, maxAttempts = 20) {
        let lastError = null;
        let attempt = 0;
        const startTime = Date.now();
        
        // Timeouts progresivos más agresivos: 10s, 15s, 20s, 25s, luego 30s fijo
        const baseTimeouts = [10000, 15000, 20000, 25000, 30000];
        
        logger('INFO', `🔌 CONEXIÓN PERSISTENTE iniciada para ${ip}:${port} (intentos ${maxAttempts === null ? 'ilimitados' : maxAttempts})`);
        
        while (maxAttempts === null || attempt < maxAttempts) {
            attempt++;
            
            // Timeout progresivo
            const timeout = attempt <= baseTimeouts.length ? baseTimeouts[attempt - 1] : 30000;
            
            try {
                logger('INFO', `🔄 Intento ${attempt} - RCON ${ip}:${port} (timeout: ${timeout/1000}s)`);
                
                const client = new Rcon({
                    host: ip,
                    port: port,
                    password: password,
                    timeout: timeout
                });
                
                await client.connect();
                const response = await client.send('echo "RCON_PERSISTENT_TEST"');
                await client.end();
                
                // Si llegamos aquí, la conexión RCON funcionó (aunque la respuesta esté vacía)
                const totalTime = (Date.now() - startTime) / 1000;
                logger('INFO', `✅ RCON ${ip}:${port} - CONECTADO en intento ${attempt} (${totalTime.toFixed(2)}s total)`);
                return {
                    success: true,
                    error: null,
                    response: response ? response.trim() : '',
                    attempts: attempt,
                    total_time: totalTime
                };
                
            } catch (error) {
                lastError = error.message;
                logger('WARNING', `⚠️ RCON ${ip}:${port} intento ${attempt} falló: ${error.message}`);
            }
            
            // Espera progresiva entre intentos
            let waitTime;
            if (attempt <= 3) {
                waitTime = 2000; // 2 segundos primeros 3 intentos
            } else if (attempt <= 8) {
                waitTime = 5000; // 5 segundos siguientes 5 intentos
            } else if (attempt <= 15) {
                waitTime = 10000; // 10 segundos siguientes 7 intentos
            } else {
                waitTime = 15000; // 15 segundos para intentos posteriores
            }
            
            if (maxAttempts === null || attempt < maxAttempts) {
                logger('INFO', `⏳ Esperando ${waitTime/1000}s antes del siguiente intento...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        const totalTime = (Date.now() - startTime) / 1000;
        logger('ERROR', `❌ RCON ${ip}:${port} - FALLÓ después de ${attempt} intentos (${totalTime.toFixed(2)}s total)`);
        return {
            success: false,
            error: `Falló después de ${attempt} intentos (${totalTime.toFixed(2)}s): ${lastError}`,
            response: null,
            attempts: attempt,
            total_time: totalTime
        };
    }
    
    /**
     * Ejecuta un comando RCON con PERSISTENCIA TOTAL
     * @param {string} ip - IP del servidor
     * @param {number} port - Puerto RCON
     * @param {string} password - Contraseña RCON
     * @param {string} command - Comando a ejecutar
     * @param {number|null} maxAttempts - Número máximo de intentos (null = ilimitado)
     * @returns {Promise<Object>} Resultado del comando
     */
    static async executeCommandPersistent(ip, port, password, command, maxAttempts = 15) {
        let lastError = null;
        let attempt = 0;
        const startTime = Date.now();
        
        // Timeouts especiales para comandos específicos
        let baseTimeouts;
        if (command.toLowerCase().includes('matchinfo') || command.toLowerCase().includes('sv_matchinfojson')) {
            baseTimeouts = [20000, 30000, 40000, 50000, 60000]; // Más tiempo para comandos JSON
        } else {
            baseTimeouts = [10000, 15000, 20000, 25000, 30000];
        }
        
        logger('INFO', `🔄 COMANDO PERSISTENTE '${command}' en ${ip}:${port} (intentos ${maxAttempts === null ? 'ilimitados' : maxAttempts})`);
        
        while (maxAttempts === null || attempt < maxAttempts) {
            attempt++;
            
            // Timeout progresivo
            const timeout = attempt <= baseTimeouts.length ? baseTimeouts[attempt - 1] : baseTimeouts[baseTimeouts.length - 1];
            
            try {
                logger('INFO', `🔄 Ejecutando '${command}' intento ${attempt} (timeout: ${timeout/1000}s)`);
                
                const client = new Rcon({
                    host: ip,
                    port: port,
                    password: password,
                    timeout: timeout
                });
                
                await client.connect();
                const response = await client.send(command);
                await client.end();
                
                // Para IOSoccer: Si llegamos aquí, la conexión funcionó (aunque respuesta vacía)
                const totalTime = (Date.now() - startTime) / 1000;
                if (response !== null && response.trim().length > 0) {
                    logger('INFO', `✅ Comando '${command}' EXITOSO en intento ${attempt}: ${response.length} chars (${totalTime.toFixed(2)}s)`);
                    return {
                        success: true,
                        response: response.trim(),
                        error: null,
                        attempts: attempt,
                        total_time: totalTime
                    };
                } else {
                    // Para IOSoccer: Respuesta vacía pero conexión exitosa = servidor online
                    logger('INFO', `⚠️ '${command}' respuesta vacía pero conexión OK en intento ${attempt} (${totalTime.toFixed(2)}s)`);
                    return {
                        success: true,
                        response: '',
                        error: null,
                        attempts: attempt,
                        total_time: totalTime,
                        note: 'Servidor responde pero sin contenido (configuración RCON limitada)'
                    };
                }
                
            } catch (error) {
                lastError = error.message;
                logger('WARNING', `⚠️ '${command}' falló intento ${attempt}: ${error.message}`);
            }
            
            // Espera progresiva entre intentos
            let waitTime;
            if (attempt <= 3) {
                waitTime = 3000;
            } else if (attempt <= 8) {
                waitTime = 8000;
            } else if (attempt <= 15) {
                waitTime = 15000;
            } else {
                waitTime = 20000;
            }
            
            if (maxAttempts === null || attempt < maxAttempts) {
                logger('INFO', `⏳ Esperando ${waitTime/1000}s antes del siguiente intento del comando...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        const totalTime = (Date.now() - startTime) / 1000;
        logger('ERROR', `❌ Comando '${command}' FALLÓ después de ${attempt} intentos (${totalTime.toFixed(2)}s)`);
        return {
            success: false,
            response: '',
            error: `Falló después de ${attempt} intentos (${totalTime.toFixed(2)}s): ${lastError}`,
            attempts: attempt,
            total_time: totalTime
        };
    }
    
    /**
     * Encuentra el puerto RCON funcional de forma ULTRA PERSISTENTE
     * @param {Object} server - Configuración del servidor
     * @param {string} password - Contraseña RCON
     * @returns {Promise<Object>} Resultado de la búsqueda
     */
    static async findWorkingRconPortPersistent(server, password) {
        logger('INFO', `🔍 BÚSQUEDA PERSISTENTE de puerto RCON para ${server.name}`);
        
        // VALIDACIÓN: Solo usar puertos explícitamente definidos
        const allowedPorts = server.rcon_ports || [];
        if (!allowedPorts.length) {
            return {
                port: null,
                success: false,
                error: 'No hay puertos RCON definidos para este servidor',
                attempts_per_port: {},
                total_time: 0
            };
        }
        
        logger('INFO', `🛡️ Puertos permitidos para ${server.name}: ${allowedPorts}`);
        
        const attemptsLog = {};
        const startTime = Date.now();
        
        // ESTRATEGIA: Intentar cada puerto de forma persistente hasta que UNO funcione
        let globalAttempts = 0;
        const maxGlobalAttempts = 100; // Máximo 100 intentos globales para evitar bucles infinitos
        
        while (globalAttempts < maxGlobalAttempts) { // Loop con límite global
            for (const port of allowedPorts) {
                logger('INFO', `🔐 Probando puerto persistente: ${port}`);
                
                // Intentar este puerto de forma persistente (máximo 10 intentos por puerto por ronda)
                const testResult = await this.testConnectionPersistent(
                    server.ip, port, password, 10  // 10 intentos por puerto por ronda
                );
                
                globalAttempts += testResult.attempts || 0;
                
                // Registrar intentos
                if (!attemptsLog[port]) {
                    attemptsLog[port] = { total_attempts: 0, rounds: 0, last_error: '' };
                }
                
                attemptsLog[port].total_attempts += testResult.attempts || 0;
                attemptsLog[port].rounds += 1;
                attemptsLog[port].last_error = testResult.error || '';
                
                if (testResult.success) {
                    const totalTime = (Date.now() - startTime) / 1000;
                    logger('INFO', `✅ Puerto RCON ENCONTRADO: ${port} (total: ${totalTime.toFixed(2)}s, ${attemptsLog[port].total_attempts} intentos)`);
                    return {
                        port: port,
                        success: true,
                        error: null,
                        attempts_per_port: attemptsLog,
                        total_time: totalTime
                    };
                } else {
                    logger('WARNING', `❌ Puerto ${port} falló ronda ${attemptsLog[port].rounds}: ${testResult.error}`);
                }
            }
            
            // Si llegamos aquí, ningún puerto funcionó en esta ronda
            const timeRemaining = maxGlobalAttempts - globalAttempts;
            if (timeRemaining <= 0) {
                logger('ERROR', `❌ Límite global de intentos alcanzado (${maxGlobalAttempts}). Deteniendo búsqueda.`);
                break;
            }
            
            logger('WARNING', `⚠️ Ningún puerto funcionó en esta ronda. Esperando 15s antes de intentar de nuevo... (${timeRemaining} intentos restantes)`);
            await new Promise(resolve => setTimeout(resolve, 15000)); // Reducido de 30s a 15s
        }
    }
    
    /**
     * Obtiene información del partido de forma ULTRA PERSISTENTE
     * @param {Object} server - Configuración del servidor
     * @param {string} password - Contraseña RCON
     * @returns {Promise<Object>} Resultado de la obtención del JSON
     */
    static async getMatchInfoJsonPersistent(server, password) {
        logger('INFO', `🎮 Obteniendo match info JSON PERSISTENTE para ${server.name}`);
        const startTime = Date.now();
        
        // 1. Encontrar puerto funcional de forma persistente
        const portResult = await this.findWorkingRconPortPersistent(server, password);
        
        if (!portResult.success) {
            return {
                success: false,
                data: null,
                working_port: null,
                error: `Sin puertos RCON funcionales: ${portResult.error}`,
                connection_info: portResult.attempts_per_port,
                total_time: (Date.now() - startTime) / 1000
            };
        }
        
        const workingPort = portResult.port;
        logger('INFO', `🔐 Usando puerto persistente ${workingPort} para match info`);
        
        // 2. Ejecutar sv_matchinfojson de forma persistente (máximo 20 intentos)
        const result = await this.executeCommandPersistent(
            server.ip, workingPort, password, 'sv_matchinfojson', 20
        );
        
        if (!result.success || !result.response) {
            return {
                success: false,
                data: null,
                working_port: workingPort,
                error: `Fallo comando JSON persistente: ${result.error}`,
                connection_info: {
                    port_attempts: portResult.attempts_per_port,
                    command_attempts: result.attempts || 0,
                    command_time: result.total_time || 0
                },
                total_time: (Date.now() - startTime) / 1000
            };
        }
        
        // 3. Parsear JSON con manejo de errores mejorado y REPARACIÓN AUTOMÁTICA
        try {
            const response = result.response.trim();
            logger('INFO', `📄 Respuesta JSON persistente recibida: ${response.length} caracteres`);
            
            let jsonText = response;
            let matchData = null;
            let wasRepaired = false;
            
            // PRIMER INTENTO: JSON directo
            try {
                matchData = JSON.parse(jsonText);
                logger('INFO', `✅ JSON directo válido: ${jsonText.length} caracteres`);
            } catch (directParseError) {
                logger('WARNING', `⚠️ JSON directo inválido: ${directParseError.message}`);
                
                // SEGUNDO INTENTO: Buscar JSON en la respuesta
                let jsonStart = response.indexOf('{');
                let jsonEnd = response.lastIndexOf('}');
                
                if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
                    jsonText = response.substring(jsonStart, jsonEnd + 1);
                    try {
                        matchData = JSON.parse(jsonText);
                        logger('INFO', `✅ JSON extraído válido: ${jsonText.length} caracteres`);
                    } catch (extractedParseError) {
                        logger('WARNING', `⚠️ JSON extraído inválido: ${extractedParseError.message}`);
                    }
                }
                
                // TERCER INTENTO: REPARACIÓN AUTOMÁTICA AVANZADA para IOSoccer
                if (!matchData && jsonText.startsWith('{"matchPeriod"')) {
                    logger('INFO', `🔧 Intentando reparación avanzada JSON de IOSoccer (${jsonText.length} chars)`);
                    
                    // Contar llaves y corchetes
                    const openBraces = (jsonText.match(/{/g) || []).length;
                    const closeBraces = (jsonText.match(/}/g) || []).length;
                    const openBrackets = (jsonText.match(/\[/g) || []).length;
                    const closeBrackets = (jsonText.match(/\]/g) || []).length;
                    
                    const missingBraces = openBraces - closeBraces;
                    const missingBrackets = openBrackets - closeBrackets;
                    
                    logger('INFO', `📊 Análisis JSON: ${openBraces} llaves abiertas, ${closeBraces} cerradas (faltan: ${missingBraces}), ${openBrackets} corchetes abiertos, ${closeBrackets} cerrados (faltan: ${missingBrackets})`);
                    
                    let repairedJson = jsonText.trim();
                    let repairAttempts = 0;
                    
                    // ESTRATEGIA 1: Patrón conocido - evento cortado
                    if (missingBraces === 1 && repairedJson.endsWith('"startPosition":null}')) {
                        repairedJson += ']}';
                        repairAttempts++;
                        logger('INFO', `🔧 Intento ${repairAttempts}: Patrón evento completo`);
                    }
                    // ESTRATEGIA 2: Cortado en medio de evento - termina con coma
                    else if (missingBraces >= 1 && repairedJson.endsWith(',')) {
                        repairedJson = repairedJson.slice(0, -1); // Quitar coma
                        // Cerrar arrays y objetos faltantes
                        for (let i = 0; i < missingBrackets; i++) {
                            repairedJson += ']';
                        }
                        for (let i = 0; i < missingBraces; i++) {
                            repairedJson += '}';
                        }
                        repairAttempts++;
                        logger('INFO', `🔧 Intento ${repairAttempts}: Cortado en coma`);
                    }
                    // ESTRATEGIA 2.1: Cortado en string incompleto con comillas
                    else if (missingBraces >= 1 && repairedJson.match(/"[^"]*$/)) {
                        // Buscar la última comilla no cerrada y cerrarla
                        const lastQuoteIndex = repairedJson.lastIndexOf('"');
                        const beforeQuote = repairedJson.substring(0, lastQuoteIndex + 1);
                        repairedJson = beforeQuote + '"';
                        // Cerrar arrays y objetos faltantes
                        for (let i = 0; i < missingBrackets; i++) {
                            repairedJson += ']';
                        }
                        for (let i = 0; i < missingBraces; i++) {
                            repairedJson += '}';
                        }
                        repairAttempts++;
                        logger('INFO', `🔧 Intento ${repairAttempts}: String cortado con comillas`);
                    }
                    // ESTRATEGIA 3: Cortado en string - termina con comillas
                    else if (missingBraces >= 1 && repairedJson.endsWith('"')) {
                        // Cerrar arrays y objetos faltantes
                        for (let i = 0; i < missingBrackets; i++) {
                            repairedJson += ']';
                        }
                        for (let i = 0; i < missingBraces; i++) {
                            repairedJson += '}';
                        }
                        repairAttempts++;
                        logger('INFO', `🔧 Intento ${repairAttempts}: Cortado en string`);
                    }
                    // ESTRATEGIA 4: Cortado después de valor - sin terminación clara
                    else if (missingBraces >= 1) {
                        // Verificar si estamos en un array (matchEvents es lo más común)
                        if (repairedJson.includes('"matchEvents":[') && missingBrackets >= 1) {
                            // Probablemente cortado en el array de eventos
                            for (let i = 0; i < missingBrackets; i++) {
                                repairedJson += ']';
                            }
                        }
                        // Cerrar objetos faltantes
                        for (let i = 0; i < missingBraces; i++) {
                            repairedJson += '}';
                        }
                        repairAttempts++;
                        logger('INFO', `🔧 Intento ${repairAttempts}: Reparación genérica (${missingBraces} llaves, ${missingBrackets} corchetes)`);
                    }
                    
                    // ESTRATEGIA 5: Si nada funciona, intentar buscar el último objeto válido
                    if (repairAttempts === 0) {
                        // Buscar hacia atrás desde el final hasta encontrar un punto válido para cortar
                        const lastValidBrace = repairedJson.lastIndexOf('}');
                        const lastValidBracket = repairedJson.lastIndexOf(']');
                        const cutPoint = Math.max(lastValidBrace, lastValidBracket);
                        
                        if (cutPoint > repairedJson.length * 0.5) { // Solo si no cortamos más del 50%
                            repairedJson = repairedJson.substring(0, cutPoint + 1);
                            repairAttempts++;
                            logger('INFO', `🔧 Intento ${repairAttempts}: Corte en punto válido (posición ${cutPoint})`);
                        }
                    }
                    
                    // Intentar parsear el JSON reparado
                    if (repairAttempts > 0) {
                        try {
                            matchData = JSON.parse(repairedJson);
                            jsonText = repairedJson;
                            wasRepaired = true;
                            logger('INFO', `✅ JSON IOSoccer reparado exitosamente en intento ${repairAttempts}: ${repairedJson.length} caracteres (${repairedJson.length - response.length > 0 ? '+' : ''}${repairedJson.length - response.length})`);
                            
                            // Validar que el JSON reparado tiene datos esenciales
                            if (matchData.teamNameHome && matchData.teamNameAway && matchData.matchPeriod) {
                                logger('INFO', `🎯 JSON reparado válido: ${matchData.teamNameHome} vs ${matchData.teamNameAway} (${matchData.matchPeriod})`);
                            } else {
                                logger('WARNING', `⚠️ JSON reparado incompleto: faltan campos esenciales`);
                                matchData = null;
                                wasRepaired = false;
                            }
                        } catch (repairError) {
                            logger('WARNING', `⚠️ Reparación intento ${repairAttempts} falló: ${repairError.message}`);
                            matchData = null;
                            wasRepaired = false;
                        }
                    } else {
                        logger('WARNING', `⚠️ No se pudo determinar estrategia de reparación para JSON`);
                    }
                }
            }
            
            if (!matchData) {
                return {
                    success: false,
                    data: null,
                    working_port: workingPort,
                    error: `No se pudo parsear JSON después de múltiples intentos`,
                    connection_info: {
                        raw_response_preview: response.length > 300 ? response.substring(0, 300) + '...' : response,
                        parsing_attempts: 'direct_extracted_repair_all_failed',
                        response_length: response.length
                    },
                    total_time: (Date.now() - startTime) / 1000
                };
            }
            
            const totalTime = (Date.now() - startTime) / 1000;
            const repairInfo = wasRepaired ? ' (REPARADO)' : '';
            logger('INFO', `✅ JSON PERSISTENTE parseado exitosamente${repairInfo}: ${jsonText.length} caracteres, ${Object.keys(matchData).length} campos (${totalTime.toFixed(2)}s total)`);
            
            return {
                success: true,
                data: matchData,
                working_port: workingPort,
                error: null,
                repaired: wasRepaired,
                connection_info: {
                    port_attempts: portResult.attempts_per_port,
                    command_attempts: result.attempts || 0,
                    command_time: result.total_time || 0,
                    json_size: jsonText.length,
                    was_repaired: wasRepaired
                },
                total_time: totalTime
            };
            
        } catch (error) {
            logger('ERROR', `❌ Error parsing JSON persistente: ${error.message}`);
            return {
                success: false,
                data: null,
                working_port: workingPort,
                error: `JSON inválido en respuesta persistente: ${error.message}`,
                connection_info: {
                    json_text_preview: result.response.substring(0, 500),
                    parse_error: error.message,
                    total_attempts: result.attempts || 0
                },
                total_time: (Date.now() - startTime) / 1000
            };
        }
    }
    
    // ============= MÉTODOS DE COMPATIBILIDAD =============
    
    /**
     * Alias de compatibilidad para testConnection
     */
    static async testConnection(ip, port, password, maxRetries = 3) {
        return await this.testConnectionPersistent(ip, port, password, maxRetries);
    }
    
    /**
     * Alias de compatibilidad para executeCommand
     */
    static async executeCommand(ip, port, password, command, timeout = 10000) {
        return await this.executeCommandPersistent(ip, port, password, command, 2);
    }
    
    /**
     * Diagnóstico completo de RCON para debugging
     * @param {string} ip - IP del servidor
     * @param {number} port - Puerto RCON
     * @param {string} password - Contraseña RCON
     * @returns {Promise<Object>} Resultado del diagnóstico
     */
    static async diagnosticRCON(ip, port, password) {
        const startTime = Date.now();
        logger('INFO', `🔍 INICIANDO DIAGNÓSTICO RCON COMPLETO: ${ip}:${port}`);
        
        const results = {
            connection_test: null,
            commands_tested: [],
            working_commands: [],
            failed_commands: [],
            total_time: 0,
            diagnosis: ''
        };
        
        // 1. Test de conexión básico
        logger('INFO', `🔌 Test de conexión básica...`);
        results.connection_test = await this.testConnectionPersistent(ip, port, password, 2);
        
        if (!results.connection_test.success) {
            results.diagnosis = `FALLO CRÍTICO: No se puede conectar RCON - ${results.connection_test.error}`;
            results.total_time = (Date.now() - startTime) / 1000;
            return results;
        }
        
        logger('INFO', `✅ Conexión RCON exitosa, probando comandos...`);
        
        // 2. Lista de comandos para probar
        const commandsToTest = [
            'echo "test"',
            'version',
            'status',
            'sv_matchinfojson',
            'hostname',
            'users',
            'stats',
            'help'
        ];
        
        // 3. Probar cada comando
        for (const command of commandsToTest) {
            logger('INFO', `🧪 Probando comando: '${command}'`);
            
            try {
                const result = await this.executeCommandPersistent(ip, port, password, command, 1);
                
                const commandResult = {
                    command: command,
                    success: result.success,
                    response_length: result.response ? result.response.length : 0,
                    response_preview: result.response ? result.response.substring(0, 200) : 'Sin respuesta',
                    error: result.error || null,
                    attempts: result.attempts || 0
                };
                
                results.commands_tested.push(commandResult);
                
                if (result.success && result.response && result.response.trim().length > 0) {
                    results.working_commands.push(command);
                    logger('INFO', `✅ '${command}' -> OK (${result.response.length} chars)`);
                } else {
                    results.failed_commands.push(command);
                    logger('WARNING', `❌ '${command}' -> FALLO: ${result.error || 'Sin respuesta'}`);
                }
                
            } catch (error) {
                const commandResult = {
                    command: command,
                    success: false,
                    response_length: 0,
                    response_preview: 'Excepción',
                    error: error.message,
                    attempts: 0
                };
                
                results.commands_tested.push(commandResult);
                results.failed_commands.push(command);
                logger('ERROR', `💥 '${command}' -> EXCEPCIÓN: ${error.message}`);
            }
        }
        
        // 4. Generar diagnóstico
        results.total_time = (Date.now() - startTime) / 1000;
        
        if (results.working_commands.length === 0) {
            results.diagnosis = "PROBLEMA: RCON conecta pero NINGÚN comando responde. Posible problema de permisos o servidor configurado solo para conexión.";
        } else if (results.working_commands.length < 3) {
            results.diagnosis = `PROBLEMA PARCIAL: Solo ${results.working_commands.length} comandos funcionan de ${commandsToTest.length}. Comandos OK: ${results.working_commands.join(', ')}`;
        } else {
            results.diagnosis = `OK: ${results.working_commands.length} comandos funcionan correctamente. El servidor RCON responde bien.`;
        }
        
        logger('INFO', `🏁 DIAGNÓSTICO COMPLETO: ${results.diagnosis} (${results.total_time.toFixed(2)}s)`);
        
        return results;
    }
}

module.exports = {
    A2SQuery,
    RCONManager,
    logger
};

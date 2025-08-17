const { EmbedBuilder } = require('discord.js');
const { A2SQuery, RCONManager, logger } = require('./queryUtils');
const { parseMatchInfo, formatGoalsDisplay, getTopScorers } = require('./matchParser');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const RCON_PASSWORD = process.env.RCON_PASSWORD || 'l:R9(4M~iR9f-7ifOm!8eE`@?1:wjduwb-djjawnjdjs-poqwwopie-kadmk';

// Configuración de servidores IOSoccer
const SERVERS = [
    {
        name: 'ELO #1',
        ip: '45.235.98.16',
        port: 27018,
        rcon_ports: [27018],  // SOLO este puerto para este servidor
        id: 'iosoccer_1',     // ID único para logs
        max_connection_time: 120,  // Tiempo máximo total de conexión
        password: 'elo',      // Contraseña para conectar al servidor (jugadores)
        rcon_password: RCON_PASSWORD  // Usar contraseña RCON real del .env
    },
    {
        name: 'ELO #2',
        ip: '45.235.98.16',
        port: 27019,
        rcon_ports: [27019],  // SOLO este puerto para este servidor
        id: 'iosoccer_2',     // ID único para logs
        max_connection_time: 120,  // Tiempo máximo total de conexión
        password: 'elo',      // Contraseña para conectar al servidor (jugadores)
        rcon_password: RCON_PASSWORD  // Usar contraseña RCON real del .env
    },
    {
        name: 'IOSSA #1',
        ip: '45.235.98.16',
        port: 27015,
        rcon_ports: [27015],  // SOLO este puerto para este servidor
        id: 'iossa_1',       // ID único para logs
        max_connection_time: 120,  // Tiempo máximo total de conexión
        password: 'iosmatch', // Contraseña para conectar al servidor (jugadores)
        rcon_password: RCON_PASSWORD  // Usar contraseña RCON real del .env
    },
    {
        name: 'IOSSA #2',
        ip: '45.235.98.16',
        port: 27016,
        rcon_ports: [27016],  // SOLO este puerto para este servidor
        id: 'iossa_2',       // ID único para logs
        max_connection_time: 120,  // Tiempo máximo total de conexión
        password: 'iosmatch', // Contraseña para conectar al servidor (jugadores)
        rcon_password: RCON_PASSWORD  // Usar contraseña RCON real del .env
    },
    {
        name: 'IOSSA #3',
        ip: '45.235.98.16',
        port: 27017,
        rcon_ports: [27017],  // SOLO este puerto para este servidor
        id: 'iossa_3',       // ID único para logs
        max_connection_time: 120,  // Tiempo máximo total de conexión
        password: 'iosmatch', // Contraseña para conectar al servidor (jugadores)
        rcon_password: RCON_PASSWORD  // Usar contraseña RCON real del .env
    }
];

/**
 * Clase para almacenar información del servidor
 */
class ServerInfo {
    constructor(name, status, players = 0, maxPlayers = 0, mapName = "N/A", matchInfo = null, basicInfo = null) {
        this.name = name;
        this.status = status;
        this.players = players;
        this.maxPlayers = maxPlayers;
        this.mapName = mapName;
        this.matchInfo = matchInfo;  // JSON data del partido
        this.basicInfo = basicInfo;  // Info básica A2S
    }
}

/**
 * Obtiene información completa del servidor con conexión ULTRA PERSISTENTE
 * @param {Object} server - Configuración del servidor
 * @returns {Promise<ServerInfo>} - Información del servidor
 */
async function getServerInfoRobust(server) {
    // Validar configuración del servidor
    if (!server.rcon_ports || server.rcon_ports.length === 0) {
        logger('ERROR', `❌ Servidor ${server.name || 'Unknown'} sin puertos RCON definidos`);
        return new ServerInfo(
            server.name || 'Unknown',
            "🔴 Error - Sin puertos RCON"
        );
    }
    
    try {
        logger('INFO', `📡 Consultando servidor ULTRA ROBUSTO: ${server.name} (ID: ${server.id || 'unknown'})`);
        
        // 1. Información básica con A2S_INFO (timeout aumentado)
        const a2sInfo = await A2SQuery.queryServer(server.ip, server.port, 12);  // Timeout aumentado
        
        if (!a2sInfo) {
            logger('WARNING', `❌ A2S_INFO falló para ${server.name}, intentando RCON simple...`);
            
            // A2S falló, pero el servidor puede estar online - hacer test RCON simple
            try {
                const rconPassword = server.rcon_password || RCON_PASSWORD;
                const testResult = await RCONManager.testConnectionPersistent(
                    server.ip, server.rcon_ports[0], rconPassword, 10  // Máximo 10 intentos por servidor offline
                );
                
                if (testResult.success) {
                    logger('INFO', `✅ RCON funciona para ${server.name} - servidor online pero A2S deshabilitado`);
                    
                    // Intentar obtener match info con reparación automática si es posible
                    try {
                        const matchResult = await RCONManager.getMatchInfoJsonPersistent(server, rconPassword);
                        
                        if (matchResult.success && matchResult.data) {
                            const matchInfo = parseMatchInfo(matchResult.data);
                            if (matchInfo) {
                                const repairInfo = matchResult.repaired ? ' (JSON reparado)' : '';
                                logger('INFO', `✅ Match info obtenida vía RCON${repairInfo}: ${matchInfo.team_home} vs ${matchInfo.team_away}`);
                                return new ServerInfo(
                                    server.name,
                                    "🟢 Online (A2S Deshabilitado)",
                                    matchInfo.players_count || 0,
                                    matchInfo.max_players || 22,
                                    matchInfo.map_name || "N/A",
                                    matchInfo,
                                    null
                                );
                            }
                        }
                    } catch (e) {
                        logger('WARNING', `⚠️ No se pudo obtener match info de ${server.name}: ${e.message}`);
                    }
                    
                    // Intentar comando básico para confirmar servidor online
                    try {
                        const basicResult = await RCONManager.executeCommandPersistent(
                            server.ip, server.rcon_ports[0], rconPassword, 'status', 5
                        );
                        
                        if (basicResult.success) {
                            logger('INFO', `✅ Servidor ${server.name} confirmado ONLINE vía comando 'status'`);
                            return new ServerInfo(
                                server.name,
                                "🟡 Online (Sin Partido)",
                                0,
                                22,
                                "N/A",
                                null,
                                null
                            );
                        }
                    } catch (e) {
                        logger('WARNING', `⚠️ Comando 'status' también falló para ${server.name}: ${e.message}`);
                    }
                    
                    // RCON funciona (test connection exitoso) pero comandos fallan
                    logger('INFO', `⚠️ RCON conecta pero comandos fallan para ${server.name} - marcando como ONLINE con info limitada`);
                    return new ServerInfo(
                        server.name,
                        "🟡 Online (Info Limitada)",
                        0,
                        22,
                        "N/A",
                        null,
                        null
                    );
                } else {
                    logger('WARNING', `❌ RCON también falló para ${server.name}: ${testResult.error}`);
                    return new ServerInfo(
                        server.name,
                        "🔴 Offline"
                    );
                }
            } catch (error) {
                logger('ERROR', `❌ Error en test RCON de ${server.name}: ${error}`);
                return new ServerInfo(
                    server.name,
                    "🔴 Error General"
                );
            }
        }
        
        logger('INFO', `✅ A2S_INFO exitoso para ${server.name}: ${a2sInfo.players}/${a2sInfo.max_players}`);
        
        // 2. Información del partido con método ULTRA PERSISTENTE
        const rconPassword = server.rcon_password || RCON_PASSWORD;
        const matchResult = await RCONManager.getMatchInfoJsonPersistent(server, rconPassword);
        
        let matchInfo = null;
        const connectionDetails = matchResult.connectionInfo || {};
        
        if (matchResult.success && matchResult.data) {
            logger('INFO', `📊 JSON PERSISTENTE obtenido para ${server.name}: ${JSON.stringify(matchResult.data).length} caracteres en ${matchResult.totalTime?.toFixed(2) || 0}s`);
            
            // SIEMPRE intentar parsear el JSON
            matchInfo = parseMatchInfo(matchResult.data);
            
            if (matchInfo) {
                logger('INFO', `✅ Match info PERSISTENTE parseada: ${matchInfo.team_home} ${matchInfo.goals_home}-${matchInfo.goals_away} ${matchInfo.team_away} (${matchInfo.time_display})`);
            } else {
                logger('WARNING', `⚠️ No se pudo parsear match info para ${server.name} (JSON obtenido pero parsing falló)`);
            }
        } else {
            logger('WARNING', `⚠️ No se pudo obtener JSON para ${server.name} después de ${matchResult.totalTime?.toFixed(2) || 0}s: ${matchResult.error}`);
            matchInfo = null;
        }
        
        return new ServerInfo(
            server.name,
            "🟢 Online",
            a2sInfo.players,
            a2sInfo.max_players,
            a2sInfo.map_name,
            matchInfo,
            a2sInfo
        );
        
    } catch (error) {
        logger('ERROR', `❌ Error obteniendo info ULTRA ROBUSTA de ${server.name}: ${error}`);
        return new ServerInfo(
            server.name,
            "🔴 Error General"
        );
    }
}

/**
 * Crea embed detallado con información del partido - VERSIÓN PARA JSON REAL
 * @param {ServerInfo} serverInfo - Información del servidor
 * @returns {EmbedBuilder} - Embed de Discord con información del partido
 */
function createMatchEmbedImproved(serverInfo) {
    if (!serverInfo.matchInfo) {
        // CAMBIAR este embed para que use datos A2S básicos
        const embed = new EmbedBuilder()
            .setTitle(`⚽ ${serverInfo.name}`)
            .setColor(serverInfo.status.includes("Online") ? 0x00ff00 : 0xff0000);
        
        const serverConfig = SERVERS.find(s => s.name === serverInfo.name);
        const connectInfo = serverConfig ? `${serverConfig.ip}:${serverConfig.port}` : "N/A";
        
        if (serverInfo.status.includes("Online")) {
            const serverPassword = serverConfig ? serverConfig.password || 'elo' : 'elo';
            
            let statusDetail = "";
            if (serverInfo.status.includes("A2S Deshabilitado")) {
                statusDetail = "A2S deshabilitado, conectado vía RCON";
            } else if (serverInfo.status.includes("Sin Partido")) {
                statusDetail = "Sin partido activo";
            } else if (serverInfo.status.includes("Info Limitada")) {
                statusDetail = "Servidor online, información limitada";
            } else {
                statusDetail = "Sin información de partido disponible";
            }
            
            embed.addFields({
                name: "📊 Servidor Online (Sin Match Info)",
                value: `**👥 Jugadores:** ${serverInfo.players}/${serverInfo.maxPlayers}\n` +
                       `**🗺️ Mapa:** ${serverInfo.mapName}\n` +
                       `**🌐 Conectar:** \`connect ${connectInfo};password ${serverPassword}\`\n` +
                       `**⚠️ Estado:** ${statusDetail}\n` +
                       `**📶 Conexión:** RCON funcionando correctamente`,
                inline: false
            });
        } else {
            embed.addFields({
                name: "❌ Servidor Offline",
                value: `**📡 IP:** \`${connectInfo}\`\n**Estado:** ${serverInfo.status}`,
                inline: false
            });
        }
        
        return embed;
    }
    
    // Embed completo con información del partido
    const matchInfo = serverInfo.matchInfo;
    
    // Color según el estado del partido
    const period = matchInfo.period.toUpperCase();
    let color;
    if (period.includes('FIRST')) {
        color = 0x00ff00;  // Verde - Primer tiempo
    } else if (period.includes('SECOND')) {
        color = 0x00aa00;  // Verde más oscuro - Segundo tiempo
    } else if (period.includes('HALF TIME')) {
        color = 0xffa500;  // Naranja - Descanso
    } else if (period.includes('FULL TIME') || period.includes('FINISHED')) {
        color = 0x888888;  // Gris - Partido terminado
    } else {
        color = 0x0099ff;  // Azul - Otro estado
    }
    
    // TÍTULO CON NOMBRES REALES DE EQUIPOS
    const embed = new EmbedBuilder()
        .setTitle(`⚽ ${serverInfo.name} - ${matchInfo.format}`)
        .setDescription(`**${matchInfo.team_home}** vs **${matchInfo.team_away}**`)
        .setColor(color)
        .setTimestamp();
    
    // Información del servidor
    const serverConfig = SERVERS.find(s => s.name === serverInfo.name);
    const connectInfo = serverConfig ? `${serverConfig.ip}:${serverConfig.port}` : "N/A";
    
    const serverPassword = serverConfig ? serverConfig.password || 'elo' : 'elo';
    embed.addFields({
        name: "📊 Información del Servidor",
        value: `**👥 Jugadores:** ${matchInfo.players_count}/${matchInfo.max_players}\n` +
               `**🗺️ Mapa:** ${matchInfo.map_name}\n` +
               `**🌐 Conectar:** \`connect ${connectInfo};password ${serverPassword}\``,
        inline: false
    });
    
    // MARCADOR PRINCIPAL CON NOMBRES REALES
    const scoreText = `**${matchInfo.team_home} ${matchInfo.goals_home} - ${matchInfo.goals_away} ${matchInfo.team_away}**`;
    
    // Emoji según el período
    let periodEmoji;
    if (period.includes('FIRST') || period.includes('SECOND')) {
        periodEmoji = "⚽";
    } else if (period.includes('HALF TIME')) {
        periodEmoji = "⏸️";
    } else if (period.includes('FULL TIME')) {
        periodEmoji = "🏁";
    } else {
        periodEmoji = "📅";
    }
    
    embed.addFields({
        name: "🏆 Marcador",
        value: `${scoreText}\n` +
               `⏱️ **${matchInfo.time_display}** | ${periodEmoji} **${matchInfo.period}**`,
        inline: false
    });
    
    // GOLES DETALLADOS POR EQUIPO - SOLO MOSTRAR GOLES REALES DEL JSON
    const homeGoals = matchInfo.goals_detail ? matchInfo.goals_detail.filter(goal => goal.team === 'home') : [];
    const awayGoals = matchInfo.goals_detail ? matchInfo.goals_detail.filter(goal => goal.team === 'away') : [];
    
    // Goles equipo local
    let homeGoalsText = "";
    if (homeGoals.length > 0) {
        for (const goal of homeGoals) {
            const assistText = goal.assist_name ? ` (${goal.assist_name})` : "";
            homeGoalsText += `⚽ **${goal.minute}** ${goal.scorer_name}${assistText}\n`;
        }
    }
    
    // Si faltan goles, indicarlo claramente
    if (homeGoals.length < matchInfo.goals_home) {
        const missingCount = matchInfo.goals_home - homeGoals.length;
        if (homeGoalsText) {
            homeGoalsText += `⚠️ *${missingCount} gol${missingCount > 1 ? 'es' : ''} más (datos no disponibles)*`;
        } else {
            homeGoalsText = `⚠️ *${matchInfo.goals_home} gol${matchInfo.goals_home > 1 ? 'es' : ''} (datos no disponibles)*`;
        }
    }
    
    if (!homeGoalsText) {
        homeGoalsText = "Sin goles";
    }
    
    embed.addFields({
        name: `🥅 ${matchInfo.team_home}`,
        value: homeGoalsText.trim(),
        inline: true
    });
    
    // Goles equipo visitante
    let awayGoalsText = "";
    if (awayGoals.length > 0) {
        for (const goal of awayGoals) {
            const assistText = goal.assist_name ? ` (${goal.assist_name})` : "";
            awayGoalsText += `⚽ **${goal.minute}** ${goal.scorer_name}${assistText}\n`;
        }
    }
    
    // Si faltan goles, indicarlo claramente
    if (awayGoals.length < matchInfo.goals_away) {
        const missingCount = matchInfo.goals_away - awayGoals.length;
        if (awayGoalsText) {
            awayGoalsText += `⚠️ *${missingCount} gol${missingCount > 1 ? 'es' : ''} más (datos no disponibles)*`;
        } else {
            awayGoalsText = `⚠️ *${matchInfo.goals_away} gol${matchInfo.goals_away > 1 ? 'es' : ''} (datos no disponibles)*`;
        }
    }
    
    if (!awayGoalsText) {
        awayGoalsText = "Sin goles";
    }
    
    embed.addFields({
        name: `🥅 ${matchInfo.team_away}`,
        value: awayGoalsText.trim(),
        inline: true
    });
    
    // Espacio para nueva línea
    embed.addFields({ name: "\u200b", value: "\u200b", inline: true });
    
    // Goleadores SOLO basado en los datos disponibles
    if (homeGoals.length > 0 || awayGoals.length > 0) {
        const allGoals = [...homeGoals, ...awayGoals];
        const scorerCount = {};
        
        for (const goal of allGoals) {
            const scorer = goal.scorer_name;
            scorerCount[scorer] = (scorerCount[scorer] || 0) + 1;
        }
        
        if (Object.keys(scorerCount).length > 0) {
            let scorersText = "";
            const medals = ["🥇", "🥈", "🥉"];
            const topScorers = Object.entries(scorerCount).sort((a, b) => b[1] - a[1]);
            
            for (let i = 0; i < Math.min(topScorers.length, 3); i++) {
                const [playerName, goalCount] = topScorers[i];
                const medal = medals[i] || "🏆";
                const plural = goalCount > 1 ? "goles" : "gol";
                scorersText += `${medal} **${playerName}** (${goalCount} ${plural})\n`;
            }
            
            // Si hay goles sin datos, indicarlo
            const totalGoalsWithData = homeGoals.length + awayGoals.length;
            const totalGoalsInMatch = matchInfo.goals_home + matchInfo.goals_away;
            if (totalGoalsWithData < totalGoalsInMatch) {
                const missingTotal = totalGoalsInMatch - totalGoalsWithData;
                scorersText += `\n⚠️ *${missingTotal} gol${missingTotal > 1 ? 'es' : ''} sin datos detallados*`;
            }
            
            embed.addFields({
                name: "🏆 Goleadores (con datos disponibles)",
                value: scorersText.trim(),
                inline: false
            });
        }
    }
    
    // Footer
    embed.setFooter({ text: `🔄 Actualizado | ${new Date().toLocaleTimeString()}` });
    
    return embed;
}

/**
 * Crea el embed de estado general de todos los servidores
 * @param {Array<ServerInfo>} serversInfo - Array de información de servidores
 * @returns {EmbedBuilder} - Embed con estado general
 */
function createStatusEmbed(serversInfo) {
    const embed = new EmbedBuilder()
        .setTitle("⚽ Estado Servidores IOSoccer")
        .setDescription("Información en tiempo real con Match Info JSON")
        .setColor(0x00ff00)
        .setTimestamp();
    
    let onlineCount = 0;
    let totalPlayers = 0;
    let activeMatches = 0;
    
    for (const serverInfo of serversInfo) {
        if (serverInfo.status.includes("Online")) {
            onlineCount++;
            totalPlayers += serverInfo.players;
            
            // Verificar si hay partido activo
            if (serverInfo.matchInfo && 
                ['FIRST HALF', 'SECOND HALF', 'PLAYING'].includes(serverInfo.matchInfo.period.toUpperCase())) {
                activeMatches++;
            }
        }
    }
    
    // Resumen general
    const summary = `**🌐 Servidores Online:** ${onlineCount}/${serversInfo.length}\n` +
                   `**👥 Jugadores Totales:** ${totalPlayers}\n` +
                   `**⚽ Partidos Activos:** ${activeMatches}`;
    
    embed.addFields({
        name: "📊 Resumen General",
        value: summary,
        inline: false
    });
    
    embed.setFooter({
        text: `🔄 Actualizado con Match Info JSON | ${new Date().toLocaleTimeString()}`
    });
    
    return embed;
}

/**
 * Valida que la configuración de servidores sea segura
 * @returns {Object} - Resultado de la validación con errores y advertencias
 */
function validateServerConfig() {
    const errors = [];
    const warnings = [];
    
    // Verificar que no hay puertos duplicados
    const allPorts = [];
    for (const server of SERVERS) {
        const rconPorts = server.rcon_ports || [];
        
        // Verificar configuración mínima
        if (!server.name) {
            errors.push(`Servidor sin nombre: ${JSON.stringify(server)}`);
        }
        if (!server.ip) {
            errors.push(`Servidor sin IP: ${server.name || 'Unknown'}`);
        }
        if (!rconPorts || rconPorts.length === 0) {
            errors.push(`Servidor sin puertos RCON: ${server.name || 'Unknown'}`);
        }
        
        // Verificar puertos únicos
        for (const port of rconPorts) {
            if (allPorts.includes(port)) {
                errors.push(`Puerto RCON duplicado ${port} en ${server.name || 'Unknown'}`);
            }
            allPorts.push(port);
        }
        
        // Verificar que el puerto RCON coincida con el puerto del servidor (recomendado)
        if (!rconPorts.includes(server.port)) {
            warnings.push(`Puerto servidor ${server.port} no está en puertos RCON ${rconPorts.join(', ')} para ${server.name}`);
        }
    }
    
    logger('INFO', `🔍 Configuración validada: ${errors.length} errores, ${warnings.length} advertencias`);
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        totalServers: SERVERS.length,
        totalPorts: allPorts.length
    };
}

module.exports = {
    SERVERS,
    RCON_PASSWORD,
    ServerInfo,
    getServerInfoRobust,
    createMatchEmbedImproved,
    createStatusEmbed,
    validateServerConfig
};

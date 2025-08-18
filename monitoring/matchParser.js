// Funciones utilitarias para parsing de información de partidos IOSoccer

/**
 * Convierte segundos a formato MM:SS
 * @param {number} seconds - Segundos a convertir
 * @returns {string} Tiempo en formato MM:SS
 */
function secondsToMinutes(seconds) {
    if (!seconds) {
        return "0:00";
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Cuenta solo los jugadores reales (no bots)
 * @param {Array} players - Array de jugadores
 * @returns {number} Número de jugadores reales
 */
function countRealPlayers(players) {
    if (!players || !Array.isArray(players)) {
        return 0;
    }
    
    let realPlayers = 0;
    for (const player of players) {
        // Diferentes estructuras posibles
        let playerInfo;
        if (player.info) {
            playerInfo = player.info;
        } else {
            playerInfo = player;
        }
        
        const steamId = playerInfo.steamId || playerInfo.steamID || '';
        const name = playerInfo.name || '';
        
        // Filtrar bots y SourceTV
        if (steamId && 
            steamId !== 'BOT' && 
            steamId !== 'SourceTV' && 
            !name.startsWith('Bot') &&
            steamId !== '0') {
            realPlayers++;
        }
    }
    
    return realPlayers;
}

/**
 * Extrae jugadores de un equipo específico
 * @param {Array} players - Array de jugadores
 * @param {string} teamSide - Lado del equipo ('home' o 'away')
 * @param {string} teamName - Nombre del equipo (opcional)
 * @returns {Array} Array de jugadores del equipo
 */
function extractTeamPlayersImproved(players, teamSide, teamName = null) {
    if (!players || !Array.isArray(players)) {
        return [];
    }
    
    const teamPlayers = [];
    
    for (const player of players) {
        let playerInfo, periods;
        
        if (player.info) {
            playerInfo = player.info;
            periods = player.matchPeriodData || [];
        } else {
            playerInfo = player;
            periods = player.periods || [];
        }
        
        const steamId = playerInfo.steamId || playerInfo.steamID || '';
        const name = playerInfo.name || 'Unknown';
        
        // Filtrar bots y SourceTV
        if (['BOT', 'SourceTV'].includes(steamId) || !steamId || steamId === '0') {
            continue;
        }
        
        // Buscar equipo actual del jugador en el último período
        let currentTeam = null;
        let currentPosition = 'N/A';
        
        if (periods && periods.length > 0) {
            // Obtener el último período activo
            const activePeriods = periods.filter(p => p.info && p.info);
            if (activePeriods.length > 0) {
                const lastPeriod = activePeriods[activePeriods.length - 1];
                const periodInfo = lastPeriod.info;
                currentTeam = periodInfo.team || '';
                currentPosition = periodInfo.position || 'N/A';
            }
        }
        
        // Solo incluir jugadores del equipo solicitado
        if (currentTeam === teamSide) {
            teamPlayers.push({
                steamId: steamId,
                name: name,
                position: currentPosition,
                team_name: teamName || teamSide.charAt(0).toUpperCase() + teamSide.slice(1)
            });
        }
    }
    
    return teamPlayers;
}

/**
 * Extrae información detallada de goles desde los eventos
 * @param {Array} events - Array de eventos del partido
 * @param {Array} players - Array de jugadores para obtener nombres
 * @param {Array} teams - Array de equipos para obtener nombres
 * @returns {Array} Array de información de goles
 */
function parseGoalsFromEventsImproved(events, players = [], teams = []) {
    if (!events || !Array.isArray(events)) {
        return [];
    }
    
    const goals = [];
    
    // Crear diccionario de jugadores para búsqueda rápida
    const playerDict = {};
    for (const player of players) {
        let playerInfo;
        if (player.info) {
            playerInfo = player.info;
        } else {
            playerInfo = player;
        }
        
        const steamId = playerInfo.steamId || playerInfo.steamID || '';
        const name = playerInfo.name || 'Unknown';
        
        if (steamId && steamId !== 'BOT' && steamId !== 'SourceTV') {
            playerDict[steamId] = name;
        }
    }
    
    // Crear diccionario de nombres de equipos
    const teamNames = {};
    if (teams.length >= 2) {
        // Equipo home (índice 0)
        if (teams[0] && teams[0].matchTotal && teams[0].matchTotal.name) {
            teamNames.home = teams[0].matchTotal.name;
        }
        // Equipo away (índice 1)  
        if (teams[1] && teams[1].matchTotal && teams[1].matchTotal.name) {
            teamNames.away = teams[1].matchTotal.name;
        }
    }
    
    // Procesar eventos de goles
    for (const event of events) {
        const eventType = event.event || event.type || '';
        
        if (eventType.toUpperCase() === 'GOAL') {
            const scorerId = event.player1SteamId || event.scorerSteamId || '';
            const assistId = event.player2SteamId || event.assistSteamId || '';
            
            // Tiempo del gol
            const goalTimeSeconds = event.second || event.time || 0;
            
            // Determinar equipo del gol basado en el scorer
            const goalTeam = event.team || 'unknown';
            const teamName = teamNames[goalTeam] || (goalTeam !== 'unknown' ? goalTeam.charAt(0).toUpperCase() + goalTeam.slice(1) : 'Unknown');
            
            const goalInfo = {
                minute: secondsToMinutes(goalTimeSeconds),
                period: event.period || 'N/A',
                team: goalTeam,
                team_name: teamName,
                scorer_id: scorerId,
                assist_id: assistId,
                scorer_name: playerDict[scorerId] || 'Unknown',
                assist_name: assistId ? (playerDict[assistId] || '') : '',
                body_part: event.bodyPart || 1, // 1=pie, 4=cabeza
                position: event.startPosition || event.position || {}
            };
            goals.push(goalInfo);
        }
    }
    
    return goals;
}

/**
 * Obtiene estadísticas de goles por jugador de un equipo específico
 * @param {Array} players - Array de jugadores
 * @param {string} teamSide - Lado del equipo ('home' o 'away')
 * @returns {Object} Objeto con estadísticas de goles por jugador
 */
function getPlayerGoalsStats(players, teamSide) {
    if (!players || !Array.isArray(players)) {
        return {};
    }
    
    const playerGoals = {};
    
    for (const player of players) {
        let playerInfo, periods;
        
        if (player.info) {
            playerInfo = player.info;
            periods = player.matchPeriodData || [];
        } else {
            playerInfo = player;
            periods = player.periods || [];
        }
        
        const steamId = playerInfo.steamId || playerInfo.steamID || '';
        const name = playerInfo.name || 'Unknown';
        
        if (steamId === 'BOT' || !steamId) {
            continue;
        }
        
        let totalGoals = 0;
        let totalAssists = 0;
        
        // Sumar goles de todos los períodos
        for (const periodData of periods) {
            let periodInfo, stats;
            
            if (periodData.info) {
                periodInfo = periodData.info;
                stats = periodData.statistics || [];
            } else {
                periodInfo = periodData;
                stats = periodData.stats || [];
            }
            
            if (periodInfo.team === teamSide) {
                if (stats.length > 12) { // índice 12 = goles
                    totalGoals += stats[12];
                }
                if (stats.length > 14) { // índice 14 = asistencias
                    totalAssists += stats[14];
                }
            }
        }
        
        if (totalGoals > 0 || totalAssists > 0) {
            playerGoals[steamId] = {
                name: name,
                goals: totalGoals,
                assists: totalAssists
            };
        }
    }
    
    return playerGoals;
}

/**
 * Formatea la información de goles para mostrar en el embed
 * @param {Array} goalsDetail - Array de información de goles
 * @param {string} teamSide - Lado del equipo ('home' o 'away')
 * @returns {string} Texto formateado de goles
 */
function formatGoalsDisplay(goalsDetail, teamSide) {
    if (!goalsDetail || !Array.isArray(goalsDetail)) {
        return "Sin goles";
    }
    
    const teamGoals = goalsDetail.filter(goal => goal.team === teamSide);
    
    if (teamGoals.length === 0) {
        return "Sin goles";
    }
    
    let goalsText = "";
    for (const goal of teamGoals) {
        const scorer = goal.scorer_name;
        const minute = goal.minute;
        const assistText = goal.assist_name ? ` (${goal.assist_name})` : "";
        
        goalsText += `⚽ **${minute}'** ${scorer}${assistText}\n`;
    }
    
    return goalsText.trim();
}

/**
 * Obtiene los máximos goleadores del partido
 * @param {Array} goalsDetail - Array de información de goles
 * @param {number} limit - Número máximo de goleadores a devolver
 * @returns {Array} Array de [nombre, cantidad_goles] ordenado por cantidad
 */
function getTopScorers(goalsDetail, limit = 3) {
    if (!goalsDetail || !Array.isArray(goalsDetail)) {
        return [];
    }
    
    const scorerCount = {};
    
    for (const goal of goalsDetail) {
        const scorerName = goal.scorer_name;
        if (scorerName in scorerCount) {
            scorerCount[scorerName]++;
        } else {
            scorerCount[scorerName] = 1;
        }
    }
    
    // Ordenar por cantidad de goles
    const topScorers = Object.entries(scorerCount).sort((a, b) => b[1] - a[1]);
    
    return topScorers.slice(0, limit);
}

/**
 * Obtiene jugadores activos de una lineup
 * @param {Array} lineup - Array de jugadores en la alineación
 * @returns {Array} Array de jugadores activos
 */
function getActivePlayers(lineup) {
    if (!lineup || !Array.isArray(lineup)) {
        return [];
    }
    
    const activePlayers = [];
    for (const player of lineup) {
        if (player.steamId && player.name && player.steamId !== 'BOT') {
            activePlayers.push({
                position: player.position || 'N/A',
                name: player.name || 'Unknown'
            });
        }
    }
    return activePlayers;
}

/**
 * Parsea la información del partido desde el JSON REAL de IOSoccer
 * @param {Object} matchData - Datos del JSON del partido
 * @returns {Object|null} Información parseada del partido o null si falla
 */
function parseMatchInfo(matchData) {
    if (!matchData) {
        console.log("⚠️ parse_match_info: matchData es null o vacío");
        return null;
    }
    
    try {
        console.log(`🔍 Parseando JSON real de IOSoccer con ${Object.keys(matchData).length} campos`);
        
        // EXTRAER DATOS DIRECTAMENTE DEL JSON (estructura real de IOSoccer)
        const periodName = matchData.matchPeriod || 'N/A';
        const timeDisplay = matchData.matchDisplaySeconds || '0:00';
        const currentTimeSeconds = matchData.matchSeconds || 0;
        
        // NOMBRES REALES DE LOS EQUIPOS
        const teamHomeName = matchData.teamNameHome || 'Local';
        const teamAwayName = matchData.teamNameAway || 'Visitante';
        
        // GOLES REALES
        const goalsHome = matchData.matchGoalsHome || 0;
        const goalsAway = matchData.matchGoalsAway || 0;
        
        // INFORMACIÓN DEL SERVIDOR
        const activePlayersCount = matchData.serverPlayerCount || 0;
        const maxPlayersTotal = matchData.serverMaxPlayers || 16;
        const matchFormat = matchData.matchFormat || 6;
        const mapName = matchData.mapName || 'N/A';
        
        // EVENTOS DE GOLES
        const events = matchData.matchEvents || [];
        const goalsDetail = [];
        
        // Procesar eventos de goles existentes
        for (const event of events) {
            if (event.event === 'GOAL') {
                const goalTimeSeconds = event.second || 0;
                const minutes = Math.floor(goalTimeSeconds / 60);
                const seconds = Math.floor(goalTimeSeconds % 60);
                const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                const goalInfo = {
                    minute: timeStr,
                    team: event.team || 'unknown',
                    scorer_name: event.player1Name || 'Unknown',
                    assist_name: event.player2Name || '',
                    period: event.period || periodName,
                    is_real: true  // Marcar como gol con datos reales
                };
                goalsDetail.push(goalInfo);
            }
        }
        
        // Log para debugging - verificar cuántos goles hay en detalles vs marcador
        const detailedHomeGoals = goalsDetail.filter(g => g.team === 'home').length;
        const detailedAwayGoals = goalsDetail.filter(g => g.team === 'away').length;
        
        // CREAR GOLES GENÉRICOS PARA LOS FALTANTES
        if (detailedHomeGoals < goalsHome) {
            const missingHomeGoals = goalsHome - detailedHomeGoals;
            console.log(`⚠️ ADVERTENCIA: JSON truncado - Equipo local tiene ${goalsHome} goles pero solo ${detailedHomeGoals} eventos de gol. Creando ${missingHomeGoals} goles genéricos.`);
            
            for (let i = 0; i < missingHomeGoals; i++) {
                goalsDetail.push({
                    minute: "?:??",
                    team: "home",
                    scorer_name: "Jugador desconocido",
                    assist_name: "",
                    period: periodName,
                    is_real: false  // Marcar como gol genérico
                });
            }
        }
        
        if (detailedAwayGoals < goalsAway) {
            const missingAwayGoals = goalsAway - detailedAwayGoals;
            console.log(`⚠️ ADVERTENCIA: JSON truncado - Equipo visitante tiene ${goalsAway} goles pero solo ${detailedAwayGoals} eventos de gol. Creando ${missingAwayGoals} goles genéricos.`);
            
            for (let i = 0; i < missingAwayGoals; i++) {
                goalsDetail.push({
                    minute: "?:??",
                    team: "away",
                    scorer_name: "Jugador desconocido",
                    assist_name: "",
                    period: periodName,
                    is_real: false  // Marcar como gol genérico
                });
            }
        }
        
        console.log(`✅ Parseado exitoso: ${teamHomeName} ${goalsHome}-${goalsAway} ${teamAwayName} (${timeDisplay}, ${periodName})`);
        
        return {
            period: periodName,
            time_display: timeDisplay,
            time_seconds: currentTimeSeconds,
            map_name: mapName,
            format: `${matchFormat}v${matchFormat}`,
            match_type: 'IOSoccer Match',
            server_name: 'IOSoccer Server',
            
            // EQUIPOS CON NOMBRES REALES
            team_home: teamHomeName,
            team_away: teamAwayName,
            goals_home: goalsHome,
            goals_away: goalsAway,
            
            // JUGADORES
            players_count: activePlayersCount,
            max_players: maxPlayersTotal,
            
            // DETALLES
            goals_detail: goalsDetail,
            events: events,
            lineup_home: matchData.teamLineupHome || [],
            lineup_away: matchData.teamLineupAway || []
        };
        
    } catch (error) {
        console.error(`❌ Error parsing match info: ${error.message}`);
        return null;
    }
}

module.exports = {
    secondsToMinutes,
    countRealPlayers,
    extractTeamPlayersImproved,
    parseGoalsFromEventsImproved,
    getPlayerGoalsStats,
    formatGoalsDisplay,
    getTopScorers,
    getActivePlayers,
    parseMatchInfo
};

const logger = require('./logger');
const metrics = require('./metrics');

/**
 * Sistema avanzado de validación de datos para IOSoccer
 * Valida y normaliza datos de servidores y partidos antes de mostrarlos al usuario
 */
class DataValidator {
    
    /**
     * Valida información básica del servidor (A2S)
     * @param {Object} serverData - Datos del servidor
     * @param {Object} context - Contexto adicional (servidor config, etc.)
     * @returns {Object} Resultado de validación
     */
    static validateServerInfo(serverData, context = {}) {
        const startTime = Date.now();
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            normalized: null,
            confidence: 100
        };

        try {
            if (!serverData || typeof serverData !== 'object') {
                validation.isValid = false;
                validation.errors.push('Server data is null or not an object');
                validation.confidence = 0;
                return validation;
            }

            // Validar campos esenciales
            const required = ['server_name', 'map_name', 'players', 'max_players'];
            const missing = required.filter(field => serverData[field] === undefined);
            
            if (missing.length > 0) {
                validation.errors.push(`Missing required fields: ${missing.join(', ')}`);
                validation.confidence -= missing.length * 25;
            }

            // Normalizar datos
            const normalized = {
                server_name: this.normalizeServerName(serverData.server_name, context),
                map_name: this.normalizeMapName(serverData.map_name),
                players: this.normalizePlayerCount(serverData.players),
                max_players: this.normalizeMaxPlayers(serverData.max_players),
                timestamp: Date.now()
            };

            // Validaciones específicas
            if (normalized.players < 0) {
                validation.warnings.push('Player count is negative, normalized to 0');
                normalized.players = 0;
                validation.confidence -= 5;
            }

            if (normalized.players > normalized.max_players) {
                validation.warnings.push(`Player count (${normalized.players}) exceeds max (${normalized.max_players})`);
                validation.confidence -= 10;
            }

            if (normalized.max_players > 50) {
                validation.warnings.push(`Unusually high max players: ${normalized.max_players}`);
                validation.confidence -= 5;
            }

            // Validar nombre del servidor
            if (!normalized.server_name || normalized.server_name.trim().length === 0) {
                validation.warnings.push('Server name is empty or invalid');
                normalized.server_name = context.fallbackName || 'Unknown Server';
                validation.confidence -= 15;
            }

            // Validar mapa
            if (!normalized.map_name || normalized.map_name.trim().length === 0) {
                validation.warnings.push('Map name is empty');
                normalized.map_name = 'Unknown Map';
                validation.confidence -= 10;
            }

            validation.normalized = normalized;
            validation.isValid = validation.errors.length === 0;

            const duration = Date.now() - startTime;
            metrics.recordHistogram('data_validation_duration', duration, { type: 'server_info' });
            
            if (validation.isValid) {
                metrics.incrementCounter('validation_success', { type: 'server_info' });
            } else {
                metrics.incrementCounter('validation_error', { type: 'server_info' });
            }

            logger.debug(`Server info validation completed: ${validation.isValid ? 'VALID' : 'INVALID'} (confidence: ${validation.confidence}%)`, {
                errors: validation.errors.length,
                warnings: validation.warnings.length,
                duration: duration
            });

            return validation;

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation exception: ${error.message}`);
            validation.confidence = 0;
            
            logger.error('Server info validation exception', error);
            metrics.incrementCounter('validation_exception', { type: 'server_info' });
            
            return validation;
        }
    }

    /**
     * Valida información completa del partido (RCON JSON)
     * @param {Object} matchData - Datos del partido
     * @param {Object} context - Contexto adicional
     * @returns {Object} Resultado de validación
     */
    static validateMatchInfo(matchData, context = {}) {
        const startTime = Date.now();
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            normalized: null,
            confidence: 100,
            dataCompleteness: 0
        };

        try {
            if (!matchData || typeof matchData !== 'object') {
                validation.isValid = false;
                validation.errors.push('Match data is null or not an object');
                validation.confidence = 0;
                return validation;
            }

            // Campos esenciales para IOSoccer
            const essentialFields = ['matchPeriod', 'teamNameHome', 'teamNameAway'];
            const missingEssential = essentialFields.filter(field => 
                !matchData[field] || matchData[field].toString().trim().length === 0
            );

            if (missingEssential.length > 0) {
                validation.errors.push(`Missing essential match fields: ${missingEssential.join(', ')}`);
                validation.confidence -= missingEssential.length * 33;
            }

            // Campos importantes (no esenciales pero deseables)
            const importantFields = ['goalsHome', 'goalsAway', 'matchTime', 'matchEvents'];
            const missingImportant = importantFields.filter(field => 
                matchData[field] === undefined || matchData[field] === null
            );

            if (missingImportant.length > 0) {
                validation.warnings.push(`Missing important fields: ${missingImportant.join(', ')}`);
                validation.confidence -= missingImportant.length * 5;
            }

            // Calcular completitud de datos
            const allPossibleFields = [
                'matchPeriod', 'teamNameHome', 'teamNameAway', 'goalsHome', 'goalsAway',
                'matchTime', 'matchEvents', 'playersHome', 'playersAway', 'matchStatus'
            ];
            
            const presentFields = allPossibleFields.filter(field => 
                matchData[field] !== undefined && matchData[field] !== null
            );
            
            validation.dataCompleteness = Math.round((presentFields.length / allPossibleFields.length) * 100);

            // Normalizar datos
            const normalized = {
                matchPeriod: this.normalizeMatchPeriod(matchData.matchPeriod),
                teamNameHome: this.normalizeTeamName(matchData.teamNameHome),
                teamNameAway: this.normalizeTeamName(matchData.teamNameAway),
                goalsHome: this.normalizeGoals(matchData.goalsHome),
                goalsAway: this.normalizeGoals(matchData.goalsAway),
                matchTime: this.normalizeMatchTime(matchData.matchTime),
                matchEvents: this.normalizeMatchEvents(matchData.matchEvents),
                playersHome: this.normalizePlayers(matchData.playersHome),
                playersAway: this.normalizePlayers(matchData.playersAway),
                matchStatus: this.normalizeMatchStatus(matchData.matchStatus, matchData.matchPeriod),
                timestamp: Date.now(),
                wasRepaired: context.wasRepaired || false
            };

            // Validaciones específicas de IOSoccer
            this.validateIOSoccerSpecific(normalized, validation);

            // Validar coherencia de datos
            this.validateMatchDataCoherence(normalized, validation);

            validation.normalized = normalized;
            validation.isValid = validation.errors.length === 0;

            const duration = Date.now() - startTime;
            metrics.recordHistogram('data_validation_duration', duration, { type: 'match_info' });
            metrics.recordGauge('match_data_completeness', validation.dataCompleteness);
            
            if (validation.isValid) {
                metrics.incrementCounter('validation_success', { type: 'match_info' });
            } else {
                metrics.incrementCounter('validation_error', { type: 'match_info' });
            }

            logger.debug(`Match info validation completed: ${validation.isValid ? 'VALID' : 'INVALID'} (confidence: ${validation.confidence}%, completeness: ${validation.dataCompleteness}%)`, {
                errors: validation.errors.length,
                warnings: validation.warnings.length,
                duration: duration,
                wasRepaired: context.wasRepaired
            });

            return validation;

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Match validation exception: ${error.message}`);
            validation.confidence = 0;
            
            logger.error('Match info validation exception', error);
            metrics.incrementCounter('validation_exception', { type: 'match_info' });
            
            return validation;
        }
    }

    /**
     * Validaciones específicas de IOSoccer
     * @param {Object} normalized - Datos normalizados
     * @param {Object} validation - Objeto de validación a modificar
     */
    static validateIOSoccerSpecific(normalized, validation) {
        // Validar períodos de IOSoccer
        const validPeriods = ['PreMatch', 'FirstHalf', 'HalfTime', 'SecondHalf', 'ExtraTime1', 'ExtraTime2', 'PenaltyShootout', 'PostMatch'];
        if (normalized.matchPeriod && !validPeriods.includes(normalized.matchPeriod)) {
            validation.warnings.push(`Unknown match period: ${normalized.matchPeriod}`);
            validation.confidence -= 5;
        }

        // Validar nombres de equipos (no pueden ser iguales)
        if (normalized.teamNameHome && normalized.teamNameAway && 
            normalized.teamNameHome.toLowerCase() === normalized.teamNameAway.toLowerCase()) {
            validation.warnings.push('Team names are identical');
            validation.confidence -= 10;
        }

        // Validar goles (no pueden ser negativos)
        if (normalized.goalsHome < 0 || normalized.goalsAway < 0) {
            validation.warnings.push('Negative goals detected, normalized to 0');
            validation.confidence -= 5;
        }

        // Validar eventos de partido
        if (normalized.matchEvents && Array.isArray(normalized.matchEvents)) {
            const eventValidation = this.validateMatchEvents(normalized.matchEvents);
            if (eventValidation.warnings.length > 0) {
                validation.warnings.push(...eventValidation.warnings);
                validation.confidence -= eventValidation.warnings.length * 2;
            }
        }
    }

    /**
     * Validar coherencia entre diferentes datos del partido
     * @param {Object} normalized - Datos normalizados
     * @param {Object} validation - Objeto de validación a modificar
     */
    static validateMatchDataCoherence(normalized, validation) {
        // Coherencia entre goles y eventos
        if (normalized.matchEvents && Array.isArray(normalized.matchEvents)) {
            const goalEvents = normalized.matchEvents.filter(event => 
                event.eventType === 'Goal' || event.eventType === 'goal'
            );
            
            const homeGoalsInEvents = goalEvents.filter(goal => 
                goal.teamSide === 'Home' || goal.teamSide === 'home'
            ).length;
            
            const awayGoalsInEvents = goalEvents.filter(goal => 
                goal.teamSide === 'Away' || goal.teamSide === 'away'
            ).length;

            if (homeGoalsInEvents !== normalized.goalsHome) {
                validation.warnings.push(`Goals mismatch - Home: reported ${normalized.goalsHome}, events ${homeGoalsInEvents}`);
                validation.confidence -= 5;
            }

            if (awayGoalsInEvents !== normalized.goalsAway) {
                validation.warnings.push(`Goals mismatch - Away: reported ${normalized.goalsAway}, events ${awayGoalsInEvents}`);
                validation.confidence -= 5;
            }
        }

        // Coherencia de tiempo de partido
        if (normalized.matchTime && normalized.matchPeriod) {
            if (normalized.matchPeriod === 'PreMatch' && normalized.matchTime > 0) {
                validation.warnings.push('Match time > 0 but period is PreMatch');
                validation.confidence -= 3;
            }

            if (normalized.matchPeriod === 'FirstHalf' && normalized.matchTime > 2700) { // 45 min
                validation.warnings.push('First half time exceeds expected duration');
                validation.confidence -= 3;
            }
        }
    }

    /**
     * Valida eventos del partido
     * @param {Array} events - Lista de eventos
     * @returns {Object} Resultado de validación
     */
    static validateMatchEvents(events) {
        const validation = { warnings: [], validEvents: 0 };

        if (!Array.isArray(events)) {
            validation.warnings.push('Match events is not an array');
            return validation;
        }

        events.forEach((event, index) => {
            if (!event || typeof event !== 'object') {
                validation.warnings.push(`Event ${index} is not an object`);
                return;
            }

            // Validar campos esenciales del evento
            const requiredEventFields = ['eventType', 'teamSide'];
            const missingFields = requiredEventFields.filter(field => !event[field]);
            
            if (missingFields.length === 0) {
                validation.validEvents++;
            } else {
                validation.warnings.push(`Event ${index} missing fields: ${missingFields.join(', ')}`);
            }

            // Validar tipos de eventos conocidos
            const knownEventTypes = ['Goal', 'Card', 'Substitution', 'Kick', 'Save'];
            if (event.eventType && !knownEventTypes.includes(event.eventType)) {
                validation.warnings.push(`Unknown event type: ${event.eventType}`);
            }
        });

        return validation;
    }

    // =================== MÉTODOS DE NORMALIZACIÓN ===================

    static normalizeServerName(name, context = {}) {
        if (!name || typeof name !== 'string') {
            return context.fallbackName || 'Unknown Server';
        }
        
        // Limpiar caracteres especiales y espacios extra
        return name.trim().replace(/\s+/g, ' ').substring(0, 100);
    }

    static normalizeMapName(map) {
        if (!map || typeof map !== 'string') return 'Unknown Map';
        return map.trim().replace(/\s+/g, ' ').substring(0, 50);
    }

    static normalizePlayerCount(count) {
        const num = parseInt(count, 10);
        return isNaN(num) ? 0 : Math.max(0, Math.min(num, 255)); // Max 255 players
    }

    static normalizeMaxPlayers(count) {
        const num = parseInt(count, 10);
        return isNaN(num) ? 20 : Math.max(1, Math.min(num, 255)); // Default 20, max 255
    }

    static normalizeMatchPeriod(period) {
        if (!period) return 'Unknown';
        return period.toString().trim();
    }

    static normalizeTeamName(name) {
        if (!name || typeof name !== 'string') return 'Unknown Team';
        return name.trim().replace(/\s+/g, ' ').substring(0, 50);
    }

    static normalizeGoals(goals) {
        const num = parseInt(goals, 10);
        return isNaN(num) ? 0 : Math.max(0, num);
    }

    static normalizeMatchTime(time) {
        if (time === null || time === undefined) return 0;
        const num = parseFloat(time);
        return isNaN(num) ? 0 : Math.max(0, num);
    }

    static normalizeMatchEvents(events) {
        if (!Array.isArray(events)) return [];
        
        return events.filter(event => event && typeof event === 'object').map(event => ({
            eventType: event.eventType || 'Unknown',
            teamSide: event.teamSide || 'Unknown',
            playerName: event.playerName || 'Unknown Player',
            matchTime: this.normalizeMatchTime(event.matchTime),
            additionalInfo: event.additionalInfo || null
        }));
    }

    static normalizePlayers(players) {
        if (!Array.isArray(players)) return [];
        
        return players.filter(player => player && typeof player === 'object').map(player => ({
            name: player.name || 'Unknown Player',
            id: player.id || null,
            position: player.position || 'Unknown',
            teamSide: player.teamSide || 'Unknown'
        }));
    }

    static normalizeMatchStatus(status, period) {
        if (status) return status.toString().trim();
        
        // Inferir estado basado en el período
        if (period === 'PreMatch') return 'Not Started';
        if (period === 'PostMatch') return 'Finished';
        if (period === 'HalfTime') return 'Half Time';
        return 'In Progress';
    }

    /**
     * Valida datos de fallback para asegurar que son utilizables
     * @param {Object} fallbackData - Datos de fallback
     * @param {string} type - Tipo de datos ('server' o 'match')
     * @returns {Object} Resultado de validación
     */
    static validateFallbackData(fallbackData, type) {
        const validation = {
            isUsable: false,
            confidence: 0,
            warnings: []
        };

        if (!fallbackData) {
            validation.warnings.push('Fallback data is null');
            return validation;
        }

        if (type === 'server') {
            if (fallbackData.server_name && fallbackData.server_name.trim().length > 0) {
                validation.isUsable = true;
                validation.confidence = 60; // Datos mínimos pero utilizables
            }
        } else if (type === 'match') {
            if (fallbackData.teamNameHome && fallbackData.teamNameAway) {
                validation.isUsable = true;
                validation.confidence = 40; // Datos muy básicos
            }
        }

        return validation;
    }

    /**
     * Crea un reporte de calidad de datos
     * @param {Object} validationResult - Resultado de validación
     * @returns {Object} Reporte de calidad
     */
    static createQualityReport(validationResult) {
        let quality = 'UNKNOWN';
        
        if (validationResult.confidence >= 90) quality = 'EXCELLENT';
        else if (validationResult.confidence >= 75) quality = 'GOOD';
        else if (validationResult.confidence >= 50) quality = 'FAIR';
        else if (validationResult.confidence >= 25) quality = 'POOR';
        else quality = 'VERY_POOR';

        return {
            quality,
            confidence: validationResult.confidence,
            isReliable: validationResult.confidence >= 70,
            shouldDisplay: validationResult.isValid && validationResult.confidence >= 30,
            completeness: validationResult.dataCompleteness || null,
            summary: `${quality} quality (${validationResult.confidence}% confidence)`,
            issues: {
                errors: validationResult.errors.length,
                warnings: validationResult.warnings.length,
                total: validationResult.errors.length + validationResult.warnings.length
            }
        };
    }

    /**
     * Obtiene estadísticas de validación
     * @returns {Object} Estadísticas completas
     */
    static getValidationStats() {
        return {
            metrics: metrics.getMetrics(),
            counters: {
                server_validations: metrics.getCounter('validation_success', { type: 'server_info' }) + 
                                   metrics.getCounter('validation_error', { type: 'server_info' }),
                match_validations: metrics.getCounter('validation_success', { type: 'match_info' }) + 
                                  metrics.getCounter('validation_error', { type: 'match_info' }),
                exceptions: metrics.getCounter('validation_exception')
            }
        };
    }
}

module.exports = DataValidator;

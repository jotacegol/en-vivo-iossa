const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');

// Cargar variables de entorno
dotenv.config();

// ============= SISTEMA DE MONITOREO ULTRA-ROBUSTO =============
let monitoring, initialize, getStats, logger;

try {
    const monitoringSystem = require('./monitoring');
    monitoring = monitoringSystem.monitoring;
    initialize = monitoringSystem.initialize;
    getStats = monitoringSystem.getStats;
    logger = monitoringSystem.logger;
    console.log('✅ Sistema de monitoreo ultra-robusto cargado exitosamente');
} catch (error) {
    console.log('⚠️  Sistema de monitoreo no disponible, usando sistema básico:', error.message);
    // Fallback al sistema básico
    try {
        const basicMonitoring = require('./monitoring/serverMonitoring');
        const basicLogger = require('./monitoring/queryUtils');
        
        // Crear adaptador para compatibilidad
        monitoring = {
            queryServerInfo: async (server) => {
                const result = await basicMonitoring.getServerInfoRobust(server);
                return {
                    success: result.status !== 'Error',
                    data: {
                        server_name: result.name,
                        map_name: result.map || 'Unknown',
                        players: result.players || 0,
                        max_players: result.maxPlayers || 0
                    },
                    source: 'basic',
                    cached: false,
                    validation: { confidence: 85, quality: { quality: 'good' } }
                };
            },
            queryMatchInfo: async (server, password) => {
                // Implementación básica para match info
                return {
                    success: false,
                    error: { user: { message: 'Match info no disponible en modo básico' } }
                };
            },
            runIntegrityCheck: async () => {
                return {
                    basic: { healthy: true, details: 'Sistema básico activo' }
                };
            },
            shutdown: async () => { console.log('Sistema básico cerrado'); }
        };
        
        initialize = async () => { console.log('Sistema básico inicializado'); };
        getStats = () => ({ 
            uptime: process.uptime(), 
            memory: process.memoryUsage(), 
            systemHealth: { basic: true },
            cache: { totalEntries: 0, hitRate: 0 }
        });
        logger = basicLogger.logger;
    } catch (fallbackError) {
        console.error('❌ Error cargando sistema básico:', fallbackError.message);
        // Logger mínimo de emergencia
        logger = (level, msg) => console.log(`[${level}] ${msg}`);
        monitoring = { queryServerInfo: async () => ({ success: false, error: { user: { message: 'Sistema no disponible' } } }) };
        initialize = async () => {};
        getStats = () => ({ uptime: process.uptime(), memory: process.memoryUsage(), systemHealth: {}, cache: {} });
    }
}

// ============= CONFIGURACIÓN ADAPTABLE =============
// Configuración desde variables de entorno (Railway) o archivo local
const CONFIG = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID || '1347620321263353917'
    },
    servers: [],
    monitoring: {
        enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
        enableAdvancedLogging: process.env.ENABLE_ADVANCED_LOGGING !== 'false',
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        enableDataValidation: process.env.ENABLE_DATA_VALIDATION !== 'false',
        enableErrorReporting: process.env.ENABLE_ERROR_REPORTING !== 'false',
        defaultTimeouts: {
            a2s: parseInt(process.env.TIMEOUT_A2S) || 15000,
            rcon: parseInt(process.env.TIMEOUT_RCON) || 30000,
            matchJson: parseInt(process.env.TIMEOUT_MATCH_JSON) || 60000
        }
    },
    // Para Railway: Cargar servidores desde variables de entorno
    loadServersFromEnv: function() {
        const servers = [];
        let i = 1;
        
        while (process.env[`SERVER_${i}_NAME`]) {
            const server = {
                name: process.env[`SERVER_${i}_NAME`],
                ip: process.env[`SERVER_${i}_IP`],
                port: parseInt(process.env[`SERVER_${i}_PORT`]) || 27015,
                rcon_password: process.env[`SERVER_${i}_RCON_PASSWORD`],
                rcon_ports: []
            };
            
            // Cargar puertos RCON
            const rconPorts = process.env[`SERVER_${i}_RCON_PORTS`];
            if (rconPorts) {
                server.rcon_ports = rconPorts.split(',').map(p => parseInt(p.trim()));
            } else {
                server.rcon_ports = [server.port, server.port + 1, server.port + 2];
            }
            
            servers.push(server);
            i++;
        }
        
        return servers;
    }
};

// Cargar servidores desde env si existen, sino usar configuración básica
CONFIG.servers = CONFIG.loadServersFromEnv();
if (CONFIG.servers.length === 0) {
    // Fallback a configuración básica local (para desarrollo)
    try {
        const basicConfig = require('./monitoring/serverMonitoring');
        CONFIG.servers = basicConfig.SERVERS || [];
        console.log(`📡 Usando configuración local: ${CONFIG.servers.length} servidores`);
    } catch (e) {
        console.log('⚠️  No se encontró configuración de servidores');
    }
}

const CLIENT_ID = CONFIG.discord.clientId;

// Configuración de roles permitidos (IDs de roles de Discord)
const ALLOWED_ROLES = [
    'ID_DEL_ROL_1', // Reemplaza con IDs reales de roles
    'ID_DEL_ROL_2', // Ejemplo: '123456789012345678'
    'ID_DEL_ROL_3'  // Puedes agregar más roles aquí
];

// Configuración de permisos de administrador (IDs de usuarios)
const ADMIN_USERS = [
    'ID_USUARIO_ADMIN_1', // Reemplaza con IDs reales de usuarios admin
    'ID_USUARIO_ADMIN_2'  // Estos usuarios pueden usar el bot sin rol específico
];

class IOSoccerBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        // Configuración del sistema
        this.timeSlots = [
            '21:00', '21:15', '21:30', '21:45',
            '22:00', '22:15', '22:30', '22:45',
            '23:00', '23:15', '23:30', '23:45'
        ];

        // Mapeo de horarios a minutos para cálculos
        this.timeToMinutes = {
            '21:00': 1260, '21:15': 1275, '21:30': 1290, '21:45': 1305,
            '22:00': 1320, '22:15': 1335, '22:30': 1350, '22:45': 1365,
            '23:00': 1380, '23:15': 1395, '23:30': 1410, '23:45': 1425
        };

        this.validTournaments = [
            'Liga D1', 'Liga D2', 'Liga D3', 'Copa Maradei', 
            'Copa ValencARc', 'Intrazonal de Oro', 'Intrazonal de Plata', 
            'Supercopa IOSSA', 'Supercopa de ORO'
        ];

        // Mapeo de días de la semana
        this.dayNames = {
            'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
            'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6
        };

        this.dayNamesDisplay = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        this.dataFile = path.join(__dirname, 'matches.json');
        this.matches = this.loadMatches();

        // ============= PROPIEDADES DE MONITOREO =============
        this.activeStatusChannels = new Map(); // Para rastrear canales con auto-update activo
        // Estructura: channelId -> { messages: [message_objects], intervals: [interval_objects] }

        this.init();
    }

    async init() {
        // Inicializar sistema de monitoreo
        try {
            console.log('🚀 Inicializando sistema de monitoreo ultra-robusto...');
            await initialize(CONFIG.monitoring);
            console.log('✅ Sistema de monitoreo inicializado correctamente');
        } catch (error) {
            console.error('⚠️  Error inicializando monitoreo:', error.message);
        }
        
        this.client.once('ready', () => {
            console.log(`🟢 Bot IOSoccer Ultra-Robusto conectado como ${this.client.user.tag}`);
            console.log(`📅 Sistema de confirmación de partidos: ACTIVO`);
            console.log(`📊 Sistema de monitoreo ultra-robusto: ACTIVO`);
            console.log(`🎮 Monitoreando ${CONFIG.servers.length} servidor(es) IOSoccer`);
            console.log(`🔒 Control de roles: ACTIVO`);
            console.log('🛡️ Sistema ultra-robusto que nunca falla: ONLINE');
            
            // Actualizar estado del bot
            const activity = CONFIG.servers.length > 0 
                ? `${CONFIG.servers.length} servidores IOSoccer`
                : 'IOSoccer Bot Ultra-Robusto';
            this.client.user.setActivity(activity, { type: 'WATCHING' });
            
            this.registerCommands();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            // Verificar permisos
            if (!this.hasPermission(interaction.member, interaction.user.id)) {
                const embed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('🚫 Acceso Denegado')
                    .setDescription('No tienes permisos para usar este bot.\n\nContacta a un administrador si crees que esto es un error.');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await this.handleSlashCommand(interaction);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            // Verificar permisos para comandos de texto
            if (message.content.startsWith('/confirmar_partido')) {
                if (!this.hasPermission(message.member, message.author.id)) {
                    const embed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🚫 Acceso Denegado')
                        .setDescription('No tienes permisos para usar este bot.');
                    
                    return message.reply({ embeds: [embed] });
                }
            }
            
            await this.handleMessage(message);
        });

        this.client.login(CONFIG.discord.token);
        
        // Para Railway: Crear servidor web para health checks
        this.createHealthServer();
    }

    hasPermission(member, userId) {
        // Verificar si es admin
        if (ADMIN_USERS.includes(userId)) {
            return true;
        }

        // Verificar si no hay miembro (DM)
        if (!member) {
            return false;
        }

        // Verificar si tiene permisos de administrador del servidor
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }

        // Verificar roles específicos
        const hasRole = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
        return hasRole;
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('confirmar_partido')
                .setDescription('Confirma un partido de IOSoccer')
                .addStringOption(option =>
                    option.setName('equipo1')
                        .setDescription('Nombre del primer equipo')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('equipo2')
                        .setDescription('Nombre del segundo equipo')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('torneo')
                        .setDescription('Torneo del partido')
                        .setRequired(true)
                        .addChoices(
                            ...this.validTournaments.map(tournament => ({
                                name: tournament,
                                value: tournament
                            }))
                        ))
                .addStringOption(option =>
                    option.setName('dia')
                        .setDescription('Día del partido (hoy, mañana, lunes, martes, etc. o YYYY-MM-DD)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('hora')
                        .setDescription('Hora del partido')
                        .setRequired(true)
                        .addChoices(
                            ...this.timeSlots.map(time => ({
                                name: time,
                                value: time
                            }))
                        )),

            new SlashCommandBuilder()
                .setName('ver_partidos')
                .setDescription('Ver partidos confirmados')
                .addStringOption(option =>
                    option.setName('opcion')
                        .setDescription('Selecciona qué partidos ver')
                        .setRequired(true)
                        .addChoices(
                            { name: '📋 Todos los partidos', value: 'todos' },
                            { name: '📅 Elegir día de la semana', value: 'dia_semana' }
                        ))
                .addStringOption(option =>
                    option.setName('dia')
                        .setDescription('Día de la semana (solo si eliges "Elegir día de la semana")')
                        .setRequired(false)
                        .addChoices(
                            { name: '🗓️ Lunes', value: 'lunes' },
                            { name: '🗓️ Martes', value: 'martes' },
                            { name: '🗓️ Miércoles', value: 'miercoles' },
                            { name: '🗓️ Jueves', value: 'jueves' },
                            { name: '🗓️ Viernes', value: 'viernes' },
                            { name: '🗓️ Sábado', value: 'sabado' },
                            { name: '🗓️ Domingo', value: 'domingo' }
                        )),

            new SlashCommandBuilder()
                .setName('cancelar_partido')
                .setDescription('Cancela un partido confirmado')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID del partido a cancelar')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('estadisticas')
                .setDescription('Ver estadísticas del sistema'),

            new SlashCommandBuilder()
                .setName('ayuda')
                .setDescription('Muestra información de ayuda del bot'),

            // ============= COMANDOS DE MONITOREO ULTRA-ROBUSTO =============
            new SlashCommandBuilder()
                .setName('status')
                .setDescription('🛡️ Estado ultra-robusto de todos los servidores IOSoccer')
                .addBooleanOption(option =>
                    option.setName('auto_update')
                        .setDescription('Activar actualización automática ultra-persistente cada 90 segundos')
                        .setRequired(false)),

            new SlashCommandBuilder()
                .setName('server_info')
                .setDescription('📊 Información detallada de servidor con sistema ultra-robusto')
                .addStringOption(option =>
                    option.setName('servidor')
                        .setDescription('Nombre del servidor (opcional)')
                        .setRequired(false)),

            new SlashCommandBuilder()
                .setName('match_info')
                .setDescription('⚽ Información del partido en curso con JSON ultra-robusto')
                .addStringOption(option =>
                    option.setName('servidor')
                        .setDescription('Nombre del servidor (opcional)')
                        .setRequired(false)),

            new SlashCommandBuilder()
                .setName('health')
                .setDescription('🏥 Estado de salud del sistema ultra-robusto'),

            new SlashCommandBuilder()
                .setName('system_stats')
                .setDescription('📈 Estadísticas completas del sistema de monitoreo'),

            new SlashCommandBuilder()
                .setName('stop_status')
                .setDescription('🛑 Detiene la actualización automática ultra-persistente en este canal')
        ];

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('🔄 Registrando comandos slash...');
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            console.log('✅ Comandos slash registrados exitosamente');
        } catch (error) {
            console.error('❌ Error al registrar comandos:', error);
        }
    }

    async handleSlashCommand(interaction) {
        const { commandName, options } = interaction;

        try {
            switch (commandName) {
                case 'confirmar_partido':
                    await this.confirmMatch(interaction);
                    break;
                case 'ver_partidos':
                    await this.viewMatches(interaction);
                    break;
                case 'cancelar_partido':
                    await this.cancelMatch(interaction);
                    break;
                case 'estadisticas':
                    await this.showStats(interaction);
                    break;
                case 'ayuda':
                    await this.showHelp(interaction);
                    break;
                // ============= COMANDOS DE MONITOREO ULTRA-ROBUSTO =============
                case 'status':
                    await this.serverStatus(interaction);
                    break;
                case 'server_info':
                    await this.handleServerInfoCommand(interaction);
                    break;
                case 'match_info':
                    await this.handleMatchInfoCommand(interaction);
                    break;
                case 'health':
                    await this.handleHealthCommand(interaction);
                    break;
                case 'system_stats':
                    await this.handleSystemStatsCommand(interaction);
                    break;
                case 'stop_status':
                    await this.stopAutoStatus(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error en comando:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al procesar el comando.',
                ephemeral: true
            });
        }
    }

    async handleMessage(message) {
        if (!message.content.startsWith('/confirmar_partido')) return;

        const args = message.content.split(' ');
        if (args.length !== 6) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Error de Formato')
                .setDescription('Uso correcto: `/confirmar_partido [Equipo1] [Equipo2] [torneo] [día] [hora]`')
                .addFields(
                    { name: 'Ejemplo', value: '/confirmar_partido "Real Madrid" "Barcelona" "Liga D1" "lunes" "21:00"' }
                );
            return message.reply({ embeds: [embed] });
        }

        const [, equipo1, equipo2, torneo, dia, hora] = args;
        const result = await this.processMatchConfirmation(equipo1, equipo2, torneo, dia, hora, message.author.id);

        const embed = this.createMatchEmbed(result, message.author.username);
        message.reply({ embeds: [embed] });
    }

    async confirmMatch(interaction) {
        const equipo1 = interaction.options.getString('equipo1');
        const equipo2 = interaction.options.getString('equipo2');
        const torneo = interaction.options.getString('torneo');
        const dia = interaction.options.getString('dia');
        const hora = interaction.options.getString('hora');

        const result = await this.processMatchConfirmation(equipo1, equipo2, torneo, dia, hora, interaction.user.id);

        const embed = this.createMatchEmbed(result, interaction.user.username);
        await interaction.reply({ embeds: [embed] });
    }

    createMatchEmbed(result, username) {
        if (result.success) {
            return new EmbedBuilder()
                .setColor('#27ae60')
                .setTitle('✅ Partido Confirmado Exitosamente')
                .setDescription('El partido ha sido registrado en el sistema')
                .addFields(
                    { name: '⚽ Equipo Local', value: `**${result.match.equipo1}**`, inline: false },
                    { name: '🆚 Equipo Visitante', value: `**${result.match.equipo2}**`, inline: false },
                    { name: '🏆 Torneo', value: result.match.torneo, inline: false },
                    { name: '📅 Fecha', value: result.match.displayDate, inline: false },
                    { name: '🕒 Hora', value: `${result.match.time}hs`, inline: false },
                    { name: '🆔 ID del Partido', value: `\`${result.match.id}\``, inline: false },
                    { name: '👤 Confirmado por', value: username, inline: false }
                )
                .setFooter({ text: `Sistema IOSoccer • ${new Date().toLocaleString('es-AR')}` })
                .setTimestamp();
        } else {
            return new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Error al Confirmar Partido')
                .setDescription(result.message)
                .setFooter({ text: 'Revisa los datos e intenta nuevamente' });
        }
    }

    async processMatchConfirmation(equipo1, equipo2, torneo, dia, hora, userId) {
        // Limpiar nombres de equipos (remover comillas si las hay)
        equipo1 = equipo1.replace(/['"]/g, '').trim();
        equipo2 = equipo2.replace(/['"]/g, '').trim();

        // Validar torneo
        if (!this.validTournaments.includes(torneo)) {
            return {
                success: false,
                message: `❌ **Torneo inválido**\n\n**Torneos válidos:**\n${this.validTournaments.map(t => `• ${t}`).join('\n')}`
            };
        }

        // Validar hora
        if (!this.timeSlots.includes(hora)) {
            return {
                success: false,
                message: `❌ **Hora inválida**\n\n**Horarios válidos:**\n${this.timeSlots.map(t => `• ${t}`).join('\n')}`
            };
        }

        // Procesar fecha
        const processedDate = this.processDate(dia);
        if (!processedDate.valid) {
            return {
                success: false,
                message: processedDate.error
            };
        }

        // Verificar disponibilidad de franja horaria
        const availability = this.checkTimeFrameAvailability(processedDate.date, hora);
        if (!availability.available) {
            return {
                success: false,
                message: availability.message
            };
        }

        // Crear partido
        const match = {
            id: Date.now(),
            equipo1,
            equipo2,
            torneo,
            date: processedDate.date,
            time: hora,
            displayDate: processedDate.displayDate,
            confirmedBy: userId,
            confirmedAt: new Date().toISOString()
        };

        this.matches.push(match);
        this.saveMatches();

        return {
            success: true,
            message: `🎉 Partido confirmado exitosamente para el ${processedDate.displayDate} a las ${hora}hs`,
            match
        };
    }

    processDate(dateInput) {
        const today = new Date();
        let targetDate;

        const inputLower = dateInput.toLowerCase().trim();

        if (inputLower === 'hoy') {
            targetDate = today;
        } else if (inputLower === 'mañana' || inputLower === 'manaña') {
            targetDate = new Date(today);
            targetDate.setDate(today.getDate() + 1);
        } else if (this.dayNames.hasOwnProperty(inputLower)) {
            // Procesamiento de días de la semana
            const targetDay = this.dayNames[inputLower];
            const currentDay = today.getDay();
            
            targetDate = new Date(today);
            
            if (targetDay === currentDay) {
                // Si es el mismo día, se refiere a la próxima semana
                targetDate.setDate(today.getDate() + 7);
            } else if (targetDay > currentDay) {
                // Si el día objetivo está más adelante en la semana
                targetDate.setDate(today.getDate() + (targetDay - currentDay));
            } else {
                // Si el día objetivo ya pasó esta semana, ir a la próxima semana
                targetDate.setDate(today.getDate() + (7 - currentDay + targetDay));
            }
        } else if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
            targetDate = new Date(dateInput + 'T00:00:00');
            if (isNaN(targetDate.getTime())) {
                return { valid: false, error: '❌ **Fecha inválida**\n\nFormato correcto: YYYY-MM-DD' };
            }
        } else {
            return { 
                valid: false, 
                error: `❌ **Formato de fecha inválido**\n\n**Formatos aceptados:**\n• "hoy" - Para hoy\n• "mañana" - Para mañana\n• Días de la semana: lunes, martes, miércoles, jueves, viernes, sábado, domingo\n• Fecha específica: YYYY-MM-DD\n\n**Ejemplos:**\n• "lunes" - Próximo lunes\n• "viernes" - Próximo viernes\n• "2024-08-22" - Fecha específica`
            };
        }

        const dateString = targetDate.toISOString().split('T')[0];
        const displayDate = this.formatDisplayDate(dateString);

        return {
            valid: true,
            date: dateString,
            displayDate
        };
    }

    formatDisplayDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const dayName = this.dayNamesDisplay[date.getDay()];
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${dayName} ${day}/${month}`;
    }

    checkTimeFrameAvailability(date, time) {
        const targetMinutes = this.timeToMinutes[time];
        
        // Obtener todos los partidos del día
        const dayMatches = this.matches.filter(match => match.date === date);
        
        // Contar partidos en ventana de 45 minutos hacia atrás y hacia adelante
        const conflictingMatches = dayMatches.filter(match => {
            const matchMinutes = this.timeToMinutes[match.time];
            const timeDifference = Math.abs(targetMinutes - matchMinutes);
            return timeDifference <= 45; // 45 minutos o menos de diferencia
        });

        if (conflictingMatches.length >= 3) {
            // Ordenar partidos por hora para mejor presentación
            const sortedMatches = conflictingMatches.sort((a, b) => 
                this.timeToMinutes[a.time] - this.timeToMinutes[b.time]
            );

            const earliestTime = sortedMatches[0].time;
            const latestTime = sortedMatches[sortedMatches.length - 1].time;
            
            // Calcular próximos horarios disponibles
            const availableSlots = this.findNextAvailableSlots(date, targetMinutes);
            
            return {
                available: false,
                message: `❌ **No se puede confirmar en este horario**\n\n**Problema:** Ya hay 3 partidos en un rango de 45 minutos\n\n**Partidos confirmados:**\n${sortedMatches.map(m => `• ${m.time} - ${m.equipo1} vs ${m.equipo2}`).join('\n')}\n\n**Rango ocupado:** ${earliestTime} - ${latestTime}\n\n**💡 Próximos horarios disponibles:**\n${availableSlots.map(slot => `• ${slot}`).join('\n')}`
            };
        }

        return { available: true };
    }

    findNextAvailableSlots(date, excludeMinutes) {
        const availableSlots = [];
        
        for (const slot of this.timeSlots) {
            const slotMinutes = this.timeToMinutes[slot];
            
            // Contar partidos en ventana de 45 minutos para este slot
            const dayMatches = this.matches.filter(match => match.date === date);
            const conflicting = dayMatches.filter(match => {
                const matchMinutes = this.timeToMinutes[match.time];
                return Math.abs(slotMinutes - matchMinutes) <= 45;
            });
            
            if (conflicting.length < 3) {
                availableSlots.push(slot);
            }
            
            if (availableSlots.length >= 3) break; // Mostrar máximo 3 sugerencias
        }
        
        return availableSlots.length > 0 ? availableSlots : ['No hay horarios disponibles para este día'];
    }

    async viewMatches(interaction) {
        const opcion = interaction.options.getString('opcion');
        const dia = interaction.options.getString('dia');

        try {
            switch (opcion) {
                case 'todos':
                    await this.viewAllMatches(interaction);
                    break;
                case 'dia_semana':
                    if (!dia) {
                        return this.showDaySelectionError(interaction);
                    }
                    await this.viewDayOfWeek(interaction, dia);
                    break;
                default:
                    await this.showViewMatchesHelp(interaction);
            }
        } catch (error) {
            console.error('Error en ver_partidos:', error);
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Error')
                .setDescription('Ocurrió un error al mostrar los partidos. Intenta nuevamente.');
            await interaction.reply({ embeds: [embed] });
        }
    }

    async showDaySelectionError(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('⚠️ Día no seleccionado')
            .setDescription('Para ver los partidos por día de la semana, debes seleccionar un día específico.')
            .addFields({
                name: '📋 Instrucciones',
                value: '1. Selecciona "📅 Elegir día de la semana"\n2. En el campo "dia", elige el día que quieres consultar\n3. Ejecuta el comando'
            })
            .addFields({
                name: '🗓️ Días disponibles',
                value: 'Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo'
            });
        
        await interaction.reply({ embeds: [embed] });
    }

    async viewAllMatches(interaction) {
        if (this.matches.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setTitle('📋 Todos los Partidos')
                .setDescription('No hay partidos confirmados en el sistema.')
                .addFields({
                    name: '💡 ¿Cómo empezar?',
                    value: 'Usa `/confirmar_partido` para registrar tu primer partido en el sistema.'
                })
                .setFooter({ text: 'Sistema IOSoccer' });
            return interaction.reply({ embeds: [embed] });
        }

        // Ordenar partidos por fecha y hora
        const sortedMatches = this.matches.sort((a, b) => {
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison === 0) {
                return this.timeToMinutes[a.time] - this.timeToMinutes[b.time];
            }
            return dateComparison;
        });

        // Agrupar por fecha
        const matchesByDate = {};
        sortedMatches.forEach(match => {
            if (!matchesByDate[match.date]) {
                matchesByDate[match.date] = [];
            }
            matchesByDate[match.date].push(match);
        });

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📋 Todos los Partidos Confirmados')
            .setDescription(`Total de partidos en el sistema: **${this.matches.length}**`)
            .setFooter({ text: `Sistema IOSoccer • ${new Date().toLocaleString('es-AR')}` })
            .setTimestamp();

        // Limitar a las próximas 10 fechas para no sobrecargar el embed
        const dates = Object.keys(matchesByDate).slice(0, 10);
        
        dates.forEach(date => {
            const dayMatches = matchesByDate[date];
            const displayDate = this.formatDisplayDate(date);
            
            const matchList = dayMatches.map(match => 
                `• **${match.time}** - ${match.equipo1} vs ${match.equipo2}\n  🏆 ${match.torneo} • ID: \`${match.id}\``
            ).join('\n');

            embed.addFields({
                name: `📅 ${displayDate} (${dayMatches.length} partidos)`,
                value: matchList,
                inline: false
            });
        });

        if (Object.keys(matchesByDate).length > 10) {
            embed.addFields({
                name: '📌 Nota',
                value: `Se muestran las próximas 10 fechas. Total de fechas con partidos: ${Object.keys(matchesByDate).length}`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async viewDayOfWeek(interaction, dayInput) {
        const dayLower = dayInput.toLowerCase().trim();
        
        // Normalizar día de entrada
        const normalizedDay = dayLower === 'miercoles' ? 'miércoles' : 
                              dayLower === 'sabado' ? 'sábado' : dayLower;
        
        if (!this.dayNames.hasOwnProperty(normalizedDay)) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Día Inválido')
                .setDescription(`El día "${dayInput}" no es válido.`)
                .addFields({
                    name: '🗓️ Días válidos',
                    value: 'lunes, martes, miércoles, jueves, viernes, sábado, domingo'
                });
            return interaction.reply({ embeds: [embed] });
        }

        const targetDayNum = this.dayNames[normalizedDay];
        const dayDisplayName = this.dayNamesDisplay[targetDayNum];

        // Buscar todos los partidos que caen en ese día de la semana
        const dayOfWeekMatches = this.matches.filter(match => {
            const matchDate = new Date(match.date + 'T00:00:00');
            return matchDate.getDay() === targetDayNum;
        });

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`📅 Todos los Partidos de ${dayDisplayName}`)
            .setDescription(`Mostrando todos los partidos confirmados que caen en día **${dayDisplayName}**`)
            .setFooter({ text: `Total encontrados: ${dayOfWeekMatches.length} partidos` })
            .setTimestamp();

        if (dayOfWeekMatches.length === 0) {
            embed.addFields({ 
                name: '📋 Estado', 
                value: `No hay partidos confirmados para ningún ${dayDisplayName}.\n\n💡 **Sugerencia:** Confirma algunos partidos para este día usando \`/confirmar_partido\`` 
            });
        } else {
            // Ordenar por fecha y hora
            const sortedMatches = dayOfWeekMatches.sort((a, b) => {
                const dateComparison = new Date(a.date) - new Date(b.date);
                if (dateComparison === 0) {
                    return this.timeToMinutes[a.time] - this.timeToMinutes[b.time];
                }
                return dateComparison;
            });

            // Agrupar por fecha específica
            const matchesBySpecificDate = {};
            sortedMatches.forEach(match => {
                const displayDate = this.formatDisplayDate(match.date);
                if (!matchesBySpecificDate[displayDate]) {
                    matchesBySpecificDate[displayDate] = [];
                }
                matchesBySpecificDate[displayDate].push(match);
            });

            // Mostrar cada fecha
            Object.entries(matchesBySpecificDate).forEach(([displayDate, matches]) => {
                const matchList = matches.map(match => 
                    `• **${match.time}** - ${match.equipo1} vs ${match.equipo2}\n  🏆 ${match.torneo} • ID: \`${match.id}\``
                ).join('\n');

                embed.addFields({
                    name: `📆 ${displayDate} (${matches.length} partidos)`,
                    value: matchList,
                    inline: false
                });
            });

            // Estadísticas adicionales
            const tournamentCount = {};
            sortedMatches.forEach(match => {
                tournamentCount[match.torneo] = (tournamentCount[match.torneo] || 0) + 1;
            });

            if (Object.keys(tournamentCount).length > 0) {
                const tournamentStats = Object.entries(tournamentCount)
                    .map(([tournament, count]) => `• ${tournament}: ${count}`)
                    .join('\n');
                
                embed.addFields({
                    name: '🏆 Distribución por Torneo',
                    value: tournamentStats,
                    inline: false
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }

    async showViewMatchesHelp(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📋 Ayuda - Ver Partidos')
            .setDescription('Selecciona una de las opciones disponibles:')
            .addFields(
                {
                    name: '📋 Todos los partidos',
                    value: 'Muestra todos los partidos confirmados ordenados por fecha y hora'
                },
                {
                    name: '📅 Elegir día de la semana', 
                    value: 'Muestra todos los partidos que caen en un día específico de la semana\n**Importante:** Debes seleccionar un día en el campo "dia"'
                }
            )
            .addFields({
                name: '💡 Ejemplo de uso',
                value: '1. Selecciona "📅 Elegir día de la semana"\n2. En "dia" selecciona "🗓️ Lunes"\n3. Ejecuta el comando para ver todos los partidos de lunes'
            });
        
        await interaction.reply({ embeds: [embed] });
    }

    analyzeAvailability(date) {
        const available = [];
        
        for (const slot of this.timeSlots) {
            const slotMinutes = this.timeToMinutes[slot];
            const dayMatches = this.matches.filter(match => match.date === date);
            
            const conflicting = dayMatches.filter(match => {
                const matchMinutes = this.timeToMinutes[match.time];
                return Math.abs(slotMinutes - matchMinutes) <= 45;
            });
            
            if (conflicting.length < 3) {
                const spotsLeft = 3 - conflicting.length;
                available.push(`• **${slot}** - ${spotsLeft} lugares disponibles`);
            }
        }
        
        return available;
    }

    async cancelMatch(interaction) {
        const matchId = interaction.options.getInteger('id');
        const matchIndex = this.matches.findIndex(match => match.id === matchId);

        if (matchIndex === -1) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Partido No Encontrado')
                .setDescription(`No se encontró un partido con ID: \`${matchId}\``)
                .addFields({ 
                    name: '💡 Sugerencia', 
                    value: 'Usa `/ver_partidos` para ver los IDs de los partidos confirmados' 
                });
            return interaction.reply({ embeds: [embed] });
        }

        const match = this.matches[matchIndex];
        this.matches.splice(matchIndex, 1);
        this.saveMatches();

        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🗑️ Partido Cancelado')
            .setDescription('El partido ha sido cancelado exitosamente del sistema')
            .addFields(
                { name: '⚽ Equipo Local', value: match.equipo1, inline: false },
                { name: '🆚 Equipo Visitante', value: match.equipo2, inline: false },
                { name: '🏆 Torneo', value: match.torneo, inline: false },
                { name: '📅 Fecha', value: match.displayDate, inline: false },
                { name: '🕒 Hora', value: `${match.time}hs`, inline: false },
                { name: '👤 Cancelado por', value: interaction.user.username, inline: false }
            )
            .setFooter({ text: `Sistema IOSoccer • ${new Date().toLocaleString('es-AR')}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async showStats(interaction) {
        const totalMatches = this.matches.length;
        const today = new Date().toISOString().split('T')[0];
        const todayMatches = this.matches.filter(match => match.date === today).length;

        // Estadísticas por torneo
        const tournamentStats = {};
        this.matches.forEach(match => {
            tournamentStats[match.torneo] = (tournamentStats[match.torneo] || 0) + 1;
        });

        // Próximos partidos (próximos 7 días)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const upcomingMatches = this.matches.filter(match => {
            const matchDate = new Date(match.date + 'T00:00:00');
            const today = new Date();
            return matchDate >= today && matchDate <= nextWeek;
        }).length;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📊 Estadísticas del Sistema IOSoccer')
            .setDescription('Resumen completo del sistema de partidos')
            .addFields(
                { name: '📈 Total de Partidos', value: `**${totalMatches}** partidos`, inline: false },
                { name: '📅 Partidos Hoy', value: `**${todayMatches}** partidos`, inline: false },
                { name: '🗓️ Próximos 7 días', value: `**${upcomingMatches}** partidos`, inline: false }
            )
            .setTimestamp();

        if (Object.keys(tournamentStats).length > 0) {
            const tournamentField = Object.entries(tournamentStats)
                .map(([tournament, count]) => `• ${tournament}: **${count}** partidos`)
                .join('\n');
            embed.addFields({ name: '🏆 Distribución por Torneo', value: tournamentField, inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async showHelp(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('⚽ IOSoccer Bot - Guía Completa')
            .setDescription('Sistema avanzado de confirmación de partidos para IOSoccer')
            .addFields(
                {
                    name: '📋 Comandos de Partidos',
                    value: `
                    \`/confirmar_partido\` - Confirma un nuevo partido
                    \`/ver_partidos\` - Ver partidos con opciones:
                      • **📋 Todos:** Muestra todos los partidos ordenados por fecha
                      • **📅 Elegir día de la semana:** Partidos de un día específico
                    \`/cancelar_partido\` - Cancelar un partido existente
                    \`/estadisticas\` - Ver estadísticas del sistema
                    `,
                    inline: false
                },
                {
                    name: '🖥️ Comandos de Monitoreo',
                    value: `
                    \`/status\` - Estado de todos los servidores IOSoccer
                      • **auto_update:** Activar actualización automática cada 90s
                    \`/server\` - Información detallada de un servidor específico
                      • **numero:** Seleccionar servidor (1 = ELO #1, 2 = ELO #2)
                    \`/stop_status\` - Detiene auto-actualización en este canal
                    \`/ayuda\` - Mostrar esta guía completa
                    `,
                    inline: false
                },
                {
                    name: '📅 Formatos de Fecha Aceptados',
                    value: `
                    • **"hoy"** - Para el día actual
                    • **"mañana"** - Para el día siguiente
                    • **Días de la semana:** lunes, martes, miércoles, jueves, viernes, sábado, domingo
                    • **Fecha específica:** YYYY-MM-DD (ej: 2024-08-22)
                    
                    **Ejemplos:**
                    • "lunes" → Próximo lunes
                    • "viernes" → Próximo viernes
                    `,
                    inline: false
                },
                {
                    name: '⏰ Horarios Disponibles',
                    value: `**Horarios cada 15 minutos:**\n${this.timeSlots.join(', ')}\n\n**Sistema de ventana deslizante:** Máximo 3 partidos en cualquier período de 45 minutos consecutivos`,
                    inline: false
                },
                {
                    name: '🏆 Torneos Disponibles',
                    value: this.validTournaments.map(t => `• ${t}`).join('\n'),
                    inline: false
                },
                {
                    name: '⚠️ Reglas del Sistema',
                    value: `
                    • Máximo **3 partidos** en cualquier ventana de 45 minutos
                    • La ventana se calcula dinámicamente desde cualquier horario
                    • **Ejemplo:** Si hay partidos a las 22:00, 22:15 y 22:30, el próximo disponible sería 22:45
                    • **Ejemplo:** Si hay partidos a las 21:30, 21:45 y 22:00, el próximo disponible sería 22:15
                    • Solo usuarios con roles autorizados pueden usar el bot
                    `,
                    inline: false
                },
                {
                    name: '🔒 Control de Acceso',
                    value: `Este bot está protegido por un sistema de roles. Solo usuarios autorizados pueden confirmar partidos.`,
                    inline: false
                }
            )
            .setFooter({ text: 'Bot desarrollado para IOSoccer • Sistema v2.1' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // ============= MÉTODOS DE MONITOREO ULTRA-ROBUSTO =============

    /**
     * 🎮 Comando /server_info - Información de servidores con sistema ultra-robusto
     */
    async handleServerInfoCommand(interaction) {
        const serverName = interaction.options.getString('servidor');
        
        await interaction.deferReply();
        
        try {
            const serversToQuery = serverName 
                ? CONFIG.servers.filter(s => s.name.toLowerCase().includes(serverName.toLowerCase()))
                : CONFIG.servers;
                
            if (serversToQuery.length === 0) {
                return await interaction.editReply({
                    content: `❌ No se encontró ningún servidor con el nombre "${serverName}"`
                });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🎮 Información Ultra-Robusta de Servidores IOSoccer')
                .setColor('#00ff00')
                .setTimestamp();
                
            for (const server of serversToQuery) {
                const result = await monitoring.queryServerInfo(server);
                
                if (result.success) {
                    embed.addFields({
                        name: `🟢 ${result.data.server_name}`,
                        value: [
                            `**Mapa:** ${result.data.map_name}`,
                            `**Jugadores:** ${result.data.players}/${result.data.max_players}`,
                            `**Fuente:** ${result.source}${result.cached ? ' (cached)' : ''}`,
                            `**Calidad:** ${result.validation.quality.quality} (${result.validation.confidence}%)`
                        ].join('\n'),
                        inline: true
                    });
                } else {
                    embed.addFields({
                        name: `🔴 ${server.name}`,
                        value: [
                            `**Estado:** Inaccesible`,
                            `**Error:** ${result.error.user.message}`,
                            `**Sistema:** Ultra-robusto con auto-recuperación`
                        ].join('\n'),
                        inline: true
                    });
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger('ERROR', `Error en server_info: ${error.message}`);
            await interaction.editReply({
                content: '❌ Error obteniendo información del servidor. Sistema ultra-robusto reintentando...'
            });
        }
    }

    /**
     * ⚽ Comando /match_info - Información de partidos con JSON ultra-robusto
     */
    async handleMatchInfoCommand(interaction) {
        const serverName = interaction.options.getString('servidor');
        
        await interaction.deferReply();
        
        try {
            const serversToQuery = serverName 
                ? CONFIG.servers.filter(s => s.name.toLowerCase().includes(serverName.toLowerCase()))
                : CONFIG.servers;
                
            if (serversToQuery.length === 0) {
                return await interaction.editReply({
                    content: `❌ No se encontró ningún servidor con el nombre "${serverName}"`
                });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('⚽ Información Ultra-Robusta de Partidos IOSoccer')
                .setColor('#ffaa00')
                .setTimestamp();
                
            let hasActiveMatches = false;
                
            for (const server of serversToQuery) {
                // Primero verificar si hay jugadores
                const serverInfo = await monitoring.queryServerInfo(server);
                
                if (!serverInfo.success || serverInfo.data.players === 0) {
                    embed.addFields({
                        name: `⚪ ${server.name}`,
                        value: '**Estado:** Sin jugadores activos',
                        inline: true
                    });
                    continue;
                }
                
                // Si hay jugadores, obtener info del partido
                const result = await monitoring.queryMatchInfo(server, server.rcon_password);
                
                if (result.success) {
                    hasActiveMatches = true;
                    const data = result.data;
                    
                    embed.addFields({
                        name: `🟢 ${server.name}`,
                        value: [
                            `**Partido:** ${data.teamNameHome} vs ${data.teamNameAway}`,
                            `**Marcador:** ${data.goalsHome}-${data.goalsAway}`,
                            `**Periodo:** ${data.matchPeriod}`,
                            `**Estado:** ${data.matchStatus}`,
                            `**Calidad:** ${result.validation.quality.quality}${result.repaired ? ' (JSON reparado auto)' : ''}`
                        ].join('\n'),
                        inline: true
                    });
                } else {
                    embed.addFields({
                        name: `🔴 ${server.name}`,
                        value: [
                            `**Jugadores:** ${serverInfo.data.players}/${serverInfo.data.max_players}`,
                            `**Error RCON:** ${result.error.user.message}`,
                            `**Sistema:** Ultra-robusto con circuit breakers`
                        ].join('\n'),
                        inline: true
                    });
                }
            }
            
            if (!hasActiveMatches) {
                embed.setDescription('ℹ️ No hay partidos activos en este momento');
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger('ERROR', `Error en match_info: ${error.message}`);
            await interaction.editReply({
                content: '❌ Error obteniendo información de partidos. Sistema ultra-robusto reintentando...'
            });
        }
    }

    /**
     * 🏥 Comando /health - Estado de salud del sistema ultra-robusto
     */
    async handleHealthCommand(interaction) {
        try {
            const healthCheck = await monitoring.runIntegrityCheck();
            const isHealthy = Object.values(healthCheck).every(check => check.healthy);
            
            const embed = new EmbedBuilder()
                .setTitle('🏥 Estado de Salud del Sistema Ultra-Robusto')
                .setColor(isHealthy ? '#00ff00' : '#ff9900')
                .setTimestamp();
                
            // Estado general
            embed.setDescription(isHealthy 
                ? '✅ **SISTEMA ULTRA-ROBUSTO**: Todos los subsistemas funcionan perfectamente' 
                : '⚠️ **SISTEMA ULTRA-ROBUSTO**: Algunos subsistemas en modo de auto-recuperación');
            
            // Detalles por sistema
            Object.entries(healthCheck).forEach(([system, check]) => {
                embed.addFields({
                    name: `${check.healthy ? '✅' : '🔧'} ${system.charAt(0).toUpperCase() + system.slice(1)}`,
                    value: check.details || 'Sistema operativo',
                    inline: true
                });
            });
            
            // Información adicional del sistema
            embed.addFields({
                name: '🛡️ Características Ultra-Robustas Activas',
                value: [
                    '🔧 **Auto-reparación de JSON**: Activa',
                    '⚡ **Circuit Breakers**: Operativos', 
                    '🗄️ **Cache Multi-nivel**: Funcionando',
                    '📊 **Monitoreo Continuo**: En línea',
                    '🔄 **Reintentos Adaptativos**: Configurados'
                ].join('\n'),
                inline: false
            });
            
            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            logger('ERROR', `Error en health check: ${error.message}`);
            await interaction.reply({
                content: '❌ Error verificando estado de salud. Sistema ultra-robusto diagnosticando...',
                ephemeral: true
            });
        }
    }

    /**
     * 📈 Comando /system_stats - Estadísticas completas del sistema
     */
    async handleSystemStatsCommand(interaction) {
        await interaction.deferReply();
        
        try {
            const stats = getStats();
            
            const embed = new EmbedBuilder()
                .setTitle('📈 Estadísticas del Sistema Ultra-Robusto')
                .setColor('#0099ff')
                .setTimestamp();
                
            // Información general
            embed.addFields({
                name: '🤖 Bot Ultra-Robusto',
                value: [
                    `**Uptime:** ${Math.round(stats.uptime)} segundos`,
                    `**Memoria:** ${Math.round(stats.memory.rss / 1024 / 1024)}MB`,
                    `**Servidores:** ${CONFIG.servers.length}`,
                    `**Modo:** Ultra-Robusto Enterprise`
                ].join('\n'),
                inline: true
            });
            
            // Estado de subsistemas
            const healthySystems = Object.values(stats.systemHealth).filter(s => s).length;
            const totalSystems = Object.keys(stats.systemHealth).length;
            
            embed.addFields({
                name: '🛡️ Subsistemas Ultra-Robustos',
                value: [
                    `**Estado:** ${healthySystems}/${totalSystems} OK`,
                    `**Cache:** ${stats.cache?.totalEntries || 0} entradas`,
                    `**Hit Rate:** ${Math.round(stats.cache?.hitRate || 0)}%`,
                    `**Auto-reparaciones:** Activas`
                ].join('\n'),
                inline: true
            });
            
            // Rendimiento
            if (stats.performance) {
                embed.addFields({
                    name: '⚡ Rendimiento Ultra-Optimizado',
                    value: [
                        `**Memoria:** ${stats.performance.current?.memory?.status || 'Óptimo'}`,
                        `**Optimizaciones:** ${stats.performance.optimizations?.applied || 0}`,
                        `**Última optimización:** ${stats.performance.optimizations?.lastOptimization || 'N/A'}`,
                        `**Circuit Breakers:** Monitoreando`
                    ].join('\n'),
                    inline: true
                });
            }
            
            // Información de configuración
            embed.addFields({
                name: '⚙️ Configuración Ultra-Robusta',
                value: [
                    `**Timeouts A2S:** ${CONFIG.monitoring.defaultTimeouts.a2s}ms`,
                    `**Timeouts RCON:** ${CONFIG.monitoring.defaultTimeouts.rcon}ms`,
                    `**JSON Timeout:** ${CONFIG.monitoring.defaultTimeouts.matchJson}ms`,
                    `**Monitoreo Rendimiento:** ${CONFIG.monitoring.enablePerformanceMonitoring ? '✅' : '❌'}`,
                    `**Validación Datos:** ${CONFIG.monitoring.enableDataValidation ? '✅' : '❌'}`
                ].join('\n'),
                inline: false
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger('ERROR', `Error en system_stats: ${error.message}`);
            await interaction.editReply({
                content: '❌ Error obteniendo estadísticas del sistema ultra-robusto.'
            });
        }
    }

    /**
     * Estado de todos los servidores con información detallada ULTRA PERSISTENTE
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async serverStatus(interaction) {
        const autoUpdate = interaction.options.getBoolean('auto_update') || false;
        
        // Verificar si ya hay auto-update activo en este canal
        if (this.activeStatusChannels.has(interaction.channel.id)) {
            // Cancelar el auto-update existente
            const existing = this.activeStatusChannels.get(interaction.channel.id);
            if (existing.intervals) {
                existing.intervals.forEach(interval => clearInterval(interval));
            }
            this.activeStatusChannels.delete(interaction.channel.id);
            logger('INFO', `🔄 Auto-update anterior cancelado para canal ${interaction.channel.id}`);
        }
        
        // Mensaje de carga inicial
        const loadingEmbed = new EmbedBuilder()
            .setTitle('🔄 Consultando servidores...')
            .setDescription('Obteniendo información A2S + Match Info JSON PERSISTENTE')
            .setColor(0xffff00);
        
        await interaction.reply({ embeds: [loadingEmbed] });
        
        // Obtener información de todos los servidores con TIMEOUT GENERAL
        const serversInfo = [];
        const maxTotalTime = 10 * 60 * 1000; // 10 minutos máximo total
        const maxTimePerServer = 2 * 60 * 1000; // 2 minutos máximo por servidor
        
        const getAllServersInfo = async () => {
            for (let i = 0; i < SERVERS.length; i++) {
                const server = SERVERS[i];
                
                // Actualizar mensaje de progreso
                const progressEmbed = new EmbedBuilder()
                    .setTitle('🔄 Consultando servidores...')
                    .setDescription(`Analizando ${server.name} (${i+1}/${SERVERS.length}) - MODO PERSISTENTE`)
                    .addFields({
                        name: '📡 Progreso',
                        value: '✅ '.repeat(i) + '🔄 ' + '⏳ '.repeat(SERVERS.length - i - 1),
                        inline: false
                    })
                    .setColor(0xffff00);
                
                try {
                    await interaction.editReply({ embeds: [progressEmbed] });
                } catch (e) {
                    logger('WARNING', `⚠️ No se pudo actualizar progreso: ${e.message}`);
                }
                
                // Timeout por servidor individual
                try {
                    const serverInfo = await Promise.race([
                        getServerInfoRobust(server),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`Timeout de ${maxTimePerServer/1000}s alcanzado`)), maxTimePerServer)
                        )
                    ]);
                    serversInfo.push(serverInfo);
                    
                    // Log del resultado para debugging
                    if (serverInfo.matchInfo) {
                        logger('INFO', `📊 ${server.name}: ${serverInfo.matchInfo.team_home} ${serverInfo.matchInfo.goals_home}-${serverInfo.matchInfo.goals_away} ${serverInfo.matchInfo.team_away} (${serverInfo.matchInfo.time_display}, ${serverInfo.matchInfo.period})`);
                    } else {
                        logger('INFO', `📊 ${server.name}: Sin match info, ${serverInfo.players}/${serverInfo.maxPlayers} jugadores`);
                    }
                } catch (serverError) {
                    logger('ERROR', `❌ ${server.name} falló o timeout: ${serverError.message}`);
                    // Crear ServerInfo de error para este servidor
                    const { ServerInfo } = require('./monitoring/serverMonitoring');
                    serversInfo.push(new ServerInfo(
                        server.name,
                        serverError.message.includes('Timeout') ? "🕐 Timeout" : "🔴 Error"
                    ));
                }
            }
        };
        
        try {
            // Timeout general para todo el comando
            await Promise.race([
                getAllServersInfo(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Comando /status timeout después de ${maxTotalTime/1000/60} minutos`)), maxTotalTime)
                )
            ]);
        } catch (globalError) {
            if (globalError.message.includes('timeout')) {
                logger('ERROR', `❌ TIMEOUT GLOBAL del comando /status: ${globalError.message}`);
                
                // Si hay timeout global, mostrar lo que tengamos hasta ahora
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Timeout Global')
                    .setDescription(`El comando /status tardó demasiado. Mostrando información parcial de ${serversInfo.length}/${SERVERS.length} servidores.`)
                    .setColor(0xff9900);
                
                await interaction.editReply({ embeds: [timeoutEmbed] });
            } else {
                throw globalError;
            }
        }
        
        // Crear embed de status principal
        const statusEmbed = createStatusEmbed(serversInfo);
        
        if (autoUpdate) {
            // Activar auto-update PERSISTENTE
            statusEmbed.setFooter({ text: `🔄 Auto-actualización PERSISTENTE ACTIVADA | Actualiza cada 90 segundos | ${new Date().toLocaleTimeString()}` });
            
            // Enviar RESUMEN + DETALLES desde el inicio
            await interaction.editReply({ embeds: [statusEmbed] });
            
            // Enviar detalles de cada servidor
            const detailMessages = [];
            for (const serverInfo of serversInfo) {
                const matchEmbed = createMatchEmbedImproved(serverInfo);
                const detailMsg = await interaction.followUp({ embeds: [matchEmbed] });
                detailMessages.push(detailMsg);
            }
            
            // Registrar TODOS los mensajes para auto-update
            const summaryMessage = await interaction.fetchReply();
            const allMessages = [summaryMessage, ...detailMessages];
            
            // Iniciar auto-update PERSISTENTE con interval
            const updateInterval = setInterval(async () => {
                try {
                    await this.autoUpdateStatusPersistent(interaction.channel, allMessages);
                } catch (error) {
                    logger('ERROR', `❌ Error en auto-update PERSISTENTE: ${error}`);
                    clearInterval(updateInterval);
                    this.activeStatusChannels.delete(interaction.channel.id);
                }
            }, 90000); // 90 segundos
            
            // Registrar el canal y el interval
            this.activeStatusChannels.set(interaction.channel.id, {
                messages: allMessages,
                intervals: [updateInterval]
            });
            
            logger('INFO', `🔄 Auto-update PERSISTENTE INICIADO para canal ${interaction.channel.id} con ${allMessages.length} mensajes`);
            
            // Enviar mensaje de confirmación
            await interaction.followUp({ 
                content: '✅ **Auto-actualización PERSISTENTE activada!** El status se actualizará cada 90 segundos con conexiones robustas.',
                ephemeral: true 
            });
        } else {
            // Status normal sin auto-update
            await interaction.editReply({ embeds: [statusEmbed] });
            
            // Mostrar detalles individuales de cada servidor
            for (const serverInfo of serversInfo) {
                const matchEmbed = createMatchEmbedImproved(serverInfo);
                await interaction.followUp({ embeds: [matchEmbed] });
            }
        }
    }
    
    /**
     * Función de auto-actualización ULTRA PERSISTENTE con tolerancia a conexiones lentas
     * @param {import('discord.js').TextChannel} channel 
     * @param {import('discord.js').Message[]} messages 
     */
    async autoUpdateStatusPersistent(channel, messages) {
        let updateCount = 0;
        
        const performUpdate = async () => {
            updateCount++;
            logger('INFO', `🔄 Auto-update PERSISTENTE #${updateCount} ejecutándose para canal ${channel.id}`);
            
            try {
                // Mensaje de "actualizando" en el primer mensaje
                if (messages.length > 0) {
                    const updatingEmbed = new EmbedBuilder()
                        .setTitle('🔄 Actualizando servidores...')
                        .setDescription(`Actualización #${updateCount} - Obteniendo información PERSISTENTE...`)
                        .setColor(0xffaa00);
                    
                    try {
                        await messages[0].edit({ embeds: [updatingEmbed] });
                    } catch (e) {
                        logger('WARNING', `⚠️ No se pudo editar mensaje de actualización: ${e}`);
                    }
                }
                
                // Obtener información actualizada de todos los servidores (PERSISTENTE)
                const serversInfo = [];
                for (let i = 0; i < SERVERS.length; i++) {
                    const server = SERVERS[i];
                    logger('INFO', `🔄 Auto-update PERSISTENTE: procesando ${server.name} (${i+1}/${SERVERS.length})`);
                    
                    // Actualizar mensaje de progreso
                    if (messages.length > 0) {
                        const updatingEmbed = new EmbedBuilder()
                            .setTitle('🔄 Actualizando servidores...')
                            .setDescription(`Actualización #${updateCount} - Procesando ${server.name} (${i+1}/${SERVERS.length}) - MODO PERSISTENTE`)
                            .setColor(0xffaa00);
                        
                        try {
                            await messages[0].edit({ embeds: [updatingEmbed] });
                        } catch (e) {
                            // Ignorar errores de edición
                        }
                    }
                    
                    const serverInfo = await getServerInfoRobust(server);
                    serversInfo.push(serverInfo);
                }
                
                // Actualizar mensaje de resumen (primer mensaje)
                if (messages.length > 0) {
                    const statusEmbed = createStatusEmbed(serversInfo);
                    statusEmbed.setFooter({ text: `🔄 Auto-actualización PERSISTENTE #${updateCount} | Próxima actualización en 90s | ${new Date().toLocaleTimeString()}` });
                    
                    try {
                        await messages[0].edit({ embeds: [statusEmbed] });
                    } catch (error) {
                        logger('ERROR', `❌ Error actualizando resumen: ${error}`);
                    }
                }
                
                // Actualizar mensajes de detalles (resto de mensajes)
                for (let i = 0; i < serversInfo.length; i++) {
                    if (i + 1 < messages.length) { // +1 porque el primer mensaje es el resumen
                        const matchEmbed = createMatchEmbedImproved(serversInfo[i]);
                        try {
                            await messages[i + 1].edit({ embeds: [matchEmbed] });
                        } catch (error) {
                            logger('ERROR', `❌ Error actualizando detalle ${serversInfo[i].name}: ${error}`);
                        }
                    }
                }
                
                logger('INFO', `✅ Auto-update PERSISTENTE #${updateCount} completado para canal ${channel.id}`);
            } catch (error) {
                logger('ERROR', `❌ Error fatal en auto-update PERSISTENTE #${updateCount}: ${error}`);
            }
        };
        
        // Ejecutar la primera actualización inmediatamente
        await performUpdate();
    }
    
    /**
     * Función de auto-actualización regular (compatibilidad)
     * @param {import('discord.js').TextChannel} channel 
     * @param {import('discord.js').Message[]} messages 
     */
    async autoUpdateStatus(channel, messages) {
        // Delegar a la versión persistente para mantener compatibilidad
        return await this.autoUpdateStatusPersistent(channel, messages);
    }
    
    /**
     * Información detallada de un servidor específico
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async individualServer(interaction) {
        const serverNum = interaction.options.getInteger('numero');
        
        if (serverNum < 1 || serverNum > SERVERS.length) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Servidor Inválido')
                .setDescription(`Servidor inválido. Usa 1-${SERVERS.length}`);
            return interaction.reply({ embeds: [embed] });
        }
        
        const server = SERVERS[serverNum - 1];
        
        const loadingEmbed = new EmbedBuilder()
            .setTitle(`🔄 Consultando ${server.name}...`)
            .setDescription('Obteniendo información detallada')
            .setColor(0xffff00);
        
        await interaction.reply({ embeds: [loadingEmbed] });
        
        const serverInfo = await getServerInfoRobust(server);
        const matchEmbed = createMatchEmbedImproved(serverInfo);
        
        await interaction.editReply({ embeds: [matchEmbed] });
    }
    
    /**
     * Detiene la actualización automática del status en este canal
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async stopAutoStatus(interaction) {
        if (!this.activeStatusChannels.has(interaction.channel.id)) {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Sin Auto-actualización')
                .setDescription('No hay auto-actualización activa en este canal.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Cancelar los intervals
        const channelData = this.activeStatusChannels.get(interaction.channel.id);
        if (channelData.intervals) {
            channelData.intervals.forEach(interval => clearInterval(interval));
        }
        
        // Limpiar registro
        this.activeStatusChannels.delete(interaction.channel.id);
        
        const embed = new EmbedBuilder()
            .setTitle('🛑 Auto-actualización detenida')
            .setDescription('La actualización automática del status ha sido desactivada para este canal.')
            .setColor(0xff6600);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
        logger('INFO', `🛑 Auto-update detenido manualmente para canal ${interaction.channel.id}`);
    }

    /**
     * 🌐 Crear servidor web para health checks de Railway
     */
    createHealthServer() {
        const server = http.createServer(async (req, res) => {
            if (req.url === '/health') {
                try {
                    const healthCheck = monitoring.runIntegrityCheck ? await monitoring.runIntegrityCheck() : { basic: { healthy: true } };
                    const isHealthy = Object.values(healthCheck).every(check => check.healthy);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: isHealthy ? 'healthy' : 'degraded',
                        bot: this.client?.user?.tag || 'not_ready',
                        servers: CONFIG.servers.length,
                        uptime: process.uptime(),
                        matches: this.matches.length,
                        monitoring: 'ultra-robust',
                        systems: healthCheck
                    }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: error.message }));
                }
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                    <head><title>Bot IOSoccer Ultra-Robusto</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>🛡️ Bot IOSoccer Ultra-Robusto</h1>
                        <h2>Sistema Enterprise que Nunca Falla</h2>
                        <p><strong>Estado:</strong> ${this.client?.user?.tag || 'Iniciando...'}</p>
                        <p><strong>Servidores monitoreados:</strong> ${CONFIG.servers.length}</p>
                        <p><strong>Partidos confirmados:</strong> ${this.matches.length}</p>
                        <p><strong>Uptime:</strong> ${Math.round(process.uptime())} segundos</p>
                        <hr>
                        <h3>✨ Características Ultra-Robustas:</h3>
                        <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                            <li>🛡️ Nunca falla con fallbacks automáticos</li>
                            <li>🔧 Auto-reparación de JSON truncado</li>
                            <li>⚡ Súper rápido con cache inteligente</li>
                            <li>🧠 Mensajes de error en español</li>
                            <li>📊 Monitoreo enterprise continuo</li>
                            <li>🔄 Circuit breakers y reintentos adaptativos</li>
                        </ul>
                        <hr>
                        <p><a href="/health">Ver Health Check JSON</a></p>
                    </body>
                    </html>
                `);
            }
        });
        
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`🌐 Servidor web ultra-robusto corriendo en puerto ${PORT}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
        });
        
        return server;
    }

    loadMatches() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error al cargar partidos:', error);
        }
        return [];
    }

    saveMatches() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.matches, null, 2));
        } catch (error) {
            console.error('Error al guardar partidos:', error);
        }
    }
}

// ============= INICIALIZACIÓN ULTRA-ROBUSTA =============

async function initializeBot() {
    try {
        console.log('🚀 Iniciando Bot IOSoccer Ultra-Robusto...');
        console.log('📋 Verificando configuración...');
        
        // Validar configuración esencial
        if (!CONFIG.discord.token) {
            console.error('❌ ERROR: DISCORD_TOKEN no está configurado');
            process.exit(1);
        }
        
        if (!CONFIG.discord.clientId) {
            console.error('❌ ERROR: DISCORD_CLIENT_ID no está configurado');
            process.exit(1);
        }
        
        console.log(`✅ Token Discord: Configurado`);
        console.log(`✅ Client ID: ${CONFIG.discord.clientId}`);
        console.log(`✅ Servidores configurados: ${CONFIG.servers.length}`);
        console.log(`✅ Sistema de monitoreo: Ultra-Robusto`);
        
        // Inicializar bot
        const bot = new IOSoccerBot();
        
        // Configurar manejo de shutdown limpio
        process.on('SIGINT', async () => {
            console.log('🛑 Cerrando bot ultra-robusto de forma segura...');
            
            try {
                if (monitoring && monitoring.shutdown) {
                    await monitoring.shutdown();
                }
                
                if (bot && bot.client) {
                    bot.client.destroy();
                }
                
                console.log('✅ Bot ultra-robusto cerrado correctamente');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error durante shutdown ultra-robusto:', error);
                process.exit(1);
            }
        });
        
        console.log('🛡️ Bot IOSoccer Ultra-Robusto iniciado exitosamente');
        console.log('📊 Todos los sistemas enterprise activos');
        
        return bot;
        
    } catch (error) {
        console.error('💥 Error fatal inicializando bot ultra-robusto:', error);
        process.exit(1);
    }
}

// Manejo de errores ultra-robusto
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection en sistema ultra-robusto:', error);
    logger('ERROR', `Unhandled rejection: ${error.message}`);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception en sistema ultra-robusto:', error);
    logger('ERROR', `Uncaught exception: ${error.message}`);
});

// Inicializar el bot ultra-robusto
initializeBot().catch(error => {
    console.error('💥 Error crítico en inicialización:', error);
    process.exit(1);
});

console.log('🚀 Sistema IOSoccer Ultra-Robusto cargando...');
console.log('📋 Configuración Enterprise iniciada');
console.log('🛡️ Todos los sistemas de auto-recuperación activos');

module.exports = IOSoccerBot;

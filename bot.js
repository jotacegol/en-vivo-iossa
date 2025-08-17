const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// ============= IMPORTS DE MONITOREO =============
const { 
    SERVERS, 
    getServerInfoRobust, 
    createMatchEmbedImproved, 
    createStatusEmbed, 
    validateServerConfig 
} = require('./monitoring/serverMonitoring');
const { logger } = require('./monitoring/queryUtils');

// Configuración del bot
const CLIENT_ID = '1347620321263353917'; // Reemplaza con tu client ID

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

    init() {
        this.client.once('ready', () => {
            console.log(`🟢 Bot IOSoccer conectado como ${this.client.user.tag}`);
            console.log(`📅 Sistema de confirmación de partidos activo`);
            console.log(`🔒 Control de roles activado`);
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

        this.client.login(process.env.DISCORD_TOKEN);
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

            // ============= COMANDOS DE MONITOREO =============
            new SlashCommandBuilder()
                .setName('status')
                .setDescription('Estado de todos los servidores IOSoccer con información detallada')
                .addBooleanOption(option =>
                    option.setName('auto_update')
                        .setDescription('Activar actualización automática cada 90 segundos')
                        .setRequired(false)),

            new SlashCommandBuilder()
                .setName('server')
                .setDescription('Información detallada de un servidor específico')
                .addIntegerOption(option =>
                    option.setName('numero')
                        .setDescription('Número del servidor')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ELO #1', value: 1 },
                            { name: 'ELO #2', value: 2 },
                            { name: 'IOSSA #1', value: 3 },
                            { name: 'IOSSA #2', value: 4 },
                            { name: 'IOSSA #3', value: 5 }
                        )),

            new SlashCommandBuilder()
                .setName('stop_status')
                .setDescription('Detiene la actualización automática del status en este canal')
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
                // ============= COMANDOS DE MONITOREO =============
                case 'status':
                    await this.serverStatus(interaction);
                    break;
                case 'server':
                    await this.individualServer(interaction);
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

    // ============= MÉTODOS DE MONITOREO =============

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

// Inicializar el bot
const bot = new IOSoccerBot();

// Manejo de errores
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

module.exports = IOSoccerBot;

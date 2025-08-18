// 🚀 Bot IOSoccer Ultra-Robusto para Railway
// Sistema de monitoreo enterprise-grade que nunca falla

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

// 🌟 IMPORTAR SISTEMA ULTRA-ROBUSTO
const { 
    monitoring, 
    initialize,
    getStats,
    logger 
} = require('./monitoring');

// 📊 Configuración desde variables de entorno
const CONFIG = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID
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
    }
};

// 🎮 Cargar servidores desde variables de entorno
function loadServersFromEnv() {
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

CONFIG.servers = loadServersFromEnv();

// ✅ Validar configuración
if (!CONFIG.discord.token) {
    console.error('❌ ERROR: DISCORD_TOKEN no está configurado en las variables de entorno');
    process.exit(1);
}

if (!CONFIG.discord.clientId) {
    console.error('❌ ERROR: DISCORD_CLIENT_ID no está configurado en las variables de entorno');
    process.exit(1);
}

if (CONFIG.servers.length === 0) {
    console.error('❌ ERROR: No se encontraron servidores configurados. Añade SERVER_1_NAME, SERVER_1_IP, etc.');
    process.exit(1);
}

console.log(`✅ Configuración cargada: ${CONFIG.servers.length} servidor(es) configurado(s)`);

// 🤖 Crear cliente Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 📋 Definir comandos slash
const commands = [
    new SlashCommandBuilder()
        .setName('server')
        .setDescription('Ver información de servidores IOSoccer')
        .addStringOption(option =>
            option.setName('servidor')
                .setDescription('Nombre del servidor (opcional)')
                .setRequired(false)
        ),
    
    new SlashCommandBuilder()
        .setName('match')
        .setDescription('Ver información del partido en curso')
        .addStringOption(option =>
            option.setName('servidor')
                .setDescription('Nombre del servidor (opcional)')
                .setRequired(false)
        ),
    
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Ver estadísticas del sistema de monitoreo'),
        
    new SlashCommandBuilder()
        .setName('health')
        .setDescription('Ver estado de salud del bot'),
        
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Ver ayuda y comandos disponibles')
].map(command => command.toJSON());

// 🚀 Función principal
async function main() {
    try {
        console.log('🚀 Iniciando Bot IOSoccer Ultra-Robusto...');
        
        // 1. Inicializar sistema de monitoreo
        console.log('📊 Inicializando sistema de monitoreo enterprise-grade...');
        await initialize(CONFIG.monitoring);
        
        // 2. Registrar comandos slash
        console.log('📋 Registrando comandos slash...');
        const rest = new REST({ version: '10' }).setToken(CONFIG.discord.token);
        
        await rest.put(
            Routes.applicationCommands(CONFIG.discord.clientId),
            { body: commands }
        );
        
        console.log('✅ Comandos slash registrados exitosamente');
        
        // 3. Configurar eventos del bot
        setupBotEvents();
        
        // 4. Conectar a Discord
        await client.login(CONFIG.discord.token);
        
    } catch (error) {
        console.error('❌ Error fatal iniciando bot:', error);
        process.exit(1);
    }
}

// 🎯 Configurar eventos del bot
function setupBotEvents() {
    // Bot listo
    client.once('ready', () => {
        console.log(`✅ Bot conectado como ${client.user.tag}`);
        console.log(`🎮 Monitoreando ${CONFIG.servers.length} servidor(es) IOSoccer`);
        console.log('🛡️ Sistema ultra-robusto: ACTIVO');
        
        // Actualizar estado
        client.user.setActivity(`${CONFIG.servers.length} servidores IOSoccer`, { type: 'WATCHING' });
    });

    // Manejar comandos slash
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        
        try {
            await handleSlashCommand(interaction);
        } catch (error) {
            console.error('❌ Error manejando comando:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error procesando el comando.',
                    ephemeral: true
                });
            }
        }
    });
    
    // Manejo de errores Discord
    client.on('error', error => {
        console.error('❌ Discord client error:', error);
    });
}

// 🎯 Manejar comandos slash
async function handleSlashCommand(interaction) {
    const { commandName } = interaction;
    
    // Defer la respuesta para comandos que pueden tardar
    if (['server', 'match', 'stats'].includes(commandName)) {
        await interaction.deferReply();
    }
    
    switch (commandName) {
        case 'server':
            await handleServerCommand(interaction);
            break;
            
        case 'match':
            await handleMatchCommand(interaction);
            break;
            
        case 'stats':
            await handleStatsCommand(interaction);
            break;
            
        case 'health':
            await handleHealthCommand(interaction);
            break;
            
        case 'help':
            await handleHelpCommand(interaction);
            break;
            
        default:
            await interaction.reply({
                content: '❌ Comando no reconocido.',
                ephemeral: true
            });
    }
}

// 🎮 Comando /server
async function handleServerCommand(interaction) {
    const serverName = interaction.options.getString('servidor');
    
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
            .setTitle('🎮 Información de Servidores IOSoccer')
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
                        `**Categoría:** ${result.error.technical.category}`
                    ].join('\n'),
                    inline: true
                });
            }
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        await interaction.editReply({
            content: '❌ Error obteniendo información del servidor.'
        });
    }
}

// ⚽ Comando /match
async function handleMatchCommand(interaction) {
    const serverName = interaction.options.getString('servidor');
    
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
            .setTitle('⚽ Información de Partidos IOSoccer')
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
                        `**Calidad:** ${result.validation.quality.quality}${result.repaired ? ' (reparado)' : ''}`
                    ].join('\n'),
                    inline: true
                });
            } else {
                embed.addFields({
                    name: `🔴 ${server.name}`,
                    value: [
                        `**Jugadores:** ${serverInfo.data.players}/${serverInfo.data.max_players}`,
                        `**Error RCON:** ${result.error.user.message}`,
                        `**Sugerencia:** ${result.error.admin.suggestions[0] || 'Verificar configuración RCON'}`
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
        await interaction.editReply({
            content: '❌ Error obteniendo información de partidos.'
        });
    }
}

// 📊 Comando /stats
async function handleStatsCommand(interaction) {
    try {
        const stats = getStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas del Sistema de Monitoreo')
            .setColor('#0099ff')
            .setTimestamp();
            
        // Información general
        embed.addFields({
            name: '🤖 Bot',
            value: [
                `**Uptime:** ${Math.round(stats.uptime)} segundos`,
                `**Memoria:** ${Math.round(stats.memory.rss / 1024 / 1024)}MB`,
                `**Servidores:** ${CONFIG.servers.length}`
            ].join('\n'),
            inline: true
        });
        
        // Estado de subsistemas
        const healthySystems = Object.values(stats.systemHealth).filter(s => s).length;
        const totalSystems = Object.keys(stats.systemHealth).length;
        
        embed.addFields({
            name: '🛡️ Sistemas',
            value: [
                `**Estado:** ${healthySystems}/${totalSystems} OK`,
                `**Cache:** ${stats.cache?.totalEntries || 0} entradas`,
                `**Hit Rate:** ${Math.round(stats.cache?.hitRate || 0)}%`
            ].join('\n'),
            inline: true
        });
        
        // Rendimiento
        if (stats.performance) {
            embed.addFields({
                name: '⚡ Rendimiento',
                value: [
                    `**Memoria:** ${stats.performance.current.memory.status}`,
                    `**Optimizaciones:** ${stats.performance.optimizations.applied}`,
                    `**Última optimización:** ${stats.performance.optimizations.lastOptimization}`
                ].join('\n'),
                inline: true
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        await interaction.editReply({
            content: '❌ Error obteniendo estadísticas del sistema.'
        });
    }
}

// 🏥 Comando /health
async function handleHealthCommand(interaction) {
    try {
        const healthCheck = await monitoring.runIntegrityCheck();
        const isHealthy = Object.values(healthCheck).every(check => check.healthy);
        
        const embed = new EmbedBuilder()
            .setTitle('🏥 Estado de Salud del Bot')
            .setColor(isHealthy ? '#00ff00' : '#ff9900')
            .setTimestamp();
            
        // Estado general
        embed.setDescription(isHealthy ? '✅ Todos los sistemas funcionan correctamente' : '⚠️ Algunos sistemas tienen problemas menores');
        
        // Detalles por sistema
        Object.entries(healthCheck).forEach(([system, check]) => {
            embed.addFields({
                name: `${check.healthy ? '✅' : '❌'} ${system.charAt(0).toUpperCase() + system.slice(1)}`,
                value: check.details || 'Sin detalles',
                inline: true
            });
        });
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        await interaction.reply({
            content: '❌ Error verificando estado de salud del bot.',
            ephemeral: true
        });
    }
}

// 📖 Comando /help
async function handleHelpCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('📖 Ayuda - Bot IOSoccer Ultra-Robusto')
        .setDescription('🛡️ Sistema de monitoreo enterprise-grade que **nunca falla**')
        .setColor('#9900ff')
        .addFields(
            {
                name: '🎮 /server [servidor]',
                value: 'Ver información de servidores IOSoccer\n*Ejemplo: `/server main`*'
            },
            {
                name: '⚽ /match [servidor]',
                value: 'Ver información de partidos en curso\n*Ejemplo: `/match` (todos los servidores)*'
            },
            {
                name: '📊 /stats',
                value: 'Ver estadísticas del sistema de monitoreo'
            },
            {
                name: '🏥 /health',
                value: 'Ver estado de salud de todos los subsistemas'
            },
            {
                name: '📖 /help',
                value: 'Mostrar esta ayuda'
            }
        )
        .addFields({
            name: '✨ Características Ultra-Robustas',
            value: [
                '🛡️ **Nunca falla**: Fallbacks automáticos',
                '🔧 **Auto-reparación**: JSON truncado se repara solo',
                '⚡ **Súper rápido**: Cache inteligente',
                '🧠 **Mensajes claros**: Errores explicados en español',
                '📊 **Monitoreo completo**: Sistema enterprise-grade'
            ].join('\n')
        })
        .setFooter({
            text: 'Desarrollado con ❤️ para la comunidad IOSoccer'
        });
        
    await interaction.reply({ embeds: [embed] });
}

// 🔧 Manejo limpio de shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando bot de forma segura...');
    
    try {
        if (monitoring) {
            await monitoring.shutdown();
        }
        
        if (client) {
            client.destroy();
        }
        
        console.log('✅ Bot cerrado correctamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante shutdown:', error);
        process.exit(1);
    }
});

// 🔥 Iniciar el bot
main().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});

// 🌐 Para Railway: Crear servidor web básico para health checks
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'healthy', 
            bot: client?.user?.tag || 'not_ready',
            servers: CONFIG.servers.length,
            uptime: process.uptime()
        }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('🚀 Bot IOSoccer Ultra-Robusto - Sistema de monitoreo enterprise-grade');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en puerto ${PORT} (para health checks de Railway)`);
});

console.log('🚀 Bot IOSoccer Ultra-Robusto iniciando...');
console.log('📋 Configuración cargada desde variables de entorno');
console.log(`🎮 ${CONFIG.servers.length} servidor(es) configurado(s)`);
console.log('🛡️ Sistema de monitoreo: ACTIVANDO...');

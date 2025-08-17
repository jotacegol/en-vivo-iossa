# BilarBot - Bot IOSoccer

Bot avanzado para Discord que permite la confirmación de partidos de IOSoccer y monitoreo en tiempo real de servidores.

## 🚀 Características

- **Sistema de confirmación de partidos**: Permite a los usuarios confirmar partidos con validación de horarios
- **Monitoreo de servidores**: Consulta en tiempo real el estado de todos los servidores IOSoccer
- **Auto-actualización**: Sistema de actualización automática persistente cada 90 segundos
- **Control de acceso**: Sistema de roles y permisos para limitar el uso del bot
- **JSON parsing robusto**: Reparación automática de JSON truncado de IOSoccer

## 📋 Comandos Disponibles

### Comandos de Partidos
- `/confirmar_partido` - Confirma un nuevo partido
- `/ver_partidos` - Ver partidos con múltiples opciones de filtrado
- `/cancelar_partido` - Cancelar un partido existente
- `/estadisticas` - Ver estadísticas del sistema

### Comandos de Monitoreo
- `/status` - Estado de todos los servidores IOSoccer
- `/server` - Información detallada de un servidor específico
- `/stop_status` - Detiene la auto-actualización en el canal actual
- `/ayuda` - Muestra la guía completa del bot

## 🛠️ Instalación

### Prerequisitos
- Node.js 16.0 o superior
- npm o yarn
- Token de bot de Discord

### Pasos de instalación

1. **Clona el repositorio**:
   ```bash
   git clone [URL_DEL_REPOSITORIO]
   cd bilarbot-warp
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**:
   ```bash
   # Copia el archivo de ejemplo
   cp .env.example .env
   
   # Edita el archivo .env con tu token de Discord
   # DISCORD_TOKEN=tu_token_del_bot_discord_aqui
   ```

4. **Obtén tu token de Discord**:
   - Ve a [Discord Developer Portal](https://discord.com/developers/applications)
   - Crea una nueva aplicación o usa una existente
   - Ve a la sección "Bot"
   - Copia el token y pégalo en el archivo `.env`

5. **Ejecuta el bot**:
   ```bash
   node bot.js
   ```

## ⚙️ Configuración

### Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DISCORD_TOKEN=tu_token_del_bot_discord_aqui
```

### Configuración de roles y permisos

En el archivo `bot.js`, modifica estas configuraciones:

```javascript
// Client ID del bot
const CLIENT_ID = 'TU_CLIENT_ID_AQUI';

// Roles permitidos para usar el bot
const ALLOWED_ROLES = [
    'ID_DEL_ROL_1',
    'ID_DEL_ROL_2',
    'ID_DEL_ROL_3'
];

// Usuarios administradores
const ADMIN_USERS = [
    'ID_USUARIO_ADMIN_1',
    'ID_USUARIO_ADMIN_2'
];
```

## 🏆 Sistema de Torneos

El bot soporta los siguientes torneos:
- Liga D1
- Liga D2  
- Liga D3
- Copa Maradei
- Copa ValencARc
- Intrazonal de Oro
- Intrazonal de Plata
- Supercopa IOSSA
- Supercopa de ORO

## 🕐 Sistema de Horarios

- **Horarios disponibles**: 21:00 - 23:45 (cada 15 minutos)
- **Regla de ventana deslizante**: Máximo 3 partidos en cualquier período de 45 minutos consecutivos
- **Validación inteligente**: El sistema sugiere horarios alternativos cuando hay conflictos

## 🖥️ Monitoreo de Servidores

El bot monitorea los siguientes servidores:
- **ELO #1**: 45.235.98.16:27018
- **ELO #2**: 45.235.98.16:27019  
- **IOSSA #1**: 45.235.98.16:27015
- **IOSSA #2**: 45.235.98.16:27016
- **IOSSA #3**: 45.235.98.16:27017

### Características del monitoreo:
- **Conexiones robustas**: Sistema de reconexión automática
- **JSON parsing avanzado**: Reparación automática de datos truncados
- **Auto-actualización**: Actualización cada 90 segundos
- **Información completa**: Jugadores, partidos en curso, goles, etc.

## 📁 Estructura del Proyecto

```
bilarbot-warp/
├── bot.js              # Archivo principal del bot
├── monitoring/         # Módulos de monitoreo
│   ├── serverMonitoring.js  # Lógica principal de monitoreo
│   ├── queryUtils.js        # Utilidades para consultas
│   └── matchParser.js       # Parser de JSON de IOSoccer
├── .env                # Variables de entorno (NO SUBIR A GIT)
├── .env.example        # Plantilla de variables de entorno
├── .gitignore          # Archivos ignorados por Git
├── package.json        # Dependencias y scripts
├── matches.json        # Base de datos local de partidos
└── README.md           # Este archivo
```

## 🔒 Seguridad

- **Tokens protegidos**: Los tokens se almacenan en variables de entorno
- **Control de acceso**: Sistema de roles y permisos
- **Archivos protegidos**: `.env` y datos locales excluidos del repositorio

## 🐛 Solución de Problemas

### Bot no se conecta
1. Verifica que el token en `.env` sea correcto
2. Asegúrate de que el bot tenga permisos en tu servidor de Discord

### Comandos no aparecen
1. Verifica que `CLIENT_ID` sea correcto
2. El bot necesita permisos de "applications.commands"

### Monitoreo no funciona
1. Verifica conexión a internet
2. Los servidores IOSoccer pueden estar temporalmente inaccesibles

## 📄 Licencia

Este proyecto es de uso privado para la comunidad IOSoccer.

## 👥 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 🆘 Soporte

Para soporte y preguntas, contacta al equipo de desarrollo en Discord.

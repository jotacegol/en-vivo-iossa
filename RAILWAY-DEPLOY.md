# 🚂 Guía de Despliegue en Railway

Railway es una plataforma de hosting gratuita perfecta para hostear tu bot de Discord las 24/7.

## ✅ Preparación Previa

Antes de empezar, asegúrate de tener:
- Tu bot creado en [Discord Developer Portal](https://discord.com/developers/applications)
- El token del bot copiado (lo necesitarás para Railway)
- Una cuenta de GitHub (para conectar el repositorio)

## 🚀 Despliegue Paso a Paso

### 1. Crear cuenta en Railway
1. Ve a [railway.app](https://railway.app)
2. Haz clic en "Start a New Project"
3. Inicia sesión con GitHub

### 2. Conectar tu repositorio
1. Selecciona "Deploy from GitHub repo"
2. Autoriza Railway para acceder a tus repositorios
3. Selecciona tu repositorio `bilarbot-warp`

### 3. Configurar variables de entorno
1. Una vez conectado, ve a la pestaña **"Variables"**
2. Agrega la variable de entorno:
   ```
   DISCORD_TOKEN = tu_token_del_bot_aqui
   ```
3. Haz clic en "Add" para guardar

### 4. Desplegar automáticamente
¡Eso es todo! Railway automáticamente:
- Detectará que es un proyecto Node.js
- Instalará las dependencias (`npm install`)
- Ejecutará el bot (`npm start`)

## 📊 Verificar que funciona

1. Ve a la pestaña **"Deployments"** en Railway
2. Deberías ver logs como:
   ```
   🟢 Bot IOSoccer conectado como BilarBot_v2#8603
   📅 Sistema de confirmación de partidos activo
   🔒 Control de roles activado
   ✅ Comandos slash registrados exitosamente
   ```

3. En Discord, tu bot debería aparecer **ONLINE** 🟢

## ⚙️ Configuración Adicional

### Mantener el bot activo 24/7
Railway mantiene tu bot corriendo automáticamente. Si se detiene por algún error, se reinicia solo.

### Ver logs en tiempo real
1. Ve a la pestaña **"Deployments"**
2. Haz clic en el deployment más reciente
3. Verás todos los logs del bot en tiempo real

### Actualizar el bot
Cada vez que hagas `git push` a tu repositorio de GitHub, Railway automáticamente:
1. Descarga los cambios
2. Reinstala dependencias si es necesario
3. Redespliega el bot

## 💡 Consejos Importantes

### ✅ DO (Hacer):
- Mantén tu token seguro y nunca lo compartas
- Usa la función de logs para debugging
- Actualiza tu código regularmente con `git push`

### ❌ DON'T (No hacer):
- No subas el archivo `.env` a GitHub (ya está protegido)
- No cambies los puertos (Railway maneja esto automáticamente)
- No uses `console.log` excesivamente (puede llenar los logs)

## 🆘 Solución de Problemas

### El bot no se conecta
```bash
Error: Invalid token
```
**Solución**: Verifica que el `DISCORD_TOKEN` en Railway sea correcto.

### Build falla
```bash
npm ERR! Cannot find module
```
**Solución**: Haz `git push` de tu `package-lock.json` actualizado.

### Bot se desconecta
```bash
Connection closed
```
**Solución**: Railway reiniciará automáticamente. Si persiste, revisa los logs.

## 📈 Monitoreo

### Métricas disponibles en Railway:
- **CPU Usage**: Uso de procesador
- **Memory Usage**: Uso de memoria
- **Network**: Tráfico de red
- **Deployment Status**: Estado del despliegue

### Tu bot está listo cuando veas:
```bash
🟢 Bot IOSoccer conectado como BilarBot_v2#8603
📅 Sistema de confirmación de partidos activo
✅ Comandos slash registrados exitosamente
```

## 💰 Costos

**¡Es GRATIS!** 🎉
- Railway ofrece $5 de crédito mensual gratuito
- Tu bot consume muy pocos recursos
- Perfecto para uso personal/comunidad

---

## 🎯 Resumen Rápido

1. **railway.app** → Start New Project
2. **GitHub repo** → Selecciona `bilarbot-warp`
3. **Variables** → Agrega `DISCORD_TOKEN`
4. **¡Listo!** → Tu bot estará online 24/7

¿Problemas? Revisa los logs en Railway o contacta soporte.

# 🚂 BilarBot en Railway - 3 Pasos Súper Fáciles

## 🎯 Tu bot online 24/7 en menos de 5 minutos

### Paso 1: Subir a GitHub
```bash
# Si no lo has hecho, sube tu código a GitHub:
git remote add origin https://github.com/TU_USUARIO/bilarbot-warp.git
git push -u origin master
```

### Paso 2: Desplegar en Railway
1. 🌐 Ve a **[railway.app](https://railway.app)**
2. 🔐 Inicia sesión con **GitHub**
3. ➕ Click **"Start a New Project"**
4. 📁 Selecciona **"Deploy from GitHub repo"**
5. 🎯 Elige tu repositorio **`bilarbot-warp`**

### Paso 3: Configurar Token
1. 📊 Ve a la pestaña **"Variables"** en Railway
2. ➕ Click **"New Variable"**
3. 🔑 Agrega:
   ```
   Name: DISCORD_TOKEN
   Value: [tu_token_del_bot_aqui]
   ```
4. 💾 Click **"Add"**

## ✅ ¡LISTO!

🤖 Tu bot estará **ONLINE** en Discord en 1-2 minutos  
📊 Ve a **"Deployments"** para ver los logs  
🟢 Deberías ver: `"Bot IOSoccer conectado como BilarBot_v2"`  

---

## 🔧 Si algo sale mal:

**❌ Error: "Invalid token"**
- Verifica que copiaste bien el token de Discord

**❌ Error: "Build failed"** 
- Asegúrate de haber subido todos los archivos con `git push`

**❌ Bot offline**
- Railway puede tardar 1-2 minutos en activarlo

---

## 💰 ¿Es gratis?

**¡SÍ!** 🎉 Railway da $5 mensuales gratis  
Tu bot consume ~$0.50/mes  
= 10 meses gratis garantizado

## 🔄 Actualizaciones automáticas

Cada vez que hagas `git push`, Railway:
1. Descarga los cambios
2. Reinstala si hay nuevas dependencias  
3. Reinicia el bot automáticamente

¡Tu bot siempre estará actualizado! 🚀

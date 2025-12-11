# 🤖 MineBot - Autonomous Minecraft Bot

Un bot de Minecraft completamente autónomo que utiliza un **LLM local (Ollama)** para tomar decisiones de alto nivel mientras juega survival por ti.

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![Mineflayer](https://img.shields.io/badge/Mineflayer-4.33-blue)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-purple)

## ⚡ Quick Start (TL;DR)

```bash
# 1. Instalar dependencias
npm install

# 2. Tener Ollama corriendo con un modelo
ollama serve                    # En una terminal
ollama pull llama3.2           # En otra terminal

# 3. Abrir Minecraft (1.20.4 o 1.21.4), crear mundo, Esc → Open to LAN

# 4. Editar el puerto en src/config.js
#    port: XXXXX  ← El número que apareció en Minecraft

# 5. Ejecutar el bot
npm start
```

---

## 🎯 Características

- **Arquitectura Híbrida**: Combina acciones reactivas (Mineflayer) con razonamiento deliberativo (LLM)
- **100% Local**: Usa Ollama, sin APIs de nube ni costos de tokens
- **Supervivencia Autónoma**: Recolecta recursos, craftea herramientas, pelea contra mobs
- **Modular**: Código separado en módulos para fácil extensión
- **Robusto**: Manejo de errores para evitar crashes

## 📋 Requisitos

| Requisito | Versión |
|-----------|---------|
| Node.js | 20+ (recomendado 22+) |
| Ollama | Última versión |
| Minecraft Java | **1.20.4** o **1.21.4** (ver nota abajo) |

### ⚠️ Versiones de Minecraft Soportadas

| Versión | Estado |
|---------|--------|
| 1.8 - 1.20.4 | ✅ Funciona |
| 1.21.1 - 1.21.4 | ✅ Funciona |
| 1.21.5+ | ❌ No soportado aún |

**Nota**: Si usás una versión muy nueva (1.21.10+), las librerías aún no la soportan. Usá **1.21.4** que es la más nueva compatible.

---

## 🚀 Instalación Paso a Paso

### Paso 1: Instalar dependencias del proyecto

```bash
cd MineBot
npm install
```

### Paso 2: Instalar Ollama

1. Descargá Ollama de: https://ollama.com/download
2. Instalalo (siguiente, siguiente, instalar)
3. Ollama se inicia automáticamente

### Paso 3: Descargar un modelo LLM

Abrí una terminal y ejecutá:

```bash
ollama pull llama3.2
```

Esto descarga ~2GB. Esperá a que termine.

### Paso 4: Verificar que Ollama funciona

```bash
ollama list
```

Deberías ver `llama3.2:latest` en la lista.

---

## 🎮 Cómo Ejecutar el Bot

### 1. Abrir Minecraft

1. Abrí Minecraft Java Edition
2. **Importante**: Usá versión **1.20.4** o **1.21.4** (creá una instalación en el Launcher si no la tenés)
3. Creá o cargá un mundo Survival
4. Presioná `Esc`
5. Click en **"Open to LAN"**
6. Click en **"Start LAN World"**
7. Mirá el chat, aparecerá algo como:
   ```
   Local game hosted on port 54321
   ```
8. **Anotá ese número** (el puerto)

### 2. Configurar el puerto

Abrí el archivo `src/config.js` y cambiá el puerto:

```javascript
export const BOT_CONFIG = {
    username: 'MineBot',
    host: 'localhost',
    port: 54321,        // ← PON TU PUERTO AQUÍ
    version: null,
    auth: 'offline',
};
```

### 3. Ejecutar el bot

```bash
npm start
```

### 4. ¡Listo!

Deberías ver en la consola:
```
✓ [SUCCESS] Ollama connection OK
✓ [SUCCESS] Bot logged in successfully
✓ [SUCCESS] Bot spawned in world
🧠 [BRAIN] Thinking...
🧠 [BRAIN] Decision: EXPLORE → random
```

**Entrá al juego y vas a ver al bot moviéndose!** 🎉

---

## 🔄 Cada vez que quieras usar el bot

1. **Abrir Minecraft** y cargar un mundo
2. **Open to LAN** y anotar el puerto
3. **Editar** `src/config.js` con el nuevo puerto
4. **Ejecutar** `npm start`

---

## 📁 Estructura del Proyecto

```
MineBot/
├── src/
│   ├── index.js          # Entry point y loop principal
│   ├── config.js         # ⭐ CONFIGURACIÓN (editar puerto aquí)
│   ├── core/
│   │   ├── brain.js      # Comunicación con Ollama LLM
│   │   ├── perception.js # Lee el estado del mundo
│   │   └── actions.js    # Ejecuta acciones (minar, craftear, etc)
│   └── utils/
│       └── logger.js     # Logs bonitos en consola
├── package.json
└── README.md
```

---

## 🧠 Cómo Funciona el Bot

### El Loop Cognitivo (cada 5 segundos)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ PERCIBE │───▶│ PIENSA  │───▶│  ACTÚA  │───▶│FEEDBACK │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │                                             │       │
│       └─────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

1. **PERCIBE**: Lee salud, inventario, bloques cercanos, mobs
2. **PIENSA**: Envía todo a Ollama → El LLM decide qué hacer
3. **ACTÚA**: Ejecuta la acción (minar, craftear, explorar, pelear)
4. **FEEDBACK**: Guarda si funcionó o falló para la próxima decisión

### Acciones que el Bot puede hacer

| Acción | Qué hace | Ejemplo |
|--------|----------|---------|
| `mine` | Mina un bloque | `oak_log`, `iron_ore`, `cobblestone` |
| `craft` | Craftea un item | `wooden_pickaxe`, `crafting_table` |
| `explore` | Camina buscando recursos | - |
| `fight` | Ataca un mob | `zombie`, `skeleton` |
| `eat` | Come comida | `bread`, `cooked_beef` |
| `chat` | Manda mensaje en chat | - |
| `wait` | Espera | - |

---

## ⚙️ Configuración

Todo está en `src/config.js`:

### Cambiar el modelo LLM

```javascript
export const OLLAMA_CONFIG = {
    model: 'llama3.2',     // Cambiar a 'mistral' o 'qwen2.5:7b'
    timeout: 60000,        // Aumentar si tu GPU es lenta
};
```

### Cambiar cada cuánto piensa

```javascript
export const BEHAVIOR_CONFIG = {
    thinkInterval: 5000,   // 5000ms = 5 segundos
};
```

### Ver más información de debug

```javascript
export const LOG_CONFIG = {
    debugLLM: true,        // Ver todo lo que manda/recibe de Ollama
    debugPerception: true, // Ver qué ve el bot
    debugActions: true,    // Ver qué hace el bot
};
```

---

## 🔧 Solución de Problemas

### "Cannot connect to Ollama"

Ollama no está corriendo. Abrí una terminal y ejecutá:
```bash
ollama serve
```

### "Model not found"

No descargaste el modelo:
```bash
ollama pull llama3.2
```

### "Unsupported protocol version"

Tu Minecraft es muy nuevo. Usá versión **1.20.4** o **1.21.4**.

### "ECONNRESET" o "ECONNREFUSED"

- Verificá que Minecraft esté abierto
- Verificá que el puerto en `config.js` sea correcto
- Verificá que hayas hecho "Open to LAN"

### El bot no hace nada / está quieto

- Mirá la consola, debería decir "Thinking..."
- Si dice errores de Ollama, verificá que esté corriendo
- Si el LLM tarda mucho, aumentá el timeout

---

## 📄 Licencia

MIT License - Usa este código como quieras.

---

**Made with ❤️ for Minecraft automation enthusiasts**

# 🤖 MineBot - Autonomous Minecraft Bot

Un bot de Minecraft completamente autónomo que utiliza un **LLM local (Ollama)** para tomar decisiones de alto nivel mientras juega survival por ti.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Mineflayer](https://img.shields.io/badge/Mineflayer-4.20-blue)
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-purple)

## 🎯 Características

- **Arquitectura Híbrida**: Combina acciones reactivas (Mineflayer) con razonamiento deliberativo (LLM)
- **100% Local**: Usa Ollama, sin APIs de nube ni costos de tokens
- **Supervivencia Autónoma**: Recolecta recursos, craftea herramientas, pelea contra mobs
- **Modular**: Código separado en módulos para fácil extensión
- **Robusto**: Manejo de errores para evitar crashes

## 📋 Requisitos

- **Node.js** 18 o superior
- **Ollama** instalado y corriendo
- **Minecraft** Java Edition (servidor o mundo singleplayer con LAN abierto)

## 🚀 Instalación

### 1. Clonar e instalar dependencias

```bash
git clone <tu-repo>
cd minebot
npm install
```

### 2. Instalar y configurar Ollama

```bash
# Instalar Ollama (Windows/Mac/Linux)
# Visita: https://ollama.ai/download

# Iniciar Ollama
ollama serve

# Descargar un modelo (en otra terminal)
ollama pull llama3.2
# O alternativamente:
ollama pull mistral
ollama pull qwen2.5:7b
```

### 3. Configurar el bot

Edita `src/config.js` según tu setup:

```javascript
// Conexión a Minecraft
export const BOT_CONFIG = {
    username: 'MineBot',      // Nombre del bot
    host: 'localhost',        // IP del servidor
    port: 25565,              // Puerto
    auth: 'offline'           // 'microsoft' para premium
};

// Modelo de Ollama
export const OLLAMA_CONFIG = {
    model: 'llama3.2',        // Modelo descargado
    timeout: 60000            // Timeout en ms
};
```

### 4. Abrir Minecraft al LAN

Para singleplayer:
1. Abre un mundo en Minecraft
2. Presiona `Esc` → `Open to LAN`
3. Habilita cheats si quieres
4. Click en `Start LAN World`
5. Anota el puerto mostrado (ej: 54321)
6. Actualiza `port` en `config.js`

## ▶️ Uso

```bash
# Iniciar el bot
npm start

# Modo desarrollo (auto-restart)
npm run dev
```

## 🧠 Cómo Funciona

### El Loop Cognitivo

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

1. **PERCIBE** (`perception.js`): Recolecta información del mundo
   - Salud, hambre, inventario
   - Bloques cercanos (minerales, madera)
   - Entidades (mobs hostiles, animales)
   - Bioma, hora del día

2. **PIENSA** (`brain.js`): Envía contexto a Ollama
   - El LLM decide la próxima acción
   - Responde con JSON estructurado

3. **ACTÚA** (`actions.js`): Ejecuta la decisión
   - Usa plugins de Mineflayer
   - Maneja errores gracefully

4. **FEEDBACK**: Registra resultado para la próxima iteración

### Acciones Disponibles

| Acción | Descripción | Ejemplo Target |
|--------|-------------|----------------|
| `mine` | Minar/recolectar bloques | `oak_log`, `iron_ore` |
| `craft` | Craftear items | `wooden_pickaxe`, `furnace` |
| `explore` | Explorar área nueva | `random` |
| `fight` | Atacar entidad hostil | `zombie`, `skeleton` |
| `eat` | Comer comida | `bread`, `cooked_beef` |
| `chat` | Enviar mensaje | `"Hello!"` |
| `wait` | Esperar | `idle` |

## 📁 Estructura del Proyecto

```
minebot/
├── src/
│   ├── index.js          # Entry point y loop principal
│   ├── config.js         # Configuración
│   ├── core/
│   │   ├── brain.js      # Comunicación con Ollama
│   │   ├── perception.js # Recolección de contexto
│   │   └── actions.js    # Ejecución de acciones
│   └── utils/
│       └── logger.js     # Sistema de logging
├── package.json
└── README.md
```

## ⚙️ Configuración Avanzada

### Cambiar Modelo de LLM

```javascript
// src/config.js
export const OLLAMA_CONFIG = {
    model: 'mistral',     // Más rápido, menos preciso
    // model: 'llama3.2',   // Balance
    // model: 'qwen2.5:7b', // Alternativa
};
```

### Ajustar Comportamiento

```javascript
// src/config.js
export const BEHAVIOR_CONFIG = {
    thinkInterval: 5000,  // Cada cuánto "piensa" (ms)
    pvp: {
        enabled: true,
        hostileMobs: ['zombie', 'skeleton', ...]
    },
    health: {
        critical: 6,      // Activar modo supervivencia
        hungry: 14        // Buscar comida
    }
};
```

### Debug

```javascript
// src/config.js
export const LOG_CONFIG = {
    debugLLM: true,        // Ver prompts/respuestas
    debugPerception: true, // Ver datos de percepción
    debugActions: true     // Ver ejecución de acciones
};
```

## 🔧 Troubleshooting

### "Cannot connect to Ollama"
```bash
# Verifica que Ollama esté corriendo
ollama serve
```

### "Model not found"
```bash
# Descarga el modelo
ollama pull llama3.2
```

### "Unexpected token in JSON"
El LLM está generando texto extra. Edita el System Prompt en `brain.js`:
```javascript
// Agrega esta línea al final del SYSTEM_PROMPT
"CRITICAL: Output ONLY the raw JSON. No text before or after."
```

### "Connection timeout"
Aumenta el timeout si tu GPU es lenta:
```javascript
export const OLLAMA_CONFIG = {
    timeout: 120000  // 2 minutos
};
```

### "ECONNREFUSED to Minecraft"
- Verifica que el servidor/LAN esté abierto
- Confirma IP y puerto en `config.js`

## 📝 Extender el Bot

### Agregar Nueva Acción

1. Agrega la acción al `SYSTEM_PROMPT` en `brain.js`
2. Crea el handler en `actions.js`:
```javascript
async function executeNewAction(bot, target) {
    // Tu lógica aquí
}
```
3. Agrega el case en `executeAction()`:
```javascript
case 'newaction':
    await executeNewAction(bot, target);
    result.success = true;
    break;
```

### Agregar Percepción

Edita `perception.js` para incluir más datos del mundo.

## 📄 Licencia

MIT License - Usa este código como quieras.

---

**Made with ❤️ for Minecraft automation enthusiasts**


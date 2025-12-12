# MineBot Mod - Baritone Edition

Este mod permite que el bot de IA controle Minecraft usando Baritone para pathfinding perfecto.

## Requisitos

- Minecraft Java Edition 1.21.4
- Fabric Loader 0.16.9+
- Java 21
- Baritone (se incluye como dependencia)

## Instalación

### 1. Instalar Fabric

1. Descarga el instalador de Fabric: https://fabricmc.net/use/installer/
2. Ejecuta el instalador y selecciona Minecraft 1.21.4
3. Haz clic en "Install"

### 2. Compilar el Mod

```bash
cd minecraft-mod
./gradlew build
```

El archivo `.jar` estará en `build/libs/minebot-mod-1.0.0.jar`

### 3. Instalar el Mod

1. Copia `minebot-mod-1.0.0.jar` a tu carpeta de mods:
   - Windows: `%APPDATA%\.minecraft\mods\`
   - Mac: `~/Library/Application Support/minecraft/mods/`
   - Linux: `~/.minecraft/mods/`

2. También necesitas instalar:
   - Fabric API: https://modrinth.com/mod/fabric-api
   - Baritone Fabric: https://github.com/cabaletta/baritone/releases

### 4. Ejecutar

1. Inicia Minecraft con el perfil de Fabric
2. Entra a un mundo (singleplayer o multiplayer)
3. El mod iniciará un servidor HTTP en el puerto 8080
4. Ejecuta el bot de IA:
   ```bash
   npm run start:baritone
   ```

## API HTTP

El mod expone estos endpoints:

### POST /command
Ejecuta un comando.

```json
{
  "action": "mine",
  "target": "diamond_ore",
  "reason": "Need diamonds"
}
```

Acciones disponibles:
- `mine` - Minar un tipo de bloque
- `goto` - Ir a coordenadas (x,y,z o x,z)
- `explore` - Explorar el mundo
- `follow` - Seguir a un jugador
- `stop` - Detener acción actual

### GET /status
Estado actual del bot.

### GET /position
Posición del jugador.

### GET /health
Salud y hambre.

### GET /inventory
Contenido del inventario.

## Comandos de Ejemplo

```bash
# Minar diamantes
curl -X POST http://localhost:8080/command \
  -H "Content-Type: application/json" \
  -d '{"action":"mine","target":"diamond_ore"}'

# Ir a coordenadas
curl -X POST http://localhost:8080/command \
  -H "Content-Type: application/json" \
  -d '{"action":"goto","target":"100,64,200"}'

# Seguir a un jugador
curl -X POST http://localhost:8080/command \
  -H "Content-Type: application/json" \
  -d '{"action":"follow","target":"Steve"}'
```

## Troubleshooting

### El mod no carga
- Verifica que tienes Fabric Loader instalado
- Verifica que Fabric API está en la carpeta mods
- Revisa los logs en `.minecraft/logs/latest.log`

### No puedo conectar desde Node.js
- Asegúrate de estar dentro de un mundo (no en el menú)
- Verifica que el puerto 8080 no está bloqueado
- Revisa la consola de Minecraft para errores


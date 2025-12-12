package com.minebot.mod;

import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/**
 * Controller that bridges our AI commands to Baritone (loaded at runtime)
 * 
 * Baritone is detected and used via reflection, allowing the mod to work
 * with any Baritone version installed by the user.
 */
public class BaritoneController {
    private String currentAction = "idle";
    private String currentTarget = "";
    private long actionStartTime = 0;
    
    // Baritone API access via reflection
    private Object baritoneInstance = null;
    private boolean baritoneAvailable = false;
    
    // Block name to Block mapping for mining
    private static final Map<String, Block> BLOCK_MAP = new HashMap<>();
    
    static {
        // Ores
        BLOCK_MAP.put("diamond_ore", Blocks.DIAMOND_ORE);
        BLOCK_MAP.put("deepslate_diamond_ore", Blocks.DEEPSLATE_DIAMOND_ORE);
        BLOCK_MAP.put("iron_ore", Blocks.IRON_ORE);
        BLOCK_MAP.put("deepslate_iron_ore", Blocks.DEEPSLATE_IRON_ORE);
        BLOCK_MAP.put("gold_ore", Blocks.GOLD_ORE);
        BLOCK_MAP.put("deepslate_gold_ore", Blocks.DEEPSLATE_GOLD_ORE);
        BLOCK_MAP.put("coal_ore", Blocks.COAL_ORE);
        BLOCK_MAP.put("deepslate_coal_ore", Blocks.DEEPSLATE_COAL_ORE);
        BLOCK_MAP.put("copper_ore", Blocks.COPPER_ORE);
        BLOCK_MAP.put("deepslate_copper_ore", Blocks.DEEPSLATE_COPPER_ORE);
        BLOCK_MAP.put("lapis_ore", Blocks.LAPIS_ORE);
        BLOCK_MAP.put("redstone_ore", Blocks.REDSTONE_ORE);
        BLOCK_MAP.put("emerald_ore", Blocks.EMERALD_ORE);
        
        // Wood
        BLOCK_MAP.put("oak_log", Blocks.OAK_LOG);
        BLOCK_MAP.put("birch_log", Blocks.BIRCH_LOG);
        BLOCK_MAP.put("spruce_log", Blocks.SPRUCE_LOG);
        BLOCK_MAP.put("jungle_log", Blocks.JUNGLE_LOG);
        BLOCK_MAP.put("acacia_log", Blocks.ACACIA_LOG);
        BLOCK_MAP.put("dark_oak_log", Blocks.DARK_OAK_LOG);
        BLOCK_MAP.put("mangrove_log", Blocks.MANGROVE_LOG);
        BLOCK_MAP.put("cherry_log", Blocks.CHERRY_LOG);
        
        // Stone
        BLOCK_MAP.put("stone", Blocks.STONE);
        BLOCK_MAP.put("cobblestone", Blocks.COBBLESTONE);
        BLOCK_MAP.put("deepslate", Blocks.DEEPSLATE);
        
        // Other
        BLOCK_MAP.put("crafting_table", Blocks.CRAFTING_TABLE);
        BLOCK_MAP.put("furnace", Blocks.FURNACE);
        BLOCK_MAP.put("chest", Blocks.CHEST);
        BLOCK_MAP.put("dirt", Blocks.DIRT);
        BLOCK_MAP.put("sand", Blocks.SAND);
        BLOCK_MAP.put("gravel", Blocks.GRAVEL);
    }
    
    public BaritoneController() {
        // Try to detect Baritone
        detectBaritone();
    }
    
    /**
     * Detect if Baritone is installed via reflection
     */
    private void detectBaritone() {
        try {
            Class<?> baritoneApiClass = Class.forName("baritone.api.BaritoneAPI");
            Method getProvider = baritoneApiClass.getMethod("getProvider");
            Object provider = getProvider.invoke(null);
            
            Method getPrimaryBaritone = provider.getClass().getMethod("getPrimaryBaritone");
            baritoneInstance = getPrimaryBaritone.invoke(provider);
            
            baritoneAvailable = true;
            MineBotMod.LOGGER.info("✓ Baritone detected and ready!");
        } catch (ClassNotFoundException e) {
            MineBotMod.LOGGER.warn("Baritone not found. Install Baritone for better pathfinding.");
            MineBotMod.LOGGER.warn("Download from: https://github.com/cabaletta/baritone/releases");
            baritoneAvailable = false;
        } catch (Exception e) {
            MineBotMod.LOGGER.error("Error detecting Baritone: " + e.getMessage());
            baritoneAvailable = false;
        }
    }
    
    /**
     * Called every game tick to update state
     */
    public void tick(MinecraftClient client) {
        if (!baritoneAvailable || baritoneInstance == null) return;
        
        try {
            // Check if Baritone is still running a process
            Method getPathingControlManager = baritoneInstance.getClass().getMethod("getPathingControlManager");
            Object pathingControlManager = getPathingControlManager.invoke(baritoneInstance);
            
            Method mostRecentInControl = pathingControlManager.getClass().getMethod("mostRecentInControl");
            Object optional = mostRecentInControl.invoke(pathingControlManager);
            
            Method isPresent = optional.getClass().getMethod("isPresent");
            boolean hasActiveProcess = (Boolean) isPresent.invoke(optional);
            
            if (!hasActiveProcess && !currentAction.equals("idle")) {
                MineBotMod.LOGGER.info("Action completed: " + currentAction + " -> " + currentTarget);
                currentAction = "idle";
                currentTarget = "";
            }
        } catch (Exception e) {
            // Ignore tick errors
        }
    }
    
    /**
     * Execute a command from the AI
     */
    public String executeCommand(String action, String target, String reason) {
        MineBotMod.LOGGER.info("Executing: " + action + " -> " + target + " (" + reason + ")");
        
        if (!baritoneAvailable) {
            return "{\"success\": false, \"error\": \"Baritone not installed. Please install Baritone mod.\"}";
        }
        
        try {
            switch (action.toLowerCase()) {
                case "mine":
                    return executeMine(target);
                    
                case "goto":
                    return executeGoto(target);
                    
                case "explore":
                    return executeExplore();
                    
                case "stop":
                    return executeStop();
                    
                case "follow":
                    return executeFollow(target);
                    
                default:
                    return "{\"success\": false, \"error\": \"Unknown action: " + action + "\"}";
            }
        } catch (Exception e) {
            MineBotMod.LOGGER.error("Command execution error", e);
            return "{\"success\": false, \"error\": \"" + e.getMessage() + "\"}";
        }
    }
    
    private String executeMine(String target) throws Exception {
        Block block = BLOCK_MAP.get(target.toLowerCase());
        
        if (block == null) {
            try {
                Identifier id = Identifier.of("minecraft", target.toLowerCase());
                block = Registries.BLOCK.get(id);
                if (block == Blocks.AIR) {
                    return "{\"success\": false, \"error\": \"Unknown block: " + target + "\"}";
                }
            } catch (Exception e) {
                return "{\"success\": false, \"error\": \"Unknown block: " + target + "\"}";
            }
        }
        
        currentAction = "mining";
        currentTarget = target;
        actionStartTime = System.currentTimeMillis();
        
        // Call Baritone mine via reflection
        Method getMineProcess = baritoneInstance.getClass().getMethod("getMineProcess");
        Object mineProcess = getMineProcess.invoke(baritoneInstance);
        
        Method mine = mineProcess.getClass().getMethod("mine", Block[].class);
        mine.invoke(mineProcess, (Object) new Block[]{block});
        
        return "{\"success\": true, \"action\": \"mine\", \"target\": \"" + target + "\"}";
    }
    
    private String executeGoto(String target) throws Exception {
        String[] parts = target.split(",");
        
        if (parts.length >= 2) {
            int x = Integer.parseInt(parts[0].trim());
            int z = parts.length == 2 ? Integer.parseInt(parts[1].trim()) : Integer.parseInt(parts[2].trim());
            int y = parts.length == 3 ? Integer.parseInt(parts[1].trim()) : 64;
            
            currentAction = "going_to";
            currentTarget = target;
            
            // Call Baritone goto via reflection
            Method getCustomGoalProcess = baritoneInstance.getClass().getMethod("getCustomGoalProcess");
            Object customGoalProcess = getCustomGoalProcess.invoke(baritoneInstance);
            
            // Create GoalBlock
            Class<?> goalBlockClass = Class.forName("baritone.api.pathing.goals.GoalBlock");
            Object goal = goalBlockClass.getConstructor(int.class, int.class, int.class).newInstance(x, y, z);
            
            // Set goal and path
            Class<?> goalClass = Class.forName("baritone.api.pathing.goals.Goal");
            Method setGoalAndPath = customGoalProcess.getClass().getMethod("setGoalAndPath", goalClass);
            setGoalAndPath.invoke(customGoalProcess, goal);
            
            return "{\"success\": true, \"action\": \"goto\", \"target\": \"" + target + "\"}";
        }
        
        return "{\"success\": false, \"error\": \"Invalid coordinates. Use: x,y,z or x,z\"}";
    }
    
    private String executeExplore() throws Exception {
        currentAction = "exploring";
        currentTarget = "world";
        
        MinecraftClient client = MinecraftClient.getInstance();
        int x = (int) client.player.getX();
        int z = (int) client.player.getZ();
        
        // Call Baritone explore via reflection
        Method getExploreProcess = baritoneInstance.getClass().getMethod("getExploreProcess");
        Object exploreProcess = getExploreProcess.invoke(baritoneInstance);
        
        Method explore = exploreProcess.getClass().getMethod("explore", int.class, int.class);
        explore.invoke(exploreProcess, x, z);
        
        return "{\"success\": true, \"action\": \"explore\"}";
    }
    
    private String executeStop() throws Exception {
        // Call Baritone cancel via reflection
        Method getPathingBehavior = baritoneInstance.getClass().getMethod("getPathingBehavior");
        Object pathingBehavior = getPathingBehavior.invoke(baritoneInstance);
        
        Method cancelEverything = pathingBehavior.getClass().getMethod("cancelEverything");
        cancelEverything.invoke(pathingBehavior);
        
        currentAction = "idle";
        currentTarget = "";
        
        return "{\"success\": true, \"action\": \"stop\"}";
    }
    
    private String executeFollow(String playerName) throws Exception {
        MinecraftClient client = MinecraftClient.getInstance();
        
        var targetPlayer = client.world.getPlayers().stream()
            .filter(p -> p.getName().getString().equalsIgnoreCase(playerName))
            .findFirst()
            .orElse(null);
        
        if (targetPlayer == null) {
            return "{\"success\": false, \"error\": \"Player not found: " + playerName + "\"}";
        }
        
        currentAction = "following";
        currentTarget = playerName;
        
        // Call Baritone follow via reflection
        Method getFollowProcess = baritoneInstance.getClass().getMethod("getFollowProcess");
        Object followProcess = getFollowProcess.invoke(baritoneInstance);
        
        // Create predicate for follow
        Method follow = followProcess.getClass().getMethod("follow", java.util.function.Predicate.class);
        follow.invoke(followProcess, (java.util.function.Predicate<?>) entity -> {
            try {
                Method getName = entity.getClass().getMethod("getName");
                Object name = getName.invoke(entity);
                Method getString = name.getClass().getMethod("getString");
                return getString.invoke(name).toString().equalsIgnoreCase(playerName);
            } catch (Exception e) {
                return false;
            }
        });
        
        return "{\"success\": true, \"action\": \"follow\", \"target\": \"" + playerName + "\"}";
    }
    
    /**
     * Get current status as JSON
     */
    public String getStatus() {
        long elapsed = currentAction.equals("idle") ? 0 : System.currentTimeMillis() - actionStartTime;
        
        return String.format(
            "{\"action\": \"%s\", \"target\": \"%s\", \"elapsed_ms\": %d, \"busy\": %s, \"baritone\": %s}",
            currentAction,
            currentTarget,
            elapsed,
            !currentAction.equals("idle"),
            baritoneAvailable
        );
    }
    
    /**
     * Get inventory as JSON
     */
    public String getInventoryJson() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) {
            return "{\"error\": \"Player not in world\"}";
        }
        
        PlayerInventory inv = client.player.getInventory();
        StringBuilder json = new StringBuilder("{\"items\": [");
        
        boolean first = true;
        for (int i = 0; i < inv.size(); i++) {
            ItemStack stack = inv.getStack(i);
            if (!stack.isEmpty()) {
                if (!first) json.append(",");
                first = false;
                
                String itemName = Registries.ITEM.getId(stack.getItem()).getPath();
                json.append(String.format(
                    "{\"slot\": %d, \"item\": \"%s\", \"count\": %d}",
                    i, itemName, stack.getCount()
                ));
            }
        }
        
        json.append("]}");
        return json.toString();
    }
    
    public boolean isBaritoneAvailable() {
        return baritoneAvailable;
    }
}

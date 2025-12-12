package com.minebot.mod;

import baritone.api.BaritoneAPI;
import baritone.api.IBaritone;
import baritone.api.pathing.goals.GoalBlock;
import baritone.api.pathing.goals.GoalXZ;
import baritone.api.pathing.goals.GoalNear;
import baritone.api.process.IBaritoneProcess;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller that bridges our AI commands to Baritone
 * 
 * Supports:
 * - mine: Mine specific blocks
 * - goto: Go to coordinates or find specific block
 * - explore: Explore the world
 * - stop: Stop current action
 * - craft: (future) Craft items
 */
public class BaritoneController {
    private String currentAction = "idle";
    private String currentTarget = "";
    private long actionStartTime = 0;
    
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
        BLOCK_MAP.put("deepslate_lapis_ore", Blocks.DEEPSLATE_LAPIS_ORE);
        BLOCK_MAP.put("redstone_ore", Blocks.REDSTONE_ORE);
        BLOCK_MAP.put("deepslate_redstone_ore", Blocks.DEEPSLATE_REDSTONE_ORE);
        BLOCK_MAP.put("emerald_ore", Blocks.EMERALD_ORE);
        BLOCK_MAP.put("deepslate_emerald_ore", Blocks.DEEPSLATE_EMERALD_ORE);
        
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
        BLOCK_MAP.put("granite", Blocks.GRANITE);
        BLOCK_MAP.put("diorite", Blocks.DIORITE);
        BLOCK_MAP.put("andesite", Blocks.ANDESITE);
        BLOCK_MAP.put("deepslate", Blocks.DEEPSLATE);
        
        // Other useful blocks
        BLOCK_MAP.put("crafting_table", Blocks.CRAFTING_TABLE);
        BLOCK_MAP.put("furnace", Blocks.FURNACE);
        BLOCK_MAP.put("chest", Blocks.CHEST);
        BLOCK_MAP.put("dirt", Blocks.DIRT);
        BLOCK_MAP.put("sand", Blocks.SAND);
        BLOCK_MAP.put("gravel", Blocks.GRAVEL);
    }
    
    public BaritoneController() {
        MineBotMod.LOGGER.info("BaritoneController initialized");
    }
    
    /**
     * Called every game tick to update state
     */
    public void tick(MinecraftClient client) {
        IBaritone baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
        
        // Check if Baritone is still running a process
        IBaritoneProcess active = baritone.getPathingControlManager().mostRecentInControl().orElse(null);
        if (active == null && !currentAction.equals("idle")) {
            // Action completed
            MineBotMod.LOGGER.info("Action completed: " + currentAction + " -> " + currentTarget);
            currentAction = "idle";
            currentTarget = "";
        }
    }
    
    /**
     * Execute a command from the AI
     */
    public String executeCommand(String action, String target, String reason) {
        MineBotMod.LOGGER.info("Executing: " + action + " -> " + target + " (" + reason + ")");
        
        IBaritone baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
        
        try {
            switch (action.toLowerCase()) {
                case "mine":
                    return executeMine(baritone, target);
                    
                case "goto":
                    return executeGoto(baritone, target);
                    
                case "explore":
                    return executeExplore(baritone);
                    
                case "stop":
                    return executeStop(baritone);
                    
                case "follow":
                    return executeFollow(baritone, target);
                    
                default:
                    return "{\"success\": false, \"error\": \"Unknown action: " + action + "\"}";
            }
        } catch (Exception e) {
            MineBotMod.LOGGER.error("Command execution error", e);
            return "{\"success\": false, \"error\": \"" + e.getMessage() + "\"}";
        }
    }
    
    private String executeMine(IBaritone baritone, String target) {
        Block block = BLOCK_MAP.get(target.toLowerCase());
        
        if (block == null) {
            // Try to find block by registry name
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
        
        // Use Baritone's mine command
        baritone.getMineProcess().mine(block);
        
        return "{\"success\": true, \"action\": \"mine\", \"target\": \"" + target + "\"}";
    }
    
    private String executeGoto(IBaritone baritone, String target) {
        // Parse coordinates: "x,y,z" or "x,z"
        String[] parts = target.split(",");
        
        try {
            if (parts.length == 3) {
                int x = Integer.parseInt(parts[0].trim());
                int y = Integer.parseInt(parts[1].trim());
                int z = Integer.parseInt(parts[2].trim());
                
                currentAction = "going_to";
                currentTarget = target;
                baritone.getCustomGoalProcess().setGoalAndPath(new GoalBlock(x, y, z));
                
            } else if (parts.length == 2) {
                int x = Integer.parseInt(parts[0].trim());
                int z = Integer.parseInt(parts[1].trim());
                
                currentAction = "going_to";
                currentTarget = target;
                baritone.getCustomGoalProcess().setGoalAndPath(new GoalXZ(x, z));
                
            } else {
                // Try to interpret as block name to find
                Block block = BLOCK_MAP.get(target.toLowerCase());
                if (block != null) {
                    currentAction = "finding";
                    currentTarget = target;
                    baritone.getMineProcess().mine(1, block); // Find 1 block
                    return "{\"success\": true, \"action\": \"find\", \"target\": \"" + target + "\"}";
                }
                return "{\"success\": false, \"error\": \"Invalid coordinates format. Use x,y,z or x,z\"}";
            }
            
            return "{\"success\": true, \"action\": \"goto\", \"target\": \"" + target + "\"}";
            
        } catch (NumberFormatException e) {
            return "{\"success\": false, \"error\": \"Invalid coordinates: " + target + "\"}";
        }
    }
    
    private String executeExplore(IBaritone baritone) {
        currentAction = "exploring";
        currentTarget = "world";
        
        baritone.getExploreProcess().explore(
            (int) MinecraftClient.getInstance().player.getX(),
            (int) MinecraftClient.getInstance().player.getZ()
        );
        
        return "{\"success\": true, \"action\": \"explore\"}";
    }
    
    private String executeStop(IBaritone baritone) {
        baritone.getPathingBehavior().cancelEverything();
        currentAction = "idle";
        currentTarget = "";
        
        return "{\"success\": true, \"action\": \"stop\"}";
    }
    
    private String executeFollow(IBaritone baritone, String playerName) {
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
        
        baritone.getFollowProcess().follow(entity -> 
            entity.getName().getString().equalsIgnoreCase(playerName)
        );
        
        return "{\"success\": true, \"action\": \"follow\", \"target\": \"" + playerName + "\"}";
    }
    
    /**
     * Get current status as JSON
     */
    public String getStatus() {
        long elapsed = currentAction.equals("idle") ? 0 : System.currentTimeMillis() - actionStartTime;
        
        return String.format(
            "{\"action\": \"%s\", \"target\": \"%s\", \"elapsed_ms\": %d, \"busy\": %s}",
            currentAction,
            currentTarget,
            elapsed,
            !currentAction.equals("idle")
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
}


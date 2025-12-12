package com.minebot.mod;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * MineBot Mod - AI Controller for Minecraft
 * 
 * This mod creates an HTTP server that receives commands from
 * the Node.js AI brain and executes them using Baritone.
 */
public class MineBotMod implements ClientModInitializer {
    public static final String MOD_ID = "minebot";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    
    private static MineBotMod instance;
    private HttpCommandServer httpServer;
    private BaritoneController baritoneController;
    
    @Override
    public void onInitializeClient() {
        instance = this;
        LOGGER.info("========================================");
        LOGGER.info("  MineBot AI Controller v1.0.0");
        LOGGER.info("  Powered by Baritone + Local LLM");
        LOGGER.info("========================================");
        
        // Initialize Baritone controller
        baritoneController = new BaritoneController();
        
        // Start HTTP server on port 8080
        httpServer = new HttpCommandServer(8080, baritoneController);
        httpServer.start();
        
        LOGGER.info("HTTP API server started on port 8080");
        LOGGER.info("Waiting for commands from AI brain...");
        
        // Register tick event to update status
        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
    }
    
    private void onClientTick(MinecraftClient client) {
        // Update baritone controller state
        if (baritoneController != null && client.player != null) {
            baritoneController.tick(client);
        }
    }
    
    public static MineBotMod getInstance() {
        return instance;
    }
    
    public BaritoneController getBaritoneController() {
        return baritoneController;
    }
}


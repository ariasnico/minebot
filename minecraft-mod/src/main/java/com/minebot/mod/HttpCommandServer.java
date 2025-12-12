package com.minebot.mod;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import net.minecraft.client.MinecraftClient;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

/**
 * HTTP Server that receives commands from the Node.js AI brain
 * 
 * Endpoints:
 * - POST /command  - Execute a command (mine, goto, craft, etc)
 * - GET /status    - Get current bot status
 * - GET /inventory - Get inventory contents
 * - GET /position  - Get player position
 */
public class HttpCommandServer {
    private final int port;
    private final BaritoneController baritone;
    private HttpServer server;
    
    public HttpCommandServer(int port, BaritoneController baritone) {
        this.port = port;
        this.baritone = baritone;
    }
    
    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.setExecutor(Executors.newFixedThreadPool(4));
            
            // Register endpoints
            server.createContext("/command", new CommandHandler());
            server.createContext("/status", new StatusHandler());
            server.createContext("/inventory", new InventoryHandler());
            server.createContext("/position", new PositionHandler());
            server.createContext("/health", new HealthHandler());
            
            server.start();
            MineBotMod.LOGGER.info("HTTP server listening on port " + port);
        } catch (IOException e) {
            MineBotMod.LOGGER.error("Failed to start HTTP server", e);
        }
    }
    
    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }
    
    /**
     * POST /command
     * Body: {"action": "mine", "target": "diamond_ore", "reason": "..."}
     */
    private class CommandHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Enable CORS
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
                return;
            }
            
            // Read request body
            String body = readRequestBody(exchange);
            MineBotMod.LOGGER.info("Received command: " + body);
            
            try {
                // Parse JSON manually (simple parsing)
                String action = extractJsonValue(body, "action");
                String target = extractJsonValue(body, "target");
                String reason = extractJsonValue(body, "reason");
                
                // Execute command via Baritone
                String result = baritone.executeCommand(action, target, reason);
                
                sendResponse(exchange, 200, result);
            } catch (Exception e) {
                MineBotMod.LOGGER.error("Command execution error", e);
                sendResponse(exchange, 500, "{\"success\": false, \"error\": \"" + e.getMessage() + "\"}");
            }
        }
    }
    
    /**
     * GET /status
     * Returns current bot status (idle, mining, moving, etc)
     */
    private class StatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            
            String status = baritone.getStatus();
            sendResponse(exchange, 200, status);
        }
    }
    
    /**
     * GET /inventory
     * Returns inventory contents as JSON
     */
    private class InventoryHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            
            MinecraftClient client = MinecraftClient.getInstance();
            if (client.player == null) {
                sendResponse(exchange, 503, "{\"error\": \"Player not in world\"}");
                return;
            }
            
            String inventory = baritone.getInventoryJson();
            sendResponse(exchange, 200, inventory);
        }
    }
    
    /**
     * GET /position
     * Returns player position
     */
    private class PositionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            
            MinecraftClient client = MinecraftClient.getInstance();
            if (client.player == null) {
                sendResponse(exchange, 503, "{\"error\": \"Player not in world\"}");
                return;
            }
            
            double x = client.player.getX();
            double y = client.player.getY();
            double z = client.player.getZ();
            
            String response = String.format(
                "{\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}",
                x, y, z
            );
            sendResponse(exchange, 200, response);
        }
    }
    
    /**
     * GET /health
     * Returns player health and hunger
     */
    private class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            
            MinecraftClient client = MinecraftClient.getInstance();
            if (client.player == null) {
                sendResponse(exchange, 503, "{\"error\": \"Player not in world\"}");
                return;
            }
            
            float health = client.player.getHealth();
            int food = client.player.getHungerManager().getFoodLevel();
            
            String response = String.format(
                "{\"health\": %.1f, \"maxHealth\": 20, \"food\": %d, \"maxFood\": 20}",
                health, food
            );
            sendResponse(exchange, 200, response);
        }
    }
    
    // Utility methods
    private String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        }
    }
    
    private void sendResponse(HttpExchange exchange, int code, String body) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
    
    private String extractJsonValue(String json, String key) {
        // Simple JSON value extraction (no external library needed)
        String searchKey = "\"" + key + "\"";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex == -1) return "";
        
        int colonIndex = json.indexOf(":", keyIndex);
        if (colonIndex == -1) return "";
        
        int valueStart = json.indexOf("\"", colonIndex);
        if (valueStart == -1) return "";
        
        int valueEnd = json.indexOf("\"", valueStart + 1);
        if (valueEnd == -1) return "";
        
        return json.substring(valueStart + 1, valueEnd);
    }
}


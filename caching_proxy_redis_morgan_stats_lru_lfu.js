#!/usr/bin/env node

const express = require("express");
const axios = require("axios");
const redis = require("redis");
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

// Parse CLI arguments
const argv = yargs
    .option("port", { alias: "p", type: "number", demandOption: true, describe: "Port to run the proxy server" })
    .option("origin", { alias: "o", type: "string", demandOption: true, describe: "Origin server URL" })
    .option("clear-cache", { type: "boolean", describe: "Clear Redis cache" })
    .option("eviction-policy", { alias: "e", type: "string", default: "allkeys-lru", describe: "Set eviction policy (lru/lfu)" })
    .help()
    .argv;

const PORT = argv.port;
const ORIGIN = argv.origin;
let evictionPolicy = argv["eviction-policy"]; // ✅ Now mutable

// Redis Client
// const redisClient = redis.createClient();
// If you are using redis outside redis (like in local machine), you can use the following code

const redisClient = redis.createClient({
    socket: {
        host: "host.docker.internal", // 🔥 Use this to connect to local Redis from inside Docker
        port: 6379
    }
});

redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

(async () => {
    try {
        await redisClient.connect();
        console.log("✅ Redis Connected!");

        if (argv["clear-cache"]) {
            await redisClient.flushAll();
            console.log("✅ Cache cleared.");
            process.exit(0);
        }

        await redisClient.configSet("maxmemory", "100mb");
        await redisClient.configSet("maxmemory-policy", evictionPolicy);
        console.log(`🛠️ Redis Eviction Policy set to: ${evictionPolicy}`);
    } catch (error) {
        console.error("❌ Redis Initialization Failed:", error);
    }
})();

const app = express();
app.use(express.json());

// Log requests to file
const logToFile = (message) => {
    fs.appendFileSync("logs.txt", `[${new Date().toISOString()}] ${message}\n`);
};

// Cache statistics
let totalRequests = 0, cacheHits = 0, cacheMisses = 0;
const updateStats = (type) => {
    totalRequests++;
    if (type === "HIT") cacheHits++;
    if (type === "MISS") cacheMisses++;
};

// Serve dashboard file
app.get("/", (req, res) => {
    const filePath = path.join(__dirname, "dashboard.html");
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.send("<h2>🛠️ Proxy Cache Server Running</h2>");
    }
});

// ✅ API to get cache statistics
app.get("/stats", async (req, res) => {
    try {
        const redisInfo = await redisClient.info();
        const redisMemoryUsage = redisInfo.match(/used_memory_human:(\d+\w+)/)?.[1] || "Unknown";

        const stats = {
            totalRequests, cacheHits, cacheMisses,
            hitRate: totalRequests ? (cacheHits / totalRequests).toFixed(2) : "0.00",
            redisMemoryUsage, evictionPolicy
        };

        if (req.query.filter && stats.hasOwnProperty(req.query.filter)) {
            return res.json({ [req.query.filter]: stats[req.query.filter] });
        }

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats", details: error.message });
    }
});

// ✅ API to dynamically switch between LRU and LFU
app.post("/set-eviction-policy", async (req, res) => {
    const { policy } = req.body;
    if (!["allkeys-lru", "allkeys-lfu"].includes(policy)) {
        return res.status(400).json({ error: "Invalid policy. Use 'allkeys-lru' or 'allkeys-lfu'." });
    }
    try {
        await redisClient.configSet("maxmemory-policy", policy);
        evictionPolicy = policy; // ✅ Now correctly updates global variable
        console.log(`🔄 Eviction Policy Updated to: ${policy}`);
        res.json({ message: `Eviction policy changed to ${policy}` });
    } catch (error) {
        res.status(500).json({ error: "Failed to update eviction policy", details: error.message });
    }
});

// ✅ Clear Cache
app.delete("/clear-cache", async (req, res) => {
    try {
        await redisClient.flushAll();
        res.json({ message: "Cache cleared successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear cache", details: error.message });
    }
});

// ✅ Proxy Middleware with Caching
app.use(async (req, res) => {
    const url = `${ORIGIN}${req.url}`;
    const ttl = req.query.ttl ? parseInt(req.query.ttl, 10) : 60;
    try {
        const cachedData = await redisClient.get(url);
        if (cachedData) {
            console.log(`[CACHE HIT] ${req.method} ${req.url}`);
            logToFile(`[CACHE HIT] ${req.method} ${req.url}`);
            updateStats("HIT");

            res.set("X-Cache", "HIT");
            return res.send(JSON.parse(cachedData));
        }

        console.log(`[CACHE MISS] ${req.method} ${req.url}`);
        logToFile(`[CACHE MISS] ${req.method} ${req.url}`);
        updateStats("MISS");

        const response = await axios.get(url, { responseType: "arraybuffer" });

        // Store in Redis with expiration
        await redisClient.setEx(url, ttl, JSON.stringify(response.data));

        res.set("X-Cache", "MISS");
        res.send(response.data);
    } catch (error) {
        console.log(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
        logToFile(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Caching proxy running at http://localhost:${PORT} -> ${ORIGIN}`);
});

#!/usr/bin/env node

const express = require("express");
const axios = require("axios");
const redis = require("redis");
const fs = require("fs");
const yargs = require("yargs");

// Parse CLI arguments
const argv = yargs
    .option("port", { alias: "p", type: "number", demandOption: true, describe: "Port to run the proxy server" })
    .option("origin", { alias: "o", type: "string", demandOption: true, describe: "Origin server URL" })
    .option("clear-cache", { type: "boolean", describe: "Clear Redis cache" })
    .help()
    .argv;

const PORT = argv.port;
const ORIGIN = argv.origin;

const app = express();

// Redis Client
const redisClient = redis.createClient();
redisClient.on("error", (err) => console.error("Redis Error:", err));

(async () => {
    await redisClient.connect();
    console.log("✅ Connected to Redis");

    // If clear-cache flag is passed
    if (argv["clear-cache"]) {
        await redisClient.flushAll();
        console.log("✅ Cache cleared successfully.");
        process.exit(0);
    }

    // Log requests to file
    const logToFile = (message) => {
        const timestamp = new Date().toISOString();
        fs.appendFileSync("logs.txt", `[${timestamp}] ${message}\n`);
    };

    // Cache statistics
    let totalRequests = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    // Function to update statistics
    const updateStats = (type) => {
        totalRequests++;
        if (type === "HIT") cacheHits++;
        if (type === "MISS") cacheMisses++;
    };

    // API to get cache statistics
    app.get("/stats", async (req, res) => {
        try {
            const redisInfo = await redisClient.info();
            const redisUsedMemory = redisInfo.match(/used_memory_human:(\d+\w+)/)?.[1] || "Unknown";
            
            res.json({
                totalRequests,
                cacheHits,
                cacheMisses,
                hitRate: totalRequests ? (cacheHits / totalRequests).toFixed(2) : "0.00",
                redisMemoryUsage: redisUsedMemory,
                
            })

            // const filter = req.query.filter;
            // let stats = {
            //     totalRequests,
            //     cacheHits,
            //     cacheMisses,
            //     hitRate: totalRequests ? (cacheHits / totalRequests).toFixed(2) : "0.00",

            // }
            // if(filter && stats.hasOwnProperty(filter)){
            //     return res.json({ [filter]: stats[filter] });;
            // }
            // res.json(response);

            
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch Redis stats", details: error.message });
        }
    });

    // Proxy Middleware with Caching
    app.use(async (req, res) => {
        const url = `${ORIGIN}${req.url}`;

        try {
            const cachedData = await redisClient.get(url);
            if (cachedData) {
                console.log(`[CACHE HIT] ${req.method} ${req.url}`);
                logToFile(`[CACHE HIT] ${req.method} ${req.url}`);
                updateStats("HIT");
                res.set("X-Cache", "HIT");
                return res.status(200).send(JSON.parse(cachedData));
            }

            console.log(`[CACHE MISS] ${req.method} ${req.url}`);
            logToFile(`[CACHE MISS] ${req.method} ${req.url}`);
            updateStats("MISS");

            const response = await axios.get(url, { responseType: "arraybuffer" });

            // Store in Redis with a 60-second expiration
            await redisClient.setEx(url, 60, JSON.stringify(response.data));

            res.set("X-Cache", "MISS");
            res.status(response.status).send(response.data);
        } catch (error) {
            console.log(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
            logToFile(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
            res.status(error.response?.status || 500).send(error.message);
        }
    });

    // Start Server
    app.listen(PORT, () => {
        console.log(`🚀 Caching proxy running at http://localhost:${PORT} and forwarding to ${ORIGIN}`);
    });
})();

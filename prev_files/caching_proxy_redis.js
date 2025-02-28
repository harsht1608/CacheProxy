#!/usr/bin/env node

const express = require("express");
const axios = require("axios");
const yargs = require("yargs");
const redis = require("redis");

const argv = yargs
  .option("port", { type: "number", describe: "Port to run the proxy server", demandOption: false })
  .option("origin", { type: "string", describe: "Origin server URL", demandOption: false })
  .option("clear-cache", { type: "boolean", describe: "Clear the cache", demandOption: false })
  .help().argv;

// Setup Redis Client
const redisClient = redis.createClient();
redisClient.connect();
redisClient.on("error", (err) => console.error("Redis Error:", err));

if (argv["clear-cache"]) {
  redisClient.flushAll().then(() => {
    console.log("Cache cleared!");
    process.exit(0);
  });
}

if (!argv.port || !argv.origin) {
  console.error("Usage: caching-proxy --port <number> --origin <url>");
  process.exit(1);
}

const app = express();
const PORT = argv.port;
const ORIGIN = argv.origin;

app.use(async (req, res) => {
  const url = `${ORIGIN}${req.url}`;

  try {
    // Check if response exists in Redis
    const cachedData = await redisClient.get(url);
    if (cachedData) {
      console.log(`Cache HIT for ${url}`);
      res.set("X-Cache", "HIT");
      return res.status(200).send(JSON.parse(cachedData));
    }

    console.log(`Cache MISS for ${url}`);
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Store in Redis with a 60-second expiration
    await redisClient.setEx(url, 60, JSON.stringify(response.data));

    res.set("X-Cache", "MISS");
    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Caching Proxy running on port ${PORT}, forwarding to ${ORIGIN}`);
});

#!/usr/bin/env node

const express = require("express");
const axios = require("axios");
const yargs = require("yargs");

const argv = yargs
  .option("port", { type: "number", describe: "Port to run the proxy server", demandOption: false })
  .option("origin", { type: "string", describe: "Origin server URL", demandOption: false })
  .option("clear-cache", { type: "boolean", describe: "Clear the cache", demandOption: false })
  .help().argv;

const cache = new Map();

if (argv["clear-cache"]) {
  cache.clear();
  console.log("Cache cleared!");
  process.exit(0);
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

  if (cache.has(url)) {
    console.log(`Cache HIT for ${url}`);
    const cachedResponse = cache.get(url);
    res.set(cachedResponse.headers);
    res.set("X-Cache", "HIT");
    return res.status(200).send(cachedResponse.data);
  }

  try {
    console.log(`Cache MISS for ${url}`);
    const response = await axios.get(url, { responseType: "arraybuffer" });

    const headers = { ...response.headers, "X-Cache": "MISS" };
    cache.set(url, { data: response.data, headers });

    res.set(headers);
    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Caching Proxy running on port ${PORT}, forwarding to ${ORIGIN}`);
});



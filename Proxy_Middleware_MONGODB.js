/*
Add this 💥⏩ to your main caching_proxy server for adding the MongoDB functionality ⏪💥
*/ 


/* ---------CODE---------

const { connectDB, Cache } = require("./db");

// Connect to MongoDB
connectDB();


*/






app.use(async (req, res) => {
    const url = `${ORIGIN}${req.url}`;
    const ttl = req.query.ttl ? parseInt(req.query.ttl, 10) : 60;

    try {
        // 🔹 Check Redis Cache First
        const cachedData = await redisClient.get(url);
        if (cachedData) {
            console.log(`[CACHE HIT - Redis] ${req.method} ${req.url}`);
            logToFile(`[CACHE HIT - Redis] ${req.method} ${req.url}`);
            updateStats("HIT");
            res.set("X-Cache", "HIT");
            return res.status(200).send(JSON.parse(cachedData));
        }

        // 🔹 Check MongoDB as a Backup Cache
        const mongoCache = await Cache.findOne({ url });
        if (mongoCache) {
            console.log(`[CACHE HIT - MongoDB] ${req.method} ${req.url}`);
            logToFile(`[CACHE HIT - MongoDB] ${req.method} ${req.url}`);
            updateStats("HIT");
            
            // Store in Redis for faster future access
            await redisClient.setEx(url, ttl, JSON.stringify(mongoCache.response));

            res.set("X-Cache", "HIT-MONGO");
            return res.status(200).send(mongoCache.response);
        }

        // 🔹 Fetch from Origin Server (Cache MISS)
        console.log(`[CACHE MISS] ${req.method} ${req.url}`);
        logToFile(`[CACHE MISS] ${req.method} ${req.url}`);
        updateStats("MISS");

        const response = await axios.get(url, { responseType: "arraybuffer" });

        // Store in Redis
        await redisClient.setEx(url, ttl, JSON.stringify(response.data));

        // Store in MongoDB for persistent caching
        await Cache.create({ url, response: response.data });

        res.set("X-Cache", "MISS");
        res.status(response.status).send(response.data);
    } catch (error) {
        console.log(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
        logToFile(`[ERROR] ${req.method} ${req.url} - ${error.message}`);
        res.status(error.response?.status || 500).send(error.message);
    }
});


// 🛠️ Final Steps
// Run MongoDB locally or use a cloud provider (like MongoDB Atlas).
// Start your Redis server if not already running.
// Run your server:
// bash
// Copy
// Edit
// node caching_proxy_redis_morgan_stats_LRU_LFU --port=5000 --origin=https://dummyjson.com
// Check Logs - You’ll see [CACHE HIT - Redis], [CACHE HIT - MongoDB], or [CACHE MISS].
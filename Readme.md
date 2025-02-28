🚀 Redis & MongoDB Caching Proxy with Docker
A high-performance caching proxy that integrates Redis (for in-memory caching), MongoDB (for persistent caching), and Docker for seamless deployment. This tool helps reduce API response times, lower backend load, and improve scalability.

🌟 Features
✅ Redis for Fast Caching – LRU/LFU eviction policy support
✅ MongoDB for Persistent Caching – Data stays even after a restart
✅ Docker Support – Run the entire system in isolated containers
✅ Flexible CLI Commands – Easily configure port, origin, and caching behavior
✅ Cache Statistics – Monitor cache hits, misses, and eviction policies
✅ Clear Cache on Demand – Flush Redis cache anytime
✅ Customizable Expiration (TTL) – Set cache expiry per request

📌 Installation
🔹 Clone the Repository
sh
Copy
Edit
git clone https://github.com/yourusername/caching-proxy.git  
cd caching-proxy  
🔹 Install Dependencies
sh
Copy
Edit
npm install  
🔹 Set Up Environment Variables
Create a .env file and configure the MongoDB connection:

ini
Copy
Edit
MONGO_URI=mongodb://localhost:27017/cacheDB
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=60
🏗️ Usage
🔹 Start the Proxy
Run the proxy with default settings:

sh
Copy
Edit
node index.js --port 5000 --origin "https://api.example.com"
🔹 Start with a Custom Eviction Policy
sh
Copy
Edit
node index.js --port 5000 --origin "https://api.example.com" --eviction-policy allkeys-lfu  
🔹 Clear Cache from Redis
sh
Copy
Edit
node index.js --clear-cache
🔹 Check Cache Statistics
sh
Copy
Edit
curl http://localhost:5000/stats  
🔹 Set a Custom TTL (Expiration) per Request
sh
Copy
Edit
curl "http://localhost:5000/api/data?ttl=120"  
🐳 Running with Docker
🔹 Build & Run the Docker Container
sh
Copy
Edit
docker-compose up --build -d  
🔹 Stop the Container
sh
Copy
Edit
docker-compose down  
🔹 Check Running Containers
sh
Copy
Edit
docker ps  
📊 API Endpoints
Method	Endpoint	Description
GET	/stats	Get cache statistics
POST	/set-eviction-policy	Change Redis eviction policy
DELETE	/clear-cache	Clear entire cache
🤝 Contributing
Feel free to submit PRs, report issues, or suggest enhancements!

📜 License
This project is licensed under the MIT License.
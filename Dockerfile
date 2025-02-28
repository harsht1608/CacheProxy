# 🛠 Base Image
FROM node:18-alpine

# 🛠 Set the working directory
WORKDIR /app

# 🛠 Copy package.json and package-lock.json
COPY package*.json ./

# 🛠 Install dependencies
RUN npm install

# 🛠 Copy the rest of the application
COPY . .

# 🛠 Expose the port (ensure it's the same as in your app)
EXPOSE 3000

# 🛠 Start the application
CMD ["node", "caching_proxy_redis_morgan_stats_lru_lfu", "--port=3000", "--origin=http://dummyjson.com"]

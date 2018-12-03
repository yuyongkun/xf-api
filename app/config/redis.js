module.exports = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  keyPrefix: process.env.REDIS_KEY_PREFIX || '_adm:'

  // for more options see https://www.npmjs.com/package/redis
}
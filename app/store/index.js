const CacheStore = require('../utils/cache-store')
const DBStore = require('../utils/db-store')

const config = {
  redis: require('../config/redis'),
  mongo: require('../config/mongo')
}

module.exports = Object.assign({
  db: new DBStore({
    url: config.mongo.url
  }),
  cache: new CacheStore({
    host: config.redis.host,
    port: config.redis.port,
    keyPrefix: config.redis.keyPrefix
  })
}, ...[
  './admins.store',
  './shop.store',
  './product.store',
  './wx.store',
  './users.store',
  './order.store',
  './ticket.store',
  './staff.store',
  './category.store',
  './ticket-check.store',
  './appointment.store',
  './coupons.store',
  './comment.store',
].map(ext => require(ext)))

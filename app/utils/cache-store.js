const logger = require('../lib/log-console')

const redis = require('redis')
const util = require('util')

class CacheStore {
  constructor({ host, port, keyPrefix, config = {} }) {
    this.host = host
    this.port = port
    this.keyPrefix = keyPrefix || ''
    this.config = {}
    this.config.prefix = config.prefix || ''
    this.__client = null
  }

  _client() {
    if (!this.__client) {
      logger.log('creating client: prefix=%s', this.keyPrefix)
      this.__client = redis.createClient({
        host: this.host,
        port: this.port,
        prefix: this.keyPrefix,
        // no retry, throw error asap
        retry_strategy: (options) => options.error
      })
      this.__client.on('error', (err) => {
        logger.error('Redis client error:', err)
      })
      this.__client._get = util.promisify(this.__client.get)
      this.__client._set = util.promisify(this.__client.set)
      this.__client._del = util.promisify(this.__client.del)
      this.__client._blpop = util.promisify(this.__client.blpop)
      this.__client._lpush = util.promisify(this.__client.lpush)
      logger.log('client created.')
    }
    return this.__client
  }

  /**
   * Gets a value from the cache by the specified key.
   * 
   * Returns `undefined` if the key does not exists. Otherwise returns an existing value (including `null`).
   * 
   * @param {string} key key to the object
   */
  async get(key) {
    key = key || ''
    let client = this._client()
    logger.log('[>>] GET %s%s', this.config.prefix, key)
    let value = await client._get(key)
    if (value === null) {
      logger.log('[OK] GET %s%s = (nil)', this.config.prefix, key)
      return undefined
    }
    logger.log('[OK] GET %s%s = %s', this.config.prefix, key, value)
    if (typeof value === 'string') {
      switch (value.slice(0, 1)) {
        case '$':
          value = value.slice(1)
          break
        case '@':
          value = JSON.parse(value.slice(1))
          break
        default:
          // unexpected value
          value = undefined
      }
    }
    return value
  }

  async set(key, value, { ttl = 0 } = {}) {
    key = key || ''
    let client = this._client()
    if (typeof value === 'undefined') {
      // undefined will cause set command to fail
      // cache a null value instead
      value = null
    }

    if (typeof value === 'string' || value instanceof Buffer) {
      value = '$' + value.toString()
    } else {
      value = '@' + JSON.stringify(value)
    }
    let args = [key, value]
    ttl = parseInt(ttl, 10)
    if (ttl) {
      args = args.concat(['EX', ttl])
    }
    logger.log('[>>] SET %s%s = %s (ttl=%s)', this.config.prefix, key, value, ttl || 'N/A')
    await client._set(...args)
    logger.log('[OK] SET %s%s', this.config.prefix, key)
  }

  async del(key) {
    key = key || ''
    let client = this._client()
    logger.log('DEL %s%s', this.keyPrefix, key)
    await client._del(key)
  }

  async blpop(key) {
    key = key || ''
    let client = this._client()
    logger.log('BLPOP %s%s', this.keyPrefix, key)
    let item = await client._blpop(key)
    logger.log('BLPOP (OK): %s%s=%s', this.keyPrefix, key, item)
    return item !== null && item !== undefined ? JSON.parse(item) : item
  }

  async lpush(key, ...values) {
    let client = this._client()
    values = values.map(value => JSON.stringify(value))
    let args = [key, ...values]
    logger.log('LPUSH %o', args)
    await client._lpush(...args)
  }

}

module.exports = CacheStore


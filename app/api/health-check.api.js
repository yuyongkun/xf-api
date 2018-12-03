const logger = require('../lib/log-console')

const store = require('../store')


const handler = {
  
    checkCount: 0,
    passCount: 0,
  
    async handleHealthCheckRequest(ctx) {
      let status = await handler._getSystemStatus()
  
      if (status.all !== 'pass') {
        ctx.status = 500
      }
  
      ctx.body = status
    },
  
    async _getSystemStatus() {
  
      handler.log()
  
      let status = {
        db: 'pass',
        cache: 'pass',
        all: 'pass'
      }
  
      try {
        await store.db.checkConnection()
      } catch (err) {
        logger.error('Data Store check failed:', err)
        status.db = 'failed'
        status.all = 'failed'
      }
  
      try {
        await store.cache.get('.health-check/cn-api-server')
      } catch (err) {
        logger.error('Cache Store check failed:', err)
        status.cache = 'failed'
        status.all = 'failed'
      }
  
      handler.log(status)
  
      return status
    },
  
    log(status) {
      if (!status) {
        // check start
        handler.checkCount += 1
        logger.info('Checking #%d...', handler.checkCount)
      } else {
        // check finish
        logger.info('Result: %j', status)
        if (status.all === 'pass') {
          handler.passCount += 1
          if (handler.passCount > 10) {
            logger.info('Passed more than 10 times. Service should be in a steady state now.')
            handler.log = () => { }
          }
        }
      }
    },
  
  }
  
  
  module.exports = handler
  
  
  
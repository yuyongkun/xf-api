const morgan = require('koa-morgan')

morgan.token('x-forward-for', (req) => {
  return req.headers['x-forward-for'] || '-'
})

const logFormat = [
  ':x-forward-for',
  '-',
  ':remote-user',
  '[:date[clf]]',
  '":method :url HTTP/:http-version"',
  ':response-time',
  ':status',
  ':res[content-length]',
  '":referrer"',
  '":user-agent"'
].join(' ')


module.exports = morgan(logFormat, {
  skip: (req) => {
    // skip logging while testing to make test output clear
    return process.env.NODE_ENV === 'test'
      // skip logging for health check API because it will be called frequently by load balancers
      || req.url === '/health-check'
  }
})
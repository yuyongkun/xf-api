const Koa = require('koa')

const RequestLogger = require('./lib/request-logger')
const console = require('./lib/log-console')

const { notFound } = require('./middlewares/fallback')

const apiMiddleware = require('./api')
const serve = require('koa-static');
const app = new Koa()

// trust proxy fields such as 'X-Forwarded-For'
app.proxy = true

app.name = '<%= appname %>'
app.use(serve(path.join(__dirname)+'/public/'))
// request logger
app.use(RequestLogger)

app.use(apiMiddleware)

app.use(notFound)

module.exports = app

// Run as main script
if (require.main === module) {
  runAsMain()
}

function runAsMain() {
  // Get port config from environment variables
  const DEFAULT_PORT = 9996
  const port = parseInt(process.env.PORT, 10) || DEFAULT_PORT
  
  app.listen(port)
  console.log(`Server is running on port ${port}`)

  // log env args
  ;['DEBUG', 'MONGODB_URL', 'REDIS_HOST', 'INDEX_PAGE_FILE_LOCATION'].forEach(key => {
    console.log(`${key} = ${process.env[key]}`)
  })
}

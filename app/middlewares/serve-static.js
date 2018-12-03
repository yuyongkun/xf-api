const path = require('path')
const fs = require('fs')
const serve = require('koa-static')

let UPLOAD_DIR = '/data/uploaded-files'
if (process.env.NODE_ENV === 'development') {
  UPLOAD_DIR = path.join(__dirname, '../../upload')
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR)
  }
}

module.exports.serveStatic = serve(UPLOAD_DIR)

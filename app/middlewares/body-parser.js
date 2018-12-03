const path = require('path')
const fs = require('fs')
const BodyParser = require('koa-bodyparser')
const koaBody = require('koa-body')
const XMLParser = require('koa-xml-body')

const { getUploadDir } = require('../utils')


let UPLOAD_DIR = getUploadDir()


module.exports = {
  restrictJson: async (ctx, next) => {
    if (['PUT', 'POST'].includes(ctx.request.method)) {
      ctx.assert(ctx.is('json'), 400, 'Invalid Content Type: Only JSON Allowed')
    }
    await next()
  },
  parseBody: koaBody({
    multipart: true,
    formidable: {
      uploadDir: UPLOAD_DIR,
      keepExtensions: true
    },
  }),
  parseXml: XMLParser()
}

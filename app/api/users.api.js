const logger = require('../lib/log-console')

const fs = require('fs')
const axios = require('axios')

const { wxGetMediaUrl } = require('../config/app')
const { random, getWxMediaFilename, getUploadDir } = require('../utils')
const store = require('../store')
const UPLOAD_DIR = getUploadDir()


module.exports = {

  async handleGetUser (ctx) {
    let user = ctx.state.user
    ctx.body = { data: { user } }
  },
 async handleGetUser2 (ctx) {
    let user = ctx.state.user
    ctx.body = { data: { user } }
  },
  async handleUpdateHairPhotos (ctx, openid) {
    let { hairPhotos } = ctx.request.body
    await store.updateUserHairPhotos(openid, hairPhotos)
    ctx.body = { data: {} }
  },

  async handleDownloadUserWxMedia (ctx) {
    let { mediaId } = ctx.params
    const access_token = await store.getWxAccessToken()
    const resp = await axios({
      method: 'get',
      url: wxGetMediaUrl,
      params: { access_token, media_id: mediaId },
      responseType: 'arraybuffer'
    })

    logger.log('resp from wx, status: %s, headers: %j', resp.status, resp.headers)
    let filename = getWxMediaFilename(resp.headers['content-disposition'])
    fs.writeFileSync(`${UPLOAD_DIR}/${filename}`, resp.data)

    ctx.body = { data: { url: `/uploaded-files/${filename}` } }
  },

  async listUserOrder (ctx) {
    let { openid } = ctx.params
    let orders = await store.listOrderByOpenidWithPaging(openid, 5, 0)

    let items = []
    for (let order of orders) {
      let item = {}
      let { apmId } = order
      if (!apmId) continue

      item.price = order.total
      item.servedTime = order.creationTime

      let services = await store.listServiceCaseByApmId(apmId)
      let _services = []
      for (let service of services) {
        let s = { assistant: '', haircut: '', perm: '', category: service.category, servId: service.servId }
        if (service.assistant) {
          let assistant = await store.getStaff(service.assistant)
          s.assistant = assistant ? assistant.nickname : ''
        }
        if (service.haircut) {
          let haircut = await store.getStaff(service.haircut)
          s.haircut = haircut ? haircut.nickname : ''
        }
        if (service.perm) {
          let perm = await store.getStaff(service.perm)
          s.perm = perm ? perm.nickname : ''
        }
        _services.push(s)
      }
      item.services = _services
      items.push(item)
    }
    ctx.body = { data: { orders: items } }
  }

}
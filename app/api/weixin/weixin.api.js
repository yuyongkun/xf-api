const fs = require('fs')
const axios = require('axios')

const logger = require('../../lib/log-console')

const { 
  wxAppid,
  wxJSAPIList,
  wxToken,
  wxEncodingAESKey,
  wxCreateMenuUrl,
  wxGetMediaUrl,

  wxRateMsgTmplId,
  wxRateRemindMsgTmplId
} = require('../../config/app')

const { CATEGORY_NAME } = require('../../config/constants')

const { sha1, random, getUploadDir, getWxMediaFilename } = require('../../utils')

const store = require('../../store/')
const eventHandler = require('./wx-event-handler')

const sendWxMsg = require('./wx-msg-helper')

const UPLOAD_DIR = getUploadDir()


module.exports = {
  async handleAccessRequest (ctx) {
    const { signature, timestamp, nonce, echostr } = ctx.query

    logger.log('handling weixin access request, params: %j', ctx.query)
    if (signature !== sha1([timestamp, nonce, wxToken].sort().join(''))) {
      logger.log('weixin access failed')
      ctx.status = 403
      return
    }

    ctx.body = echostr
  },

  async receiveWxMsg (ctx) {
    const body = ctx.request.body.xml
    logger.log('received wx msg %j', body)

    let msgType = body.MsgType[0]
    if (body.Event) {
      let event = body.Event[0]
      if (msgType === 'event' && eventHandler[event]) {
        await eventHandler[event](body)
      }
    }

    ctx.body = ''
  },

  async handleGetAccessToken (ctx) {
    const token = await store.getWxAccessToken()
    ctx.body = token
  },

  async handleCreateMenu (ctx) {
    const access_token = await store.getWxAccessToken()
    const resp = await axios({
      method: 'post',
      url: wxCreateMenuUrl,
      params: { access_token },
      data: ctx.request.body
    })
    ctx.body = resp.data
  },

  async handleGetJSConfig (ctx) {
    // inject js-sdk config
    let jsTicket = await store.getJSTicket()
    let noncestr = random(20)
    let _timestamp = timestamp('s') // seconds
    let signature = sha1(`jsapi_ticket=${jsTicket}&noncestr=${noncestr}&timestamp=${_timestamp}&url=${url}`)
    let wxConfig = {
      debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
      appId: wxAppid, // 必填，公众号的唯一标识
      timestamp: _timestamp, // 必填，生成签名的时间戳
      nonceStr: noncestr, // 必填，生成签名的随机串
      signature: signature,// 必填，签名，见附录1
      jsApiList: wxJSAPIList // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
    }
    ctx.body = { data: wxConfig }
  },

  async handlePayNotify (ctx) {
    logger.log('Weixin pay notify: %j', ctx.request.body)
    let body = ctx.request.body
    let openid = body.xml.openid[0]

    try {
      await updateOrderPaidStatus(openid)
    } catch (e) {
      logger.log('update order status error', e)
    }

    ctx.body = 'ok'
  },

  async handleDownloadWxMedia (ctx) {
    let { mediaId } = ctx.params
    const access_token = await store.getWxAccessToken()
    const resp = await axios({
      method: 'get',
      url: wxGetMediaUrl,
      params: { access_token, media_id: mediaId },
      responseType: 'arraybuffer'
    })

    let filename = getWxMediaFilename(resp.headers['content-disposition'])
    fs.writeFileSync(`${UPLOAD_DIR}/${filename}`, resp.data)

    ctx.body = { data: { url: `/uploaded-files/${filename}` } }
  }

}

async function updateOrderPaidStatus (openid) {
  logger.log('[>>] update order paid status')
  let orderPaidStatusLocked = await store.isOrderPaidStatusLocked(openid)
  if (orderPaidStatusLocked) {
    logger.log('[ABORT] update order paid status. reason: paid status is locked')
    return
  }

  let order = await store.findLatestOrderByOpenid(openid)
  if (!order || order.paid) {
    logger.log('[ABORT] update order paid status. reason: paid status is updated')
    return
  }

  // update order status
  await store.updateOrderPayStatus(order.orderId, true)
  await store.updatePendingOrderPaidStatus(order.orderId, true, 'user')

  // update pay msg status
  let shop = await store.getShopInfo(order.shopId)
  let appointment = await store.updateAppointmentPaidStatus(order.apmId, true)
  let staff = await store.getStaffInfo(appointment.staffId)
  await updateServiceCasesPaidStatus(order.apmId, order.orderId, order.couponIds)

  await store.updatePayNotification(order.msgId, true, order.orderId, order.oriTotal, order.total, order.couponId)

  try {
    // 下发微信消息
    let ids = [order.shopId, order.apmId].join('-')
    let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_base&state=rate-apm-${ids}#wechat_redirect`
    // {{first.DATA}}
    // 服务项目：{{keyword1.DATA}}
    // 美容师：{{keyword2.DATA}}
    // {{remark.DATA}}
    await sendWxMsg(order.openid, wxRateRemindMsgTmplId, {
      first: { value: '很高兴为您提供本次服务，我们邀你对本次服务进行评价！评价后还可以领取积分哦~' },
      keyword1: { value: order.categories.map(c => CATEGORY_NAME[c]).join('、') },
      keyword2: { value: staff ? staff.nickname : '' },
      remark: { value: `本次服务由${shop.name}为您提供，请您在10天内提交评论，过期系统自动好评哟~\n\n让发型更出色，让生活更精彩` },
    }, msgUrl)
  } catch (e) {
    logger.error('send rate remind msg failed', e)
  }

  logger.log('[OK] update order paid status.')
}

async function updateServiceCasesPaidStatus (apmId, orderId, couponIds = []) {
  let serviceCases = await store.listServiceCaseByApmId(apmId)
  let coupons = []
  for (let couponId of couponIds) {
    let coupon = await store.getCouponByCouponId(couponId)
    if (coupon) { coupons.push(coupon) }
  }

  for (let c of serviceCases) {
    c.couponIds = []
    c.couponAmount = 0
    c.orderId = orderId
    c.paid = true

    let indexToDelete = []
    for (let i = 0; i < coupons.length; i++) {
      let x = coupons[i]
      if (x.category === '' || x.category === c.category) {
        indexToDelete.push(i)
        c.couponIds.push(x.couponId)
        c.couponAmount += x.amount
      }
    }

    let actualPrice = c.price - c.couponAmount
    c.actualPrice = actualPrice > 0 ? actualPrice : 0

    // 删除已经参与过优惠计算的优惠券，避免重复计算优惠
    indexToDelete.forEach(index => {
      coupons.splice(index, 1)
    })

    await store.updateServiceCase(c)
  }
}

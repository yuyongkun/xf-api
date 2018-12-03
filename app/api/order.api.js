const logger = require('../lib/log-console')

const axios = require('axios')

const {
  random,
  js2xml,
  xml2js,
  getUnifiedOrderSignStr,
  getJSAPIPaySign,
  timestamp,
  generateQRCode,
  getQRCodeUrl,
  md5
} = require('../utils/')
const {
  wxAppid,
  wxAPIKey,
  wxMerchantId,
  wxUnifiedOrderUrl,
  wxNotifyUrl,
  wxPaySignType,

  wxRateRemindMsgTmplId,

  productCategory,
} = require('../config/app')
const { CATEGORY_NAME } = require('../config/constants')
const sendWxMsg = require('./weixin/wx-msg-helper')

const store = require('../store/')

// 处理订单优惠券
const handleOrderCoupon = async function (ctx, order)  {
  if (!order.couponIds || !order.couponIds.length) {
    return
  }
  let disamount = 0
  let currentTime = Date.now()
  for (let couponId of order.couponIds) {
      let coupon = await store.getUserCoupon(order.openid, couponId)
      ctx.assert(coupon, 404)                                               // 不存在
      ctx.assert(!coupon.used, 409)                                         // 已使用
      ctx.assert(currentTime <= coupon.endTime, 409)                        // 过期
      ctx.assert(currentTime >= coupon.activeTime, 409)                     // 未生效
      ctx.assert(order.oriTotal >= coupon.lowerLimit, 409)                  // 未满金额
      ctx.assert(currentTime >= coupon.activeTime, 409)                     // 未生效
      ctx.assert(coupon.shopId === order.shopId, 409)                       // 非该门店券
      if (coupon.type ===2 && typeof order.category == 'string') {
        ctx.assert(coupon.category === order.category, 409)                 // 非该分类券
      }
      disamount += coupon.amount   
  }
  order.useCoupon = true
  order.disamount = disamount > order.oriTotal ? order.oriTotal : disamount     // 处理订单金额 1 元，但使用了 4 元的优惠券这种情况
  order.coupons = order.couponIds
}


module.exports = {
  async handleCreateOrder (ctx) {
    let { openid } = ctx.state.user
    let order = ctx.request.body
    logger.log('order submitted: %j', order)

    order.openid = openid

    let user = ctx.state.user
    let clientIP = ctx.request.headers['x-forward-for']

    let locked = await store.isOrderLocked(openid, order.msgId)
    if (locked) {
      ctx.throw(409)
    }
    let msgId = order.msgId
    await store.lockOrder(openid, msgId)

    // prevent multi orders for one pay msg
    if (msgId) {
      let msgId = order.msgId
      let oldOrder = await store.getOrderByMsgId(msgId)
      if (oldOrder) {
        ctx.body = { data: { order: oldOrder } }
        return
      }
    }

    // 优惠券管道
    await handleOrderCoupon(ctx, order)

    order.creationTime = Date.now()
    order.deleted = false
    order.cancelled = false
    order.userid = user.userid
    order.paid = false
    order.orderId = random(32)

    let noncestr = random(32)
    let body = '爱O2-支付测试'
    let wxOrderData = {
      appid: wxAppid,
      openid,
      mch_id: wxMerchantId,
      nonce_str: noncestr,
      body: body,
      out_trade_no: order.orderId,
      total_fee: order.total,
      spbill_create_ip: clientIP,
      notify_url: wxNotifyUrl,
      trade_type: 'JSAPI'
    }
    let sign = getUnifiedOrderSignStr(wxOrderData, wxAPIKey)
    wxOrderData.sign = sign
    let resp = await axios({
      method: 'post',
      url: wxUnifiedOrderUrl,
      data: js2xml(wxOrderData)
    })

    let respStatus = resp.status
    logger.log('resp from wx. status: %s, data: %j', respStatus, resp.data)
    let respJSON = (await xml2js(resp.data)).xml
    ctx.assert(respStatus === 200 && respJSON.return_code[0] === 'SUCCESS', 500)

    // appId, timeStamp, nonceStr, package, signType
    let signFields = {
      appId: wxAppid,
      timeStamp: timestamp('s'),
      nonceStr: random(32),
      'package': `prepay_id=${respJSON.prepay_id[0]}`, // package is a reserved word in strict mode
      signType: wxPaySignType
    }
    let jsapiPaySign = getJSAPIPaySign(signFields, wxAPIKey)

    order.paySign = jsapiPaySign
    delete signFields.appId
    order.signFields = signFields
    order.noncestr = noncestr
    await store.createOrder(order)
    await createPendingOrder(order)

    if (order.couponIds) {
      for (let couponId of order.couponIds) {
        await store.updateUserCoupon(openid, couponId)
      }
    }

    ctx.body = { data: { order } }
  },

  async handleGetOrder (ctx) {
    let { orderId } = ctx.params
    let order = await store.getOrder(orderId)
    let notDeleted = typeof order.deleted === 'undefined' || !order.deleted
    ctx.assert(notDeleted, 404)
    ctx.body = { data: { order } }
  },

  async getOrderByMsgId (ctx) {
    let { msgId } = ctx.params
    let { openid } = ctx.state.user
    let order = await store.getOrderByMsgId(openid, msgId)
    ctx.assert(order, 404)
  },

  async handleDelOrder (ctx) {
    let { orderId } = ctx.params
    await store.delOrder(orderId)
    ctx.body = { data: {} }
  },
  
  async handleCancelOrder (ctx) {
    let { orderId } = ctx.params
    await store.cancelOrder(orderId)
    ctx.body = { data: {} }
  },

  async handleListOrderByOpenid (ctx) {
    let { openid } = ctx.state.user
    let orders = await store.listOrderByOpenid(openid)
    ctx.body = { data: { orders } }
  },

  async handlePayOk (ctx) {
    let { orderId } = ctx.params
    await store.updateOrderPayStatus(orderId, true)

    let order = await store.getOrder(orderId)
    let shop = await store.getShopInfo(order.shopId)
    let product = await store.getProductInfo(order.prodId)
    let prodId = order.prodId
    let now = Date.now()

    let ticketCount = product.category !== productCategory.PRICE_DIFFERENCE ? order.prodCount : 1
    for (let i = 0; i < ticketCount; i++) {
      let ticketId = random(20)
      let ticketHash = md5(ticketId)
      let ticketCode = random(10, 'number')

      await generateQRCode(ticketCode, ticketHash)
      await store.createTicket({
        ticketId,
        ticketHash,
        ticketCode,
        orderId: order.orderId,
        shopId: order.shopId,
        prodId: order.prodId,
        openid: order.openid,
        qrcodeUrl: getQRCodeUrl(order.openid, ticketHash),
        createTime: now,
        used: false,
      })
    }

    ctx.body = { data: {} }
  },

  async appointmentPayOk (ctx) {
    let { openid } = ctx.state.user

    logger.log('[>>] update order paid status')
    let orderPaidStatusLocked = await store.isOrderPaidStatusLocked(openid)
    if (orderPaidStatusLocked) {
      logger.log('[ABORT] update order paid status. reason: paid status is locked')
      ctx.body = { data: {} }
      return
    }

    let { orderId } = ctx.params
    let order = await store.getOrder(orderId)
    if (!order || order.paid) {
      logger.log('[ABORT] update order paid status. reason: paid status is updated')
      ctx.body = { data: {} }
      return
    }

    // update order status
    await store.updateOrderPayStatus(orderId, true)
    await store.updatePendingOrderPaidStatus(orderId, true, 'user')

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
    ctx.body = { data: {} }
  },

  async handleGetTurnoverByDate (ctx) {
    let { shopId } = ctx.params
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let total = await store.getTurnoverByDate(shopId, start, end)
    ctx.body = { data: total }
  },

  async handleListMonthOrder (ctx, shopId) {
    let page = ctx.request.query.page || 1
    let data = await store.listMonthOrder(shopId, page)
    ctx.body = { data }
  },

  async handleListOrderByDate (ctx) {
    let { shopId } = ctx.params
    let { page, start, end } = ctx.request.query
    page = page || 1
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let data = await store.listOrderByDate(shopId, page, start, end)
    ctx.body = { data }
  },

  async getShopServiceStats (ctx) {
    let { shopId } = ctx.params
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let stats = await store.getShopServiceStats(shopId, start, end)
    ctx.body = { data: { stats } }
  },

  async getStaffPendingOrder (ctx) {
    let staffId = ctx.state.user.userid
    let order = await store.getStaffPendingOrder(staffId)
    ctx.body = { data: { order } }
  },

  async updateStaffPendingOrder (ctx) {
    let { orderId } = ctx.params
    let staffId = ctx.state.user.userid

    // update order status
    await store.updateOrderPayStatus(orderId, true)
    await store.updatePendingOrderPaidStatus(orderId, true, staffId)

    // update pay msg status
    let order = await store.getOrder(orderId)
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

    ctx.body = { data: {} }
  },

}


// helpers

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

async function createPendingOrder (order) {
  let msg = await store.getPayNotification(order.msgId)
  let user = await store.getUserInfoByOpenid(order.openid)
  let serviceCases = await store.listServiceCaseByApmId(order.apmId)

  let staffs = []
  let staffIds = []
  let categories = []
  for (let c of serviceCases) {
    if (categories.includes(c.category)) { categories.push(c.category) }
    let roles = ['assistant', 'haircut', 'perm']
    roles.forEach(async r => {
      if (c[r] && !staffIds.includes(c[r])) {
        let staff = await store.getStaffInfo(c[r])
        staffIds.push(c[r])
        staffs.push(staff)
      }
    })
  }

  let pendingOrder = {
    orderId: order.orderId,
    msgId: order.msgId,
    apmId: order.apmId,
    staffId: msg.staffId, // 这里的 staff id 是指发起付款通知的 staff
    user,
    msg,
    categories,
    staffs,
    total: order.total,
    oriTotal: order.oriTotal,
    deleted: false,
    createTime: order.creationTime,
    paid: false
  }

  await store.addPendingOrder(order.orderId, msg.staffId, pendingOrder)
}

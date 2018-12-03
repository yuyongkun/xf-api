const logger = require('../lib/log-console')

const { random } = require('../utils')
const store = require('../store')
Array.prototype.quc = function() {     
  let res=[]   
  let jso={}   
  for (let i = 0; i < this.length; i++) {
    if (!jso[JSON.stringify(this[i])]) {          
      res.push(this[i])
      jso[JSON.stringify(this[i])] = 1
    }    
  }
  return res 
}


module.exports = {
  async handleListCoupon (ctx) {
    let shopId = ctx.request.query.shopId
    let qrcode = parseInt(ctx.request.query.qrcode, 10) || 0
    ctx.assert(shopId, 404)
    let coupons
    if (qrcode) {
      coupons = await store.listQrcodeCouponByShop(shopId)
    } else {
      coupons = await store.listCouponByShop(shopId)
    }
    ctx.body = { data: { coupons } }
  },
  async handleListCouponPage (ctx) {
    let shopId = ctx.request.query.shopId
    let page = ctx.request.query.page
    let row = ctx.request.query.row
    ctx.assert(shopId, 404)
    let {rows, total} = await store.listCouponPageByShop(shopId, page, row)
    ctx.body = { data: {rows, total} }
  },
  async handleListCouponUsers (ctx) {
    let couponId = ctx.request.query.couponId
    let page = ctx.request.query.page
    let row = ctx.request.query.row
    let {rows, total} = await store.listCouponUsers(couponId, page, row)
    ctx.body = { data: {rows, total} }
  },
  async handleCreateCoupon (ctx) {
    let body = ctx.request.body
    let coupon = await store.createCoupon({
      couponId: random(8),
      shopId: body.shopId,
      type: body.type,
      getByQrcode: body.getByQrcode,
      category: body.category,
      couponCount: body.couponCount,
      startTime: body.startTime ? new Date(body.startTime).getTime() : Date.now(),
      endTime: body.endTime ? new Date(body.endTime).getTime() : 0,
      title: body.title,
      amount: body.amount,
      lowerLimit: body.lowerLimit,
      createTime: Date.now(),
      deleted: false,
      waitTime: body.waitTime
    })
    ctx.body = { data: { coupon } }
  },
  async handleUpdateCoupon (ctx) {
    let body = ctx.request.body
    let coupon = await store.updateCoupon({
      couponId: body.couponId,
      type: body.type,
      getByQrcode: body.getByQrcode,
      category: body.category,
      startTime: body.startTime ? new Date(body.startTime).getTime() : Date.now(),
      endTime: body.endTime ? new Date(body.endTime).getTime() : 0,
      title: body.title,
      amount: body.amount,
      couponCount: body.couponCount,
      lowerLimit: body.lowerLimit,
      waitTime: body.waitTime
    })
    ctx.body = { data: { coupon } }
  },
  async handleDeleteCoupon (ctx) {
    let { couponId } = ctx.params
    await store.delCoupon(couponId)
    ctx.body = { data: {} }
  },
  
  async addUserCoupon (ctx) {
    let { couponId } = ctx.params
    let { openid } = ctx.state.user
    let coupon = await store.getUserCoupon(openid, couponId)
    ctx.assert(!coupon, 403, 'coupon already existed')
    coupon = await store.getCouponByCouponId(couponId)
    ctx.assert(coupon, 404)
    ctx.assert(coupon.couponCount, 409) // 数量不足
    if (coupon.couponCount > 0) {
      let activeTime =  new Date().getTime() + coupon.waitTime * 1000 // waitTime 秒为单位
      let endTime = coupon.endTime
      coupon.couponCount = coupon.couponCount - 1
      await store.updateCouponCount(coupon)
      await store.addUserCoupon(openid, couponId, activeTime, endTime)
    }
    ctx.body = { data: {} }
  },
  async getUserCoupon (ctx) {
    let { couponId } = ctx.params
    let { openid } = ctx.state.user
    let coupon = await store.getUserCoupon(openid, couponId)
    if (!coupon) {
      coupon = await store.getCouponByCouponId(couponId)
      ctx.assert(coupon, 404)
      coupon.isReceived = false
    }
    ctx.body = { data: { coupons: [coupon] } }
  },
  async listUserCoupon (ctx) {
    let { openid } = ctx.state.user
    let coupons = await store.listUserCoupon(openid)
    ctx.body = { data: { coupons } }
  },
  // 获取商品订单有效优惠券
  async listOrderCoupon (ctx) {
    let { openid, product, shopId } = ctx.request.body
    let coupons = await store.listUserCoupon(openid) || []
    let totalAmount = 0
    product.countOption.map(option => {
      totalAmount += Number(option.price) * Number(option.count) * 100
    })
    let currentTime = Date.now()
    coupons = coupons.filter(m => currentTime < m.endTime && currentTime > m.activeTime && !m.used && totalAmount >= m.lowerLimit && shopId == m.shopId)
    let couponTypeA = coupons.filter(m => m.type == 1)
    let couponTypeB = coupons.filter(m => m.type == 2 && m.category == product.category) // 指定类别券
    ctx.body = { data: { coupons: [...couponTypeA, ...couponTypeB] } }
  },
   // 获取支付订单有效优惠券
  async listPayNotifyCoupon (ctx) {
    let { openid } = ctx.state.user
    let { apmId, price, shopId, categories } = ctx.request.body
    let coupons = await store.listUserCoupon(openid) || []
    let cases = await store.getCasesByApmId(apmId)

    let currentTime = Date.now()
    // 通用类券
    let couponTypeA = coupons.filter(m => currentTime < m.endTime && currentTime > m.activeTime && !m.used && price >= m.lowerLimit && shopId == m.shopId && m.type === 1)
    // 指定类别券
    let couponTypeB = []
    // 每个工单根据类别、价格去筛选
    cases.map(item => {
      let list = coupons.filter(m => currentTime < m.endTime && currentTime > m.activeTime && m.type == 2 && m.category == item.category && shopId == m.shopId && !m.used && (item.price * 100) >= m.lowerLimit)
      if (list.length) {
        couponTypeB.push(...list)
      }    
    })
    couponTypeB = couponTypeB.quc() // 去重，可能存在多个工单是同一类别的情况
    console.log(couponTypeA, couponTypeB)
    ctx.body = { data: { coupons: [...couponTypeA, ...couponTypeB] } }
  },

  // 获取领取优惠券的用户，最多十个
  async listUserByCouponId (ctx) {
    let { couponId } = ctx.params
    let users = await store.listUserByCouponId(couponId)
    ctx.body = { data: { users } }
  },

  async getCouponByCouponId (ctx) {
    let { couponId } = ctx.params
    let coupon = await store.getCouponByCouponId(couponId)
    ctx.assert(coupon, 404)
    let res = {
      couponId: coupon.couponId,
      couponName: coupon.title,
      shopId: coupon.shopId,
      shopName: coupon.shopName,
      couponAmount: coupon.amount / 100,
      orderMinAmount: coupon.lowerLimit / 100,
      endTimeStamp: coupon.endTime,
      couponCount: coupon.couponCount
    }
    if (typeof coupon.used !== 'undefined') {
      res.used = coupon.used
    }
    if (typeof coupon.isReceived !== 'undefined') {
      res.isReceived = coupon.isReceived
    }
    if (typeof coupon.activeTime !== 'undefined') {
      res.activeTimeStamp = coupon.activeTime
    }
    ctx.body = { data: { coupon: res } }
  }

}

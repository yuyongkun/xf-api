const logger = require('../lib/log-console')
const { orderTTL } = require('../config/app')

const service_cases = 'service_cases'
const pending_order = 'pending_order'
const orders = 'orders'


module.exports = {
  async createOrder (order) {
    return await this.db.insertOne('orders', order)
  },

  async getOrder (orderId) {
    return await this.db.findOne('orders', { orderId })
  },

  async delOrder (orderId) {
    // logically delete
    return await this.db.findOneAndUpdate('orders', {
      orderId
    }, {
      $set: { deleted: true }
    })
  },

  async cancelOrder (orderId) {
    return await this.db.findOneAndUpdate('orders', {
      orderId
    }, {
      $set: { cancelled: true }
    })
  },

  async listOrderByOpenid (openid) {
    let orders = await this.db.find('orders', { openid })
    let _this = this

    for (let order of orders) {
      let expired = ((Date.now() - order.creationTime) >= orderTTL) && !order.paid
      if (expired) {
        order.cancelled = true
        await this.cancelOrder(order.orderId)
      }

      order.product = await _this.db.findOne('products', { prodId: order.prodId })
      order.shop = await _this.db.findOne('shops', { shopId: order.shopId })
    }

    return orders
  },

  async listOrderByOpenidWithPaging (openid, limit, offset) {
    return await this.db.find('orders', { openid, paid: true }, {
      limit: parseInt(limit, 10),
      skip: parseInt(offset, 10),
      sort: { creationTime: -1 }
    })
  },

  async updateOrderPayStatus (orderId, status) {
    return await this.db.findOneAndUpdate('orders', {
      orderId
    }, {
      $set: { paid: status }
    })
  },

  async getTurnoverByDate(shopId, start, end) {
    let orders = await this.db.find('orders', {
      shopId,
      paid: true,
      creationTime: {
        $gte: start,
        $lte: end
      }
    })
    let disamountTotal = 0
    let total = 0
    orders.forEach(order => {
      total += parseInt(order.total, 10)
      if (order.useCoupon) {
        order.disamount = order.disamount || 0
        disamountTotal += parseInt(order.disamount, 10)
      }
    })

    return { total, disamountTotal }
  },

  async listOrderByDate (shopId, page, start, end) {
    let limit = 20
    let skip = limit * (page - 1)
    let query = {
      shopId,
      paid: true,
      creationTime: {
        $gte: start,
        $lte: end
      }
    }
    let orders = await this.db.find('orders', query, {
      limit,
      skip,
      sort: { creationTime: -1 }
    })
    let count = await this.db.count('orders', query)
    let staffs = await this.db.find('staffs', { shop: shopId })

    for (let order of orders) {
      if (order.useCoupon) {
        let coupons = []
        for (let couponId of order.coupons) {
          const coupon = await this.getCouponByCouponId(couponId)
          coupons.push({ title: coupon.title, amount: coupon.amount })
        }
        order.coupons = coupons
      }

      if (order.apmId) {
        let serviceCases = (await this.listServiceCaseByApmId(order.apmId)) || []
        for (let s of serviceCases) {
          s.assistant = s.assistant ? staffs.find(x => x.userid === s.assistant) : ''
          s.haircut = s.haircut ? staffs.find(x => x.userid === s.haircut) : ''
          s.perm = s.perm ? staffs.find(x => x.userid === s.perm) : ''
        }
        order.serviceCases = serviceCases
      } else {
        order.apmId = ''
        order.serviceCases = []
      }

      delete order.prodId
    }

    return { orders, count }
  },

  async getShopServiceStats (shopId, start, end) {
    let query = {
      shopId,
      paid: true,
      createTime: {
        $gte: start,
        $lte: end
      }
    }
    let serviceCases = (await this.db.find(service_cases, query)) || []
    let services = await this.listCateServiceByShop(shopId)
    let stats = []

    for (let s of services) {
      let cases = serviceCases.filter(x => x.servId === s.id)
      let totalMoney = 0
      let actualMoney = 0
      let cashMoney = 0
      let apmMoney = 0

      for (let c of cases) {
        totalMoney += c.price
        actualMoney += c.actualPrice
        if (c.apmId) { apmMoney += c.price }
        else { cashMoney += c.price }
      }

      let item = {
        service: s,
        caseCount: cases.length,
        totalMoney,
        actualMoney,
        cashMoney,
        apmMoney
      }

      stats.push(item)
    }

    return stats
  },

  async getStaffPendingOrder (staffId) {
    return this.db.findOne(pending_order, { staffId, deleted: false, paid: false })
  },

  async addPendingOrder (orderId, staffId, order) {
    return this.db.findOneAndUpdate(pending_order, { orderId, staffId }, 
      { 
        $set: order
      }, { upsert: true })
  },

  async updatePendingOrderPaidStatus (orderId, status, updatedBy) {
    return this.db.findOneAndUpdate(pending_order, { orderId }, {
      $set: {
        paid: status,
        updatedBy
      }
    })
  },

  async getOrderByMsgId (msgId) {
    return this.db.findOne('orders', { msgId })
  },

  async getOrderByPaySignAndOpenid (paySign, openid) {
    return this.db.findOne(orders, { openid, paySign })
  },

  async lockOrder (openid, msgId) {
    await this.cache.set(`orderLock:${openid}:${msgId}`, msgId, { ttl: 60 })
  },

  async isOrderLocked (openid, msgId) {
    let lock = await this.cache.get(`orderLock:${openid}:${msgId}`)
    return Boolean(lock)
  },

  async getOrderByMsgId (openid, msgId) {
    return await this.db.findOne(orders, { openid, msgId })
  },

  async findLatestOrderByOpenid (openid) {
    let d = new Date()
    d.setMinutes(d.getMinutes() - 5)

    return await this.db.findOne(orders, {
      openid,
      creationTime: { $gt: d.getTime() }
    })
  },

  async lockOrderPaidStatus (openid) {
    return await this.cache.set(`orderStatusLock:${openid}`, orderId, { ttl: 15 })
  },

  async isOrderPaidStatusLocked (openid) {
    let lock = await this.cache.get(`orderStatusLock:${openid}`)
    return Boolean(lock)
  }

}

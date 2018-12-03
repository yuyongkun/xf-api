const COUPONS = 'coupons'
const USER_COUPONS = 'user_coupons'

const hour = 1000 * 60 * 60
const day = hour * 24
const period = day * 5 // 提前五天发送提醒消息 


module.exports = {
  async createCoupon (coupon) {
    let res = await this.db.insertOne(COUPONS, coupon)
    return this.getCouponByCouponId(coupon.couponId)
  },
  async updateCoupon (coupon) {
    return await this.db.findOneAndUpdate(COUPONS, {
      couponId: coupon.couponId
    }, {
      $set: { 
        type: coupon.type,
        getByQrcode: coupon.getByQrcode,
        startTime: coupon.startTime, 
        endTime: coupon.endTime, 
        waitTime: coupon.waitTime,
        title: coupon.title,
        amount: coupon.amount,
        lowerLimit: coupon.lowerLimit,
        couponCount: coupon.couponCount,
        category: coupon.category
      }
    })
  },
  async updateCouponCount (coupon) {
    return await this.db.findOneAndUpdate(COUPONS, {
      couponId: coupon.couponId
    }, {
      $set: { 
        couponCount: coupon.couponCount
      }
    })
  },
  async listCouponByShop (shopId) {
    let coupons = await this.db.find(COUPONS, { shopId, deleted: false, getByQrcode: { $in: [0, null] } })
    return coupons
  },
  async listQrcodeCouponByShop (shopId) {
    let coupons = await this.db.find(COUPONS, { shopId, deleted: false, getByQrcode: 1 })
    return coupons
  },
  async listCouponPageByShop (shopId, page, row) {
    let limit = parseInt(row)
    let skip = limit * (page - 1)
    let query = {
      shopId
    }
    let rows = await this.db.find(COUPONS, query, {
      limit,
      skip,
      sort: { createTime: -1 }
    })
    let total = await this.db.count(COUPONS, query)
    return { rows, total }
  },
   async listCouponUsers (couponId, page, row) {
    let limit = parseInt(row)
    let skip = limit * (page - 1)
    let query = {
      couponId
    }
    let rows = await this.db.find(USER_COUPONS, query, {
      limit,
      skip,
      sort: { activeTime: -1 }
    })
    for (let c of rows) {
      let user = await this.db.findOne('users', {
        openid: c.openid
      })
      if (user) {
        c.headimgurl = user.headimgurl
        c.nickname = user.nickname 
      }
    }
    let total = await this.db.count(USER_COUPONS, query)
    return { rows, total }
  }, 
  async delCoupon (couponId) {
    return await this.db.findOneAndUpdate(COUPONS, {
      couponId
    }, {
      $set: { deleted: true }
    })
  },

  async getCouponByCouponId (couponId) {
    return await this.db.findOne(COUPONS, { couponId })
  },

  async getUserCoupon (openid , couponId) {
    let userCoupon = await this.db.findOne(USER_COUPONS, { openid, couponId })
    if (!userCoupon) return null
    let coupon = await this.getCouponByCouponId(couponId)
    let shop = await this.db.findOne('shops', {
      shopId: coupon.shopId
    })
    coupon.used = userCoupon.used
    coupon.shopName = shop.name
    coupon.activeTime = userCoupon.activeTime
    coupon.isReceived = true
    return coupon
  },

  async addUserCoupon (openid, couponId, activeTime, endTime) {
    return await this.db.insertOne(USER_COUPONS, {
      openid,
      couponId, 
      used: false, 
      activeTime, 
      createTime: Date.now(),
      endTime
    })
  },
  async updateUserCoupon (openid, couponId) {
    return await this.db.findOneAndUpdate(USER_COUPONS, {
      openid, couponId, used: false
    }, {
      $set: { used: true }
    })
  },

  async listUserCoupon (openid) {
    let userCoupons = await this.db.find(USER_COUPONS, { openid })
    let coupons = []
    for (let c of userCoupons) {
      let coupon = await this.getCouponByCouponId(c.couponId)
      if (coupon) {
        let shop = await this.db.findOne('shops', {
          shopId: coupon.shopId
        })
        coupon.used = c.used
        coupon.activeTime = c.activeTime
        coupon.msgCount = c.msgCount
        coupon.addTime = c.createTime
        coupon.shopName = shop.name
        coupon.endTime = c.endTime
        coupons.push(coupon)
      }
    }
    return coupons
  },

  async listExpiredSoonUserCoupon (openid) {
    let now = Date.now()
    return await this.db.find(USER_COUPONS, {
      openid,
      used: false,                                     // 未使用
      msgCount: { $exists: false },                    // 未发送过消息
      activeTime: { $lt: now },                        // 已激活
      endTime: { $gt: now, $lt: now + period }         // 还有五天就过期
    })
  },

  async listUserByCouponId (couponId) {
    let userCoupons = await this.db.find(USER_COUPONS, { couponId }, { limit: 10 })
    let users = []
    for (let c of userCoupons) {
      let user = await this.getUserInfoByOpenid(c.openid)
      users.push(user)
    }
    return users
  },

  async updateCouponMsgCount (openid, couponId, msgCount) {
    return await this.db.findOneAndUpdate(USER_COUPONS, { openid, couponId }, { $set: { msgCount } })
  }
}
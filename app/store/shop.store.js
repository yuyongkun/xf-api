const salary_plan = 'salary_plan'
const shop_entry_config = 'shop_entry_config'
const shop_hair_photos = 'shop_hair_photos'
const pay_notifications = 'pay_notifications'

module.exports = {
  async listShop () {
    let shops = await this.db.find('shops')
    return shops
  },

  async getShopInfo (shopId) {
    let shop = await this.db.findOne('shops', {
      shopId
    })
    return shop
  },

  async createShop (shop) {
    return await this.db.insertOne('shops', shop)
  },

  async updateShop (shop) {
    delete shop._id
    return await this.db.findOneAndUpdate('shops', {
      shopId: shop.shopId
    }, {
      $set: shop
    })
  },

  async listProductGroup (shopId, category) {
    let groups = await this.db.find('shop_product_groups', { shopId, category })
    for (let group of groups) {
      let prodIds = group.products
      let products = []
      for (let prodId of prodIds) {
        let product = await this.getProductInfo(prodId)
        products.push(product)
      }
      group.products = products
    }
    return groups
  },

  async updateProductGroup (shopId, groupId, group) {
    return await this.db.findOneAndUpdate('shop_product_groups', { shopId, groupId }, { $set: group })
  },

  async addProductGroup (group) {
    return await this.db.insertOne('shop_product_groups', group)
  },

  async delProductGroup (groupId) {
    return await this.db.deleteOne('shop_product_groups', { groupId })
  },

  async updateSalaryPlan (plan) {
    return await this.db.findOneAndUpdate(salary_plan, { shopId: plan.shopId, planId: plan.planId }, { $set: { ...plan } }, { upsert: true })
  },

  async listSalaryPlanByShopId (shopId) {
    return await this.db.find(salary_plan, { shopId })
  },

  async getSalaryPlan (shopId, planId) {
    let res = await this.db.findOne(salary_plan, { shopId, planId })
    if (res) {
      delete res._id
    }
    return res
  },

  async deleteSalaryPlan (planId) {
    return await this.db.deleteOne(salary_plan, { planId })
  },

  async getEntryConfig (shopId) {
    let res = await this.db.findOne(shop_entry_config, { shopId })
    console.log(res)
    return (res && res.config) ? res.config : []
  },

  async updateEntryConfig (shopId, config) {
    let old = await this.getEntryConfig(shopId)
    if (!old || old.length === 0) {
      return await this.db.insertOne(shop_entry_config, { config, shopId })
    } else {
      return await this.db.findOneAndUpdate(shop_entry_config, { shopId }, { $set: { config, shopId } })
    }
  },

  async getHairPhotos (shopId) {
    let res = await this.db.findOne(shop_hair_photos, { shopId })
    return (res && res.photos) ? res.photos : []
  },

  async updateHairPhotos (shopId, photos) {
    return await this.db.findOneAndUpdate(shop_hair_photos, { shopId }, { $set: { photos, shopId } }, { upsert: true })
  },

  async listServedUserByShop (shopId, page, start, end) {
    let limit = 20
    let skip = limit * (page - 1)
    let params = {
      shopId,
      createTime: {
        $gte: start,
        $lt: end
      },
      paid: true
    }
    let notsCount = await this.db.count(pay_notifications, params)
    let nots = await this.db.find(pay_notifications, params, {
      skip,
      limit,
      sort: { createTime: -1 }
    })
    let openids = []
    let users = []
    for (let n of nots) {
      let openid = n.openid
      if (openids.includes(openid)) { continue }
      openids.push(openid)
      let user = await this.getUserInfoByOpenid(openid)
      users.push({
        openid: user.openid,
        hairPhotos: user.hairPhotos || [],
        nickname: user.nickname || '',
        servedTime: n.createTime
      })
    }
    return { count: notsCount, users }
  }
}
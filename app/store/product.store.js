const { PRODUCT_TYPE } = require('../config/constants')

module.exports = {
  async listProduct (shopId) {
    // 只获取小商品
    let products = await this.db.find('products', { shopId, type: PRODUCT_TYPE.SHOW_ONLY, deleted: false })
    let shop = await this.getShopInfo(shopId)

    return products.map(product => {
      product.shop = shop
      return product
    })
  },

  async listProductByCategory (shopId, category) {
    let products = await this.db.find('products', { shopId, category })
    let shop = await this.getShopInfo(shopId)

    return products.map(product => {
      product.shop = shop
      return product
    })
  },

  async getProductInfo (prodId) {
    let prod = await this.db.findOne('products', { prodId })
    if (!prod) return null

    let shop = await this.getShopInfo(prod.shopId)
    prod.shop = shop
    return prod
  },

  async createProduct (prod) {
    return await this.db.insertOne('products', prod)
  },

  async updateProduct (prod) {
    delete prod._id
    return await this.db.findOneAndUpdate('products', {
      prodId: prod.prodId
    }, {
      $set: prod
    })
  },

  async listPrimaryProducts (shopId) {
    let products = await this.db.find('products', { shopId, isPrimary: true })
    let shop = await this.getShopInfo(shopId)

    return products.map(product => {
      product.shop = shop
      return product
    })
  },

  async getPrimaryProduct (shopId, category) {
    let shop = await this.getShopInfo(shopId)
    let product = await this.db.findOne('products', { shopId, isPrimary: true, category })
    product.shop = shop
    return product
  }
}
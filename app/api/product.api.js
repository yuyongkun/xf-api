const logger = require('../lib/log-console')

const { random } = require('../utils/')
const store = require('../store/')

const { PRODUCT_TYPE } = require('../config/constants')


module.exports = {
  async handleListProduct (ctx) {
    let { shopId } = ctx.params
    let products = await store.listProduct(shopId)
    ctx.body = { data: { products } }
  },

  async handleListProductByCategory (ctx) {
    let { shopId, category } = ctx.params
    let products = await store.listProductByCategory(shopId, category)
    ctx.body = { data: { products } }
  },

  async handleGetProduct (ctx) {
    let { prodId } = ctx.params
    let product = await store.getProductInfo(prodId)
    ctx.assert(product, 404, 'product not found')
    ctx.body = { data: { product } }
  },

  async handleWxGetProduct (ctx) {
    let { prodId } = ctx.params
    let product = await store.getProductInfo(prodId)
    ctx.assert(product, 404, 'product not found')
    ctx.body = { data: { product } }
  },

  async handleCreateProduct (ctx) {
    let product = ctx.request.body
    let now = Date.now()
    product.prodId = random(12)
    product.creationTime = now
    product.modificationTime = now
    product.creator = ctx.state.user.username
    product.onSale = true
    product.type = PRODUCT_TYPE.SHOW_ONLY
    product.deleted = false

    logger.log('product info: %j', product)

    let result = await store.createProduct(product)
    logger.log('created product: %j', product)
    ctx.body = { data: { product } }
  },

  async handleUpdateProduct (ctx) {
    let { prodId } = ctx.params
    let product = await store.getProductInfo(prodId)
    ctx.assert(product, 404, 'product not found')

    product = ctx.request.body
    product.prodId = prodId
    delete product.shop
    let result = await store.updateProduct(product)
    ctx.body = { data: { product } }
  },

  async listPrimaryProducts (ctx) {
    let { shopId } = ctx.params
    let products = await store.listPrimaryProducts(shopId)
    ctx.body = { data: { products } }
  },

  async getPrimaryProduct (ctx) {
    let { shopId, category } = ctx.params
    let product = await store.getPrimaryProduct(shopId, category)
    ctx.body = { data: { product } }
  }

}

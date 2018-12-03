const logger = require('../lib/log-console')

const store = require('../store')


module.exports = {
  async handleListCategory (ctx) {
    let categories = await store.listCategory()
    ctx.body = { data: { categories } }
  },

  async handleInitCategory (ctx) {
    // category = { name, photo, code }
    let _cates = await store.listCategory()
    if (_cates.length > 0) { 
      ctx.body = {}
      return
    }

    let categories = ctx.request.body.categories || []
    for (let category of categories) {
      await store.createCategory(category)
    }
    let _res = await store.listCategory()
    ctx.body = { data: { categories: _res } }
  },

  async handleUpdateCategory (ctx) {
    let { code } = ctx.params
    let category = ctx.request.body
    await store.updateCategory(code, category)
    ctx.body = { data: {} }
  },

  async listCateServiceByShop (ctx) {
    let { shopId } = ctx.request.query
    let services = await store.listCateServiceByShop(shopId)
    ctx.body = { data: { services } }
  },

  async updateCateService (ctx) {
    let service = ctx.request.body
    await store.updateCateService(service)
    ctx.body = { data: {} }
  }
}

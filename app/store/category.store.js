const cate_services = 'cate_services'

module.exports = {
  async createCategory (category) {
    return this.db.insertOne('categories', category)
  },

  async listCategory () {
    return this.db.find('categories')
  },

  async updateCategory (code, category) {
    return this.db.findOneAndUpdate('categories', { code }, { $set: category })
  },

  async listCateServiceByShop (shopId) {
    return this.db.find(cate_services, { shopId })
  },

  async updateCateService ({ id, name, price, category, shopId }) {
    let service = await this.db.findOne(cate_services, { id })
    if (!service) {
      return this.db.insertOne(cate_services, { id, name, price, category, shopId })
    } else {
      return this.db.findOneAndUpdate(cate_services, { id }, { $set: { name, price, category, shopId } })
    }
  }
}
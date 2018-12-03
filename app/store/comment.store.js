const COMMENTS = 'comments'
const { COMMENT_STATUS } = require('../config/constants')

module.exports = {
  async createComment (comment) {
    return await this.db.insertOne(COMMENTS, comment)
  },
  async getComment (openid, apmId) {
    return await this.db.findOne(COMMENTS, {openid, apmId})
  },
  async updateComment(commentId, status) {
    return await this.db.findOneAndUpdate(COMMENTS, {
      commentId
    }, {
      $set: { status }
    })
  },
  async delComment (commentId) {
    return await this.db.findOneAndUpdate(COMMENTS, {
      commentId
    }, {
      $set: { status: COMMENT_STATUS.DELETED }
    })
  },
  async listCommentByShopId (shopId, page, row = 10, status) {
    let limit = parseInt(row)
    let skip = limit * (page - 1)
    let query = {
      shopId,
      status
    }
    let comments = await this.db.find(COMMENTS, query, {
      limit,
      skip,
      sort: { createTime: -1 }
    })
    let count = await this.db.count(COMMENTS, query)
    return { comments, count }
  },
  async listCommentByDate (shopId, page, row, start, end) {
    let limit = parseInt(row)
    let skip = limit * (page - 1)
    let query = {
      status: {$ne: COMMENT_STATUS.DELETED},
      shopId,
      createTime: {
        $gte: start,
        $lte: end
      }
    }
    let comments = await this.db.find('comments', query, {
      limit,
      skip,
      sort: { createTime: -1 }
    })
    let count = await this.db.count('comments', query)
    return { comments, count }
  },
  async listCommentByShop(shopId, start, end) {
    let query = {
      status: {$ne: COMMENT_STATUS.DELETED},
      staffs: {$exists: true},
      rate_shopClean: {$exists: true},
      shopId,
      createTime: {
        $gte: start,
        $lte: end
      }
    }
    return await this.db.find('comments', query)
  },
  async countCommentByShop(shopId) {
    let query = {
      status: {$ne: COMMENT_STATUS.DELETED},
      staffs: {$exists: true},
      rate_shopClean: {$exists: true},
      shopId
    }
    return await this.db.count('comments', query)
  }
}
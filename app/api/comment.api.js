const logger = require('../lib/log-console')
const { random } = require('../utils')
const store = require('../store')
const { COMMENT_STATUS, COMMENT_RATING } = require('../config/constants')

module.exports = {
  async addComment (ctx) {
    let { shopId } = ctx.params
    let { openid } = ctx.state.user
    let { comment, rating, apmId, staffs, rate_shopServe, rate_shopClean } = ctx.request.body
    let apm = await store.getDoneAppointment(openid, apmId)
    ctx.assert(apm, 404, 'apm does not exist')
    await store.createComment({ 
      commentId: random(8),
      apmId,
      shopId, 
      openid, 
      comment, 
      rating,
      rate_shopServe,
      rate_shopClean,
      staffs,
      createTime: Date.now(),
      status: COMMENT_STATUS.WAITCHECK
    })
    await store.updateApmRateStatus(apmId, true)
    ctx.body = { data: {} }
  },
  async handleGetComment (ctx) {
    let { openid } = ctx.state.user
    let { apmId } = ctx.request.query
    let comment = await store.getComment(openid, apmId)
    ctx.assert(comment, 404, 'comment does not exist')
    ctx.body = { data: { comment } }
  },
  async handleUpdateComment (ctx) {
    let { commentId } = ctx.params
    let { status } = ctx.request.body
    await store.updateComment(commentId, status)
    ctx.body = { data: {} }
  },
  async handleDeleteComment (ctx, commentId) {
    await store.delComment(commentId)
    ctx.body = { data: {} }
  },

  async listShopComment (ctx) {
    let { shopId } = ctx.params
    let { page, row, status } = ctx.request.body
    let { comments, count } = await store.listCommentByShopId(shopId, page, row, status)
    for (let comment of comments) {
      let user = await store.getUserInfoByOpenid(comment.openid)
      // let staff = await store.getStaff(comment.staffId)
      comment.avatar = user.headimgurl
      comment.nickname = `${user.nickname.substring(0, 1)}***`
      // comment.phone = user.phone ? user.phone.replace(user.phone.substring(3, 8), '*****') : ''
      if (comment.staffs && comment.staffs.length) {
        let staff = await store.getStaff(comment.staffs[0].userid) // 取第一个
        comment.staffname = staff.nickname || ''
      }  
    }
    // 平均分、好评率暂不直接算
    let score = COMMENT_RATING.SCORE
    let percent = COMMENT_RATING.PERCENT
    ctx.body = { comments, count, score, percent }
  },  
  async listCommentByDate (ctx) {
      let { shopId, page, row, start, end } = ctx.request.query
      start = start ? parseInt(start, 10) : new Date().getTime()
      end = end ? parseInt(end, 10) : new Date().getTime()
      let { comments, count } = await store.listCommentByDate(shopId, page, row, start, end)
      for (let comment of comments) {
        let user = await store.getUserInfoByOpenid(comment.openid) 
        let shop = await store.getShopInfo(comment.shopId)
        comment.shopname = shop.name
      }
      ctx.body = { comments, count }
  }
}
  
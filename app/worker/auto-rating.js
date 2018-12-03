const store = require('../store')
const { COMMENT_STATUS } = require('../config/constants')

const hour = 1000 * 60 * 60
const day = 24 * hour


setInterval(async () => {
  try {
    console.log('executing auto rating worker')
    let now = new Date()
    console.log('now time: %s', now.toLocaleString())
    await main()
  } catch (e) {
    console.error('executing auto rating error')
    console.error(e)
  }
}, hour)


async function main() {
  let now = Date.now()
  let startTime = now - 10 * day
  let endTime = now - 9 * day
  let limit = 10
  let skip = 0
  let apmCount = await store.countUnratedApm(startTime, endTime)
  let queryCount = Math.ceil(apmCount / limit)
  for (let i = 1; i < queryCount; i++) {
    let apms = await store.listUnratedApm(start, end, limit, skip)
    for (let apm of apms) {
      let { openid, shopId, apmId } = apm

      // 自动为所有参与服务的员工五星好评
      let cases = await store.getCasesByApmId(apmId)
      let staffIds = []
      let staffs = []
      for (let a of cases) {
        if (a.assistant) {
          staffIds.push(a.assistant)
        }
        if (a.haircut) {
          staffIds.push(a.haircut)
        }
        if (a.perm) {
          staffIds.push(a.perm)
        }    
      }
      staffIds = [...new Set(staffIds)]; 
      for (let sid of staffIds) {
        staffs.push({ userid: sid, rating: 5 })
      }

      // 创建系统评论
      await store.createComment({ 
        commentId: random(8),
        apmId,
        shopId, 
        openid, 
        comment: '系统自动好评', 
        rating: 5,
        rate_shopServe: 5,
        rate_shopClean: 5,
        staffs,
        createTime: now,
        status: COMMENT_STATUS.APPROVED
      })
    }
    skip += limit
  }
}


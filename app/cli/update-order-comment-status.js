const store = require('../store')

main().then(() => {
  console.log('job finished')
}).catch(e => {
  console.error('job failed', e)
})

async function main() {
  let commentCount = await store.db.count('comments', {})
  console.log('comment count', commentCount)
  let limit = 10
  let skip = 0
  let queryCount = Math.ceil(commentCount / limit)
  for (let i = 1; i < queryCount; i++) {
    let comments = await store.db.find('comments', {}, { limit, skip })
    for (let comment of comments) {
      let { apmId, openid } = comment
      if (!apmId) { continue }
      let apm = await store.getAppointmentByApmId(apmId)
      console.log('updating user appointment, openid: %s, apmId: %s', openid, apmId)
      if (!apm) { continue }
      await store.updateApmRateStatus(apmId, true)
      console.log('updated user appointment, openid: %s, apmId: %s', openid, apmId)
    }
    skip += limit
  }
}

const logger = require('../lib/log-console')

const fs = require('fs')
const { JSDOM } = require('jsdom')

const {
  wxAppid,
  wxJSAPIList,
  userSessionTTL,
  ACCESS_TOKEN_LENGTH,
  ACCESS_SECRET_LENGTH,
  ACCESS_SECRET_CHAR_CANDIDATES
} = require('../config/app')
const { STAFF_STATUS } = require('../config/constants')
const { random, getPwdHash, timestamp, sha1, md5, getDistance, formatDistance } = require('../utils/')
const store = require('../store')

const INDEX_PAGE_FILE_LOCATION = process.env.INDEX_PAGE_FILE_LOCATION
const MCHT_INDEX_PAGE_FILE_LOCATION = process.env.MCHT_INDEX_PAGE_FILE_LOCATION

module.exports = {
  async handleIndexPageRequest(ctx) {
    await handleShopIndexPageRequest(ctx)
  },

  async handleStaffHomePageRequest (ctx) {
    await handleMchtIndexPageRequest(ctx)
  },

  async handleListShopRequest (ctx) {
    let { openid } = ctx.state.user
    let { latitude, longitude } = ctx.request.query
    let shops = await store.listShop()
    let _shops = []
    for (let shop of shops) {
      // 统计等待人数
      shop.apmCount =  await getShopWaitingCount(shop.shopId)

      // 计算距离
      if (latitude && longitude) {
        shop.distance = getDistance(latitude, longitude, shop.location.latitude, shop.location.longitude)
      }
    }
    if (latitude && longitude) {
      // 按距离升序
      shops.sort((a, b) => {
        if (a.distance > b.distance) return 1
        if (a.distance < b.distance) return -1
        return 0
      }).forEach((shop) => {
        shop.distance = formatDistance(shop.distance)
      })
    }

    // 上次消费过的店排在第一位
    let latestApm = await store.getLatestDoneApmByOpenid(openid)
    if (latestApm) {
      let targetShopIndex = shops.findIndex(s => s.shopId === latestApm.shopId)
      let firstShop = shops.splice(targetShopIndex, 1)[0]
      firstShop.mark = '上次消费过'
      _shops.push(firstShop, ...shops)
    } else {
      _shops = shops
    }

    ctx.body = { data: { shops: _shops } }
  },

  async handleGetShopRequest (ctx) {
    let { shopId } = ctx.params
    let shop = await store.getShopInfo(shopId)
    ctx.assert(shop, 404, 'shop not found')
    ctx.body = { data: { shop } }
  },

  async handleCreateShopRequest (ctx) {
    let shop = ctx.request.body
    shop.shopId = random(8)
    let result = await store.createShop(shop)
    logger.log('created shop: %j', shop)
    ctx.body = { data: { shop } }
  },

  async handleUpdateShopRequest (ctx) {
    let { shopId } = ctx.params
    let shop = await store.getShopInfo(shopId)
    ctx.assert(shop, 404, 'shop not found')

    shop = ctx.request.body
    shop.shopId = shopId
    let result = await store.updateShop(shop)
    ctx.body = { data: { shop } }
  },

  async handleListProductGroup (ctx) {
    let { shopId, cate } = ctx.params
    // { shopId, expand, products: [ prodId1, prodId2, ... ] }
    let groups = await store.listProductGroup(shopId, cate)
    ctx.body = { data: { groups } }
  },

  async handleUpdateProductGroup (ctx) {
    let { shopId, groupId } = ctx.params
    let group = ctx.request.body || {}
    console.log(group)
    await store.updateProductGroup(shopId, groupId, group)
    ctx.body = { data: {} }
  },

  async handleAddProductGroup (ctx) {
    let { shopId, cate } = ctx.params
    let group = ctx.request.body || {}
    group.shopId = shopId
    group.groupId = random(8)
    group.category = cate
    await store.addProductGroup(group)
    ctx.body = { data: {} }
  },

  async handleDeleteProductGroup (ctx) {
    let { groupId } = ctx.params
    await store.delProductGroup(groupId)
    ctx.body = { data: {} }
  },

  async getSalaryPlanByShopId (ctx, shopId) {
    let plan = await store.getSalaryPlanByShopId(shopId)
    ctx.body = { data: { plan } }
  },

  async listSalaryPlanByShopId (ctx) {
    let { shopId } = ctx.params
    let plans = await store.listSalaryPlanByShopId(shopId)
    ctx.body = { data: {  plans } }
  },

  async updateSalaryPlan (ctx) {
    let plan = ctx.request.body || {}
    if (plan._id) { delete plan._id }
    await store.updateSalaryPlan(plan)
    ctx.body = { data: {} }
  },

  async delSalaryPlan (ctx) {
    let { planId } = ctx.params
    await store.deleteSalaryPlan(planId)
    ctx.body = { data: {} }
  },

  async getShopCommentStats (ctx) {
    let { shopId } = ctx.params
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let comments = await store.listCommentByShop(shopId, start, end)

    let statsItem = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0, rateCount: 0 }
    let staffs = (await store.listStaffByShop(shopId)).map(x => {
      return Object.assign({}, statsItem, { userid: x.userid, username: x.username })
    })
    let shopCleanStats = Object.assign({}, statsItem, { username: '店务整洁' })

    for (let comment of comments) {
      switch (comment.rate_shopClean) {
        case 1:
          shopCleanStats.star1++
          break
        case 2:
          shopCleanStats.star2++
          break
        case 3:
          shopCleanStats.star3++
          break
        case 4:
          shopCleanStats.star4++
          break
        default:
          shopCleanStats.star5++
      }

      for (let s of comment.staffs) {
        let { userid, rating } = s
        let targetStaff = staffs.find(x => x.userid === userid)
        if (!targetStaff) continue
        targetStaff.rateCount++
        switch (rating) {
          case 1:
            targetStaff.star1++
            break
          case 2:
            targetStaff.star2++
            break
          case 3:
            targetStaff.star3++
            break
          case 4:
            targetStaff.star4++
            break
          default:
            targetStaff.star5++
        }
      }
    }

    shopCleanStats.rateCount = comments.length
    staffs.push(shopCleanStats)

    ctx.body = { data: { stats: staffs } }
  },

  async getEntryConfig (ctx) {
    let { shopId } = ctx.params
    let config = await store.getEntryConfig(shopId)
    ctx.body = { data: config }
  },

  async saveEntryConfig (ctx) {
    let { shopId } = ctx.params
    let config = ctx.request.body.config || []
    await store.updateEntryConfig(shopId, config)
    ctx.body = { data: {} }
  },

  async getHairPhotos (ctx) {
    let { shopId } = ctx.params
    let photos = await store.getHairPhotos(shopId)
    ctx.body = { data: photos }
  },

  async saveHairPhotos (ctx) {
    let { shopId } = ctx.params
    let photos = ctx.request.body.photos || []
    await store.updateHairPhotos(shopId, photos)
    ctx.body = { data: {} }
  },

  async listServedUserByShop (ctx) {
    let { shopId } = ctx.params
    let { page, start, end } = ctx.request.query
    page = page ? parseInt(page, 10): 1
    start = parseInt(start, 10)
    end = parseInt(end, 10)
    let data = await store.listServedUserByShop(shopId, page, start, end)
    ctx.body = { data }
  }
}

async function handleShopIndexPageRequest (ctx) {
  ctx.assert(fs.existsSync(INDEX_PAGE_FILE_LOCATION), 404)

  let file = fs.readFileSync(INDEX_PAGE_FILE_LOCATION)
  let { state } = ctx.request.query // o -> openid, v -> view

  let dom = new JSDOM(`${file.toString('utf8')}`)
  let htmlHead = dom.window.document.querySelector('head')
  let script = dom.window.document.createElement('script')

  script.innerHTML = ''
  let url = 'http://test-shop.fanxify.com/shop-home?'
  if (state) {
    url += `state=${state}`
  }

  // inject js-sdk config
  let jsTicket = await store.getJSTicket()
  let noncestr = random(20)
  let _timestamp = timestamp('s') // seconds
  let signature = sha1(`jsapi_ticket=${jsTicket}&noncestr=${noncestr}&timestamp=${_timestamp}&url=${url}`)
  let wxConfig = `wx.config(${JSON.stringify({
    debug: false,           // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    appId: wxAppid,         // 必填，公众号的唯一标识
    timestamp: _timestamp,  // 必填，生成签名的时间戳
    nonceStr: noncestr,     // 必填，生成签名的随机串
    signature: signature,   // 必填，签名，见附录1
    jsApiList: wxJSAPIList  // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
  })});`
  script.innerHTML += wxConfig

  htmlHead.appendChild(script)
  let htmlText = dom.serialize()
  let buffer = Buffer.from(htmlText)

  ctx.set('Content-Type', 'text/html')
  ctx.body = buffer
}


async function handleMchtIndexPageRequest (ctx) {
  ctx.assert(fs.existsSync(MCHT_INDEX_PAGE_FILE_LOCATION), 404)

  let file = fs.readFileSync(MCHT_INDEX_PAGE_FILE_LOCATION)
  let state = ctx.request.query.state

  let dom = new JSDOM(`${file.toString('utf8')}`)
  let htmlHead = dom.window.document.querySelector('head')
  let script = dom.window.document.createElement('script')

  // inject openid and session
  script.innerHTML =  ''

  // inject js-sdk config
  let jsTicket = await store.getJSTicket()
  let noncestr = random(20)
  let _timestamp = timestamp('s') // seconds
  let url = `http://test-shop.fanxify.com/staff-home?state=${state}`
  let signature = sha1(`jsapi_ticket=${jsTicket}&noncestr=${noncestr}&timestamp=${_timestamp}&url=${url}`)
  let wxConfig = `wx.config(${JSON.stringify({
    debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    appId: wxAppid, // 必填，公众号的唯一标识
    timestamp: _timestamp, // 必填，生成签名的时间戳
    nonceStr: noncestr, // 必填，生成签名的随机串
    signature: signature,// 必填，签名，见附录1
    jsApiList: wxJSAPIList // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
  })});`
  script.innerHTML += wxConfig

  htmlHead.appendChild(script)
  let htmlText = dom.serialize()
  let buffer = Buffer.from(htmlText)

  ctx.set('Content-Type', 'text/html')
  ctx.body = buffer
}

async function getShopWaitingCount (shopId) {
  let _staffs = await store.listStaffByShop(shopId)
  let staffs = []
  let count = 0
  for (let staff of _staffs) {
    // only show staff that is not left or not on holiday
    if (staff.status === STAFF_STATUS.LEFT || staff.status === STAFF_STATUS.ON_HOLIDAY) { continue }

    // 不显示未绑定微信的员工
    if (!staff.openid) { continue }

    let apmCount = await store.countAppointmentByStaff(staff.userid)
    if (apmCount > 0) {
      count++
    }
  }
  return count
}


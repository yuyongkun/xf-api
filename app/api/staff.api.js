const logger = require('../lib/log-console')
const fs = require('fs')
const { JSDOM } = require('jsdom')

const {
  wxAppid,
  wxJSAPIList,
  ACCESS_SECRET_LENGTH,
  ACCESS_SECRET_CHAR_CANDIDATES,

  wxQueueMsgTmplId,
} = require('../config/app')
const sendWxMsg = require('./weixin/wx-msg-helper')
const { STAFF_STATUS } = require('../config/constants')
const { random, getPwdHash, timestamp, sha1 } = require('../utils/')
const store = require('../store/')

const MCHT_INDEX_PAGE_FILE_LOCATION = process.env.MCHT_INDEX_PAGE_FILE_LOCATION


module.exports = {
  async handleMchtIndexPageRequest (ctx) {
    ctx.assert(fs.existsSync(MCHT_INDEX_PAGE_FILE_LOCATION), 404)

    let file = fs.readFileSync(MCHT_INDEX_PAGE_FILE_LOCATION)
    let openid = ctx.request.query.o
    if (!openid) {
      ctx.set('Content-Type', 'text/html')
      ctx.body = file
      return
    }

    // check if staff
    let staffs = await store.listStaff()
    let staff = null
    for (let s of staffs) {
      if (s.openid === openid) {
        staff = s
        break
      }
    }
    if (!staff) {
      ctx.set('Content-Type', 'text/html')
      ctx.body = file
      return
    }

    // save staff session
    let staffSession = {
      username: staff.username,
      access_token: random(ACCESS_SECRET_LENGTH),
      access_secret: random(ACCESS_SECRET_LENGTH, ACCESS_SECRET_CHAR_CANDIDATES),
      token_type: 'Bearer'
    }
    await store.saveStaffSession(staffSession, {})

    let dom = new JSDOM(`${file.toString('utf8')}`)
    let htmlHead = dom.window.document.querySelector('head')
    let script = dom.window.document.createElement('script')

    // inject openid and session
    script.innerHTML =  `window._openid = '${openid}';
    window.localStorage.setItem('fxm:user', ${JSON.stringify(staffSession)})
    `

    // inject js-sdk config
    let jsTicket = await store.getJSTicket()
    let noncestr = random(20)
    let _timestamp = timestamp('s') // seconds
    let url = `http://test-mcht.fanxify.com/?o=${openid}`
    let signature = sha1(`jsapi_ticket=${jsTicket}&noncestr=${noncestr}&timestamp=${_timestamp}&url=${url}`)
    let wxConfig = `wx.config(${JSON.stringify({
      debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
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
  },

  async handleCreateStaff (ctx) {
    let staff = ctx.request.body

    let newStaff = await store.getStaffByUsername(staff.username)
    ctx.assert(!newStaff, 400, 'Staff username duplicated')

    newStaff = {
      username: staff.username,
      nickname: staff.nickname,
      userid: random(10, 'number'),
      shop: staff.shop,
      gender: staff.gender,
      job: staff.job,
      intro: staff.intro,
      photo: staff.photo,
      pwdHash: getPwdHash(staff.password),
      creationTime: Date.now(),
      status: 0,
      working: true
    }

    await store.createStaff(newStaff)
    ctx.body = { data: {} }
  },

  async handleUpdateStaff (ctx) {
    let staff = ctx.request.body
    await store.updateStaff(staff)
    ctx.body = { data: { staff } }
  },
  
  async handleUpdateStaffStatus (ctx) {
    let { userid } = ctx.params
    let staff = await store.getStaff(userid)
    let shop = await store.getShopInfo(staff.shop)
    let { status } = ctx.request.body
    let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`

    if (status === STAFF_STATUS.OFF_WORK) {
      let apms = await store.listWaitingAppointmentByStaff(userid)
      for (let apm of apms) {
        let { apmId, openid, shopId, waitNo } = apm

        await store.cancelApmOnStaffOffWork(apmId)

        //  {{first.DATA}}
        //  店名：{{keyword1.DATA}}
        //  领取号码：{{keyword2.DATA}}
        //  前面还有：{{keyword3.DATA}}
        //  {{remark.DATA}}
        await sendWxMsg(openid, wxQueueMsgTmplId, {
          first: { value: '排队提醒' },
          keyword1: { value: shop.name }, 
          keyword2: { value: waitNo },
          keyword3: { value: `预约已取消` },
          remark: { value: '因为发型师下班，您的预约已经被取消啦，请明天重新取号消费^_^' }
        }, msgUrl)
      }
    } else if (status === STAFF_STATUS.EATING) {
      let apms = await store.listWaitingAppointmentByStaff(userid)
      let apmCount = apms.length

      for (let i = 0; i < apmCount; i++) {
        let apm = apms[i]
        let { openid, waitNo } = apm

        //  {{first.DATA}}
        //  店名：{{keyword1.DATA}}
        //  领取号码：{{keyword2.DATA}}
        //  前面还有：{{keyword3.DATA}}
        //  {{remark.DATA}}
        await sendWxMsg(openid, wxQueueMsgTmplId, {
          first: { value: '排队提醒' },
          keyword1: { value: shop.name }, 
          keyword2: { value: waitNo },
          keyword3: { value: `${i}人` },
          remark: { value: '您预约的理发师暂时离开用餐了，请注意安排到店时间^_^' }
        }, msgUrl)
      }
    }
    await store.updateStaffStatus(userid, status)
    ctx.body = { data: {} }
  },

  async handleResetPwd (ctx) {
    let { userid } = ctx.params
    let { password } = ctx.request.body
    let pwdHash = getPwdHash(password)
    await store.resetStaffPwd(userid, pwdHash)
    ctx.body = { data: {} }
  },
  async handleListStaff (ctx) {
    let staffs = await store.listStaff()
    ctx.body = { data: { staffs } }
  },
  async handleGetStaff (ctx) {
    let { staffId } = ctx.params
    let staff = await store.getStaff(staffId)
    ctx.assert(staff, 404)
    let { category } = ctx.request.query
    if (category) {
      let prices = await store.getStaffCategoryPrice(staffId)
      let staff_category_price = prices.find(m=>m.code == category)
      staff.price = staff_category_price.price
    }
    ctx.body = { data: { staff } }
  },
  async handleGetServedUser (ctx) {
    let staffId = ctx.state.user.userid
    let { skip, limit } = ctx.request.query
    let nots = await store.listPayNotificationByStaffId({ staffId, limit, skip })
    let openids = []
    let users = []
    for (let not of nots) {
      let openid = not.openid
      if (!openids.includes(openid)) {
        openids.push(openid)
        let user = await store.getUserInfoByOpenid(openid)
        user.servedTime = not.createTime
        user.hairPhotos = user.hairPhotos || []
        users.push(user)
      }
    }

    ctx.body = { data: { users } }
  },

  async handleUpdateUserHairPhotos (ctx) {
    let { openid, hairPhotos } = ctx.request.body
    await store.updateUserHairPhotos(openid, hairPhotos)
    ctx.body = { data: {} }
  },

  async handleGetStaffInfo (ctx) {
    let staffId = ctx.state.user.userid
    let staff = await store.getStaff(staffId)
    ctx.body = { data: { staff } }
  },

  async handleUpdateStaffShop (ctx) {
    let staffs = await store.listStaff()
    for (let staff of staffs) {
      await store.db.findOneAndUpdate('staffs', { userid: staff.userid }, { $set: { shop: 'aWxcaOqV' } })
    }
    ctx.body = { data: {} }
  },

  async handleUpdateStaffWorking (ctx) {
    let staffId = ctx.state.user.userid
    let { working } = ctx.request.body
    let status = working ? STAFF_STATUS.WORKING : STAFF_STATUS.OFF_WORK
    await store.updateStaffStatus(staffId, status)
    ctx.body = { data: {} }
  },

  async mchtUpdateStaffStatus (ctx) {
    let staffId = ctx.state.user.userid
    let { status } = ctx.request.body
    await store.updateStaffStatus(staffId, status)
    ctx.body = { data: {} }
  },

  async handleSetStaffOpenid (ctx) {
    let staffId = ctx.state.user.userid
    let { openid } = ctx.request.body
    await store.updateStaffOpenid(staffId, openid)
    ctx.body = { data: {} }
  },

  async getStaffProductOption (ctx) {
    let { userid } = ctx.params
    let options = (await store.getStaffProductOption(userid)) || {}
    ctx.body = { data: { options } }
  },
  
  async adminGetStaffProductOption (ctx) {
    let { userid } = ctx.params
    let options = (await store.getStaffProductOption(userid)) || {}
    ctx.body = { data: { options } }
  },

  async setStaffProductOption (ctx) {
    let { userid } = ctx.params
    let options = ctx.request.body
    options = await store.setStaffProductOption(userid, options)
    ctx.body = { data: { options } }
  },

  async getStaffCategoryPrice (ctx) {
    let { userid } = ctx.params
    let categories = (await store.getStaffCategoryPrice(userid)) || {}
    ctx.body = { data: { categories } }
  },

  async setStaffCategoryPrice (ctx) {
    let { userid } = ctx.params
    let categories = ctx.request.body
    categories = await store.setStaffCategoryPrice(userid, categories)
    ctx.body = { data: { categories } }
  },

  async merchantListStaff (ctx) {
    let staffId = ctx.state.user.userid
    let staff = await store.getStaff(staffId)
    let staffs = await store.listStaffByShop(staff.shop)
    ctx.body = { data: { staffs } }
  },

  async listStaffServiceCase (ctx) {
    let { userid } = ctx.params
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let staff = await store.getStaff(userid)
    let services = await store.listCateServiceByShop(staff.shop)
    let serviceCases = (await store.listServiceCaseByStaffId(userid, start, end)) || []

    for (let s of serviceCases) {
      s.service = services.find(x => x.id === s.servId)
    }

    ctx.body = { data: { cases: serviceCases } }
  },

  async listStaffServiceCaseWithAuth (ctx) {
    let staffId = ctx.state.user.userid
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let staff = await store.getStaff(staffId)
    let services = await store.listCateServiceByShop(staff.shop)
    let serviceCases = (await store.listServiceCaseByStaffId(staffId, start, end)) || []

    for (let s of serviceCases) {
      s.service = services.find(x => x.id === s.servId)
    }

    ctx.body = { data: { cases: serviceCases } }
  },

  async listStaffServiceStats (ctx) {
    let { shopId } = ctx.params
    let { start, end } = ctx.request.query
    start = start ? parseInt(start, 10) : new Date().getTime()
    end = end ? parseInt(end, 10) : new Date().getTime()
    let staffs = await store.listStaffByShop(shopId)
    let services = await store.listCateServiceByShop(shopId)

    let stats = []
    
    for (let staff of staffs) {
      let data = { staff, serviceCount: 0 }

      // 列出工单
      let serviceCases = (await store.listServiceCaseByStaffId(staff.userid, start, end)) || []

      let serviceStats = []
      for (let s of services) {
        let servId = s.id

        let statsItem = {}
        let totalMoney = 0
        let actualMoney = 0
        let cashMoney = 0
        let apmMoney = 0

        let cases = serviceCases.filter(x => x.servId === servId)
        if (cases.length === 0) { continue }

        data.serviceCount += cases.length

        for (let c of cases) {
          totalMoney += c.price
          actualMoney += c.actualPrice
          if (c.apmId) { apmMoney += c.price }
          else { cashMoney += c.price }
        }

        serviceStats.push({
          service: s,
          count: cases.length,
          totalMoney,
          actualMoney,
          cashMoney,
          apmMoney
        })
      }

      data.stats = serviceStats

      stats.push(data)
    }

    ctx.body = { data: { stats } }
  },

  async getStaffPersonalPageData (ctx) {
    let staffId = ctx.state.user.userid
    let data = await store.getStaffPersonalData(staffId)
    ctx.body = { data: { profile: data } }
  },

  async setStaffPersonalPageData (ctx) {
    let staffId = ctx.state.user.userid
    let data = ctx.request.body
    await store.setStaffPersonalData(staffId, data)
    ctx.body = { data: { profile: data } }
  },

  async getStaffCommentStats (ctx) {
    let { staffId } = ctx.params
    let staff = await store.getStaff(staffId)
    let shopId = staff.shop
    let now = Date.now()
    let month = 1000 * 60 * 60 * 24 * 30
    let comments = []
    let start = now - month
    let end = now
    let maxFetching = 24
    let fetchingCount = 0
    let stats = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0, rateCount: 0 }

    do {
      comments = await store.listCommentByShop(shopId, start, end)
      for (let comment of comments) {
        comment.staffs = comment.staffs || []
        for (let s of comment.staffs) {
          let { userid, rating } = s
          if (userid !== staffId) continue
          stats.rateCount++
          switch (rating) {
            case 1:
              stats.star1++
              break
            case 2:
              stats.star2++
              break
            case 3:
              stats.star3++
              break
            case 4:
              stats.star4++
              break
            default:
              stats.star5++
          }
        }
      }

      fetchingCount++
      end = start
      start = start - month

    } while (comments.length > 0 && fetchingCount <= maxFetching)

    ctx.body = { data: { stats } }
  }

}

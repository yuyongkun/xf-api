const logger = require('../lib/log-console')

const { 
  wxAppointmentMsgTmplId,
  wxQueueMsgTmplId,
  wxCancelAppointmentMsgTmplId,
  wxPayMsgTmplId,
  wxQueueOnYourTurnTmplId,
  PROD_ENV
} = require('../config/app')
const sendWxMsg = require('./weixin/wx-msg-helper')
const {
  random,
  getFormatDate
} = require('../utils/')
const { APPOINTMENT_STATUS, CATEGORY_NAME, STAFF_STATUS } = require('../config/constants')
const store = require('../store/')


module.exports = {
  async handleMakeAppointment (ctx) {
    let { shopId, staffId } = ctx.params
    let { openid } = ctx.state.user
    const { category } = ctx.request.body
    const apmCount = await store.countAppointmentByStaff(staffId)
    const staff = await store.getStaff(staffId)
    const customer = await store.getUserInfoByOpenid(openid)
    const shop = await store.getShopInfo(shopId)

    let old = await store.getAppointment(openid, shopId, staffId)
    ctx.assert(!old, 409)

    await store.createAppointment({
      apmId: random(10),
      shopId,
      staffId,
      openid,
      category,
      createTime: Date.now(),
      waitNo: random(3, 'number'),
      status: APPOINTMENT_STATUS.WAITING
    })

    // {{first.DATA}}
    // 会员名称：{{keyword1.DATA}}
    // 预约时间：{{keyword2.DATA}}
    // 预约门店：{{keyword3.DATA}}
    // 预约项目：{{keyword4.DATA}}
    // 预约美发师：{{keyword5.DATA}}
    // {{remark.DATA}}
    if (PROD_ENV) {
      let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`

      // send message to customer
      await sendWxMsg(openid, wxAppointmentMsgTmplId, {
        first: { value: '你好，你已预约成功' },
        keyword1: { value: customer.nickname || '' }, 
        keyword2: { value: '随时到店' },
        keyword3: { value: shop.name },
        keyword4: { value: CATEGORY_NAME[`${category}`] },
        keyword5: { value: staff.nickname || staff.username },
        remark: { value: `前面还有${apmCount}人，请安排好到店时间，过号需重取。` }
      }, msgUrl)

      // send message to staff
      // TODO: check if this URL works
      msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fmcht&response_type=code&scope=snsapi_userinfo&state=staff-appointments#wechat_redirect`
      await sendWxMsg(staff.openid, wxAppointmentMsgTmplId, {
        first: { value: '你好发型师，有顾客预约了你的服务' },
        keyword1: { value: customer.nickname || '' },
        keyword2: { value: '随时到店' },
        keyword3: { value: shop.name },
        keyword4: { value: CATEGORY_NAME[`${category}`] },
        keyword5: { value: staff.nickname || staff.username },
        remark: { value: '请及时处理你的订单' }
      }, msgUrl)
    }

    ctx.body = { data: {} }
  },

  async handleExpireAppointment (ctx) {
    let { apmId } = ctx.params
    await store.expireAppointment(apmId)
    ctx.body = { data: {} }
  },

  async setAppointmentStatus (ctx) {
    let { apmId } = ctx.params
    let { status } = ctx.request.body
    let staffId = ctx.state.user.userid
    let targetApm = await store.getAppointmentByApmId(apmId)
    let targetShop = await store.getShopInfo(targetApm.shopId)

    await store.setAppointmentStatus(apmId, status, staffId)

    // send weixin message
    if ((status === APPOINTMENT_STATUS.CANCEL) && PROD_ENV) {
      let apms = await store.listWaitingAppointmentByStaff(staffId)
      let staff = await store.getStaff(staffId)
      let shop = await store.getShopInfo(staff.shop)
      let apmCount = apms.length

      // 通知排队顾客
      for (let i = 0; i < apmCount; i++) {
        let apm = apms[i]
        let { openid, category, shopId, waitNo } = apm
        let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`

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
          remark: { value: i === 0 ? '到您啦': '请安排好到店时间' }
        }, msgUrl)
      }
    }

    ctx.body = { data: {} }
  },

  async userCancelAppointment (ctx) {
    let { apmId } = ctx.params
    let apm = await store.getAppointmentByApmId(apmId)
    ctx.assert(apm, 404)

    await store.userCancelAppointment(apm.apmId)
    await sendQueueUpdateMsg(apm.staffId)
    await sendCancelAppointmentMsg(apm)

    ctx.body = { data: {} }
  },

  async handleListAppointmentByShop (ctx) {
    let staffId = ctx.state.user.userid
    let staff = await store.getStaff(staffId)
    let apms = await store.listAppointmentByShop(staff.shop)
    let users = []
    for (let apm of apms) {
      let user = await store.getUserInfoByOpenid(apm.openid)
      if (!user) { continue }
      let staff = await store.getStaff(apm.staffId)
      apm.staff = staff

      if (apm.status === APPOINTMENT_STATUS.SERVING) {
        apm.progress = await store.getServeProgress(apm.apmId)
      }

      user.appointment = apm
      user.servedTime = apm.createTime
      users.push(user)
    }
    ctx.body = { data: { users } }
  },

  async getAppointment (ctx) {
    let { apmId } = ctx.params
    let apm = await store.getAppointmentByApmId(apmId)
    let staff = await store.getStaff(apm.staffId)
    apm.staff = staff
    ctx.body = { data: { appointment: apm } }
  },

  async getCases (ctx) {
    let { apmId } = ctx.params
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
    for (let id of staffIds) {
      let staff = await store.getStaff(id)
      staff.rating = 5
      staffs.push(staff)
    }
    ctx.body = { data: { staffs } }
  },

  async handleListUserAppointment (ctx) {
    let { openid } = ctx.state.user
    let { status, offset, limit } = ctx.request.query
    status = status && parseInt(status, 10) ? parseInt(status, 10) : APPOINTMENT_STATUS.WAITING
    offset = offset && parseInt(offset, 10) ? parseInt(offset, 10) : 0
    limit = limit && parseInt(limit, 10) ? parseInt(limit, 10) : 10
    let { appointments, count } = await store.listAppointmentByOpenid(openid, status, offset, limit)
    for (let a of appointments) {
      a.staff = await store.getStaff(a.staffId)
      a.shop = await store.getShopInfo(a.shopId)
      if (status === APPOINTMENT_STATUS.WAITING) {
        let apms = await store.listAppointmentByStaff(a.staffId)
        let index = apms.findIndex(apm => apm.openid === openid)
        a.waitPeople = index > 0 ? index : apms.length
      }
    }
    ctx.body = { data: { bookings: appointments, count } }
  },

  async handleListAppointmentStaff (ctx) {
    let { shopId } = ctx.params
    let { openid } = ctx.state.user
    let _staffs = await store.listStaffByShop(shopId)
    let staffs = []
    for (let staff of _staffs) {
      // only show staff that is not left or not on holiday
      if (staff.status === STAFF_STATUS.LEFT || staff.status === STAFF_STATUS.ON_HOLIDAY) { continue }

      // 不显示未绑定微信的员工
      if (!staff.openid) { continue }

      // do not show staff whose price is 0
      let res = await store.getStaffCategoryPrice(staff.userid)
      let { category } = ctx.request.query
      let staff_category_price = res.find(m=>m.code == category)
      if (staff_category_price && staff_category_price.price === 0) { continue }
      
      staff.price = staff_category_price.price

      let apmCount = await store.countAppointmentByStaff(staff.userid)
      staff.apmCount = apmCount

      staffs.push(staff)
    }

    // 价格从高到低排序
    staffs.sort((a, b) => {
      return b.price - a.price
    })

    console.log('apm staffs sorted by price: %j', staffs)

    let sortedStaffs = []
    // 上次服务过的员工排在第一位
    if (openid) {
      let latestApm = await store.getLatestDoneApmByOpenid(openid)
      console.log('latestApm: %j', latestApm)
      if (latestApm) {
        let cases = await store.getCasesByApmId(latestApm.apmId)
        console.log('latest apm cases: %j', cases)
        let assistantExisted = false
        let haircutExisted = false
        let permExisted = false
        for (let a of cases) {
          if (a.assistant) {
            assistantExisted = a.assistant
          }
          if (a.haircut) {
            haircutExisted = a.haircut
          }
          if (a.perm) {
            permExisted = a.perm
          }
        }

        let targetId
        if (haircutExisted) {
          targetId = haircutExisted
        } else if (permExisted) {
          targetId = permExisted
        } else if (assistantExisted) {
          targetId = assistantExisted
        }

        if (targetId) {
          let targetStaffIndex = staffs.findIndex(s => s.userid === targetId)
          if (targetStaffIndex > -1) {
            let targetStaff = staffs.splice(targetStaffIndex, 1)[0]
            targetStaff.mark = '上次预约'
            sortedStaffs.push(targetStaff, ...staffs)
            ctx.body = { data: { staffs: sortedStaffs } }
            return
          } else {
            sortedStaffs = staffs
          }
        } else {
          sortedStaffs = staffs
        }
      }
    } else {
      sortedStaffs = staffs
    }

    ctx.body = { data: { staffs } }
  },

  async updateServeProgress (ctx,) {
    let { apmId } = ctx.params
    let progress = ctx.request.body
    let res = await store.updateServeProgress(apmId, progress)
    ctx.body = { data: { progress: res } }
  },

  async sendPayMsg (ctx) {
    let staffId = ctx.state.user.userid
    let msg = ctx.request.body
    let staff = await store.getStaff(staffId)
    let msgId = random(8)

    msg.price = Number(msg.price)
    ctx.assert(!isNaN(msg.price), 500, 'Invalid price')
    msg.price = msg.price * 100 // 转换成以分为单位保存

    msg = Object.assign(msg, {
      shopId: staff.shop,
      createTime: Date.now(),
      paid: false
    })

    let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=pay-msg-${msgId}#wechat_redirect`
    msg.msgId = msgId

    await store.createPayNotification(msg)
    await store.setAppointmentPayMsgStatus(msg.apmId, { msgId, msgSent: true })

    // {{first.DATA}}
    // 服务项目：{{keyword1.DATA}}
    // 订单金额：{{keyword2.DATA}}
    // 美容师：{{keyword3.DATA}}
    // {{remark.DATA}}
    await sendWxMsg(msg.openid, wxPayMsgTmplId, {
      first: { value: '尊敬的顾客，您有一笔待支付的订单' },
      keyword1: { value: CATEGORY_NAME[`${msg.category}`] },
      keyword2: { value: staff.username },
      remark: { value: '戳我完成支付，使用积分可以打折哦' }
    }, msgUrl)

    ctx.body = { data: {} }
  },

  async getPayMsg (ctx) {
    let { msgId } = ctx.params
    let msg = await store.getPayNotification(msgId)
    let staff = await store.getStaff(msg.staffId)
    msg.staff = staff
    ctx.body = { data: { msg } }
  },

  async getUserPayMsg (ctx) {
    let { openid } = ctx.state.user
    let { msgId } = ctx.params
    let msg = await store.getPayNotification(msgId)
    let staff = await store.getStaff(msg.staffId)
    let isOrderLocked = await store.isOrderLocked(openid, msgId)
    Object.assign(msg, { staff, isOrderLocked })
    ctx.body = { data: { msg } }
  },

  async createServiceCase (ctx) {
    let staffId = ctx.state.user.userid
    let { cases, msg } = ctx.request.body
    let case1 = cases[0]
    let apm

    if (case1 && case1.apmId) {
      apm = await store.getAppointmentByApmId(case1.apmId)
    }

    if (PROD_ENV) {

      // 发送评价提醒消息
      if (apm) {
        let shop = await store.getShopInfo(apm.shopId)
        let staff = await store.getStaff(apm.staffId)

        // {{first.DATA}}
        // 姓名：{{keyword1.DATA}}
        // 项目：{{keyword2.DATA}}
        // 完成时间：{{keyword3.DATA}}
        // {{remark.DATA}}
        // let rateMsgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fredirect%2Fhome&response_type=code&scope=snsapi_base&state=rate-apm-${apm.shopId}-${apm.apmId}-${apm.staffId}#wechat_redirect`
        // await sendWxMsg(apm.openid, wxRateMsgTmplId, {
        //   first: { value: '你好，你有服务未评价' },
        //   keyword1: { value: staff.username },
        //   keyword2: { value: CATEGORY_NAME[`${apm.category}`] },
        //   keyword3: { value: getFormatDate() },
        //   remark: { value: '点击评价。您的意见是对我们最好的鼓励！评价后可领取优惠券！' }
        // }, rateMsgUrl)

        // 更新预约状态
        await store.setAppointmentStatus(apm.apmId, APPOINTMENT_STATUS.DONE, apm.staffId)

        // 发送排队提醒消息
        let apms = await store.listWaitingAppointmentByStaff(staffId)
        let apmCount = apms.length

        // 通知排队顾客
        for (let i = 0; i < apmCount; i++) {
          let apm = apms[i]
          let { openid, category, shopId, waitNo } = apm
          let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`

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
            remark: { value: i === 0 ? '到您啦': '请安排好到店时间' }
          }, msgUrl)
        }
      }
    }

    for (let item of cases) {
      item.createTime = Date.now()
      item.createdBy = staffId
      item.caseId = random(16)
      item.shopId = item.shopId ? item.shopId : (apm ? apm.shopId : '')
      item.paid = false
      item.price = parseInt(item.price) * 100 // 转换成分为单位保存
      await store.createServiceCase(item)
    }

    // 务必在创建工单完成以后再发送付款消息
    if (PROD_ENV) {
      // 发送付款消息
      msg.price = Number(msg.price)
      ctx.assert(!isNaN(msg.price), 500, 'Invalid price')
      await sendPayMsg({ staffId, msg })
    }

    ctx.body = { data: {} }
  },

  async createServiceCasesWithoutPayMsg (ctx) {
    let staffId = ctx.state.user.userid
    let { cases } = ctx.request.body
  
    for (let item of cases) {
      item.createTime = Date.now()
      item.createdBy = staffId
      item.caseId = random(16)
      item.paid = true
      item.price = parseInt(item.price) * 100 // 转换成分为单位保存
      item.actualPrice = item.price
      item.couponAmount = 0
      item.couponIds = []
  
      await store.createServiceCase(item)
    }
  
    ctx.body = { data: {} }
  },

  async getServiceCaseDraft (ctx) {
    let { apmId } = ctx.params
    let res = await store.getServiceCaseDraft(apmId)
    ctx.body = { data: { serviceCases: res.serviceCases } }
  },

  async updateServiceCaseDraft (ctx) {
    let { apmId } = ctx.params
    let { serviceCases } = ctx.request.body
    await store.updateServiceCaseDraft(apmId, serviceCases)
    ctx.body = { data: {} }
  },

  async sendOnYourTurnMsg (ctx) {
    let { openid, apmId } = ctx.request.body
    let apm = await store.getAppointmentByApmId(apmId)
    let shop = await store.getShopInfo(apm.shopId)
    let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`
    await sendWxMsg(openid, wxQueueOnYourTurnTmplId, {
      first: { value: '排队已经到您了！' },
      keyword1: { value: shop.name },
      keyword2: { value: apm.waitNo },
      remark: { value: '请联系店内工作人员进行消费吧' }
    }, msgUrl)
    ctx.body = { data: {} }
  }
}

async function sendQueueUpdateMsg (staffId) {
  try {
    let apms = await store.listWaitingAppointmentByStaff(staffId)
    let staff = await store.getStaff(staffId)
    let shop = await store.getShopInfo(staff.shop)
    let apmCount = apms.length

    for (let i = 0; i < apmCount; i++) {
      let apm = apms[i]
      let { openid, category, shopId, waitNo } = apm
      let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`

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
        remark: { value: i === 0 ? '到您啦': '请安排好到店时间' }
      }, msgUrl)
    }
  } catch (e) {
    console.error(e)
    console.log('send weixin queue message error')
  }
}

async function sendCancelAppointmentMsg (apm) {
  let { openid, category, shopId, waitNo } = apm
  let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=shop-bookings#wechat_redirect`
  // {{first.DATA}}
  // 预约内容：{{keyword1.DATA}}
  // 预约时间：{{keyword2.DATA}}
  // {{remark.DATA}}
  // {{remark.DATA}}
  await sendWxMsg(apm.openid, wxCancelAppointmentMsgTmplId, {
    first: { value: '您好，您已取消预约' },
    keyword1: { value: CATEGORY_NAME[`${category}`] },
    keyword2: { value: getFormatDate(new Date(apm.createTime)) },
    remark: { value: '祝您生活愉快' }
  }, msgUrl)
}

async function sendPayMsg ({ staffId, msg }) {
  let staff = await store.getStaff(staffId)
  let msgId = random(8)

  msg.price = msg.price * 100 // 转换成以分为单位保存

  msg = Object.assign(msg, {
    shopId: staff.shop,
    createTime: Date.now(),
    paid: false
  })

  let msgUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_base&state=pay-msg-${msgId}#wechat_redirect`
  msg.msgId = msgId

  await store.createPayNotification(msg)
  await store.setAppointmentPayMsgStatus(msg.apmId, { msgId, msgSent: true })

  // {{first.DATA}}
  // 服务项目：{{keyword1.DATA}}
  // 订单金额：{{keyword2.DATA}}
  // 美容师：{{keyword3.DATA}}
  // {{remark.DATA}}
  await sendWxMsg(msg.openid, wxPayMsgTmplId, {
    first: { value: '尊敬的顾客，您有一笔待支付的订单' },
    keyword1: { value: msg.categories.map(c => CATEGORY_NAME[c]).join('、') },
    keyword2: { value: `$${msg.price/100}.00` },
    keyword3: { value: staff.username },
    remark: { value: '戳我完成支付，使用积分可以打折哦' }
  }, msgUrl)
}



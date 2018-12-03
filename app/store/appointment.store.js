const APPOINTMENTS = 'appointments'
const serve_progress = 'serve_progress'
const pay_notifications = 'pay_notifications'
const service_cases = 'service_cases'
const service_case_draft = 'service_case_draft'
const { APPOINTMENT_STATUS } = require('../config/constants')

module.exports = {
  async createAppointment (appointment) {
    return await this.db.insertOne(APPOINTMENTS, appointment)
  },
  async getAppointment (openid) {
    return await this.db.findOne(APPOINTMENTS, {
      openid,
      status: { $in: [APPOINTMENT_STATUS.WAITING, APPOINTMENT_STATUS.SERVING] }
    })
  },
  async getDoneAppointment (openid, apmId, staffId) {
    return await this.db.findOne(APPOINTMENTS, {
      openid,
      apmId,
      status: APPOINTMENT_STATUS.DONE
    })
  },
  async expireAppointment (apmId) {
    return await this.db.findOneAndUpdate(APPOINTMENTS, { apmId }, {
      $set: {
        status: 3,
        expired: true,
        expiredTime: Date.now()
      }
    })
  },

  async setAppointmentStatus (apmId, status, staffId) {
    let $set = { status }
    let now = Date.now()

    if (status === APPOINTMENT_STATUS.SERVING) {
      $set.start_serving_by = staffId
      $set.start_serving_time = now
    }

    if (status === APPOINTMENT_STATUS.DONE) {
      $set.end_serving_by = staffId
      $set.end_serving_time = now
    }

    if (status === APPOINTMENT_STATUS.CANCEL) {
      $set.cancel_by_staff = true
      $set.cancel_by = staffId
      $set.cancel_time = now
    }

    return await this.db.findOneAndUpdate(APPOINTMENTS, { apmId }, { $set })
  },

  async userCancelAppointment (apmId) {
    return await this.db.findOneAndUpdate(APPOINTMENTS, { apmId }, {
      $set: {
        status: APPOINTMENT_STATUS.CANCEL,
        cancel_by_user: true,
        cancel_time: Date.now()
      }
    })
  },

  async getAppointmentByApmId (apmId) {
    return await this.db.findOne(APPOINTMENTS, { apmId })
  },
  async getCasesByApmId (apmId) {
    return await this.db.find(service_cases, { apmId })
  },
  async listWaitingAppointmentByStaff (staffId) {
    let apms =  await this.db.find(APPOINTMENTS, {
      staffId,
      status: APPOINTMENT_STATUS.WAITING
    }, {
      sort: { createTime: 1 }
    })
    let res = []
    for (let apm of apms) {
      let user = await this.getUserInfoByOpenid(apm.openid)
      let shop = await this.getShopInfo(apm.shopId)
      if (user && shop) { res.push(apm) }
    }
    return res
  },

  async listAppointmentByOpenid (openid, status, offset = 0, limit = 10) {
    let query = { openid, status }
    let params = {
      sort: { createTime: -1 },
      skip: offset,
      limit
    }

    let appointments = await this.db.find(APPOINTMENTS, query, params)
    let count = await this.db.count(APPOINTMENTS, query)
    return { appointments, count }
  },

  async getLatestDoneApmByOpenid (openid) {
    let query = {
      openid,
      status: APPOINTMENT_STATUS.DONE
    }
    let params = {
      sort: { createTime: -1 },
      limit: 1
    }
    let appointments = await this.db.find(APPOINTMENTS, query, params)
    return appointments[0]
  },

  async countAppointmentByStaff (staffId) {
    let apms = await this.db.find(APPOINTMENTS, {
      staffId,
      status: APPOINTMENT_STATUS.WAITING
    })
    let res = []
    for (let apm of apms) {
      let user = await this.getUserInfoByOpenid(apm.openid)
      let shop = await this.getShopInfo(apm.shopId)
      if (user && shop) { res.push(apm) }
    }
    return res.length
  },

  async countAppointmentByShop (shopId) {
    let apms = await this.db.find(APPOINTMENTS, {
      shopId,
      status: { $in: [ APPOINTMENT_STATUS.WAITING ] }
    })
    let res = []
    for (let apm of apms) {
      let user = await this.getUserInfoByOpenid(apm.openid)
      if (user) { res.push(apm) }
    }
    return res.length
  },

  async listAppointmentByStaff (staffId) {
    let apms = await this.db.find(APPOINTMENTS, {
      staffId,
      status: APPOINTMENT_STATUS.WAITING
    })
    let res = []
    for (let apm of apms) {
      let user = await this.getUserInfoByOpenid(apm.openid)
      let shop = await this.getShopInfo(apm.shopId)
      if (user && shop) { res.push(apm) }
    }
    return res
  },

  async listAppointmentByShop (shopId) {
    return await this.db.find(APPOINTMENTS, {
      shopId,
      status: { $in: [ APPOINTMENT_STATUS.WAITING, APPOINTMENT_STATUS.SERVING ] }
    })
  },

  async updateServeProgress (apmId, progress) {
    let res = await this.db.findOne(serve_progress, { apmId })
    if (res) {
      delete progress._id
      await this.db.findOneAndUpdate(serve_progress, { apmId }, { $set: progress })
    } else {
      await this.db.insertOne(serve_progress, progress)
    }
    res = await this.db.findOne(serve_progress, { apmId })
    return res
  },

  async getServeProgress (apmId) {
    return await this.db.findOne(serve_progress, { apmId })
  },

  async createPayNotification (notification) {
    return await this.db.insertOne(pay_notifications, notification)
  },

  async getPayNotification (msgId) {
    let msg = await this.db.findOne(pay_notifications, { msgId })
    msg.shop = await this.getShopInfo(msg.shopId)
    msg.staff = await this.getStaff(msg.staffId)
    return msg
  },

  async updatePayNotification (msgId, paid, orderId, oriPrice, actualPrice, couponId) {
    let $set = { paid, orderId, oriPrice, actualPrice, couponId }
    return await this.db.findOneAndUpdate(pay_notifications, { msgId }, { $set })
  },

  async setAppointmentPayMsgStatus (apmId, { msgId, msgSent }) {
    return await this.db.findOneAndUpdate(APPOINTMENTS, {apmId}, { $set: { msgSent, msgId } })
  },

  async updateAppointmentPaidStatus (apmId, paid) {
    return await this.db.findOneAndUpdate(APPOINTMENTS, {apmId}, { $set: { paid } })
  },

  async createServiceCase (serviceCase) {
    return await this.db.insertOne(service_cases, serviceCase)
  },

  async updateServiceCase (serviceCase) {
    return await this.db.findOneAndUpdate(service_cases, { caseId: serviceCase.caseId }, { $set: serviceCase })
  },

  // list served user according to pay notifications
  async listPayNotificationByStaffId ({ staffId, limit = 10, skip = 0 }) {
    return await this.db.find(pay_notifications, { staffId, paid: true }, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      sort: { createTime: -1 }
    })
  },

  async listServiceCaseByApmId (apmId) {
    return await this.db.find(service_cases, { apmId })
  },

  async updateServiceCaseDraft (apmId, serviceCases) {
    return this.db.findOneAndUpdate(service_case_draft, { apmId }, {$set: { apmId, serviceCases }}, { upsert: true })
  },

  async getServiceCaseDraft (apmId) {
    return (await this.db.findOne(service_case_draft, { apmId })) || { apmId, serviceCases: [] }
  },

  async updateApmRateStatus (apmId, rated) {
    return await this.db.findOneAndUpdate(APPOINTMENTS, { apmId }, { $set: { rated } })
  },

  async countUnratedApm(start, end, limit, skip) {
    return await this.db.find(APPOINTMENTS, {
      createTime: { $gt: start, $lt: end },  // 在某段时间内
      status: APPOINTMENT_STATUS.DONE,       // 已完成服务
      paid: true,                            // 已付款
      rated: { $exits: false },              // 未评价
    }, {
      limit,
      skip
    })
  },

  async listUnratedApm(start, end, limit, skip) {
    return await this.db.find(APPOINTMENTS, {
      createTime: { $gt: start, $lt: end },  // 在某段时间内
      status: APPOINTMENT_STATUS.DONE,       // 已完成服务
      paid: true,                            // 已付款
      rated: { $exits: false },              // 未评价
    }, {
      limit,
      skip
    })
  },

  async cancelApmOnStaffOffWork(apmId) {
    return this.db.findOneAndUpdate(APPOINTMENTS, { apmId }, {
      $set: { status: APPOINTMENT_STATUS.CANCEL }
    })
  }
}

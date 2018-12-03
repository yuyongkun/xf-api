const { STAFF_STATUS } = require('../config/constants')
const { random } = require('../utils')

const staff_tokens = 'staff_tokens'
const staff_product_options = 'staff_product_options'
const staff_category_price = 'staff_category_price'
const service_cases = 'service_cases'
const staff_personal_data = 'staff_personal_data'

const TOKEN_EXPIRES_IN = 1000 * 60 * 60 * 24 * 90 // 90 days

module.exports = {
  keyToStaffSessionByAccessToken: (token) => `staff-sessions/${token}`,

  async saveStaffSession(staffSession, options) {
    await this.cache.set(this.keyToStaffSessionByAccessToken(staffSession.access_token), staffSession, options)
  },

  async getStaffSession({ access_token }) {
    return await this.cache.get(this.keyToStaffSessionByAccessToken(access_token))
  },

  async getStaff (userid) {
    let staff = await this.db.findOne('staffs', { userid })
    if (!staff) return null
    let personalData = await this.getStaffPersonalData(userid)
    staff.personalData = personalData
    return staff
  },

  async getStaffInfo (userid) {
    return await this.db.findOne('staffs', { userid })
  },

  async getStaffInfoByOpenid (openid) {
    return await this.db.findOne('staffs', { openid })
  },

  async listStaff () {
    let staffs = await this.db.find('staffs', {
      status: { $ne: STAFF_STATUS.LEFT }
    })
    return staffs.map(staff => {
      delete staff.pwdHash
      return staff
    })
  },

  async updateStaff (staff) {
    return await this.db.findOneAndUpdate('staffs', {
      userid: staff.userid
    }, {
      $set: staff
    })
  },
  async updateStaffStatus (userid, status) {
    let $set = { status }
    if (status === STAFF_STATUS.LEFT) {
      $set.openid = ''
    }
    return await this.db.findOneAndUpdate('staffs', { userid }, { $set })
  },

  async resetStaffPwd (userid, pwdHash) {
    return await this.db.findOneAndUpdate('staffs', {
      userid,
    }, {
      $set: {
        pwdHash
      }
    })
  },

  async createStaff (staff) {
    await this.db.insertOne('staffs', staff)
  },

  async getStaffByUsername (username) {
    return await this.db.findOne('staffs', {
      username
    })
  },

  async updateStaffWorkingStatus (userid, working) {
    return await this.db.findOneAndUpdate('staffs', { userid }, { $set: { working: Boolean(working) } })
  },

  async updateStaffOpenid (userid, openid) {
    return await this.db.findOneAndUpdate('staffs', { userid }, { $set: { openid } })
  },

  async listStaffByShop (shopId) {
    let staffs = (await this.db.find('staffs', {
      shop: shopId,
      status: { $ne: STAFF_STATUS.LEFT }
    })) || []
    return staffs.map(staff => {
      delete staff.pwdHash
      return staff
    })
  },

  async getStaffCategoryPrice (userid) {  
    let result = await this.db.findOne(staff_category_price, { userid }) || {}
    if (!result.categories) {
      result.categories = []
      let categories = await this.db.find('categories')
      for (let category of categories) {
        category.price = 0
        result.categories.push(category)
      }
    } 
    return result.categories
  },

  async getStaffProductOption (userid) {
    let result = (await this.db.findOne(staff_product_options, { userid })) || {}
    let oldOptions = result.options || {}
    let staff = await this.getStaff(userid)
    let products = (await this.listPrimaryProducts(staff.shop)) || []

    let latestOptions = {}
    for (let prod of products) {
      let prodOptions = prod.countOption
      let staffProdOptions = oldOptions[prod.category]

      if (!staffProdOptions) {
        latestOptions[prod.category] = prodOptions
        continue
      }

      let newStaffProdOptions = []

      for (let opt of staffProdOptions) {
        let optValid = false
        for (let _opt of prodOptions) {
          if (_opt.id === opt.id) {
            optValid = true
            break
          }
        }

        if (optValid) {
          newStaffProdOptions.push(opt)
        }
      }

      latestOptions[prod.category] = newStaffProdOptions
    }
    this.setStaffProductOption(userid, latestOptions)

    return latestOptions
  },

  async setStaffProductOption (userid, options) {
    let res = await this.db.findOne(staff_product_options, { userid })
    if (res) {
      await this.db.findOneAndUpdate(staff_product_options, { userid }, { $set: { options } })
    } else {
      await this.db.insertOne(staff_product_options, { userid, options })
    }
    res = await this.db.findOne(staff_product_options, { userid })
    return res.options
  },

  async setStaffCategoryPrice (userid, categories) {
    let res = await this.db.findOne(staff_category_price, { userid })
    if (res) {
      await this.db.findOneAndUpdate(staff_category_price, { userid }, { $set: { categories } })
    } else {
      await this.db.insertOne(staff_category_price, { userid, categories })
    }
    res = await this.db.findOne(staff_category_price, { userid })
    return res.categories
  },

  async listServiceCaseByStaffId (staffId, start, end) {
    return await this.db.find(service_cases, {
      // 只统计指定二级分类的工单
      paid: true,
      servId: { $exists: true },
      $or: [{ assistant: staffId }, { haircut: staffId }, { perm: staffId }],
      createTime: { $gte: start, $lte: end }
    })
  },

  async getStaffPersonalData (userid) {
    let res = await this.db.findOne(staff_personal_data, { userid })
    return res && res.data ? res.data : {
      jobs: [],
      works: [],
      videos: []
    }
  },

  async setStaffPersonalData (userid, data) {
    return await this.db.update(staff_personal_data, { userid }, { $set: { data, userid } }, { upsert: true })
  },

  async generateStaffToken ({ openid, staffId }) {
    let token = random(32)
    await this.db.insertOne(staff_tokens, { openid, staffId, token, expireTime: Date.now() + TOKEN_EXPIRES_IN })
    return token
  },

  async getStaffInfoByToken (token) {
    let tokenObj = await this.db.findOne(staff_tokens, { token })
    console.log('staff token object: %j', tokenObj)
    if (!tokenObj) {
      return null
    }
    if (tokenObj.expireTime < Date.now()) {
      await this.db.deleteOne(staff_tokens, { token })
      return null
    }
    let { openid, staffId } = tokenObj
    if (openid) {
      return this.getStaffInfoByOpenid(openid)
    } else if (staffId) {
      return this.getStaffInfo(staffId)
    }

    return null
  },

}
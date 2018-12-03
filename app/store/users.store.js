const { random } = require('../utils')

const user_wx_oauth_tokens = 'user_wx_oauth_tokens'
const user_tokens = 'user_tokens'

const TOKEN_EXPIRES_IN = 1000 * 60 * 60 * 24 * 90 // 90 days

module.exports = {
  async createUser (user) {
    return await this.db.insertOne('users', user)
  },

  async getUserInfoByOpenid (openid) {
    return await this.db.findOne('users', { openid })
  },

  async updateUserHairPhotos (openid, hairPhotos) {
    return await this.db.findOneAndUpdate('users', { openid }, { $set: { hairPhotos } })
  },

  async updateUserWxInfo (user) {
    return await this.db.findOneAndUpdate('users', { openid: user.openid }, {
      $set: {
        nickname: user.nickname,
        sex: user.sex,
        province: user.province,
        city: user.city,
        country: user.country,
        headimgurl: user.headimgurl,
        privilege: user.privilege,
      }
    }, { upsert: true })
  },

  async listUser (limit, skip) {
    return await this.db.find('users', {}, { limit, skip })
  },

  async countUser () {
    return await this.db.count('users', {})
  },

  async getUserOAuthToken (openid) {
    return await this.db.findOne(user_wx_oauth_tokens, { openid })
  },

  async generateUserToken (openid) {
    let token = random(32)
    await this.db.insertOne(user_tokens, { openid, token, expireTime: Date.now() + TOKEN_EXPIRES_IN })
    return token
  },

  async getUserInfoByToken (token) {
    let tokenObj = await this.db.findOne(user_tokens, { token })
    if (!tokenObj) {
      return null
    }
    if (tokenObj.expireTime < Date.now()) {
      await this.db.deleteOne(user_tokens, { token })
      return null
    }
    let { openid } = tokenObj
    return this.getUserInfoByOpenid(openid)
  }
}
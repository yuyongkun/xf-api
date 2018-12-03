const axios = require('axios')

const logger = require('../lib/log-console')

const {
  wxToken,
  wxEncodingAESKey,
  wxAccessTokenUrl,
  wxAccessTokenTTL,
  wxAccessTokenCacheKey,
  wxOAuthAccessTokenCachePrefix,
  wxAppid,
  wxAppSecret,
  wxCreateMenuUrl,
  wxGetUserInfoUrl,
  wxOAuthAccessTokenUrl,
  wxJSTicketUrl,
  wxJSTicketCacheKey,
  wxGetOAuthAccessTokenByRefreshTokenUrl,
  wxGetUserInfoByAccessTokenUrl,
} = require('../config/app')

const user_wx_oauth_tokens = 'user_wx_oauth_tokens'
const staff_wx_oauth_tokens = 'staff_wx_oauth_tokens'


module.exports = {

  async getWxAccessToken () {
    let token = await this.cache.get(wxAccessTokenCacheKey)
    logger.log('wx access token: ', token)
    if (!token) {
      logger.log('Access token expired or not existed. Try to get a new one...')
      let resp = await axios.get(wxAccessTokenUrl, {
        params: {
          grant_type: 'client_credential',
          appid: wxAppid,
          secret: wxAppSecret
        }
      })
      logger.log('Response from weixin: %j', resp.data)
      let { access_token, expires_in } = resp.data
      await this.cache.set(wxAccessTokenCacheKey, access_token, { ttl: expires_in })
      return access_token
    }
    return token
  },

  async getWxOAuth2AccessToken (code) {
  },

  async getWxUserInfo (openid) {
    let token = await this.getWxAccessToken()
    logger.log('get user info from weixin, openid = ', openid)
    let resp = await axios({
      method: 'get',
      url: wxGetUserInfoUrl,
      params: {
        access_token: token,
        lang: 'zh_CN',
        openid
      }
    })
    logger.log('Response from weixin: %j', resp.data)
    return resp.data
  },

  async getOAuthAccessToken (code) {
    logger.log('get oauth access token from weixin, code = ', code)
    let resp = await axios({
      method: 'get',
      url: wxOAuthAccessTokenUrl,
      params: {
        appid: wxAppid,
        secret: wxAppSecret,
        grant_type: 'authorization_code',
        code
      }
    })
    logger.log('Response from weixin: %j', resp.data)
    return resp.data
  },

  async getJSTicket () {
    let ticket = await this.cache.get(wxJSTicketCacheKey)
    if (!ticket) {
      logger.log('JS ticket expired or not existed. Try to get a new one...')
      let token = await this.getWxAccessToken()
      let resp = await axios.get(wxJSTicketUrl, {
        params: {
          access_token: token,
          type: 'jsapi'
        }
      })
      logger.log('Response from weixin: %j', resp.data)
      let { errcode, errmsg, ticket, expires_in } = resp.data
      await this.cache.set(wxJSTicketCacheKey, ticket, { ttl: expires_in })
      return ticket
    }
    return ticket
  },

  async refreshAccessToken (refreshToken) {
    let resp = await axios({
      method: 'get',
      url: wxGetOAuthAccessTokenByRefreshTokenUrl,
      params: {
        appid: wxAppid,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }
    })
    return resp.data
  },

  async getUserInfoByAccessToken (accessToken, openid) {
    let resp = await axios({
      method: 'get',
      url: wxGetUserInfoByAccessTokenUrl,
      params: {
        access_token: accessToken,
        openid,
        lang: 'zh_CN',
      }
    })
    logger.log('get user info by by access token response', resp.data)
    return resp.data
  },

  async getUserInfoByWxAuthCode (code) {
    let data
    try {
      data = await this.getOAuthAccessToken(code)
      // 200 resp:
      // { "access_token":"ACCESS_TOKEN",
      // "expires_in":7200,
      // "refresh_token":"REFRESH_TOKEN",
      // "openid":"OPENID",
      // "scope":"SCOPE" }
    } catch (e) {
      logger.error('get oauth access token error', e)
      throw e
    }
    let { openid, access_token, refresh_token, expires_in } = data
    // let user = await this.getUserInfoByOpenid(openid)
    // let userAuthTokens = await this.getUserOAuthToken(openid)
    // 为了不每次授权的时候都重新向微信服务器请求用户信息,
    // 我们在第一次授权的时候就将用户信息保存到我方服务器
    // 下一次请求的时候，如果用户已存在，而且 access token 没有过期
    // 则直接返回该用户
    // 如果 access token 过期，重新请求该用户信息
    // let now = Date.now()
    // if (user && userAuthTokens && now < userAuthTokens.expiredTime) {
    //   return user
    // }

    try {
      user = await this.getUserInfoByAccessToken(access_token, openid)
      // 200 resp:
      // { 
      //   "openid":" OPENID",
      //   "nickname": NICKNAME,
      //   "sex":"1",
      //   "province":"PROVINCE"
      //   "city":"CITY",
      //   "country":"COUNTRY",
      //   "headimgurl":    "http://thirdwx.qlogo.cn/mmopen/g3MonUZtNHkdmzicIlibx6iaFqAc56vxLSUfpb6n5WKSYVY0ChQKkiaJSgQ1dZuTOgvLLrhJbERQQ4eMsv84eavHiaiceqxibJxCfHe/46",
      //   "privilege":[ "PRIVILEGE1" "PRIVILEGE2"     ],
      //   "unionid": "o6_bmasdasdsad6_2sgVt7hMZOPfL"
      // }
    } catch (e) {
      logger.error('get user info by access token error', e)
      throw e
    }

    // 保险起见，比官方给出的过期时间早200秒
    // let expiredTime = now + expires_in - 200
    // await this.updateUserWxInfo(user)
    // await this.updateUserOAuthToken(openid, access_token, refresh_token, expiredTime)

    return user
  },

  async getUserOAuthToken (openid) {
    return await this.db.findOne(user_wx_oauth_tokens, { openid })
  },

  async updateUserOAuthToken (openid, accessToken, refreshToken, expiredTime) {
    return await this.db.findOneAndUpdate(user_wx_oauth_tokens, { openid }, {
      $set: {
        accessToken,
        refreshToken,
        expiredTime
      }
    }, {
      upsert: true
    })
  },

  async getOpenidByWxAuthCode (code) {
    let data
    try {
      data = await this.getOAuthAccessToken(code)
    } catch (e) {
      logger.error('get oauth access token error', e)
      throw e
    }
    let { openid } = data
    return openid
  },

  async getStaffInfoByWxAuthCode (code) {
    let openid = await this.getOpenidByWxAuthCode(code)
    return await this.getStaffInfoByOpenid(openid)
  }

}

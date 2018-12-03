const fs = require('fs')
const path = require('path')

const store = require('../store')
const { mchtRootPath } = require('../config/app')
const { random } = require('../utils')
const { STAFF_STATUS } = require('../config/constants')

const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 90 // 90 days

module.exports = {
  async authShop (ctx) {
    let { code, state } = ctx.request.query
    let user = await store.getUserInfoByWxAuthCode(code)
    // 生成 token
    let token = await store.generateUserToken(user.openid)
    ctx.cookies.set('T', token, { httpOnly: false, maxAge: COOKIE_MAX_AGE })
    let targetView = state === 'shop-home-user' ? 'me': 'home'
    ctx.cookies.set('TARGET_VIEW', targetView, { httpOnly: false, maxAge: COOKIE_MAX_AGE, overwrite: true })
    ctx.redirect(`/shop-home?state=${state}`)
  },

  async authMcht (ctx) {
    let { code, state } = ctx.request.query
    let openid = await store.getOpenidByWxAuthCode(code)
    ctx.assert(openid, 500)

    let staff = await store.getStaffInfoByOpenid(openid)
    // 员工未绑定微信，或者不是我们的员工，显示登录页面
    if (!staff || staff.status === STAFF_STATUS.LEFT) {
      ctx.cookies.set('S_O', openid, { httpOnly: false, maxAge: COOKIE_MAX_AGE, overwrite: true })
      ctx.redirect(`/staff-home?state=staff-unauth`)
      return
    }

    // 验证通过
    let token = await store.generateStaffToken({ openid: staff.openid })
    ctx.cookies.set('S_T', token, { httpOnly: false, maxAge: COOKIE_MAX_AGE, overwrite: true })
    ctx.redirect(`/staff-home?state=${state}`)
  },

  async renderShopPage (ctx) {
    let fileBuffer = fs.readFileSync(path.resolve(__dirname, './auth.html'))
    ctx.set('Content-Type', 'text/html')
    ctx.body = fileBuffer
  },

  async handleRedirectHome (ctx) {
    let { code, state } = ctx.request.query
    if (!code) {
      ctx.redirect('/')
      return
    }

    let { openid } = await store.getOAuthAccessToken(code)
    await _handleUser(openid)
    ctx.redirect(`/?o=${openid}&state=${state}`)
  },

  async handleRedirectUser (ctx) {
    let { code, state } = ctx.request.query
    if (!code) {
      ctx.redirect('/')
      return
    }

    let { openid } = await store.getOAuthAccessToken(code)
    await _handleUser(openid)
    ctx.redirect(`/?o=${openid}&v=user`)
  },

  async handleRedirectMcht (ctx) {
    let { code, state } = ctx.request.query
    if (!code) {
      ctx.redirect(mchtRootPath)
      return
    }

    let { openid } = await store.getOAuthAccessToken(code)
    ctx.redirect(`/?o=${openid}&state=${state}`)
  },

  async redirectCouponShare (ctx) {
    let { code, state } = ctx.request.query
    if (!code) {
      ctx.redirect('/')
      return
    }
    let { openid } = await store.getOAuthAccessToken(code)
    await _handleUser(openid)
    ctx.redirect(`/?o=${openid}&state=${state}`)
  }
}


// helpers

// 判断用户是否存在,无则创建一个新用户
const _handleUser = async function (openid)  {
  let user = await store.getUserInfoByOpenid(openid)
  if (!user) {
    user = await store.getWxUserInfo(openid) || {}
    console.log(user)
    user.openid = openid
    user.userid = random(10, 'number')
    user.creationTime = Date.now()
    result = await store.createUser(user)
    return result
  }
}

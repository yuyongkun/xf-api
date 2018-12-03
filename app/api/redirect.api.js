const fs = require('fs')

const store = require('../store')
const { mchtRootPath } = require('../config/app')
const { random } = require('../utils')
module.exports = {
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

const debug = require('debug')('admins.api')
const crypto = require('crypto')

const logger = require('../lib/log-console')
const { random, getPwdHash } = require('../utils/')
const store = require('../store/')


module.exports = {
  async handleCreateStaff (ctx) {
    let { username, password } = ctx.request.body
    let staff = {
      username,
      userid: random(10, 'number'),
      pwdHash: getPwdHash(password),
      creationTime: Date.now()
    }
    await store.createStaff(staff)
    ctx.body = { data: {} }
  }
}
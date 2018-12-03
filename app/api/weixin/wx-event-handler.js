const logger = require('../../lib/log-console')

const { random } = require('../../utils')

const store = require('../../store')


module.exports = {

  async subscribe (msg) {
    logger.log('handle subscribe event...')
    // { ToUserName: [ 'gh_975affd40e60' ],
    // FromUserName: [ 'oektb0UdiwQMKVYR-qeOT5kh4TdQ' ],
    // CreateTime: [ '1510294494' ],
    // MsgType: [ 'event' ],
    // Event: [ 'subscribe' ],
    // EventKey: [ '' ] }
    let openid = msg.FromUserName[0]
    let user = await store.getWxUserInfo(openid)
    logger.log('wx user info: %j', user)
    if (user.subscribe === 0) {
      logger.log('user has unsubscribed')
      return
    }

    let _user = await store.getUserInfoByOpenid(openid)
    if (_user) {
      logger.log('user already existed: %j', _user)
      return _user
    }

    user.userid = random(20)
    logger.log('create user: %j', user)
    let res = await store.createUser(user)
    logger.log('create user done')
    return user
  },
}

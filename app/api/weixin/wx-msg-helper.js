const logger = require('../../lib/log-console')

const axios = require('axios')

const { 
  wxSendMsgUrl
} = require('../../config/app')

const store = require('../../store')


module.exports = async function (openid, template_id, data, url) {
  const access_token = await store.getWxAccessToken()
  const now = Date.now()
  logger.log('Send weixin msg: %j', data)
  let msgData = {
    touser: openid,
    template_id,
    data
  }
  if (url) {
    msgData.url = url
  }

  let resp = await axios({
    method: 'post',
    url: wxSendMsgUrl,
    params: { access_token },
    data: msgData
  })
  logger.log('Send weixin msg costs: %s ms', Date.now() - now)
  logger.log('Send weixin msg response from weixin: %j', resp.data)
  return resp
}
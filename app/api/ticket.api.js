const logger = require('../lib/log-console')

const fs = require('fs')

const { wxCheckTicketMsgTmplId } = require('../config/app')
const {
  getQRCodePath,
  getFormatDate,
  random
} = require('../utils/')
const sendWxMsg = require('./weixin/wx-msg-helper')
const store = require('../store/')


module.exports = {
  async handleListTicketByOpenid (ctx) {
    let { openid } = ctx.state.user
    let tickets = await store.listTicketByOpenid(openid)
    ctx.body = { data: { tickets } }
  },

  async handleUpdateUsedStatus (ctx) {
    let { ticketId } = ctx.params
    let staff = ctx.state.user.userid
    let { ticketCode } = ctx.request.body
    let ticket = await store.getTicket(ticketId)
    let now = Date.now()

    ctx.assert(ticketCode === ticket.ticketCode, 400)

    await store.updateTicketUsedStatus(ticketId, {
      checkUserid: staff,
      used: true,
      usedTime: now
    })

    await store.createTicketCheck ({
      checkId: random(10),
      checkUserid: staff,
      checkTime: now,
      openid: ticket.openid,
      ticketId: ticket.ticketId
    })

    await sendWxMsg(ticket.openid, wxCheckTicketMsgTmplId, {
      first: { value: '您好，您已成功消费。' },
      productType: { value: '商品名' },
      name: { value: ticket.product.name },
      accountType: { value: '门店' },
      account: { value: ticket.shop.name },
      time: { value: getFormatDate() },
      remark: { value: "欢迎下次光临！" }
    })

    ctx.body = { data: {} }
  },

  async handleGetTicketQRCode (ctx) {
    let { hash } = ctx.params
    let filepath = getQRCodePath(hash)
    let existed = fs.existsSync(filepath)
    ctx.assert(existed, 404)

    let img = fs.readFileSync(filepath)
    ctx.set('Content-Type', 'image/png')
    ctx.body = img
  },

  async handleGetTicketDetail (ctx, ticketId) {
    let ticket = await store.getTicket(ticketId)
    ctx.body = { data: { ticket } }
  },

  async handleGetTicketByHash (ctx) {
    let { hash } = ctx.params
    let ticket = await store.getTicketByHash(hash)
    ctx.body = { data: { ticket } }
  },

  async handleGetTicketByCode (ctx) {
    let { code } = ctx.params
    let ticket = await store.getTicketByCode(code)
    ctx.body = { data: { ticket } }
  },

  async handleInitTicketCheck (ctx) {
    await store.initTicketChecksRecord()
    ctx.body = { data: { msg: 'ok' } }
  }
}
const { random } = require('../utils')

module.exports = {
  
  async createTicket (ticket) {
    return await this.db.insertOne('tickets', ticket)
  },

  async getPlainTicket (ticketId) {
    return await this.db.findOne('tickets', { ticketId })
  },

  async getTicket (ticketId) {
    let ticket = await this.db.findOne('tickets', { ticketId })
    ticket.shop = await this.getShopInfo(ticket.shopId)
    ticket.product = await this.getProductInfo(ticket.prodId)
    return ticket
  },

  async listTicketByOpenid (openid) {
    let tickets = await this.db.find('tickets', { openid })
    for (let ticket of tickets) {
      ticket.shop = await this.db.findOne('shops', { shopId: ticket.shopId })
      ticket.product = await this.db.findOne('products', { prodId: ticket.prodId })
    }
    return tickets
  },

  async updateTicketUsedStatus (ticketId, { checkUserid, used }) {
    return await this.db.findOneAndUpdate('tickets', {
      ticketId
    }, {
      $set: { checkUserid, used }
    })
  },

  async getTicketByHash (ticketHash) {
    let ticket = await this.db.findOne('tickets', { ticketHash })
    ticket.shop = await this.getShopInfo(ticket.shopId)
    ticket.product = await this.getProductInfo(ticket.prodId)
    return ticket
  },

  async getTicketByCode (ticketCode) {
    let ticket = await this.db.findOne('tickets', { ticketCode })
    ticket.shop = await this.getShopInfo(ticket.shopId)
    ticket.product = await this.getProductInfo(ticket.prodId)
    return ticket
  },

  async listTicketByCheckUserid (userid) {
    return await this.db.find('tickets', { checkUserid: userid })
  },

  async initTicketChecksRecord () {
    let tickets = await this.db.find('tickets', { used: true })
    for (let ticket of tickets) {
      let checkTime = ticket.usedTime || ticket.createTime
      let check = {
        checkId: random(10),
        checkUserid: ticket.checkUserid,
        checkTime,
        openid: ticket.openid,
        ticketId: ticket.ticketId
      }
      await this.db.insertOne('ticket_checks', check)
      if (!ticket.usedTime) {
        await this.db.findOneAndUpdate('tickets', {
          ticketId: ticket.ticketId
        }, {
          $set: { usedTime: checkTime }
        })
      }
    }
  }

}
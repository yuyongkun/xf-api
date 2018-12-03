const TICKET_CHECKS = 'ticket_checks'

module.exports = {
  async listTicketCheckByCheckUserid (checkUserid) {
    return await this.db.find(TICKET_CHECKS, { checkUserid }, {
      sort: [['checkTime', 1]]
    })
  },

  async createTicketCheck (check) {
    return await this.db.insertOne(TICKET_CHECKS, check)
  }
}
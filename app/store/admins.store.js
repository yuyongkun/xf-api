module.exports = {

  keyToAdminSessionByAccessToken: (token) => `admin-sessions/${token}`,
  
  async getAdminSessionByAccessToken(token) {
    return await this.cache.get(this.keyToAdminSessionByAccessToken(token))
  },

  async getAdminSession({ access_token }) {
    return await this.cache.get(this.keyToAdminSessionByAccessToken(access_token))
  },
  
  async setAdminSessionByAccessToken(token, AdminSession, ttl) {
    await this.cache.set(this.keyToAdminSessionByAccessToken(token), AdminSession, { ttl })
  },

  async saveAdminSession(adminSession, { ttl }) {
    await this.cache.set(this.keyToAdminSessionByAccessToken(adminSession.access_token), adminSession, { ttl })
  },

  async deleteAdminSessionByAccessToken(token) {
    await this.cache.del(this.keyToAdminSessionByAccessToken(token))
  },

  async deleteAdminSession({ access_token }) {
    await this.cache.del(this.keyToAdminSessionByAccessToken(access_token))
  },

  async getAdminByUsername(username) {
    return await this.db.findOne('admins', {
      username
    })
  }
}
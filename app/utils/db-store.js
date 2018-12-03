const debug = require('debug')
const Mongodb = require('mongodb')

const logger = require('../lib/log-console')

const { MongoClient } = Mongodb

class DBStore {
  constructor ({ url }) {
    this.url = url
  }

  async _client () {
    let db = await MongoClient.connect(this.url)
    return db
  }

  async checkConnection () {
    let db = await MongoClient.connect(this.url)
    logger.log('Connected to mongodb successfully!')
    db.close()
    return true
  }

  async find (collection, query, options) {
    options = options || {}
    let db = await this._client()
    let result = await db.collection(collection).find(query, options).toArray()
    db.close()
    return result
  }

  async findOne (collection, query, options) {
    let db = await this._client()
    let result = await db.collection(collection).findOne(query, options)
    db.close()
    return result
  }

  async findOneAndUpdate (collection, filter, update, options) {
    let db = await this._client()
    let result = await db.collection(collection).findOneAndUpdate(filter, update, options)
    db.close()
    return result
  }

  async insertOne (collection, doc, options) {
    let db = await this._client()
    let result = await db.collection(collection).insertOne(doc, options)
    db.close()
    return result
  }

  async deleteOne (collection, query, options) {
    let db = await this._client()
    let result = await db.collection(collection).deleteOne(query, options)
    db.close()
    return result
  }

  async count (collection, query, options) {
    let db = await this._client()
    let result = await db.collection(collection).count(query, options)
    db.close()
    return result
  }

  async update (collection, filter, update, options) {
    let db = await this._client()
    let result = await db.collection(collection).update(filter, update, options)
    db.close()
    return result
  }

  async updateOne (collection, filter, update, options) {
    let db = await this._client()
    let result = await db.collection(collection).updateOne(filter, update, options)
    db.close()
    return result
  }
}


module.exports = DBStore

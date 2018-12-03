module.exports = {
  url: process.env.MONGODB_URL || 
  process.env.NODE_ENV === 'production'?'mongodb://webedit:fxshop123abc@localhost:27017/fxshop_test':'mongodb://localhost:27017/fxshop_test'
}
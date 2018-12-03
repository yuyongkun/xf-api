module.exports = Object.assign({
  orderPayingList: process.env.FX_ORDER_PAYING_LIST,
  orderTTL: 15 * 60 * 1000,

  userSessionTTL: 3600 * 24,
  apiPathPrefix: '/api',
  authPath: '/access-token',
  wxAccessPath: '/wx-access',
  filePath: '/uploaded-files',
  healthCheckPath: '/health-check',
  redirectPath: '/redirect',
  mchtRootPath: '/merchant-home',
  couponSharePath: '/coupon-share',

  wxNotifyUrl: 'http://test-shop.fanxify.com/external/wx/pay-notify',

  productCategory: {
    PRICE_DIFFERENCE: "5"
  },

  ACCESS_TOKEN_LENGTH: 20,
  ACCESS_SECRET_LENGTH: 40,
  ACCESS_SECRET_CHAR_CANDIDATES: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/+.',

  PROD_ENV: process.env.NODE_ENV === 'production',
  DEV_ENV: process.env.NODE_ENV === 'development'
}, require('./weixin'))
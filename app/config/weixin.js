const wxJSAPIList = require('./wx-jssdk-api')


module.exports = {
  wxAppid: process.env.NODE_ENV === 'production'?'wx546482739ca755c0':'wxc7ced805a8754132',
  wxAppSecret: process.env.NODE_ENV === 'production'?'d66c9fe5dfcd21995967f9ee52c91a1a':'505a6a23ac1d11495b84c919acf9f630',
  wxAPIKey: 'PfjQptC5xaCkpU4fY2znXWi3SywwGgsA',
  wxToken: 'PRgnZHVGXUadYcjJdfIphEborIODHXbY',
  wxEncodingAESKey: '8XMT6B1MMg574WQiKy5dXN8L3Xaq6VvEPdmTFnf07sb',
  wxJSAPIList,
  wxMerchantId: 1491447362,
  wxPaySignType: 'MD5',

  wxAccessTokenTTL: 7200,
  wxAccessTokenCacheKey: 'wx_access_token',
  wxOAuthAccessTokenCachePrefix: 'wx_oauth_access_token',
  wxJSTicketCacheKey: 'wx_js_ticket',

  wxAccessTokenUrl: 'https://api.weixin.qq.com/cgi-bin/token',
  wxCreateMenuUrl: 'https://api.weixin.qq.com/cgi-bin/menu/create',
  wxGetUserInfoUrl: 'https://api.weixin.qq.com/cgi-bin/user/info',
  wxOAuthAccessTokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
  wxJSTicketUrl: 'https://api.weixin.qq.com/cgi-bin/ticket/getticket',
  wxUnifiedOrderUrl: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
  wxGetMediaUrl: 'https://api.weixin.qq.com/cgi-bin/media/get',
  wxSendMsgUrl: 'https://api.weixin.qq.com/cgi-bin/message/template/send',
  wxGetOAuthAccessTokenByRefreshTokenUrl: 'https://api.weixin.qq.com/sns/oauth2/refresh_token',
  wxGetUserInfoByAccessTokenUrl: 'https://api.weixin.qq.com/sns/userinfo',

  wxPayOKMsgTmplId: 'DGjbBgxDXUP3Ym1ZOr_u1dMZ7zMuVyaMAT0Po9yyfr8',
  wxCheckTicketMsgTmplId: 'mmfTL3QGowrdktXt7rrgHtazK5jGQSfqyTSLNBJWfQY',
  wxAppointmentMsgTmplId: 'XGgzH2ChQj3n-ae_1nFHtuLD98V9eSBUptHk2fWZ4NY',
  wxQueueMsgTmplId: '0gAKDOipZ5XNF3SgdKxCEzuvezvkIYERkoKflGRHoBc',
  wxCancelAppointmentMsgTmplId: 'R8VL7K61w2PNEbdVRZEqhPmdAGDYkGGe6nCtNSxX61U',
  wxPayMsgTmplId: 'U4CGrO5xQgaNSEjFw4f7FcXjjlqUS6BUvLKFfr190L8',
  wxRateMsgTmplId: 'lF1GNllUNRNhMMObQ2jcbseZdPFk9_aElyEWBW8T8TE',
  wxCouponExpiredTmplId: 'sdXC3GdAiIE7UPO38f5YdBhC_Y0meL5PlG6dQmpSIgQ',
  wxQueueOnYourTurnTmplId: 'Y41d4rIIDIFg4AUrn48hekZpds4qbbY6cJbh3BXEd0A',
  wxRateRemindMsgTmplId: '6lwXk2S3urM3Shd9oWDvKV0oLvIJTMTtKUzmIMUoo10'
}

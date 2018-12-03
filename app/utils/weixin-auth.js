const request = require('request');
const {appid as wxAppid,appsecret as wxAppSecret} = require('../config/weixin');
//微信授权
module.exports.weixinAuth = {
    // 检验网页授权的access_token是否有效
    accessTokenValid: function(accessToken, openid) {
        return request({
            url: `https://api.weixin.qq.com/sns/auth?access_token=${accessToken}&openid=${openid}`,
            json: true
        }).then(function(data) {
            return Promise.resolve(data);
        });
    },
    //如果网页授权的access_token过期，使用refresh_token进行刷新，refresh_token有效期是30天
    refreshToken: function(refresh_token) {
        return request({
            url: `https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${appid}&grant_type=refresh_token&refresh_token=${refresh_token}`,
            json: true
        }).then(function(data) {
            return Promise.resolve(data);
        });
    },
    // 重定向到网页授权code页面
    getCode: function(redirect_uri) {
        location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirect_uri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
    },
    // 使用code换取网页授权access_token
    getAccessToken: function(code) {
        return request({
            url: `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${appsecret}&code=${code}&grant_type=authorization_code`,
            json: true
        }).then(function(data) {
            return Promise.resolve(data);
        });
    },
    // 根据access_token和openid获取用户信息
    getUserInfo:function(access_token,openid){
    	 return request({
            url: `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`,
            json: true
        }).then(function(data) {
            return Promise.resolve(data);
        });
    }
};
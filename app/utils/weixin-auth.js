// const request = require('request');
var rp = require('request-promise');
const { wxAppid, wxAppSecret } = require('../config/weixin');
async function request(url){
    return new Promise(function(resolve){
        rp(url)
            .then(function(data){
                resolve(data);
            })
            .catch(function(err){
                resolve(err);
            });
    });
}

// createMenu();
// function createMenu() {
//     request.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wxAppid}&secret=${wxAppSecret}`, function (err, res, body) {
//         let access_token = JSON.parse(body).access_token;
//         let menu = require('../config/menu');
//         request.post({
//             url: 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token=' + access_token,
//             body: menu,
//             json: true
//         }, function (err, res, body) {
//             console.log(body);
//         });
//     })
// }
//微信授权
module.exports.weixinAuth = {
    // 检验网页授权的access_token是否有效
    accessTokenValid: function (accessToken, openid) {
        return request({
            url: `https://api.weixin.qq.com/sns/auth?access_token=${accessToken}&openid=${openid}`,
            json: true
        }).then(function (data) {
            return Promise.resolve(data);
        });
    },
    //如果网页授权的access_token过期，使用refresh_token进行刷新，refresh_token有效期是30天
    refreshToken: function (refresh_token) {
        return request({
            url: `https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${wxAppid}&grant_type=refresh_token&refresh_token=${refresh_token}`,
            json: true
        }).then(function (data) {
            return Promise.resolve(data);
        });
    },
    // 重定向到网页授权code页面
    getCode: function (ctx,state,redirect_uri) {
        request({
            url: `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${wxAppid}&redirect_uri=${redirect_uri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`,
            json: true
        });
    },
    // 使用code换取网页授权access_token
    async getAccessToken (code) {
        return request({
            url: `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${wxAppid}&secret=${wxAppSecret}&code=${code}&grant_type=authorization_code`,
            json: true
        }).then(function (data) {
            return Promise.resolve(data);
        });
    },
    // 根据access_token和openid获取用户信息
    getUserInfo: function (access_token, openid) {
        return request({
            url: `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`,
            json: true
        }).then(function (data) {
            return Promise.resolve(data);
        });
    },

};

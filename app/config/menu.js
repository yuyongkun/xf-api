/*
 * 配置自定义菜单
 */
'use strict'

module.exports = {
    "button": [
        {
            "type": "click",
            "name": "关于我们",
            "key": "V1001_TODAY_MUSIC",
            "sub_button": [
                {
                    "type": "view",
                    "name": "官网",
                    "url": "https://yyktest.natapp4.cc/home.html"
                },
                {
                    "type": "view",
                    "name": "员工通道2",
                    "url": "https://yyktest.natapp4.cc/index.html"
                }
            ]

        },
        {
            "type": "view",
            "name": "进店取号",
            "url": "https://yyktest.natapp4.cc/index.html#home"
        }, {
            "type": "view",
            "name": "我的2",
            "url": "https://yyktest.natapp4.cc/index.html?state=shop-home-user"
        }]
}
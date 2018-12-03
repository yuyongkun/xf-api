const { wxCouponExpiredTmplId } = require('../config/app')

const sendWxMsg = require('../api/weixin/wx-msg-helper')

const store = require('../store')

const msgUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx546482739ca755c0&redirect_uri=http%3A%2F%2Ftest-shop.fanxify.com%2Fauth%2Fshop&response_type=code&scope=snsapi_userinfo&state=my-coupon#wechat_redirect'

const hour = 1000 * 60 * 60
const day = hour * 24

const user_coupons = 'user_coupons'

setInterval(async () => {
  console.log('executing coupon reminder')
  let now = new Date()
  console.log('now time: %s', now.toLocaleString())
  let nowHour = now.getHours()
  if (nowHour < 12 || nowHour > 23) { return }    // 只在中午十二点到晚上11点之间发送消息
  await main()
}, hour)                                          // 每小时执行一次定时任务

async function main () {
  let now = Date.now()
  let userCount = await store.countUser()
  let limit = 10
  let skip = 0
  let queryCount = Math.ceil(userCount / limit)
  for (let i = 1; i <= queryCount; i++) {
    let users = await store.listUser(limit, skip)
    for (let user of users) {
      let { openid } = user
      if (!openid) { continue }

      /**
       * 第一次发送
       */
      let coupons1 = await store.db.find(user_coupons, {
        openid,
        used: false,                                                       // 未使用
        msgCount: { $exists: false },                                      // 未发送过消息
        activeTime: { $lt: now },                                          // 已激活
        endTime: { $lte: now + (day * 35), $gt: now + (day * 20) }         // 还有35天就过期
      })

      let coupon = coupons1[0]
      if (coupon) {
        let couponMeta = await store.getCouponByCouponId(coupon.couponId)
        coupon = Object.assign({}, coupon, {
          amount: couponMeta.amount
        })

        // {{first.DATA}}
        // 账户：{{keyword1.DATA}}
        // 时间：{{keyword2.DATA}}
        // 类型：{{keyword3.DATA}}
        // 到账积分：{{keyword4.DATA}}
        // 账户积分余额：{{keyword5.DATA}}
        // {{remark.DATA}}
        let data = {
          first: { value: '尊敬的客户，您参与“评价分享返券”获得的积分优惠券生效中，请安排时间到店消费，记得每次消费完毕可以评价分享领券哦', color: '#c526ff'},
          keyword1: { value: user.nickname || '' },
          keyword2: { value: `${new Date(coupon.endTime).toLocaleString()} 到期` },
          keyword3: { value: '分享赠送' },
          keyword4: { value: `${coupon.amount / 100}` },
          keyword5: { value: `${coupon.amount / 100}` },
          remark: { value: `${new Date(coupon.createTime).toLocaleString()} 领取，您到店消费前请先取号，根据收到的进度消息提前到店，避免到店才发现已等候多人。` }
        }
        await sendWxMsg(user.openid, wxCouponExpiredTmplId, data, msgUrl)
        await store.updateCouponMsgCount(user.openid, coupon.couponId, 1)
      }

      /**
       * 第二次发送
       */
      let coupons2 = await store.db.find(user_coupons, {
        openid,
        used: false,                                                                 // 未使用
        msgCount: 1,                                                                 // 发送过一次消息
        activeTime: { $lt: now },                                                    // 已激活
        endTime: { $lte: now + (day * 20), $gt: now + (day * 5) }         // 还有20天就过期
      })
      coupon = coupons2[0]
      if (coupon) {
        let couponMeta = await store.getCouponByCouponId(coupon.couponId)
        coupon = Object.assign({}, coupon, {
          amount: couponMeta.amount
        })

        let data = {
          first: { value: '尊敬的客户，您参与“评价分享返券”获得的积分即将到期，请安排时间到店消费，记得每次消费完毕可以评价分享领券哦', color: '#266dff'},
          keyword1: { value: user.nickname || '' },
          keyword2: { value: `${new Date(coupon.endTime).toLocaleString()} 到期` },
          keyword3: { value: '分享赠送' },
          keyword4: { value: `${coupon.amount / 100}` },
          keyword5: { value: `${coupon.amount / 100}` },
          remark: { value: `${new Date(coupon.createTime).toLocaleString()} 领取，您到店消费前请先取号，根据收到的进度消息提前到店，避免到店才发现已等候多人。` }
        }
        await sendWxMsg(user.openid, wxCouponExpiredTmplId, data, msgUrl)
        await store.updateCouponMsgCount(user.openid, coupon.couponId, coupon.msgCount + 1)
      }

      /**
       * 第三次发送
       */
      let coupons3 = await store.db.find(user_coupons, {
        openid,
        used: false,                                         // 未使用
        msgCount: 2,                                         // 发送过两次消息
        activeTime: { $lt: now },                            // 已激活
        endTime: { $gt: now, $lte: now + (day * 5) }         // 还有5天就过期
      })
      coupon = coupons3[0]
      if (coupon) {
        let couponMeta = await store.getCouponByCouponId(coupon.couponId)
        coupon = Object.assign({}, coupon, {
          amount: couponMeta.amount
        })

        let data = {
          first: { value: '尊敬的客户，您参与“评价分享返券”获得的积分5天后过期，请安排时间到店消费，记得每次消费完毕可以评价分享领券哦', color: '#c526ff'},
          keyword1: { value: user.nickname || '' },
          keyword2: { value: `${new Date(coupon.endTime).toLocaleString()} 到期` },
          keyword3: { value: '分享赠送' },
          keyword4: { value: `${coupon.amount / 100}` },
          keyword5: { value: `${coupon.amount / 100}` },
          remark: { value: `${new Date(coupon.createTime).toLocaleString()} 领取，您到店消费前请先取号，根据收到的进度消息提前到店，避免到店才发现已等候多人。` }
        }
        await sendWxMsg(user.openid, wxCouponExpiredTmplId, data, msgUrl)
        await store.updateCouponMsgCount(user.openid, coupon.couponId, coupon.msgCount + 1)
      }
    }
    skip += limit
  }
}
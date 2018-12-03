module.exports = async (ctx, next) => {
  await next()
  if (ctx.body && ctx.body.data && ctx.body.data.coupons) {
    ctx.body.data.coupons = ctx.body.data.coupons.map(c => {
      let res = {
        couponId: c.couponId,
        couponName: c.title,
        shopId: c.shopId,
        shopName: c.shopName,
        couponAmount: c.amount / 100,
        orderMinAmount: c.lowerLimit / 100,
        endTimeStamp: c.endTime,
        couponCount: c.couponCount
      }
      if (typeof c.used !== 'undefined') {
        res.used = c.used
      }
      if (typeof c.isReceived !== 'undefined') {
        res.isReceived = c.isReceived
      }
      if (typeof c.activeTime !== 'undefined') {
        res.activeTimeStamp = c.activeTime
      }
      return res
    })

  }
}

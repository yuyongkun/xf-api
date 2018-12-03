const pathMatch = require('koa-path-match')

const {
  apiPathPrefix,
  authPath,
  wxAccessPath,
  filePath,
  healthCheckPath,
  redirectPath,
  mchtRootPath
} = require('../config/app')

const { compose, mount } = require('../middlewares/koa-utils')
const { notFound } = require('../middlewares/fallback')
const { parseBody, parseXml } = require('../middlewares/body-parser')
const { handleLoginRequest, handleStaffLogin, wxUserAuth, validateAuthorization, wxStaffAuth } = require('../middlewares/auth')
const { serveStatic } = require('../middlewares/serve-static')
const couponFieldMapping = require('../middlewares/coupon-field-mapping')

const { handleHealthCheckRequest } = require('./health-check.api')
const { handleUploadRequest } = require('./upload.api')
const prodApi = require('./product.api')
const { handleAccessRequest, receiveWxMsg, handlePayNotify, handleDownloadWxMedia } = require('./weixin')
const weixinApi = require('./weixin')
const userApi = require('./users.api')
const orderApi = require('./order.api')
const redirectApi = require('./redirect.api')
const { handleListTicketByOpenid, handleUpdateUsedStatus, handleGetTicketQRCode, handleGetTicketByHash, handleGetTicketByCode } = require('./ticket.api')
const staffApi = require('./staff.api')
const apmApi = require('./appointment.api')
const categoryApi = require('./category.api')
const shopApi = require('./shop.api')
const couponApi = require('./coupon.api')
const commentApi = require('./comment.api')
const authApi = require('./auth.api')

const filters = compose([
  parseBody,
])

const route = pathMatch({
  sensitive: true,
  strict: false
})

module.exports = compose([

  /// index page
  mount('/', {
    name: '/',
    middleware: [ route('/').get(shopApi.handleIndexPageRequest) ]
  }),

  /// merchant index page
  mount(mchtRootPath, {
    name: mchtRootPath,
    middleware: [ route('/').get(staffApi.handleMchtIndexPageRequest) ]
  }),

  /// '/redirect/**'
  mount(redirectPath, {
    name: redirectPath,
    middleware: [
      route('/home').get(redirectApi.handleRedirectHome),
      route('/user').get(redirectApi.handleRedirectUser),
      route('/mcht').get(redirectApi.handleRedirectMcht),
      route('/coupon-share-:couponId').get(redirectApi.redirectCouponShare)
    ]
  }),

  /// '/auth/**'
  mount('/auth', {
    name: '/auth',
    middleware: [
      route('/shop').get(authApi.authShop),
      route('/mcht').get(authApi.authMcht),
    ]
  }),

  mount('/shop-home', {
    name: '/shop-home',
    middleware: [
      route('/').get(shopApi.handleIndexPageRequest),
    ]
  }),
  mount('/staff-home', {
    name: '/staff-home',
    middleware: [
      route('/').get(shopApi.handleStaffHomePageRequest),
    ]
  }),

  /// '/health-check/*'
  mount(healthCheckPath, {
    name: healthCheckPath,
    middleware: [
      filters,
      route('/').get(handleHealthCheckRequest),
      notFound,
    ]
  }),

  /// '/access-token/*'
  mount(authPath, {
    name: authPath,
    middleware: [
      filters,
      route('/').post(handleLoginRequest),
      notFound
    ]
  }),

  /// '/uploaded-files/*'
  mount(filePath, {
    name: filePath,
    middleware: [ 
      serveStatic,
      notFound
    ]
  }),

  /// '/wx-access'
  mount(wxAccessPath, {
    name: wxAccessPath,
    middleware: [
      parseXml,
      route('/')
        .get(handleAccessRequest)
        .post(receiveWxMsg)
    ]
  }),

  mount('/external', {
    name: '/external',
    middleware: [
      mount('/wx', {
        name: '/wx',
        middleware: [
          parseXml,
          route('/pay-notify').post(handlePayNotify)
        ]
      })
    ]
  }),

  /// '/api/*'
  mount(apiPathPrefix, {
    name: apiPathPrefix,
    middleware: [

      filters,

      mount('/admins', {
        name: '/admins',
        middleware: [

          validateAuthorization,

          route('/upload').post(handleUploadRequest),

          // shop
          mount('/shops', {
            name: '/shops',
            middleware: [
              route('/')
                .get(shopApi.handleListShopRequest)
                .post(shopApi.handleCreateShopRequest),
              route('/:shopId')
                .get(shopApi.handleGetShopRequest)
                .post(shopApi.handleUpdateShopRequest),

              route('/:shopId/products')
                .get(prodApi.handleListProduct)
                .post(prodApi.handleCreateProduct),
              route('/:shopId/primary-products')
                .get(prodApi.listPrimaryProducts),
              route('/:shopId/products/:prodId')
                .get(prodApi.handleGetProduct)
                .post(prodApi.handleUpdateProduct),

              route('/:shopId/categories/:cate/product-groups')
                .get(shopApi.handleListProductGroup)
                .post(shopApi.handleAddProductGroup),
              route('/:shopId/product-groups/:groupId')
                .post(shopApi.handleUpdateProductGroup)
                .delete(shopApi.handleDeleteProductGroup),

              route('/:shopId/today-turnover')
                .get(orderApi.handleGetTurnoverByDate),
              route('/:shopId/orders')
                .get(orderApi.handleListOrderByDate),
              route('/:shopId/staff-service-stats')
                .get(staffApi.listStaffServiceStats),
              route('/:shopId/service-stats')
                .get(orderApi.getShopServiceStats),
              route('/:shopId/comment-stats')
                .get(shopApi.getShopCommentStats),

              route('/:shopId/entry-config')
                .get(shopApi.getEntryConfig)
                .post(shopApi.saveEntryConfig),

              route('/:shopId/hair-photos')
                .get(shopApi.getHairPhotos)
                .post(shopApi.saveHairPhotos),

              route('/:shopId/served-users')
                .get(shopApi.listServedUserByShop),
              route('/:shopId/user-service-history/:openid')
                .get(userApi.listUserOrder)
            ]
          }),

          // staff
          mount('/staffs', {
            name: '/staffs',
            middleware: [
              route('/')
                .get(staffApi.handleListStaff)
                .post(staffApi.handleCreateStaff),
              route('/:userid')
                .post(staffApi.handleUpdateStaff),
              route('/:userid/pwd')
                .post(staffApi.handleResetPwd),
              route('/:userid/status')
                .post(staffApi.handleUpdateStaffStatus),
              route('/:userid/product-option')
                .get(staffApi.adminGetStaffProductOption)
                .post(staffApi.setStaffProductOption),
              route('/:userid/category-price')
                .get(staffApi.getStaffCategoryPrice)
                .post(staffApi.setStaffCategoryPrice),
              route('/:userid/service-cases')
                .get(staffApi.listStaffServiceCase),
            ]
          }),

          // category
          mount('/categories', {
            name: '/categories',
            middleware: [
              route('/')
                .get(categoryApi.handleListCategory),
              route('/:code')
                .post(categoryApi.handleUpdateCategory),
              route('/all/init')
                .post(categoryApi.handleInitCategory)
            ]
          }),

          mount('/cate-services', {
            name: '/cate-services',
            middleware: [
              route('/')
                .get(categoryApi.listCateServiceByShop),
              route('/:id')
                .post(categoryApi.updateCateService)
            ]
          }),

          // coupon
          mount('/coupon', {
            name: '/coupon',
            middleware: [
              // route.get('/', couponApi.handleListCoupon),
              route('/')
                .get(couponApi.handleListCouponPage)
                .post(couponApi.handleCreateCoupon),
              route('/users')
                .get(couponApi.handleListCouponUsers),
              route('/:couponId')
                .post(couponApi.handleUpdateCoupon)
                .delete(couponApi.handleDeleteCoupon)
            ]
          }),

          // comment
          mount('/comments', {
            name: '/comments',
            middleware: [
              route('/')
                .get(commentApi.listCommentByDate),
              route('/:commentId/status')
                .post(commentApi.handleUpdateComment)
            ]
          }),

          // salary plan
          mount('/salary-plan', {
            name: '/salary-plan',
            middleware: [
              route('/:shopId')
                .get(shopApi.listSalaryPlanByShopId),
              route('/')
                .post(shopApi.updateSalaryPlan)
            ]
          }),
          route('/del-salary-plan/:planId')
            .delete(shopApi.delSalaryPlan)
        ]
      }),

      // merchant
      mount('/staff', {
        name: '/staff',
        middleware: [
          route('/access-token')
            .post(handleStaffLogin),

          mount('/', {
            name: '/',
            middleware: [
              wxStaffAuth,

              // tickets
              route('/ticket/hash/:hash')
                .get(handleGetTicketByHash),
              route('/ticket/code/:code')
                .get(handleGetTicketByCode),
              route('/ticket/:ticketId/used')
                .post(handleUpdateUsedStatus),

              route('/served-user')
                .get(staffApi.handleGetServedUser),
              route('/served-user/hair-photos')
                .post(staffApi.handleUpdateUserHairPhotos),
              route('/wx-media/:mediaId')
                .get(handleDownloadWxMedia),
              route('/profile')
                .get(staffApi.handleGetStaffInfo),
              route('/status')
                .post(staffApi.mchtUpdateStaffStatus),
              route('/wx-openid')
                .post(staffApi.handleSetStaffOpenid),

              route('/appointments')
                .get(apmApi.handleListAppointmentByShop),
              route('/appointments/:apmId')
                .get(apmApi.getAppointment)
                .delete(apmApi.handleExpireAppointment)
                .post(apmApi.setAppointmentStatus),
              route('/appointments/:apmId/serve-progress')
                .post(apmApi.updateServeProgress),
              route('/pay-msg')
                .post(apmApi.sendPayMsg),
              route('/pay-msg/:msgId')
                .get(apmApi.getPayMsg),
              route('/service-case')
                .post(apmApi.createServiceCase),
              route('/service-case-2')
                .post(apmApi.createServiceCasesWithoutPayMsg),
              route('/service-case-draft/:apmId')
                .post(apmApi.updateServiceCaseDraft)
                .get(apmApi.getServiceCaseDraft),
              route('/staffs')
                .get(staffApi.merchantListStaff),

              route('/cate-services')
                .get(categoryApi.listCateServiceByShop),

              route('/send-on-your-turn-msg')
                .post(apmApi.sendOnYourTurnMsg),

              route('/upload')
                .post(handleUploadRequest),
              route('/personal-page-data')
                .get(staffApi.getStaffPersonalPageData),
              route('/personal-page-data')
                .post(staffApi.setStaffPersonalPageData),
              route('/pending-order')
                .get(orderApi.getStaffPendingOrder),
              route('/pending-order/:orderId')
                .post(orderApi.updateStaffPendingOrder),

              route('/service-cases')
                .get(staffApi.listStaffServiceCaseWithAuth),
              route('/salary-plan/:shopId')
                .get(shopApi.listSalaryPlanByShopId),
              route('/user-service-history/:openid')
                .get(userApi.listUserOrder)
            ]
          })
        ]
      }),

      /// h5
      mount('/wx', {
        name: '/wx',
        middleware: [
           // handle create official count menu
          route('/menu')
            .post(weixinApi.handleCreateMenu),

          // shops
          route('/shops')
            .get(compose([wxUserAuth, shopApi.handleListShopRequest])),
          route('/shops/:shopId/entry-config')
            .get(shopApi.getEntryConfig),
          route('/shops/:shopId/hair-photos')
            .get(shopApi.getHairPhotos),
          route('/shops/:shopId')
            .get(shopApi.handleGetShopRequest),
          route('/shops/:shopId/category/:cate/products')
            .get(prodApi.handleListProductByCategory),
          route('/shops/:shopId/products')
            .get(prodApi.handleListProduct),
          route('/shops/:shopId/category/:cate/product-groups')
            .get(shopApi.handleListProductGroup),
          route('/shops/:shopId/staffs/:staffId/appointment')
            .post(compose([wxUserAuth, apmApi.handleMakeAppointment])),
          route('/shops/:shopId/staffs')
            .get(compose([wxUserAuth, apmApi.handleListAppointmentStaff])),
          route('/products/:prodId')
            .get(prodApi.handleWxGetProduct),
          route('/shops/:shopId/staffs/:userid/product-option')
            .get(staffApi.getStaffProductOption),
          route('/shops/:shopId/primary-product/:category')
            .get(prodApi.getPrimaryProduct),
          route('/shops/:shopId/comments')
            .post(commentApi.listShopComment),
          route('/shops/:shopId/add-comment')
            .post(compose([wxUserAuth, commentApi.addComment])),
          // staff  
          route('/staff/:staffId')
            .get(staffApi.handleGetStaff),
          route('/staff/:staffId/comment-stats')
            .get(staffApi.getStaffCommentStats),
          // user
          route('/user-info2')
            .get(compose([wxUserAuth2, userApi.handleGetUser2])),
          route('/user-info')
            .get(compose([wxUserAuth, userApi.handleGetUser])),
          route('/user-orders')
            .get(compose([wxUserAuth, orderApi.handleListOrderByOpenid])),
          route('/user/:openid/tickets')
            .get(compose([wxUserAuth, handleListTicketByOpenid])),
          route('/user/:openid/tickets/:hash/qrcode.png')
            .get(handleGetTicketQRCode),
          route('/user/:openid/wx-media/:mediaId')
            .get(userApi.handleDownloadUserWxMedia),
          route('/user-hair-photos')
            .post(compose([wxUserAuth, userApi.handleUpdateHairPhotos])),
          route('/user-comments')
            .get(compose([wxUserAuth, commentApi.handleGetComment])),

          // order
          route('/orders')
            .post(compose([wxUserAuth, orderApi.handleCreateOrder])),
          route('/orders/:orderId')
            .get(compose([wxUserAuth, orderApi.handleGetOrder]))
            .delete(compose([wxUserAuth, orderApi.handleDelOrder])),
          route('/order-msg/:msgId')
            .get(compose([wxUserAuth, orderApi.getOrderByMsgId])),
          route('/orders/:orderId/cancel')
            .post(compose([wxUserAuth, orderApi.handleCancelOrder])),
          route('/order-pay-ok/:orderId')
            .post(compose([wxUserAuth, orderApi.handlePayOk])),
          route('/apm-pay-ok/:orderId')
            .post(compose([wxUserAuth, orderApi.appointmentPayOk])),
          route('/pay-msg/:msgId')
            .get(compose([wxUserAuth, apmApi.getUserPayMsg])),

          // category
          route('/categories')
            .get(categoryApi.handleListCategory),

          //appointment
          route('/appointments')
            .get(compose([wxUserAuth, apmApi.handleListUserAppointment])),
          route('/appointments/:apmId')
            .delete(compose([wxUserAuth, apmApi.userCancelAppointment])),
          route('/appointments/:apmId/cases')
            .get(compose([wxUserAuth, apmApi.getCases])),

          // coupon
          route('/coupon')
            .get(compose([couponFieldMapping, couponApi.handleListCoupon])),
          route('/coupon/:couponId')
            .get(couponApi.getCouponByCouponId),
          route('/user-coupons/:couponId')
            .post(compose([wxUserAuth, couponApi.addUserCoupon])),
          route('/user-coupons/:couponId')
            .get(compose([wxUserAuth, couponFieldMapping, couponApi.getUserCoupon])),
          route('/user-coupons')
            .get(compose([wxUserAuth, couponFieldMapping, couponApi.listUserCoupon])),
          route('/order-coupon')
            .post(compose([couponFieldMapping, couponApi.listOrderCoupon])),
          route('/paynotify-coupon')
            .post(compose([wxUserAuth, couponFieldMapping, couponApi.listPayNotifyCoupon])),
          route('/coupons/:couponId/users')
            .get(couponApi.listUserByCouponId),
        ]
      })
    ]
  }),

  notFound
])

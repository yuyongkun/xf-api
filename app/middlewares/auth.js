const logger = require('../lib/log-console')
const { random, md5, sha1, getParameter } = require('../utils')
const weixinAuth = require('../utils/weixin-auth')

const {
    userSessionTTL,
    ACCESS_TOKEN_LENGTH,
    ACCESS_SECRET_LENGTH,
    ACCESS_SECRET_CHAR_CANDIDATES
} = require('../config/app')
const { STAFF_STATUS } = require('../config/constants')

const store = require('../store')


module.exports = {
    validateAuthorization,
    handleLoginRequest,
    validateStaffAuthorization,
    handleStaffLogin,
    wxUserAuth,
    wxStaffAuth,

    _getAuthorizedAdminSession,
    _authenticate,
}


async function validateAuthorization(ctx, next) {
    let adminSession = await _getAuthorizedAdminSession(ctx)

    let adminObject = await store.getAdminByUsername(adminSession.username)
    ctx.assert(adminObject, 401, `User Already Deleted`)

    ctx.state.user = Object.assign({}, adminSession, adminObject)
    logger.log('user: %j', ctx.state.user)

    await next()
}

async function _getAuthorizedAdminSession(ctx) {
    let authHeader = ctx.get('Authorization')
    logger.log('auth header:', authHeader)
    ctx.assert(authHeader, 401, 'Missing Header: Authorization')
    ctx.assert(authHeader.startsWith('Bearer '), 401, 'Invalid Authorization Header Value')

    let access_token = authHeader.slice(7)
    logger.log('access token:', access_token)

    let adminSession = await store.getAdminSession({ access_token })
    logger.log('admin session: %j', adminSession)
    ctx.assert(adminSession && new Date(adminSession.expires_at) > new Date().getTime(),
        401, 'Invalid or Expired Access Token')

    return adminSession
}

async function _authenticate(user, pass) {
    let adminObj = await store.getAdminByUsername(user)

    console.log(adminObj)

    if (!adminObj) {
        return null
    }

    let pwdHash = sha1(pass)
    if (pwdHash !== adminObj.pwdHash) {
        return null
    }

    return adminObj
}

async function handleLoginRequest(ctx) {
    let userSession = {}

    let params = ctx.request.body
    let user = params.username
    logger.log('user:', user)
    ctx.assert(user, 400, 'Missing Argument: username')
    ctx.assert(/^[a-z0-9._-]{1,20}$/.test(user), 400, 'Invalid Argument: username')

    let pass = params.password
    logger.log('pass:', pass)
    ctx.assert(pass, 400, 'Missing Argument: password')

    let authenticationResult = await _authenticate(user, pass)
    logger.log('user object: %j', authenticationResult)
    ctx.assert(authenticationResult, 400, 'Invalid Credentials')

    userSession.username = authenticationResult.username

    userSession.access_token = random(ACCESS_TOKEN_LENGTH)
    logger.log('access token:', userSession.access_token)
    userSession.access_secret = random(ACCESS_SECRET_LENGTH, ACCESS_SECRET_CHAR_CANDIDATES)
    logger.log('access secret:', userSession.access_secret)
    userSession.token_type = 'Bearer'
    logger.log('token type:', userSession.token_type)
    userSession.created_at = new Date().toISOString()
    logger.log('created at:', userSession.created_at)
    userSession.expires_in = userSessionTTL
    logger.log('expires in:', userSession.expires_in)
    userSession.expires_at = new Date(new Date(userSession.created_at).getTime() + userSessionTTL * 1000).toISOString()
    logger.log('expires at:', userSession.expires_at)

    logger.log('saving user session....')
    await store.saveAdminSession(userSession, { ttl: userSessionTTL })

    ctx.body = { data: { userSession } }
}

/* Staff Auth */
async function wxStaffAuth(ctx, next) {
    let token = ctx.cookies.get('S_T')
    ctx.assert(token, 401, 'Missing Authorization Token')

    let staff = await store.getStaffInfoByToken(token)
    logger.log('staff object: %j', staff)
    ctx.assert(staff, 401, 'Invalid Token')
    ctx.assert(staff.status !== STAFF_STATUS.LEFT, 401, 'User Already Left')

    ctx.state.user = staff
    logger.log('staff: %j', ctx.state.user)

    await next()
}

async function validateStaffAuthorization(ctx, next) {
    let staffSession = await _getAuthorizedStaffSession(ctx)

    ctx.assert(staffSession, 401, 'Invalid Credential')

    let staffObject = await store.getStaffByUsername(staffSession.username)
    ctx.assert(staffObject, 401, `User Already Deleted`)
    ctx.assert(staffObject.status !== STAFF_STATUS.LEFT, 401, `User Already Left`)

    ctx.state.user = Object.assign({}, staffSession, staffObject)
    logger.log('user: %j', ctx.state.user)

    await next()
}

async function _getAuthorizedStaffSession(ctx) {
    let authHeader = ctx.get('Authorization')
    logger.log('auth header:', authHeader)
    ctx.assert(authHeader, 401, 'Missing Header: Authorization')
    ctx.assert(authHeader.startsWith('Bearer '), 401, 'Invalid Authorization Header Value')

    let access_token = authHeader.slice(7)
    logger.log('access token:', access_token)

    let staffSession = await store.getStaffSession({ access_token })
    logger.log('staff session: %j', staffSession)

    return staffSession
}

async function _authenticateStaff(user, pass) {
    let staffObj = await store.getStaffByUsername(user)

    console.log(staffObj)

    if (!staffObj || staffObj.status === STAFF_STATUS.LEFT) {
        return null
    }

    let pwdHash = sha1(pass)
    if (pwdHash !== staffObj.pwdHash) {
        return null
    }

    return staffObj
}

async function handleStaffLogin(ctx) {
    let params = ctx.request.body
    let user = params.username
    logger.log('user:', user)
    ctx.assert(user, 400, 'Missing Argument: username')
    // ctx.assert(/^[a-z0-9._-]{1,20}$/.test(user), 400, 'Invalid Argument: username')

    let pass = params.password
    logger.log('pass:', pass)
    ctx.assert(pass, 400, 'Missing Argument: password')

    let staff = await _authenticateStaff(user, pass)
    logger.log('user object: %j', staff)
    ctx.assert(staff, 400, 'Invalid Credentials')

    logger.log('saving user session....')
    let token = await store.generateStaffToken({ staffId: staff.userid })
    staff.token = token
    delete staff._id

    ctx.body = { data: { userSession: staff } }
}


/* wx user auth */
async function wxUserAuth2(ctx, next) {
    // 如果access_token已经存在
    if (ctx.req.access_token && ctx.req.openid) {
        // 1,先检测access_token是否过期
        weixinAuth.accessTokenValid(ctx.req.access_token, ctx.req.openid).then(result => {
            if (result.errcode != 0) { //过期
                // 使用refresh_token刷新
                weixinAuth.refreshToken(ctx.req.refresh_token).then(result => {
                    if (result.access_token) {
                        ctx.req.access_token = result.access_token;
                        ctx.req.refresh_token = result.refresh_token;
                    } else { //refresh_token失效，重新授权获取access_token
                        weixinAuth.getCode(ctx.href);
                    }
                });
            }

        });
    } else {
        if (location.href.indexOf('code=') !== -1) {
            let code = getParameter('code');
            weixinAuth.getAccessToken(code).then(result => {
                ctx.req.access_token = result.access_token;
                ctx.req.openid = result.openid;
                ctx.req.refresh_token = result.refresh_token;
                weixinAuth.getUserInfo(result.access_token, result.openid).then(result => {
                    return result;
                });
            });
        } else {
            weixinAuth.getCode(ctx.href);
        }
    }

},

async function wxUserAuth(ctx, next) {
    let token = ctx.cookies.get('T')
    ctx.assert(token, 401, 'Missing Authorization Token')

    let user = await store.getUserInfoByToken(token)
    ctx.assert(user, 401, 'Invalid Token')

    ctx.state.user = user

    await next()
}
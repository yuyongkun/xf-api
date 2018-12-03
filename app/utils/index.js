/*
 * This module provides functions commonly used by various services.
 */

const crypto = require('crypto')
const util = require('util')
const fs = require('fs')
const path = require('path')
const js2xmlparser = require('js2xmlparser')
const { parseString } = require('xml2js')
const QRCode = require('qrcode')

let _parseString = util.promisify(parseString)

const DEFAULT_RANDOM_CANDIDATES = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DEFAULT_RANDOM_NUMBER_CANDIDATES = '0123456789'

const TICKET_QRCODE_PATH = process.env.TICKET_QRCODE_PATH || ''


const hash = module.exports.hash = (a, str) => {
    return crypto.createHash(a).update(str).digest('hex')
}

const md5 = module.exports.md5 = (str) => hash('md5', str)

const sha1 = module.exports.sha1 = (str) => hash('sha1', str)

const sha256 = module.exports.sha256 = (str, secret) => {
    return crypto.createHmac('sha256', secret).update(str).digest('hex')
}

const random = module.exports.random = (spec, candidates) => {
    // 1. random(5) => 'a93b1' (a string whose length equal to `spec`)
    if (typeof spec === 'number') {
        candidates = candidates === 'number' ?
            DEFAULT_RANDOM_NUMBER_CANDIDATES :
            candidates || DEFAULT_RANDOM_CANDIDATES
        let str = ''
        for (let i = 0; i < spec; i++) {
            str += candidates.charAt(Math.floor(Math.random() * candidates.length))
        }
        return str
    }

    // 2. random(['a', 'b']) => 'a' or 'b' (randomly choice from the list)
    if (Array.isArray(spec)) {
        return spec[Math.floor(Math.random() * spec.length)]
    }

    // 3. random(<PREDEFINED>)
    switch (spec) {
        case 'email':
            // e.g. random('email') => '1234567@12345.com' 
            return `${random(7)}@${random(5)}.${random(['com', 'net', 'cn', 'co'])}`
    }

    return Math.random()
}

const timestamp = module.exports.timestamp = (unit) => {
    if (!unit || unit === 'ms') { return Date.now() }
    return Math.floor(Date.now() / 1000)
}

const js2xml = module.exports.js2xml = (json) => {
    return js2xmlparser.parse('xml', json, {
        declaration: { include: false }
    })
}

const getUnifiedOrderSignStr = module.exports.getUnifiedOrderSignStr = (orderData, wxAPIKey) => {
    // see algorithm: https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=4_3

    console.log(`unified_order_sign:wx_order_data: %j`, orderData)
    let signStr = Object.keys(orderData).map(key => {
        return `${key}=${orderData[key]}`
    }).sort().join('&')
    signStr = `${signStr}&key=${wxAPIKey}`
    console.log(`unified_order_sign:sign_str: %s`, signStr)
    let sign = md5(signStr).toUpperCase()
    console.log(`unified_order_sign:sign: %s`, sign)
    return sign
}

const getJSAPIPaySign = module.exports.getJSAPIPaySign = (signFields, wxAPIKey) => {
    // see algorithm: https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=4_3
    // and: https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115

    console.log(`jsapi_pay_sign:wx_order_data: %j`, signFields)
    let signStr = Object.keys(signFields).map(key => {
        return `${key}=${signFields[key]}`
    }).sort().join('&')
    signStr = `${signStr}&key=${wxAPIKey}`
    console.log(`jsapi_pay_sign:sign_str: %s`, signStr)
    let sign
    if (signFields.signType === 'SHA1') {
        sign = sha1(signStr).toUpperCase()
    } else if (signFields.signType === 'MD5') {
        sign = md5(signStr).toUpperCase()
    }
    console.log(`jsapi_pay_sign:sign: %s`, sign)
    return sign
}

const xml2js = module.exports.xml2js = async(xml, options) => {
    return await _parseString(xml, options)
}

const getQRCodePath = module.exports.getQRCodePath = (ticketHash) => {
    return `${TICKET_QRCODE_PATH}/${ticketHash}.png`
}

const getQRCodeUrl = module.exports.getQRCodeUrl = (openid, ticketHash) => {
    return `/api/wx/user/${openid}/tickets/${ticketHash}/qrcode.png`
}

const generateQRCode = module.exports.generateQRCode = async(ticketCode, ticketHash) => {
    return await new Promise((resolve, reject) => {
        let path = getQRCodePath(ticketHash)
        // see more options: 
        // https://github.com/soldair/node-qrcode#tofilepath-text-options-cberror
        QRCode.toFile(path, ticketCode, { type: 'png' }, (err) => {
            if (err) { return reject(err) }
            return resolve({ path, ticketCode })
        })
    })
}

const getPwdHash = module.exports.getPwdHash = pwd => sha1(pwd)

const getUploadDir = module.exports.getUploadDir = () => {
    let UPLOAD_DIR = '/data/uploaded-files'
    if (process.env.NODE_ENV === 'development') {
        UPLOAD_DIR = path.join(__dirname, '../../upload')
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR)
        }
    }

    return UPLOAD_DIR
}

const getWxMediaFilename = module.exports.getWxMediaFilename = (disposition) => {
    // 'attachment; filename="nCKnDoGUv0z2ye8CggAdGQr0hkcE200-itvmq0HeahP7m_gxxwByyTvyuXVyxQDQ.jpg"'
    let reg = /attachment; filename="(.+)"/
    return disposition.replace(reg, '$1')
}

const getFormatDate = module.exports.getFormatDate = function getFormatDate(date) {
    date = date || new Date()
    let year = date.getFullYear()
    let month = date.getMonth() + 1
    let day = date.getDate()
    let hour = addZero(date.getHours())
    let minute = addZero(date.getMinutes())
    let second = addZero(date.getSeconds())

    function addZero(num) {
        return num < 10 ? `0${num}` : num + ''
    }

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

module.exports.getApmWaitTime = (count) => {
    const once = 20 // minutes
    let time = once * count
    let hour = Math.floor(time / 60)
    let minute = time % 60
    return `${hour}小时${minute}分钟`
}

module.exports.getDistance = (lat1, lng1, lat2, lng2) => {
    let dis = 0
    let radLat1 = toRadians(lat1)
    let radLat2 = toRadians(lat2)
    let deltaLat = radLat1 - radLat2
    let deltaLng = toRadians(lng1) - toRadians(lng2);
    dis = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(deltaLat / 2), 2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(deltaLng / 2), 2)));
    return dis * 6378137;

    function toRadians(d) { return d * Math.PI / 180; }
}

module.exports.formatDistance = (dis) => {
    if (dis < 1000) {
        return `${Math.round(dis)} 米`
    } else if (dis >= 1000 && dis <= 1000000) {
        return `${parseFloat(dis / 1000).toFixed(1)} 公里`
    } else {
        return '超过一千公里'
    }
}

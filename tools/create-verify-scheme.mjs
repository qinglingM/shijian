/**
 * 调用阿里云 dypnsapi CreateVerifyScheme 接口，获取 SchemeCode
 * 用法：node tools/create-verify-scheme.mjs
 */
import { createHmac } from 'node:crypto'

const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_ID'
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || 'YOUR_ACCESS_KEY_SECRET'

function percentEncode(s) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A')
}

function sign(params) {
  const sorted = Object.keys(params).sort()
  const canonical = sorted.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
  return createHmac('sha1', ACCESS_KEY_SECRET + '&').update(stringToSign).digest('base64')
}

async function callAPI(action, extra = {}) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const nonce = Math.random().toString(36).slice(2) + Date.now()

  const params = {
    Action: action,
    Version: '2017-05-25',
    AccessKeyId: ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: nonce,
    SignatureVersion: '1.0',
    Timestamp: timestamp,
    Format: 'JSON',
    ...extra,
  }

  params.Signature = sign(params)

  const res = await fetch('https://dypnsapi.aliyuncs.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams(params).toString(),
  })
  return res.json()
}

// 先探测可用接口列表
const result = await callAPI('DescribeVerifyScheme', {})

console.log(JSON.stringify(result, null, 2))

if (result.SchemeCode) {
  console.log('\n✅ SchemeCode:', result.SchemeCode)
} else if (result.schemeCode) {
  console.log('\n✅ SchemeCode:', result.schemeCode)
} else {
  console.log('\n❌ 未返回 SchemeCode，请查看上方完整响应')
}

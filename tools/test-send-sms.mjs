/**
 * 本地快速测试：通过阿里云 dysmsapi 发送短信
 * 用法：node tools/test-send-sms.mjs <手机号>
 * 例：node tools/test-send-sms.mjs 13800138000
 */
import { createHmac } from 'node:crypto'

const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_ID'
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || 'YOUR_ACCESS_KEY_SECRET'
const SIGN_NAME = '速通互联验证平台'
const TEMPLATE_CODE = '100001'

const phone = process.argv[2]
if (!phone) { console.error('用法：node tools/test-send-sms.mjs <手机号>'); process.exit(1) }

function percentEncode(s) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A')
}

const code = String(Math.floor(100000 + Math.random() * 900000))
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const nonce = Math.random().toString(36).slice(2) + Date.now()

const params = {
  Action: 'SendSmsVerifyCode',
  Version: '2017-05-25',
  AccessKeyId: ACCESS_KEY_ID,
  SignatureMethod: 'HMAC-SHA1',
  SignatureNonce: nonce,
  SignatureVersion: '1.0',
  Timestamp: timestamp,
  Format: 'JSON',
  PhoneNumber: phone,
  SignName: SIGN_NAME,
  TemplateCode: TEMPLATE_CODE,
  TemplateParam: JSON.stringify({ code, min: '5' }),
}

const canonical = Object.keys(params).sort()
  .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
  .join('&')
const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
params.Signature = createHmac('sha1', ACCESS_KEY_SECRET + '&').update(stringToSign).digest('base64')

console.log(`📤 正在向 ${phone} 发送验证码 ${code} …`)

const res = await fetch('https://dypnsapi.aliyuncs.com/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
  body: new URLSearchParams(params).toString(),
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))

if (json.Code === 'OK') {
  console.log(`\n✅ 发送成功！验证码：${code}`)
} else {
  console.log(`\n❌ 发送失败：${json.Code} - ${json.Message}`)
}

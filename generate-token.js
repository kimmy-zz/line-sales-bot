/**
 * LINE Channel Access Token v2.1 Generator
 * 使用 .env 檔案方式（更簡單）
 * 
 * 安裝: npm install dotenv
 * 運行: node generate-token.js
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

// ============ 從環境變數讀取 ============
const PRIVATE_KEY_JSON = process.env.PRIVATE_KEY;
const KID = process.env.KID;
const CHANNEL_ID = process.env.CHANNEL_ID;

// ============ 驗證輸入 ============
if (!PRIVATE_KEY_JSON || !KID || !CHANNEL_ID) {
  console.error('❌ 錯誤：缺少必要的環境變數');
  console.error('請確保你的 .env 檔案包含：');
  console.error('  PRIVATE_KEY={"alg":"RS256",...}');
  console.error('  KID=your-kid');
  console.error('  CHANNEL_ID=your-channel-id');
  process.exit(1);
}

let PRIVATE_KEY;
try {
  PRIVATE_KEY = JSON.parse(PRIVATE_KEY_JSON);
} catch (e) {
  console.error('❌ 錯誤：PRIVATE_KEY 不是有效的JSON');
  console.error('請檢查 .env 中的 PRIVATE_KEY 格式');
  process.exit(1);
}

// ============ 生成JWT ============
function generateJWT() {
  console.log('🔐 生成JWT...');
  
  // Header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: KID
  };
  
  // Payload
  const payload = {
    iss: CHANNEL_ID,
    sub: CHANNEL_ID,
    aud: 'https://api.line.me/',
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1小時有效期
    token_exp: 86400 // token有效30天
  };
  
  console.log('📋 Header:', JSON.stringify(header));
  console.log('📋 Payload:', JSON.stringify(payload));
  
  // 轉換為Base64
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  // 簽名
  const message = `${headerEncoded}.${payloadEncoded}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  
  // 轉換私鑰格式
  const privateKeyPEM = generatePEM(PRIVATE_KEY);
  const signature = sign.sign(privateKeyPEM, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const jwt = `${message}.${signature}`;
  console.log('✅ JWT生成成功\n');
  
  return jwt;
}

// ============ 從JWK轉換為PEM格式 ============
function generatePEM(jwk) {
  console.log('🔑 檢查私鑰欄位...');
  
  // 檢查必要欄位
  const requiredFields = ['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'];
  for (const field of requiredFields) {
    if (!jwk[field]) {
      throw new Error(`缺少私鑰欄位: ${field}`);
    }
  }
  
  console.log('✅ 所有必要欄位都存在');
  
  // 直接使用JWK，不要轉換成Buffer
  const keyObject = crypto.createPrivateKey({
    key: jwk,
    format: 'jwk'
  });
  
  console.log('✅ 私鑰轉換為PEM格式成功');
  
  return keyObject.export({ type: 'pkcs1', format: 'pem' });
}

// ============ 調用LINE API Issue Token ============
function issueChannelAccessToken(jwt) {
  console.log('🚀 調用LINE API...\n');
  
  const postData = JSON.stringify({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  });
  
  const options = {
    hostname: 'api.line.me',
    port: 443,
    path: '/oauth2/v2.1/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            console.log('✅ 成功！');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('\n🎉 Channel Access Token:');
            console.log(result.access_token);
            console.log('\n🔑 Key ID:');
            console.log(result.key_id);
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('\n⚠️  複製這些值到你的 .env 檔案：\n');
            console.log(`LINE_CHANNEL_ACCESS_TOKEN=${result.access_token}`);
            console.log(`TOKEN_KEY_ID=${result.key_id}`);
            console.log('\n✅ 現在你可以回到bot代碼使用這個token了！');
            resolve(result);
          } else if (result.error) {
            console.log('❌ LINE API 錯誤:');
            console.log('Error:', result.error);
            console.log('Description:', result.error_description);
            reject(result);
          }
        } catch (e) {
          console.log('❌ 解析回應失敗:', e);
          console.log('原始回應:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ 網路錯誤:', e);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// ============ 主程式 ============
async function main() {
  console.log('\n🤖 LINE Channel Access Token Generator v2.1\n');
  
  try {
    const jwt = generateJWT();
    await issueChannelAccessToken(jwt);
  } catch (error) {
    console.error('\n❌ 發生錯誤');
    console.error('詳細信息:', error.message);
    if (error.stack) {
      console.error('堆疊追蹤:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
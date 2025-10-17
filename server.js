/**
 * LINE Sales Assistant Bot - MVP (簡化版)
 * 先focus在webhook驗證和訊息接收，暫不發送回覆
 * 
 * 安裝：npm install express crypto dotenv axios
 * 運行：node server.js
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// ============ 環境變數 ============
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

console.log('🔧 環境設定:');
console.log('✓ Channel Secret:', LINE_CHANNEL_SECRET ? '已設定' : '❌ 缺少');
console.log('✓ Access Token:', LINE_CHANNEL_ACCESS_TOKEN ? '已設定' : '⚠️ 可選（暫不需要）');
console.log('✓ Claude API Key:', CLAUDE_API_KEY ? '已設定' : '⚠️ 可選（暫不需要）');

// ============ Webhook驗證 ============
function validateLineSignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

// ============ Webhook端點 ============
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-line-signature'];
  const body = req.rawBody || JSON.stringify(req.body);
  
  console.log('\n📨 收到webhook請求');
  console.log('簽名驗證:', validateLineSignature(body, signature) ? '✅ 通過' : '❌ 失敗');
  
  // 驗證簽名
  if (!validateLineSignature(body, signature)) {
    console.log('❌ 簽名驗證失敗');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  console.log('✅ 簽名驗證成功');
  
  const events = req.body.events;
  
  for (const event of events) {
    console.log('\n📥 處理事件:');
    console.log('- 類型:', event.type);
    console.log('- 訊息來源:', event.source?.type);
    
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      const userId = event.source.userId;
      const groupId = event.source.groupId || 'N/A';
      
      console.log('- 訊息內容:', userMessage);
      console.log('- User ID:', userId);
      console.log('- Group ID:', groupId);
      
      // ============ TODO: 這裡加入Claude分析 ============
      // analyzeMessageWithClaude(userMessage)
      //   .then(analysis => {
      //     console.log('Claude分析:', analysis);
      //     // TODO: 根據分析結果回覆
      //   });
      
      console.log('✅ 訊息已接收並記錄');
    }
  }
  
  res.json({ ok: true });
});

// ============ Raw body中間件（用於簽名驗證） ============
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ============ 健康檢查 ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    channelSecretConfigured: !!LINE_CHANNEL_SECRET,
    tokenConfigured: !!LINE_CHANNEL_ACCESS_TOKEN
  });
});

// ============ 啟動服務器 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 LINE Sales Bot 運行於 http://localhost:${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`❤️  健康檢查: http://localhost:${PORT}/health`);
  console.log('\n⏳ 等待LINE訊息...\n');
});

// ============ 錯誤處理 ============
process.on('unhandledRejection', (err) => {
  console.error('❌ 未處理的拒絕:', err);
});
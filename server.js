/**
 * LINE Sales Assistant Bot - MVP (记录 + Claude分析版本)
 * 功能：接收消息 → Claude分析 → 记录到logs
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
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

console.log('🔧 環境設定:');
console.log('✓ Channel Secret:', LINE_CHANNEL_SECRET ? '已設定' : '❌ 缺少');
console.log('✓ Claude API Key:', CLAUDE_API_KEY ? '已設定' : '⚠️ 可選');

// ============ Webhook驗證 ============
function validateLineSignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

// ============ Claude分析訊息 ============
async function analyzeMessageWithClaude(message) {
  if (!CLAUDE_API_KEY) {
    console.log('⚠️  Claude API Key未設定，跳過分析');
    return {
      type: 'unknown',
      intentScore: 0,
      response: message
    };
  }

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      system: `你是一個銷售助手。分析用戶的訊息並判斷：
1. 訊息類型：faq（常見問題）、high_intent（高購買意圖）、other（其他）
2. 意圖分數：0-100
3. 簡短摘要

回應JSON格式（只返回JSON）：
{
  "type": "faq|high_intent|other",
  "intentScore": 0-100,
  "summary": "摘要",
  "suggestedAction": "建議的行動"
}

高意圖信號：報價、簽約、試用、demo、開始合作、成本、預算、timeline、實施等。`,
      messages: [
        {
          role: 'user',
          content: `分析這條訊息：${message}`
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    const content = response.data.content[0].text;
    const analysis = JSON.parse(content);
    return analysis;
  } catch (error) {
    console.error('Claude分析失敗:', error.message);
    return {
      type: 'unknown',
      intentScore: 0,
      summary: message,
      suggestedAction: '無法分析'
    };
  }
}

// ============ 記錄到Google Sheet（簡化版） ============
async function logToSheet(data) {
  console.log('\n📊 記錄到Sheet:');
  console.log('- 日期:', data.timestamp);
  console.log('- 用戶:', data.userId);
  console.log('- 訊息:', data.message);
  console.log('- 類型:', data.analysisType);
  console.log('- 意圖分數:', data.intentScore);
  console.log('- 摘要:', data.summary);
  console.log('- 建議行動:', data.suggestedAction);
  
  // TODO: 集成Google Sheets API
  // 現在可以手動在Google Sheet中建立，後續自動化
}

// ============ Webhook端點 ============
app.post('/webhook', async (req, res) => {
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
      
      // ============ Claude分析 ============
      console.log('\n🤖 開始Claude分析...');
      const analysis = await analyzeMessageWithClaude(userMessage);
      
      console.log('✅ Claude分析完成:');
      console.log('- 類型:', analysis.type);
      console.log('- 意圖分數:', analysis.intentScore);
      console.log('- 摘要:', analysis.summary);
      console.log('- 建議:', analysis.suggestedAction);
      
      // ============ 記錄到Sheet ============
      await logToSheet({
        timestamp: new Date().toISOString(),
        userId,
        groupId,
        message: userMessage,
        analysisType: analysis.type,
        intentScore: analysis.intentScore,
        summary: analysis.summary,
        suggestedAction: analysis.suggestedAction
      });
      
      console.log('✅ 訊息已接收、分析並記錄');
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
    claudeConfigured: !!CLAUDE_API_KEY
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

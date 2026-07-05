/**
 * 搜索后端服务
 * 提供 /api/search 端点供前端调用
 * 后端发起爬虫请求，避免浏览器 CORS 限制
 */

import express from 'express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { searchBing, fetchWebPage } from './search.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// JSON 请求体解析
app.use(express.json({ limit: '10mb' }));

// CORS 中间件 - 允许前端开发服务器访问
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 搜索 API
app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    res.status(400).json({ error: '请提供搜索关键词（?q=...）' });
    return;
  }

  try {
    const results = await searchBing(query);
    console.log(`[工具调用] web_search | 参数: query="${query}" | 返回 ${results.length} 条结果`);
    res.json({ query, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '搜索服务异常';
    console.error(`[搜索错误] q="${query}":`, message);
    res.status(502).json({ error: message, query });
  }
});

// 网页内容抓取 API
app.get('/api/fetch-page', async (req, res) => {
  const url = String(req.query.url || '').trim();

  if (!url) {
    res.status(400).json({ error: '请提供 URL（?url=...）' });
    return;
  }

  try {
    const { title, content } = await fetchWebPage(url);
    console.log(`[工具调用] web_fetch | 参数: url="${url}" | 返回内容长度: ${content.length} 字符`);
    res.json({ url, title, content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '网页抓取异常';
    console.error(`[抓取错误] url="${url}":`, message);
    res.status(502).json({ error: message, url });
  }
});

// 日志写入 API
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, 'logs');

// 确保 logs 目录存在
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

app.post('/api/logs', (req, res) => {
  const { filename, content } = req.body;

  if (!filename || !content) {
    res.status(400).json({ error: '请提供 filename 和 content' });
    return;
  }

  // 安全校验：只允许在 logs 目录内创建文件
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = join(LOGS_DIR, safeName);

  // 确保路径仍在 logs 目录内
  if (!filePath.startsWith(LOGS_DIR)) {
    res.status(403).json({ error: '非法的文件名' });
    return;
  }

  try {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`[日志] 已写入: ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : '写入日志失败';
    console.error(`[日志错误]`, message);
    res.status(500).json({ error: message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🔍 搜索后端服务已启动: http://localhost:${PORT}`);
  console.log(`   ├─ GET /api/health       - 健康检查`);
  console.log(`   ├─ GET /api/search?q=关键词      - 搜索`);
  console.log(`   ├─ GET /api/fetch-page?url=URL   - 抓取网页内容`);
  console.log(`   └─ POST /api/logs                - 写入对话日志`);
});

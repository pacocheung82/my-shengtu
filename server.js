const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const at = text.indexOf('=');
    if (at < 1) continue;
    const key = text.slice(0, at).trim();
    const value = text.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '.env.local'));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 4 },
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function config() {
  const configuredModel = process.env.IMAGE_MODEL || 'gpt-image-2.5';
  return {
    key: process.env.XJJUHE_API_KEY || '',
    base: (process.env.XJJUHE_BASE_URL || 'https://xjjuhe.site/v1').replace(/\/$/, ''),
    // 旧示例模型不在当前账号模型列表中，自动升级到可用模型。
    model: configuredModel === 'gpt-image-1' ? 'gpt-image-2.5' : configuredModel,
    editModel: process.env.IMAGE_EDIT_MODEL || 'nano_banana_2',
  };
}

app.get('/api/status', (_req, res) => {
  const { key, base, model } = config();
  res.json({ configured: Boolean(key && !key.includes('请在这里')), base, model });
});

app.get('/api/models', async (_req, res) => {
  const { key, base } = config();
  if (!key || key.includes('请在这里')) return res.status(503).json({ error: { message: '尚未配置 API 密钥。' } });
  try {
    const upstream = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30000),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    const models = (data.data || [])
      .filter(item => item.category === 'image' || /image|nano|flux|dall|imagen|seedream/i.test(item.id || ''))
      .map(item => ({ id: item.id, supportsVision: Boolean(item.supports_vision), vendor: item.vendor || item.owned_by || '' }));
    res.json({ data: models });
  } catch (error) {
    res.status(502).json({ error: { message: `读取模型列表失败：${error.message}` } });
  }
});

app.post('/api/images/generations', async (req, res) => {
  const { key, base, model } = config();
  if (!key || key.includes('请在这里')) {
    return res.status(503).json({ error: { message: '尚未配置密钥，请复制 .env.local.example 为 .env.local 并填写 XJJUHE_API_KEY。' } });
  }

  const prompt = String(req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: { message: '请输入画面描述。' } });

  const body = {
    model: req.body.model || model,
    prompt: prompt.slice(0, 8000),
    n: Math.min(Math.max(Number(req.body.n) || 1, 1), 4),
    size: req.body.size || '1024x1024',
    quality: req.body.quality || 'standard',
  };

  // 部分 OpenAI 兼容服务不接受 response_format，因此仅在前端明确传入时添加。
  if (req.body.response_format) body.response_format = req.body.response_format;

  try {
    const upstream = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: { message: text || `上游接口返回 ${upstream.status}` } }; }
    res.status(upstream.status).json(data);
  } catch (error) {
    const message = error.name === 'TimeoutError' ? '图片生成超时，请稍后重试。' : `图片接口请求失败：${error.message}`;
    res.status(502).json({ error: { message } });
  }
});

// 图片编辑接口预留：有参考图时使用 OpenAI 兼容 multipart 格式。
app.post('/api/images/edits', upload.array('image', 4), async (req, res) => {
  const { key, base, editModel } = config();
  if (!key || key.includes('请在这里')) return res.status(503).json({ error: { message: '尚未配置 API 密钥。' } });
  if (!req.files?.length) return res.status(400).json({ error: { message: '请至少上传一张参考图。' } });
  try {
    const form = new FormData();
    form.append('model', req.body.model || editModel);
    form.append('prompt', String(req.body.prompt || '基于参考图生成').slice(0, 8000));
    form.append('size', req.body.size || '1024x1024');
    form.append('quality', req.body.quality || 'standard');
    for (const file of req.files) form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    const upstream = await fetch(`${base}/images/edits`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(180000),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: { message: text || `上游接口返回 ${upstream.status}` } }; }
    res.status(upstream.status).json(data);
  } catch (error) {
    res.status(502).json({ error: { message: `图片编辑请求失败：${error.message}` } });
  }
});

app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`星图 AI 工作台已启动：http://localhost:${port}`));

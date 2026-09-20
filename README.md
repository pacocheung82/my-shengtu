# 星图 AI 做图工作台

一个参考目标站交互结构制作的 AI 图片生成工作台。包含灵感模板、视觉风格、画面比例、画质/张数、参考图编辑、生成结果预览和下载。

## 启动

1. 安装依赖：`npm install`
2. 复制 `.env.local.example` 为 `.env.local`
3. 在 `.env.local` 填写 `XJJUHE_API_KEY`
4. 启动：`npm run dev`
5. 打开：`http://localhost:3000`

密钥只在 Node.js 服务端读取，不会发送到浏览器。默认使用 OpenAI 兼容接口：

- 文生图：`POST /v1/images/generations`
- 参考图编辑：`POST /v1/images/edits`

模型选择器会通过 `/v1/models` 动态读取当前密钥可用的图片模型。默认文生图使用 `gpt-image-2.5`，上传参考图时使用支持视觉的 `nano_banana_2`。若服务商调整模型，可修改 `.env.local` 中的 `IMAGE_MODEL` 和 `IMAGE_EDIT_MODEL`。

# 演示视频

「爸妈别急」参赛演示视频，使用 Playwright + FFmpeg + edge-tts 自动化生成。

## 最终成品

| 项目 | 值 |
|------|-----|
| 文件 | `爸妈别急_演示视频.mp4` |
| 时长 | 128.5 秒（2.1 分钟） |
| 分辨率 | 1080×1920（竖屏） |
| 编码 | H.264 + AAC |
| 大小 | ~3 MB |

## 视频结构

| 时间段 | 时长 | 场景 |
|--------|------|------|
| 0s - 10s | 10s | 片头标题卡 |
| 10s - 25s | 14s | 首页展示（语音大按钮 + 4 个示例磁贴） |
| 25s - 49s | 24s | 低风险：微信没声音 → 一步式安全指导 |
| 49s - 72s | 23s | 中风险：淘宝退款 → 平台内安全步骤 + 防骗提醒 |
| 72s - 111s | 39s | 高风险：屏幕共享 → 立即停止 + 脱敏求助卡 |
| 111s - 120s | 10s | 核心理念卡（低风险教 / 高风险停 / 不确定不猜） |
| 120s - 129s | 8s | 片尾（#小有可为AIForGood） |

## 重新生成

### 前置条件

- Node.js 24+, pnpm 10+
- FFmpeg 8+ (含 ffprobe)
- Python 3.10+ with: Pillow, edge-tts, PyMuPDF (fitz)
- Google Chrome（Playwright `channel: 'chrome'`）
- Playwright (`@playwright/test` 已在 devDependencies)

### 步骤

```bash
# 1. 构建并启动 Next.js 生产服务器
pnpm build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100 &

# 2. 录制页面场景（4 个 WebM 片段）
node docs/demo-video/tools/record-scenes.mjs

# 3. 生成素材（手机框 + 标题卡）
python docs/demo-video/tools/make-assets.py

# 4. 生成 TTS 旁白（7 段 MP3）
python docs/demo-video/tools/generate-narration.py

# 5. 合成最终视频
python docs/demo-video/tools/compose-video.py
```

### 注意事项

- **swiftshader GL**：headless Chrome 录制视频需要 `--use-gl=swiftshader` 参数，否则画面空白
- **构建版本**：录制前必须重新 `pnpm build`，确保使用最新代码（暖色调设计）
- **edge-tts**：微软 TTS 服务偶尔返回 503，需要重试
- **编码耗时**：`libx264 preset=medium` 全程约 1-2 分钟

## 工具脚本说明

| 脚本 | 用途 |
|------|------|
| `tools/record-scenes.mjs` | Playwright 自动化驱动 4 个演示场景，录制为 WebM |
| `tools/make-assets.py` | PIL 生成手机框 PNG + 3 张标题卡 PNG |
| `tools/generate-narration.py` | edge-tts 生成 7 段中文语音旁白（XiaoxiaoNeural） |
| `tools/compose-video.py` | FFmpeg 合成：手机框叠加 + 字幕 PNG + 旁白音频 → 拼接 |

## 发布

上传到小红书 / B站 / 抖音 / 微博，带上话题词 `#小有可为AIForGood`。

"""
用 edge-tts 生成演示视频旁白音频。

旁白文字按场景编写，每段时长不超过对应视频片段时长。
语速略慢（rate=-8%），适合银发主题的温柔语调。
语音：zh-CN-XiaoxiaoNeural（微软晓晓，自然温暖的女声）。

输出：
  audio/00-intro.mp3      片头旁白
  audio/01-home.mp3       首页展示旁白
  audio/02-low-risk.mp3   低风险场景旁白
  audio/03-mid-risk.mp3   中风险场景旁白
  audio/04-high-risk.mp3  高风险场景旁白
  audio/05-concept.mp3    核心理念旁白
  audio/06-outro.mp3      片尾旁白
"""
import asyncio
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'audio'
AUDIO.mkdir(parents=True, exist_ok=True)

VOICE = 'zh-CN-XiaoxiaoNeural'
RATE = '-8%'  # 略慢，温暖

# ── 旁白文案 ──
# 每段文案的朗读时长需 ≤ 对应视频片段时长
NARRATIONS = [
    ('00-intro.mp3',
     '爸妈别急，银发数字生活安全副驾。'
     '看懂当前一步，只给安全的下一步；遇到风险，先停下来。'),

    ('01-home.mp3',
     '爸妈别急，帮助老人安全使用手机。'
     '遇到问题，点一下大按钮说出来，'
     '或者直接选择一个常见问题。'
     '系统会判断风险，给出安全的下一步。'),

    ('02-low-risk.mp3',
     '比如微信没声音了。'
     '系统判断这是低风险，不会给一大堆步骤，'
     '只给出一个简单、可逆的操作。'
     '每一步都有明确的成功信号，还能念出来给老人听。'),

    ('03-mid-risk.mp3',
     '遇到退款问题？系统只给出平台内的安全步骤，'
     '并提醒不要点击聊天里收到的陌生退款链接。'
     '每一步都经过人工审核，确保操作可逆。'),

    ('04-high-risk.mp3',
     '但如果对方要求开屏幕共享，或者提到转账、验证码。'
     '系统会立刻停下，不提供任何继续操作的按钮。'
     '取而代之的，是一张脱敏求助卡，'
     '一键就能发给家人，让家人快速了解情况。'),

    ('05-concept.mp3',
     '这就是安全副驾的核心：'
     '低风险时一步一步教，高风险时先停下来，'
     '不确定时绝不瞎猜。'),

    ('06-outro.mp3',
     '爸妈别急，让老人的每一步都更清楚、更可控。'
     '小有可为，AI for Good。'),
]


async def generate_all():
    for filename, text in NARRATIONS:
        out_path = AUDIO / filename
        communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
        await communicate.save(str(out_path))

        # 检查时长
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', str(out_path)],
            capture_output=True, text=True,
        )
        dur = float(result.stdout.strip()) if result.stdout.strip() else 0
        print(f'  ✓ {filename}  {dur:.1f}s')


def main():
    print(f'Generating {len(NARRATIONS)} narration clips with {VOICE} (rate={RATE})...')
    asyncio.run(generate_all())
    print('All narrations generated.')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
FFmpeg 合成脚本 v2 —— 将录制的 WebM 片段、标题卡、旁白音频合成为最终演示视频。

改进：
  - 字幕用 PIL 渲染为透明 PNG overlay（避免 drawtext 转义地狱）
  - 手机框 overlay 用独立步骤
  - 分段处理 → concat 拼接

每段处理管线：
  1. 视频段：WebM(393×851) → 缩放到手机内屏 → 叠加手机框 PNG → 居中到 1080×1920 画布 → 叠加字幕 PNG
  2. 标题卡段：静态 PNG → 缩放到 1080×1920
  3. 混合对应旁白音频（MP3）
  4. 所有段统一为 30fps H.264 + AAC
  5. concat 拼接 → 最终 MP4
"""
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'raw'
AUDIO = ROOT / 'audio'
CARDS = ROOT / 'cards'
SEGMENTS = ROOT / 'segments'
TMP = ROOT / 'tmp'
OUT = ROOT / '爸妈别急_演示视频.mp4'

SEGMENTS.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

CANVAS_W = 1080
CANVAS_H = 1920
FPS = 30
PHONE_W = 780
PHONE_H = 1689
PHONE_X = (CANVAS_W - PHONE_W) // 2   # = 150
PHONE_Y = 60  # 顶部对齐，底部留空间给字幕条

FONT_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'

# ── 字幕文案 ──
SUBTITLES = {
    '01-home': '爸妈别急 · 帮助老人安全使用手机',
    '02-low-risk': '低风险：只给一个简单、可逆的步骤',
    '03-mid-risk': '中风险：只给平台内安全步骤，提醒防骗',
    '04-high-risk': '高风险：立刻停下，生成脱敏求助卡',
}

# ── 段落定义 ──
SEGMENTS_DEF = [
    ('00-intro',      'card', 'title-intro.png',     '00-intro.mp3'),
    ('01-home',       'video', 'scene1-home.webm',   '01-home.mp3'),
    ('02-low-risk',   'video', 'scene2-low-risk.webm','02-low-risk.mp3'),
    ('03-mid-risk',   'video', 'scene3-mid-risk.webm','03-mid-risk.mp3'),
    ('04-high-risk',  'video', 'scene4-high-risk.webm','04-high-risk.mp3'),
    ('05-concept',    'card', 'title-concept.png',   '05-concept.mp3'),
    ('06-outro',      'card', 'title-outro.png',     '06-outro.mp3'),
]


def get_duration(path):
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip()) if r.stdout.strip() else 0


def run(cmd, desc=''):
    print(f'  ▶ {desc}...')
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'    STDERR: {r.stderr[-500:]}')
        raise RuntimeError(f'FFmpeg failed: {desc}')
    print(f'    ✓ done')


def make_subtitle_overlay(text, out_path):
    """用 PIL 渲染字幕为底部半透明黑条 + 白色文字的透明 PNG（1080×1920）。"""
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 底部半透明黑条
    bar_h = 140
    bar_y = CANVAS_H - bar_h
    draw.rectangle([0, bar_y, CANVAS_W, CANVAS_H], fill=(0, 0, 0, 140))

    # 白色文字
    font = ImageFont.truetype(FONT_BOLD, 44)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (CANVAS_W - tw) // 2
    ty = bar_y + (bar_h - th) // 2 - 5
    # 文字阴影
    draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 160))
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

    img.save(out_path)


def make_video_segment(seg_name, webm_path, audio_path, subtitle_text, out_path):
    """处理一个录制视频段。"""
    audio_dur = get_duration(audio_path)
    video_dur = get_duration(webm_path)
    target_dur = max(audio_dur, video_dur)

    phone_frame = str(CARDS / 'phone-frame.png')

    # 字幕 overlay PNG
    subtitle_png = TMP / f'{seg_name}-subtitle.png'
    make_subtitle_overlay(subtitle_text, subtitle_png)

    # FFmpeg filter_complex（所有输入路径用正斜杠避免冒号问题）
    # 输入：0=webm(loop), 1=phone-frame, 2=audio, 3=subtitle overlay
    # 不使用 drawtext，字幕作为 overlay 图
    vf = (
        # 缩放视频到手机内屏
        f'[0:v]scale={PHONE_W}:{PHONE_H}:force_original_aspect_ratio=increase,'
        f'crop={PHONE_W}:{PHONE_H},setsar=1,'
        # pad 到画布（暖色背景 0xFDF6EC）
        f'pad={CANVAS_W}:{CANVAS_H}:{PHONE_X}:{PHONE_Y}:color=0xFDF6EC[bg];'
        # 手机框
        f'[1:v]format=rgba[frame];'
        # 叠加手机框
        f'[bg][frame]overlay=0:0[framed];'
        # 叠加字幕
        f'[3:v]format=rgba[sub];'
        f'[framed][sub]overlay=0:0[v]'
    )

    cmd = [
        'ffmpeg', '-y',
        '-stream_loop', '-1', '-i', str(webm_path).replace('\\', '/'),
        '-i', phone_frame.replace('\\', '/'),
        '-i', str(audio_path).replace('\\', '/'),
        '-loop', '1', '-i', str(subtitle_png).replace('\\', '/'),
        '-filter_complex', vf,
        '-map', '[v]', '-map', '2:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-r', str(FPS),
        '-t', f'{target_dur:.2f}',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        str(out_path).replace('\\', '/'),
    ]
    run(cmd, f'video segment {seg_name} ({target_dur:.1f}s)')


def make_card_segment(seg_name, png_path, audio_path, out_path):
    """处理一个标题卡段。"""
    audio_dur = get_duration(audio_path)

    cmd = [
        'ffmpeg', '-y',
        '-loop', '1', '-i', str(png_path).replace('\\', '/'),
        '-i', str(audio_path).replace('\\', '/'),
        '-filter_complex',
        f'[0:v]scale={CANVAS_W}:{CANVAS_H},setsar=1,format=yuv420p[v]',
        '-map', '[v]', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-r', str(FPS),
        '-t', f'{audio_dur:.2f}',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest',
        str(out_path).replace('\\', '/'),
    ]
    run(cmd, f'card segment {seg_name} ({audio_dur:.1f}s)')


def concat_segments(segment_paths, out_path):
    """
    用 concat filter 拼接所有段并重新压制为平台规范格式。

    关键修复：B站等平台要求时间戳完全连续。
    - 不能用 concat demuxer + -c copy（PTS 不连续）
    - 用 concat filter（re-encode）+ 规范化参数确保兼容性
    - -fflags +genpts + -avoid_negative_ts make_zero 重建干净的时间轴
    - 音频统一为 44100Hz 立体声（平台常用规格）
    """
    n = len(segment_paths)
    inputs = []
    for p in segment_paths:
        inputs.extend(['-i', str(p).replace('\\', '/')])

    video_streams = ''.join(f'[{i}:v]' for i in range(n))
    audio_streams = ''.join(f'[{i}:a]' for i in range(n))
    filter_complex = (
        f'{video_streams}concat=n={n}:v=1:a=0[v];'
        f'{audio_streams}concat=n={n}:v=0:a=1[a]'
    )

    cmd = [
        'ffmpeg', '-y',
        '-fflags', '+genpts',              # 重新生成 PTS
        *inputs,
        '-filter_complex', filter_complex,
        '-map', '[v]', '-map', '[a]',
        # 视频：H.264 High Profile，平台兼容
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
        '-profile:v', 'high', '-level', '4.0',
        '-pix_fmt', 'yuv420p',
        '-r', str(FPS),
        '-g', str(FPS * 2),                # GOP = 2 秒
        '-keyint_min', str(FPS),
        # 音频：AAC 44.1kHz 立体声
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
        # 时间轴规范化
        '-vsync', 'cfr',                   # 恒定帧率
        '-avoid_negative_ts', 'make_zero', # 负时间戳归零
        '-max_delay', '0',
        '-movflags', '+faststart',         # moov atom 前置（流媒体友好）
        str(out_path).replace('\\', '/'),
    ]
    run(cmd, f'concat+normalize final video → {out_path.name}')


def main():
    print('Composing final video...')
    print(f'  Canvas: {CANVAS_W}x{CANVAS_H} @ {FPS}fps')
    print()

    segment_paths = []

    for seg_name, seg_type, src_file, audio_file in SEGMENTS_DEF:
        src_path = (RAW if seg_type == 'video' else CARDS) / src_file
        audio_path = AUDIO / audio_file
        out_path = SEGMENTS / f'{seg_name}.mp4'

        if not src_path.exists():
            print(f'  ✗ Missing source: {src_path}')
            sys.exit(1)
        if not audio_path.exists():
            print(f'  ✗ Missing audio: {audio_path}')
            sys.exit(1)

        if seg_type == 'video':
            subtitle = SUBTITLES.get(seg_name, '')
            make_video_segment(seg_name, src_path, audio_path, subtitle, out_path)
        else:
            make_card_segment(seg_name, src_path, audio_path, out_path)

        segment_paths.append(out_path)

    print()
    concat_segments(segment_paths, OUT)

    # 验证
    final_dur = get_duration(OUT)
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print()
    print(f'✅ Final video: {OUT.name}')
    print(f'   Duration: {final_dur:.1f}s ({final_dur/60:.1f} min)')
    print(f'   Size: {size_mb:.1f} MB')
    print(f'   Path: {OUT}')


if __name__ == '__main__':
    main()

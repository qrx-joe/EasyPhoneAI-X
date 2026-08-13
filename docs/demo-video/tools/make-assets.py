"""
生成演示视频素材：手机框 PNG + 标题卡 PNG。

设计令牌对齐项目暖色调（globals.css）：
  - 页面底色 #fdfaf6（warm cream）
  - 品牌主色 #dd6b20（primary orange）
  - 危险色 #c62828（danger red）
  - 安全色 #18794e（safe green）
  - 文字深色 #24282f（foreground）

输出：
  cards/phone-frame.png    手机外壳透明 PNG（1080×1920 画布，内屏居中）
  cards/title-intro.png    片头标题卡 1080×1920
  cards/title-concept.png  核心理念卡 1080×1920
  cards/title-outro.png    片尾卡 1080×1920
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / 'cards'
CARDS.mkdir(parents=True, exist_ok=True)

# ── 设计令牌 ──
CREAM = (253, 250, 246)
PRIMARY = (221, 107, 32)       # #dd6b20
PRIMARY_SOFT = (255, 244, 230)  # #fff4e6
DANGER = (198, 40, 40)          # #c62828
SAFE = (24, 121, 78)            # #18794e
FOREGROUND = (36, 40, 47)       # #24282f
MUTED = (107, 115, 125)         # #6b737d
WHITE = (255, 255, 255)

CANVAS_W = 1080
CANVAS_H = 1920

# 手机内屏尺寸（对应录制的 393×851，放大到占画面高度 ~85%）
PHONE_W = 780
PHONE_H = 1689  # 393:851 比例
PHONE_X = (CANVAS_W - PHONE_W) // 2   # = 150
# 手机上对齐：留少量顶部边距，底部贴近字幕条
PHONE_Y = 60

FONT_REGULAR = 'C:/Windows/Fonts/msyh.ttc'
FONT_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'


def get_font(size, bold=False):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(path, size)


# ─────────────────────────────────────────────────────────
# 手机框
# ─────────────────────────────────────────────────────────
def make_phone_frame():
    """生成手机外壳透明 PNG：深色圆角边框 + 顶部刘海 + 底部 Home 条。"""
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 外壳阴影（柔和投影）
    shadow_offset = 20
    for i in range(shadow_offset, 0, -1):
        alpha = int(35 * (shadow_offset - i) / shadow_offset)
        bbox = [
            PHONE_X - 12 + i, PHONE_Y - 12 + i,
            PHONE_X + PHONE_W + 12 - i, PHONE_Y + PHONE_H + 12 - i,
        ]
        draw.rounded_rectangle(bbox, radius=72 - i, fill=(0, 0, 0, alpha))

    # 外壳边框（深灰色金属感）
    border_w = 14
    frame_color = (30, 34, 41, 255)  # 深色边框
    draw.rounded_rectangle(
        [PHONE_X - border_w, PHONE_Y - border_w,
         PHONE_X + PHONE_W + border_w, PHONE_Y + PHONE_H + border_w],
        radius=78,
        fill=frame_color,
    )

    # 内屏区域挖空（透明）
    draw.rounded_rectangle(
        [PHONE_X, PHONE_Y, PHONE_X + PHONE_W, PHONE_Y + PHONE_H],
        radius=66,
        fill=(0, 0, 0, 0),
    )

    # 顶部刘海（听筒）
    notch_w = 200
    notch_h = 42
    notch_x = PHONE_X + (PHONE_W - notch_w) // 2
    notch_y = PHONE_Y - border_w + 8
    draw.rounded_rectangle(
        [notch_x, notch_y, notch_x + notch_w, notch_y + notch_h],
        radius=21,
        fill=(15, 18, 24, 255),
    )

    # 底部 Home 条
    home_w = 220
    home_h = 8
    home_x = PHONE_X + (PHONE_W - home_w) // 2
    home_y = PHONE_Y + PHONE_H - home_h - 24
    draw.rounded_rectangle(
        [home_x, home_y, home_x + home_w, home_y + home_h],
        radius=4,
        fill=(120, 128, 140, 200),
    )

    img.save(CARDS / 'phone-frame.png')
    print(f'✓ phone-frame.png ({CANVAS_W}×{CANVAS_H})')


# ─────────────────────────────────────────────────────────
# 标题卡辅助
# ─────────────────────────────────────────────────────────
def draw_centered_text(draw, text, y, font, color, canvas_w=CANVAS_W):
    """居中绘制文字，返回文字底部 y 坐标。"""
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = (canvas_w - w) // 2
    draw.text((x, y), text, font=font, fill=color)
    return y + (bbox[3] - bbox[1])


def make_title_card(filename, bg_color, lines, accent=PRIMARY):
    """
    生成一张标题卡。
    lines: [(text, font_size, color, bold), ...]
    """
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), bg_color + (255,))
    draw = ImageDraw.Draw(img)

    # 顶部装饰条
    draw.rounded_rectangle(
        [CANVAS_W // 2 - 60, 200, CANVAS_W // 2 + 60, 206],
        radius=3, fill=accent,
    )

    # 计算文字总高度，垂直居中偏上
    total_h = sum(fs * 1.4 for _, fs, _, _ in lines)
    y = int(CANVAS_H * 0.35)

    for text, font_size, color, bold in lines:
        font = get_font(font_size, bold=bold)
        # 处理多行
        for line in text.split('\n'):
            y = draw_centered_text(draw, line, y, font, color)
            y += int(font_size * 0.3)

    img.save(CARDS / filename)
    print(f'✓ {filename} ({CANVAS_W}×{CANVAS_H})')


# ─────────────────────────────────────────────────────────
# 片头卡
# ─────────────────────────────────────────────────────────
def make_intro():
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), CREAM + (255,))
    draw = ImageDraw.Draw(img)

    # 装饰条
    bar_y = 560
    draw.rounded_rectangle(
        [CANVAS_W // 2 - 70, bar_y, CANVAS_W // 2 + 70, bar_y + 8],
        radius=4, fill=PRIMARY,
    )

    # 品牌名
    draw_centered_text(draw, '爸妈别急', bar_y + 80, get_font(110, True), FOREGROUND)

    # 副标题
    draw_centered_text(draw, '银发数字生活安全副驾', bar_y + 260, get_font(48, True), PRIMARY)

    # 主张
    draw_centered_text(draw, '看懂当前一步，只给安全的下一步', bar_y + 400, get_font(40, False), MUTED)
    draw_centered_text(draw, '遇到风险，先停下来', bar_y + 480, get_font(40, False), MUTED)

    img.save(CARDS / 'title-intro.png')
    print(f'✓ title-intro.png ({CANVAS_W}×{CANVAS_H})')


# ─────────────────────────────────────────────────────────
# 核心理念卡
# ─────────────────────────────────────────────────────────
def make_concept():
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), CREAM + (255,))
    draw = ImageDraw.Draw(img)

    # 装饰条
    bar_y = 380
    draw.rounded_rectangle(
        [CANVAS_W // 2 - 70, bar_y, CANVAS_W // 2 + 70, bar_y + 8],
        radius=4, fill=PRIMARY,
    )

    # 标题
    draw_centered_text(draw, '安全副驾的核心原则', bar_y + 80, get_font(54, True), FOREGROUND)

    # 三条原则（固定间距，避免重叠）
    principles = [
        ('低风险', '一步一步教', SAFE),
        ('高风险', '先停下来', DANGER),
        ('不确定', '不瞎猜', MUTED),
    ]
    y = bar_y + 240
    for label, desc, color in principles:
        draw_centered_text(draw, label, y, get_font(64, True), color)
        y += 100
        draw_centered_text(draw, desc, y, get_font(44, False), FOREGROUND)
        y += 120

    img.save(CARDS / 'title-concept.png')
    print(f'✓ title-concept.png ({CANVAS_W}×{CANVAS_H})')


# ─────────────────────────────────────────────────────────
# 片尾卡
# ─────────────────────────────────────────────────────────
def make_outro():
    img = Image.new('RGBA', (CANVAS_W, CANVAS_H), FOREGROUND + (255,))
    draw = ImageDraw.Draw(img)

    # 装饰条（居中偏上）
    bar_y = 520
    draw.rounded_rectangle(
        [CANVAS_W // 2 - 70, bar_y, CANVAS_W // 2 + 70, bar_y + 8],
        radius=4, fill=PRIMARY,
    )

    # 品牌名（大字，明确固定 y 位置）
    font_brand = get_font(100, True)
    draw_centered_text(draw, '爸妈别急', bar_y + 80, font_brand, WHITE)

    # 副标题（品牌名下方足够间距）
    font_sub = get_font(42, False)
    draw_centered_text(draw, '让每一步都更清楚、更可控', bar_y + 240, font_sub, PRIMARY_SOFT)

    # 话题词（中间偏下，与副标题拉开距离）
    font_hashtag = get_font(56, True)
    draw_centered_text(draw, '#小有可为AIForGood', bar_y + 420, font_hashtag, PRIMARY)

    # 底部信息
    font_info = get_font(34, False)
    draw_centered_text(draw, '小有可为 2026 · 普惠养老', bar_y + 540, font_info, MUTED)

    img.save(CARDS / 'title-outro.png')
    print(f'✓ title-outro.png ({CANVAS_W}×{CANVAS_H})')


if __name__ == '__main__':
    print('Generating video assets...')
    make_phone_frame()
    make_intro()
    make_concept()
    make_outro()
    print('All assets generated.')

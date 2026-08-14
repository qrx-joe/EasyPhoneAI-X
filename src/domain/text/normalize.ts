/**
 * 输入文本归一化 —— 风险分类（classify-risk）与教程匹配（findTutorial）共用的同一形态。
 *
 * 老人在手机输入法下经常出全角：全角数字「６」、全角字母「Ａ」、全角标点、全角空格。
 * 归一化让 Apple/ＡＰＰＬＥ/ａｐｐｌｅ 走到同一形态，避免「全角输入匹配失败」这类漏报。
 *
 * 纯函数，零依赖（domain 层纯净约束）。
 */

/**
 * 全角字符 → 半角。覆盖 ASCII 可打印区(! ~)和全角空格。
 */
function fullToHalf(text: string): string {
  return text
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .replace(/　/g, ' ')
}

/**
 * 输入文本归一化：
 * - 转半角（让 Apple/ＡＰＰＬＥ/ａｐｐｌｅ 走到同一形态）
 * - 转小写（英文关键词统一以小写存）
 * - trim
 */
export function normalizeInput(text: string): string {
  return fullToHalf(text).toLowerCase().trim()
}

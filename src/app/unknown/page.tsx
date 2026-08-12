import { UnknownClient } from './unknown-client'

/**
 * UNKNOWN 页 —— 无法确认时的兜底（方案 §9.1、§6.2）。
 *
 * 方案 §12.3：UNKNOWN 截图不显示具体按钮指导。
 * 提供三个出口：重拍、补充描述、找家人。
 */
export default async function UnknownPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>
}) {
  const { text } = await searchParams
  return <UnknownClient text={(text ?? '').trim()} />
}

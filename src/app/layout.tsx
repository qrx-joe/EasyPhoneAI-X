import type { Metadata, Viewport } from 'next'
import './globals.css'

/**
 * 根布局：声明站点元数据与视口策略。
 *
 * 适老化 viewport：允许缩放（不剥夺 a11y 能力），但默认 1.0 避免 iOS Safari
 * 双击放大跳屏。maximumScale: 5 保证视力不佳的用户能放大看清。
 */
export const metadata: Metadata = {
  title: '爸妈别急 · 安心下一步',
  description:
    '面向银发用户的数字生活安全副驾：看懂你当前所在步骤，只给出安全的下一步；遇到风险或无法确认时停下来，把必要上下文交给家人。',
  // 阻止 iOS 把数字识别成电话（老人输入诈骗短信号码场景常见）
  formatDetection: { telephone: false, date: false, address: false, email: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-(--color-background) text-(--color-foreground)">
        {children}
      </body>
    </html>
  )
}

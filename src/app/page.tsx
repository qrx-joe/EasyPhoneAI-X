/**
 * 首页占位（第一阶段）。
 *
 * 第一阶段只保证项目可编译、可构建、测试门禁通过。
 * 真正的首页（文字/语音入口、常见示例、隐私提示）在第五阶段实现（方案 9.1）。
 */
export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-(--color-foreground) mb-3">
          爸妈别急
        </h1>
        <p className="text-xl text-(--color-primary) font-semibold mb-6">
          安心下一步
        </p>
        <p className="text-base text-(--color-muted) leading-relaxed">
          面向银发用户的数字生活安全副驾。
        </p>
        <p className="text-sm text-(--color-muted) mt-8">
          项目骨架已就绪，功能将在后续阶段逐步上线。
        </p>
      </div>
    </main>
  )
}

'use client'

/**
 * UNKNOWN 交互 —— 三个出口：补充描述、回首页重试、找家人。
 *
 * 方案 §6.2：安全不确定性进入 UNKNOWN 或 STOP。
 * 方案 §12.3：UNKNOWN 不显示具体按钮指导。
 */
import { useRouter } from 'next/navigation'

interface Props {
  text: string
}

export function UnknownClient({ text }: Props) {
  const router = useRouter()

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full">
      <div className="px-5 py-4 rounded-xl bg-(--color-primary-soft) border-2 border-(--color-primary)" role="alert">
        <h1 className="text-2xl font-bold text-(--color-primary) mb-2">这个我不太确定</h1>
        <p className="text-lg text-(--color-foreground) leading-relaxed">
          为了安全，我不瞎猜。咱们换个方式试试。
        </p>
      </div>

      {text && (
        <div className="px-4 py-3 rounded-lg bg-(--color-soft) border border-(--color-border)">
          <p className="text-base text-(--color-muted) mb-1">您说的是</p>
          <p className="text-lg text-(--color-foreground)">{text}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {/* 出口 1：补充描述 */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-(--color-foreground) text-xl font-semibold shadow-sm"
        >
          重新说一遍问题
        </button>

        {/* 出口 2：找家人 */}
        <button
          type="button"
          onClick={() => {
            const t = text || '遇到了手机上的问题'
            router.push(`/risk-alert?text=${encodeURIComponent(t)}`)
          }}
          className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-danger) hover:bg-(--color-danger-hover) active:scale-[0.99] transition text-white text-xl font-semibold shadow-sm"
        >
          这事得问家人
        </button>

        {/* 出口 3：回首页 */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-base font-normal border border-(--color-border)"
        >
          回首页
        </button>
      </div>
    </main>
  )
}

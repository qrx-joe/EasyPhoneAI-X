'use client'

/**
 * 确认页交互 —— 复述目标 + 确认/取消按钮。
 * 确认后进入 /tutorial；取消回首页。
 */
import { useRouter } from 'next/navigation'

interface Props {
  text: string
}

export function ConfirmActions({ text }: Props) {
  const router = useRouter()

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-5 max-w-md mx-auto w-full">
      <header>
        <h1 className="text-2xl font-bold text-(--color-foreground) mb-2">您说的是</h1>
      </header>

      <div className="px-5 py-4 rounded-xl bg-(--color-soft) border border-(--color-border)">
        <p className="text-xl text-(--color-foreground) leading-relaxed">{text}</p>
      </div>

      <p className="text-base text-(--color-muted)">
        是这个问题吗？
      </p>

      <div className="flex flex-col gap-3 mt-2">
        <button
          type="button"
          onClick={() => router.push(`/tutorial?text=${encodeURIComponent(text)}`)}
          className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-(--color-foreground) text-xl font-semibold shadow-sm"
        >
          是的，教我怎么做
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-white hover:bg-(--color-soft) active:scale-[0.99] transition text-(--color-foreground) text-xl font-medium border-2 border-(--color-border)"
        >
          不是，重新说
        </button>
      </div>
    </main>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'

import type { DecisionResponse } from '@/contracts/decision-api'
import type { GuidanceDecision, GuideDecision, StopDecision, ClarifyDecision } from '@/contracts/guidance-decision'
import type { StepStateView } from '@/contracts/step-api'
import type { TutorialStep } from '@/domain/guidance/tutorial'
import { serializeHandoffCard } from '@/domain/handoff/card-serialization'
import { SpeakButton } from '@/lib/speech/speak-button'
import { SPEECH_RATE_OPTIONS, useSpeechRate, type SpeechRateTier } from '@/lib/speech/speech-rate'
import { VoiceInputButton } from '@/components/voice-input-button'
import { DecisionClientError, advanceStepRequest, submitDecision } from '@/lib/decision/decision-client'

interface Props {
  initialText: string
}

interface RedactionRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type RequestState =
  | { readonly kind: 'editing' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'result'; readonly response: DecisionResponse }
  | { readonly kind: 'error'; readonly message: string }

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** 「说慢一点」的降档顺序：正常 → 较慢 → 慢（到慢为止） */
const SLOWER_TIER: Record<SpeechRateTier, SpeechRateTier | null> = {
  fast: 'normal',
  normal: 'slow',
  slow: null,
}

/** 结果面板出现时把焦点移到标题（阶段 A-5：新结果可被读屏立即读到） */
function useAutoFocusRef<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

export function AssistClient({ initialText }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [requestState, setRequestState] = useState<RequestState>({ kind: 'editing' })
  const [notice, setNotice] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageName, setImageName] = useState('')
  const [redactions, setRedactions] = useState<RedactionRect[]>([])
  const [consented, setConsented] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const maxWidth = 720
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111827'
    for (const rect of redactions) {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    }
  }, [image, redactions])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const runDecision = useCallback(async (submittedText: string) => {
    const cleanText = submittedText.trim()
    if (!cleanText) return
    setNotice(null)
    setRequestState({ kind: 'loading' })
    try {
      let screenshot: Blob | undefined
      let consentId: string | undefined
      if (image) {
        if (!consented) {
          setRequestState({ kind: 'error', message: '请先阅读并勾选截图使用说明' })
          return
        }
        drawCanvas()
        screenshot = await canvasToBlob(canvasRef.current)
        consentId = crypto.randomUUID()
      }
      const response = await submitDecision({ text: cleanText, screenshot, consentId })
      setRequestState({ kind: 'result', response })
    } catch (error) {
      const message = error instanceof DecisionClientError
        ? error.message
        : '系统暂时没有回应，请稍后重试'
      setRequestState({ kind: 'error', message })
    }
  }, [consented, drawCanvas, image])

  // 阶段 A-1：语音识别结果只填入文本框；确认（onConfirm）后才请求决策
  const onVoiceFinal = useCallback((transcript: string) => {
    setText(transcript)
  }, [])

  const onVoiceConfirm = useCallback((transcript: string) => {
    void runDecision(transcript)
  }, [runDecision])

  const onVoiceEdit = useCallback(() => {
    textareaRef.current?.focus()
  }, [])

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setImageError(null)
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError('只支持 PNG、JPG、WebP 图片')
      event.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('图片太大了，请选择不超过 4 MB 的图片')
      event.target.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    const nextImage = new Image()
    nextImage.onload = () => {
      setImage(nextImage)
      setImageName(file.name)
      setRedactions([])
      setConsented(false)
      URL.revokeObjectURL(url)
    }
    nextImage.onerror = () => {
      setImageError('这张图片打不开，请换一张')
      URL.revokeObjectURL(url)
    }
    nextImage.src = url
  }

  function pointOnCanvas(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    }
  }

  function startRedaction(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = pointOnCanvas(event)
  }

  function finishRedaction(event: PointerEvent<HTMLCanvasElement>) {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const end = pointOnCanvas(event)
    const rect = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x),
      height: Math.abs(start.y - end.y),
    }
    if (rect.width < 8 || rect.height < 8) return
    setRedactions((current) => [...current, rect])
  }

  function clearImage() {
    setImage(null)
    setImageName('')
    setRedactions([])
    setConsented(false)
    setImageError(null)
  }

  if (requestState.kind === 'result') {
    return (
      <AssistDecisionPanel
        decision={requestState.response.decision}
        onRetry={() => setRequestState({ kind: 'editing' })}
        onHome={() => router.push('/')}
        onSessionLost={(message) => {
          setNotice(message)
          setRequestState({ kind: 'editing' })
        }}
      />
    )
  }

  const isLoading = requestState.kind === 'loading'

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-5 max-w-md mx-auto w-full" aria-busy={isLoading}>
      <header>
        <h1 className="text-2xl font-bold text-(--color-foreground)">告诉我遇到了什么</h1>
        <p className="text-base text-(--color-muted) mt-1">文字、语音和截图都走同一套安全判断。</p>
      </header>

      <VoiceInputButton onFinal={onVoiceFinal} onConfirm={onVoiceConfirm} onEdit={onVoiceEdit} />

      <section aria-label="文字描述">
        <label htmlFor="assist-text" className="block text-base text-(--color-muted) mb-2">用文字描述问题</label>
        <textarea
          id="assist-text"
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          className="w-full min-h-[96px] px-4 py-3 rounded-xl border-2 border-(--color-border) bg-white text-(--color-foreground) text-lg resize-none focus:border-(--color-primary)"
          placeholder="例如：微信没有声音了"
        />
      </section>

      <section className="px-4 py-4 rounded-xl bg-(--color-soft) border border-(--color-border)" aria-labelledby="screenshot-title">
        <h2 id="screenshot-title" className="text-xl font-semibold">截图（可选）</h2>
        <p className="text-base text-(--color-muted) mt-1 mb-3">截图可能含手机号、验证码或银行卡信息。请先在预览里涂黑敏感内容。</p>
        <label className="inline-flex min-h-[56px] items-center px-4 py-2 rounded-xl bg-white border-2 border-(--color-primary) text-(--color-primary) text-lg font-semibold cursor-pointer">
          选择截图
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageSelect} />
        </label>
        {imageError && <p role="alert" className="text-base text-(--color-danger) mt-2">{imageError}</p>}

        {image && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-base">已选择：{imageName}</p>
            <p className="text-base text-(--color-muted)">在图片上拖动手指或鼠标，涂黑不想上传的内容。</p>
            <canvas
              ref={canvasRef}
              onPointerDown={startRedaction}
              onPointerUp={finishRedaction}
              className="w-full h-auto rounded-lg border-2 border-(--color-border) bg-white touch-none cursor-crosshair"
              aria-label="截图遮挡预览"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRedactions((current) => current.slice(0, -1))} disabled={redactions.length === 0} className="min-h-[56px] rounded-xl bg-white border border-(--color-border) text-base disabled:opacity-40">撤销涂抹</button>
              <button type="button" onClick={clearImage} className="min-h-[56px] rounded-xl bg-white border border-(--color-border) text-base">取消截图</button>
            </div>
            <label className="flex gap-3 items-start text-base leading-relaxed">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-2 size-6 shrink-0" />
              <span>我已检查最终预览，同意为本次判断上传处理后的截图。系统不会保存原图。</span>
            </label>
          </div>
        )}
      </section>

      {notice && (
        <p role="status" className="px-4 py-3 rounded-lg bg-(--color-soft) border border-(--color-border) text-base">{notice}</p>
      )}
      {requestState.kind === 'error' && (
        <p role="alert" className="px-4 py-3 rounded-lg bg-(--color-danger-soft) text-(--color-danger) text-base">{requestState.message}</p>
      )}
      {isLoading && (
        <p role="status" className="px-4 py-3 rounded-lg bg-(--color-soft) text-base">正在判断，请稍等…</p>
      )}

      <button
        type="button"
        onClick={() => void runDecision(text)}
        disabled={!text.trim() || isLoading || Boolean(image && !consented)}
        className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold disabled:opacity-40"
      >
        {isLoading ? '正在判断，请稍等' : '给我安全的下一步'}
      </button>
      <button type="button" onClick={() => router.push('/')} className="w-full min-h-[56px] rounded-xl bg-white border border-(--color-border) text-base">取消并回首页</button>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 结果面板（四种决策 + 教练推进）
// ─────────────────────────────────────────────────────────────────────

function AssistDecisionPanel({
  decision,
  onRetry,
  onHome,
  onSessionLost,
}: {
  decision: GuidanceDecision
  onRetry: () => void
  onHome: () => void
  onSessionLost: (message: string) => void
}) {
  if (decision.kind === 'guide') {
    return (
      <CoachPanel
        decision={decision}
        onHome={onHome}
        onRedescribe={onRetry}
        onSessionLost={onSessionLost}
      />
    )
  }
  if (decision.kind === 'stop') {
    return <StopPanel decision={decision} onHome={onHome} />
  }
  if (decision.kind === 'clarify') {
    return <ClarifyPanel decision={decision} onRetry={onRetry} onHome={onHome} />
  }
  return <UnsupportedPanel onRetry={onRetry} onHome={onHome} />
}

/**
 * 教练面板（阶段 A-2/A-4）：一步指导 + 反馈按钮。
 * 「我看到了」才推进；推进由服务端重跑风险检查后执行。
 */
function CoachPanel({
  decision,
  onHome,
  onRedescribe,
  onSessionLost,
}: {
  decision: GuideDecision
  onHome: () => void
  onRedescribe: () => void
  onSessionLost: (message: string) => void
}) {
  const [step, setStep] = useState<TutorialStep>(decision.step)
  const [stepState, setStepState] = useState<StepStateView | null>(decision.stepState ?? null)
  const [showAlternative, setShowAlternative] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [finished, setFinished] = useState<{ readonly title: string } | null>(null)
  const [blockedDecision, setBlockedDecision] = useState<GuidanceDecision | null>(null)
  const [userStopped, setUserStopped] = useState(false)
  const [rateNote, setRateNote] = useState<string | null>(null)
  const { tier, rate, setTier } = useSpeechRate()

  const stepTitleRef = useRef<HTMLHeadingElement | null>(null)

  // 面板出现和步骤切换时把焦点移到步骤标题（读屏立即播报新内容，阶段 A-5）
  useEffect(() => {
    stepTitleRef.current?.focus()
  }, [step.id])

  // 推进中被安全拦截：按决策类型复用对应面板
  if (blockedDecision !== null) {
    if (blockedDecision.kind === 'stop') {
      return <StopPanel decision={blockedDecision} onHome={onHome} />
    }
    if (blockedDecision.kind === 'clarify') {
      return <ClarifyPanel decision={blockedDecision} onRetry={onRedescribe} onHome={onHome} />
    }
    return <UnsupportedPanel onRetry={onRedescribe} onHome={onHome} />
  }

  // 全部步骤确认完成（阶段 A-4 验收：可从第一步推进到最后一步）
  if (finished !== null) {
    return <CompletePanel title={finished.title} onRedescribe={onRedescribe} onHome={onHome} />
  }

  // 用户主动停止：不推进、不给新步骤，只提示找家人（阶段 A-4「停止并找家人」）
  if (userStopped) {
    return <UserStoppedPanel onRedescribe={onRedescribe} onHome={onHome} />
  }

  async function handleAdvance() {
    if (stepState === null || advancing) return
    setAdvancing(true)
    setAdvanceError(null)
    try {
      const response = await advanceStepRequest(stepState.stateId)
      const result = response.result
      if (result.kind === 'guide') {
        setStep(result.decision.step)
        setStepState(result.stepState)
        setShowAlternative(false)
      } else if (result.kind === 'complete') {
        setFinished({ title: result.tutorialTitle })
      } else if (result.kind === 'session_lost') {
        // 刷新 / 过期：安全回到重新描述，不猜进度（阶段 A-2）
        onSessionLost('刚才的进度没有保存。请把问题重新说一遍，我们从头开始。')
      } else {
        setBlockedDecision(result.decision)
      }
    } catch {
      setAdvanceError('网络不太好，稍等一下再点「我看到了」')
    } finally {
      setAdvancing(false)
    }
  }

  // 「说慢一点」：接入现有语速档位（阶段 A-4），到最慢为止
  function handleSlower() {
    const next = SLOWER_TIER[tier]
    if (next === null) {
      setRateNote('已经是最慢的速度了')
      return
    }
    setTier(next)
    const label = SPEECH_RATE_OPTIONS.find((o) => o.tier === next)?.label ?? ''
    setRateNote(`念的速度调成了「${label}」`)
  }

  const speech = `${step.title}。${step.instruction}`
  const hasAlternative = Boolean(step.alternative)

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full" aria-busy={advancing} aria-live="polite">
      <p className="text-base text-(--color-muted)">
        现在只做这一步
        {stepState && `（第 ${stepState.stepIndex + 1} 步，共 ${stepState.totalSteps} 步）`}
      </p>
      <div className="px-5 py-5 rounded-xl bg-(--color-primary-soft) border-2 border-(--color-primary)">
        <h1 ref={stepTitleRef} tabIndex={-1} className="text-2xl font-bold mb-2 outline-none">{step.title}</h1>
        <p className="text-lg leading-relaxed">{step.instruction}</p>
        {showAlternative && step.alternative && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-white border-2 border-(--color-border)">
            <p className="text-base font-bold mb-1">换一种说法</p>
            <p className="text-lg leading-relaxed">{step.alternative}</p>
          </div>
        )}
      </div>
      <p className="px-4 py-3 rounded-lg bg-(--color-soft) text-base">做完后应该看到：{step.successSignal}</p>

      <SpeakButton text={speech} options={{ rate }} label="再念一次" />

      <button
        type="button"
        onClick={() => void handleAdvance()}
        disabled={advancing || stepState === null}
        className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold disabled:opacity-40"
      >
        {advancing ? '正在准备下一步…' : '我看到了'}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowAlternative((v) => !v)}
          disabled={!hasAlternative}
          aria-expanded={showAlternative}
          className="min-h-[56px] rounded-xl bg-white border-2 border-(--color-border) text-lg font-medium disabled:opacity-40"
        >
          {showAlternative ? '收起另一种说法' : '没看到'}
        </button>
        <button
          type="button"
          onClick={handleSlower}
          className="min-h-[56px] rounded-xl bg-white border-2 border-(--color-border) text-lg font-medium"
        >
          说慢一点
        </button>
      </div>

      {rateNote && <p role="status" className="text-base text-(--color-muted)">{rateNote}</p>}
      {advanceError && <p role="alert" className="px-4 py-3 rounded-lg bg-(--color-danger-soft) text-(--color-danger) text-base">{advanceError}</p>}

      <button
        type="button"
        onClick={() => setUserStopped(true)}
        className="w-full min-h-[56px] rounded-xl bg-white border-2 border-(--color-border) text-lg font-medium"
      >
        停止并找家人
      </button>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onRedescribe} className="min-h-[56px] rounded-xl bg-white border border-(--color-border) text-base">继续描述下一步</button>
        <button type="button" onClick={onHome} className="min-h-[56px] rounded-xl bg-white border border-(--color-border) text-base">回首页</button>
      </div>
    </main>
  )
}

function CompletePanel({ title, onRedescribe, onHome }: { title: string; onRedescribe: () => void; onHome: () => void }) {
  const titleRef = useAutoFocusRef<HTMLHeadingElement>()
  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full" aria-live="polite">
      <div className="px-5 py-5 rounded-xl bg-(--color-safe-soft) border-2 border-(--color-safe)">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold mb-2 outline-none">都做完了</h1>
        <p className="text-lg leading-relaxed">「{title}」的每一步你都确认看到了。如果问题还在，可以让家人再帮忙看看。</p>
      </div>
      <button type="button" onClick={onRedescribe} className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold">再问别的问题</button>
      <button type="button" onClick={onHome} className="w-full min-h-[56px] rounded-xl border border-(--color-border) bg-white text-base">回首页</button>
    </main>
  )
}

function UserStoppedPanel({ onRedescribe, onHome }: { onRedescribe: () => void; onHome: () => void }) {
  const titleRef = useAutoFocusRef<HTMLHeadingElement>()
  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full" aria-live="polite">
      <div className="px-5 py-5 rounded-xl bg-(--color-soft) border-2 border-(--color-border)">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold mb-2 outline-none">已经停下来了</h1>
        <p className="text-lg leading-relaxed">这组步骤没有继续。可以把刚才的情况告诉家人，请他们帮忙看看。</p>
      </div>
      <button type="button" onClick={onRedescribe} className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold">重新描述问题</button>
      <button type="button" onClick={onHome} className="w-full min-h-[56px] rounded-xl border border-(--color-border) bg-white text-base">回首页</button>
    </main>
  )
}

function StopPanel({ decision, onHome }: { decision: StopDecision; onHome: () => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const titleRef = useAutoFocusRef<HTMLHeadingElement>()
  const cardText = serializeHandoffCard(decision.handoff)
  // medium 是「谨慎求助」（无可用已审核教程），话术比 high/critical 的强中止缓和。
  const heading = decision.risk === 'medium' ? '先确认一下' : '先停下来'

  async function share() {
    setShareStatus('')
    try {
      if (navigator.share) {
        await navigator.share({ title: '爸妈别急 - 求您帮个忙', text: cardText })
        setShareStatus('已打开分享')
        return
      }
    } catch {
      // 分享取消或失败后继续尝试复制。
    }
    try {
      await navigator.clipboard.writeText(cardText)
      setShareStatus('已复制，可以发给家人')
    } catch {
      setShareStatus('请长按下面的求助内容进行复制')
    }
  }

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full">
      <div role="alert" className="px-5 py-4 rounded-xl bg-(--color-danger-soft) border-2 border-(--color-danger)">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold text-(--color-danger) mb-2 outline-none">{heading}</h1>
        <p className="text-lg leading-relaxed">{decision.handoff.summary}</p>
      </div>
      <ul className="px-5 py-4 rounded-xl bg-(--color-soft) space-y-2">
        {decision.handoff.suggestions.slice(0, 3).map((suggestion) => <li key={suggestion} className="text-lg">• {suggestion}</li>)}
      </ul>
      <pre className="px-4 py-3 rounded-lg border-2 border-(--color-border) whitespace-pre-wrap font-sans text-base select-text">{cardText}</pre>
      <button type="button" onClick={() => void share()} className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold">发给家人</button>
      {shareStatus && <p role="status" className="text-base text-center">{shareStatus}</p>}
      <button type="button" onClick={onHome} className="w-full min-h-[56px] rounded-xl border border-(--color-border) bg-white text-base">回首页</button>
    </main>
  )
}

function ClarifyPanel({ decision, onRetry, onHome }: { decision: ClarifyDecision; onRetry: () => void; onHome: () => void }) {
  const titleRef = useAutoFocusRef<HTMLHeadingElement>()
  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full" aria-live="polite">
      <div role="alert" className="px-5 py-4 rounded-xl bg-(--color-primary-soft) border-2 border-(--color-primary)">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold mb-2 outline-none">这个我还不能确定</h1>
        {decision.questions.map((question) => <p key={question} className="text-lg leading-relaxed">{question}</p>)}
      </div>
      <button type="button" onClick={onRetry} className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold">补充描述或重选截图</button>
      <button type="button" onClick={onHome} className="w-full min-h-[56px] rounded-xl border border-(--color-border) bg-white text-base">回首页</button>
    </main>
  )
}

function UnsupportedPanel({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  const titleRef = useAutoFocusRef<HTMLHeadingElement>()
  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full" aria-live="polite">
      <div role="alert" className="px-5 py-4 rounded-xl bg-(--color-soft) border-2 border-(--color-border)">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold mb-2 outline-none">暂时没有合适的安全步骤</h1>
        <p className="text-lg">请补充你所在的 App 和页面，或者找家人一起确认。</p>
      </div>
      <button type="button" onClick={onRetry} className="w-full min-h-[64px] rounded-xl bg-(--color-primary) text-(--color-foreground) text-xl font-semibold">补充描述</button>
      <button type="button" onClick={onHome} className="w-full min-h-[56px] rounded-xl border border-(--color-border) bg-white text-base">回首页</button>
    </main>
  )
}

function canvasToBlob(canvas: HTMLCanvasElement | null): Promise<Blob> {
  if (!canvas) return Promise.reject(new Error('截图预览还没准备好'))
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('截图处理失败'))
    }, 'image/png')
  })
}

import { useEffect, useRef, useState } from 'react'

/**
 * 自适应消费展示缓冲：保留少量余量吸收上游波动，积压过大则限时追赶。
 * 首批尽快显示（首字不额外等待），后续按近期输入速度平滑消费。
 */
export const SMOOTH_BASE_CPS = 180
export const SMOOTH_MAX_CPS = 1200
/** 目标缓冲：约 150ms 的展示余量 */
export const SMOOTH_TARGET_BUFFER_MS = 150
/** 最大落后字符数：超过则直接跳进，保证模型结束后不长时间打字 */
export const SMOOTH_MAX_LAG_CHARS = 600
/** 正常完成后的排空速度 */
export const SMOOTH_DRAIN_CPS = 600

export function nextRevealLength(revealed: number, target: number, dtMs: number, cps: number): number {
  if (target <= revealed) return target
  const step = Math.max(1, Math.round((cps * dtMs) / 1000))
  return Math.min(target, revealed + step)
}

/** 按输入速度自适应展示速度：维持目标缓冲，落后过多时加速并封顶 */
export function adaptiveCps(backlogChars: number, recentInputCps: number): number {
  if (backlogChars <= 0) return 0
  const targetBuffer = Math.max(8, (recentInputCps * SMOOTH_TARGET_BUFFER_MS) / 1000)
  if (backlogChars > SMOOTH_MAX_LAG_CHARS) return SMOOTH_MAX_CPS
  if (backlogChars <= targetBuffer) {
    // 余量健康：按输入速度消费，多给一点避免锯齿
    return Math.min(SMOOTH_MAX_CPS, Math.max(SMOOTH_BASE_CPS, recentInputCps * 1.1))
  }
  // 积压偏多：线性加速追赶
  const ratio = backlogChars / targetBuffer
  return Math.min(SMOOTH_MAX_CPS, Math.max(SMOOTH_BASE_CPS, recentInputCps * ratio))
}

function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

/** 按字符簇切分，避免拆坏 emoji（Intl.Segmenter 不可用时退化为 code point）。 */
export function sliceGraphemes(text: string, length: number): string {
  return segmentGraphemes(text).slice(0, length).join('')
}

export function countGraphemes(text: string): number {
  return segmentGraphemes(text).length
}

export interface SmoothStreamState {
  /** 当前已展示文本 */
  text: string
  /** 上游接收中或展示尚未排空时为 true；此时界面应保持流式态 */
  active: boolean
}

/**
 * 流式平滑展示：把「已收到全文」和「已展示文本」分开。
 * - rAF 消费循环常驻（只随 streaming 启停，不随 fullText 重建），
 *   空闲停帧、新数据到时由独立 effect 唤醒
 * - 字符分段缓存、追加式扩展，每帧不扫描全文
 * - 正常完成平滑排空（receiving 与 revealing 分开），排空完才切精确全文
 */
export function useSmoothStreamingText(fullText: string, streaming: boolean): SmoothStreamState {
  const [revealed, setRevealed] = useState(() => (streaming ? '' : fullText))
  const [draining, setDraining] = useState(false)

  const fullRef = useRef(fullText)
  fullRef.current = fullText
  const streamingRef = useRef(streaming)
  streamingRef.current = streaming
  const drainingRef = useRef(false)
  // 字符分段缓存（追加式扩展，避免每帧扫描全文）
  const segsRef = useRef<{ raw: string; segs: string[] }>({ raw: '', segs: [] })
  const revealedCountRef = useRef(0)
  const runningRef = useRef(false)
  const rafRef = useRef(0)
  const lastTickRef = useRef(0)
  // 近期输入速度估计
  const inputTrackRef = useRef({ len: 0, time: 0, cps: 0 })
  const wakeRef = useRef(() => {})

  // 常驻消费循环：只随 streaming 启停
  useEffect(() => {
    const ensureCache = (full: string): string[] => {
      const cache = segsRef.current
      if (full.startsWith(cache.raw)) {
        if (full.length > cache.raw.length) {
          const add = segmentGraphemes(full.slice(cache.raw.length))
          cache.segs.push(...add)
          cache.raw = full
        }
        return cache.segs
      }
      const segs = segmentGraphemes(full)
      segsRef.current = { raw: full, segs }
      return segs
    }

    const tick = (now: number) => {
      const full = fullRef.current
      const receiving = streamingRef.current
      const segs = ensureCache(full)
      const target = segs.length
      let cur = revealedCountRef.current
      if (cur > target) cur = target

      // 输入速度跟踪
      const track = inputTrackRef.current
      if (track.time === 0) {
        track.len = target
        track.time = now
      } else if (target !== track.len && now > track.time) {
        const inst = ((target - track.len) / (now - track.time)) * 1000
        if (inst >= 0) track.cps = track.cps === 0 ? inst : track.cps * 0.7 + inst * 0.3
        track.len = target
        track.time = now
      }

      const dt = Math.min(100, Math.max(1, now - lastTickRef.current))
      lastTickRef.current = now
      const backlog = target - cur
      if (backlog > 0) {
        const cps = receiving
          ? adaptiveCps(backlog, track.cps || SMOOTH_BASE_CPS)
          : SMOOTH_DRAIN_CPS
        const next = nextRevealLength(cur, target, dt, cps)
        revealedCountRef.current = next
        setRevealed(segs.slice(0, next).join(''))
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      if (receiving) {
        // 无积压但上游还在：停帧等待新数据
        runningRef.current = false
        rafRef.current = 0
        return
      }
      // 接收结束且已排空： settled
      if (drainingRef.current) {
        drainingRef.current = false
        setDraining(false)
      }
      runningRef.current = false
      rafRef.current = 0
    }

    const wake = () => {
      if (runningRef.current) return
      runningRef.current = true
      lastTickRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }
    wakeRef.current = wake

    if (!streaming) {
      if (revealedCountRef.current >= segsRef.current.segs.length && segsRef.current.raw === fullRef.current) {
        // 已 settled：无需循环
        runningRef.current = false
        return
      }
      // 接收结束但还有展示余量：进入排空
      drainingRef.current = true
      setDraining(true)
      wake()
    } else {
      drainingRef.current = false
      setDraining(false)
      wake()
    }
    return () => {
      runningRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming])

  // 新数据到达：只唤醒，不重建循环
  useEffect(() => {
    wakeRef.current()
  }, [fullText])

  if (!streaming && !draining) return { text: fullText, active: false }
  return { text: revealed.length > fullText.length ? fullText : revealed, active: true }
}

/** 节流值：流式 Markdown 重解析最多每 waitMs 跑一次，结束时取最新值。 */
export function useThrottledValue<T>(value: T, waitMs: number, active: boolean): T {
  const [current, setCurrent] = useState(value)
  const latestRef = useRef(value)
  latestRef.current = value

  useEffect(() => {
    if (!active) {
      setCurrent(latestRef.current)
      return
    }
    setCurrent(latestRef.current)
    const timer = setInterval(() => {
      setCurrent((prev) => (prev === latestRef.current ? prev : latestRef.current))
    }, waitMs)
    return () => clearInterval(timer)
  }, [active, waitMs])

  if (!active) return value
  return current
}

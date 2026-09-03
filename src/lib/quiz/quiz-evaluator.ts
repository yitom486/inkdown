import type { QuizGrade, QuizQuestion } from '@shared/types/quiz'
import { calculateQuizGrade } from '@shared/types/quiz'
import { acpApi } from '@/api/acp-api'
import { isOk } from '@shared/core/result'
import { useAcpUiStore } from '@/stores/acp-ui-store'

/**
 * 构造单题提问的 Prompt
 */
export function buildSingleQuestionPrompt(passage: string, chapterTitle?: string): string {
  return `你是一位博学、敏锐且善于启发的苏格拉底式阅读导师。请阅读以下图书段落：

【书籍章节】：${chapterTitle || '正文'}
【原书划线文段】：
"""
${passage.trim()}
"""

请针对上述段落的核心论点、逻辑因果或关键概念，设计一道具有启发性的深度理解与思考题（请避免纯机械字面填空，注重考查读者的理解与批判性思维）。
同时，给出 2~3 个标准采分要点（用于后续衡量读者回答是否击中要害）。

请严格按以下 JSON 格式输出，不要输出任何多余的解释或前后缀：
\`\`\`json
{
  "title": "简短题目标题（如：书系学术定位辨析）",
  "prompt": "具体的提问内容",
  "keyPoints": [
    "采分要点1",
    "采分要点2",
    "采分要点3"
  ]
}
\`\`\`
`
}

/**
 * 构造批卷与打分的 Prompt
 */
export function buildEvaluationPrompt(question: QuizQuestion, userAnswer: string): string {
  return `你是一位专业、公正且循循善诱的书籍阅读导师。现在请对读者的作答进行智能判卷与评估。

【题目】：${question.title}
【考题提问】：${question.prompt}
【原书标准依据】：
"""
${question.sourceExcerpt.trim()}
"""
【预设采分要点】：
${question.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}

【读者作答】：
"""
${userAnswer.trim()}
"""

请对比读者作答与原书论述，客观给出：
1. score: 综合得分（0~100 分）；
2. hitKeyPoints: 读者已准确阐述或命中的采分要点；
3. missedKeyPoints: 读者遗漏或理解有偏差的采分要点；
4. feedback: 导师点评与建议（既肯定其理解深刻处，又指出不足与拓展思考，150字以内）。

请严格按以下 JSON 格式输出：
\`\`\`json
{
  "score": 85,
  "hitKeyPoints": ["已命中的要点"],
  "missedKeyPoints": ["遗漏的要点"],
  "feedback": "整体评语..."
}
\`\`\`
`
}

/**
 * 稳健提取大模型返回的 JSON 对象
 */
export function extractJsonFromResponse<T>(raw: string): T | null {
  try {
    // 优先尝试匹配 ```json ... ``` 代码块
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : raw.trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(jsonStr.slice(start, end + 1)) as T
    }
    return null
  } catch {
    return null
  }
}

/**
 * 解析出题返回
 */
export function parseQuestionResponse(
  raw: string,
): { title: string; prompt: string; keyPoints: string[] } | null {
  const parsed = extractJsonFromResponse<{
    title?: string
    prompt?: string
    keyPoints?: string[]
  }>(raw)

  if (!parsed || !parsed.prompt) return null

  return {
    title: parsed.title?.trim() || '重点要点思考',
    prompt: parsed.prompt.trim(),
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((s) => String(s).trim()).filter(Boolean)
      : ['深入理解核心论点'],
  }
}

/**
 * 解析判卷返回
 */
export function parseEvaluationResponse(raw: string): {
  score: number
  grade: QuizGrade
  feedback: string
  hitKeyPoints: string[]
  missedKeyPoints: string[]
} | null {
  const parsed = extractJsonFromResponse<{
    score?: number
    feedback?: string
    hitKeyPoints?: string[]
    missedKeyPoints?: string[]
  }>(raw)

  if (!parsed) return null

  const rawScore = typeof parsed.score === 'number' ? parsed.score : 70
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))
  const grade = calculateQuizGrade(score)
  const feedback =
    parsed.feedback?.trim() || '作答体现了一定理解，结合原书上下文深入思考会有更多收获。'
  const hitKeyPoints = Array.isArray(parsed.hitKeyPoints)
    ? parsed.hitKeyPoints.map((s) => String(s).trim()).filter(Boolean)
    : []
  const missedKeyPoints = Array.isArray(parsed.missedKeyPoints)
    ? parsed.missedKeyPoints.map((s) => String(s).trim()).filter(Boolean)
    : []

  return {
    score,
    grade,
    feedback,
    hitKeyPoints,
    missedKeyPoints,
  }
}

/**
 * 离线启发式考官生成（当 ACP 未连接时保证可用性）
 */
export function generateFallbackQuestion(
  passage: string,
  chapterTitle?: string,
  markId?: string,
): QuizQuestion {
  const preview = passage.trim().slice(0, 30)
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '核心观点理解与复述',
    prompt: `原书在此论述道：“${preview}……”。请结合上下文，用你自己的语言阐明作者在此处的核心论述与深层意图。`,
    keyPoints: ['准确提炼本段核心主旨', '阐明作者的核心论据或论证逻辑'],
    sourceExcerpt: passage.trim(),
    chapterTitle,
    markId,
  }
}

/**
 * 离线启发式判卷生成（基于字数与词汇覆盖率）
 */
export function evaluateFallbackAnswer(
  question: QuizQuestion,
  userAnswer: string,
): {
  score: number
  grade: QuizGrade
  feedback: string
  hitKeyPoints: string[]
  missedKeyPoints: string[]
} {
  const ans = userAnswer.trim()
  if (ans.length === 0) {
    return {
      score: 0,
      grade: 'D',
      feedback: '未检测到作答内容，请尝试写出你的理解。',
      hitKeyPoints: [],
      missedKeyPoints: question.keyPoints,
    }
  }

  // 计算字数与采分点启发式覆盖
  let hitCount = 0
  const hitPoints: string[] = []
  const missedPoints: string[] = []

  for (const kp of question.keyPoints) {
    const keywords = kp.split(/[\s，、]+/).filter((w) => w.length >= 2)
    const isHit = keywords.some((kw) => ans.includes(kw))
    if (isHit || ans.length > 50) {
      hitCount++
      hitPoints.push(kp)
    } else {
      missedPoints.push(kp)
    }
  }

  const baseScore = Math.min(60 + hitCount * 18 + Math.min(ans.length, 60) * 0.3, 95)
  const score = Math.round(baseScore)
  const grade = calculateQuizGrade(score)

  return {
    score,
    grade,
    feedback: `你的阐述逻辑清晰（共 ${ans.length} 字），较好地触及了原文的核心主旨。若能连接前后章节的脉络，论证将更加厚重。`,
    hitKeyPoints: hitPoints.length > 0 ? hitPoints : [question.keyPoints[0] || '核心主旨理解'],
    missedKeyPoints: missedPoints,
  }
}

/**
 * 发起 ACP / AI 出题
 */
export async function generateQuestionWithAi(
  passage: string,
  chapterTitle?: string,
  markId?: string,
): Promise<QuizQuestion> {
  const acpState = useAcpUiStore.getState()
  const sessionId = acpState.sessionId

  if (!sessionId || acpState.status !== 'connected') {
    // 离线优雅回退
    return generateFallbackQuestion(passage, chapterTitle, markId)
  }

  const promptText = buildSingleQuestionPrompt(passage, chapterTitle)
  const result = await acpApi.prompt({
    sessionId,
    prompt: [{ type: 'text', text: promptText }],
  })

  if (!isOk(result)) {
    return generateFallbackQuestion(passage, chapterTitle, markId)
  }

  // 从 session 历史中提取最后的回答
  const currentThread = acpState.threads.find((t) => t.id === acpState.activeThreadId)
  const lastMsg = currentThread?.messages[currentThread.messages.length - 1]
  const rawResponse = lastMsg?.text || ''

  const parsed = parseQuestionResponse(rawResponse)
  if (!parsed) {
    return generateFallbackQuestion(passage, chapterTitle, markId)
  }

  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: parsed.title,
    prompt: parsed.prompt,
    keyPoints: parsed.keyPoints,
    sourceExcerpt: passage.trim(),
    chapterTitle,
    markId,
  }
}

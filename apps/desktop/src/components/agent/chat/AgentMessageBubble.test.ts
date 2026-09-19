// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentMessageBubble } from './AgentMessageBubble'
import type { AcpChatMessage } from '@/stores/acp-chat-types'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('AgentMessageBubble', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders agent markdown text bubble correctly', () => {
    const msg: AcpChatMessage = {
      id: 'msg-1',
      role: 'agent',
      text: '这是一个包含**加粗**与`代码`的测试消息。',
      createdAt: Date.now(),
    }

    act(() => {
      root.render(createElement(AgentMessageBubble, { message: msg }))
    })

    expect(container.textContent).toContain('这是一个包含')
    expect(container.textContent).toContain('加粗')
    expect(container.textContent).toContain('代码')
  })

  it('renders thought accordion when role is thought', () => {
    const msg: AcpChatMessage = {
      id: 'thought-1',
      role: 'thought',
      text: '分析当前协议版本握手条件',
      createdAt: Date.now(),
    }

    act(() => {
      root.render(createElement(AgentMessageBubble, { message: msg }))
    })

    expect(container.textContent).toContain('思考')
    expect(container.textContent).toContain('分析当前协议版本握手条件')
  })

  it('renders protocol flow steps and jump buttons', () => {
    const msg: AcpChatMessage = {
      id: 'msg-steps-1',
      role: 'agent',
      text: 'ACP 协议生命周期流转解析：',
      createdAt: Date.now(),
      steps: [
        {
          num: 1,
          title: '握手初始化',
          desc: 'Client 发送 initialize 请求',
          anchorId: 'handshake-init',
        },
        {
          num: 2,
          title: '能力协商',
          desc: '双方确认 fs/terminal/mcp 支持',
          anchorId: 'capabilities-ack',
        },
      ],
    }

    act(() => {
      root.render(createElement(AgentMessageBubble, { message: msg }))
    })

    expect(container.textContent).toContain('交互经纬流转')
    expect(container.textContent).toContain('握手初始化')
    expect(container.textContent).toContain('Client 发送 initialize 请求')
    expect(container.textContent).toContain('能力协商')
    expect(container.textContent).toContain('对应章句')
  })
})

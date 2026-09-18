import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ACP_PROXY_SETTINGS,
  buildAcpProxySpawnEnv,
  buildAntigravityProxyEnv,
  readAcpProxySettings,
  saveAcpProxySettings,
} from './acp-proxy-service'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'inkdown-acp-proxy-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('acp-proxy-service', () => {
  it('无配置文件回落默认（关闭 · 127.0.0.1 · 7897）', async () => {
    expect(await readAcpProxySettings(dir)).toEqual(DEFAULT_ACP_PROXY_SETTINGS)
  })

  it('保存后读取一致；端口校验拒绝越界', async () => {
    const saved = await saveAcpProxySettings(
      { enabled: true, host: '127.0.0.1', port: 7897 },
      dir,
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.value).toEqual({ enabled: true, host: '127.0.0.1', port: 7897 })
    expect(await readAcpProxySettings(dir)).toEqual(saved.value)

    const badPort = await saveAcpProxySettings(
      { enabled: true, host: '127.0.0.1', port: 70000 },
      dir,
    )
    expect(badPort.ok).toBe(false)
    const emptyHost = await saveAcpProxySettings({ enabled: false, host: '  ', port: 7897 }, dir)
    expect(emptyHost.ok).toBe(false)
  })

  it('损坏的 proxy.json 按默认处理', async () => {
    await saveAcpProxySettings({ enabled: true, host: '127.0.0.1', port: 7897 }, dir)
    await writeFile(join(dir, 'agent', 'proxy.json'), '{broken', 'utf8')
    expect(await readAcpProxySettings(dir)).toEqual(DEFAULT_ACP_PROXY_SETTINGS)
  })
})

describe('buildAcpProxySpawnEnv', () => {
  it('启用：注入 HTTP(S)_PROXY / ALL_PROXY 与 NO_PROXY，清理小写键', () => {
    const { env, envRemove } = buildAcpProxySpawnEnv({
      enabled: true,
      host: '127.0.0.1',
      port: 7897,
    })
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7897')
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7897')
    expect(env.ALL_PROXY).toBe('http://127.0.0.1:7897')
    expect(env.NO_PROXY).toBe('localhost,127.0.0.1')
    expect(envRemove).toContain('http_proxy')
    expect(envRemove).toContain('no_proxy')
  })

  it('禁用：空增量 + 移除全部代理键（关闭即直连）', () => {
    const { env, envRemove } = buildAcpProxySpawnEnv({
      enabled: false,
      host: '127.0.0.1',
      port: 7897,
    })
    expect(env).toEqual({})
    expect(envRemove).toEqual(
      expect.arrayContaining(['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'https_proxy']),
    )
  })
})

describe('buildAntigravityProxyEnv', () => {
  it('默认端口 7897 并完整注入大小写变量与 SOCKS5 ALL_PROXY，且 envRemove 为空', () => {
    const { env, envRemove } = buildAntigravityProxyEnv()
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7897')
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7897')
    expect(env.http_proxy).toBe('http://127.0.0.1:7897')
    expect(env.https_proxy).toBe('http://127.0.0.1:7897')
    expect(env.ALL_PROXY).toBe('socks5://127.0.0.1:7897')
    expect(env.all_proxy).toBe('socks5://127.0.0.1:7897')
    expect(env.NO_PROXY).toBe('localhost,127.0.0.1,::1')
    expect(env.no_proxy).toBe('localhost,127.0.0.1,::1')
    expect(envRemove).toEqual([])
  })

  it('支持自定义主机与端口', () => {
    const { env, envRemove } = buildAntigravityProxyEnv({ host: '192.168.1.100', port: 10808 })
    expect(env.HTTP_PROXY).toBe('http://192.168.1.100:10808')
    expect(env.ALL_PROXY).toBe('socks5://192.168.1.100:10808')
    expect(envRemove).toEqual([])
  })
})


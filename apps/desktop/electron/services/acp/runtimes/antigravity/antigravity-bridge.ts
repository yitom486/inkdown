import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const ANTIGRAVITY_CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
export const ANTIGRAVITY_CLIENT_SECRET = '***REMOVED***'
export const ANTIGRAVITY_TOKEN_URI = 'https://oauth2.googleapis.com/token'
export const ANTIGRAVITY_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/aicode',
]

export interface AntigravityTokenFile {
  client_id: string
  client_secret: string
  refresh_token: string
  token_uri: string
  scopes: string[]
}

const READ_CRED_PS_SCRIPT = `
$sig = @'
using System;
using System.Runtime.InteropServices;
public class CM {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode)]
  public static extern bool CredRead(string t, int ty, int f, out IntPtr p);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr c);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
}
'@
Add-Type -TypeDefinition $sig
$p = [IntPtr]::Zero
if (-not [CM]::CredRead("gemini:antigravity", 1, 0, [ref]$p)) { exit 1 }
$c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][CM+CREDENTIAL])
$b = New-Object byte[] $c.CredentialBlobSize
[Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $b, 0, $c.CredentialBlobSize)
[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))
[CM]::CredFree($p)
`

export function getAntigravityTokenPath(home = homedir()): string {
  return join(home, '.gemini', 'antigravity-acp', 'acp_token.json')
}

export function hasValidAntigravityTokenFile(filePath = getAntigravityTokenPath()): boolean {
  if (!existsSync(filePath)) return false
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AntigravityTokenFile>
    return Boolean(typeof parsed?.refresh_token === 'string' && parsed.refresh_token.trim())
  } catch {
    return false
  }
}

/**
 * 从 Windows 凭据管理器（gemini:antigravity）中提取 refresh_token，
 * 并以官方 consumer 格式写入 ~/.gemini/antigravity-acp/acp_token.json。
 *
 * 机制依据：docs/antigravity_acp_auth_and_lifecycle.md 第 3.1 节。
 * 作用：让无头 agy_acp_server 启动时直接走网络静默换票，达成 0 弹窗复用。
 */
export async function bridgeAntigravityCredentialFromManager(options?: {
  targetFile?: string
  execCommand?: (cmd: string, args: string[]) => Promise<{ stdout: string }>
}): Promise<boolean> {
  const targetFile = options?.targetFile ?? getAntigravityTokenPath()

  // 1. 文件中若已有合法的 refresh_token，直接复用跳过
  if (hasValidAntigravityTokenFile(targetFile)) {
    return true
  }

  // 2. 凭据管理器读取仅限 Windows 平台
  if (process.platform !== 'win32' && !options?.execCommand) {
    return false
  }

  try {
    const runner =
      options?.execCommand ??
      (async (cmd: string, args: string[]) => {
        return await execFileAsync(cmd, args, { encoding: 'utf8' })
      })

    const { stdout } = await runner('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      READ_CRED_PS_SCRIPT,
    ])

    if (!stdout || !stdout.trim()) {
      return false
    }

    const parsed = JSON.parse(stdout) as {
      token?: { refresh_token?: string }
    }
    const refreshToken = parsed?.token?.refresh_token?.trim()
    if (!refreshToken) {
      return false
    }

    const tokenPayload: AntigravityTokenFile = {
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      refresh_token: refreshToken,
      token_uri: ANTIGRAVITY_TOKEN_URI,
      scopes: ANTIGRAVITY_SCOPES,
    }

    const targetDir = join(targetFile, '..')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(targetFile, JSON.stringify(tokenPayload, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    })
    return true
  } catch (error) {
    console.warn('[acp:antigravity] 凭据桥接跳过或失败', error)
    return false
  }
}

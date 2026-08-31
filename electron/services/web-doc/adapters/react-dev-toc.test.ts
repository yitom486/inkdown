import { describe, expect, it } from 'vitest'
import { extractReactDevToc } from './react-dev-toc'

const REACT_DEV_NAV_FIXTURE = `<!DOCTYPE html><html><body>
<aside><nav role="navigation">
<ul>
<h3>GET STARTED</h3>
<li><a title="Quick Start" href="/learn"><div>Quick Start</div></a>
<ul>
<li><a title="Tutorial: Tic-Tac-Toe" href="/learn/tutorial-tic-tac-toe"><div>Tutorial: Tic-Tac-Toe</div></a></li>
<li><a title="Thinking in React" href="/learn/thinking-in-react"><div>Thinking in React</div></a></li>
</ul>
</li>
<li><a title="Installation" href="/learn/installation"><div>Installation</div></a></li>
</ul>
</nav></aside>
</body></html>`

describe('extractReactDevToc', () => {
  it('解析侧栏层级目录', () => {
    const entries = extractReactDevToc(REACT_DEV_NAV_FIXTURE, 'https://react.dev/learn')
    expect(entries.map((entry) => entry.label)).toEqual([
      'Quick Start',
      'Tutorial: Tic-Tac-Toe',
      'Thinking in React',
      'Installation',
    ])
    expect(entries[0]?.level).toBe(0)
    expect(entries[1]?.level).toBe(1)
    expect(entries[3]?.href).toBe('https://react.dev/learn/installation')
  })
})

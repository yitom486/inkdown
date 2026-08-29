import { beforeEach, describe, expect, it } from 'vitest'
import { getOpenDialogDefaultPath } from '@/lib/dialog-default-path'
import { useAppSettingsStore } from '@/stores/app-settings-store'

describe('getOpenDialogDefaultPath', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({
      lastOpenedFolderPath: undefined,
      lastOpenedFilePath: undefined,
    })
  })

  it('优先使用上次打开的文件夹路径', () => {
    useAppSettingsStore.setState({
      lastOpenedFolderPath: 'D:\\books\\社会科学',
      lastOpenedFilePath: 'D:\\books\\其他\\old.epub',
    })

    expect(getOpenDialogDefaultPath()).toBe('D:\\books\\社会科学')
  })

  it('无文件夹记录时回退到上次打开文件所在目录', () => {
    useAppSettingsStore.setState({
      lastOpenedFilePath: 'D:\\books\\社会科学\\中国国家治理的制度逻辑.epub',
    })

    expect(getOpenDialogDefaultPath()).toBe('D:\\books\\社会科学')
  })

  it('没有任何打开记录时返回 undefined', () => {
    expect(getOpenDialogDefaultPath()).toBeUndefined()
  })
})

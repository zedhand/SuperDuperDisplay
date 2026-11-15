import { describe, expect, it, vi } from 'vitest'
import { AppWatcher, findActiveRule, parseTasklist } from '../src/main/appWatcher'
import { defaultConfig } from '../src/shared/schema'
import type { AppConfig, AppRule } from '../src/shared/types'

const rule = (over: Partial<AppRule> = {}): AppRule => ({
  id: 'r1',
  exe: 'Game',
  lockMouse: true,
  presetId: null,
  enabled: true,
  ...over
})

describe('parseTasklist', () => {
  it('extracts lowercase image names', () => {
    const s = parseTasklist(
      '"Game.exe","123","Console","1","50,000 K"\r\n"explorer.exe","4","Console","1","1 K"'
    )
    expect(s.has('game.exe')).toBe(true)
    expect(s.has('explorer.exe')).toBe(true)
  })
})

describe('findActiveRule', () => {
  it('matches with or without .exe, case-insensitively', () => {
    expect(findActiveRule([rule()], new Set(['game.exe']))?.id).toBe('r1')
    expect(findActiveRule([rule({ exe: 'GAME.EXE' })], new Set(['game.exe']))?.id).toBe('r1')
  })
  it('ignores disabled or empty rules', () => {
    expect(findActiveRule([rule({ enabled: false })], new Set(['game.exe']))).toBeNull()
    expect(findActiveRule([rule({ exe: ' ' })], new Set(['.exe']))).toBeNull()
  })
})

describe('AppWatcher', () => {
  function setup(config: AppConfig): {
    w: AppWatcher
    actions: { setMouseLock: ReturnType<typeof vi.fn>; setPreset: ReturnType<typeof vi.fn> }
  } {
    const actions = { setMouseLock: vi.fn(), setPreset: vi.fn() }
    return { w: new AppWatcher(() => config, actions), actions }
  }
  const base = (): AppConfig => ({
    ...defaultConfig,
    display: { ...defaultConfig.display, lockMouse: false },
    appRules: [rule({ presetId: 'black' })]
  })

  it('applies the rule on launch and undoes it on exit', () => {
    const config = base()
    const { w, actions } = setup(config)
    w.evaluate(config, new Set(['game.exe']))
    expect(actions.setMouseLock).toHaveBeenCalledWith(true)
    expect(actions.setPreset).toHaveBeenCalledWith('black')

    // reflect the changes the actions would have made
    const during: AppConfig = {
      ...config,
      activePresetId: 'black',
      display: { ...config.display, lockMouse: true }
    }
    w.evaluate(during, new Set())
    expect(actions.setMouseLock).toHaveBeenLastCalledWith(false)
    expect(actions.setPreset).toHaveBeenLastCalledWith(config.activePresetId)
  })

  it('does not touch a lock the user already had on', () => {
    const config = base()
    config.display.lockMouse = true
    const { w, actions } = setup(config)
    w.evaluate(config, new Set(['game.exe']))
    expect(actions.setMouseLock).not.toHaveBeenCalled()
    w.evaluate(config, new Set())
    expect(actions.setMouseLock).not.toHaveBeenCalled()
  })

  it('does not restore the scene if the user changed it meanwhile', () => {
    const config = base()
    const { w, actions } = setup(config)
    w.evaluate(config, new Set(['game.exe']))
    actions.setPreset.mockClear()
    w.evaluate({ ...config, activePresetId: 'something-else' }, new Set())
    expect(actions.setPreset).not.toHaveBeenCalled()
  })
})

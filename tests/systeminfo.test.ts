import { describe, expect, it } from 'vitest'
import { pickSystemDiskPct, sumMbps } from '../src/main/telemetry/systeminfo'

describe('sumMbps', () => {
  it('converts bytes/sec to megabits/sec', () => {
    expect(sumMbps([125_000, 125_000])).toBe(2)
  })
  it('skips interfaces without a sample', () => {
    expect(sumMbps([-1, null, 1_250_000])).toBe(10)
  })
  it('is null with no usable samples', () => {
    expect(sumMbps([-1, undefined])).toBeNull()
  })
})

describe('pickSystemDiskPct', () => {
  const disks = [
    { mount: 'D:', use: 10 },
    { mount: 'C:', use: 55.55 }
  ]
  it('prefers the system drive', () => {
    expect(pickSystemDiskPct(disks, 'C:')).toBe(55.6)
  })
  it('falls back to the first drive', () => {
    expect(pickSystemDiskPct(disks, 'Z:')).toBe(10)
  })
  it('is null with no drives', () => {
    expect(pickSystemDiskPct([])).toBeNull()
  })
})

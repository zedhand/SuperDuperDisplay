import { describe, expect, it } from 'vitest'
import { parseLhmData, parseNvidiaSmiCsv, type LhmNode } from '../src/main/telemetry/parsers'

describe('parseNvidiaSmiCsv', () => {
  it('parses a well-formed CSV line', () => {
    expect(parseNvidiaSmiCsv('72, 45, 1500, 4096, 8192')).toEqual({
      gpuTemp: 72,
      gpuLoad: 45,
      gpuClockMHz: 1500,
      vramUsedMB: 4096,
      vramTotalMB: 8192
    })
  })

  it('returns null for a line with the wrong number of fields', () => {
    expect(parseNvidiaSmiCsv('72, 45, 1500')).toBeNull()
  })

  it('returns null for a non-numeric line (e.g. an error message)', () => {
    expect(parseNvidiaSmiCsv('NVIDIA-SMI has failed')).toBeNull()
  })
})

// A representative slice of LibreHardwareMonitor's data.json tree for a Ryzen system.
const AMD_FIXTURE: LhmNode = {
  Text: 'Sensor',
  Children: [
    {
      Text: 'DESKTOP-PC',
      Children: [
        {
          Text: 'AMD Ryzen 7 5800X',
          Children: [
            {
              Text: 'Temperatures',
              Children: [
                { Text: 'CCD1 (Tdie)', Value: '42.0 °C', SensorId: '/amdcpu/0/temperature/1' },
                { Text: 'Core (Tctl/Tdie)', Value: '45.5 °C', SensorId: '/amdcpu/0/temperature/2' }
              ]
            },
            {
              Text: 'Load',
              Children: [{ Text: 'CPU Total', Value: '12.5 %', SensorId: '/amdcpu/0/load/0' }]
            },
            {
              Text: 'Clocks',
              Children: [
                { Text: 'Core #1', Value: '3800.0 MHz', SensorId: '/amdcpu/0/clock/1' },
                { Text: 'Core Average', Value: '3650.2 MHz', SensorId: '/amdcpu/0/clock/9' }
              ]
            }
          ]
        }
      ]
    }
  ]
}

describe('parseLhmData', () => {
  it('picks the AMD Tctl/Tdie temperature over other CPU temperature sensors', () => {
    expect(parseLhmData(AMD_FIXTURE).cpuTemp).toBe(45.5)
  })

  it('picks the CPU Total load sensor', () => {
    expect(parseLhmData(AMD_FIXTURE).cpuLoad).toBe(12.5)
  })

  it('picks the Core Average clock sensor over a single-core reading', () => {
    expect(parseLhmData(AMD_FIXTURE).cpuClockMHz).toBe(3650.2)
  })

  it('falls back to the first matching sensor when no preferred label exists', () => {
    const fixture: LhmNode = {
      Text: 'Sensor',
      Children: [{ Text: 'Some CPU', Value: '50.0 °C', SensorId: '/somecpu/0/temperature/0' }]
    }
    expect(parseLhmData(fixture).cpuTemp).toBe(50)
  })

  it('returns nulls when the tree has no CPU sensors at all', () => {
    const empty: LhmNode = { Text: 'Sensor', Children: [] }
    expect(parseLhmData(empty)).toEqual({ cpuTemp: null, cpuLoad: null, cpuClockMHz: null })
  })

  it('ignores non-CPU sensors (e.g. GPU) when picking a fallback', () => {
    const fixture: LhmNode = {
      Text: 'Sensor',
      Children: [{ Text: 'GPU Core', Value: '65.0 °C', SensorId: '/gpu-nvidia/0/temperature/0' }]
    }
    expect(parseLhmData(fixture).cpuTemp).toBeNull()
  })
})

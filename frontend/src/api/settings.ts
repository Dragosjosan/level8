import type { SettingsResponseDto } from '../dto/settings'
import type { Settings } from '../types'
import { requestJson } from './client'

export function getSettings(): Promise<Settings> {
    return requestJson<SettingsResponseDto>(
        '/api/settings',
    )
}

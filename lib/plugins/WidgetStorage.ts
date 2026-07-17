import { registerPlugin } from '@capacitor/core'

export interface WidgetStoragePlugin {
  saveToken(options: { token: string }): Promise<{ success: boolean }>
}

const WidgetStorage = registerPlugin<WidgetStoragePlugin>('WidgetStoragePlugin')

export default WidgetStorage

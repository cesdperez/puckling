import { BLE } from '@geastack/core'
import { decodeBlob } from './link-blob'

function toBytes(text: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i))
  return bytes
}

export class Link {
  body: string | undefined
  arrived = 0
  private initialized = false
  private pairDocument = ''
  private polledAt: number | undefined

  poll(now: number): void {
    if (this.polledAt !== undefined && now - this.polledAt < 250) return
    this.polledAt = now
    try {
      if (!this.initialized) {
        this.initialized = true
        BLE.init('puckling', 0, '')
        BLE.startAdvertising()
      }
      if (BLE.config.pairing()) {
        const text = 'pair ' + BLE.config.pairCode()
        if (text !== this.pairDocument) {
          // Republishing rewinds the config service's DATA read cursor.
          BLE.config.setDocument(toBytes(text))
          this.pairDocument = text
        }
      } else this.pairDocument = ''
      const length = BLE.config.pendingLength()
      if (length > 0) {
        const bytes: number[] = []
        for (let i = 0; i < length; i++) bytes.push(BLE.config.pendingByteAt(i))
        BLE.config.consumePending()
        const body = decodeBlob(bytes, localStorage.getItem('feedkey') || '')
        if (body !== undefined) { this.body = body; this.arrived = now }
      }
    } catch (error) { console.log('puckling BLE: ' + String(error)) }
  }
}

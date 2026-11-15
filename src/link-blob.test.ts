import { expect, test } from 'bun:test'
import { decodeBlob } from './link-blob'

test('accepts only a blob with the stored key', () => {
  const bytes = Array.from(new TextEncoder().encode('1234567890abcdef\nhello\nworld'))
  expect(decodeBlob(bytes, '1234567890abcdef')).toBe('hello\nworld')
  expect(decodeBlob(bytes, '')).toBeUndefined()
  expect(decodeBlob(bytes, 'wrong')).toBeUndefined()
  expect(decodeBlob([49], '1')).toBeUndefined()
})

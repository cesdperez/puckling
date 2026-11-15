import { describe, expect, test } from 'bun:test'
import { createLife, serializeLife } from './life'
import { bytesToText, digest, petLife, restore } from './meals'

describe('meal glue', () => {
  test('restores valid life and falls back for garbage', () => {
    expect(restore('garbage')).toEqual(createLife())
    const life = digest(createLife(), '1 90000 80000 5000 5000 0 0 60 1').life
    expect(restore(serializeLife(life))).toEqual(life)
  })
  test('digests new, unchanged and malformed food', () => {
    const first = digest(createLife(), '1 100 100 0 0 0 0 0 1')
    expect(first.ate).toBe(100)
    expect(first.meal).toBe(true)
    expect(digest(first.life, '1 100 100 0 0 0 0 0 1').ate).toBe(0)
    expect(digest(first.life, 'bad').life).toBe(first.life)
    expect(digest(first.life, '').meal).toBe(false)
    expect(digest(first.life, '1 150 150 0 0 0 0 0 1').ate).toBe(50)
  })
  test('continues evolving on repeated polls', () => {
    const line = '1 600000 600000 0 0 0 0 0 1'
    const first = digest(createLife(), line)
    const second = digest(first.life, line)
    const third = digest(second.life, line)
    expect([first.life.stage, second.life.stage, third.life.stage]).toEqual(['baby', 'child', 'teen'])
    expect(second.evolved).toBe(true)
    expect(second.ate).toBe(0)
  })
  test('projects night with the last food timezone and decodes bytes', () => {
    const life = digest(createLife(), '1 1 1 0 0 0 0 60 1').life
    expect(petLife(life, 1600034400000).night).toBe(true)
    expect(petLife(life, 0).night).toBe(false)
    expect(bytesToText(new Uint8Array([49, 32, 50]))).toBe('1 2')
  })
})

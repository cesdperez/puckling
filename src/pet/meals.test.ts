import { describe, expect, test } from 'bun:test'
import { createLife, serializeLife } from './life'
import { bytesToText, digest, petLife, restore, tick } from './meals'

describe('meal glue', () => {
  test('ticks polling and saving independently', () => {
    let reads = 0
    const read = () => { reads++; return '1 100 100 0 0 0 0 0 1' }
    const initial = { life: createLife(), sincePoll: 0, sinceSave: 0 }
    const first = tick(initial, 1, read)
    expect(reads).toBe(0)
    expect(first.save).toBe(false)
    const second = tick(first.feeding, 1, read)
    expect(reads).toBe(1)
    expect(second.meal).toBe(true)
    expect(second.save).toBe(true)
    expect(initial.life.seen).toBe(false)
    const third = tick(second.feeding, 2, read)
    expect(third.save).toBe(false)
    const periodic = tick(third.feeding, 598, read)
    expect(periodic.save).toBe(true)
    expect(periodic.feeding.sinceSave).toBe(0)
  })
  test('saves evolution without a new meal', () => {
    const read = () => '1 600000 600000 0 0 0 0 0 1'
    const first = tick({ life: createLife(), sincePoll: 0, sinceSave: 0 }, 2, read)
    const second = tick(first.feeding, 2, read)
    expect(second.evolved).toBe(true)
    expect(second.ate).toBe(0)
    expect(second.save).toBe(true)
  })
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

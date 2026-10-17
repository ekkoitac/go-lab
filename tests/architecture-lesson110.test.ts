import assert from 'node:assert/strict'
import test from 'node:test'
import { defaults, simulate, transferFeedback } from '../src/components/architecture-lab/lesson110/model'

test('110 shadow compares the same inputs without financial side effects', () => {
  const s = simulate({ ...defaults, algorithmBug: true }, 1)
  assert.equal(s.charges.length, 0)
  assert.equal(s.shadow[0].next - s.shadow[0].old, 20)
  assert.equal(s.shadow.filter(r => r.old !== r.next).length, 1)
})
test('110 a discrepancy prevents rollout and all formal writes stay old', () => {
  const s = simulate({ ...defaults, algorithmBug: true, rollout: 100, compatible: false }, 5)
  assert.equal(s.gate, 'blocked')
  assert.equal(s.charges.length, 4)
  assert.ok(s.charges.every(c => c.writer === 'old'))
  assert.equal(s.oldCanRead, true)
})
test('110 stable canary has exactly one writer per request, same-route retry adds no charge', () => {
  for (const sharedAuthority of [true, false]) {
    const first = simulate({ ...defaults, sharedAuthority }, 3)
    const retry = simulate({ ...defaults, sharedAuthority }, 4)
    assert.equal(first.charges.filter(c => c.writer === 'new').length, 1)
    assert.equal(first.charges.find(c => c.writer === 'new')?.key, 'B01')
    assert.deepEqual(first.charges, retry.charges)
    assert.equal(retry.retries, 1)
  }
})
test('110 verified compatible rollback preserves ledger and shared deduplication', () => {
  const before = simulate(defaults, 4)
  const after = simulate(defaults, 5)
  assert.deepEqual(after.charges, before.charges)
  assert.equal(after.route, 0)
  assert.equal(after.duplicates, 0)
})
test('110 routing-only rollback cannot undo incompatible writes', () => {
  const config = { ...defaults, compatible: false, rollback: 'route' as const }
  const before = simulate(config, 4)
  const after = simulate(config, 5)
  assert.equal(after.route, 0)
  assert.equal(after.oldCanRead, false)
  assert.match(after.rollback, /报错/)
  assert.deepEqual(after.charges, before.charges)
})
test('110 independent idempotency tables duplicate the cross-version retry', () => {
  const s = simulate({ ...defaults, sharedAuthority: false, rollback: 'route' }, 5)
  assert.equal(s.charges.length, 5)
  assert.equal(s.duplicates, 1)
  assert.equal(s.charges.filter(c => c.key === 'B01').length, 2)
})
test('110 verification blocks unsafe rollback before changing route or issuing retries', () => {
  for (const config of [{ ...defaults, compatible: false }, { ...defaults, sharedAuthority: false }]) {
    const s = simulate(config, 5)
    assert.match(s.rollback, /阻止回退/)
    assert.equal(s.route, 25)
    assert.equal(s.charges.length, 4)
    assert.equal(s.retries, 1)
  }
})
test('110 no-new-writes needs neither new compatibility nor cross-store retry', () => {
  const s = simulate({ ...defaults, rollout: 0, compatible: false, sharedAuthority: false }, 5)
  assert.equal(s.charges.length, 4)
  assert.equal(s.oldCanRead, true)
  assert.equal(s.rollback, '路由已回旧版')
})
test('110 replay is deterministic and preserves previous evidence', () => {
  const saved = simulate(defaults, 5)
  const evidence = JSON.stringify(saved)
  simulate({ ...defaults, sharedAuthority: false, rollback: 'route' }, 5)
  assert.equal(JSON.stringify(saved), evidence)
  assert.deepEqual(simulate(defaults, 3), simulate(defaults, 3))
  assert.deepEqual(simulate(defaults, -1), simulate(defaults, 0))
  assert.deepEqual(simulate(defaults, 99), simulate(defaults, 5))
  assert.equal(simulate(defaults, Number.NaN).phase, 0)
})
test('110 transfer feedback distinguishes record loss from reversing a charge', () => {
  assert.equal(transferFeedback('repair').correct, true)
  assert.equal(transferFeedback('route').correct, false)
  assert.match(transferFeedback('restore').text, /不会撤回/)
})

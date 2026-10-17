import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults, methods, simulate, transferFeedback } from '../src/components/architecture-lab/lesson109/model'

test('109: Windows blocks Go plugin before load, but executable-based approaches work', () => {
  const config = { ...defaults, os: 'windows' as const, failure: 'normal' as const }
  const plugin = simulate(config, 'plugin', 5)
  assert.equal(plugin.loaded, false)
  assert.equal(plugin.call, '无法调用')
  assert.equal(plugin.host, '运行中')
  assert.equal(simulate(config, 'static', 4).call, '成功')
  assert.equal(simulate(config, 'rpc', 4).call, '成功')
})
test('109: build compatibility and wire version are distinct gates', () => {
  const config = { ...defaults, buildMatch: false, protocolMatch: false, failure: 'normal' as const }
  assert.equal(simulate(config, 'plugin', 3).extension, '装载被阻止')
  const rpc = simulate(config, 'rpc', 4)
  assert.equal(rpc.call, '握手拒绝（v1 ≠ v2）')
  assert.equal(rpc.file, '未访问')
  assert.equal(simulate(config, 'rpc', 5).loaded, false)
  assert.equal(simulate(config, 'static', 4).call, '成功')
})
test('109: unrecovered panic crosses shared address space but not process boundary', () => {
  for (const method of ['static', 'plugin'] as const) assert.equal(simulate(defaults, method, 4).host, '已退出')
  const rpc = simulate(defaults, 'rpc', 4)
  assert.equal(rpc.host, '运行中')
  assert.equal(rpc.call, '失败')
  assert.equal(rpc.extension, '因未恢复 panic 退出')
  assert.equal(simulate(defaults, 'rpc', 5).call, '失败')
})
test('109: same-user child has file permissions unless OS separately denies access', () => {
  const config = { ...defaults, failure: 'file' as const }
  for (const method of methods) assert.equal(simulate(config, method, 4).file, '读取成功')
  assert.equal(simulate({ ...config, restricted: true }, 'rpc', 4).file, '操作系统拒绝')
  assert.equal(simulate({ ...config, restricted: true }, 'plugin', 4).file, '读取成功')
})
test('109: non-cooperative timeout ends only after child deadline and reclamation', () => {
  const config = { ...defaults, failure: 'timeout' as const }
  assert.equal(simulate(config, 'rpc', 4).call, '等待结果')
  assert.equal(simulate(config, 'rpc', 5).call, '超时失败')
  assert.equal(simulate(config, 'rpc', 5).loaded, false)
  assert.equal(simulate(config, 'static', 5).call, '等待结果')
  assert.equal(simulate(config, 'static', 5).host, '运行中')
})
test('109: Go plugin stays loaded, while normal child can be reclaimed', () => {
  const config = { ...defaults, failure: 'normal' as const }
  assert.equal(simulate(config, 'plugin', 5).loaded, true)
  assert.equal(simulate(config, 'rpc', 5).loaded, false)
})
test('109: rewind is deterministic and phases are bounded', () => {
  const original = { ...defaults }
  const before = simulate(original, 'rpc', 3)
  simulate(original, 'rpc', 5)
  assert.deepEqual(simulate(original, 'rpc', 3), before)
  assert.deepEqual(original, defaults)
  assert.equal(simulate(defaults, 'rpc', -1).phase, 0)
  assert.equal(simulate(defaults, 'rpc', 99).phase, 5)
})
test('109: transfer requires independent failure, permission and protocol boundaries', () => {
  assert.equal(transferFeedback('rpc', true, true).length, 0)
  assert.equal(transferFeedback('rpc', false, true).length, 1)
  assert.equal(transferFeedback('plugin', false, false).length, 3)
})

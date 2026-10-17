import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, inspect, direction, record, rewind } from '../src/components/operations-lab/lesson165/model';
test('GOGC growth includes roots but target is heap, not RSS', () => {
  const base = inspect(defaults);
  assert.equal(base.target, 420);
  assert.equal(base.accountedMemory, 520);
  assert.equal(base.cyclesPerSecond, 1);
  assert.equal(base.scanWork, 220);
});
test('with headroom twice the growth halves steady-state scan work', () => {
  const base = inspect({...defaults, softLimit:2000});
  const next = inspect({...defaults, gogc:200, softLimit:2000});
  assert.equal(next.growth, base.growth * 2);
  assert.equal(next.scanWork, base.scanWork! / 2);
  assert.equal(direction(base,next),'lower');
});
test('binding soft budget makes increasing GOGC alone ineffective', () => {
  const base = inspect({...defaults, softLimit:420});
  const next = inspect({...defaults, softLimit:420, gogc:400});
  assert.equal(next.growth,120);
  assert.equal(next.constrained,true);
  assert.equal(direction(base,next),'same');
});
test('cutting allocation reduces frequency without changing target or retention', () => {
  const base = inspect(defaults);
  const next = inspect({...defaults,allocation:110});
  assert.equal(next.target,base.target);
  assert.equal(next.config.live,200);
  assert.equal(next.scanWork,110);
});
test('unreachable budget never fabricates finite scan work or frees live objects', () => {
  const next = inspect({...defaults,softLimit:200});
  assert.equal(next.infeasible,true);
  assert.equal(next.config.live,200);
  assert.equal(next.scanWork,null);
  assert.equal(next.accountedMemory,300);
  assert.equal(direction(inspect(defaults),next),'infeasible');
});
test('prediction and reason are stored and rewind restores history', () => {
  const history = record([], {...defaults,gogc:200}, 'lower', '增长空间更大');
  assert.equal(history[0].actual,'lower');
  assert.deepEqual(record(history, defaults,'same','  '),history);
  assert.deepEqual(rewind(history),[]);
  assert.throws(()=>inspect({...defaults, allocation:NaN}));
});

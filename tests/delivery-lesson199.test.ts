import test from 'node:test';
import assert from 'node:assert/strict';
import { current199, initial199, issues199, transition199, triggers199, type Action199, type State199 } from '../src/components/delivery-lab/lesson199/model.ts';
const run = (s: State199, ...actions: Action199[]) => actions.reduce(transition199, s);
const bind = (s: State199) => run(s, { type: 'evidence', key: 'organization', value: true }, { type: 'evidence', key: 'measurement', value: true }, { type: 'cost', value: true });

test('199: organization and measured cost independently trigger reconsideration without rewriting old evidence', () => {
  const base = initial199();
  assert.deepEqual(triggers199(base), []);
  const org = transition199(base, { type: 'organization', value: 'merged' });
  assert.equal(triggers199(org).length, 1);
  const cost = transition199(base, { type: 'measurement', value: 28 });
  assert.equal(triggers199(cost).length, 1);
  assert.equal(cost.records[0].context.measuredCost, 12);
  assert.equal(base.context.measuredCost, 12);
  assert.equal(triggers199(transition199(base, { type: 'measurement', value: 20 })).length, 0);
});

test('199: incomplete evidence and incompatible common release cannot pass review', () => {
  const base = initial199();
  assert.equal(transition199(base, { type: 'step' }).phase, 'draft');
  const invalid = bind(transition199(base, { type: 'choice', value: 'modular' }));
  assert.ok(issues199(invalid).some(s => s.includes('硬约束')));
  assert.equal(transition199(invalid, { type: 'step' }).records.length, 1);
});

test('199: both alternatives can be accepted after organizational change; no permanent architectural winner', () => {
  for (const choice of ['modular', 'services'] as const) {
    const draft = bind(run(initial199(), { type: 'organization', value: 'merged' }, { type: 'choice', value: choice }));
    assert.equal(issues199(draft).length, 0);
    const published = run(draft, { type: 'step' }, { type: 'step' });
    assert.equal(current199(published).choice, choice);
    assert.equal(published.phase, 'published');
  }
});

test('199: replacement preserves history and raw reasons with reciprocal links', () => {
  const raw = '  我的理由\n保留模块边界，接受共同发布。  ';
  const old = structuredClone(initial199().records[0]);
  const draft = bind(run(initial199(), { type: 'organization', value: 'merged' }, { type: 'choice', value: 'modular' }, { type: 'rationale', value: raw }));
  const reviewed = transition199(draft, { type: 'step' });
  assert.equal(reviewed.records.length, 1);
  const published = transition199(reviewed, { type: 'step' });
  assert.equal(published.records[0].status, 'superseded');
  assert.equal(published.records[0].supersededBy, 'ADR-002');
  assert.deepEqual(published.records[0].context, old.context);
  assert.equal(published.records[0].rationale, old.rationale);
  assert.equal(current199(published).supersedes, 'ADR-001');
  assert.equal(current199(published).rationale, raw);
  assert.equal(transition199(published, { type: 'step' }).records.length, 2);
  assert.equal(draft.records[0].status, 'accepted');
});

test('199: changing evidence after review invalidates review and corresponding binding', () => {
  const reviewed = transition199(bind(initial199()), { type: 'step' });
  const changed = transition199(reviewed, { type: 'measurement', value: 15 });
  assert.equal(changed.phase, 'draft');
  assert.equal(changed.evidence.measurement, false);
  assert.equal(changed.evidence.organization, true);
  assert.equal(transition199(changed, { type: 'step' }).records.length, 1);
  const otherChoice = transition199(reviewed, { type: 'choice', value: 'modular' });
  assert.equal(otherChoice.costAccepted, false);
});

test('199: accepting a decision is not implementing a migration or reducing measured costs', () => {
  const draft = bind(run(initial199(), { type: 'organization', value: 'merged' }, { type: 'measurement', value: 28 }, { type: 'choice', value: 'modular' }));
  const published = run(draft, { type: 'step' }, { type: 'step' });
  assert.equal(published.phase, 'published');
  assert.equal(published.context.measuredCost, 28);
  assert.equal(triggers199(published).length, 1);
  assert.ok(triggers199(published)[0].includes('28'));
});

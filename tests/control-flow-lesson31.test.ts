import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial31,next31,trace31,type Config31} from '../src/components/control-flow-lab/lesson31/model';
const config:Config31={prices:[100,201],stock:5,percent:90,strategy:'copy'};
test('range copies ordinary fields without writeback; integer price truncates',()=>{const t=trace31(config);assert.equal(t[2].current?.price,90);assert.deepEqual(t.at(-1)!.items.map(x=>x.price),[100,201]);assert.equal(t[4].current?.price,180);});
test('index writes source while already copied field stays unchanged',()=>{const t=trace31({...config,strategy:'index'});assert.equal(t[2].current?.price,100);assert.equal(t[2].items[0].price,90);assert.deepEqual(t.at(-1)!.items.map(x=>x.price),[90,180]);});
test('copied pointer aliases referent, not ordinary field',()=>{const t=trace31({...config,strategy:'reference'});assert.equal(t[1].current?.stockRef,t[1].items[0].stockRef);assert.equal(t[2].heap.stock0,6);assert.equal(t[2].heap.stock1,5);assert.deepEqual(t.at(-1)!.heap,{stock0:6,stock1:6});assert.deepEqual(t.at(-1)!.items.map(x=>x.price),[100,201]);});
test('snapshots stay immutable for rewind; final state is stable',()=>{const start=initial31(config);const copied=next31(start,config);const written=next31(copied,config);assert.equal(start.current,null);assert.equal(copied.current?.price,100);assert.equal(written.current?.price,90);const done=trace31(config).at(-1)!;assert.equal(next31(done,config),done);});
test('empty input ends without phantom copy or write',()=>{const t=trace31({...config,prices:[]});assert.equal(t.length,2);assert.equal(t[1].phase,'done');assert.deepEqual(t[1].heap,{});});

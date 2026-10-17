import test from 'node:test';
import assert from 'node:assert/strict';
import {atStep,finalState,initialConfig,type Config} from '../src/components/io-lab/lesson68/model';
test('68: pools belong to Transport, not Client',()=>{
 const isolated=finalState(initialConfig);
 assert.equal(isolated.clients.length,3);assert.equal(isolated.pools.length,3);assert.equal(isolated.opened,3);assert.equal(isolated.reused,0);
 for(const strategy of ['shared','default'] as const){const s=finalState({...initialConfig,strategy});assert.equal(s.clients.length,3);assert.equal(s.pools.length,1);assert.equal(s.opened,1);assert.equal(s.reused,2);}
});
test('68: read, Close and server conditions govern eligibility',()=>{
 const config:Config={...initialConfig,strategy:'shared'};
 assert.equal(atStep(config,1).connections[0].status,'busy');
 assert.equal(atStep(config,2).connections[0].eof,true);
 assert.equal(atStep(config,2).connections[0].status,'busy');
 assert.equal(atStep(config,3).connections[0].status,'idle');
 assert.equal(atStep(config,4).opened,1);assert.equal(atStep(config,4).reused,1);
 for(const patch of [{drain:false},{keepAlive:false}]){const s=finalState({...config,...patch});assert.equal(s.opened,3);assert.equal(s.reused,0);assert.equal(s.connections.every(c=>c.status==='closed'),true);}
});
test('68: changing request count and replay preserve causality',()=>{
 const config:Config={...initialConfig,strategy:'default',requests:5};
 const previous=atStep(config,7);const copy=JSON.stringify(previous);
 assert.equal(finalState(config).reused,4);
 assert.equal(atStep(config,6).connections[0].status,'idle');assert.equal(atStep(config,7).connections[0].status,'busy');
 assert.equal(JSON.stringify(previous),copy);
 assert.deepEqual(atStep(config,0).connections,[]);assert.equal(atStep(config,0).opened,0);
 assert.equal(atStep(config,100).step,15);
});

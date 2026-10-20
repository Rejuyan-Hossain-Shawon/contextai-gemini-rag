import test from 'node:test';import assert from 'node:assert/strict';import {cosine,splitText} from '../src/ai.js';
test('cosine similarity',()=>{assert.ok(Math.abs(cosine([1,0],[1,0])-1)<1e-8);assert.equal(cosine([1,0],[0,1]),0);});
test('chunking preserves content',()=>{const chunks=splitText('hello world '.repeat(300),200,30);assert.ok(chunks.length>1);assert.ok(chunks.every(x=>x.length>0));});

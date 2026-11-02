/** Read-only verification of the historical local evaluation packet. No model calls. */
import {readFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'../..');
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const seal=JSON.parse(await readFile(join(root,'artifacts/shopping-capability-seal-20261101.json'),'utf8'));
for(const file of seal.files){
 const path=resolve(root,file.path),local=relative(root,path);
 assert.ok(local&&!local.startsWith('..')&&!isAbsolute(local),'Evidence path must stay inside checkout');
 const bytes=await readFile(path);
 assert.equal(bytes.length,file.bytes,`Changed evidence size: ${file.path}`);
 assert.equal(sha(bytes),file.sha256,`Changed evidence hash: ${file.path}`);
}
const assessment=JSON.parse(await readFile(join(root,'docs/SHOPPING-CAPABILITY-ASSESSMENT-2026-11-01.json'),'utf8'));
const expectedIds=new Set<string>();
for(const corpus of ['shopping-cases.json','shopping-transfer-cases.json']){
 const packet=JSON.parse(await readFile(join(import.meta.dirname,corpus),'utf8'));
 for(const item of packet.cases)for(const criterion of item.criteria)expectedIds.add(criterion.id);
}
for(const id of ['M01a','M01b','M01c','M01d'])expectedIds.add(id);
assert.equal(assessment.assessments.length,expectedIds.size);
assert.equal(new Set(assessment.assessments.map((a:any)=>a.id)).size,expectedIds.size);
let sourceReads=0;
for(const row of assessment.assessments){
 assert.ok(expectedIds.has(row.id),'Unexpected criterion');
 const path=resolve(root,row.source);
 assert.ok(!relative(root,path).startsWith('..'),'Source must stay in checkout');
 const bytes=await readFile(path);sourceReads++;
 assert.equal(sha(bytes),row.sha256);
 assert.equal(row.decision,'pass'); // verifies saved assessment, not an independent semantic judge
}
assert.equal(assessment.assessments.filter((r:any)=>r.decision==='pass').length,assessment.criteriaPassed);
assert.equal(assessment.liveRequests,62);
assert.equal(assessment.additionalFindings[0].id,'F01');
console.log(JSON.stringify({sealedFiles:seal.files.length,assessmentSourcesChecked:sourceReads,criteria:expectedIds.size,
 verdict:'Historical evidence and AI-label linkage intact; semantic judgments remain assistant-authored, not independent accuracy.'}));

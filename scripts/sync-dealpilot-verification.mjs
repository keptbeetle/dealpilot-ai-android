import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.argv[2]||resolve(root,'../dealpilot-ai'));
const destination=resolve(root,'runtime/vendor/dealpilot');
const files=['src/shared/product-identifiers.ts','src/shared/source-identity.ts','src/shared/purchase-cost.ts','src/api/source-freshness.ts'];
await mkdir(destination,{recursive:true});const manifest=[];
for(const file of files){
 const original=await readFile(resolve(source,file),'utf8');
 const adapted=original.replace(/^import type \{LiveOffer\} from '[^']+'/gm,"import type {LiveOffer} from './contracts.js'")
  .replace(/^import type \{RetailerInspection\} from '[^']+'/gm,"import type {RetailerInspection} from './contracts.js'")
  .replace("from './product-identifiers'","from './product-identifiers.js'").replace(/\r\n/g,'\n');
 const name=file.split('/').at(-1);await writeFile(resolve(destination,name),adapted);
 manifest.push({source:file,destination:name,sourceSha256:createHash('sha256').update(original).digest('hex'),adaptedSha256:createHash('sha256').update(adapted).digest('hex')});
}
await writeFile(resolve(destination,'SOURCE_MANIFEST.json'),JSON.stringify({source:'DealPilot owner workspace',adaptation:'Type-only import paths rewritten to mobile contracts; runtime verification logic unchanged.',modules:manifest},null,2)+'\n');
console.log('Synchronized '+files.length+' DealPilot verification modules without network access.');

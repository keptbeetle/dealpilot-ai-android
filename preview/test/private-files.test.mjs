import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {protectPrivatePath,assertPrivatePath} from '../private-files.mjs';
import {createVault} from '../vault.mjs';

const runFile=promisify(execFile);

test('private files reject widened access and support Unicode paths with spaces',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pocket private café '));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await protectPrivatePath(directory,true);
  await assertPrivatePath(directory,true);
  const file=join(directory,'secret.txt');
  await writeFile(file,'SYNTHETIC TEST DATA',{mode:0o600});
  await assertPrivatePath(file);
  if(process.platform==='win32')await runFile('icacls',[file,'/grant','*S-1-1-0:(R)'],{windowsHide:true});
  else await chmod(file,0o644);
  await assert.rejects(assertPrivatePath(file),/Private storage/);
  await protectPrivatePath(file);
  await assertPrivatePath(file);
});

test('concurrent vault creation publishes one complete shared key',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pocket-vault-concurrent-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const [first,second]=await Promise.all([createVault(directory),createVault(directory)]);
  await first.update(state=>{state.fixture={value:'first'};});
  assert.equal((await createVault(directory)).get('fixture').value,'first');
  await second.update(state=>{state.fixture={value:'second'};});
  assert.equal((await createVault(directory)).get('fixture').value,'second');
});

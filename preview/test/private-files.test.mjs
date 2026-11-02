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

test('Windows privacy repair changes only DACL, not file ownership',{skip:process.platform!=='win32'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pocket-dacl-only-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=join(directory,'private.txt');await writeFile(file,'SYNTHETIC DATA');
  await protectPrivatePath(file);
  // Deny WRITE_OWNER while retaining WRITE_DAC: replacing the DACL must work
  // without attempting to set even the already-correct owner again.
  await runFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    '$f=Get-Item -LiteralPath $env:POCKET_TEST_FILE; $a=$f.GetAccessControl(); $u=[Security.Principal.WindowsIdentity]::GetCurrent().User; $r=New-Object Security.AccessControl.FileSystemAccessRule($u,[Security.AccessControl.FileSystemRights]::TakeOwnership,[Security.AccessControl.AccessControlType]::Deny); $a.AddAccessRule($r); $f.SetAccessControl($a)'],
    {env:{...process.env,POCKET_TEST_FILE:file},windowsHide:true});
  await protectPrivatePath(file);await assertPrivatePath(file);
});

test('private files reject widened access and support Unicode paths with spaces',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pocket private café '));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await protectPrivatePath(directory,true);
  await assertPrivatePath(directory,true);
  const file=join(directory,'secret.txt');
  await writeFile(file,'SYNTHETIC TEST DATA',{mode:0o600});
  await protectPrivatePath(file);
  await assertPrivatePath(file);
  if(process.platform==='win32')await runFile('icacls',[file,'/grant','*S-1-1-0:(R)'],{windowsHide:true});
  else await chmod(file,0o644);
  await assert.rejects(assertPrivatePath(file),/Private storage/);
  await protectPrivatePath(file);
  await assertPrivatePath(file);
});

test('Windows creator-default group ownership is normalized only by Protect',{skip:process.platform!=='win32'},async t=>{
  const info=JSON.parse((await runFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','$u=[Security.Principal.WindowsIdentity]::GetCurrent(); @{user=$u.User.Value;defaultOwner=$u.Owner.Value}|ConvertTo-Json -Compress'],{windowsHide:true})).stdout);
  if(info.user===info.defaultOwner){t.skip('Standard-user token already creates self-owned files; elevated branch is exercised on hosted Windows.');return;}
  const directory=await mkdtemp(join(tmpdir(),'pocket-creator-owner-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await assert.rejects(assertPrivatePath(directory,true),/Private storage/);
  await protectPrivatePath(directory,true);await assertPrivatePath(directory,true);
  const owner=(await runFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','(Get-Acl -LiteralPath $env:POCKET_TEST_PATH).GetOwner([Security.Principal.SecurityIdentifier]).Value'],{windowsHide:true,env:{...process.env,POCKET_TEST_PATH:directory}})).stdout.trim();
  assert.equal(owner,info.user);
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

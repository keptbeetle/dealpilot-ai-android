import {chmod,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const runFile=promisify(execFile);
const windowsScript=fileURLToPath(new URL('../scripts/windows-private-path.ps1',import.meta.url));

async function windowsAccess(path,action){
  try {
    await runFile('powershell.exe',['-NoProfile','-NonInteractive','-File',windowsScript,'-Path',path,'-Action',action],{windowsHide:true,timeout:15000});
  } catch {
    throw Error('Private storage access protection could not be established or verified.');
  }
}

export async function protectPrivatePath(path,directory=false){
  const info=await lstat(path);
  if(info.isSymbolicLink()||(directory?!info.isDirectory():!info.isFile()))throw Error('Invalid private storage path.');
  if(process.platform==='win32')await windowsAccess(path,'Protect');
  else await chmod(path,directory?0o700:0o600);
}

export async function assertPrivatePath(path,directory=false){
  const info=await lstat(path);
  if(info.isSymbolicLink()||(directory?!info.isDirectory():!info.isFile()))throw Error('Invalid private storage path.');
  if(process.platform==='win32')await windowsAccess(path,'Check');
  else if(info.uid!==process.getuid()||(info.mode&0o077)!==0)throw Error('Private storage grants access to another user.');
}

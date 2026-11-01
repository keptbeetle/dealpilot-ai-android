/** Synthetic phone observations; never executes shell, browser or merchant actions. */
export class FixturePhone {
  trace:any[]=[];snapshots=0;messages:any[]=[];
  constructor(readonly screen:string){}
  call(method:string,value:any):any {
    if(method!=='tool')return {};
    this.trace.push(structuredClone(value));
    if(this.trace.length>24)throw Error('Fixture phone tool-call budget exhausted');
    const {name,args={}}=value;
    if(name==='phone_capabilities')return {available:true,operation_prefix:'20741-0123456789abcdef',
      accessibility:{enabled:true},virtual_display:{available:true,status:'idle'},shizuku:{available:false},
      fixture_note:'Controlled synthetic phone for an offline shopping decision benchmark; no live merchant session or payment exists.'};
    if(name==='phone_observe')return {snapshot_id:`fixture-${++this.snapshots}`,package_name:'com.android.chrome',window_id:1,
      display_id:100,coordinate_width:1080,coordinate_height:1920,nodes:[{resource_id:'fixture:catalogue',text:this.screen,role:'text',bounds:[0,0,1080,1800]}]};
    if(name==='phone_screen')return {status:args.action==='release'?'released':'acquired',display_id:100};
    if(name==='phone_open_url')return {status:'dispatched',fixture:true,url:args.url,note:'Synthetic navigation only. Observe for fixture content; no URL was fetched.'};
    if(name==='phone_act')return {isError:true,code:'FIXTURE_ACTION_NOT_EXECUTED',message:'This fixture has no interactive mutation implementation. No click, typing, cart or payment was executed.'};
    if(name==='phone_shell')return {isError:true,code:'NOT_READY',message:'Shizuku unavailable in this fixture. No shell command was executed. Use browser accessibility observations.'};
    if(name==='phone_operation')return {status:'unknown',fixture:true};
    if(name==='phone_apps')return {apps:[{package_name:'com.android.chrome',label:'Chrome'}]};
    return {isError:true,code:'FIXTURE_TOOL_UNAVAILABLE',message:'No implementation in the synthetic host; no action was executed.'};
  }
  ensureDisplay=async()=>({status:'acquired',display_id:100});
  releaseScreen=()=>({status:'released'});
  dropPriorImages=()=>{};
}

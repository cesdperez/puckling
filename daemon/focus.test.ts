import { expect, test } from "bun:test";
import { FocusController, terminalForAgent } from "./focus";
import { InputStream, type OpenInput } from "./input";
import { SessionModel, type Agent } from "./session";
const a:Agent={id:"a",state:"waiting",hostId:"local",worktreeId:"tree",paneKey:"tab:leaf"};
function fixture(query=async()=>[a],focus=async(_:Agent)=>{}) {
  const model=new SessionModel();let now=1000;model.update([a],now);const snapshot=model.snapshot(now);
  const receipts:string[]=[];
  const controller=new FocusController(model,query,focus,async()=>{receipts.push(model.snapshot(now).feedback);},()=>now);
  controller.offered(snapshot);
  const input:OpenInput={version:2,type:"input",event:"open",id:snapshot.sessions[0][0],seq:snapshot.seq,request:1};
  return {model,controller,input,receipts,time:(n:number)=>{now=n;}};
}
test("exact identity survives query reorder and changed priority",async()=>{
  const opened:string[]=[];const f=fixture(async()=>[{...a,id:"other",stateStartedAt:0},a],async t=>{opened.push(t.id);});
  expect(await f.controller.open(f.input)).toBe(true);expect(opened).toEqual(["a"]);expect(f.receipts).toEqual(["opening","opened"]);
  expect(f.model.snapshot(1000).sessions[0][6]).toBe(true);
});
test("removed targets cannot substitute another session",async()=>{
  let called=false;const f=fixture(async()=>[{...a,id:"other"}],async()=>{called=true;});
  expect(await f.controller.open(f.input)).toBe(false);expect(called).toBe(false);expect(f.receipts).toEqual(["opening","unavailable"]);
});
test("stale, disconnected, unoffered and unsupported targets fail explicitly",async()=>{
  for(const mode of ["stale","offline","unknown","sequence"]) {
    const f=fixture();if(mode==="stale")f.time(9001);if(mode==="offline")f.model.disconnect();
    if(mode==="unknown")f.input.id="1111111111111111";if(mode==="sequence")f.input.seq=1234;
    expect(await f.controller.open(f.input)).toBe(false);expect(f.receipts).toEqual(["unavailable"]);
  }
  const f=fixture(async()=>[{...a,hostId:"remote",paneKey:"structured-agent-session-session123:leaf"}]);
  expect(await f.controller.open(f.input)).toBe(false);expect(f.receipts.at(-1)).toBe("unsupported");
});
test("duplicates and concurrent requests cannot focus twice; failed receipts allow intentional retry",async()=>{
  let finish!:(rows:Agent[])=>void,opened=0;
  const f=fixture(()=>new Promise(r=>{finish=r;}),async()=>{opened++;});
  const pending=f.controller.open(f.input);await Bun.sleep(0);
  expect(await f.controller.open({...f.input,request:2})).toBe(false);finish([a]);expect(await pending).toBe(true);
  expect(await f.controller.open(f.input)).toBe(false);expect(opened).toBe(1);
  let tries=0;const retry=fixture(async()=>[a],async()=>{if(++tries===1)throw Error("private details");});
  expect(await retry.controller.open(retry.input)).toBe(false);expect(retry.receipts.at(-1)).toBe("retry");
  expect(await retry.controller.open({...retry.input,request:2})).toBe(true);
});
test("disconnect while revalidating prevents navigation",async()=>{
  let f:ReturnType<typeof fixture>;f=fixture(async()=>{f.model.disconnect();return [a];});
  expect(await f.controller.open(f.input)).toBe(false);expect(f.receipts.at(-1)).toBe("unavailable");
});
test("terminal matching requires exact host, workspace, tab, leaf and unique live handle",()=>{
  const t={handle:"term_right",executionHostId:"local",worktreeId:"tree",tabId:"tab",leafId:"leaf",connected:true,orphaned:false};
  expect(terminalForAgent(a,[{...t,leafId:"wrong"},{...t,executionHostId:"wrong"},{...t,orphaned:true},t])).toBe("term_right");
  expect(()=>terminalForAgent(a,[t,t])).toThrow();expect(()=>terminalForAgent(a,[])).toThrow();
});
test("input parser handles partial, malformed, oversized, extra and old version frames",()=>{
  const stream=new InputStream(),input=fixture().input,encode=(s:string)=>new TextEncoder().encode(s),line=JSON.stringify(input);
  expect(stream.feed(encode(line.slice(0,30)))).toEqual([]);expect(stream.feed(encode(line.slice(30)+"\r\n"))).toEqual([input]);
  for(const bad of ["garbage","x".repeat(300),line+"\0",JSON.stringify({...input,version:1}),JSON.stringify({...input,extra:1}),JSON.stringify({...input,request:-1}),JSON.stringify({...input,id:[]})])expect(stream.feed(encode(bad+"\n"))).toEqual([]);
  expect(stream.feed(encode(line+"\n"+line+"\n"))).toHaveLength(2);
});

test("browsing uses the complete daemon list and does not navigate Orca", async()=>{
  let navigated=false;const f=fixture(async()=>[a],async()=>{navigated=true;});
  expect(await f.controller.open({...f.input,event:"step",view:2,direction:1})).toBe(true);
  expect(f.receipts).toEqual(["selected"]);expect(navigated).toBe(false);
  const stream=new InputStream();expect(stream.feed(new TextEncoder().encode(JSON.stringify({...f.input,event:"step",view:2,direction:-1})+"\n"))).toHaveLength(1);
});
test("an older displayed event cannot acknowledge a newer question during revalidation", async()=>{
  let f:ReturnType<typeof fixture>;
  f=fixture(async()=>{const next={...a,stateStartedAt:2000};f.model.update([next],1000);return [next];});
  expect(await f.controller.open(f.input)).toBe(true);
  expect(f.model.snapshot(1000).sessions[0][6]).toBe(false);
});

"""Deterministic daemon -> PTY -> shared renderer/input validation; never uses live Orca."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

FIXTURE = r'''
import json, os, pathlib, sys
args=sys.argv[1:];mode=os.environ["PEBBLE_SCENARIO"]
log=pathlib.Path(os.environ["PEBBLE_FOCUS_LOG"])
if args==["terminal","list","--limit","10000","--json"]:
    terminals=[{"handle":"term_"+str(i),"executionHostId":"local","worktreeId":"tree" if i<3 else "other",
      "tabId":"tab"+str(i),"leafId":"leaf","connected":True,"orphaned":False} for i in range(5)]
    if mode=="unavailable-target":terminals=[]
    print(json.dumps({"ok":True,"result":{"truncated":False,"hostScope":{"omittedHostIds":[]},"terminals":terminals}}));sys.exit()
if args[:2]==["terminal","switch"]:
    with log.open('a') as f:f.write(args[3]+"\n")
    print(json.dumps({"ok":True,"result":{"focus":{"navigated":mode!="failed-focus"}}}));sys.exit()
assert args==["worktree","ps","--limit","10000","--json"]
if mode=="disconnected":sys.exit(1)
counter=pathlib.Path(os.environ["PEBBLE_COUNTER"])
poll=int(counter.read_text()) if counter.exists() else 0;counter.write_text(str(poll+1))
def agent(i,state,**extra):
    return {"paneKey":f"tab{i}:leaf","state":state,"stateStartedAt":1792600000000+i*100,"agentType":"claude" if i%2==0 else "codex",**extra}
rows=[agent(0,"waiting"),agent(1,"done",mainAgent={"outcome":"failure"}),agent(2,"working"),agent(3,"working",workingMode="monitoring")]
if mode in ["working","monitoring"]:rows=[agent(0,"working",workingMode="monitoring" if mode=="monitoring" else "productive",displayName="UI design")]
if mode=="finished":rows=[agent(0,"working" if poll==0 else "done",mainAgent={"outcome":"success"})]
if mode=="empty":rows=[]
if mode=="stable" and poll>0:rows.insert(0,agent(4,"waiting",stateStartedAt=1792500000000))
if mode=="removed" and poll>0:rows=rows[1:]
if mode=="long-labels":rows=[agent(0,"blocked",displayName="A very long Unicode title å with a secret prompt",prompt="MUST NEVER LEAVE ORCA")]
print(json.dumps({"ok":True,"result":{"worktrees":[
 {"hostId":"local","worktreeId":"tree","repo":"goodhabitz" if mode!="long-labels" else "extraordinarily-long-project-name","agents":[r for r in rows if int(r['paneKey'][3])<3]},
 {"hostId":"local","worktreeId":"other","repo":"puckling","agents":[r for r in rows if int(r['paneKey'][3])>=3]}],
 "truncated":False,"hostScope":{"omittedHostIds":[]}}}))
'''

def main():
    root=Path(__file__).resolve().parent.parent
    output=root/'sim/build/validation';output.mkdir(parents=True,exist_ok=True)
    # Samples are actual finger down/move/release events in the shared firmware UI.
    horizontal='0.7 1 330 280\n0.8 1 130 280\n0.9 0 130 280\n'
    vertical='1.1 1 233 300\n1.2 1 233 230\n1.3 0 233 230\n'
    scenarios=[
      ('home','home','',2.7,None),
      ('attention','home',horizontal,2.7,None),
      ('sessions','home',horizontal+'1.1 1 330 280\n1.2 1 130 280\n1.3 0 130 280\n',2.7,None),
      ('failed','home',horizontal+vertical,2.7,None),
      ('working','working',horizontal+horizontal.replace('0.7','1.1').replace('0.8','1.2').replace('0.9','1.3'),2.7,None),
      ('monitoring','monitoring',horizontal+horizontal.replace('0.7','1.1').replace('0.8','1.2').replace('0.9','1.3'),2.7,None),
      ('finished','finished',horizontal,2.7,None),
      ('empty','empty','',2.7,None),
      ('disconnected','disconnected','1 1 233 390\n1.1 0 233 390\n',2.7,None),
      ('opened','home','1 1 233 390\n1.1 0 233 390\n',2.7,'term_0'),
      ('failed-focus','failed-focus','1 1 233 390\n1.1 0 233 390\n',2.7,'term_0'),
      ('unavailable-target','unavailable-target','1 1 233 390\n1.1 0 233 390\n',2.7,None),
      ('stable-selection','stable','2.5 1 233 390\n2.6 0 233 390\n',3.3,'term_0'),
      ('removed','removed','2.5 1 233 390\n2.6 0 233 390\n',3.3,None),
      ('long-labels','long-labels',horizontal,2.7,None),
      ('drag-cancels-tap','home','1 1 233 390\n1.1 1 233 320\n1.2 1 233 390\n1.3 0 233 390\n',2.7,None),
    ]
    with tempfile.TemporaryDirectory(prefix='pebble-validation-') as tmp:
        tmp=Path(tmp);cli=tmp/'orca-fixture';cli.write_text(f'#!{sys.executable}\n'+FIXTURE);cli.chmod(0o700)
        for name,mode,script,duration,expected in scenarios:
            shot=output/(name+'.png');shot.unlink(missing_ok=True)
            events=tmp/(name+'.events');events.write_text(script);focus=tmp/(name+'.focus')
            process=subprocess.run([sys.executable,'sim/live.py','--screenshot',str(shot),'--capture-after',str(duration),'--script',str(events)],cwd=root,
              env={**os.environ,'ORCA_CLI_COMMAND':str(cli),'PEBBLE_SCENARIO':mode,'PEBBLE_COUNTER':str(tmp/(name+'.counter')),'PEBBLE_FOCUS_LOG':str(focus)},capture_output=True,text=True,timeout=20)
            logs=process.stdout+process.stderr;(output/(name+'.log')).write_text(logs)
            assert process.returncode==0,logs
            assert shot.exists() and shot.stat().st_size>1000
            assert 'snapshot seq=' in logs,logs
            if mode=='disconnected':assert 'connected=0' in logs
            if expected:assert focus.read_text()==expected+'\n',logs
            else:assert not focus.exists(),f'Unexpected focus: {name}'
            if name=='opened':assert 'feedback=2' in logs
            if name in ['failed-focus','unavailable-target']:assert 'feedback=3' in logs
            if name in ['attention','failed','finished','long-labels']:assert 'page=1' in logs
            if name in ['sessions','working','monitoring']:assert 'page=2' in logs
            assert 'MUST NEVER LEAVE ORCA' not in logs
            print(f'PASS {name}: {shot.relative_to(root)}',flush=True)

if __name__=='__main__':main()

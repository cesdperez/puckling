"""Deterministic daemon -> PTY -> shared renderer/input validation; never uses live Orca."""
import os
import json
import pty
import tty
import select
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
if mode=="many":rows=[agent(i,"waiting",stateStartedAt=i) for i in range(40)]
if mode=="unsupported":rows=[agent(0,"waiting",paneKey="structured-agent-session-codex_12345678:leaf")]

if mode=="stable" and poll>0:rows.insert(0,agent(4,"waiting",stateStartedAt=1792500000000))
if mode=="removed" and poll>0:rows=rows[1:]
if mode=="long-labels":rows=[agent(0,"blocked",displayName="A very long Unicode title å with a secret prompt",prompt="MUST NEVER LEAVE ORCA")]
print(json.dumps({"ok":True,"result":{"worktrees":[
 {"hostId":"remote" if mode=="unsupported" else "local","worktreeId":"tree","repo":"goodhabitz" if mode!="long-labels" else "extraordinarily-long-project-name","agents":[r for r in rows if (mode in ["many","unsupported"] or int(r['paneKey'][3])<3)]},
 {"hostId":"local","worktreeId":"other","repo":"puckling","agents":[r for r in rows if (mode not in ["many","unsupported"] and int(r['paneKey'][3])>=3)]}],
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
      ('unsupported','unsupported',horizontal+'1.3 1 233 390\n1.4 0 233 390\n',2.7,None),
      ('all-clear','working','',2.7,None),
      ('retry-opened','failed-focus','1 1 233 390\n1.1 0 233 390\n2.1 1 233 390\n2.2 0 233 390\n',3.0,'term_0\nterm_0'),
      ('seen-request','home',horizontal+'1.3 1 233 390\n1.4 0 233 390\n',2.7,'term_0'),
      ('next-request','home','1 1 233 390\n1.1 0 233 390\n2.8 1 233 390\n2.9 0 233 390\n',3.5,'term_0'),

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
    many=horizontal
    for i in range(35):
        at=1.2+i*0.22
        many+=f'{at:.3f} 1 233 300\n{at+0.035:.3f} 1 233 230\n{at+0.07:.3f} 0 233 230\n'
    scenarios.append(('bounded-window','many',many,9.5,None))
    with tempfile.TemporaryDirectory(prefix='pebble-validation-') as tmp:
        tmp=Path(tmp);cli=tmp/'orca-fixture';cli.write_text(f'#!{sys.executable}\n'+FIXTURE);cli.chmod(0o700)
        for name,mode,script,duration,expected in scenarios:
            shot=output/(name+'.png');shot.unlink(missing_ok=True)
            events=tmp/(name+'.events');events.write_text(script);focus=tmp/(name+'.focus')
            process=subprocess.Popen([sys.executable,'sim/live.py','--screenshot',str(shot),'--capture-after',str(duration),'--script',str(events)],cwd=root,
              env={**os.environ,'ORCA_CLI_COMMAND':str(cli),'PEBBLE_SCENARIO':mode,'PEBBLE_COUNTER':str(tmp/(name+'.counter')),'PEBBLE_FOCUS_LOG':str(focus)},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            try:
                stdout,stderr=process.communicate(timeout=20)
            except (subprocess.TimeoutExpired,KeyboardInterrupt):
                process.terminate();process.communicate(timeout=5);raise
            logs=stdout+stderr;(output/(name+'.log')).write_text(logs)
            assert process.returncode==0,logs
            assert shot.exists() and shot.stat().st_size>1000
            assert 'snapshot seq=' in logs,logs
            if mode=='disconnected':assert 'connected=0' in logs
            if expected:assert focus.read_text()==expected+'\n',logs
            else:assert not focus.exists(),f'Unexpected focus: {name}'
            if name=='opened':assert 'feedback=2' in logs
            if name in ['failed-focus','retry-opened']:assert 'feedback=3' in logs
            if name=='unavailable-target':assert 'feedback=4' in logs
            if name=='next-request':assert 'feedback=6' in logs
            if name in ['attention','failed','finished','long-labels']:assert 'page=1' in logs
            if name in ['sessions','working','monitoring']:assert 'page=2' in logs
            assert 'MUST NEVER LEAVE ORCA' not in logs
            if name=='bounded-window':
                assert logs.count('input action=step')==35,logs
                assert 'position=36' in logs,logs
            for scenario,state in [('working','Working'),('monitoring','Monitoring'),('failed','Failed'),('finished','Finished'),('next-request','Failed')]:
                if name==scenario:assert f'state={state}' in logs,logs
            if name=='unsupported':assert 'feedback=5' in logs,logs
            if name=='seen-request':assert 'position=2' in logs,logs
            print(f'PASS {name}: {shot.relative_to(root)}',flush=True)
    master,slave=pty.openpty()
    try:
        tty.setraw(slave)
        snapshot={'version':2,'type':'state','seq':1,'connected':True,'age':0,'total':1,'attention':1,'working':0,'monitoring':0,'cue':1,'request':0,'target':'','feedback':'none',
          'sessions':[['1111111111111111','goodhabitz','Session stale','claude',0,True,False,True,'Waiting for your input',1]]}
        os.write(master,(json.dumps(snapshot)+'\n').encode())
        process=subprocess.run([str(root/'sim/build/puckling-sim'),'--link',os.ttyname(slave),'--screenshot',str(output/'stale.png'),'--capture-after','9.5','--tap-after','9.1'],cwd=root,capture_output=True,text=True,timeout=20)
        logs=process.stdout+process.stderr;(output/'stale.log').write_text(logs)
        assert process.returncode==0,logs
        assert 'input action=open' not in logs
        assert 'source=link stale' in logs,logs
        assert not select.select([master],[],[],0)[0], 'Stale renderer sent input'
        print('PASS stale: sim/build/validation/stale.png',flush=True)
    finally:
        os.close(master);os.close(slave)


if __name__=='__main__':main()

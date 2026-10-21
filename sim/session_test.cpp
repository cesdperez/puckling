#include <assert.h>
#include <string>
#include "session.h"
#include "fixture.h"
static bool feed(StateStream &s,const std::string &line,SessionSnapshot &out){bool ok=false;for(char c:line)ok=s.feed(c,out)||ok;return ok;}
int main(){
  StateStream stream;SessionSnapshot s;
  std::string valid=frame(cardJSON());
  assert(!feed(stream,valid.substr(0,55),s));assert(feed(stream,valid.substr(55),s));
  assert(s.count==1&&s.sessions[0].state==SessionState::Input&&s.seq==1);
  for(auto bad:{frame(cardJSON(),",\"seq\":2"),frame(cardJSON(),",\"extra\":0"),frame(cardJSON("wrong")),
    frame(cardJSON()+","+cardJSON()),frame(cardJSON("1111111111111111",8)),valid+"garbage\n",std::string(MAX_STATE_LINE+1,'x')+"\n",std::string("{}\0",3)+"\n"}) {
    if(bad==valid+"garbage\n")bad=valid.substr(0,valid.size()-1)+"garbage\n";
    assert(!feed(stream,bad,s));assert(s.count==1&&s.seq==1);
  }
  for(const auto &pair:{std::pair<std::string,std::string>{"\"version\":2","\"version\":1"},{"\"connected\":true","\"connected\":1"},{"\"seq\":1","\"seq\":01"},{"\"age\":0","\"age\":2147483648"},{"\"type\":\"state\"","\"type\":\"input\""}}){
    auto bad=valid;bad.replace(bad.find(pair.first),pair.first.size(),pair.second);assert(!feed(stream,bad,s));
  }
  std::string cards;for(int i=0;i<32;i++){char id[17];snprintf(id,sizeof(id),"%016x",i);if(i)cards+=",";cards+=cardJSON(id,i%8);}
  assert(feed(stream,frame(cards),s));assert(s.count==32);assert(!feed(stream,frame(cards+","+cardJSON("ffffffffffffffff")),s));
  SessionReceiver receiver;auto receive=[&](std::string line,uint32_t now){for(char c:line)receiver.feed(c,now);};
  assert(!receiver.canFocus(0));receive(valid,100);assert(receiver.canFocus(8100));assert(!receiver.canFocus(8101));
  receive("bad\n",8101);assert(!receiver.canFocus(8101));
  auto delayed=valid;delayed.replace(delayed.find("\"age\":0"),7,"\"age\":7000");receive(delayed,10000);assert(receiver.canFocus(11000));assert(!receiver.canFocus(11001));
  receive(valid,UINT32_MAX-100);assert(receiver.canFocus(100));assert(!receiver.canFocus(8000));
  char message[256];assert(openMessage(message,sizeof(message),"1111111111111111",1,1)>0);assert(!openMessage(message,10,"1111111111111111",1,1));assert(!openMessage(message,sizeof(message),"untrusted",1,1));
}

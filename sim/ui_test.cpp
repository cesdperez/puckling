#include <assert.h>
#include <string.h>
#include <string>
#include <stdlib.h>
#include "ui.h"
#include "fixture.h"
int main(){
  CompanionUI ui;auto s=sampleSnapshot();char msg[256];uint32_t now=100;
  auto update=[&](){ui.update(s,true,0,now);};update();assert(!strcmp(ui.selectedId(),s.sessions[0].id));
  auto touch=[&](bool down,int x,int y){now+=30;return ui.touch({down,int16_t(x),int16_t(y)},now,msg,sizeof(msg));};
  auto swipe=[&](int x,int y,int xx,int yy){
    touch(true,x,y);touch(true,xx,yy);bool sent=touch(false,xx,yy);
    if(sent){
      assert(std::string(msg).find("step")!=std::string::npos);
      auto at=std::string(msg).find("\"request\":");s.request=atoi(msg+at+10);s.feedback=Feedback::Selected;
      strcpy(s.target,s.sessions[s.count-1].id);update();
    }
  };
  touch(true,233,390);std::swap(s.sessions[0],s.sessions[1]);s.seq++;update();
  assert(touch(false,233,390));assert(std::string(msg).find("1111111111111111")!=std::string::npos);assert(std::string(msg).find("\"seq\":1")!=std::string::npos);
  s.request=1;s.feedback=Feedback::Opened;strcpy(s.target,"1111111111111111");update();
  assert(!touch(false,233,390));
  // Incoming priority changes preserve selection, and disappearance leaves a tombstone.
  strcpy(s.sessions[1].id,"3333333333333333");s.feedback=Feedback::Unavailable;update();assert(ui.unavailable());touch(true,233,390);assert(!touch(false,233,390));
  swipe(233,300,233,230);assert(!ui.unavailable());
  swipe(330,280,130,280);assert(ui.pageIndex()==1);
  swipe(330,280,130,280);assert(ui.pageIndex()==2);
  swipe(233,300,233,230);assert(!strcmp(ui.selectedId(),"3333333333333333"));
  // Any substantial excursion cancels a tap, even if the finger returns to the pill.
  touch(true,233,390);touch(true,233,330);touch(true,233,390);assert(!touch(false,233,390));
  touch(true,233,390);touch(true,250,390);assert(!touch(false,250,390));
  ui.update(s,false,8001,now);touch(true,233,390);assert(!touch(false,233,390));
  update();touch(true,233,390);s.count=0;s.total=0;s.attention=0;update();assert(!touch(false,233,390));
  CompanionUI offline;
  auto empty=SessionSnapshot{};empty.seq=1;empty.age=2147483647;
  offline.update(empty,false,2147483647,now);
  assert(!offline.touch({true,233,390},now,msg,sizeof(msg)));
  assert(!offline.touch({false,233,390},now+50,msg,sizeof(msg)));
  assert(offline.pageIndex()==0);
  // Exercise actual shared rendering, including every state and empty/offline frames.
  Arduino_GFX gfx(466,466);
  for(int state=0;state<8;state++){s=sampleSnapshot();s.sessions[0].state=SessionState(state);ui.update(s,true,0,now);ui.draw(&gfx,now);}
  s.count=0;s.total=0;ui.update(s,false,10000,now);ui.draw(&gfx,now);
}

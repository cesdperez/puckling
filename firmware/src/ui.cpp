#include "ui.h"
#include "sprites.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

namespace {
constexpr uint16_t WHITE=0xff9c, MUTED=0x8cb2, GRAPHITE=0x18e4, AMBER=0xfdad, CORAL=0xfb8d, MINT=0x8ef6, BLUE=0x9dbb;
const char *glyphs="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .:/-!?+";
const uint8_t FONT[][7]={
 {14,17,17,31,17,17,17},{30,17,17,30,17,17,30},{14,17,16,16,16,17,14},{30,17,17,17,17,17,30},
 {31,16,16,30,16,16,31},{31,16,16,30,16,16,16},{14,17,16,23,17,17,15},{17,17,17,31,17,17,17},
 {14,4,4,4,4,4,14},{7,2,2,2,18,18,12},{17,18,20,24,20,18,17},{16,16,16,16,16,16,31},
 {17,27,21,21,17,17,17},{17,25,21,19,17,17,17},{14,17,17,17,17,17,14},{30,17,17,30,16,16,16},
 {14,17,17,17,21,18,13},{30,17,17,30,20,18,17},{15,16,16,14,1,1,30},{31,4,4,4,4,4,4},
 {17,17,17,17,17,17,14},{17,17,17,17,17,10,4},{17,17,17,21,21,21,10},{17,17,10,4,10,17,17},
 {17,17,10,4,4,4,4},{31,1,2,4,8,16,31},
 {14,17,19,21,25,17,14},{4,12,4,4,4,4,14},{14,17,1,2,4,8,31},{30,1,1,14,1,1,30},
 {2,6,10,18,31,2,2},{31,16,16,30,1,1,30},{14,16,16,30,17,17,14},{31,1,2,4,8,8,8},
 {14,17,17,14,17,17,14},{14,17,17,15,1,1,14},
 {0,0,0,0,0,0,0},{0,0,0,0,0,6,6},{0,6,6,0,6,6,0},{1,2,2,4,8,8,16},
 {0,0,0,31,0,0,0},{4,4,4,4,4,0,4},{14,17,1,2,4,0,4},{0,4,4,31,4,4,0}
};
void text(Arduino_GFX *g,const char *s,int y,int scale,uint16_t color,int center=233) {
  char fitted[64];
  int edgeY=y+7*scale;int dy=abs(edgeY-233)>abs(y-233)?abs(edgeY-233):abs(y-233);
  int half=dy<228?int(sqrtf(228*228-dy*dy)):0;
  int width=2*(half-abs(center-233));
  int capacity=(width/scale+1)/6;
  if(capacity<0)capacity=0;if(capacity>63)capacity=63;
  if(int(strlen(s))>capacity){strncpy(fitted,s,capacity);fitted[capacity]=0;if(capacity>2){fitted[capacity-1]='.';fitted[capacity-2]='.';}s=fitted;}
  int x=center-(int(strlen(s))*6-1)*scale/2;
  for(;*s;s++,x+=6*scale){ char ch=*s; if(ch>='a'&&ch<='z')ch-=32;
    const char *p=strchr(glyphs,ch);if(!p)continue;int n=p-glyphs;
    for(int r=0;r<7;r++)for(int c=0;c<5;c++)if(FONT[n][r]&(16>>c))g->fillRect(x+c*scale,y+r*scale,scale,scale,color);
  }
}
uint16_t color(SessionState s){return s==SessionState::Input||s==SessionState::Attention?AMBER:s==SessionState::Failed?CORAL:s==SessionState::Finished?MINT:BLUE;}
void icon(Arduino_GFX *g,SessionState s,int x,int y,uint16_t c){
  if(s==SessionState::Input||s==SessionState::Attention){g->drawRoundRect(x,y,24,18,5,c);g->fillTriangle(x+4,y+17,x+4,y+24,x+11,y+17,c);}
  else if(s==SessionState::Monitoring){for(int i=0;i<3;i++)g->fillRect(x+i*8,y+16-i*6,5,8+i*6,c);}
  else {g->drawCircle(x+12,y+12,12,c);if(s==SessionState::Failed){g->fillRect(x+11,y+5,3,10,c);g->fillRect(x+11,y+18,3,3,c);}
    else if(s==SessionState::Finished){g->drawLine(x+5,y+12,x+10,y+17,c);g->drawLine(x+10,y+17,x+20,y+7,c);}
    else {g->fillRect(x+10,y+5,4,14,c);g->fillRect(x+5,y+10,14,4,c);}}
}
void pebble(Arduino_GFX *g,SessionState state,uint32_t now,bool calm){
  int pose=state==SessionState::Working?1:state==SessionState::Input||state==SessionState::Attention?2:state==SessionState::Failed?4:state==SessionState::Finished?3:0;
  const uint16_t palette[]={0,0x1082,0x2126,0x39e9,0x52ac,0xff5a,0xd655,0x0021,0xffbd};
  int drift=(now/900)%4==0?0:(now/900)%4==2?0:((now/900)%4==1?4:-4);
  int y0=112+drift;
  for(int y=0;y<44;y++)for(int x=0;x<64;x++) {
    int n=PEBBLE[pose][y][x]-'0';if(!n)continue;
    if((now%4700)>4530 && x>=45&&x<=47&&y>=24&&y<=28 && pose!=1)n=y==27?7:2;
    g->fillRect(105+x*4,y0+y*4,4,4,palette[n]);
  }
  if(calm && state==SessionState::Finished && now%8000<1200) {g->fillRect(370,160,4,12,MINT);g->fillRect(366,164,12,4,MINT);}
}
}
int CompanionUI::index()const {for(int i=0;i<state.count;i++)if(!strcmp(selected[page],state.sessions[i].id) && eligible(i))return i;return -1;}
bool CompanionUI::eligible(int i)const{return page==2 || state.sessions[i].attention;}
bool CompanionUI::unavailable()const{return selected[page][0]&&index()<0 && !(page==0&&state.attention==0);}
void CompanionUI::selectInitial(){if(selected[page][0])return;for(int i=0;i<state.count;i++)if(eligible(i)){strcpy(selected[page],state.sessions[i].id);return;}}
void CompanionUI::update(const SessionSnapshot &snapshot,bool fresh,uint32_t sourceAge,uint32_t now){
  state=snapshot;live=fresh&&state.connected;age=sourceAge;lastUpdate=now;
  if(live && state.cue!=lastCue){lastCue=state.cue;cueUntil=now+900;}
  if(!down)selectInitial();
  if(!down && pendingView>=0 && state.request==request && state.feedback==Feedback::Selected){
    strcpy(selected[pendingView],state.target);pendingView=-1;feedback=Feedback::None;
  }
  if(request && state.request==request && !strcmp(state.target,pressedId) && state.feedback!=Feedback::None && state.feedback!=Feedback::Selected)feedback=state.feedback;
  if(feedback==Feedback::Opening && now-pendingSince>12000)feedback=Feedback::Retry;
}
bool CompanionUI::step(int direction,char *message,size_t size){
  if(!live || pendingView>=0 || feedback==Feedback::Opening)return false;
  request=request==2147483647?1:request+1;pendingView=page;
  return stepMessage(message,size,selected[page],state.seq,request,page,direction)>0;
}
bool CompanionUI::touch(TouchSample sample,uint32_t now,char *message,size_t size){
  if(sample.down){
    if(!down){down=true;dragged=false;maxTravel=0;startX=sample.x;startY=sample.y;pressAt=now;pressedSeq=state.seq;strcpy(pressedId,selected[page]);}
    int dx=abs(sample.x-startX),dy=abs(sample.y-startY);if(dx>maxTravel)maxTravel=dx;if(dy>maxTravel)maxTravel=dy;
    if(maxTravel>16)dragged=true;
    lastInteraction=now;return false;
  }
  if(!down)return false;down=false;lastInteraction=now;
  int dx=sample.x-startX,dy=sample.y-startY;
  if(dragged){
    if(abs(dx)>=48 && abs(dx)>abs(dy)*1.25f){page=(page+(dx<0?1:2))%3;feedback=Feedback::None;selectInitial();}
    else if(abs(dy)>=40 && abs(dy)>abs(dx)*1.25f)return step(dy<0?1:-1,message,size);
    return false;
  }
  if(now-pressAt>700)return false;
  if(startY>=196&&startY<=256){if(startX>=30&&startX<=90)return step(-1,message,size);else if(startX>=376&&startX<=436)return step(1,message,size);return false;}
  if(startY<366||startY>418||startX<104||startX>362)return false;
  if(page==0&&(!state.attention||!selected[page][0])){page=2;selectInitial();return false;}
  if(!live || pendingView>=0 || now-lastUpdate+age>8000 || feedback==Feedback::Opening || strcmp(pressedId,selected[page]))return false;
  if(page==0 && feedback==Feedback::Opened){
    for(int j=0;j<state.count;j++)if(state.sessions[j].attention&&!state.sessions[j].seen&&strcmp(state.sessions[j].id,selected[page])){
      return step(1,message,size);
    }
  }
  int i=index();if(i<0){feedback=Feedback::Unavailable;return false;}
  if(!state.sessions[i].supported){feedback=Feedback::Unsupported;return false;}
  pendingView=-1;request=request==2147483647?1:request+1;feedback=Feedback::Opening;pendingSince=now;
  return openMessage(message,size,pressedId,pressedSeq,request)>0;
}
void CompanionUI::draw(Arduino_GFX *g,uint32_t now)const{
  g->fillScreen(0);
  int i=index();const SessionCard *c=i>=0?&state.sessions[i]:nullptr;
  if(page==0&&!state.attention)c=nullptr;
  bool connected=live && now-lastUpdate+age<=8000;
  const char *heading=page==0?"ORCA / PEBBLE":page==1?"ATTENTION":"SESSIONS";
  text(g,heading,37,2,MUTED);
  if(now<cueUntil)g->fillCircle(233,61,3,AMBER);
  SessionState pose=c?c->state:SessionState::Unknown;
  char line[64];
  if(!connected){text(g,state.seq?"Connection lost":"Status unknown",72,2,AMBER);pose=SessionState::Unknown;}
  else if(page==0){
    if(state.attention)snprintf(line,sizeof(line),"%d need attention",state.attention);else strcpy(line,"All clear");
    text(g,line,72,3,state.attention?AMBER:WHITE);
  }else if(c){
    const char *label=sessionName(c->state);int w=(int(strlen(label))*6-1)*3;
    icon(g,c->state,233-w/2-34,70,color(c->state));text(g,label,74,3,color(c->state),247);
  }else text(g,unavailable()?"Session unavailable":page==1?"All clear":"No sessions",76,2,WHITE);
  pebble(g,pose,now,connected);
  int eligibleCount=0,position=0;
  for(int j=0;j<state.count;j++)if(eligible(j)){eligibleCount++;if(i==j)position=eligibleCount;}
  if((page==2?state.total:state.attention)>1||unavailable()){
    g->fillRoundRect(32,198,56,56,28,GRAPHITE);g->fillRoundRect(378,198,56,56,28,GRAPHITE);
    text(g,"<",216,3,WHITE,60);text(g,">",216,3,WHITE,406);
    g->drawLine(65,214,55,226,WHITE);g->drawLine(55,226,65,238,WHITE);
    g->drawLine(401,214,411,226,WHITE);g->drawLine(411,226,401,238,WHITE);
  }
  if(!connected){
    if(state.seq)snprintf(line,sizeof(line),"Last update %lus ago",(unsigned long)((uint64_t(age)+now-lastUpdate)/1000));
    else strcpy(line,"No status received yet");
    text(g,line,300,2,MUTED);text(g,"Reconnect Orca to open",330,2,MUTED);
  }else if(unavailable()){text(g,"Session unavailable",302,2,WHITE);text(g,"Swipe to choose another",330,2,MUTED);}
  else if(c){
    if(page==0){snprintf(line,sizeof(line),"%d working / %d monitoring",state.working,state.monitoring);text(g,line,284,2,MUTED);}
    text(g,c->project,page==0?309:291,3,WHITE);
    snprintf(line,sizeof(line),"%s / %s",c->label,c->agent);text(g,line,page==0?337:320,2,MUTED);
    if(page!=0)text(g,c->seen?"Seen / still needs you":c->reason,344,2,c->seen?AMBER:MUTED);
  }else{
    if(page==0){snprintf(line,sizeof(line),"%d working / %d monitoring",state.working,state.monitoring);text(g,line,287,2,MUTED);}
    text(g,state.total?"Browse active and recent":"No active or recent sessions",314,2,MUTED);text(g,"Swipe left to explore",340,2,MUTED);
  }
  const char *action="Open in Orca";
  if(feedback==Feedback::Opening)action="Opening...";
  else if(feedback==Feedback::Opened){
    action="Opened";
    if(page==0&&now-pendingSince>1500)for(int j=0;j<state.count;j++)if(state.sessions[j].attention&&!state.sessions[j].seen&&strcmp(state.sessions[j].id,selected[page]))action="Next request";
  }
  else if(feedback==Feedback::Retry)action="Retry open";
  else if(feedback==Feedback::Unavailable)action="Target unavailable";
  else if(feedback==Feedback::Unsupported || (c&&!c->supported))action="Unsupported target";
  else if(!connected)action="Offline";
  else if(unavailable())action="Choose another";
  else if(!c)action=page==0?"Browse sessions":page==1?"No requests":"No sessions";
  bool enabled=connected&&!unavailable()&&(c?c->supported:page==0);
  g->fillRoundRect(104,366,258,52,26,enabled?WHITE:GRAPHITE);text(g,action,385,2,enabled?0:MUTED);
  if(page!=0 && eligibleCount){position=c?c->position:0;snprintf(line,sizeof(line),"%d / %d",position,page==1?state.attention:state.total);text(g,line,426,2,MUTED);}
  if(state.total>state.count && page==0){snprintf(line,sizeof(line),"Showing %d of %d",state.count,state.total);text(g,line,426,2,MUTED);}
  for(int dot=0;dot<3;dot++)g->fillCircle(209+dot*24,449,4,dot==page?WHITE:GRAPHITE);
}

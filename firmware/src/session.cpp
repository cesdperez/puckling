#include "session.h"
#include <string_view>
#include <string.h>
#include <stdio.h>
#include <limits.h>
namespace {
class Fields {
 public:
  explicit Fields(std::string_view text): text(text) {}
  bool take(char c) { space(); if (text.empty() || text.front() != c) return false; text.remove_prefix(1); return true; }
  bool literal(std::string_view v) { space(); if (text.substr(0, v.size()) != v) return false; text.remove_prefix(v.size()); return true; }
  bool string(char *out, size_t size) {
    if (!take('"')) return false;
    size_t n = text.find('"');
    if (n == std::string_view::npos || n >= size) return false;
    for (unsigned char c: text.substr(0,n)) if (c < 32 || c > 126 || c == '\\') return false;
    memcpy(out,text.data(),n); out[n]=0; text.remove_prefix(n+1); return true;
  }
  bool number(uint32_t &out) {
    space(); if (text.empty() || text.front() < '0' || text.front() > '9') return false;
    out=0; bool zero=text.front()=='0'; int n=0;
    while (!text.empty() && text.front()>='0' && text.front()<='9') {
      if ((zero && n) || out > (uint32_t(INT_MAX) - (text.front()-'0'))/10) return false;
      out=out*10+text.front()-'0'; text.remove_prefix(1); n++;
    }
    return true;
  }
  bool boolean(bool &out) { if (literal("true")) {out=true;return true;} if(literal("false")){out=false;return true;} return false; }
  bool ended() {space();return text.empty();}
 private:
  std::string_view text;
  void space() {while(!text.empty() && (text.front()==' ' || text.front()=='\t' || text.front()=='\r')) text.remove_prefix(1);}
};
bool token(const char *id) {
  if(strlen(id)!=16) return false;
  for(int i=0;i<16;i++) if(!((id[i]>='a' && id[i]<='f') || (id[i]>='0' && id[i]<='9'))) return false;
  return true;
}
bool card(Fields &f, SessionCard &c) {
  uint32_t state;
  return f.take('[') && f.string(c.id,sizeof(c.id)) && token(c.id) && f.take(',') &&
    f.string(c.project,sizeof(c.project)) && f.take(',') && f.string(c.label,sizeof(c.label)) && f.take(',') &&
    f.string(c.agent,sizeof(c.agent)) && f.take(',') && f.number(state) && state<=7 &&
    (c.state=SessionState(state),true) && f.take(',') && f.boolean(c.attention) && f.take(',') &&
    f.boolean(c.seen) && f.take(',') && f.boolean(c.supported) && f.take(',') &&
    f.string(c.reason,sizeof(c.reason)) && f.take(',') && f.number(c.position) && c.position>0 && f.take(']');
}
bool parse(std::string_view line, SessionSnapshot &next) {
  Fields f(line); uint32_t seen=0;
  if(!f.take('{'))return false;
  do {
    char key[16], value[20]; uint32_t n, bit;
    if(!f.string(key,sizeof(key)) || !f.take(':'))return false;
    if(!strcmp(key,"version")){bit=1; if(!f.number(n)||n!=2)return false;}
    else if(!strcmp(key,"type")){bit=2;if(!f.string(value,sizeof(value))||strcmp(value,"state"))return false;}
    else if(!strcmp(key,"seq")){bit=4;if(!f.number(next.seq)||!next.seq)return false;}
    else if(!strcmp(key,"connected")){bit=8;if(!f.boolean(next.connected))return false;}
    else if(!strcmp(key,"age")){bit=16;if(!f.number(next.age))return false;}
    else if(!strcmp(key,"total")){bit=32;if(!f.number(n))return false;next.total=n;}
    else if(!strcmp(key,"attention")){bit=64;if(!f.number(n))return false;next.attention=n;}
    else if(!strcmp(key,"working")){bit=128;if(!f.number(n))return false;next.working=n;}
    else if(!strcmp(key,"monitoring")){bit=256;if(!f.number(n))return false;next.monitoring=n;}
    else if(!strcmp(key,"cue")){bit=512;if(!f.number(next.cue))return false;}
    else if(!strcmp(key,"request")){bit=1024;if(!f.number(next.request))return false;}
    else if(!strcmp(key,"target")){bit=2048;if(!f.string(next.target,sizeof(next.target)) || (next.target[0]&&!token(next.target)))return false;}
    else if(!strcmp(key,"feedback")){
      bit=4096;if(!f.string(value,sizeof(value)))return false;
      const char *names[]={"none","opening","opened","retry","unavailable","unsupported","selected"};int i=0;
      for(;i<7;i++)if(!strcmp(value,names[i]))break;
      if(i==7)return false;next.feedback=Feedback(i);
    } else if(!strcmp(key,"sessions")){
      bit=8192;if(!f.take('['))return false;
      if(!f.take(']')) {
        do {if(next.count==MAX_SESSIONS||!card(f,next.sessions[next.count]))return false;
          for(int i=0;i<next.count;i++)if(!strcmp(next.sessions[i].id,next.sessions[next.count].id))return false;
          next.count++;
        }while(f.take(','));
        if(!f.take(']'))return false;
      }
    } else return false;
    if(seen&bit)return false;seen|=bit;
  }while(f.take(','));
  return seen==16383 && f.take('}') && f.ended() && next.total>=next.count && next.attention<=next.total;
}
}
bool StateStream::feed(char byte,SessionSnapshot &snapshot) {
  if(byte=='\n') {
    // Parse atomically: a rejected line must never modify the displayed identity.
    SessionSnapshot next;
    bool ok=!discarded && parse(std::string_view(line,length),next);
    length=0;discarded=false;
    if(ok)snapshot=next;
    return ok;
  }
  if(length==MAX_STATE_LINE || byte==0 || (unsigned char)byte>127)discarded=true;
  if(!discarded)line[length++]=byte;
  return false;
}
bool SessionReceiver::feed(char byte,uint32_t now) {
  if(!stream.feed(byte,current))return false;
  received=true;lastReceived=now;return true;
}
uint32_t SessionReceiver::age(uint32_t now)const {
  uint32_t elapsed=now-lastReceived;
  return current.age>UINT32_MAX-elapsed?UINT32_MAX:current.age+elapsed;
}
const char *sessionName(SessionState state) {
  const char *names[]={"Needs input","Needs attention","Failed","Finished","Working","Monitoring","Ended","Finished"};
  return names[int(state)];
}
int openMessage(char *buffer,size_t size,const char *id,uint32_t seq,uint32_t request) {
  if(!token(id))return 0;
  int n=snprintf(buffer,size,"{\"version\":2,\"type\":\"input\",\"event\":\"open\",\"id\":\"%s\",\"seq\":%lu,\"request\":%lu}\n",id,(unsigned long)seq,(unsigned long)request);
  return n>0 && size_t(n)<size?n:0;
}

int stepMessage(char *buffer,size_t size,const char *id,uint32_t seq,uint32_t request,int view,int direction) {
  int n=snprintf(buffer,size,"{\"version\":2,\"type\":\"input\",\"event\":\"step\",\"id\":\"%s\",\"seq\":%lu,\"request\":%lu,\"view\":%d,\"direction\":%d}\n",id,(unsigned long)seq,(unsigned long)request,view,direction);
  return n>0&&size_t(n)<size?n:0;
}

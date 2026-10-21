#pragma once
#include <string>
#include <string.h>
#include "session.h"
inline std::string frame(const std::string &cards="",const std::string &extra="") {
  return "{\"version\":2,\"type\":\"state\",\"seq\":1,\"connected\":true,\"age\":0,\"total\":32,\"attention\":2,\"working\":1,\"monitoring\":1,\"cue\":1,\"request\":0,\"target\":\"\",\"feedback\":\"none\",\"sessions\":["+cards+"]"+extra+"}\n";
}
inline std::string cardJSON(const char *id="1111111111111111",int state=0) {
  return std::string("[\"")+id+"\",\"goodhabitz\",\"Session 1234\",\"Claude\","+std::to_string(state)+",true,false,true,\"Waiting for your input\",1]";
}
inline SessionSnapshot sampleSnapshot(){
  SessionSnapshot s;s.seq=1;s.connected=true;s.count=2;s.total=2;s.attention=1;
  strcpy(s.sessions[0].id,"1111111111111111");strcpy(s.sessions[1].id,"2222222222222222");
  strcpy(s.sessions[0].project,"goodhabitz");strcpy(s.sessions[1].project,"puckling");
  s.sessions[0].position=1;s.sessions[1].position=2;
  s.sessions[0].state=SessionState::Input;s.sessions[0].attention=true;s.sessions[1].state=SessionState::Working;
  return s;
}

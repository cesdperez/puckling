#pragma once
#include "session.h"
#include <string>
class StateLink {
 public:
  explicit StateLink(const char *path);
  ~StateLink();
  bool opened()const{return fd>=0;}
  void poll(double now);
  bool send(const char *message);
  bool canFocus(double now)const{return fd>=0&&receiver.canFocus(uint32_t(now*1000));}
  bool fresh(double now)const{return receiver.fresh(uint32_t(now*1000));}
  uint32_t age(double now)const{return receiver.age(uint32_t(now*1000));}
  const char *status(double now)const;
  const SessionSnapshot &snapshot()const{return receiver.snapshot();}
 private:
  int fd=-1;
  SessionReceiver receiver;
  std::string outgoing;
  size_t sent=0;
  void flush();
};

#pragma once
#include "session.h"
#include <string>

class StateLink {
 public:
  explicit StateLink(const char *path);
  ~StateLink();
  bool opened() const { return fd >= 0; }
  void poll(double now);
  bool canFocus(double now) const;
  bool tap(double now);
  const char *status(double now) const;
  const SessionSnapshot &snapshot() const { return current; }

 private:
  int fd = -1;
  StateStream stream;
  SessionSnapshot current;
  bool received = false;
  double lastReceived = 0;
  std::string outgoing;
  size_t sent = 0;
  void flush();
};

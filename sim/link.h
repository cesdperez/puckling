#pragma once
#include "session.h"

class StateLink {
 public:
  explicit StateLink(const char *path);
  ~StateLink();
  bool opened() const { return fd >= 0; }
  void poll(double now);
  const char *status(double now) const;
  const SessionSnapshot &snapshot() const { return current; }

 private:
  int fd = -1;
  StateStream stream;
  SessionSnapshot current;
  bool received = false;
  double lastReceived = 0;
};

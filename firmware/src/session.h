#pragma once
#include <stddef.h>
#include <stdint.h>
#include "pet.h"

enum class SessionState { Idle, Working, NeedsMe, JustFinished };

struct SessionSnapshot {
  SessionState state = SessionState::Idle;
  bool connected = false;
};

constexpr char TAP_MESSAGE[] = "{\"version\":1,\"type\":\"input\",\"event\":\"tap\"}\n";

class StateStream {
 public:
  bool feed(char byte, SessionSnapshot &snapshot);

 private:
  char line[256];
  size_t length = 0;
  bool discarded = false;
};

class SessionReceiver {
 public:
  bool feed(char byte, uint32_t now);
  bool hasSnapshot() const { return received; }
  bool fresh(uint32_t now) const { return received && uint32_t(now - lastReceived) <= 8000; }
  bool canFocus(uint32_t now) const;
  const SessionSnapshot &snapshot() const { return current; }

 private:
  StateStream stream;
  SessionSnapshot current;
  bool received = false;
  uint32_t lastReceived = 0;
};

const char *sessionName(SessionState state);
void applySession(Pose &pose, SessionState state);

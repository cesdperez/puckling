#pragma once
#include <stddef.h>
#include "pet.h"

enum class SessionState { Idle, Working, NeedsMe, JustFinished };

struct SessionSnapshot {
  SessionState state = SessionState::Idle;
  bool connected = false;
};

class StateStream {
 public:
  bool feed(char byte, SessionSnapshot &snapshot);

 private:
  char line[256];
  size_t length = 0;
  bool discarded = false;
};

const char *sessionName(SessionState state);
void applySession(Pose &pose, SessionState state);

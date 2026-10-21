#pragma once
#include <stddef.h>
#include <stdint.h>

constexpr int MAX_SESSIONS = 32;
constexpr int MAX_STATE_LINE = 12288;
enum class SessionState { Input, Attention, Failed, Finished, Working, Monitoring, Ended, Unknown };
struct SessionCard {
  char id[17] = "", project[25] = "", label[25] = "", agent[11] = "", reason[33] = "";
  uint32_t position = 0;
  SessionState state = SessionState::Unknown;
  bool attention = false, seen = false, supported = true;
};
enum class Feedback { None, Opening, Opened, Retry, Unavailable, Unsupported, Selected };
struct SessionSnapshot {
  uint32_t seq = 0, age = 0, cue = 0, request = 0;
  int total = 0, attention = 0, working = 0, monitoring = 0, count = 0;
  bool connected = false;
  char target[17] = "";
  Feedback feedback = Feedback::None;
  SessionCard sessions[MAX_SESSIONS];
};
class StateStream {
 public:
  bool feed(char byte, SessionSnapshot &snapshot);
 private:
  char line[MAX_STATE_LINE + 1];
  size_t length = 0;
  bool discarded = false;
};
class SessionReceiver {
 public:
  bool feed(char byte, uint32_t now);
  bool hasSnapshot() const { return received; }
  uint32_t age(uint32_t now) const;
  bool fresh(uint32_t now) const { return received && age(now) <= 8000; }
  bool canFocus(uint32_t now) const { return fresh(now) && current.connected; }
  const SessionSnapshot &snapshot() const { return current; }
 private:
  StateStream stream;
  SessionSnapshot current;
  bool received = false;
  uint32_t lastReceived = 0;
};
const char *sessionName(SessionState state);
int openMessage(char *buffer, size_t size, const char *id, uint32_t seq, uint32_t request);

int stepMessage(char *buffer,size_t size,const char *id,uint32_t seq,uint32_t request,int view,int direction);

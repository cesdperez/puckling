#include <assert.h>
#include <string>
#include "session.h"

static bool feed(StateStream &stream, const std::string &line, SessionSnapshot &snapshot) {
  bool received = false;
  for (char byte : line) received = stream.feed(byte, snapshot) || received;
  return received;
}

int main() {
  StateStream stream;
  SessionSnapshot snapshot;
  assert(!feed(stream, "{\"version\":1,\"type\":\"state\",", snapshot));
  assert(feed(stream, "\"state\":\"working\",\"connected\":true}\n", snapshot));
  assert(snapshot.state == SessionState::Working && snapshot.connected);
  assert(feed(stream, " { \"connected\" : false, \"state\" : \"needs_me\", \"type\" : \"state\", \"version\" : 1 }\r\n", snapshot));
  assert(snapshot.state == SessionState::NeedsMe && !snapshot.connected);

  for (const char *line : {
      "{\"version\":2,\"type\":\"state\",\"state\":\"idle\",\"connected\":true}\n",
      "{\"version\":1,\"type\":\"input\",\"state\":\"idle\",\"connected\":true}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"unknown\",\"connected\":true}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\",\"connected\":\"true\"}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\"}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\",\"connected\":true,}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\",\"connected\":true}garbage\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\",\"state\":\"working\",\"connected\":true}\n",
      "{\"version\":1,\"type\":\"state\",\"state\":\"idle\",\"connected\":true,\"extra\":1}\n",
  }) {
    assert(!feed(stream, line, snapshot));
    assert(snapshot.state == SessionState::NeedsMe && !snapshot.connected);
  }
  assert(!feed(stream, std::string(300, 'x') + "\n", snapshot));
  assert(!feed(stream, std::string("{}\0", 3) + "\n", snapshot));
  for (const char *state : {"idle", "working", "needs_me", "just_finished"}) {
    assert(feed(stream, std::string("{\"version\":1,\"type\":\"state\",\"state\":\"") + state + "\",\"connected\":true}\n", snapshot));
    assert(std::string(sessionName(snapshot.state)) == state);
  }
}

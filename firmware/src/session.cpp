#include "session.h"
#include <string_view>

namespace {
class Fields {
 public:
  explicit Fields(std::string_view text) : text(text) {}

  bool take(char c) {
    space();
    if (text.empty() || text.front() != c) return false;
    text.remove_prefix(1);
    return true;
  }

  bool literal(std::string_view value) {
    space();
    if (text.substr(0, value.size()) != value) return false;
    text.remove_prefix(value.size());
    return true;
  }

  bool string(std::string_view &value) {
    if (!take('"')) return false;
    size_t end = text.find('"');
    if (end == std::string_view::npos) return false;
    value = text.substr(0, end);
    for (unsigned char c : value) if (c < 32 || c > 126 || c == '\\') return false;
    text.remove_prefix(end + 1);
    return true;
  }

  bool ended() { space(); return text.empty(); }

 private:
  std::string_view text;

  void space() {
    while (!text.empty() && (text.front() == ' ' || text.front() == '\t' || text.front() == '\r' || text.front() == '\n')) {
      text.remove_prefix(1);
    }
  }
};

bool parse(std::string_view line, SessionSnapshot &snapshot) {
  Fields fields(line);
  if (!fields.take('{')) return false;
  SessionSnapshot next;
  unsigned seen = 0;
  do {
    std::string_view key, value;
    if (!fields.string(key) || !fields.take(':')) return false;
    unsigned bit;
    if (key == "version") {
      bit = 1;
      if (!fields.literal("1")) return false;
    } else if (key == "type") {
      bit = 2;
      if (!fields.string(value) || value != "state") return false;
    } else if (key == "state") {
      bit = 4;
      if (!fields.string(value)) return false;
      if (value == "idle") next.state = SessionState::Idle;
      else if (value == "working") next.state = SessionState::Working;
      else if (value == "needs_me") next.state = SessionState::NeedsMe;
      else if (value == "just_finished") next.state = SessionState::JustFinished;
      else return false;
    } else if (key == "connected") {
      bit = 8;
      if (fields.literal("true")) next.connected = true;
      else if (fields.literal("false")) next.connected = false;
      else return false;
    } else return false;
    if (seen & bit) return false;
    seen |= bit;
  } while (fields.take(','));
  if (seen != 15 || !fields.take('}') || !fields.ended()) return false;
  snapshot = next;
  return true;
}
}

bool StateStream::feed(char byte, SessionSnapshot &snapshot) {
  if (byte == '\n') {
    bool valid = !discarded && parse(std::string_view(line, length), snapshot);
    length = 0;
    discarded = false;
    return valid;
  }
  if (length == sizeof(line) - 1 || byte == '\0') discarded = true;
  if (!discarded) line[length++] = byte;
  return false;
}

bool SessionReceiver::feed(char byte, uint32_t now) {
  if (!stream.feed(byte, current)) return false;
  received = true;
  lastReceived = now;
  return true;
}

bool SessionReceiver::canFocus(uint32_t now) const {
  return fresh(now) && current.connected;
}

const char *sessionName(SessionState state) {
  switch (state) {
    case SessionState::Working: return "working";
    case SessionState::NeedsMe: return "needs_me";
    case SessionState::JustFinished: return "just_finished";
    default: return "idle";
  }
}

void applySession(Pose &p, SessionState state) {
  switch (state) {
    case SessionState::Idle: break;
    case SessionState::Working:
      p.eyes = Eyes::Focused;
      p.look = 0.35f * sinf(p.time * 3);
      p.leftArmUp = sinf(p.time * 10) > 0;
      p.rightArmUp = !p.leftArmUp;
      p.squash += 0.06f * sinf(p.time * 8);
      break;
    case SessionState::NeedsMe:
      p.eyes = Eyes::Alert;
      p.look = 0;
      p.leftArmUp = p.rightArmUp = false;
      break;
    case SessionState::JustFinished:
      p.eyes = Eyes::Happy;
      p.look = 0;
      p.leftArmUp = p.rightArmUp = true;
      p.squash += 0.08f * sinf(p.time * 6);
      break;
  }
}

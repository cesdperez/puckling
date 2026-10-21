#include "link.h"
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <termios.h>
#include <unistd.h>

StateLink::StateLink(const char *path) {
  if (!path) return;
  fd = open(path, O_RDWR | O_NONBLOCK | O_NOCTTY);
  if (fd < 0) { perror(path); return; }
  termios settings;
  if (tcgetattr(fd, &settings) != 0) { perror("link termios"); close(fd); fd = -1; return; }
  cfmakeraw(&settings);
  cfsetspeed(&settings, B115200);
  if (tcsetattr(fd, TCSANOW, &settings) != 0) { perror("link raw mode"); close(fd); fd = -1; }
}

StateLink::~StateLink() { if (fd >= 0) close(fd); }

void StateLink::poll(double now) {
  flush();
  if (fd < 0) return;
  char bytes[512];
  for (int batch = 0; batch < 16; batch++) {
    ssize_t count = read(fd, bytes, sizeof(bytes));
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) break;
    for (ssize_t i = 0; i < count; i++) {
      SessionSnapshot next;
      if (!stream.feed(bytes[i], next)) continue;
      if (!received || current.state != next.state || current.connected != next.connected) {
        printf("session state=%s source=%s\n", sessionName(next.state), next.connected ? "connected" : "unavailable");
        fflush(stdout);
      }
      current = next;
      received = true;
      lastReceived = now;
    }
  }
}

bool StateLink::canFocus(double now) const {
  return fd >= 0 && received && now - lastReceived <= 8 && current.connected && current.state == SessionState::NeedsMe;
}

bool StateLink::tap(double now) {
  if (!canFocus(now)) return false;
  if (outgoing.empty()) outgoing = TAP_MESSAGE;
  flush();
  return fd >= 0;
}

void StateLink::flush() {
  if (fd < 0 || outgoing.empty()) return;
  ssize_t count = write(fd, outgoing.data() + sent, outgoing.size() - sent);
  if (count < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) return;
    perror("tap link");
    close(fd);
    fd = -1;
    outgoing.clear();
    sent = 0;
    return;
  }
  sent += count;
  if (sent == outgoing.size()) { outgoing.clear(); sent = 0; }
}

const char *StateLink::status(double now) const {
  if (fd < 0) return "local preview";
  if (!received) return "waiting for daemon";
  if (now - lastReceived > 8) return "link stale";
  return current.connected ? "Orca connected" : "Orca unavailable";
}

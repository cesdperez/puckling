#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <string.h>
#include <sys/select.h>
#include <unistd.h>
#include <util.h>
#include "link.h"

static void ready(int fd) {
  fd_set read;
  FD_ZERO(&read);
  FD_SET(fd, &read);
  timeval timeout{1, 0};
  assert(select(fd + 1, &read, nullptr, nullptr, &timeout) == 1);
}

int main() {
  int master, slave;
  char path[128];
  assert(openpty(&master, &slave, path, nullptr, nullptr) == 0);
  assert(fcntl(master, F_SETFL, O_NONBLOCK) == 0);
  StateLink link(path);
  assert(link.opened());
  assert(!link.tap(0));

  auto send = [&](const char *state, bool connected, double now) {
    std::string line = std::string("{\"version\":1,\"type\":\"state\",\"state\":\"") + state +
      "\",\"connected\":" + (connected ? "true" : "false") + "}\n";
    assert(write(master, line.data(), line.size()) == (ssize_t)line.size());
    ready(slave);
    link.poll(now);
  };
  char bytes[256];
  send("working", true, 1);
  assert(link.tap(1));
  ready(master);
  assert(read(master, bytes, sizeof(bytes)) == sizeof(TAP_MESSAGE) - 1);

  send("needs_me", true, 2);
  assert(link.canFocus(2));
  assert(link.tap(2));
  ready(master);
  ssize_t count = read(master, bytes, sizeof(bytes));
  assert(count == sizeof(TAP_MESSAGE) - 1);
  assert(memcmp(bytes, TAP_MESSAGE, count) == 0);
  assert(!link.tap(11));
  assert(strcmp(link.status(11), "link stale") == 0);

  send("needs_me", false, 12);
  assert(!link.tap(12));
  assert(read(master, bytes, sizeof(bytes)) == -1 && errno == EAGAIN);
  assert(strcmp(link.status(12), "Orca unavailable") == 0);
  close(master);
  close(slave);
}

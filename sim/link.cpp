#include "link.h"
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
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
    for (ssize_t i=0;i<count;i++) if(receiver.feed(bytes[i],uint32_t(now*1000))) {
      const auto &s=receiver.snapshot();
      printf("snapshot seq=%lu connected=%d count=%d attention=%d working=%d monitoring=%d feedback=%d\n",
        (unsigned long)s.seq,s.connected,s.count,s.attention,s.working,s.monitoring,int(s.feedback));
      fflush(stdout);
    }
  }
}
bool StateLink::send(const char *message) {
  if(fd<0||!outgoing.empty()||strlen(message)>255)return false;
  outgoing=message;flush();return fd>=0;
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

const char *StateLink::status(double now)const {
  if(fd<0)return "local preview";
  if(!receiver.hasSnapshot())return "waiting for daemon";
  if(!fresh(now))return "link stale";
  return snapshot().connected?"Orca connected":"Orca unavailable";
}

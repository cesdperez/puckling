#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/select.h>
#include <unistd.h>
#include <util.h>
#include "link.h"
#include "fixture.h"
static void ready(int fd){fd_set set;FD_ZERO(&set);FD_SET(fd,&set);timeval timeout{1,0};assert(select(fd+1,&set,nullptr,nullptr,&timeout)==1);}
int main(){
  int master,slave;char path[128];assert(openpty(&master,&slave,path,nullptr,nullptr)==0);fcntl(master,F_SETFL,O_NONBLOCK);
  StateLink link(path);assert(link.opened());assert(!link.canFocus(0));
  auto line=frame(cardJSON());assert(write(master,line.data(),35)==35);ready(slave);link.poll(1);assert(!link.canFocus(1));
  assert(write(master,line.data()+35,line.size()-35)==ssize_t(line.size()-35));ready(slave);link.poll(1);assert(link.canFocus(1));
  char message[256],out[256];int n=openMessage(message,sizeof(message),link.snapshot().sessions[0].id,1,1);
  assert(link.send(message));ready(master);assert(read(master,out,sizeof(out))==n);assert(!memcmp(message,out,n));assert(!link.canFocus(10));
  assert(!strcmp(link.status(10),"link stale"));close(master);close(slave);
}

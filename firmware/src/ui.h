#pragma once
#include <Arduino_GFX_Library.h>
#include "session.h"

struct Bounds { int16_t x0,y0,x1,y1; };
struct TouchSample { bool down = false; int16_t x = 0,y = 0; };
class CompanionUI {
 public:
  void update(const SessionSnapshot &snapshot, bool fresh, uint32_t age, uint32_t now);
  bool touch(TouchSample sample, uint32_t now, char *message, size_t size);
  void draw(Arduino_GFX *gfx, uint32_t now) const;
  void transportFailed() {pendingView=-1;feedback=Feedback::Retry;}
  int pageIndex() const {return page;}
  int selectedPosition() const {int i=index();return i>=0?int(state.sessions[i].position):0;}
  SessionState selectedState() const {int i=index();return i>=0?state.sessions[i].state:SessionState::Unknown;}
  Feedback actionFeedback() const {return feedback;}
  const char *selectedId() const {return selected[page];}
  bool unavailable() const;
 private:
  SessionSnapshot state;
  char selected[3][17] = {};
  bool live = false, down = false, dragged = false;
  int pendingView = -1, page = 0, startX = 0, startY = 0, maxTravel = 0;
  uint32_t age = 0, lastUpdate = 0, lastInteraction = 0, pressAt = 0;
  char pressedId[17] = "";
  uint32_t pressedSeq = 0, request = 0, pendingSince = 0, cueUntil = 0, lastCue = 0, expressionSince = 0;
  char expressionId[17] = "";
  SessionState expressionState = SessionState::Unknown;
  Feedback feedback = Feedback::None;
  int index() const;
  bool eligible(int i) const;
  void selectInitial();
  bool step(int direction,char *message,size_t size);
};

#include <Arduino.h>
#include "display.h"
#include "sensors.h"
#include "session.h"
#include "ui.h"

static SessionReceiver session;
static CompanionUI ui;
void setup() {
  Serial.begin(115200); Serial.setTxTimeoutMs(0);
  if(!initDisplay())Serial.println("display init failed");
  if(!initSensors())Serial.println("sensor init failed");
  Serial.println("Pebble ready protocol=2");
}
void loop() {
  uint32_t now=millis();
  for(int remaining=2048;remaining>0&&Serial.available()>0;remaining--)session.feed(char(Serial.read()),now);
  ui.update(session.snapshot(),session.fresh(now),session.age(now),now);
  TouchSample sample=readTouch();
  static uint32_t lastTouch=0,lastFrame=0,lastReport=0;
  if(sample.down)lastTouch=now;
  static char outgoing[256];
  static size_t sent=0, length=0;
  char message[256];
  if(ui.touch(sample,now,message,sizeof(message)) && length==0) {
    strcpy(outgoing,message);length=strlen(outgoing);sent=0;
  }
  if(length && Serial.availableForWrite()>0) {
    size_t chunk=min(length-sent,size_t(Serial.availableForWrite()));
    sent+=Serial.write((const uint8_t*)outgoing+sent,chunk);
    if(sent==length)length=sent=0;
  }
  if(now-lastFrame>=66) {
    displayBrightness(now-lastTouch>60000?35:160);
    ui.draw(beginFrame(),now);endFrame({0,0,466,466});lastFrame=now;
  }
  if(now-lastReport>=2000) {
    Serial.printf("Pebble page=%d sessions=%d sensors=%s link=%s\n",ui.pageIndex(),session.snapshot().count,sensorStatus(),session.canFocus(now)?"connected":"unknown");lastReport=now;
  }
}

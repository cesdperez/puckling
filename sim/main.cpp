#include <raylib.h>
#include <rlgl.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include "ui.h"
#include "link.h"
constexpr int PANEL=466,WINDOW_W=640,WINDOW_H=640;
constexpr Vector2 CENTER={320,280};
struct Action {float at;bool down;int16_t x,y;};
static bool screenshot(const char *path){
  Image frame={rlReadScreenPixels(GetRenderWidth(),GetRenderHeight()),GetRenderWidth(),GetRenderHeight(),1,PIXELFORMAT_UNCOMPRESSED_R8G8B8A8};
  if(!frame.data)return false;bool ok=ExportImage(frame,path);UnloadImage(frame);return ok;
}
int main(int argc,char **argv){
  const char *capture=nullptr,*path=nullptr,*script=nullptr;float after=2,tap=0;
  for(int i=1;i<argc;i++){
    if(!strcmp(argv[i],"--screenshot")&&i+1<argc)capture=argv[++i];
    else if(!strcmp(argv[i],"--link")&&i+1<argc)path=argv[++i];
    else if(!strcmp(argv[i],"--script")&&i+1<argc)script=argv[++i];
    else if(!strcmp(argv[i],"--capture-after")&&i+1<argc)after=strtof(argv[++i],nullptr);
    else if(!strcmp(argv[i],"--tap-after")&&i+1<argc)tap=strtof(argv[++i],nullptr);
    else {fprintf(stderr,"Usage: %s [--link tty] [--screenshot path] [--capture-after seconds] [--script path] [--tap-after seconds]\n",argv[0]);return 1;}
  }
  std::vector<Action> actions;
  if(script){FILE *f=fopen(script,"r");if(!f)return 1;float at;int down,x,y;while(fscanf(f,"%f %d %d %d",&at,&down,&x,&y)==4)actions.push_back({at,down!=0,int16_t(x),int16_t(y)});fclose(f);}
  if(tap>0){actions.push_back({tap,true,233,390});actions.push_back({tap+0.1f,false,233,390});}
  StateLink link(path);if(path&&!link.opened())return 1;
  SetConfigFlags(FLAG_WINDOW_HIGHDPI|FLAG_VSYNC_HINT);
  InitWindow(WINDOW_W,WINDOW_H,"Pebble / Orca session companion");if(!IsWindowReady())return 1;SetTargetFPS(60);
  Arduino_GFX gfx(PANEL,PANEL);Image blank=GenImageColor(PANEL,PANEL,BLACK);ImageFormat(&blank,PIXELFORMAT_UNCOMPRESSED_R5G6B5);
  Texture2D panel=LoadTextureFromImage(blank);SetTextureFilter(panel,TEXTURE_FILTER_POINT);UnloadImage(blank);
  CompanionUI ui;TouchSample sample;size_t action=0;bool saved=true;int lastPage=-1;float elapsed=0;
  while(!WindowShouldClose()){
    double now=GetTime();uint32_t ms=uint32_t(now*1000);link.poll(now);ui.update(link.snapshot(),link.fresh(now),link.age(now),ms);
    Vector2 mouse=GetMousePosition();
    if(IsMouseButtonPressed(MOUSE_BUTTON_LEFT))sample={true,int16_t(mouse.x-87),int16_t(mouse.y-47)};
    if(IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&sample.down){sample.x=mouse.x-87;sample.y=mouse.y-47;}
    if(IsMouseButtonReleased(MOUSE_BUTTON_LEFT))sample.down=false;
    while(action<actions.size()&&elapsed>=actions[action].at){const auto &a=actions[action++];sample={a.down,a.x,a.y};
      char message[256];if(ui.touch(sample,ms,message,sizeof(message))){if(link.send(message)){printf("input action=%s\n",strstr(message,"step")?"step":"open");fflush(stdout);}else ui.transportFailed();}}
    char message[256];if(ui.touch(sample,ms,message,sizeof(message))){if(link.send(message)){printf("input action=%s\n",strstr(message,"step")?"step":"open");fflush(stdout);}else ui.transportFailed();}
    if(lastPage!=ui.pageIndex()){printf("page=%d\n",ui.pageIndex());fflush(stdout);lastPage=ui.pageIndex();}
    ui.draw(&gfx,ms);UpdateTexture(panel,gfx.framebuffer());
    BeginDrawing();ClearBackground({28,29,34,255});
    DrawCircleV(CENTER,248,{12,13,17,255});DrawTexture(panel,87,47,WHITE);
    DrawRing(CENTER,233,500,0,360,180,{28,29,34,255});DrawRing(CENTER,233,248,0,360,180,{12,13,17,255});
    DrawText("Swipe horizontally: screens",30,551,19,LIGHTGRAY);
    DrawText("Swipe vertically / arrows: cards. Tap pill: open.",30,579,18,LIGHTGRAY);
    DrawText(link.status(now),30,608,16,GRAY);EndDrawing();
    elapsed+=GetFrameTime();if(capture&&elapsed>after){
      printf("capture page=%d state=%s position=%d feedback=%d source=%s\n",ui.pageIndex(),ui.selectedPosition()?sessionName(ui.selectedState()):"none",ui.selectedPosition(),int(ui.actionFeedback()),link.status(now));fflush(stdout);
      saved=screenshot(capture);break;
    }
  }
  UnloadTexture(panel);CloseWindow();return saved?0:1;
}

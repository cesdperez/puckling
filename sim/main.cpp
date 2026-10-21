// Runs the firmware's world and pet code in a window, with the mouse and keyboard standing in for touch and the IMU.
#include <raylib.h>
#include <rlgl.h>
#include <string.h>
#include <stdlib.h>

#include "pet.h"
#include "sensors.h"
#include "world.h"
#include "link.h"

constexpr int PANEL = 466;
constexpr float RADIUS = PANEL / 2.0f;
constexpr float BEZEL = 26;
constexpr int WINDOW_W = 640;
constexpr int WINDOW_H = 700;
constexpr Vector2 CENTER = {WINDOW_W / 2.0f, 300};
constexpr float SLOW_TURN = 1.5f;  // rad/s
constexpr float FAST_TURN = 8;     // above the pet's dizzy threshold
constexpr Color BACKGROUND = {32, 32, 36, 255};
constexpr Color SHELL = {14, 14, 16, 255};
constexpr uint16_t BOUNDS_565 = 0x07E0;

struct Puck {
  float angle = 0;  // clockwise on the desk, 0 with the USB port down
  bool flat = false;
  bool turnsOnScreen = true;
  bool showBounds = false;
  bool paused = false;
  float timeScale = 1;
  bool dragging = false;
  float dragFrom = 0;
};

static float angleAround(Vector2 p) { return atan2f(p.y - CENTER.y, p.x - CENTER.x); }
static float distanceFromCenter(Vector2 p) { return hypotf(p.x - CENTER.x, p.y - CENTER.y); }

static float viewAngle(const Puck &puck) { return puck.turnsOnScreen ? puck.angle : 0; }

static Poke toPanel(Vector2 p, const Puck &puck) {
  float a = -viewAngle(puck);
  float dx = p.x - CENTER.x, dy = p.y - CENTER.y;
  return {(int16_t)lroundf(RADIUS + cosf(a) * dx - sinf(a) * dy), (int16_t)lroundf(RADIUS + sinf(a) * dx + cosf(a) * dy)};
}

static float turnFromKeys() {
  float rate = IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT) ? FAST_TURN : SLOW_TURN;
  return (IsKeyDown(KEY_RIGHT) - IsKeyDown(KEY_LEFT)) * rate;
}

static float turnFromDrag(Puck &puck) {
  Vector2 mouse = GetMousePosition();
  if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) && distanceFromCenter(mouse) > RADIUS) {
    puck.dragging = true;
    puck.dragFrom = angleAround(mouse);
  }
  if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) puck.dragging = false;
  if (!puck.dragging) return 0;
  float now = angleAround(mouse);
  float turned = atan2f(sinf(now - puck.dragFrom), cosf(now - puck.dragFrom));
  puck.dragFrom = now;
  return turned;
}

static void handleToggles(Puck &puck) {
  if (IsKeyPressed(KEY_F)) puck.flat = !puck.flat;
  if (IsKeyPressed(KEY_V)) puck.turnsOnScreen = !puck.turnsOnScreen;
  if (IsKeyPressed(KEY_B)) puck.showBounds = !puck.showBounds;
  if (IsKeyPressed(KEY_SPACE)) puck.paused = !puck.paused;
  if (IsKeyPressed(KEY_S)) puck.timeScale = puck.timeScale == 1 ? 0.25f : 1;
}

// The panel sees the puck's turn mirrored: turning the puck clockwise swings world-down anticlockwise on the screen.
static Motion senseMotion(const Puck &puck, float turnRate) {
  float down = HALF_PI - puck.angle;
  float g = puck.flat ? 0 : 1;
  return {g * cosf(down), g * sinf(down), -turnRate};
}

static bool pokeFromClick(const Puck &puck, Poke &poke) {
  Vector2 mouse = GetMousePosition();
  if (!IsMouseButtonPressed(MOUSE_BUTTON_LEFT) || distanceFromCenter(mouse) > RADIUS) return false;
  poke = toPanel(mouse, puck);
  return true;
}

static void drawPuck(const Puck &puck, Texture2D panel) {
  float degrees = viewAngle(puck) * RAD2DEG;
  DrawCircleV(CENTER, RADIUS + BEZEL, SHELL);
  DrawTexturePro(panel, {0, 0, PANEL, PANEL}, {CENTER.x, CENTER.y, PANEL, PANEL}, {RADIUS, RADIUS}, degrees, WHITE);
  // The texture is square; this ring hides its corners so only the round panel shows.
  DrawRing(CENTER, RADIUS, RADIUS + BEZEL, 0, 360, 128, SHELL);
  DrawRing(CENTER, RADIUS + BEZEL, RADIUS * 2, 0, 360, 128, BACKGROUND);
  DrawRectanglePro({CENTER.x, CENTER.y, 28, 8}, {14, -(RADIUS + BEZEL - 9)}, degrees, GRAY);
}

static void drawHud(const Puck &puck, const StateLink &link) {
  int y = WINDOW_H - 152;
  auto line = [&](const char *text) {
    DrawText(text, 20, y, 16, LIGHTGRAY);
    y += 20;
  };
  line(link.canFocus(GetTime()) ? "click screen: open Orca session    drag bezel / arrows: turn" :
                                "click screen: pet    drag bezel / arrows: turn (shift: fast)");
  line("F: upright / flat on desk    V: view turns with puck / panel fixed");
  line("B: redraw bounds    S: slow motion    space: pause");
  line(TextFormat("%s   %s", sessionName(link.snapshot().state), link.status(GetTime())));
  line(TextFormat("%s   %s   %s%s", puck.flat ? "flat on desk" : "upright",
                  puck.turnsOnScreen ? "puck view" : "panel view", puck.timeScale < 1 ? "slow  " : "",
                  puck.paused ? "paused" : ""));
  line(TextFormat("%d fps", GetFPS()));
}

static bool saveScreenshot(const char *path) {
  // Read physical dimensions once: TakeScreenshot in some raylib builds doubles Retina scaling.
  Image frame = {rlReadScreenPixels(GetRenderWidth(), GetRenderHeight()), GetRenderWidth(), GetRenderHeight(),
                 1, PIXELFORMAT_UNCOMPRESSED_R8G8B8A8};
  if (!frame.data) return false;
  bool saved = ExportImage(frame, path);
  UnloadImage(frame);
  return saved;
}

int main(int argc, char **argv) {
  const char *screenshot = nullptr;
  const char *linkPath = nullptr;
  float captureAfter = 2;
  float tapAfter = 0;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--screenshot") == 0 && i + 1 < argc) screenshot = argv[++i];
    else if (strcmp(argv[i], "--link") == 0 && i + 1 < argc) linkPath = argv[++i];
    else if ((strcmp(argv[i], "--capture-after") == 0 || strcmp(argv[i], "--tap-after") == 0) && i + 1 < argc) {
      bool tap = strcmp(argv[i], "--tap-after") == 0;
      char *end;
      float seconds = strtof(argv[++i], &end);
      if (*end || !isfinite(seconds) || seconds <= 0) return 1;
      if (tap) tapAfter = seconds;
      else captureAfter = seconds;
    } else {
      fprintf(stderr, "Usage: %s [--link tty] [--screenshot path] [--capture-after seconds] [--tap-after seconds]\n", argv[0]);
      return 1;
    }
  }
  StateLink link(linkPath);
  if (linkPath && !link.opened()) return 1;
  float elapsed = 0;

  SetConfigFlags(FLAG_WINDOW_HIGHDPI | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
  InitWindow(WINDOW_W, WINDOW_H, "puckling sim");
  if (!IsWindowReady()) return 1;
  SetTargetFPS(60);

  Arduino_GFX gfx(PANEL, PANEL);
  Image blank = GenImageColor(PANEL, PANEL, BLACK);
  ImageFormat(&blank, PIXELFORMAT_UNCOMPRESSED_R5G6B5);
  Texture2D panel = LoadTextureFromImage(blank);
  UnloadImage(blank);

  Puck puck;
  bool saved = true;
  while (!WindowShouldClose()) {
    link.poll(GetTime());
    SetMouseCursor(link.canFocus(GetTime()) && distanceFromCenter(GetMousePosition()) <= RADIUS ?
                   MOUSE_CURSOR_POINTING_HAND : MOUSE_CURSOR_DEFAULT);
    handleToggles(puck);
    float dt = puck.paused ? 0 : min(0.05f, GetFrameTime()) * puck.timeScale;

    float turned = turnFromDrag(puck) + turnFromKeys() * dt;
    if (dt <= 0) turned = 0;
    puck.angle += turned;

    Poke poke;
    bool poked = pokeFromClick(puck, poke);
    if (tapAfter > 0 && elapsed >= tapAfter) {
      poke = {233, 360};
      poked = true;
      tapAfter = 0;
    }
    if (poked && link.tap(GetTime())) {
      printf("tap action=focus\n");
      fflush(stdout);
      poked = false;
    }
    Pose pose = stepWorld(senseMotion(puck, dt > 0 ? turned / dt : 0), poked ? &poke : nullptr, dt);
    applySession(pose, link.snapshot().state);

    gfx.fillScreen(RGB565_BLACK);
    drawPet(&gfx, pose);
    if (puck.showBounds) {
      Bounds b = petBounds(pose);
      gfx.drawRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, BOUNDS_565);
    }
    UpdateTexture(panel, gfx.framebuffer());

    BeginDrawing();
    ClearBackground(BACKGROUND);
    drawPuck(puck, panel);
    drawHud(puck, link);
    EndDrawing();

    elapsed += GetFrameTime();
    if (screenshot && elapsed > captureAfter) {
      saved = saveScreenshot(screenshot);
      break;
    }
  }

  UnloadTexture(panel);
  CloseWindow();
  return saved ? 0 : 1;
}

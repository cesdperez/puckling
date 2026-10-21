#include "sensors.h"
#include <Arduino.h>
#include <SensorQMI8658.hpp>
#include <TouchDrvCSTXXX.hpp>
#include <Wire.h>
#include "pins.h"

static SensorQMI8658 imu;
static TouchDrvCST92xx touch;
static float gyroBiasZ = 0;
static Motion lastMotion = {0, 0, 0};
static volatile bool touchReported = false;
static uint32_t lastTouchMs = 0;
static bool imuOnline = false;
static bool touchOnline = false;

static void calibrateGyro() {
  float sum = 0;
  int samples = 0;
  for (uint32_t start = millis(); millis() - start < 400; delay(5)) {
    float x, y, z;
    if (imu.getGyroscope(x, y, z)) {
      sum += z;
      samples++;
    }
  }
  if (samples) gyroBiasZ = sum / samples;
}

bool initSensors() {
  Wire.begin(IIC_SDA, IIC_SCL);
  Wire.setClock(400000);

  imuOnline = imu.begin(Wire, QMI8658_L_SLAVE_ADDRESS, IIC_SDA, IIC_SCL);
  if (imuOnline) {
    imu.configAccelerometer(SensorQMI8658::ACC_RANGE_4G, SensorQMI8658::ACC_ODR_250Hz, SensorQMI8658::LPF_MODE_3);
    imu.configGyroscope(SensorQMI8658::GYR_RANGE_1024DPS, SensorQMI8658::GYR_ODR_448_4Hz, SensorQMI8658::LPF_MODE_3);
    imu.enableAccelerometer();
    imu.enableGyroscope();
    delay(100);
    calibrateGyro();
  }

  touch.setPins(TP_RST, TP_INT);
  touchOnline = touch.begin(Wire, 0x5A, IIC_SDA, IIC_SCL);
  if (touchOnline) {
    touch.reset();
    touch.setMaxCoordinates(466, 466);
    touch.setMirrorXY(true, true);
    attachInterrupt(TP_INT, [] { touchReported = true; }, FALLING);
  }
  return imuOnline && touchOnline;
}

const char *sensorStatus() {
  if (imuOnline && touchOnline) return "ok";
  if (imuOnline) return "touch offline";
  if (touchOnline) return "imu offline";
  return "imu and touch offline";
}

// IMU axes, from the Waveshare rotation example: +x points to the top of the screen, +z out of it.
// That makes +y point left, so screen-down is +x and screen-right is +y for the gravity vector.
Motion readMotion() {
  float ax, ay, az, gx, gy, gz;
  if (imu.getAccelerometer(ax, ay, az)) {
    lastMotion.downX = ay;
    lastMotion.downY = ax;
  }
  if (imu.getGyroscope(gx, gy, gz)) {
    lastMotion.spin = (gz - gyroBiasZ) * DEG_TO_RAD;
  }
  return lastMotion;
}

// The CST9217 NACKs reads unless it has just pulsed its interrupt, so read only after a pulse.
// It pulses for every report while a finger is down; a pulse after a quiet gap starts a new poke.
bool readPoke(Poke &poke) {
  if (!touchReported) return false;
  touchReported = false;

  uint32_t now = millis();
  bool newPoke = now - lastTouchMs > 150;
  lastTouchMs = now;

  int16_t x[1], y[1];
  if (!newPoke || touch.getPoint(x, y, 1) == 0) return false;
  poke = {x[0], y[0]};
  return true;
}

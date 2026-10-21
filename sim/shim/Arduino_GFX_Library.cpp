#include "Arduino_GFX_Library.h"

Arduino_GFX::Arduino_GFX(int16_t width, int16_t height)
    : _width(width), _height(height), _pixels((size_t)width * height, RGB565_BLACK) {}

void Arduino_GFX::fillScreen(uint16_t color) { std::fill(_pixels.begin(), _pixels.end(), color); }

void Arduino_GFX::pixel(int16_t x, int16_t y, uint16_t color) {
  if (x < 0 || y < 0 || x >= _width || y >= _height) return;
  _pixels[(size_t)y * _width + x] = color;
}

void Arduino_GFX::hline(int16_t x0, int16_t x1, int16_t y, uint16_t color) {
  if (y < 0 || y >= _height) return;
  if (x0 > x1) std::swap(x0, x1);
  x0 = max<int16_t>(x0, 0);
  x1 = min<int16_t>(x1, _width - 1);
  for (int16_t x = x0; x <= x1; x++) _pixels[(size_t)y * _width + x] = color;
}

void Arduino_GFX::fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2,
                               uint16_t color) {
  if (y0 > y1) std::swap(y0, y1), std::swap(x0, x1);
  if (y1 > y2) std::swap(y1, y2), std::swap(x1, x2);
  if (y0 > y1) std::swap(y0, y1), std::swap(x0, x1);

  if (y0 == y2) {
    hline(min({x0, x1, x2}), max({x0, x1, x2}), y0, color);
    return;
  }
  for (int y = y0; y <= y2; y++) {
    int32_t long_x = x0 + (int32_t)(x2 - x0) * (y - y0) / (y2 - y0);
    int32_t short_x;
    if (y < y1 || (y == y1 && y1 == y0)) {
      short_x = y1 == y0 ? x1 : x0 + (int32_t)(x1 - x0) * (y - y0) / (y1 - y0);
    } else {
      short_x = y2 == y1 ? x1 : x1 + (int32_t)(x2 - x1) * (y - y1) / (y2 - y1);
    }
    hline((int16_t)long_x, (int16_t)short_x, (int16_t)y, color);
  }
}

void Arduino_GFX::drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  for (int16_t i = 0; i < w; i++) {
    pixel(x + i, y, color);
    pixel(x + i, y + h - 1, color);
  }
  for (int16_t i = 0; i < h; i++) {
    pixel(x, y + i, color);
    pixel(x + w - 1, y + i, color);
  }
}

void Arduino_GFX::fillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t c){for(int yy=y;yy<y+h;yy++)hline(x,x+w-1,yy,c);}
void Arduino_GFX::drawLine(int16_t x,int16_t y,int16_t xx,int16_t yy,uint16_t c){
  int dx=abs(xx-x),sx=x<xx?1:-1,dy=-abs(yy-y),sy=y<yy?1:-1,err=dx+dy;
  for(;;){pixel(x,y,c);if(x==xx&&y==yy)break;int e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
}
void Arduino_GFX::fillCircle(int16_t x,int16_t y,int16_t r,uint16_t c){for(int yy=-r;yy<=r;yy++)for(int xx=-r;xx<=r;xx++)if(xx*xx+yy*yy<=r*r)pixel(x+xx,y+yy,c);}
void Arduino_GFX::drawCircle(int16_t x,int16_t y,int16_t r,uint16_t c){for(int yy=-r;yy<=r;yy++)for(int xx=-r;xx<=r;xx++)if(xx*xx+yy*yy<=r*r&&xx*xx+yy*yy>=(r-1)*(r-1))pixel(x+xx,y+yy,c);}
void Arduino_GFX::fillRoundRect(int16_t x,int16_t y,int16_t w,int16_t h,int16_t r,uint16_t c){
  fillRect(x+r,y,w-2*r,h,c);fillRect(x,y+r,w,h-2*r,c);
  fillCircle(x+r,y+r,r,c);fillCircle(x+w-r-1,y+r,r,c);fillCircle(x+r,y+h-r-1,r,c);fillCircle(x+w-r-1,y+h-r-1,r,c);
}
void Arduino_GFX::drawRoundRect(int16_t x,int16_t y,int16_t w,int16_t h,int16_t r,uint16_t c){
  drawLine(x+r,y,x+w-r,y,c);drawLine(x+r,y+h-1,x+w-r,y+h-1,c);drawLine(x,y+r,x,y+h-r,c);drawLine(x+w-1,y+r,x+w-1,y+h-r,c);
  for(int yy=0;yy<r;yy++)for(int xx=0;xx<r;xx++){int d=(xx-r)*(xx-r)+(yy-r)*(yy-r);if(d<=r*r&&d>=(r-1)*(r-1)){pixel(x+xx,y+yy,c);pixel(x+w-1-xx,y+yy,c);pixel(x+xx,y+h-1-yy,c);pixel(x+w-1-xx,y+h-1-yy,c);}}
}

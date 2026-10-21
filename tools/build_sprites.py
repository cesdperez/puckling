"""Author Pebble's indexed pixel assets from the approved character reference.
Original polygon artwork for this repository, MIT. No reference image pixels copied.
Run with Python 3 to reproduce firmware/assets and sprites.h.
"""
from pathlib import Path
import struct, zlib
class Image:
    @staticmethod
    def new(mode, size, color): return Image(size)
    def __init__(self,size): self.size=size;self.pixels=[[0]*size[0] for _ in range(size[1])]
    def putpalette(self,palette): self.palette=palette
    def getpixel(self,p): return self.pixels[p[1]][p[0]]
    def save(self,path,transparency=0):
        def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
        w,h=self.size
        data=b''.join(b'\0'+bytes(row) for row in self.pixels)
        path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,3,0,0,0))+chunk(b'PLTE',bytes(self.palette))+chunk(b'tRNS',b'\0')+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b''))
class ImageDraw:
    @staticmethod
    def Draw(im): return ImageDraw(im)
    def __init__(self,im): self.im=im
    def point(self,p,fill):
        x,y=p
        if 0<=x<self.im.size[0] and 0<=y<self.im.size[1]:self.im.pixels[y][x]=fill
    def rectangle(self,r,fill):
        for y in range(r[1],r[3]+1):
            for x in range(r[0],r[2]+1):self.point((x,y),fill)
    def line(self,points,fill,width=1):
        for (x,y),(xx,yy) in zip(points,points[1:]):
            steps=max(abs(xx-x),abs(yy-y))
            for n in range(steps+1):self.point((round(x+(xx-x)*n/max(1,steps)),round(y+(yy-y)*n/max(1,steps))),fill)
    def polygon(self,points,fill):
        for y in range(self.im.size[1]):
            for x in range(self.im.size[0]):
                inside=False
                for (ax,ay),(bx,by) in zip(points,points[1:]+points[:1]):
                    if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax:inside=not inside
                if inside:self.point((x,y),fill)
        self.line(points+points[:1],fill)

ROOT = Path(__file__).resolve().parents[1]
PALETTE = [(0,0,0,0),(15,17,23,255),(36,40,51,255),(54,60,74,255),(78,85,99,255),(247,233,210,255),(216,202,181,255),(5,7,10,255),(255,250,238,255)]

def sprite(pose):
    im=Image.new('P',(64,44),0)
    im.putpalette([v for c in PALETTE for v in c[:3]]+[0]*(768-len(PALETTE)*3))
    d=ImageDraw.Draw(im)
    def poly(points,c): d.polygon(points,fill=c)
    if pose=='working':
        # Head-down pose with lifted forked tail and both paddles at a work tile.
        poly([(43,16),(48,10),(49,4),(47,0),(51,3),(53,6),(57,3),(62,3),(60,7),(56,10),(52,10),(50,19)],1)
        poly([(48,8),(50,4),(51,8),(57,5),(59,5),(55,8),(51,9)],3)
        poly([(29,14),(30,6),(34,2),(36,2),(36,13)],1)
        poly([(31,12),(32,7),(34,5),(34,12)],3)
        poly([(12,25),(14,19),(20,14),(29,11),(38,12),(46,16),(50,22),(49,28),(45,34),(38,39),(29,41),(19,40),(13,36),(11,31)],1)
        poly([(13,25),(16,20),(22,16),(30,13),(38,14),(45,18),(48,23),(47,28),(43,33),(37,37),(29,39),(20,38),(14,34)],2)
        poly([(15,23),(21,17),(29,14),(36,15),(25,17),(19,22)],3)
        poly([(13,31),(16,33),(22,34),(29,32),(34,30),(41,29),(46,27),(46,30),(41,35),(34,38),(26,39),(19,37),(14,34)],6)
        poly([(14,31),(19,33),(25,32),(32,29),(37,30),(44,28),(45,29),(40,33),(34,36),(26,37),(20,36),(15,33)],5)
        poly([(25,25),(26,22),(29,20),(33,20),(35,22),(34,24),(30,27),(27,27)],5)
        d.rectangle((21,28,23,30),fill=7);d.point((21,28),fill=8)
        poly([(34,29),(31,33),(30,38),(31,41),(35,40),(39,36),(40,31),(38,28)],1)
        poly([(35,31),(33,35),(33,38),(35,37),(38,32)],3)
        poly([(15,38),(11,39),(11,42),(17,43),(27,43),(30,41),(28,38)],1)
        poly([(14,39),(27,39),(27,41),(17,41)],4)
        poly([(18,34),(21,35),(23,34)],7)
        return im
    if pose in ['input','finished']:
        # Front three-quarter pose: two actual eyes, oval patches and raised paddle.
        poly([(33,13),(34,4),(37,1),(38,1),(39,11)],1)
        poly([(35,10),(36,5),(37,4),(37,10)],3)
        poly([(47,29),(53,28),(56,24),(57,27),(62,28),(60,31),(55,33),(48,33)],1)
        poly([(51,30),(55,29),(56,28),(59,29),(56,31)],3)
        poly([(18,18),(24,12),(32,10),(39,12),(45,16),(49,23),(50,30),(47,36),(41,40),(33,42),(25,40),(18,36),(14,30),(14,24)],1)
        poly([(19,19),(25,14),(32,12),(39,14),(44,18),(47,24),(48,30),(45,35),(40,38),(33,40),(26,38),(20,34),(16,29),(16,24)],2)
        poly([(19,19),(24,14),(29,13),(27,16),(22,20)],3)
        poly([(15,25),(18,26),(23,28),(28,27),(33,28),(39,30),(43,31),(43,35),(39,38),(33,40),(27,38),(21,35),(17,31)],6)
        poly([(16,24),(21,27),(26,26),(31,27),(36,29),(41,30),(41,34),(38,36),(33,38),(27,36),(21,33),(18,29)],5)
        poly([(20,19),(22,16),(25,14),(26,14),(25,18),(23,21),(21,22)],5)
        poly([(37,20),(39,20),(42,22),(44,26),(44,29),(42,28),(39,25),(37,23)],5)
        d.rectangle((19,22,21,25),fill=7);d.point((19,22),fill=8)
        d.rectangle((33,24,35,28),fill=7);d.point((33,24),fill=8)
        poly([(17,26),(13,25),(11,22),(10,19),(8,18),(7,20),(8,25),(11,29),(16,31)],1)
        poly([(13,27),(10,24),(9,21),(9,24),(12,28)],3)
        poly([(39,32),(39,36),(42,41),(46,43),(47,42),(46,37),(44,33),(42,31)],1)
        poly([(41,34),(42,38),(45,41),(44,36)],3)
        poly([(26,29),(28,31),(30,31),(31,30),(29,30),(27,29)],7)
        if pose=='finished':
            d.rectangle((19,22,21,25),fill=2);d.line([(19,24),(20,23),(21,24)],fill=7)
            d.rectangle((33,24,35,28),fill=2);d.line([(33,26),(34,25),(35,26)],fill=7)
        return im
    # Stubby dorsal, forked tail, bean body and blunt snout use one logical grid.
    poly([(27,13),(24,3),(26,3),(34,7),(39,14)],1)
    poly([(26,5),(28,5),(35,10),(29,10)],3)
    poly([(15,25),(8,23),(4,18),(4,22),(0,23),(3,26),(8,28),(15,30)],1)
    poly([(10,25),(6,24),(5,22),(4,24),(2,24),(5,26),(11,27)],3)
    poly([(12,23),(16,18),(22,14),(31,11),(41,12),(50,15),(57,20),(60,25),(60,31),(57,36),(51,40),(40,42),(28,41),(20,37),(15,32)],1)
    poly([(14,24),(18,19),(24,15),(32,13),(41,14),(50,17),(56,21),(58,26),(58,30),(54,35),(48,39),(39,40),(29,39),(21,35),(17,30)],2)
    poly([(17,23),(22,18),(30,15),(40,15),(47,17),(35,16),(25,19),(20,23)],3)
    poly([(16,29),(20,32),(27,34),(32,32),(37,30),(45,31),(51,29),(58,28),(58,32),(54,36),(48,39),(39,40),(29,39),(22,35),(18,32)],6)
    poly([(19,29),(23,32),(29,33),(34,30),(40,30),(46,31),(52,29),(58,29),(57,33),(53,35),(47,37),(38,38),(30,37),(24,34)],5)
    # The white patch is behind the small actual dark eye.
    poly([(31,24),(32,21),(36,19),(40,19),(42,21),(41,24),(37,26),(33,26)],5)
    if pose=='input':
        poly([(54,28),(57,25),(59,21),(61,20),(63,22),(62,27),(59,31),(55,33)],1)
        poly([(57,28),(59,25),(61,23),(61,26),(59,29)],3)
    else:
        poly([(31,29),(29,32),(25,35),(22,39),(22,41),(27,41),(32,38),(35,33),(35,30)],1)
        poly([(31,31),(28,34),(25,38),(25,39),(29,38),(33,33)],3)
    if pose=='working':
        poly([(39,37),(36,40),(40,43),(51,43),(55,40),(52,38)],1)
        poly([(39,39),(51,39),(52,40),(49,41),(41,41)],4)
        d.rectangle((44,26,46,27),fill=7)
    else:
        d.rectangle((45,24,47,28),fill=7);d.point((45,24),fill=8)
    if pose=='failed': poly([(44,23),(47,22),(48,23)],4)
    # Crooked smile remains a small dark mark on the ivory chin.
    if pose=='failed': poly([(51,32),(53,31),(55,32)],7)
    else: poly([(50,31),(52,33),(54,33),(56,31),(54,32),(52,32)],7)
    if pose=='finished':
        d.line([(44,26),(45,25),(47,26)],fill=7,width=1)
    return im

header=['#pragma once','// Original indexed pixel artwork. Reproduce with tools/build_sprites.py.','static const char *const PEBBLE[5][44] = {']
for pose in ['idle','working','input','finished','failed']:
    im=sprite(pose); im.save(ROOT/'firmware/assets'/f'pebble-{pose}.png',transparency=0)
    header.append('{')
    for y in range(44):header.append('"'+''.join(str(im.getpixel((x,y))) for x in range(64))+'",')
    header.append('},')
header.append('};')
(ROOT/'firmware/src/sprites.h').write_text('\n'.join(header)+'\n')

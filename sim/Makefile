RAYLIB := $(shell brew --prefix raylib)
FIRMWARE := ../firmware/src
SOURCES := main.cpp shim/Arduino_GFX_Library.cpp $(FIRMWARE)/pet.cpp $(FIRMWARE)/world.cpp

CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Ishim -I$(FIRMWARE) -I$(RAYLIB)/include
LDFLAGS := -L$(RAYLIB)/lib -lraylib

build/puckling-sim: $(SOURCES) $(wildcard shim/*.h $(FIRMWARE)/*.h)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) $(SOURCES) $(LDFLAGS) -o $@

.PHONY: run clean
run: build/puckling-sim
	./build/puckling-sim

clean:
	rm -rf build

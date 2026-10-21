RAYLIB := $(shell brew --prefix raylib)
FIRMWARE := ../firmware/src
SOURCES := main.cpp link.cpp shim/Arduino_GFX_Library.cpp $(FIRMWARE)/pet.cpp $(FIRMWARE)/world.cpp $(FIRMWARE)/session.cpp

CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Ishim -I$(FIRMWARE) -I$(RAYLIB)/include
LDFLAGS := -L$(RAYLIB)/lib -lraylib

build/puckling-sim: $(SOURCES) $(wildcard *.h shim/*.h $(FIRMWARE)/*.h)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) $(SOURCES) $(LDFLAGS) -o $@

.PHONY: run test clean
build/session-test: session_test.cpp $(FIRMWARE)/session.cpp $(FIRMWARE)/session.h $(FIRMWARE)/pet.h
	@mkdir -p build
	$(CXX) $(CXXFLAGS) session_test.cpp $(FIRMWARE)/session.cpp -o $@

build/link-test: link_test.cpp link.cpp link.h $(FIRMWARE)/session.cpp $(FIRMWARE)/session.h
	@mkdir -p build
	$(CXX) $(CXXFLAGS) link_test.cpp link.cpp $(FIRMWARE)/session.cpp -o $@

test: build/session-test build/link-test
	./build/session-test
	./build/link-test

run: build/puckling-sim
	./build/puckling-sim

clean:
	rm -rf build

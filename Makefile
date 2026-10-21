PIO ?= $(shell command -v pio 2>/dev/null || echo $(HOME)/.platformio/penv/bin/pio)

.PHONY: setup sim sim-live puck-live test validate-sim flash monitor

setup:
	@command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
	@xcode-select -p >/dev/null 2>&1 || { echo "Install the Xcode command line tools first: xcode-select --install"; exit 1; }
	brew list raylib >/dev/null 2>&1 || brew install raylib
	command -v pio >/dev/null || brew install platformio

sim:
	$(MAKE) -C sim run

sim-live:
	@command -v bun >/dev/null || { echo "Install Bun first: https://bun.sh"; exit 1; }
	$(MAKE) -C sim build/puckling-sim
	python3 sim/live.py

puck-live:
	@command -v bun >/dev/null || { echo "Install Bun first: https://bun.sh"; exit 1; }
	python3 daemon/serial.py $(if $(PORT),--port $(PORT))

test:
	bun test daemon
	$(MAKE) -C sim test
	python3 -m unittest discover -s daemon -p '*_test.py'

validate-sim:
	$(MAKE) -C sim build/puckling-sim
	python3 sim/validate.py

flash:
	$(PIO) run -d firmware -t upload $(if $(PORT),--upload-port $(PORT))

monitor:
	$(PIO) device monitor -d firmware $(if $(PORT),--port $(PORT))

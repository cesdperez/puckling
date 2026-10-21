.PHONY: setup sim flash monitor

setup:
	@command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
	@xcode-select -p >/dev/null 2>&1 || { echo "Install the Xcode command line tools first: xcode-select --install"; exit 1; }
	brew list raylib >/dev/null 2>&1 || brew install raylib
	command -v pio >/dev/null || brew install platformio

sim:
	$(MAKE) -C sim run

flash:
	pio run -d firmware -t upload

monitor:
	pio device monitor -d firmware

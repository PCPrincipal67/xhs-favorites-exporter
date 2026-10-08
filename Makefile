.DEFAULT_GOAL := help

BUILD_DIR ?= dist
PACKAGE_NAME ?= xhs-favorites-exporter.zip
PACKAGE := $(BUILD_DIR)/$(PACKAGE_NAME)
SOURCES := manifest.json exporter-core.js content-script.js page-bridge.js

.PHONY: all check lint test build clean help

all: check build ## Run the full local SDLC pipeline

check: lint test ## Run all quality gates

lint: ## Validate JavaScript syntax and the extension manifest
	@node --check content-script.js
	@node --check page-bridge.js
	@jq empty manifest.json

test: ## Verify manifest-referenced resources exist
	@set -eu; \
	for file in $$(jq -r '.content_scripts[]?.js[]?, .web_accessible_resources[]?.resources[]?' manifest.json); do \
		test -f "$$file" || { printf 'Missing resource: %s\n' "$$file" >&2; exit 1; }; \
	done; \
	node test/regression.js

build: check ## Build the distributable Chrome extension archive
	@mkdir -p $(BUILD_DIR)
	@rm -f $(PACKAGE)
	@zip -q -j $(PACKAGE) $(SOURCES)
	@printf 'Built %s\n' $(PACKAGE)

clean: ## Remove generated build artifacts
	@rm -rf $(BUILD_DIR)

help: ## Show available targets
	@printf 'Usage: make <target>\n\nTargets:\n'
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

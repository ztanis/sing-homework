SHELL := /bin/bash

.PHONY: install build cf-pages

install:
	npm ci

build:
	npm run build

# Cloudflare Pages (GitHub integration):
# - Build command: make cf-pages
# - Output directory: dist
cf-pages: install build

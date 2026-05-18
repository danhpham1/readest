#!/bin/bash
set -e

git clone --depth=1 https://github.com/readest/simplecc-wasm.git packages/simplecc-wasm || true
git clone --depth=1 https://github.com/readest/foliate-js.git packages/foliate-js || true

pnpm --filter @readest/readest-app setup-vendors
pnpm --filter @readest/readest-app build-web

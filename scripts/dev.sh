#!/usr/bin/env bash
set -euo pipefail

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

npm run dev:db

npm run dev:backend &
BACKEND_PID=$!

npm run dev:frontend &
FRONTEND_PID=$!

wait "${BACKEND_PID}" "${FRONTEND_PID}"

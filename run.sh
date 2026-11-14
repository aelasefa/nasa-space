#!/usr/bin/env bash
set -euo pipefail

# LUNA-01 frontend and backend
# Build & Run automation script for Docker & Docker Compose

# Resolve Compose files relative to this script, even when called elsewhere.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

COMMAND="${1:-up}"

case "$COMMAND" in
  up|start|test|logs|down|stop) ;;
  *)
    echo "Usage: $0 [up|start|test|logs|down|stop]" >&2
    exit 1
    ;;
esac

command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required." >&2; exit 1; }
docker compose version >/dev/null

case "$COMMAND" in
  up|start)
    echo "========================================================"
    echo " 🚀 Building & Starting LUNA-01 Frontend and Backend"
    echo "========================================================"
    command -v curl >/dev/null 2>&1 || { echo "Error: curl is required." >&2; exit 1; }
    docker compose build backend frontend
    echo "⏳ Waiting up to 90 seconds for both services to become healthy..."
    if ! docker compose up -d --wait --wait-timeout 90 backend frontend; then
      docker compose logs --tail=50 backend frontend >&2
      exit 1
    fi

    frontend_address="$(docker compose port frontend 8080)"
    frontend_url="http://localhost:${frontend_address##*:}"
    echo "✅ Frontend: $frontend_url"
    echo "✅ Backend: http://localhost:3000"
    echo "Checking the frontend and its API proxy..."
    curl --fail --show-error --silent --connect-timeout 5 --max-time 15 "$frontend_url/healthz"
    curl --fail --show-error --silent --connect-timeout 5 --max-time 15 "$frontend_url/" > /dev/null
    curl --fail --show-error --silent --connect-timeout 5 --max-time 15 "$frontend_url/api/catalog" > /dev/null
    echo ""
    echo "Testing API endpoints:"
    echo "1. Healthcheck:"
    curl --fail --show-error --silent --connect-timeout 5 --max-time 15 http://localhost:3000/health
    printf '\n\n'

    echo "2. Quick Mission Simulation:"
    curl --fail --show-error --silent --connect-timeout 5 --max-time 15 -X POST http://localhost:3000/api/simulate \
      -H "Content-Type: application/json" \
      -d '{
        "config": {
          "payloadId": "ice_spectrometer",
          "powerId": "solar_storage",
          "propulsionId": "prop_high",
          "commsId": "comms_high",
          "trajectoryId": "direct"
        },
        "decisions": {
          "observeAction": "observe_full",
          "downlinkAction": "science_first"
        },
        "scenarioId": "lunar_south_pole_ice_v1",
        "modelVersion": "0.1.0"
      }'
    printf '\n'
    echo ""
    echo "Use './run.sh logs' to follow logs, or './run.sh down' to stop."
    ;;

  test)
    echo "========================================================"
    echo " 🧪 Running Backend and Frontend Tests Inside Docker"
    echo "========================================================"
    docker compose run --build --rm --no-deps -T backend sh -c 'node --test dist/tests/domain/*.test.js'
    docker compose --profile test run --build --rm --no-deps -T frontend-tests
    ;;

  logs)
    docker compose logs -f
    ;;

  down|stop)
    echo "🛑 Stopping LUNA-01 Frontend and Backend..."
    docker compose --profile test down
    ;;

esac

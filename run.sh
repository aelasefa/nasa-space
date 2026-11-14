#!/usr/bin/env bash
set -e

# LUNA-01 Core Simulation & Multiverse Engine
# Build & Run automation script for Docker & Docker Compose

COMMAND="${1:-up}"

case "$COMMAND" in
  up|start)
    echo "========================================================"
    echo " 🚀 Building & Starting LUNA-01 Backend Container"
    echo "========================================================"
    docker compose build
    docker compose up -d

    echo "⏳ Waiting for backend healthcheck (http://localhost:3000/health)..."
    until curl -sf http://localhost:3000/health > /dev/null 2>&1; do
      sleep 1
    done

    echo "✅ Backend is healthy and running at http://localhost:3000"
    echo ""
    echo "Testing API endpoints:"
    echo "1. Healthcheck:"
    curl -s http://localhost:3000/health
    echo -e "\n"

    echo "2. Quick Mission Simulation:"
    curl -s -X POST http://localhost:3000/api/simulate \
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
      }' | head -n 25
    echo -e "\n..."
    echo ""
    echo "Use './run.sh logs' to follow logs, or './run.sh down' to stop."
    ;;

  test)
    echo "========================================================"
    echo " 🧪 Running Backend Domain Tests Inside Docker"
    echo "========================================================"
    docker compose run --rm backend node --test dist/tests/domain/*.test.js
    ;;

  logs)
    docker compose logs -f
    ;;

  down|stop)
    echo "🛑 Stopping LUNA-01 Backend Container..."
    docker compose down
    ;;

  *)
    echo "Usage: ./run.sh [up|test|logs|down]"
    echo "  up    - Build and launch backend container (default)"
    echo "  test  - Run test suite inside docker container"
    echo "  logs  - Follow container logs"
    echo "  down  - Stop and remove backend container"
    exit 1
    ;;
esac

#!/bin/bash

# Stop the application service
systemctl stop aiphoto-server || true

echo "Application stopped"
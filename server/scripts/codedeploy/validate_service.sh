#!/bin/bash

# Wait for the service to be ready
sleep 10

# Check if the service is running
if systemctl is-active --quiet aiphoto-server; then
    echo "Service is running"
else
    echo "Service failed to start"
    journalctl -u aiphoto-server --no-pager -l
    exit 1
fi

# Test the health endpoint
for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "Health check passed"
        exit 0
    fi
    echo "Health check attempt $i failed, retrying..."
    sleep 5
done

echo "Health check failed after 10 attempts"
exit 1
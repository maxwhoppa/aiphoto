#!/bin/bash

# Start the application service
systemctl daemon-reload
systemctl enable aiphoto-server
systemctl start aiphoto-server

echo "Application started"
#!/bin/bash

# Create docker group if it doesn't exist
sudo groupadd -f docker

# Add current user to docker group
sudo usermod -aG docker $USER

# Set proper permissions on docker.sock
sudo chmod 666 /var/run/docker.sock

# Get the docker group ID
DOCKER_GROUP_ID=$(getent group docker | cut -d: -f3)

echo "Docker group ID: $DOCKER_GROUP_ID"
echo "Please set this ID in your environment:"
echo "export DOCKER_GROUP=$DOCKER_GROUP_ID"
echo "export UID=$(id -u)"
echo "export GID=$(id -g)"
echo ""
echo "Setup complete. Please log out and log back in for changes to take effect." 
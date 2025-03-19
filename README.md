# Docker Manager API

A Node.js application that provides a REST API to interact with Docker containers.

## Prerequisites

- Node.js (v12 or higher) OR Docker and Docker Compose
- Docker installed and running on your system
- Docker daemon accessible to the application

## Running with Docker Compose (Recommended)

1. Build and start the application:
```bash
docker-compose up --build
```

2. To run in detached mode:
```bash
docker-compose up -d --build
```

3. To stop the application:
```bash
docker-compose down
```

The application will be available at `http://localhost:3000`

## Docker Connection Configuration

The application can connect to the Docker daemon using either Unix socket or TCP connection.

### 1. Unix Socket (default on Unix-based systems)
- Default path: `/var/run/docker.sock`
- Configure using: `DOCKER_SOCKET_PATH=/path/to/docker.sock`
- No additional configuration needed if using default socket path

### 2. TCP Connection
To use TCP connection, follow these steps:

1. Configure Docker daemon to listen on TCP:
   ```bash
   # Create or edit /etc/docker/daemon.json
   sudo nano /etc/docker/daemon.json
   ```
   
   Add the following content:
   ```json
   {
     "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2375"]
   }
   ```

2. Restart Docker daemon:
   ```bash
   sudo systemctl restart docker
   ```

3. Set environment variables before running the application:
   ```bash
   # For local connection
   export DOCKER_HOST=localhost
   export DOCKER_PORT=2375
   export DOCKER_PROTOCOL=http

   # For remote connection (replace with your Docker host IP)
   export DOCKER_HOST=192.168.1.100
   export DOCKER_PORT=2375
   export DOCKER_PROTOCOL=http
   ```

4. Verify Docker daemon is listening on TCP:
   ```bash
   netstat -an | grep 2375
   ```

### Security Considerations for TCP Connection

1. By default, Docker's TCP connection is not encrypted. For production use:
   - Use HTTPS (set `DOCKER_PROTOCOL=https`)
   - Configure TLS certificates
   - Use a firewall to restrict access to the Docker port

2. The default port 2375 is unencrypted. For secure connections:
   - Use port 2376 for TLS
   - Configure proper authentication

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

Start the application:
```bash
npm start
```

The server will start on port 3000 (or the port specified in the PORT environment variable).

## API Endpoints

### Get all containers
```
GET /containers
```

### Get container details
```
GET /containers/:id
```

### Stop a container
```
POST /containers/:id/stop
```

### Start a container
```
POST /containers/:id/start
```

### Get container logs
```
GET /containers/:id/logs
```

### Get container stats
```
GET /containers/:id/stats
```

## Example Usage

Using curl:

1. List all containers:
```bash
curl http://localhost:3000/containers
```

2. Get container details:
```bash
curl http://localhost:3000/containers/container_id
```

3. Stop a container:
```bash
curl -X POST http://localhost:3000/containers/container_id/stop
```

4. Start a container:
```bash
curl -X POST http://localhost:3000/containers/container_id/start
```

5. Get container logs:
```bash
curl http://localhost:3000/containers/container_id/logs
```

6. Get container stats:
```bash
curl http://localhost:3000/containers/container_id/stats
```

## Security Note

This application assumes that the Docker daemon is accessible to the Node.js process. Make sure to implement proper authentication and authorization before exposing this API to production environments.

## Security Considerations

1. When running in Docker:
   - The application mounts the Docker socket from the host
   - This gives the container access to manage other containers
   - Use with caution and implement proper authentication
   - Consider using Docker secrets for sensitive data

2. For TCP Connection:
   - By default, Docker's TCP connection is not encrypted. For production use:
     - Use HTTPS (set `DOCKER_PROTOCOL=https`)
     - Configure TLS certificates
     - Use a firewall to restrict access to the Docker port
   - The default port 2375 is unencrypted. For secure connections:
     - Use port 2376 for TLS
     - Configure proper authentication 
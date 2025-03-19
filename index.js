const express = require('express');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

// Docker connection configuration
const dockerOptions = {
    socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
};

// Check if Docker socket exists and is accessible
try {
    if (!fs.existsSync(dockerOptions.socketPath)) {
        throw new Error(`Docker socket not found at ${dockerOptions.socketPath}`);
    }
    // Check socket permissions
    const stats = fs.statSync(dockerOptions.socketPath);
    if (!stats.isSocket()) {
        throw new Error(`${dockerOptions.socketPath} is not a socket file`);
    }
} catch (error) {
    console.error('Docker socket check failed:', error.message);
    process.exit(1);
}

// Create Docker instance
const docker = new Docker(dockerOptions);

// Test Docker connection
docker.ping()
    .then(() => {
        console.log('Successfully connected to Docker daemon');
        // Get Docker info to verify connection
        return docker.info();
    })
    .then(info => {
        console.log('Docker daemon info:', {
            version: info.ServerVersion,
            containers: info.Containers,
            images: info.Images,
            name: info.Name
        });
    })
    .catch(err => {
        console.error('Failed to connect to Docker daemon:', err.message);
        console.error('Please ensure:');
        console.error('1. Docker daemon is running');
        console.error('2. Docker socket is accessible at:', dockerOptions.socketPath);
        console.error('3. Container has proper permissions to access Docker socket');
        process.exit(1);
    });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Modify the root endpoint to serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Move the containers list to a new endpoint
app.get('/api/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: false });
        const containerInfo = await Promise.all(containers.map(async (container) => {
            const info = await docker.getContainer(container.Id).inspect();
            return {
                id: container.Id.substring(0, 12),
                name: container.Names[0].replace('/', ''),
                image: container.Image,
                state: container.State,
                status: container.Status,
                ports: container.Ports.map(port => ({
                    internal: port.PrivatePort,
                    external: port.PublicPort,
                    type: port.Type
                }))
            };
        }));

        res.json({
            total: containers.length,
            containers: containerInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get container details by ID
app.get('/containers/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const info = await container.inspect();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop container
app.post('/api/containers/:id/stop', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.stop();
        res.json({ success: true, message: 'Container stopped' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start container
app.post('/api/containers/:id/start', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.start();
        res.json({ success: true, message: 'Container started' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Pause container
app.post('/api/containers/:id/pause', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.pause();
        res.json({ success: true, message: 'Container paused' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Unpause container
app.post('/api/containers/:id/unpause', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.unpause();
        res.json({ success: true, message: 'Container unpaused' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete container
app.delete('/api/containers/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.remove({ force: true });
        res.json({ success: true, message: 'Container deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get container logs
app.get('/containers/:id/logs', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            timestamps: true
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get container stats
app.get('/containers/:id/stats', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const stats = await container.stats({ stream: false });
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
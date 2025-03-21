const express = require('express');
const Docker = require('dockerode');
const path = require('path');

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions
function formatContainerData(container) {
    // Extract ports from HostConfig.PortBindings and Config.ExposedPorts
    let ports = [];
    
    // Try to extract port mappings from HostConfig and Config
    if (container.NetworkSettings && container.NetworkSettings.Ports) {
        for (const [containerPort, hostBindings] of Object.entries(container.NetworkSettings.Ports)) {
            const [port, type] = containerPort.split('/');
            if (hostBindings) {
                for (const binding of hostBindings) {
                    ports.push({
                        internal: port,
                        external: binding.HostPort,
                        type: type || 'tcp'
                    });
                }
            } else {
                ports.push({
                    internal: port,
                    external: null,
                    type: type || 'tcp'
                });
            }
        }
    }

    // Format creation date
    const created = new Date(container.Created * 1000).toLocaleString();
    
    // Extract names, removing leading slash
    const name = container.Names
        ? container.Names[0].replace(/^\//, '')
        : container.Name.replace(/^\//, '');

    return {
        id: container.Id.slice(0, 12),
        name: name,
        image: container.Image,
        state: container.State,
        status: container.Status,
        ports: ports,
        created: created
    };
}

function formatImageData(image) {
    // Handle case where RepoTags is null or empty
    let repository = '<none>';
    let tag = '<none>';
    let tags = [];

    if (image.RepoTags && image.RepoTags.length > 0) {
        // Extract the first tag for primary display
        const [repo, tg] = image.RepoTags[0].split(':');
        repository = repo;
        tag = tg || 'latest';
        // Store all tags
        tags = image.RepoTags.map(tag => tag.split(':')[1] || 'latest');
    }

    // Format creation date
    const created = new Date(image.Created * 1000).toLocaleString();
    
    // Format size to human-readable
    const size = formatSize(image.Size);

    return {
        id: image.Id.slice(0, 12),
        repository,
        tag,
        size,
        created,
        tags,
        digest: image.RepoDigests ? image.RepoDigests[0] : '',
        architecture: image.Architecture || '',
        os: image.Os || ''
    };
}

function formatVolumeData(volume) {
    // Extract the creation date from the timestamp if available
    let created = 'Unknown';
    if (volume.CreatedAt) {
        created = new Date(volume.CreatedAt).toLocaleString();
    }

    return {
        name: volume.Name,
        driver: volume.Driver,
        mountpoint: volume.Mountpoint,
        scope: volume.Scope,
        created: created,
        labels: volume.Labels || {},
        size: volume.UsageData ? volume.UsageData.Size : null
    };
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Routes
app.get('/', (req, res) => {
    res.redirect('/html/');
});

app.get('/html/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

// Containers route
app.get('/containers', (req, res) => {
    res.redirect('/html/containers.html');
});

// Images route
app.get('/images', (req, res) => {
    res.redirect('/html/images.html');
});

// Volumes route
app.get('/volumes', (req, res) => {
    res.redirect('/html/volumes.html');
});

// API Routes
// Get all containers
app.get('/api/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const formattedContainers = containers.map(formatContainerData);

        res.json({
            success: true,
            total: formattedContainers.length,
            containers: formattedContainers
        });
    } catch (error) {
        console.error('Error listing containers:', error);
        res.status(500).json({
            success: false,
            error: `Failed to list containers: ${error.message}`
        });
    }
});

// Container actions (start, stop, pause, unpause, restart)
app.post('/api/containers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    
    try {
        const container = docker.getContainer(id);
        
        switch (action) {
            case 'start':
                await container.start();
                break;
            case 'stop':
                await container.stop();
                break;
            case 'pause':
                await container.pause();
                break;
            case 'unpause':
                await container.unpause();
                break;
            case 'restart':
                await container.restart();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Invalid action: ${action}`
                });
        }
        
        res.json({
            success: true,
            message: `Container ${action} successful`
        });
    } catch (error) {
        console.error(`Error ${action} container:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to ${action} container: ${error.message}`
        });
    }
});

// Delete a container
app.delete('/api/containers/:id', async (req, res) => {
    const { id } = req.params;
    const force = req.query.force === 'true';
    
    try {
        const container = docker.getContainer(id);
        await container.remove({ force });
        
        res.json({
            success: true,
            message: 'Container deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting container:', error);
        res.status(500).json({
            success: false,
            error: `Failed to delete container: ${error.message}`
        });
    }
});

// Get all images
app.get('/api/images', async (req, res) => {
    try {
        const images = await docker.listImages();
        const formattedImages = images.map(formatImageData);

        res.json({
            success: true,
            total: formattedImages.length,
            images: formattedImages
        });
    } catch (error) {
        console.error('Error listing images:', error);
        res.status(500).json({
            success: false,
            error: `Failed to list images: ${error.message}`
        });
    }
});

// Pull an image
app.post('/api/images/pull', async (req, res) => {
    const { image } = req.body;
    
    if (!image) {
        return res.status(400).json({
            success: false,
            error: 'Image name is required'
        });
    }
    
    try {
        console.log(`Pulling image: ${image}`);
        
        // Parse the image name and tag
        const [imageName, tag] = image.split(':');
        const options = {
            fromImage: imageName,
            tag: tag || 'latest'
        };
        
        // Create a stream for the image pull
        const stream = await docker.createImage(options);
        
        // Process the stream
        stream.on('data', (data) => {
            const output = JSON.parse(data.toString());
            console.log(output);
        });
        
        // Return a response when the pull is complete
        stream.on('end', () => {
            res.json({
                success: true,
                message: `Successfully pulled ${image}`
            });
        });
        
        stream.on('error', (error) => {
            console.error('Error in pull stream:', error);
            res.status(500).json({
                success: false,
                error: `Error pulling image: ${error.message}`
            });
        });
    } catch (error) {
        console.error('Error pulling image:', error);
        res.status(500).json({
            success: false,
            error: `Failed to pull image: ${error.message}`
        });
    }
});

// Delete an image
app.delete('/api/images/:id', async (req, res) => {
    const { id } = req.params;
    const force = req.query.force === 'true';
    
    try {
        const image = docker.getImage(id);
        await image.remove({ force });
        
        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        
        // Check if the error is because the image is being used by a container
        if (error.message.includes('image is being used by running container')) {
            return res.status(409).json({
                success: false,
                error: 'Image is being used by a running container. Use force=true to force delete.',
                inUse: true
            });
        }
        
        res.status(500).json({
            success: false,
            error: `Failed to delete image: ${error.message}`
        });
    }
});

// Get all volumes
app.get('/api/volumes', async (req, res) => {
    try {
        const volumes = await docker.listVolumes();
        const formattedVolumes = volumes.Volumes.map(formatVolumeData);

        res.json({
            success: true,
            total: formattedVolumes.length,
            volumes: formattedVolumes
        });
    } catch (error) {
        console.error('Error listing volumes:', error);
        res.status(500).json({
            success: false,
            error: `Failed to list volumes: ${error.message}`
        });
    }
});

// Create a volume
app.post('/api/volumes', async (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({
            success: false,
            error: 'Volume name is required'
        });
    }
    
    try {
        const volume = await docker.createVolume({
            Name: name,
            Driver: 'local'
        });
        
        res.json({
            success: true,
            message: 'Volume created successfully',
            volume: formatVolumeData(volume)
        });
    } catch (error) {
        console.error('Error creating volume:', error);
        res.status(500).json({
            success: false,
            error: `Failed to create volume: ${error.message}`
        });
    }
});

// Delete a volume
app.delete('/api/volumes/:name', async (req, res) => {
    const { name } = req.params;
    
    try {
        const volume = docker.getVolume(name);
        await volume.remove();
        
        res.json({
            success: true,
            message: 'Volume deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting volume:', error);
        
        // Check if the error is because the volume is being used
        if (error.message.includes('volume is in use')) {
            return res.status(409).json({
                success: false,
                error: 'Volume is in use by one or more containers.',
                inUse: true
            });
        }
        
        res.status(500).json({
            success: false,
            error: `Failed to delete volume: ${error.message}`
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
const express = require('express');
const Docker = require('dockerode');
const app = express();
const docker = new Docker();

app.use(express.json());
app.use(express.static('public'));

function formatContainerData(container) {
    // Get a clean name without the leading slash
    const name = container.Names[0].replace('/', '');
    
    // Format ports data
    const ports = container.Ports.map(port => ({
        internal: port.PrivatePort,
        external: port.PublicPort,
        type: port.Type
    }));

    // Get the state and status
    const state = container.State.toLowerCase();
    const status = container.Status || (state === 'exited' ? `Exited (${container.ExitCode})` : state);

    return {
        id: container.Id.substring(0, 12),
        name: name,
        image: container.Image,
        state: state,
        status: status,
        ports: ports,
        created: new Date(container.Created * 1000).toLocaleString(),
        exitCode: container.ExitCode
    };
}

function formatImageData(image) {
    const tags = image.RepoTags || [];
    const [repository, tag] = (tags[0] || 'none:none').split(':');
    
    return {
        id: image.Id.split(':')[1].substring(0, 12),
        repository: repository,
        tag: tag,
        size: (image.Size / (1024 * 1024)).toFixed(2) + ' MB',
        created: new Date(image.Created * 1000).toLocaleString(),
        tags: tags,
        digest: image.RepoDigests ? image.RepoDigests[0] : 'N/A',
        architecture: image.Architecture || 'N/A',
        os: image.Os || 'N/A'
    };
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/images', (req, res) => {
    res.sendFile(__dirname + '/public/images.html');
});

app.get('/api/containers', async (req, res) => {
    try {
        // List all containers with all=true
        const containers = await docker.listContainers({ all: true });
        
        // Get detailed information for each container
        const containersWithDetails = await Promise.all(
            containers.map(async (container) => {
                try {
                    const containerInstance = docker.getContainer(container.Id);
                    const inspectData = await containerInstance.inspect();
                    
                    // Merge inspect data with container data
                    container.ExitCode = inspectData.State.ExitCode;
                    container.State = inspectData.State.Status;
                    
                    return container;
                } catch (error) {
                    console.error(`Error inspecting container ${container.Id}:`, error);
                    return container;
                }
            })
        );

        res.json({
            success: true,
            total: containers.length,
            containers: containersWithDetails.map(formatContainerData)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/containers/:id/:action', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const action = req.params.action;

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
                throw new Error('Invalid action');
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/containers/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.remove({ force: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Image-related routes remain unchanged
app.get('/api/images', async (req, res) => {
    try {
        const images = await docker.listImages();
        res.json({
            success: true,
            total: images.length,
            images: images.map(formatImageData)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/images/pull', async (req, res) => {
    try {
        const imageName = req.body.image;
        if (!imageName) {
            throw new Error('Image name is required');
        }

        await docker.pull(imageName);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/images/:id', async (req, res) => {
    try {
        const image = docker.getImage(req.params.id);
        await image.remove({ force: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
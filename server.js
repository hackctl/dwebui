const express = require('express');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

// Docker connection configuration following the same pattern as the working index.js
const dockerOptions = {
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
};

// Check if Docker socket exists and is accessible
try {
  console.log('Checking Docker socket at', dockerOptions.socketPath);
  if (!fs.existsSync(dockerOptions.socketPath)) {
    throw new Error(`Docker socket not found at ${dockerOptions.socketPath}`);
  }
  // Check socket permissions
  const stats = fs.statSync(dockerOptions.socketPath);
  if (!stats.isSocket()) {
    throw new Error(`${dockerOptions.socketPath} is not a socket file`);
  }
  console.log('Docker socket exists and is accessible');
} catch (error) {
  console.error('Docker socket check failed:', error.message);
  console.error('Will attempt to connect anyway...');
}

// Create Docker instance
let docker;
try {
  docker = new Docker(dockerOptions);
  console.log('Docker client initialized');
} catch (error) {
  console.error('Failed to initialize Docker client:', error.message);
  docker = null;
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`REQUEST: ${req.method} ${req.url}`);
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Debug endpoint to verify server is working
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Debug endpoint to show all routes
app.get('/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0].toUpperCase()
      });
    }
  });
  
  res.json({ success: true, routes });
});

// Navigation routes
app.get('/containers', (req, res) => {
  res.redirect('/html/containers.html');
});

app.get('/images', (req, res) => {
  res.redirect('/html/images.html');
});

app.get('/volumes', (req, res) => {
  res.redirect('/html/volumes.html');
});

// *** CRITICAL API ROUTES ***

// Get container stats
async function getDockerStats() {
  if (!docker) return null;
  
  try {
    const containers = await docker.listContainers({ all: true });
    let totalCpu = 0;
    let totalMemory = 0;
    let totalIO = 0;

    for (const container of containers) {
      if (container.State === 'running') {
        const containerInstance = docker.getContainer(container.Id);
        const stats = await containerInstance.stats({ stream: false });
        
        // Calculate CPU usage
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * 100;
        totalCpu += cpuPercent;

        // Calculate memory usage (in MB)
        const memoryUsage = stats.memory_stats.usage / (1024 * 1024);
        totalMemory += memoryUsage;

        // Calculate I/O usage (in MB/s)
        const ioRead = stats.blkio_stats.io_service_bytes_recursive?.[0]?.value || 0;
        const ioWrite = stats.blkio_stats.io_service_bytes_recursive?.[1]?.value || 0;
        totalIO += (ioRead + ioWrite) / (1024 * 1024);
      }
    }

    return {
      cpu: totalCpu.toFixed(2),
      memory: totalMemory.toFixed(2),
      io: totalIO.toFixed(2)
    };
  } catch (error) {
    console.error('Error getting Docker stats:', error);
    return null;
  }
}

// Get all containers
app.get('/api/containers', async (req, res) => {
  try {
    if (!docker) {
      return res.json({
        success: false,
        error: 'Docker client not initialized'
      });
    }
    
    const containers = await docker.listContainers({ all: true });
    
    const formattedContainers = containers.map(container => {
      // Basic container info
      return {
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace(/^\//, ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        created: new Date(container.Created * 1000).toISOString().split('T')[0],
        ports: container.Ports.map(port => ({
          internal: port.PrivatePort || 'N/A',
          external: port.PublicPort || 'N/A',
          type: port.Type || 'tcp'
        })),
        mounts: container.Mounts.map(mount => ({
          type: mount.Type,
          name: mount.Name,
          source: mount.Source,
          destination: mount.Destination
        }))
      };
    });
    
    return res.json({
      success: true,
      total: formattedContainers.length,
      containers: formattedContainers
    });
  } catch (error) {
    console.error('Error getting containers:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Get all images - SIMPLIFIED VERSION
// Get system stats
app.get('/api/stats', async (req, res) => {
  try {
    if (!docker) {
      return res.json({
        success: false,
        error: 'Docker client not initialized'
      });
    }

    const stats = await getDockerStats();
    if (stats) {
      res.json({
        success: true,
        ...stats
      });
    } else {
      throw new Error('Failed to get Docker stats');
    }
  } catch (error) {
    console.error('Error getting stats:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/images', async (req, res) => {
  console.log('API REQUEST: GET /api/images');
  
  try {
    if (!docker) {
      return res.json({
        success: false,
        error: 'Docker client not initialized'
      });
    }
    
    console.log('Fetching images from Docker...');
    const images = await docker.listImages({ all: true });
    console.log(`Found ${images.length} images`);
    
    // Improved consistent formatting matching containers
    const formattedImages = images.map(image => {
      // Handle missing RepoTags array
      const repoTags = image.RepoTags && image.RepoTags.length > 0 ? image.RepoTags[0] : '<none>:<none>';
      const [repository, tag] = repoTags.split(':');
      
      // Calculate readable size with unit
      const bytes = image.Size || 0;
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes > 0 ? bytes : 1) / Math.log(1024));
      const size = (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
      
      // Format creation date
      const created = image.Created 
        ? new Date(image.Created * 1000).toISOString().split('T')[0]
        : 'Unknown';
        
      return {
        id: image.Id ? image.Id.substring(7, 19) : 'Unknown',
        repository: repository || '<none>',
        tag: tag || '<none>',
        size: size,
        created: created,
        labels: image.Labels || {}
      };
    });
    
    console.log('Sending images response');
    return res.json({
      success: true,
      total: formattedImages.length,
      images: formattedImages
    });
  } catch (error) {
    console.error('Error getting images:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Get all volumes - SIMPLIFIED VERSION
app.get('/api/volumes', async (req, res) => {
  console.log('API REQUEST: GET /api/volumes');
  
  try {
    if (!docker) {
      return res.json({
        success: false,
        error: 'Docker client not initialized'
      });
    }
    
    console.log('Fetching volumes from Docker...');
    const volumeData = await docker.listVolumes();
    const volumes = volumeData.Volumes || [];
    console.log(`Found ${volumes.length} volumes`);
    
    // Improved consistent formatting matching containers
    const formattedVolumes = volumes.map(volume => {
      // Format creation date if available
      let created = 'Unknown';
      if (volume.CreatedAt) {
        try {
          // Try to parse the creation date
          const date = new Date(volume.CreatedAt);
          created = date.toISOString().split('T')[0];
        } catch (e) {
          created = volume.CreatedAt;
        }
      }
      
      return {
        name: volume.Name || 'Unknown',
        driver: volume.Driver || 'local',
        mountpoint: volume.Mountpoint || 'Unknown',
        created: created,
        size: '—', // Volumes don't report size by default
        labels: volume.Labels || {},
        scope: volume.Scope || 'local',
        options: volume.Options || {}
      };
    });
    
    console.log('Sending volumes response');
    return res.json({
      success: true,
      total: formattedVolumes.length,
      volumes: formattedVolumes
    });
  } catch (error) {
    console.error('Error getting volumes:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Pull an image
app.post('/api/images/pull', async (req, res) => {
  const { image } = req.body;
  
  if (!image) {
    return res.json({
      success: false,
      error: 'Image name is required'
    });
  }
  
  try {
    const [repository, tag = 'latest'] = image.split(':');
    
    await new Promise((resolve, reject) => {
      docker.pull(`${repository}:${tag}`, (err, stream) => {
        if (err) return reject(err);
        
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
    
    return res.json({
      success: true,
      message: `Successfully pulled ${image}`
    });
  } catch (error) {
    console.error('Error pulling image:', error);
    return res.json({
      success: false,
      error: error.message
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
    
    return res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    if (error.message.includes('image is being used') || error.message.includes('conflict:')) {
      return res.json({
        success: false,
        error: 'Image is being used by a container',
        inUse: true
      });
    }
    
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Container actions
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
        return res.json({
          success: false,
          error: `Invalid action: ${action}`
        });
    }
    
    return res.json({
      success: true,
      message: `Container ${action} successful`
    });
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
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
    
    return res.json({
      success: true,
      message: 'Container deleted successfully'
    });
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Global 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.url}`
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} and listening on all interfaces`);
  console.log('Routes registered:');
  app._router.stack.forEach(layer => {
    if (layer.route) {
      console.log(`${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
    }
  });
});
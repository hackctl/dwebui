function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.opacity = 1;
    setTimeout(() => {
        toast.style.opacity = 0;
    }, 3000);
}

function showLoading(show = true) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function formatSize(size) {
    if (size === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return `${(size / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

async function createVolume() {
    const volumeName = document.getElementById('volume-name').value.trim();
    if (!volumeName) {
        showToast('Please enter a volume name', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch('/api/volumes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: volumeName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Volume created successfully');
            document.getElementById('volume-name').value = '';
            fetchVolumes();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast(`Failed to create volume: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteVolume(name) {
    if (!confirm('Are you sure you want to delete this volume?')) {
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`/api/volumes/${name}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Volume deleted successfully');
            fetchVolumes();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast(`Failed to delete volume: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchVolumes() {
    try {
        showLoading(true);
        const response = await fetch('/api/volumes');
        const data = await response.json();
        
        const volumesDiv = document.getElementById('volumes');
        document.getElementById('total-volumes').textContent = 
            `Total Volumes: ${data.total}`;
        
        if (data.volumes.length === 0) {
            volumesDiv.innerHTML = '<div class="container">No volumes found</div>';
            return;
        }

        volumesDiv.innerHTML = data.volumes
            .map(volume => `
                <div class="container">
                    <div class="container-header">
                        <span class="container-name">${volume.name}</span>
                    </div>
                    <div class="container-details">
                        <div>Driver: ${volume.driver}</div>
                        <div>Mount Point: ${volume.mountpoint}</div>
                        <div>Created: ${volume.created}</div>
                        <div>Scope: ${volume.scope}</div>
                        ${volume.size ? `<div>Size: ${formatSize(volume.size)}</div>` : ''}
                        ${volume.labels && Object.keys(volume.labels).length > 0 ? `
                            <div style="margin-top: 10px;">
                                Labels: ${Object.entries(volume.labels).map(([key, value]) => 
                                    `<span class="label">${key}=${value}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="action-section">
                        <button 
                            class="action-button delete-button" 
                            onclick="deleteVolume('${volume.name}')">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');
    } catch (error) {
        console.error('Error fetching volumes:', error);
        document.getElementById('volumes').innerHTML = 
            '<div class="container" style="color: red;">Error fetching volumes</div>';
    } finally {
        showLoading(false);
    }
}

// Initialize volumes page
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchVolumes();

    // Add event listener for Enter key on volume create input
    document.getElementById('volume-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            createVolume();
        }
    });

    // Set up refresh button event listener
    document.querySelector('.refresh-button').addEventListener('click', fetchVolumes);

    // Set up create button event listener
    document.querySelector('.create-form button').addEventListener('click', createVolume);

    // Refresh every 30 seconds
    setInterval(fetchVolumes, 30000);
}); 
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
        console.log(`Creating volume: ${volumeName}`);
        
        // Use the API helper instead of direct fetch
        const data = await api.post('/api/volumes', { name: volumeName });
        console.log('Create volume response:', data);
        
        if (data.success) {
            showToast('Volume created successfully');
            document.getElementById('volume-name').value = '';
            await fetchVolumes();
        } else {
            throw new Error(data.error || 'Failed to create volume');
        }
    } catch (error) {
        console.error('Error creating volume:', error);
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
        console.log(`Deleting volume: ${name}`);
        
        // Use the API helper instead of direct fetch
        const data = await api.delete(`/api/volumes/${name}`);
        console.log('Delete volume response:', data);
        
        if (data.success) {
            showToast('Volume deleted successfully');
            await fetchVolumes();
        } else {
            // Check if volume is in use and handle appropriately
            if (data.inUse) {
                showToast('This volume is in use by containers and cannot be deleted', 'error');
            } else {
                throw new Error(data.error || 'Failed to delete volume');
            }
        }
    } catch (error) {
        console.error('Error deleting volume:', error);
        showToast(`Failed to delete volume: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchVolumes() {
    try {
        showLoading(true);
        console.log('Fetching volumes from API...');
        
        // Use the API helper instead of direct fetch with full URL
        const data = await api.get('/api/volumes');
        console.log('Volumes API response:', data);
        
        // Process the data
        if (!data || !data.success) {
            throw new Error(data.error || 'Failed to fetch volumes data');
        }
        
        const volumes = data.volumes || [];
        const totalVolumes = data.total || 0;
        
        document.getElementById('total-volumes').textContent = `Total Volumes: ${totalVolumes}`;
        
        const volumesContainer = document.getElementById('volumes');
        volumesContainer.innerHTML = ''; // Clear the container before adding new content
        
        // Handle empty volume list
        if (volumes.length === 0) {
            volumesContainer.innerHTML = '<p class="no-data">No volumes found</p>';
            return;
        }
        
        // Create the table for volumes
        let table = document.createElement('table');
        table.className = 'data-table';
        
        // Create table header
        let thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Name</th>
                <th>Driver</th>
                <th>Mountpoint</th>
                <th>Created</th>
                <th>Size</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Create table body
        let tbody = document.createElement('tbody');
        
        // Add rows for each volume
        volumes.forEach(volume => {
            let row = document.createElement('tr');
            
            // Create cells for volume properties
            row.innerHTML = `
                <td>${volume.name}</td>
                <td>${volume.driver}</td>
                <td title="${volume.mountpoint}">${volume.mountpoint.substring(0, 30)}${volume.mountpoint.length > 30 ? '...' : ''}</td>
                <td>${volume.created}</td>
                <td>${volume.size}</td>
                <td class="actions">
                    <button class="action-button delete-button" onclick="deleteVolume('${volume.name}')">Delete</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        volumesContainer.appendChild(table);
    } catch (error) {
        console.error('Error fetching volumes:', error);
        showToast(`Error fetching volumes: ${error.message}`, 'error');
        
        // Display error in the volumes container
        const volumesContainer = document.getElementById('volumes');
        volumesContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
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
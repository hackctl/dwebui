function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.style.opacity = 1;
    setTimeout(() => {
        toast.style.opacity = 0;
    }, 3000);
}

function getStatusClass(state) {
    switch (state.toLowerCase()) {
        case 'running':
            return 'status-running';
        case 'exited':
            return 'status-exited';
        case 'paused':
            return 'status-paused';
        case 'created':
            return 'status-created';
        default:
            return '';
    }
}

function showLoading(show = true) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

async function containerAction(id, action) {
    try {
        showLoading(true);
        console.log(`Performing ${action} on container ${id}`);
        
        let data;
        if (action === 'delete') {
            data = await api.delete(`/api/containers/${id}`);
        } else {
            data = await api.post(`/api/containers/${id}/${action}`);
        }
        
        console.log(`Container ${action} response:`, data);
        
        if (data.success) {
            showToast(`Container ${action} successful`);
            // Refresh the containers list
            await fetchContainers();
        } else {
            showToast(data.error || `Failed to ${action} container`, 'error');
        }
    } catch (error) {
        console.error(`Error performing ${action}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function getActionButtons(container) {
    const state = container.state.toLowerCase();
    return `
        <div class="action-section">
            <button 
                class="action-button start-button" 
                onclick="containerAction('${container.id}', 'start')"
                ${state === 'running' ? 'disabled' : ''}>
                Start
            </button>
            <button 
                class="action-button stop-button" 
                onclick="containerAction('${container.id}', 'stop')"
                ${state !== 'running' ? 'disabled' : ''}>
                Stop
            </button>
            <button 
                class="action-button pause-button" 
                onclick="containerAction('${container.id}', '${state === 'paused' ? 'unpause' : 'pause'}')"
                ${state !== 'running' && state !== 'paused' ? 'disabled' : ''}>
                ${state === 'paused' ? 'Unpause' : 'Pause'}
            </button>
            <button 
                class="action-button restart-button" 
                onclick="containerAction('${container.id}', 'restart')"
                ${state !== 'running' ? 'disabled' : ''}>
                Restart
            </button>
            <button 
                class="action-button delete-button" 
                onclick="if(confirm('Are you sure you want to delete this container?')) containerAction('${container.id}', 'delete')">
                Delete
            </button>
        </div>
    `;
}

async function fetchContainers() {
    try {
        showLoading(true);
        console.log('Fetching containers from API...');
        
        // Use the API helper instead of direct fetch
        const data = await api.get('/api/containers');
        console.log('Containers API response:', data);
        
        const containersDiv = document.getElementById('containers');
        document.getElementById('total-containers').textContent = 
            `Total Containers: ${data.total || 0}`;
        
        if (!data.containers || data.containers.length === 0) {
            containersDiv.innerHTML = '<div class="container">No containers found</div>';
            return;
        }

        containersDiv.innerHTML = data.containers
            .map(container => `
                <div class="container">
                    <div class="container-header">
                        <span class="container-name">${container.name}</span>
                        <span class="container-status ${getStatusClass(container.state)}">${container.state}</span>
                    </div>
                    <div class="container-details">
                        <div>ID: ${container.id}</div>
                        <div>Image: ${container.image}</div>
                        <div>Status: ${container.status}</div>
                        <div class="ports">
                            Ports: ${container.ports && container.ports.length ? container.ports.map(port => 
                                `<span class="port-mapping">${port.internal}:${port.external || 'N/A'} (${port.type})</span>`
                            ).join(' ') : 'None'}
                        </div>
                        <div class="created-date">Created: ${container.created}</div>
                    </div>
                    ${getActionButtons(container)}
                </div>
            `).join('');
    } catch (error) {
        console.error('Error fetching containers:', error);
        document.getElementById('containers').innerHTML = 
            `<div class="container" style="color: red;">
                Error fetching containers: ${error.message}
                <p>Check the browser console for more details.</p>
                <p>Make sure the Docker socket is properly mounted and accessible.</p>
            </div>`;
    } finally {
        showLoading(false);
    }
}

// Initialize containers page
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchContainers();

    // Refresh every 30 seconds
    setInterval(fetchContainers, 30000);

    // Set up refresh button event listener
    document.querySelector('.refresh-button').addEventListener('click', fetchContainers);
}); 
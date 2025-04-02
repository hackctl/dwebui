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

async function pullImage() {
    const imageName = document.getElementById('image-name').value.trim();
    if (!imageName) {
        showToast('Please enter an image name', 'error');
        return;
    }

    try {
        showLoading(true);
        console.log(`Attempting to pull image: ${imageName}`);

        // Use the API helper instead of direct fetch
        const data = await api.post('/api/images/pull', { image: imageName });
        console.log('Pull image response:', data);
        
        if (data.success) {
            showToast(data.message || `Successfully pulled image: ${imageName}`);
            document.getElementById('image-name').value = '';
            await fetchImages();
        } else {
            throw new Error(data.error || 'Failed to pull image');
        }
    } catch (error) {
        console.error('Error pulling image:', error);
        showToast(`Error pulling image: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteImage(id, force = false) {
    if (!confirm(`Are you sure you want to ${force ? 'force ' : ''}delete this image?`)) {
        return;
    }

    try {
        showLoading(true);
        console.log(`Deleting image ${id} with force=${force}`);
        
        // Use the API helper instead of direct fetch
        const endpoint = force ? 
            `/api/images/${id}?force=true` : 
            `/api/images/${id}`;
            
        const data = await api.delete(endpoint);
        console.log('Delete image response:', data);
        
        if (data.success) {
            showToast('Image deleted successfully');
            await fetchImages();
        } else {
            // Check if image is in use and force option wasn't selected
            if (data.inUse && !force) {
                if (confirm('This image is being used by containers. Would you like to force delete?')) {
                    await deleteImage(id, true);
                }
            } else {
                showToast(data.error || 'Failed to delete image', 'error');
            }
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        showToast(`Failed to delete image: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchImages() {
    try {
        showLoading(true);
        console.log('Fetching images from API...');
        
        // Use the API helper instead of direct fetch with full URL
        const data = await api.get('/api/images');
        console.log('Images API response:', data);
        
        // Process the data
        if (!data || !data.success) {
            throw new Error(data.error || 'Failed to fetch images data');
        }
        
        const images = data.images || [];
        const totalImages = data.total || 0;
        
        document.getElementById('total-images').textContent = `Total Images: ${totalImages}`;
        
        const imagesContainer = document.getElementById('images');
        imagesContainer.innerHTML = ''; // Clear the container before adding new content
        
        // Handle empty image list
        if (images.length === 0) {
            imagesContainer.innerHTML = '<p class="no-data">No images found</p>';
            return;
        }
        
        // Create the table for images
        let table = document.createElement('table');
        table.className = 'data-table';
        
        // Create table header
        let thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Image Name</th>
                <th>Tag</th>
                <th>Image ID</th>
                <th>Created</th>
                <th>Size</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Create table body
        let tbody = document.createElement('tbody');
        
        // Add rows for each image
        images.forEach(image => {
            let row = document.createElement('tr');
            
            // Create cells for image properties
            row.innerHTML = `
                <td>${image.repository}</td>
                <td>${image.tag}</td>
                <td>${image.id}</td>
                <td>${image.created}</td>
                <td>${image.size}</td>
                <td class="actions">
                    <button class="action-button delete-button" onclick="deleteImage('${image.id}')">Delete</button>
                    <button class="action-button delete-button" onclick="deleteImage('${image.id}', true)">Force Delete</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        imagesContainer.appendChild(table);
    } catch (error) {
        console.error('Error fetching images:', error);
        showToast(`Error fetching images: ${error.message}`, 'error');
        
        // Display error in the images container
        const imagesContainer = document.getElementById('images');
        imagesContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    } finally {
        showLoading(false);
    }
}

// Initialize images page
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchImages();

    // Add event listener for Enter key on image pull input
    document.getElementById('image-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            pullImage();
        }
    });

    // Set up refresh button event listener
    document.querySelector('.refresh-button').addEventListener('click', fetchImages);

    // Set up pull button event listener
    document.querySelector('.pull-form button').addEventListener('click', pullImage);

    // Refresh every 30 seconds
    setInterval(fetchImages, 30000);
}); 
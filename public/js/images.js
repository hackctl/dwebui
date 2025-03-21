function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
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
        showToast('Please enter an image name', true);
        return;
    }

    try {
        showLoading(true);
        console.log(`Attempting to pull image: ${imageName}`);

        const response = await fetch('/api/images/pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ image: imageName })
        });

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Received non-JSON response:', await response.text());
            throw new Error('Server returned non-JSON response. Check server logs.');
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Failed to pull image: ${response.statusText}`);
        }

        if (data.success) {
            showToast(data.message || `Successfully pulled image: ${imageName}`);
            document.getElementById('image-name').value = '';
            await fetchImages();
        } else {
            throw new Error(data.error || 'Failed to pull image');
        }
    } catch (error) {
        console.error('Error pulling image:', error);
        showToast(error.message || 'Failed to pull image', true);
    } finally {
        showLoading(false);
    }
}

async function deleteImage(id) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`/api/images/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Image deleted successfully');
            fetchImages();
        } else {
            showToast(data.error, true);
        }
    } catch (error) {
        showToast(`Failed to delete image: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}

async function fetchImages() {
    try {
        showLoading(true);
        const response = await fetch('/api/images');
        const data = await response.json();
        
        const imagesDiv = document.getElementById('images');
        document.getElementById('total-images').textContent = 
            `Total Images: ${data.total}`;
        
        if (data.images.length === 0) {
            imagesDiv.innerHTML = '<div class="container">No images found</div>';
            return;
        }

        imagesDiv.innerHTML = data.images
            .map(image => `
                <div class="container">
                    <div class="container-header">
                        <span class="container-name">${image.repository}:${image.tag}</span>
                    </div>
                    <div class="container-details">
                        <div>ID: ${image.id}</div>
                        <div>Size: ${image.size}</div>
                        <div>Created: ${image.created}</div>
                        <div>Architecture: ${image.architecture}</div>
                        <div>OS: ${image.os}</div>
                        <div style="margin-top: 10px;">
                            Tags: ${image.tags.map(tag => 
                                `<span class="image-tag">${tag}</span>`
                            ).join(' ')}
                        </div>
                    </div>
                    <div class="action-section">
                        <button 
                            class="action-button delete-button" 
                            onclick="deleteImage('${image.id}')">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');
    } catch (error) {
        console.error('Error fetching images:', error);
        document.getElementById('images').innerHTML = 
            '<div class="container" style="color: red;">Error fetching images</div>';
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
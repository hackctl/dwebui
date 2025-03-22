/**
 * API Helper functions to ensure consistent path handling across the application
 */

// Get the base URL for API requests
function getApiBaseUrl() {
    return window.location.origin;
}

// Build a complete API URL from a path
function buildApiUrl(path) {
    // Ensure path starts with a slash
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    
    // Just return the path - this is a critical fix for IP-based access
    console.log(`Using relative API path: ${path}`);
    return path;
}

// Fetch API helper with logging and error handling
async function apiRequest(path, options = {}) {
    const url = buildApiUrl(path);
    console.log(`API ${options.method || 'GET'} request to: ${url}`);
    
    try {
        const response = await fetch(url, options);
        
        // Check if response is OK
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}): ${errorText}`);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        // Try to parse as JSON
        try {
            return await response.json();
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            const text = await response.text();
            console.error('Raw response:', text.substring(0, 500));
            throw new Error('Invalid JSON response from server');
        }
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Common API helper methods
const api = {
    // Get data from API
    async get(path) {
        return apiRequest(path);
    },
    
    // Post data to API
    async post(path, data) {
        return apiRequest(path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },
    
    // Delete resource
    async delete(path) {
        return apiRequest(path, {
            method: 'DELETE'
        });
    }
}; 
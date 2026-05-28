const API_URL = process.env.CS2_API_URL;
const API_KEY = process.env.CS2_API_KEY;

const get = async (path) => {
    const response = await fetch(`${API_URL}${path}`, {
        headers: { 'x-api-key': API_KEY }
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return response.json();
};

const post = async (path, body) => {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return response.json();
};

const del = async (path) => {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return response.json();
};

module.exports = { get, post, del };
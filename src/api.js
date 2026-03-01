import axios from 'axios'

const API = import.meta.env.VITE_API_URL;

const api = axios.create({
    baseURL: `${API}/api`,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
})

// Response interceptor for error normalisation
api.interceptors.response.use(
    (res) => res,
    (error) => {
        const message = error?.response?.data?.detail || error.message || 'Network error';
        const customError = new Error(message);
        customError.response = error.response; // preserve response
        return Promise.reject(customError);
    }
)

export default api

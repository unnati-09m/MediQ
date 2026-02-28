import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
})

// Response interceptor for error normalisation
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const message = err?.response?.data?.detail || err.message || 'Network error'
        return Promise.reject(new Error(message))
    }
)

export default api

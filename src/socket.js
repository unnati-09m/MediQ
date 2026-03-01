import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL;

const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
})

socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket.id)
})

socket.on('disconnect', (reason) => {
    console.warn('[Socket.IO] Disconnected:', reason)
})

socket.on('connect_error', (err) => {
    console.error('[Socket.IO] Connection error:', err.message)
})

export default socket

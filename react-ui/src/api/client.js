import axios from 'axios'

// Base URL is /api — works in both:
// Dev: Vite proxy forwards to http://localhost:3005
// Docker: nginx proxy forwards to http://query-service:3005
const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const fetchTransactions = (params) => client.get('/tx', { params })

export const fetchTransaction = (txnId) => client.get(`/tx/${txnId}`)

export const fetchTransactionEvents = (txnId) => client.get(`/tx/${txnId}/events`)

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTransactions } from '../api/client'

const STATUS_OPTIONS = ['', 'RECEIVED', 'VALIDATED', 'REJECTED', 'COMPLETED', 'FAILED']

const STATUS_COLORS = {
  RECEIVED:  '#6c757d',
  VALIDATED: '#0d6efd',
  COMPLETED: '#198754',
  REJECTED:  '#dc3545',
  FAILED:    '#dc3545',
}

export default function TransactionList() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ status: '', from: '', to: '' })
  const [applied, setApplied] = useState({ status: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = { page, limit: 20 }
        if (applied.status) params.status = applied.status
        if (applied.from)   params.from   = applied.from
        if (applied.to)     params.to     = applied.to
        const res = await fetchTransactions(params)
        setData(res.data.data)
        setPagination(res.data.pagination)
      } catch {
        setError('Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [applied, page])

  const handleSearch = () => {
    setPage(1)
    setApplied({ ...filters })
  }

  const handleReset = () => {
    const empty = { status: '', from: '', to: '' }
    setFilters(empty)
    setApplied(empty)
    setPage(1)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px', fontSize: '22px' }}>IPS Ops Console</h1>
      <p style={{ color: '#6c757d', marginBottom: '24px', fontSize: '14px' }}>Transaction Monitor</p>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Status</label>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dee2e6', minWidth: '160px', fontSize: '14px' }}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>From</label>
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dee2e6', fontSize: '14px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>To</label>
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #dee2e6', fontSize: '14px' }}
          />
        </div>
        <button
          onClick={handleSearch}
          style={{ padding: '8px 20px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
        >
          Search
        </button>
        <button
          onClick={handleReset}
          style={{ padding: '8px 20px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
        >
          Reset
        </button>
      </div>

      {error && <p style={{ color: '#dc3545', marginBottom: '16px' }}>{error}</p>}
      {loading && <p style={{ color: '#6c757d' }}>Loading...</p>}

      {/* Table */}
      {!loading && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Txn ID', 'Type', 'Payer', 'Payee', 'Amount', 'Channel', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#6c757d' }}>
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  data.map(tx => (
                    <tr
                      key={tx.txn_id}
                      onClick={() => navigate(`/tx/${tx.txn_id}`)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #dee2e6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>{tx.txn_id.slice(0, 8)}…</td>
                      <td style={{ padding: '10px' }}>{tx.type}</td>
                      <td style={{ padding: '10px' }}>{tx.payer_id}</td>
                      <td style={{ padding: '10px' }}>{tx.payee_id}</td>
                      <td style={{ padding: '10px' }}>{Number(tx.amount).toFixed(2)}</td>
                      <td style={{ padding: '10px' }}>{tx.channel}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: STATUS_COLORS[tx.status] || '#6c757d', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(tx.requested_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 16px', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '4px', border: '1px solid #dee2e6', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                Page {page} of {pagination.pages} &nbsp;·&nbsp; {pagination.total} total
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                style={{ padding: '6px 16px', cursor: page === pagination.pages ? 'not-allowed' : 'pointer', borderRadius: '4px', border: '1px solid #dee2e6', opacity: page === pagination.pages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

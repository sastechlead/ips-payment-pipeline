import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchTransaction, fetchTransactionEvents } from '../api/client'

const STATUS_COLORS = {
  RECEIVED:  '#6c757d',
  VALIDATED: '#0d6efd',
  COMPLETED: '#198754',
  REJECTED:  '#dc3545',
  FAILED:    '#dc3545',
}

const Field = ({ label, value }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '2px' }}>{label}</div>
    <div style={{ fontSize: '14px' }}>{value || '—'}</div>
  </div>
)

export default function TransactionDetail() {
  const { txnId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [detailRes, eventsRes] = await Promise.all([
          fetchTransaction(txnId),
          fetchTransactionEvents(txnId),
        ])
        setDetail(detailRes.data)
        setEvents(eventsRes.data.events)
      } catch {
        setError('Failed to load transaction details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [txnId])

  if (loading) return <div style={{ padding: '24px' }}>Loading...</div>
  if (error)   return <div style={{ padding: '24px', color: '#dc3545' }}>{error}</div>
  if (!detail) return null

  const { transaction, ledgerEntries, notifications } = detail

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{ marginBottom: '20px', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #dee2e6', background: '#fff', fontSize: '14px' }}
      >
        ← Back to List
      </button>

      <h1 style={{ marginBottom: '24px', fontSize: '20px' }}>Transaction Detail</h1>

      {/* Transaction Info Card */}
      <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', marginBottom: '16px', borderBottom: '1px solid #dee2e6', paddingBottom: '8px' }}>Transaction Info</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
          <Field label="Txn ID" value={<span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{transaction.txn_id}</span>} />
          <Field label="Status" value={
            <span style={{ background: STATUS_COLORS[transaction.status] || '#6c757d', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
              {transaction.status}
            </span>
          } />
          <Field label="Type"      value={transaction.type} />
          <Field label="Channel"   value={transaction.channel} />
          <Field label="Payer ID"  value={transaction.payer_id} />
          <Field label="Payee ID"  value={transaction.payee_id} />
          <Field label="Amount"    value={Number(transaction.amount).toFixed(2)} />
          <Field label="Requested" value={new Date(transaction.requested_at).toLocaleString()} />
          {transaction.reason_code && (
            <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '2px' }}>Reason</div>
              <div style={{ fontSize: '14px', color: '#dc3545' }}>
                {transaction.reason_code} — {transaction.reason_text}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Timeline */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', marginBottom: '16px' }}>Event Timeline</h2>
        {events.length === 0 ? (
          <p style={{ color: '#6c757d', fontSize: '14px' }}>No events recorded yet.</p>
        ) : (
          <div style={{ borderLeft: '2px solid #dee2e6', paddingLeft: '20px' }}>
            {events.map(ev => (
              <div key={ev.id} style={{ marginBottom: '16px', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: '-27px', top: '5px',
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: STATUS_COLORS[ev.event_type] || '#0d6efd',
                  border: '2px solid #fff', outline: '1px solid #dee2e6',
                }} />
                <div style={{ background: '#f8f9fa', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{ev.event_type}</div>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </div>
                  {ev.payload_json && (
                    <pre style={{ margin: 0, fontSize: '12px', background: '#fff', padding: '8px', borderRadius: '4px', overflow: 'auto', border: '1px solid #dee2e6' }}>
                      {JSON.stringify(ev.payload_json, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger Entries */}
      {ledgerEntries.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', marginBottom: '16px' }}>Ledger Entries</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                {['Account', 'DR/CR', 'Amount', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '10px' }}>{entry.account_id}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ color: entry.dr_cr === 'DR' ? '#dc3545' : '#198754', fontWeight: '700' }}>
                      {entry.dr_cr}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>{Number(entry.amount).toFixed(2)}</td>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{new Date(entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div>
          <h2 style={{ fontSize: '15px', marginBottom: '16px' }}>Notifications</h2>
          {notifications.map(n => (
            <div key={n.id} style={{ background: '#f8f9fa', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ fontSize: '14px' }}>{n.message}</div>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

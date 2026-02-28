import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TransactionList from './pages/TransactionList'
import TransactionDetail from './pages/TransactionDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TransactionList />} />
        <Route path="/tx/:txnId" element={<TransactionDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

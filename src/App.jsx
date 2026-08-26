import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import NewProposal from './pages/NewProposal/NewProposal.jsx'
import History from './pages/History/History.jsx'
import ProposalDetail from './pages/History/ProposalDetail.jsx'
import ProposalEdit from './pages/History/ProposalEdit.jsx'
import Settings from './pages/Settings/Settings.jsx'
import Templates from './pages/Templates/Templates.jsx'
import TemplateEditor from './pages/Templates/TemplateEditor.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewProposal />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/new" element={<TemplateEditor />} />
        <Route path="templates/:id/edit" element={<TemplateEditor />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id/edit" element={<ProposalEdit />} />
        <Route path="history/:id" element={<ProposalDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

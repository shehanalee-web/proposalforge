import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import CreateProposal from './pages/CreateProposal/CreateProposal.jsx'
import History from './pages/History/History.jsx'
import ProposalDetail from './pages/History/ProposalDetail.jsx'
import ProposalEdit from './pages/History/ProposalEdit.jsx'
import Settings from './pages/Settings/Settings.jsx'
import Templates from './pages/Templates/Templates.jsx'
import TemplateEditor from './pages/Templates/TemplateEditor.jsx'
import ClientPortal from './pages/ClientPortal/ClientPortal.jsx'
import ClientShareRedirect from './portal/ClientShareRedirect.jsx'
import BrandKit from './pages/BrandKit/BrandKit.jsx'
import Services from './pages/Services/Services.jsx'
import ServiceEditor from './pages/Services/ServiceEditor.jsx'
import Assets from './pages/Assets/Assets.jsx'
import ContentLibrary from './pages/ContentLibrary/ContentLibrary.jsx'
import ContentLibraryEditor from './pages/ContentLibrary/ContentLibraryEditor.jsx'
import CaseStudies from './pages/CaseStudies/CaseStudies.jsx'
import Testimonials from './pages/Testimonials/Testimonials.jsx'
import Team from './pages/Team/Team.jsx'
import ProposalAi from './pages/ProposalAi/ProposalAi.jsx'
import {
  HistoryDetailRedirect,
  HistoryEditRedirect,
  HistoryIndexRedirect,
} from './workspace/HistoryRedirects.jsx'

function App() {
  return (
    <Routes>
      <Route path="/p/share/:token" element={<ClientPortal />} />
      <Route path="/p/:token" element={<ClientShareRedirect />} />
      <Route path="/proposal-ai" element={<ProposalAi />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<CreateProposal />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/new" element={<TemplateEditor />} />
        <Route path="templates/:id/edit" element={<TemplateEditor />} />
        <Route path="proposals" element={<History />} />
        <Route path="proposals/:id/edit" element={<ProposalEdit />} />
        <Route path="proposals/:id" element={<ProposalDetail />} />
        <Route path="history" element={<HistoryIndexRedirect />} />
        <Route path="history/:id/edit" element={<HistoryEditRedirect />} />
        <Route path="history/:id" element={<HistoryDetailRedirect />} />
        <Route path="brand-kit" element={<BrandKit />} />
        <Route path="services" element={<Services />} />
        <Route path="services/new" element={<ServiceEditor />} />
        <Route path="services/:id/edit" element={<ServiceEditor />} />
        <Route path="assets" element={<Assets />} />
        <Route path="content-library" element={<ContentLibrary />} />
        <Route path="content-library/new" element={<ContentLibraryEditor />} />
        <Route path="content-library/:id/edit" element={<ContentLibraryEditor />} />
        <Route path="case-studies" element={<CaseStudies />} />
        <Route path="testimonials" element={<Testimonials />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

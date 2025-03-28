import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import CreateApplication from './pages/CreateApplication';
import EditApplication from './pages/EditApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import KubeConfigPage from './pages/KubeConfigPage';
import K8sResourcesPage from './pages/K8sResourcesPage';
import RegistryPage from './pages/RegistryPage';
import PrivateRegistryPage from './pages/PrivateRegistryPage';
import PodDetailPage from './pages/PodDetailPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<CreateApplication />} />
          <Route path="edit/:id" element={<EditApplication />} />
          <Route path="detail/:id" element={<ApplicationDetail />} />
          <Route path="kubeconfig" element={<KubeConfigPage />} />
          <Route path="cluster/:id/resources" element={<K8sResourcesPage />} />
          <Route path="cluster/:id/namespace/:namespace/pod/:podName" element={<PodDetailPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="registry/private" element={<PrivateRegistryPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

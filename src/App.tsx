import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TripDetails from './pages/TripDetails';
import MapModule from './pages/MapModule';
import BudgetModule from './pages/BudgetModule';
import PackingModule from './pages/PackingModule';
import DestinationDetails from './pages/DestinationDetails';
import AIAssistant from './pages/AIAssistant';
import PhotosModule from './pages/PhotosModule';
import './i18n';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="trip/:id" element={<TripDetails />} />
          <Route path="trip/:id/destination/:destId" element={<DestinationDetails />} />
          <Route path="trip/:id/map" element={<MapModule />} />
          <Route path="trip/:id/budget" element={<BudgetModule />} />
          <Route path="trip/:id/packing" element={<PackingModule />} />
          <Route path="trip/:id/ai" element={<AIAssistant />} />
          <Route path="trip/:id/photos" element={<PhotosModule />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

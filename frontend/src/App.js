import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import TemplateBuilder from './pages/TemplateBuilder';
import APITester from './pages/APITester';
import { Toaster } from './components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/builder/:templateId/:versionId" element={<TemplateBuilder />} />
          <Route path="/api-tester" element={<APITester />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
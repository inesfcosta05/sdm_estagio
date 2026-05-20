import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/sidebar';

// Páginas
import Home from './pages/home';
import Fichas from './pages/ficha';
import NovaFicha from './pages/novaficha';
import Clientes from './pages/cliente';
import NovoCliente from './pages/novocliente';
import Paginas from './pages/paginas';
import NovaPagina from './pages/novapagina';
import Perfil from './pages/perfil';
import Relatorios from './pages/relatorios';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    if (saved === 'true') {
      setSidebarMinimized(true);
    }
  }, []);

  const handleSidebarToggle = (minimized) => {
    setSidebarMinimized(minimized);
  };

  return (
    <Router>
      <div className="app-layout">
        {/* SIDEBAR */}
        <Sidebar onToggle={handleSidebarToggle} isMinimized={sidebarMinimized} />
        
        {/* CONTEÚDO PRINCIPAL - 100% RESPONSIVO */}
        <div className="main-container">
          <main className="content-area">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/fichas" element={<Fichas />} />
              <Route path="/fichas/nova" element={<NovaFicha />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/novo" element={<NovoCliente />} />
              <Route path="/paginas" element={<Paginas />} />
              <Route path="/paginas/novo" element={<NovaPagina />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

import React, { useState, useEffect, useRef } from 'react';
import { Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './sidebar.css';

const Sidebar = () => {
  const [openSection, setOpenSection] = useState(null);
  const [activeLink, setActiveLink] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState(null); // { section, top }
  const sidebarRef = useRef(null);
  const floatingRef = useRef(null);
  const sectionInfo = {
    paginas: { label: 'Páginas', icon: 'bi bi-file-earmark' },
    clientes: { label: 'Clientes', icon: 'bi bi-people' },
    fichas: { label: 'Fichas', icon: 'bi bi-journal-text' }
  };
  const headerLabelMap = {
    clientes: 'clientes',
    fichas: 'fichas',
    paginas: 'paginas'
  };

  // Carregar estado da sidebar do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    if (saved === 'true') setIsMinimized(true);
  }, []);

  const toggleSection = (section, e) => {
    if (isMinimized) {
      // open floating menu positioned at the clicked button
      const rect = e.currentTarget.getBoundingClientRect();
      // position flush against the sidebar (use sidebar right edge)
      const sidebarRect = sidebarRef.current ? sidebarRef.current.getBoundingClientRect() : rect;
      const left = (sidebarRect.right || rect.right) + window.scrollX; // flush to sidebar edge
      const top = rect.top + window.scrollY; // align top with the clicked button
      const height = rect.height;
      setFloatingMenu(prev => (prev && prev.section === section ? null : { section, top, left, height }));
      return;
    }

    setOpenSection(prev => (prev === section ? null : section));
  };

  // close floating when clicking outside
  useEffect(() => {
    const handler = (ev) => {
      if (!floatingRef.current) return;
      if (floatingRef.current.contains(ev.target)) return;
      if (sidebarRef.current && sidebarRef.current.contains(ev.target)) return;
      setFloatingMenu(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleMinimize = () => {
    if (isAnimating) return; // prevent toggles while animating
    const newState = !isMinimized;
    setIsAnimating(true);
    // add animating class to sidebar element
    if (sidebarRef.current) sidebarRef.current.classList.add('animating');
    setIsMinimized(newState);
    localStorage.setItem('sidebarMinimized', newState);
    // remove animating flag after transition duration (match CSS ~260ms)
    window.setTimeout(() => {
      setIsAnimating(false);
      if (sidebarRef.current) sidebarRef.current.classList.remove('animating');
    }, 320);
  };

  const isActive = (path) => activeLink === path;

  return (
    <div
      ref={sidebarRef}
      className={`sidebar bg-dark text-white vh-100 d-flex flex-column ${isMinimized ? 'sidebar-minimized' : ''}`}
      style={{
        width: isMinimized ? '64px' : '240px',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1000,
        transition: 'width 0.3s ease'
      }}
    >

         {/* HEADER */}
     <div className="sidebar-header border-bottom border-secondary px-3 py-3 d-flex align-items-center">
  {!isMinimized ? (
    <div className="d-flex align-items-center gap-2">
      <i className="bi bi-file-earmark-text text-primary" style={{fontSize: '1.3rem'}}></i>
      <div>
        <div className="fw-bold text-primary mb-0">SDM</div>
      </div>
    </div>
  ) : (
    <div className="text-center w-100">
      <i className="bi bi-file-earmark-text d-block" style={{fontSize: '1.3rem', color: '#0d6efd'}}></i>
    </div>
  )}
</div>


      {/* MENU */}
      <Nav className="flex-column flex-grow-1 mt-2">
        {/* Home */}
        <Nav.Link
          as={Link}
          to="/"
          onClick={() => setActiveLink('/')}
          className={`sidebar-link ${isActive('/') ? 'active' : ''}`}
        >
          <i className="bi bi-house-door me-2"></i>
          {!isMinimized && <span>Home</span>}
        </Nav.Link>

        {/* Páginas */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link w-100 text-start btn btn-link p-0 ${openSection === 'paginas' ? 'open' : ''}`}
            onClick={(e) => toggleSection('paginas', e)}
          >
            <i className="bi bi-file-earmark me-2"></i>
            {!isMinimized && <span>Páginas</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'paginas' ? 'up' : 'down'} ms-auto`}></i>
            )}
          </button>

          {!isMinimized && openSection === 'paginas' && (
            <div className="sidebar-submenu mt-1">
              <Nav.Link
                as={Link}
                to="/paginas"
                onClick={() => setActiveLink('/paginas')}
                className={`sidebar-sublink ${isActive('/paginas') ? 'active' : ''}`}
              >
                Todas as Páginas
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/paginas/novo"
                onClick={() => setActiveLink('/paginas/novo')}
                className={`sidebar-sublink ${isActive('/paginas/novo') ? 'active' : ''}`}
              >
                Adicionar Nova Página
              </Nav.Link>
            </div>
          )}
        </div>

        {/* Clientes */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link w-100 text-start btn btn-link p-0 ${openSection === 'clientes' ? 'open' : ''}`}
            onClick={(e) => toggleSection('clientes', e)}
          >
            <i className="bi bi-people me-2"></i>
            {!isMinimized && <span>Clientes</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'clientes' ? 'up' : 'down'} ms-auto`}></i>
            )}
          </button>

          {!isMinimized && openSection === 'clientes' && (
            <div className="sidebar-submenu mt-1">
              <Nav.Link
                as={Link}
                to="/clientes"
                onClick={() => setActiveLink('/clientes')}
                className={`sidebar-sublink ${isActive('/clientes') ? 'active' : ''}`}
              >
                Todos os Clientes
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/clientes/novo"
                onClick={() => setActiveLink('/clientes/novo')}
                className={`sidebar-sublink ${isActive('/clientes/novo') ? 'active' : ''}`}
              >
                Adicionar Novo Cliente
              </Nav.Link>
            </div>
          )}
        </div>

        {/* Fichas */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link w-100 text-start btn btn-link p-0 ${openSection === 'fichas' ? 'open' : ''}`}
            onClick={(e) => toggleSection('fichas', e)}
          >
            <i className="bi bi-journal-text me-2"></i>
            {!isMinimized && <span>Fichas</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'fichas' ? 'up' : 'down'} ms-auto`}></i>
            )}
          </button>

          {!isMinimized && openSection === 'fichas' && (
            <div className="sidebar-submenu mt-1">
              <Nav.Link
                as={Link}
                to="/fichas"
                onClick={() => setActiveLink('/fichas')}
                className={`sidebar-sublink ${isActive('/fichas') ? 'active' : ''}`}
              >
                Todas as Fichas
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/fichas/nova"
                onClick={() => setActiveLink('/fichas/nova')}
                className={`sidebar-sublink ${isActive('/fichas/nova') ? 'active' : ''}`}
              >
                Adicionar Nova Ficha
              </Nav.Link>
            </div>
          )}
        </div>

        <hr className="sidebar-divider" />

        {/* Relatórios */}
        <Nav.Link
          as={Link}
          to="/relatorios"
          onClick={() => setActiveLink('/relatorios')}
          className={`sidebar-link ${isActive('/relatorios') ? 'active' : ''}`}
        >
          <i className="bi bi-bar-chart-line me-2"></i>
          {!isMinimized && <span>Relatórios</span>}
        </Nav.Link>

        {/* Perfil */}
        <Nav.Link
          as={Link}
          to="/perfil"
          onClick={() => setActiveLink('/perfil')}
          className={`sidebar-link ${isActive('/perfil') ? 'active' : ''}`}
        >
          <i className="bi bi-person-circle me-2"></i>
          {!isMinimized && <span>Perfil</span>}
        </Nav.Link>
      </Nav>

      {/* Floating submenu when minimized */}
      {isMinimized && floatingMenu && (
        <div
          ref={floatingRef}
          className="floating-menu shadow"
          style={{
            position: 'fixed',
            left: (floatingMenu.left - 1) + 'px',
            top: floatingMenu.top + 'px',
            zIndex: 1100,
            minWidth: 220,
            borderRadius: 0,
            overflow: 'hidden',
            transform: 'none'
          }}
        >
            <div
              className="floating-header d-flex align-items-center"
              style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 8px'
                }}
              >
                <span style={{color: '#ffffff'}}>{(sectionInfo[floatingMenu.section] && sectionInfo[floatingMenu.section].label) || headerLabelMap[floatingMenu.section] || ''}</span>
            </div>
            <div className="floating-body px-2 py-2" style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: '#2f3336'}}>
            {floatingMenu.section === 'paginas' && (
              <>
                <Link to="/paginas" className="floating-link" onClick={() => { setActiveLink('/paginas'); setFloatingMenu(null); }}>Todas as Páginas</Link>
                <Link to="/paginas/novo" className="floating-link" onClick={() => { setActiveLink('/paginas/novo'); setFloatingMenu(null); }}>Adicionar Nova Página</Link>
              </>
            )}
            {floatingMenu.section === 'clientes' && (
              <>
                <Link to="/clientes" className="floating-link" onClick={() => { setActiveLink('/clientes'); setFloatingMenu(null); }}>Todos os Clientes</Link>
                <Link to="/clientes/novo" className="floating-link" onClick={() => { setActiveLink('/clientes/novo'); setFloatingMenu(null); }}>Adicionar Novo Cliente</Link>
              </>
            )}
            {floatingMenu.section === 'fichas' && (
              <>
                <Link to="/fichas" className="floating-link" onClick={() => { setActiveLink('/fichas'); setFloatingMenu(null); }}>Todas as Fichas</Link>
                <Link to="/fichas/nova" className="floating-link" onClick={() => { setActiveLink('/fichas/nova'); setFloatingMenu(null); }}>Adicionar Novo Ficha</Link>
              </>
            )}
          </div>
        </div>
      )}

 {/* BOTÃO MINIMIZAR NO FUNDO */}
  <div className="mt-auto">
  <button
    type="button"
    onClick={toggleMinimize}
    className="sidebar-link w-100 text-start d-flex align-items-center border-0 bg-transparent minimize-link"
  >
    <i className={`bi ${isMinimized ? 'bi-chevron-right' : 'bi-chevron-left'} me-2`}></i>
    {!isMinimized && <span>Minimizar</span>}
  </button>
</div>
    </div>
  );
};

export default Sidebar;

import React, { useState, useEffect, useRef } from 'react';
import { Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './sidebar.css';

const normalizeRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador' || raw === 'admin') return 'admin';
  if (raw === 'contributor' || raw === 'contribuidor') return 'contributor';
  return 'editor';
};

const Sidebar = ({ onToggle, language = 'default', user = null }) => {
  const locale = language === 'en' ? 'en' : 'pt';
  const labels = {
    pt: {
      home: 'Home',
      paginas: 'Paginas',
      clientes: 'Clientes',
      fichas: 'Fichas',
      relatorios: 'Relatorios',
      administracao: 'Administração',
      utilizadores: 'Utilizadores',
      perfil: 'Perfil',
      minimizar: 'Minimizar',
      todasPaginas: 'Todas as Paginas',
      novaPagina: 'Adicionar Nova Pagina',
      todosClientes: 'Todos os Clientes',
      novoCliente: 'Adicionar Novo Cliente',
      todasFichas: 'Todas as Fichas',
      novaFicha: 'Adicionar Nova Ficha',
      propostasAdj: 'Propostas Adjudicadas',
      propostas: 'Propostas',
      contactos: 'Contactos a Efetuar',
      gestorClientes: 'Gestor e Clientes'
    },
    en: {
      home: 'Home',
      paginas: 'Pages',
      clientes: 'Clients',
      fichas: 'Records',
      relatorios: 'Reports',
      administracao: 'Administration',
      utilizadores: 'Users',
      perfil: 'Profile',
      minimizar: 'Minimize',
      todasPaginas: 'All Pages',
      novaPagina: 'Add New Page',
      todosClientes: 'All Clients',
      novoCliente: 'Add New Client',
      todasFichas: 'All Records',
      novaFicha: 'Add New Record',
      propostasAdj: 'Awarded Proposals',
      propostas: 'Proposals',
      contactos: 'Contacts to Do',
      gestorClientes: 'Manager and Clients'
    }
  }[locale];
  const [openSection, setOpenSection] = useState(null);
  const [activeLink, setActiveLink] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState(null); // { section, top }
  const sidebarRef = useRef(null);
  const floatingRef = useRef(null);
  const sectionInfo = {
    paginas: { label: labels.paginas, icon: 'bi bi-file-earmark' },
    clientes: { label: labels.clientes, icon: 'bi bi-people' },
    fichas: { label: labels.fichas, icon: 'bi bi-journal-text' },
    relatorios: { label: labels.relatorios, icon: 'bi bi-bar-chart-line' }
  };
  const headerLabelMap = {
    clientes: 'clientes',
    fichas: 'fichas',
    paginas: 'paginas',
    relatorios: 'relatorios'
  };
  const isAdmin = normalizeRole(user?.role) === 'admin';

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
    if (typeof onToggle === 'function') {
      onToggle(newState);
    }
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
        width: isMinimized ? '42px' : '220px',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        transition: 'width 0.3s ease'
      }}
    >

         {/* HEADER */}
     <div className="sidebar-header border-bottom border-secondary px-3 py-3 d-flex align-items-center">
  {!isMinimized ? (
    <div className="d-flex align-items-center gap-2">
      <i className="bi bi-file-earmark-text sidebar-brand-icon" style={{fontSize: '1.3rem'}}></i>
      <div>
        <div className="fw-bold sidebar-brand-text mb-0">SDM</div>
      </div>
    </div>
  ) : (
    <div className="text-center w-100">
      <i className="bi bi-file-earmark-text d-block sidebar-brand-icon" style={{fontSize: '1.3rem'}}></i>
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
          {!isMinimized && <span>{labels.home}</span>}
        </Nav.Link>

        {/* Páginas */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link sidebar-section-toggle w-100 text-start btn btn-link p-0 ${openSection === 'paginas' ? 'open' : ''}`}
            onClick={(e) => toggleSection('paginas', e)}
          >
            <i className="bi bi-file-earmark me-2"></i>
            {!isMinimized && <span className="sidebar-section-text">{labels.paginas}</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'paginas' ? 'up' : 'down'} ms-auto sidebar-chevron`}></i>
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
                {labels.todasPaginas}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/paginas/novo"
                onClick={() => setActiveLink('/paginas/novo')}
                className={`sidebar-sublink ${isActive('/paginas/novo') ? 'active' : ''}`}
              >
                {labels.novaPagina}
              </Nav.Link>
            </div>
          )}
        </div>

        {/* Clientes */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link sidebar-section-toggle w-100 text-start btn btn-link p-0 ${openSection === 'clientes' ? 'open' : ''}`}
            onClick={(e) => toggleSection('clientes', e)}
          >
            <i className="bi bi-people me-2"></i>
            {!isMinimized && <span className="sidebar-section-text">{labels.clientes}</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'clientes' ? 'up' : 'down'} ms-auto sidebar-chevron`}></i>
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
                {labels.todosClientes}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/clientes/novo"
                onClick={() => setActiveLink('/clientes/novo')}
                className={`sidebar-sublink ${isActive('/clientes/novo') ? 'active' : ''}`}
              >
                {labels.novoCliente}
              </Nav.Link>
            </div>
          )}
        </div>

        {/* Fichas */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link sidebar-section-toggle w-100 text-start btn btn-link p-0 ${openSection === 'fichas' ? 'open' : ''}`}
            onClick={(e) => toggleSection('fichas', e)}
          >
            <i className="bi bi-journal-text me-2"></i>
            {!isMinimized && <span className="sidebar-section-text">{labels.fichas}</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'fichas' ? 'up' : 'down'} ms-auto sidebar-chevron`}></i>
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
                {labels.todasFichas}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/fichas/nova"
                onClick={() => setActiveLink('/fichas/nova')}
                className={`sidebar-sublink ${isActive('/fichas/nova') ? 'active' : ''}`}
              >
                {labels.novaFicha}
              </Nav.Link>
            </div>
          )}
        </div>

        <hr className="sidebar-divider" />

        {/* Relatórios */}
        <div className="mt-2">
          <button
            type="button"
            className={`sidebar-link sidebar-section-toggle w-100 text-start btn btn-link p-0 ${openSection === 'relatorios' ? 'open' : ''}`}
            onClick={(e) => toggleSection('relatorios', e)}
          >
            <i className="bi bi-bar-chart-line me-2"></i>
            {!isMinimized && <span className="sidebar-section-text">{labels.relatorios}</span>}
            {!isMinimized && (
              <i className={`bi bi-chevron-${openSection === 'relatorios' ? 'up' : 'down'} ms-auto sidebar-chevron`}></i>
            )}
          </button>

          {!isMinimized && openSection === 'relatorios' && (
            <div className="sidebar-submenu mt-1">
              <Nav.Link
                as={Link}
                to="/relatorios?tipo=propostas-adjudicadas"
                onClick={() => setActiveLink('/relatorios?tipo=propostas-adjudicadas')}
                className={`sidebar-sublink ${isActive('/relatorios?tipo=propostas-adjudicadas') ? 'active' : ''}`}
              >
                {labels.propostasAdj}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/relatorios?tipo=propostas"
                onClick={() => setActiveLink('/relatorios?tipo=propostas')}
                className={`sidebar-sublink ${isActive('/relatorios?tipo=propostas') ? 'active' : ''}`}
              >
                {labels.propostas}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/relatorios?tipo=contactos-a-efetuar"
                onClick={() => setActiveLink('/relatorios?tipo=contactos-a-efetuar')}
                className={`sidebar-sublink ${isActive('/relatorios?tipo=contactos-a-efetuar') ? 'active' : ''}`}
              >
                {labels.contactos}
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/relatorios?tipo=gestor-e-clientes"
                onClick={() => setActiveLink('/relatorios?tipo=gestor-e-clientes')}
                className={`sidebar-sublink ${isActive('/relatorios?tipo=gestor-e-clientes') ? 'active' : ''}`}
              >
                {labels.gestorClientes}
              </Nav.Link>
            </div>
          )}
        </div>

        {isAdmin && (
          <Nav.Link
            as={Link}
            to="/admin/utilizadores"
            onClick={() => setActiveLink('/admin/utilizadores')}
            className={`sidebar-link ${isActive('/admin/utilizadores') ? 'active' : ''}`}
          >
            <i className="bi bi-person-gear me-2"></i>
            {!isMinimized && <span>{labels.utilizadores}</span>}
          </Nav.Link>
        )}

        {/* Perfil */}
        <Nav.Link
          as={Link}
          to="/perfil"
          onClick={() => setActiveLink('/perfil')}
          className={`sidebar-link ${isActive('/perfil') ? 'active' : ''}`}
        >
          <i className="bi bi-person-circle me-2"></i>
          {!isMinimized && <span>{labels.perfil}</span>}
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
            zIndex: 1201,
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
            <div className="floating-body px-2 py-2" style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
            {floatingMenu.section === 'paginas' && (
              <>
                <Link to="/paginas" className="floating-link" onClick={() => { setActiveLink('/paginas'); setFloatingMenu(null); }}>{labels.todasPaginas}</Link>
                <Link to="/paginas/novo" className="floating-link" onClick={() => { setActiveLink('/paginas/novo'); setFloatingMenu(null); }}>{labels.novaPagina}</Link>
              </>
            )}
            {floatingMenu.section === 'clientes' && (
              <>
                <Link to="/clientes" className="floating-link" onClick={() => { setActiveLink('/clientes'); setFloatingMenu(null); }}>{labels.todosClientes}</Link>
                <Link to="/clientes/novo" className="floating-link" onClick={() => { setActiveLink('/clientes/novo'); setFloatingMenu(null); }}>{labels.novoCliente}</Link>
              </>
            )}
            {floatingMenu.section === 'fichas' && (
              <>
                <Link to="/fichas" className="floating-link" onClick={() => { setActiveLink('/fichas'); setFloatingMenu(null); }}>{labels.todasFichas}</Link>
                <Link to="/fichas/nova" className="floating-link" onClick={() => { setActiveLink('/fichas/nova'); setFloatingMenu(null); }}>{labels.novaFicha}</Link>
              </>
            )}
            {floatingMenu.section === 'relatorios' && (
              <>
                <Link to="/relatorios?tipo=propostas-adjudicadas" className="floating-link" onClick={() => { setActiveLink('/relatorios?tipo=propostas-adjudicadas'); setFloatingMenu(null); }}>{labels.propostasAdj}</Link>
                <Link to="/relatorios?tipo=propostas" className="floating-link" onClick={() => { setActiveLink('/relatorios?tipo=propostas'); setFloatingMenu(null); }}>{labels.propostas}</Link>
                <Link to="/relatorios?tipo=contactos-a-efetuar" className="floating-link" onClick={() => { setActiveLink('/relatorios?tipo=contactos-a-efetuar'); setFloatingMenu(null); }}>{labels.contactos}</Link>
                <Link to="/relatorios?tipo=gestor-e-clientes" className="floating-link" onClick={() => { setActiveLink('/relatorios?tipo=gestor-e-clientes'); setFloatingMenu(null); }}>{labels.gestorClientes}</Link>
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
    {!isMinimized && <span>{labels.minimizar}</span>}
  </button>
</div>
    </div>
  );
};

export default Sidebar;

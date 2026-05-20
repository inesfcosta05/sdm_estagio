import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, InputGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FaEye, FaEdit, FaTrash } from 'react-icons/fa';

const Paginas = () => {
  const [paginas, setPaginas] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/paginas')
      .then(res => {
        setPaginas(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro paginas:', err);
        setLoading(false);
      });
  }, []);

  const toggleRow = (id) => {
    setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPaginas = paginas.filter(pagina =>
    (pagina.post_title || pagina.titulo)?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}>
            <span className="visually-hidden">Carregando...</span>
          </div>
          <h4 className="mt-3">Carregando páginas...</h4>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3>Páginas <Badge bg="primary">{filteredPaginas.length}</Badge></h3>
          <small className="text-muted">Total: {paginas.length}</small>
        </div>
        
        <div className="d-flex gap-2">
          <InputGroup style={{width: '300px'}}>
            <Form.Control
              placeholder="Procurar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Button href="/paginas/novo" className="btn btn-outline-success">
            Nova Página
          </Button>
        </div>
      </div>

      <div className="table-responsive">
        <Table hover className="tabela-paginas mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th style={{width: '70%'}}>Título</th>
              <th style={{width: '30%'}}>Data Publicação</th>
            </tr>
          </thead>
          <tbody>
            {filteredPaginas.slice(0, 100).map((pagina) => {
              const id = pagina.ID || pagina.id || pagina.legacy_id;
              const titulo = pagina.post_title || pagina.titulo || pagina.tipo_contacto;
              const dataPub = pagina.post_date || pagina.data_contacto;

              return (
                <>
                  <tr 
                    key={`main-${id}`}
                    className="linha-principal"
                    onClick={() => toggleRow(id)}
                    style={{cursor: 'pointer'}}
                  >
                    <td>
                      <strong>{titulo}</strong>
                      <br/><small className="text-muted">ID: {id}</small>
                    </td>
                    <td>
                      <small>{format(new Date(dataPub), 'dd/MM/yy HH:mm', { locale: pt })}</small>
                    </td>
                  </tr>

                  {openRows[id] && (
                    <tr key={`expand-${id}`}>
                      <td colSpan="2" className="p-0">
                        <div className="bg-light p-3">
                          <div className="row">
                            <div className="col-lg-8">
                              <h6>Conteúdo</h6>
                              <p className="mb-3">{pagina.post_content || pagina.conteudo || pagina.motivo_resumo_contacto}</p>
                            </div>
                            <div className="col-lg-4">
                              <h6>Informações</h6>
                              {pagina.post_status && (
                                <div className="mb-2">Estado: <Badge bg="secondary">{pagina.post_status}</Badge></div>
                              )}
                              {pagina.post_author && (
                                <div className="mb-2">Autor: {pagina.post_author}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Container>
  );
};

export default Paginas;

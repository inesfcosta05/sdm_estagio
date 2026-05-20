import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, InputGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FaEye, FaEdit, FaTrash } from 'react-icons/fa';

const Fichas = () => {
  const [fichas, setFichas] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/fichas')
      .then(res => {
        setFichas(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro fichas:', err);
        setLoading(false);
      });
  }, []);

  const toggleRow = (id) => {
    setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFichas = fichas.filter(ficha =>
    ficha.tipo_contacto?.toLowerCase().includes(search.toLowerCase()) ||
    ficha.client_legacy_id?.toString().includes(search) ||
    ficha.motivo_resumo_contacto?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}>
            <span className="visually-hidden">Carregando...</span>
          </div>
          <h4 className="mt-3">Carregando fichas...</h4>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3>Fichas <Badge bg="primary">{filteredFichas.length}</Badge></h3>
          <small className="text-muted">Total: {fichas.length}</small>
        </div>
        
        <div className="d-flex gap-2">
          <InputGroup style={{width: '300px'}}>
            <Form.Control
              placeholder="Procurar tipo, cliente ou resumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Button href="/fichas/nova" className="btn btn-outline-success">
            Nova Ficha
          </Button>
        </div>
      </div>

      <div className="table-responsive">
        <Table hover className="tabela-fichas mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th style={{width: '40%'}}>Tipo</th>
              <th style={{width: '20%'}}>Cliente</th>
              <th style={{width: '20%'}}>Data</th>
              <th style={{width: '20%'}} className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredFichas.slice(0, 100).map((ficha) => {
              const id = ficha.legacy_id;
              return (
                <>
                  <tr 
                    key={`main-${id}`}
                    className="linha-principal"
                    onClick={() => toggleRow(id)}
                    style={{cursor: 'pointer'}}
                  >
                    <td>
                      <strong>{ficha.tipo_contacto || 'Sem tipo'}</strong>
                      <br/><small className="text-muted">ID: {id}</small>
                    </td>
                    <td>
                      <Badge bg="info">{ficha.client_legacy_id || 'N/A'}</Badge>
                    </td>
                    <td>
                      <small>{format(new Date(ficha.data_contacto), 'dd/MM/yy HH:mm', { locale: pt })}</small>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm" role="group">
                        <OverlayTrigger placement="top" overlay={<Tooltip>Ver detalhes</Tooltip>}>
                          <Button variant="outline-primary" size="sm" className="btn-icon-sm me-1">
                            <FaEye />
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip>Editar</Tooltip>}>
                          <Button variant="outline-warning" size="sm" className="btn-icon-sm me-1">
                            <FaEdit />
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip>Eliminar</Tooltip>}>
                          <Button variant="outline-danger" size="sm" className="btn-icon-sm">
                            <FaTrash />
                          </Button>
                        </OverlayTrigger>
                      </div>
                    </td>
                  </tr>

                  {openRows[id] && (
                    <tr key={`expand-${id}`}>
                      <td colSpan="4" className="p-0">
                        <div className="bg-light p-3">
                          <div className="row">
                            <div className="col-lg-8">
                              <h6>Resumo</h6>
                              <p className="mb-3">{ficha.motivo_resumo_contacto}</p>
                              {ficha.estado && (
                                <div className="mb-2">
                                  <strong>Estado:</strong> <Badge bg="secondary">{ficha.estado}</Badge>
                                </div>
                              )}
                            </div>
                            <div className="col-lg-4">
                              <h6>Dados Extras</h6>
                              {ficha.author && (
                                <div className="mb-2">Autor: {ficha.author}</div>
                              )}
                              {Object.entries(ficha).slice(0, 8).map(([key, value]) => {
                                if (!['legacy_id', 'tipo_contacto', 'client_legacy_id', 'data_contacto', 'motivo_resumo_contacto', 'estado', 'author'].includes(key) && value) {
                                  return (
                                    <div key={key} className="mb-1 small text-muted">
                                      {key}: {String(value).substring(0, 30)}
                                    </div>
                                  );
                                }
                                return null;
                              })}
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

export default Fichas;

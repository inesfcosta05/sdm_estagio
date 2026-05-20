import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, InputGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FaEye, FaEdit, FaTrash } from 'react-icons/fa';

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/clientes')
      .then(res => {
        setClientes(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro clientes:', err);
        setLoading(false);
      });
  }, []);

  const toggleRow = (id) => {
    setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome?.toLowerCase().includes(search.toLowerCase()) ||
    cliente.legacy_id?.toString().includes(search)
  );

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}>
            <span className="visually-hidden">Carregando...</span>
          </div>
          <h4 className="mt-3">Carregando clientes...</h4>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-3">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3>Clientes <Badge bg="primary">{filteredClientes.length}</Badge></h3>
          <small className="text-muted">Total: {clientes.length}</small>
        </div>
        
        <div className="d-flex gap-2">
          <InputGroup style={{width: '300px'}}>
            <Form.Control
              placeholder="Procurar por nome ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <Button href="/clientes/novo" className="btn btn-outline-success">
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* TABELA SIMPLES - TODA JUNTA */}
      <div className="table-responsive">
        <Table hover className="tabela-clientes mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th style={{width: '40%'}}>Nome</th>
              <th style={{width: '25%'}}>Autor</th>
              <th style={{width: '20%'}}>Data</th>
              <th style={{width: '15%'}} className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.slice(0, 100).map((cliente) => {
              const id = cliente.legacy_id;
              const nome = cliente.nome || cliente.client_legacy_id || 'Sem nome';
              const autor = cliente.comercial_id || cliente.author || 'N/A';
              const data = cliente.data_contacto || cliente.created_at || new Date().toISOString();

              return (
                <>
                  {/* LINHA PRINCIPAL */}
                  <tr 
                    key={`main-${id}`}
                    className="linha-principal"
                    onClick={() => toggleRow(id)}
                    style={{cursor: 'pointer'}}
                  >
                    <td>
                      <strong>{nome}</strong>
                      <br/><small className="text-muted">ID: {id}</small>
                    </td>
                    <td>{autor}</td>
                    <td>
                      <small>{format(new Date(data), 'dd/MM/yy HH:mm', { locale: pt })}</small>
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

                  {/* LINHA EXPANDIDA */}
                  {openRows[id] && (
                    <tr key={`expand-${id}`}>
                      <td colSpan="4" className="p-0">
                        <div className="bg-light p-3">
                          <div className="row">
                            <div className="col-lg-8">
                              <h6>Informações</h6>
                              {cliente.email && (
                                <div className="mb-2"><strong>Email:</strong> {cliente.email}</div>
                              )}
                              {cliente.telemovel && (
                                <div className="mb-2"><strong>Telemóvel:</strong> {cliente.telemovel}</div>
                              )}
                              {cliente.estado && (
                                <div className="mb-2">
                                  <strong>Estado:</strong> <Badge bg="secondary">{cliente.estado}</Badge>
                                </div>
                              )}
                            </div>
                            <div className="col-lg-4">
                              <h6>Dados Extras</h6>
                              {Object.entries(cliente).slice(0, 8).map(([key, value]) => {
                                if (!['legacy_id', 'nome', 'email', 'telemovel', 'comercial_id', 'author'].includes(key) && value) {
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

      {filteredClientes.length > 100 && (
        <div className="text-center mt-4">
          <Button variant="outline-primary">Carregar Mais</Button>
        </div>
      )}
    </Container>
  );
};

export default Clientes;

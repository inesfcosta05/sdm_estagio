import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Collapse, Table } from 'react-bootstrap';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const FichasCards = () => {
  const [fichas, setFichas] = useState([]);
  const [openCard, setOpenCard] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const toggleCard = (id) => {
    setOpenCard(openCard === id ? null : id);
  };

  if (loading) return <div className="text-center p-5">Carregando fichas...</div>;

  return (
    <Container fluid className="py-4">
      <Row>
        <h2 className="mb-4">Fichas ({fichas.length})</h2>
        
        {fichas.map((ficha) => (
          <Col xs={12} md={6} lg={4} key={ficha.id} className="mb-4">
            <Card className="h-100 ficha-card shadow-sm">
              {/* HEADER COMPRIMIDO */}
              <Card.Header className="bg-primary text-white p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="mb-1 fw-bold">{ficha.tipo_contacto || 'Sem tipo'}</h6>
                    <small className="opacity-75">
                      Cliente: {ficha.client_legacy_id || 'N/A'}
                    </small>
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 text-white"
                    onClick={() => toggleCard(ficha.id)}
                  >
                    {openCard === ficha.id ? '−' : '+'}
                  </Button>
                </div>
              </Card.Header>

              {/* CONTEÚDO COMPRIMIDO */}
              <Card.Body className="pt-2">
                <p className="small mb-2 text-muted">
                  {format(new Date(ficha.data_contacto), 'dd/MM/yyyy HH:mm', { locale: pt })}
                </p>
                <p className="small mb-0">
                  {ficha.motivo_resumo_contacto?.substring(0, 80) || 'Sem resumo'}...
                </p>
                
                {/* BADGES ESTADO */}
                {ficha.estado && (
                  <div className="mt-2">
                    <Badge bg="secondary" className="me-1">{ficha.estado}</Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default FichasCards;

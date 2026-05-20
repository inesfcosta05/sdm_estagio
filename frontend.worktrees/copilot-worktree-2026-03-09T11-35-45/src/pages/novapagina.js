// frontend/src/pages/novapagina.js
import React, { useState } from 'react';
import axios from 'axios';
import { Container, Form, Button, Alert } from 'react-bootstrap';

export default function NovaPagina() {

  const [form, setForm] = useState({
    id: '',
    titulo: '',
    conteudo: '',
    slug: '',
    estado: '',
    autor: ''
  });

  const [sucesso, setSucesso] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:5000/api/paginas', form);
    setSucesso(true);
  };

  return (
    <Container className="py-4">
      <h3>Nova Página</h3>

      {sucesso && <Alert variant="success">Página criada!</Alert>}

      <Form onSubmit={handleSubmit}>
        {Object.keys(form).map(field => (
          <Form.Group className="mb-3" key={field}>
            <Form.Label>{field}</Form.Label>
            <Form.Control
              name={field}
              value={form[field]}
              onChange={handleChange}
            />
          </Form.Group>
        ))}

        <Button type="submit">Guardar</Button>
      </Form>
    </Container>
  );
}
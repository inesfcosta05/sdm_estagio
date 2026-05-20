// frontend/src/pages/novaficha.js
import React, { useState } from 'react';
import axios from 'axios';
import { Container, Form, Button, Alert } from 'react-bootstrap';

export default function NovaFicha() {

  const [form, setForm] = useState({
    legacy_id: '',
    title: '',
    post_status: '',
    post_visibility: '',
    post_date: '',
    author: '',
    client_legacy_id: '',
    tipo_contacto: '',
    pessoa_contacto: '',
    contacto: '',
    data_contacto: '',
    motivo_resumo_contacto: ''
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
    await axios.post('http://localhost:5000/api/fichas', form);
    setSucesso(true);
  };

  return (
    <Container className="py-4">
      <h3>Nova Ficha</h3>

      {sucesso && <Alert variant="success">Ficha criada!</Alert>}

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
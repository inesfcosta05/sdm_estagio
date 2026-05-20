// frontend/src/pages/novocliente.js
import React, { useState } from 'react';
import axios from 'axios';
import { Container, Form, Button, Alert } from 'react-bootstrap';

export default function NovoCliente() {

  const [form, setForm] = useState({
    legacy_id: '',
    denominacao_fiscal: '',
    nif: '',
    morada: '',
    codigo_postal: '',
    localidade: '',
    telefone: '',
    email: '',
    website: ''
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

    await axios.post('http://localhost:5000/api/clientes', form);

    setSucesso(true);
  };

  return (
    <Container className="py-4">
      <h3>Novo Cliente</h3>

      {sucesso && <Alert variant="success">Cliente criado com sucesso!</Alert>}

      <Form onSubmit={handleSubmit}>
        {Object.keys(form).map(field => (
          <Form.Group className="mb-3" key={field}>
            <Form.Label>{field}</Form.Label>
            <Form.Control
              type="text"
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
// src/pages/relatorios.js
import React, { useState } from 'react';
import { Container, ButtonGroup, Button } from 'react-bootstrap';

const OPCOES = [
  'Propostas adjudicadas',
  'Propostas',
  'Contactos a efetuar',
  'Gestor e Clientes',
];

export default function Relatorios() {
  const [ativo, setAtivo] = useState(OPCOES[0]);

  return (
    <Container fluid className="py-3">
      <h2 className="mb-3">Relatórios</h2>

      <ButtonGroup className="mb-4" aria-label="Filtros de relatórios">
        {OPCOES.map((op) => (
          <Button
            key={op}
            variant={ativo === op ? 'primary' : 'outline-primary'}
            onClick={() => setAtivo(op)}
          >
            {op}
          </Button>
        ))}
      </ButtonGroup>

      {/* Aqui depois colocas o conteúdo de cada relatório */}
      <div>
        <h5>{ativo}</h5>
        <p>Conteúdo do relatório: {ativo}</p>
      </div>
    </Container>
  );
}

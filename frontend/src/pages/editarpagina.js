import React from 'react';
import { useParams } from 'react-router-dom';
import NovaPagina from './novapagina';

export default function EditarPagina({ disableVisualEditor = false }) {
  const { id } = useParams();
  return <NovaPagina disableVisualEditor={disableVisualEditor} mode="edit" pageId={id} />;
}

import React from 'react';
import FichaFormPage from './FichaFormPage';

export default function EditarFicha({ disableVisualEditor = false }) {
  return <FichaFormPage mode="edit" disableVisualEditor={disableVisualEditor} />;
}

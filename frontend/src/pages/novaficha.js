import React from 'react';
import FichaFormPage from './FichaFormPage';

export default function NovaFicha({ disableVisualEditor = false }) {
  return <FichaFormPage mode="create" disableVisualEditor={disableVisualEditor} />;
}

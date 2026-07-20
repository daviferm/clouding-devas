const express = require('express');
const axios = require('axios');

/**
 * Ruta Express que actúa como proxy hacia Mantenimiento.php.
 * El navegador llama a TU servidor (sin CORS), y es tu servidor
 * (Node) quien hace la petición real a utedevas.es con axios.
 *
 * Uso en tu app principal:
 *   import cancelarAlarmaRouter from './cancelarAlarmaRoute';
 *   app.use('/api', cancelarAlarmaRouter);
 *
 * El cliente entonces llama a: POST /api/cancelar-alarma
 */

const router = express.Router();

const BASE_URL = 'https://utedevas.es/Mantenimiento/Mantenimiento.php';


router.post('/', async (req, res) => {
  const { p, variable } = req.body;

  // Validación básica de entrada
  if (!p || !variable) {
    return res.status(400).json({
      success: false,
      errorMessage: 'Faltan parámetros requeridos: p y variable.',
    });
  }

  try {
    const body = new URLSearchParams({
      variable,
      CancelarAlarma: 'Marcar Resuelta',
    });

    const response = await axios.post(BASE_URL, body, {
      params: { p },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status === 200) {
      console.log('Formulario enviado con éxito.');
      return res.status(200).json({
        success: true,
        data: response.data,
      });
    } else {
      console.error(`Error al enviar el formulario. Código: ${response.status}`);
      return res.status(response.status).json({
        success: false,
        errorMessage: `Código de estado inesperado: ${response.status}`,
      });
    }
  } catch (error) {
    const axiosError = error;

    if (axiosError.isAxiosError) {
      console.error('Error de Axios al enviar el formulario:', axiosError.message);
      if (axiosError.response) {
        console.error('Código de estado devuelto:', axiosError.response.status);
      }
      return res.status(axiosError.response?.status || 502).json({
        success: false,
        errorMessage: axiosError.message,
      });
    }

    console.error('Excepción inesperada:', error);
    return res.status(500).json({
      success: false,
      errorMessage: String(error),
    });
  }
});

module.exports = router;

/*
Ejemplo de integración en tu servidor (server.ts / index.ts):

import express from 'express';
import cancelarAlarmaRouter from './cancelarAlarmaRoute';

const app = express();
app.use(express.json()); // necesario para parsear el body JSON del cliente
app.use('/api', cancelarAlarmaRouter);

app.listen(3000, () => console.log('Servidor escuchando en el puerto 3000'));

---

Ejemplo de llamada desde el cliente (frontend) a TU propio servidor:

const response = await fetch('https://tu-servidor.com/api/cancelar-alarma', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ p: '123', variable: 'algunValor' }),
});
const result = await response.json();
*/
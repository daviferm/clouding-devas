const express = require('express');
const colors = require('colors');
const cors = require('cors');
const app = express();
const PORT = 3049;


//** Configurar los cors
app.use(cors());

app.get('', (req, res) => {
    res.send('------dvs.backend.es  🥶--------');
})

const loginRoutes = require('./rutas/login');
const refreshRoutes = require('./rutas/refresh');
// const utedevasRoutes = require('./rutas/utedevas');

app.use('/login', loginRoutes);
app.use('/refresh', refreshRoutes);
// app.use('/utedevas', utedevasRoutes);



// Manejar rutas desconocidas
app.use((req, res) => {
    res.status(404).send('Ruta no encontrada');
});

// Escuchar en el puerto especificado
app.listen(PORT, () => {
    console.log(`El servidor está escuchando en el puerto ${PORT}`.green);
});

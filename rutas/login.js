const cheerio = require('cheerio');
const request = require('sync-request');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
// const requestt = require('then-request');
const express = require('express');

const app = express();

const url = 'https://utedevas.es/Mantenimiento/Mantenimiento.php?p=';


app.post('/', async(req, res) => {

    var id = await realizarMantenimiento();

    const respuesta = await init(id);

    res.status(200).json({
        ok: true,
        id: id,
        alarmas: respuesta
    })
})

async function init(id) {

    const res = await request('GET', `${url}${id}`);

    const $ = cheerio.load( res.getBody() );

    var regex = /\[\'([0-9]{8,})([^\]]+)]/g;
    const arrayAlarmas = $.html().match(regex);
    return arrayAlarmas;

}
async function realizarMantenimiento() {
    // 1. Creamos el contenedor de cookies (Jar)
    const jar = new CookieJar();
    
    // 2. Envolvemos axios para que soporte el manejo de cookies
    const client = wrapper(axios.create({ 
        jar, 
        withCredentials: true // Permite enviar y recibir cookies
    }));

    const url = 'https://utedevas.com/Mantenimiento/AppDevas.php';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    try {
        // 0. Cargamos la página primero para obtener la cookie de sesión inicial (PHPSESSID)
        // Muchos sitios PHP no permiten el POST si no hay una sesión previa.
        console.log("Obteniendo cookies iniciales...");
        await client.get(url, { headers: { 'User-Agent': userAgent } });

        // 3. Realizamos el Login
        const loginData = new URLSearchParams();
        loginData.append('user', 'Dfernandez');
        loginData.append('pass', 'Utedevas.2018');
        loginData.append('aceptarLog', 'Aceptar'); // Campo crítico detectado en tu HTML

        console.log("Iniciando sesión...");
        const responseLogin = await client.post(url, loginData, {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': userAgent,
                'Referer': url
            },
            maxRedirects: 0, // Evita que Axios siga automáticamente a la página de error o de inicio
            validateStatus: (status) => status >= 200 && status < 400 // Permite capturar el status 302
        });

        let pParam = null;
        const locationHeader = responseLogin.headers.location;

        if (locationHeader) {
            console.log("Redirección detectada:", locationHeader);
            // La URL de redirección puede ser relativa o absoluta
            // Ensure the base URL is correct for relative paths
            const baseUrl = new URL(url);
            const absoluteUrl = locationHeader.startsWith('http')
                ? locationHeader 
                : new URL(locationHeader, baseUrl).href;
            
            const urlParsed = new URL(absoluteUrl);
            pParam = urlParsed.searchParams.get('p');
        } else {
            console.warn("No se detectó redirección. Es posible que los datos de login sean incorrectos.");
            // Intento de búsqueda por Regex en el HTML por si la redirección es por JS
            const match = responseLogin.data.match(/p=(0x[a-fA-F0-9]+)/);
            if (match) pParam = match[1]; // This captures the 'p' parameter from a URL in the HTML

            // New regex to capture the value from testLoging() script
            const scriptMatch = responseLogin.data.match(/testLoging\('(0x[a-fA-F0-9]+)'\)/);
            if (scriptMatch && !pParam) pParam = scriptMatch[1]; // If 'p' wasn't found in URL, try the script
        }

        if (pParam) {
            const finalUrl = `https://utedevas.com/Mantenimiento/MenuDevas.php?p=${pParam}`;
            const responseMante = await client.get(finalUrl);
            console.log("Acceso exitoso a la página de menú.");
            return pParam;
        }

    } catch (error) {
        console.error("Error en la petición:", error.message);
    }
}


module.exports = app;
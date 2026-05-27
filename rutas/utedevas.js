const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs'); // Módulo nativo para guardar archivos
const cheerio = require('cheerio');

const router = express.Router();

router.post('/:cookie', async (req, res) => {
    const cookie = req.params.cookie;
    try {
        const respuesta = await obtenerAvisosDelHtml(cookie);
        res.status(200).json({
            ok: true,
            PHPSESSID: respuesta.PHPSESSID,
            alarmas: respuesta.avisos,
        });
    } catch (error) {
        console.error("❌ Error en la ruta /login:", error.message);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
})

async function obtenerAvisosDelHtml( cookieData ) {
    // 1. Lanzamos el navegador (puedes poner headless: false para ver el proceso)
    // const browser = await puppeteer.launch({ headless: true });
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // necesario en servidores
        });
    const page = await browser.newPage();
    const url = 'https://utedevas.com/Devas/Mantenimiento.php';
    // const cookiePath = 'session_cookie.json';
    let cookieSession;

    try {
        // --- PASO 0: INTENTAR CARGAR SESIÓN PREVIA ---
        if (cookieData != 'no-cookie') {
            // const cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
            //? Injecta la Cookie PHPSESSID para mantener la sesión
            await page.setCookie({
                name: 'PHPSESSID',
                value: cookieData,
                domain: 'utedevas.com'
            });
            console.log("🔄 Sesión previa detectada. Cargando cookie PHPSESSID...");
        }

        console.log("Navegando a la web...");
        await page.goto(url, { waitUntil: 'networkidle2' });

        //*? Verificamos si el formulario de login está presente (si no estamos logueados)
        const necesitaLogin = await page.$('input[name="Usuario"]');

        if (necesitaLogin) {
            console.log("🔑 La sesión no es válida o ha expirado. Iniciando login manual...");
            
            console.log("Introduciendo credenciales...");
            await page.type('input[name="Usuario"]', 'Dfernandez'); 
            await page.type('input[name="Pwd"]', 'Utedevas.2018'); 

            console.log("Haciendo click en Login...");
            await Promise.all([
                page.click('button[type="submit"], input[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
            ]);
        } else {
            console.log("🚀 Sesión recuperada con éxito. Saltando login...");
        }

        console.log("Login finalizado. Verificando estado...");

        //* --- PASO 2: CAPTURAR EL HTML FINAL ---
        //*? Este comando obtiene todo el HTML del DOM actual, incluyendo lo generado por JS
        const htmlFinal = await page.content();
        const loginExitoso = !htmlFinal.includes('type="password"');

        //*? Verificación rápida: ¿Seguimos en el login o entramos?
        if (htmlFinal.includes('type="password"') && htmlFinal.includes('name="usuario"')) {
            console.log("⚠️ ATENCIÓN: Parece que el login FALLÓ. El HTML sigue mostrando el formulario.");
            throw new Error("Login fallido: Credenciales incorrectas o bloqueo de sesión.");
        } else {
            console.log("✅ ¡LOGIN EXITOSO! Hemos capturado el contenido interior.");
        }

        if (loginExitoso) {
            //* --- CAPTURAR COOKIE PHPSESSID ---
            const cookies = await page.cookies();
            const sessionCookie = cookies.find(c => c.name === 'PHPSESSID');
            if (sessionCookie) {
                console.log("✅ Cookie PHPSESSID capturada:", sessionCookie.value);
                cookieSession = sessionCookie.value;
           }
        } 


        //* --- PASO 2.5: ACCEDER AL ELEMENTO ESPECÍFICO ---
        console.log("Esperando por el elemento #ContenedorListado...");
        //*? Esperamos a que el selector aparezca en el DOM
        await page.waitForSelector('#ContenedorListado', { timeout: 60000 });

        //*? Esperamos a que el indicador de carga (#CirculoCarga) desaparezca
        console.log("Esperando a que el indicador de carga #CirculoCarga desaparezca...");
        //*? hidden: true espera a que el elemento no sea visible o sea eliminado del DOM
        await page.waitForSelector('#CirculoCarga', { hidden: true, timeout: 60000 });
        
        //*? Obtenemos el contenido HTML interno de ese div específico
        const contenidoListado = await page.$eval('#ContenedorListado', el => el.innerHTML);
        console.log("✅ Elemento #ContenedorListado localizado y capturado.");

        //* --- PASO 2.6: EXTRAER DETALLES DINÁMICOS DE CADA PARQUÍMETRO ---
        console.log("Obteniendo la lista de parquímetros para extraer sus detalles...");
        
        //*? Localizamos IDs y filtramos para no procesar demasiados si estamos en pruebas
        let idsParquimetros = await page.evaluate(() => {
            const items = document.querySelectorAll('div[id^="BtParquimetro"]');
            return Array.from(items).map(item => item.id);
        });

        // Recomiendo limitar esto durante las pruebas para confirmar que el frontend recibe los datos
        // if (idsParquimetros.length > 10) {
        //     console.log(`⚠️ Muchos parquímetros detectados (${idsParquimetros.length}). Limitando a 10 para evitar timeout.`);
        //     idsParquimetros = idsParquimetros.slice(0, 10);
        // }

        const resultadosDetalles = [];

        for (const id of idsParquimetros) {
            // console.log(`-> Extrayendo detalle de: ${id}`);
            
            // Usamos evaluate para disparar el evento click vía JavaScript.
            // Esto evita el error "Node is not clickable" si el elemento está oculto en un panel colapsado.
            await page.evaluate((elId) => {
                document.getElementById(elId).click();
            }, id);

            // Esperamos a que el contenedor de detalle esté presente y visible
            await page.waitForSelector('#ContenedorDetalleParquimetro', { visible: true, timeout: 5000 });

            // Es muy probable que el servidor tarde un poco y aparezca el spinner
            // Esperamos a que #CirculoCarga desaparezca para garantizar que el dato es el final
            await page.waitForSelector('#CirculoCarga', { hidden: true, timeout: 5000 });

            // Capturamos el HTML del detalle cargado
            const htmlDetalle = await page.$eval('#ContenedorDetalleParquimetro', el => el.innerHTML);
            resultadosDetalles.push({ id, html: htmlDetalle });
        }

        //* --- PASO 2.7: PROCESAR DATOS EXTRAÍDOS ---
        console.log("Procesando y estructurando avisos...");
        const avisosObtenidos = resultadosDetalles.map(item => {
            const $ = cheerio.load(item.html);
            // El número de parquímetro está en el div #ParquimetroT dentro de una etiqueta <b>
            const numeroParquimetro = $('#ParquimetroT b').text().trim();
            
            const avisos = [];
            // Buscamos los contenedores de avisos (divs que empiezan por Contenedor pero no son fijos)
             $('#ContenidoParquimetro div[id^="Contenedor"]').each((i, el) => {
                 const elementId = $(el).attr('id');
                 if (elementId === 'ContenedorDireccion' || elementId === 'ContenedorGrafico') return;
                
                 const rawText = $(el).text().trim();
                
                 // Extraemos los campos usando expresiones regulares basadas en las etiquetas del HTML
                 const descripcion = (rawText.match(/Descripción:\s*(.*?)(?:\s*Estado:|$)/s) || [])[1] || "";
                 const estado = (rawText.match(/Estado:\s*(.*?)(?:\s*Fuente:|$)/s) || [])[1] || "";
                 const fuente = (rawText.match(/Fuente:\s*(.*?)(?:\s*Fecha Inicio|$)/s) || [])[1] || "";
                 const fechaInicio = (rawText.match(/Fecha Inicio\s*(.*)$/s) || [])[1] || "";

                if (descripcion || estado) {
                    avisos.push({
                        Descripcion: descripcion.trim(),
                        Estado: estado.trim(),
                        Fuente: fuente.trim(),
                        FechaInicio: fechaInicio.trim()
                    });
                }
            });

            return {
                numeroParquimetro,
                avisos
            };
        });
        return {'PHPSESSID': cookieSession, 'avisos': avisosObtenidos};
        

    } catch (error) {
        console.error("❌ Ocurrió un error:", error.message);
        
        // Si hay error, guardamos una captura de pantalla para diagnosticar
        await page.screenshot({ path: 'error_screenshot.png' });
        console.log("Se ha guardado una captura de pantalla en 'error_screenshot.png' para revisión.");
        throw error; // Lanzamos el error para que lo capture el try/catch de la ruta
    } finally {
        await browser.close();
        console.log("Navegador cerrado.");
    }
}

module.exports = router;
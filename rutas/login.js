const cheerio = require('cheerio');
const request = require('sync-request');
// const requestt = require('then-request');
const express = require('express');

const app = express();

const url = 'https://utedevas.es/Mantenimiento/Mantenimiento.php?p=';


app.get('/:id', async(req, res) => {

    var id = req.params.id;

    const respuesta = await init(id);

    res.status(200).json({
        ok: true,
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

module.exports = app;
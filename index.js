require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const QRCode = require('qrcode');
const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./qrcodes.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

// Page admin : liste de tous les QR codes
app.get('/admin', (req, res) => {
    db.all('SELECT * FROM qrcodes', async (err, rows) => {
        if (err) return res.status(500).send('Erreur DB');
        const data = await Promise.all(rows.map(async row => {
            const qr = await QRCode.toDataURL(`${process.env.BASE_URL}/q/${row.slug}`);
            return { ...row, qr };
        }));
        res.render('admin', { data, baseUrl: process.env.BASE_URL });
    });
});
// Création de la table si elle n'existe pas
db.run(`CREATE TABLE IF NOT EXISTS qrcodes (
    slug TEXT PRIMARY KEY,
    url TEXT NOT NULL
);`);

db.run(`CREATE TABLE IF NOT EXISTS stats (
    slug TEXT,
    ip TEXT,
    user_agent TEXT,
    timestamp TEXT
);`);

// Génération du QR code
app.post('/generate', async (req, res) => {
    const { slug, url } = req.body;
    db.run('INSERT INTO qrcodes (slug, url) VALUES (?, ?)', [slug, url], async (err) => {
        if (err) return res.status(400).send('Slug déjà utilisé.');
        const qr = await QRCode.toDataURL(`http://localhost:${PORT}/q/${slug}`);
        res.render('qr', { qr, slug });
    });
});

// Page d'accueil avec formulaire
app.get('/', (req, res) => {
    res.render('index');
});

// Redirection et log des visites
app.get('/q/:slug', (req, res) => {
    const slug = req.params.slug;
    db.get('SELECT url FROM qrcodes WHERE slug = ?', [slug], (err, row) => {
        if (!row) return res.status(404).send('QR inconnu');
        db.run('INSERT INTO stats (slug, ip, user_agent, timestamp) VALUES (?, ?, ?, ?)',
            [slug, req.ip, req.headers['user-agent'], new Date().toISOString()]);
        res.redirect(row.url);
    });
});

// Statistiques par slug
app.get('/stats/:slug', (req, res) => {
    db.all('SELECT * FROM stats WHERE slug = ?', [req.params.slug], (err, rows) => {
        res.render('stats', { rows, slug: req.params.slug });
    });
});

app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));

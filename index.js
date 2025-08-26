import express from "express";
import cors from "cors";
import multer from 'multer';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { pool } from "./db.js";
import { PORT } from "./config.js";
/* require('dotenv').config(); */
const app = express();
app.use(cors({
  origin: 'https://jemstyles.netlify.app',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));


app.get('/',(req,res)=>{
    res.send('bienvenidos')
})
/* =================== MULTER PARA SUBIR IMÁGENES ========================= */
const upload = multer({ dest: 'uploads/' });

app.post('/images/single', upload.single('photos'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se recibió ningún archivo');
  }

  const newPath = `uploads/${req.file.originalname}`;
  try {
    await fs.rename(req.file.path, newPath);

    const title = 'camisa prueba';
    const price = 85000;
    const state = 1;
    const stock = 50;
    const reference = newPath;
    const new_offert = 10;
    const create_product = new Date();
    const cod_tblcategories = 1;

    await pool.query(
      'INSERT INTO products(title, price, stock, reference_product, new_offert, create_product, cod_tblstate_product, cod_tblcategories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, price, stock, reference, new_offert, create_product, state, cod_tblcategories]
    );

    res.send('Archivo recibido y producto guardado correctamente');
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Error al guardar el archivo o insertar producto');
  }
});

/* =================== LOGIN CON JWT ========================= */
app.get('/login', async (req, res) => {
  const existingToken = req.cookies.token_session;
  const secretKey = process.env.SECRET_KEY || 'token.env.dev'; // Usa variable de entorno

  if (existingToken) {
    try {
      jwt.verify(existingToken, secretKey);
      return res.json({ message: 'Token existente válido, no se creó uno nuevo' });
    } catch (err) {
      // Token inválido o expirado, se creará uno nuevo abajo
    }
  }

  const token_generate = 'token_sessions-' + Math.random().toString(36).substring(2);
  const token = jwt.sign(token_generate, secretKey);

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);

  // Detecta si estás en producción para usar secure:true
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token_session', token, {
    httpOnly: fakse,          // Mejor seguridad, no accesible desde JS
    secure: true,    // Solo en producción con HTTPS
    expires: expirationDate,
    sameSite: 'lax',         // Evita problemas con SPA y navegación normal
    path: '/',               // Cookie disponible en todo el dominio
  });

  const userTemp = 'user_temporal';
  const typeUser = 3;
  const dateCreateUser = new Date();

  try {
    await pool.query(
      'INSERT INTO users(name, token_session, type_profile, date_create) VALUES (?, ?, ?, ?)',
      [userTemp, token, typeUser, dateCreateUser]
    );
    res.json({ message: 'Login exitoso, token creado y guardado en cookie' });
  } catch (err) {
    console.error('Error al insertar usuario:', err);
    res.status(500).send('Error al crear usuario');
  }
});

/* =================== RUTAS VARIAS ========================= */
app.get("/readProducts", async (req, res) => {
  const user_token = req.query.user_token;
  const categoriesParam = req.query.categories;
  const categories = categoriesParam ? categoriesParam.split(',').map(Number) : [];

  try {
    const [result] = await pool.query(
      `SELECT p.*, t.description, 
        IFNULL(MAX(CASE WHEN u.token_session = ? THEN l.liked ELSE 0 END),0) AS liked
       FROM products p
       LEFT JOIN liked l ON l.cod_tblproducts = p.cod_product
       LEFT JOIN users u ON l.cod_tblusers = u.id_user
       LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product
       INNER JOIN categories c ON p.cod_tblcategories = c.index_categorie
       WHERE c.index_categorie IN (?)
       GROUP BY p.cod_product
       ORDER BY t.cod_state ASC;`,
      [user_token, categories]
    );

    res.json(result);
  } catch (err) {
    console.error("Error en la consulta:", err);
    res.status(500).send("Error en la consulta");
  }
});

app.post("/insertStateLiked", async (req, res) => {
  const { cod_product, liked, user_token } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO liked (liked, cod_tblusers, cod_tblproducts)
       SELECT ?, u.id_user, ? FROM users AS u WHERE u.token_session = ?`,
      [liked, cod_product, user_token]
    );
    res.send(result);
  } catch (err) {
    console.error("Error en la consulta SQL:", err);
    res.status(500).send({ error: "Error al insertar el like" });
  }
});

app.put("/updateStateLiked", async (req, res) => {
  const { liked, cod_product, user_token } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE liked l
       INNER JOIN users s ON l.cod_tblusers = s.id_user
       SET l.liked = ?
       WHERE l.cod_tblproducts = ? AND s.token_session = ?`,
      [liked, cod_product, user_token]
    );
    res.send(result);
  } catch (err) {
    console.error("Error en la consulta SQL:", err);
    res.status(500).send({ error: "Error al actualizar el like" });
  }
});

app.get("/readProductsWishtList", async (req, res) => {
  const token_session = req.query.token_session;

  try {
    const [result] = await pool.query(
      `SELECT p.*, t.description, l.liked
       FROM products p
       LEFT JOIN liked l ON l.cod_tblproducts = p.cod_product
       LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product
       INNER JOIN users u ON l.cod_tblusers = u.id_user
       WHERE l.liked = true AND u.token_session = ?`,
      [token_session]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al leer lista de deseos');
  }
});

app.post('/insertProductsCart', async (req, res) => {
  const quantity_garment = 1;
  const { size_selected, cod_tblproducts, cod_tblusers } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO details_cart (quantity_garment, size_garment, cod_tblproducts, cod_tblusers)
       SELECT ?, ?, ?, u.id_user FROM users u WHERE u.token_session = ?
       ON DUPLICATE KEY UPDATE quantity_garment = quantity_garment + 1`,
      [quantity_garment, size_selected, cod_tblproducts, cod_tblusers]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al insertar producto en carrito');
  }
});

app.get('/getPedidosCart', async (req, res) => {
  const user_token = req.query.user_token;

  try {
    const [result] = await pool.query(
      `SELECT p.*, d.*, s.*
       FROM products p
       INNER JOIN details_cart d ON p.cod_product = d.cod_tblproducts
       INNER JOIN users u ON d.cod_tblusers = u.id_user
       INNER JOIN shopping_cart s ON u.id_user = s.cod_tblusers
       WHERE u.token_session = ?
       ORDER BY d.cod_details_cart ASC`,
      [user_token]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener pedidos del carrito');
  }
});

app.get('/readCountProductsCart', async (req, res) => {
  const user_token = req.query.token_session;

  try {
    const [result] = await pool.query(
      `SELECT SUM(d.quantity_garment) AS cantidad
       FROM details_cart d
       INNER JOIN users u ON d.cod_tblusers = u.id_user
       WHERE u.token_session = ?`,
      [user_token]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al contar productos en carrito');
  }
});

app.get('/loginNewUser', async (req, res) => {
  const { user, password } = req.query;

  try {
    const [result] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND password = ?',
      [user, password]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en login');
  }
});

app.delete('/removeProductsBag/:cod_details_cart', async (req, res) => {
  const cod_details_cart = req.params.cod_details_cart;

  try {
    const [result] = await pool.query(
      'DELETE FROM details_cart WHERE cod_details_cart = ?',
      [cod_details_cart]
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al eliminar producto del carrito');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

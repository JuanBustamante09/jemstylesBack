const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require('multer');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

app.use(cors({
  origin: 'https://jemstyles.netlify.app',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));


const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,  // Ajusta según tu necesidad y límite del servidor
  queueLimit: 0
});


app.get('/',(req,res)=>{
    res.send('bienvenidos')
})
/* =================== MULTER PARA SUBIR IMÁGENES ========================= */
const upload = multer({ dest: 'uploads/' });

app.post('/images/single', upload.single('photos'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se recibió ningún archivo');
  }

  const newPath = `uploads/${req.file.originalname}`;
  fs.rename(req.file.path, newPath, (err) => {
    if (err) {
      console.error('Error al mover archivo:', err);
      return res.status(500).send('Error al guardar el archivo');
    }

    // Aquí puedes insertar el producto en la base de datos si quieres
    const title = 'camisa prueba';
    const price = 85000;
    const state = 1;
    const stock = 50;
    const reference = newPath;
    const new_offert = 10;
    const create_product = new Date();
    const cod_tblcategories = 1;

    pool.query(
      'INSERT INTO products(title, price, stock, reference_product, new_offert, create_product, cod_tblstate_product, cod_tblcategories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, price, stock, reference, new_offert, create_product, state, cod_tblcategories],
      (err, result) => {
        if (err) {
          console.error('Error al insertar producto:', err);
          return res.status(500).send('Error al insertar producto');
        }
        res.send('Archivo recibido y producto guardado correctamente');
      }
    );
  });
});

/* =================== LOGIN CON JWT ========================= */
app.get('/login', (req, res) => {
  const existingToken = req.cookies.token_session;
  const secretKey = 'token.env.dev'; // Idealmente poner en .env

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

  res.cookie('token_session', token, {
    httpOnly: false,
    secure: false, // Cambiar a true si usas HTTPS
    expires: expirationDate,
    sameSite: 'strict'
  });

  const userTemp = 'user_temporal';
  const typeUser = 3;
  const dateCreateUser = new Date();

  pool.query(
    'INSERT INTO users(name, token_session, type_profile, date_create) VALUES (?, ?, ?, ?)',
    [userTemp, token, typeUser, dateCreateUser],
    (err, result) => {
      if (err) {
        console.error('Error al insertar usuario:', err);
        return res.status(500).send('Error al crear usuario');
      }
      res.json({ message: 'Login exitoso, token creado y guardado en cookie' });
    }
  );
});

/* =================== RUTAS VARIAS ========================= */
app.get("/readProducts", (req, res) => {
  const user_token = req.query.user_token;
  const categoriesParam = req.query.categories;
  const categories = categoriesParam ? categoriesParam.split(',').map(Number) : [];

  pool.query(
    `SELECT p.*, t.description, IFNULL(MAX(CASE WHEN u.token_session = ? THEN l.liked ELSE 0 END),0) AS liked
     FROM products p
     LEFT JOIN liked l ON l.cod_tblproducts = p.cod_product
     LEFT JOIN users u ON l.cod_tblusers = u.id_user
     LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product
     INNER JOIN categories c ON p.cod_tblcategories = c.index_categorie
     WHERE c.index_categorie IN (?)
     GROUP BY p.cod_product
     ORDER BY t.cod_state ASC;`,
    [user_token, categories],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al leer productos');
      }
      res.send(result);
    }
  );
});

app.post("/insertStateLiked", (req, res) => {
  const { cod_product, liked, user_token } = req.body;

  pool.query(
    `INSERT INTO liked (liked, cod_tblusers, cod_tblproducts)
     SELECT ?, u.id_user, ? FROM users AS u WHERE u.token_session = ?`,
    [liked, cod_product, user_token],
    (err, result) => {
      if (err) {
        console.error("Error en la consulta SQL:", err);
        return res.status(500).send({ error: "Error al insertar el like" });
      }
      res.send(result);
    }
  );
});

app.put("/updateStateLiked", (req, res) => {
  const { liked, cod_product, user_token } = req.body;

  pool.query(
    `UPDATE liked l
     INNER JOIN users s ON l.cod_tblusers = s.id_user
     SET l.liked = ?
     WHERE l.cod_tblproducts = ? AND s.token_session = ?`,
    [liked, cod_product, user_token],
    (err, result) => {
      if (err) {
        console.error("Error en la consulta SQL:", err);
        return res.status(500).send({ error: "Error al actualizar el like" });
      }
      res.send(result);
    }
  );
});

app.get("/readProductsWishtList", (req, res) => {
  const token_session = req.query.token_session;

  pool.query(
    `SELECT p.*, t.description, l.liked
     FROM products p
     LEFT JOIN liked l ON l.cod_tblproducts = p.cod_product
     LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product
     INNER JOIN users u ON l.cod_tblusers = u.id_user
     WHERE l.liked = true AND u.token_session = ?`,
    [token_session],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al leer lista de deseos');
      }
      res.send(result);
    }
  );
});

app.post('/insertProductsCart', (req, res) => {
  const quantity_garment = 1;
  const { size_selected, cod_tblproducts, cod_tblusers } = req.body;

  pool.query(
    `INSERT INTO details_cart (quantity_garment, size_garment, cod_tblproducts, cod_tblusers)
     SELECT ?, ?, ?, u.id_user FROM users u WHERE u.token_session = ?
     ON DUPLICATE KEY UPDATE quantity_garment = quantity_garment + 1`,
    [quantity_garment, size_selected, cod_tblproducts, cod_tblusers],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al insertar producto en carrito');
      }
      res.send(result);
    }
  );
});

app.get('/getPedidosCart', (req, res) => {
  const user_token = req.query.user_token;

  pool.query(
    `SELECT p.*, d.*, s.*
     FROM products p
     INNER JOIN details_cart d ON p.cod_product = d.cod_tblproducts
     INNER JOIN users u ON d.cod_tblusers = u.id_user
     INNER JOIN shopping_cart s ON u.id_user = s.cod_tblusers
     WHERE u.token_session = ?
     ORDER BY d.cod_details_cart ASC`,
    [user_token],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al obtener pedidos del carrito');
      }
      res.send(result);
    }
  );
});

app.get('/readCountProductsCart', (req, res) => {
  const user_token = req.query.token_session;

  pool.query(
    `SELECT SUM(d.quantity_garment) AS cantidad
     FROM details_cart d
     INNER JOIN users u ON d.cod_tblusers = u.id_user
     WHERE u.token_session = ?`,
    [user_token],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al contar productos en carrito');
      }
      res.send(result);
    }
  );
});

app.get('/loginNewUser', (req, res) => {
  const { user, password } = req.query;

  pool.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [user, password],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error en login');
      }
      res.send(result);
    }
  );
});

app.delete('/removeProductsBag/:cod_details_cart', (req, res) => {
  const cod_details_cart = req.params.cod_details_cart;

  pool.query(
    'DELETE FROM details_cart WHERE cod_details_cart = ?',
    [cod_details_cart],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error al eliminar producto del carrito');
      }
      res.send(result);
    }
  );
});

app.get('/comprobate',(req,res)=>{
    console.log('entra exitoso nasa')
})

const PORT = process.env.DB_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

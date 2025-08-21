const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
const multer = require('multer');
const cookieParser = require('cookie-parser');
const fs = require('node:fs');
const jwt = require('jsonwebtoken')
require('dotenv').config();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));


const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password : process.env.PASSWORD,
    database: process.env.DATABASE
});

/* =================== HOMMIE ========================= */

/* ============================================ */
const upload = multer({ dest: 'uploads/'})

app.post('/images/single', upload.single('photos'), (req, res) => {
    console.log(req.file);
    saveImage(req.file);
    if (!req.file) {
        return res.status(400).send('No se recibió ningún archivo');
    }

    res.send('Archivo recibido y guardado correctamente');
});

function saveImage(file){
    const newPath = `uploads/${file.originalname}`;
    fs.renameSync(file.path, newPath);
    app.post('/insertProductAdmin',(req,res) =>{
        const title = 'camisa prueba'
        const price = 85000
        const state = 1
        const stock = 50
        const reference = newPath
        const new_offert = 10
        const create_product = new Date()
        const cod_tblcategories = 1
    
        db.query('INSERT INTO products(title,price,stock,reference_product,new_offert,create_product,cod_tblstate_product, cod_tblcategories) VALUES (?,?,?,?,?,?,?,?)',[title,price,stock,reference,new_offert,create_product,state,cod_tblcategories],
            (err, result)=>{
                if(err){
                    console.log(err)
                }else{
                    res.send(result)
                }
            }
        )
        /* const title = title
        const price = price
        const state_product = state_product
        const size_product = size_product
        const stock = stock
        const reference_product = newPath */
    })
    return newPath;
}

/* ============================================ */
app.get('/login', (req, res) => {
  const existingToken = req.cookies.token_session;
  const userTemp = 'user_temporal'
  const typeUser = 3
  const dateCreateUser = new Date()
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7); // Expira en 7 días
  
  if (existingToken) {
      // Verificar si el token es válido
      try {
          jwt.verify(existingToken, 'token.env.dev');
          // Si es válido, no crear uno nuevo, solo responder que ya está logueado
          return res.json({ message: 'Token existente válido, no se creó uno nuevo' });
        } catch (err) {
            // Token inválido o expirado, se creará uno nuevo abajo
        }
    }
    
    // Si no hay token o es inválido, crear uno nuevo
    const token_generate = 'token_sessions-' + Math.random().toString(36).substring(2);
    
    // Crear token JWT firmando el string generado
    const token = jwt.sign(token_generate, 'token.env.dev');
    
    // Guardar token en cookie
    res.cookie('token_session', token, {
        httpOnly: false,
        secure: false,       // Cambiar a true si usas HTTPS
        expires: expirationDate,    // Opcional: duración de 1 hora
        sameSite: 'strict'
    });
    
  res.json({ message: 'Login exitoso, token creado y guardado en cookie' });
    console.log('token_session: '+token)
  
  db.query('INSERT INTO users(name, token_session, type_profile, date_create) VALUES (?,?,?,?)',[userTemp,token,typeUser,dateCreateUser]),
  (err, result)=>{
      if(err){
            console.log(err)
        }else{
            res.send(result)
        }
    }
});
/* ============================================== */
app.get("/readProducts",(req,res)=>{
    const user_token = req.query.user_token
    const categoriesParam = req.query.categories
    const categories = categoriesParam ? categoriesParam.split(',').map(Number) : [];
    db.query('SELECT p.*, t.description, IFNULL(MAX(CASE WHEN u.token_session = ? THEN l.liked ELSE 0 END),0) AS liked FROM products p LEFT JOIN liked l ON l.cod_tblproducts = p.cod_product LEFT JOIN users u ON l.cod_tblusers = u.id_user LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product INNER JOIN categories c ON p.cod_tblcategories = c.index_categorie WHERE c.index_categorie IN(?) GROUP BY p.cod_product ORDER BY t.cod_state ASC;',[user_token,categories],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* ================================================================================= */
app.post("/insertStateLiked", (req, res) => {
  const cod_product = req.body.cod_product;
  const liked = req.body.liked;
  const user_token = req.body.user_token;

  console.log("Token de sesión:", req.body.user_token);

  db.query('INSERT INTO liked (liked, cod_tblusers, cod_tblproducts) SELECT ?, u.id_user, ? FROM users AS u WHERE u.token_session = ?', [liked, cod_product,user_token], 
    (err, result) => {
        if (err) {
            console.error("Error en la consulta SQL:", err);
            res.status(500).send({ error: "Error al insertar el like" });
        } else {
            res.send(result);
        }
  });
});
/* ========================================================================= */
app.put("/updateStateLiked", (req, res) => {
  const liked = req.body.liked;
  const cod_product = req.body.cod_product;
  const user_token = req.body.user_token

  db.query(
    'UPDATE liked l INNER JOIN users s ON l.cod_tblusers = s.id_user SET l.liked = ? WHERE l.cod_tblproducts = ? and s.token_session = ?', [liked, cod_product, user_token],
    (err, result) => {
      if (err) {
        console.error("Error en la consulta SQL:", err);
        res.status(500).send({ error: "Error al actualizar el like" });
      } else {
        console.log('Filas afectadas:', result.affectedRows);
        res.send(result);
      }
    }
  );
});
/* ========================================================================= */
app.get("/readProductsWishtList",(req,res)=>{
    const token_session = req.query.token_session
    db.query('SELECT p.*, t.description, l.liked FROM products p LEFT JOIN liked l on l.cod_tblproducts = p.cod_product LEFT JOIN state_product t ON t.cod_state = p.cod_tblstate_product INNER JOIN users u on l.cod_tblusers = u.id_user WHERE l.liked = true AND u.token_session = ?', [token_session],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* ========================================================================= */
app.post('/insertProductsCart',(req,res)=>{
    const quantity_garment = 1
    const size_selected = req.body.size_selected
    const cod_tblproducts = req.body.cod_tblproducts
    const cod_tblusers = req.body.cod_tblusers

    db.query('INSERT INTO details_cart (quantity_garment, size_garment, cod_tblproducts, cod_tblusers) SELECT ?, ?, ?, u.id_user FROM users u WHERE u.token_session = ? ON DUPLICATE KEY UPDATE quantity_garment = quantity_garment + 1' ,[quantity_garment,size_selected,cod_tblproducts,cod_tblusers],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* ============================================================================ */
app.get('/getPedidosCart',(req,res)=>{
    const user_token = req.query.user_token

    db.query('SELECT p.*, d.*,s.* from products p INNER JOIN details_cart d ON p.cod_product = d.cod_tblproducts INNER JOIN users u ON d.cod_tblusers = u.id_user INNER JOIN shopping_cart s ON u.id_user = s.cod_tblusers where u.token_session = ? ORDER BY d.cod_details_cart asc',[user_token],
    (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* =========================================================================== */
app.get('/readCountProductsCart',(req,res) =>{
    const user_token = req.query.token_session

    db.query('SELECT SUM(d.quantity_garment) AS cantidad FROM details_cart d INNER JOIN users u ON d.cod_tblusers = u.id_user WHERE u.token_session = ?',[user_token],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* =========================================== login ============================================= */
app.get('/loginNewUser',(req,res) =>{
    const user = req.query.user
    const password = req.query.password
console.log('entra')
    db.query('SELECT * FROM users WHERE email = ? AND password = ?',[user,password],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
/* ============================================================================== */
app.delete('/removeProductsBag/:cod_details_cart',(req,res)=>{
    const cod_details_cart = req.params.cod_details_cart

    db.query('delete from details_cart where cod_details_cart = ?', [cod_details_cart],
        (err, result)=>{
            if(err){
                console.log(err)
            }else{
                res.send(result)
            }
        }
    )
})
app.listen(58624,()=>{
    console.log("corriendo en el puerto 58624")
})
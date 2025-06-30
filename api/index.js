const express = require('express');
const exphbs = require('express-handlebars');
const fs = require('fs');
const path = require('path');
const sesh = require('express-session');
const rando = require('randomstring');
const serverless = require('serverless-http');

const app = express();

// Setup Handlebars engine and views like before
const hbs = exphbs.create({
  extname: '.hbs',
  partialsDir: path.join(__dirname, '..', 'views', 'partials'),
});
app.engine('.hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '..', 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(
  sesh({
    secret: 'someSecretKey',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3 * 60 * 1000, // 3 minutes
      secure: false,
    },
  })
);

// Load users from user.json
const userFile = path.join(__dirname, '..', 'user.json');
let users = {};
try {
  const data = fs.readFileSync(userFile, 'utf8');
  users = JSON.parse(data);
} catch (err) {
  console.error('Error reading user.json', err);
}

// Login middleware
function Login(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/signin');
  }
  next();
}

// Routes (copy all your routes here, update paths for __dirname accordingly)

app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/signin', (req, res) => {
  res.render('signin', { error: null });
});

app.post('/signin', (req, res) => {
  const { username, password } = req.body;
  if (!users[username]) {
    return res.render('signin', { error: 'not a registered username' });
  }
  if (users[username] !== password) {
    return res.render('signin', { error: 'invalid Password', username });
  }
  req.session.user = username;
  req.session.token = rando.generate(16);
  res.redirect('/home');
});

app.get('/home', Login, (req, res) => {
  const booksFile = path.join(__dirname, '..', 'books.json');
  let books = [];
  try {
    const data = fs.readFileSync(booksFile, 'utf8');
    books = JSON.parse(data);
  } catch (err) {
    console.error('Error reading books.json:', err);
  }
  const username = req.session.user;
  let availableBooks = books.filter((book) => book.available);
  let borrowedBooks = books.filter((book) => !book.available);
  res.render('home', {
    username,
    availableBooks,
    borrowedBooks,
  });
});

app.post('/borrow', Login, (req, res) => {
  let selectedBooks = req.body.books;
  if (!selectedBooks) {
    return res.redirect('/home');
  }
  if (!Array.isArray(selectedBooks)) {
    selectedBooks = [selectedBooks];
  }
  const booksPath = path.join(__dirname, '..', 'books.json');
  let books = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));
  const updated = books.map((book) => {
    if (selectedBooks.includes(book.title) && book.available) {
      return { ...book, available: false };
    }
    return book;
  });
  fs.writeFileSync(booksPath, JSON.stringify(updated, null, 2));
  res.redirect('/home');
});

app.post('/return', Login, (req, res) => {
  let selectedBooks = req.body.books;
  if (!selectedBooks) {
    return res.redirect('/home');
  }
  if (!Array.isArray(selectedBooks)) {
    selectedBooks = [selectedBooks];
  }
  const booksPath = path.join(__dirname, '..', 'books.json');
  let books = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));
  const updated = books.map((book) => {
    if (selectedBooks.includes(book.title) && !book.available) {
      return { ...book, available: true };
    }
    return book;
  });
  fs.writeFileSync(booksPath, JSON.stringify(updated, null, 2));
  res.redirect('/home');
});

app.get('/signout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Export handler wrapped with serverless-http
module.exports.handler = serverless(app);

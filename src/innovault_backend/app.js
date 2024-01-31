// innovault_backend/app.js

const express = require('express');
const app = express();
const path = require('path');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Register Page
app.get('/register', (req, res) => {
    res.render('register');
});

// Dashboard Page
app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

// ... other routes and configurations

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

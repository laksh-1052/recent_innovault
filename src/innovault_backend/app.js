require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { MongoClient } = require('mongodb');
// const ipfsClient = require('ipfs-http-client');
const path = require('path');
const FormData = require('form-data');
// const Helia = require('helia');
// const path = require('path');
const { exec } = require('child_process');





const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// const ipfs = ipfsClient('http://localhost:5001');
const ipfsApiEndpoint = 'http://localhost:5001/api/v0/add';

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
const uri = 'mongodb+srv://tjlakshmi10:laksh1052@cluster0.htu5k6v.mongodb.net/innovault';
const client = new MongoClient(uri);
// async function connectToMongo() {
//   try {
//       await client.connect();
//       console.log('Connected to MongoDB');
//       // Use client to interact with the database
//   } catch (error) {
//       console.error('Error connecting to MongoDB:', error);
//   }
// }
//connectToMongo();

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000 // Set timeout to 30 seconds (for example)
});

//mongoose.connect('',{ useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  secret: String,
  username:{ type: String, unique: false }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
  
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/innovault",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},

function(accessToken, refreshToken, profile, cb) {
  console.log(profile);

  User.findOrCreate({ googleId: profile.id, username: profile.displayName || 'defaultUsername' }, function (err, user) {
    return cb(err, user);
  });
}));

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/innovault",
  passport.authenticate('google', { failureRedirect: "/register" }),
  function(req, res) {
    
    res.redirect("/dashboard");
  });

  app.get("/", function(req,res){
    res.render("register");
  })

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/dashboard", function(req, res){
    res.render("dashboard");
  });

  app.get("/upload", function(req, res){
    res.render("upload");
  });
  app.get("/downloadButton", function(req, res){
    res.render("downloadButton");
  });
  app.get('/download', (req, res) => {
    // Get the IPFS hash from the query parameters
    const ipfsHash = ' QmeNgQ7fUhECbAwzSMHi3M8xftnXWdptS2srEThD6PH9i4';

    // Execute the ipfs get command to download the file
    exec(`ipfs get ${ipfsHash} -o output3.pdf`, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error downloading file from IPFS');
            return;
        }
        
        // Execute the xdg-open command to open the downloaded PDF
        exec('xdg-open output3.pdf', (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error opening downloaded file');
                return;
            }
            
            res.send('File downloaded and opened successfully');
        });
    });
});



// app.post('/upload', upload.single('file'), async (req, res) => {
//   try {
//     const file = req.file;
//     if (!file) {
//       return res.status(400).send('No file uploaded.');
//     }
//     const formData = new FormData();
//     formData.append('file', file.buffer, {
//       filename: file.originalname,
//       contentType: file.mimetype,
//     });
//     const ipfsResponse = await axios.post(ipfsApiEndpoint, formData, {
//       headers: {
//         ...formData.getHeaders(),
//       },
//     });
//     const cid = ipfsResponse.data.Hash;

//     res.status(200).send(`File uploaded to IPFS. CID: ${cid}`);
//   } catch (error) {
//     console.error('Error uploading file to IPFS:', error);
//     res.status(500).send('Internal Server Error');
//   }
// });
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    const ipfsResponse = await axios.post(ipfsApiEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    const cid = ipfsResponse.data.Hash;

    res.render('uploaded', { cid }); // Pass CID to the uploaded.ejs template
    const responseHtml = `
      <p>File uploaded to IPFS. CID: ${cid}</p>
      <button onclick="window.location.href='/dashboard'">Back to Dashboard</button>
    `;
    
    // Send HTML response with back button
    res.status(200).send(responseHtml);
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("dashboard");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});



app.post("/register", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/dashboard");
      });
    }
  });

});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/dashboard");
      });
    }
  });

});

  





app.listen(3000, function() {
  console.log("Server started on port 3000.");
});

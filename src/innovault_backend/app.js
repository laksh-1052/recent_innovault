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
const multer = require('multer');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const fs = require('fs');
const mime = require('mime-types');

const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      const uploadPath = 'uploads/';
      if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const fileMimeType = file.mimetype;
  console.log('File MIME type:', fileMimeType);

  if (typeof fileMimeType === 'string' && (fileMimeType.startsWith('image/') || fileMimeType === 'application/pdf')) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Unsupported media type'), false); // Reject file
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter
});

const ipfsApiEndpoint = 'http://localhost:5001/api/v0/add';

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false,
  
}));

app.use(passport.initialize());
app.use(passport.session());

const uri = 'mongodb+srv://tjlakshmi10:laksh1052@cluster0.htu5k6v.mongodb.net/innovault';
const client = new MongoClient(uri);

mongoose.connect(uri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
  username: { type: String, unique: false }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
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
  function (accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id, username: profile.displayName || 'defaultUsername' }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: 'Multer error: ' + err.message });
  } else if (err) {
    res.status(500).json({ error: 'Unknown error: ' + err.message });
  } else {
    next();
  }
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/innovault",
  passport.authenticate('google', { failureRedirect: "/register" }),
  function (req, res) {
    res.redirect("/dashboard");
  });

app.get("/", function (req, res) {
  res.render("register");
});

app.get("/login", function (req, res) {
  res.render("login");
});


app.get("/register", function (req, res) {
  res.render("register");
});

app.get('/dashboard', (req, res) => {
  // Read fileRecords.json
  fs.readFile(fileRecordsPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading fileRecords.json:', err);
      res.status(500).send('Server Error');
      return;
    }

    try {
      // Parse JSON and count the keys
      const fileRecords = JSON.parse(data);
      const fileCount = Object.keys(fileRecords).length;
      console.log('Number of files:', fileCount); // Debugging log

      // Render the dashboard.ejs template with fileCount
      res.render('dashboard', { fileCount });
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      res.status(500).send('Server Error');
    }
  });
});

app.get("/upload", function (req, res) {
  res.render("upload");
});

const fileRecordsPath = path.join(__dirname, 'fileRecords.json');
const passcodesPath = path.join(__dirname, 'passcodes.json');

function loadFileRecords() {
  if (fs.existsSync(fileRecordsPath)) {
    const data = fs.readFileSync(fileRecordsPath, 'utf8');
    return JSON.parse(data);
  }
  return {};
}

function saveFileRecords(records) {
  fs.writeFileSync(fileRecordsPath, JSON.stringify(records, null, 2));
}

function loadPasscodes() {
  if (fs.existsSync(passcodesPath)) {
    const data = fs.readFileSync(passcodesPath, 'utf8');
    return JSON.parse(data);
  }
  return {};
}

function savePasscodes(passcodes) {
  fs.writeFileSync(passcodesPath, JSON.stringify(passcodes, null, 2));
}

function generatePasscode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

let passcodes = loadPasscodes();
let fileRecords = loadFileRecords();

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Received upload request');
    const file = req.file;
    const fileName = req.body.filename;
    const passcode = generatePasscode();

    if (!file || !fileName) {
      return res.status(400).send('File and file name are required.');
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const ipfsResponse = await axios.post(ipfsApiEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    const cid = ipfsResponse.data.Hash;
    console.log('File uploaded to IPFS with CID:', cid);

    fileRecords[fileName] = cid;
    saveFileRecords(fileRecords);

    passcodes[fileName] = passcode;
    savePasscodes(passcodes);

    console.log('Current file records:', fileRecords);

    res.render('uploaded', { fileName, cid, passcode });
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    res.status(500).send('Internal Server Error');
  }
});
console.log(fileRecords);

app.get('/files', (req, res) => {
  res.render('files', { fileRecords });
});

app.get('/passcode', (req, res) => {
  const { cid, fileName } = req.query;
  res.render('passcode', { fileName, cid });
});

app.post('/verify-passcode', (req, res) => {
  const { fileName, cid, passcode } = req.body;

  if (passcodes[fileName] === passcode) {
    res.redirect(`/download?cid=${cid}&fileName=${fileName}`);
  } else {
    res.status(401).send('Invalid passcode');
  }
});

// Serve downloads directory
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

app.get('/download', async (req, res) => {
  const { cid, fileName } = req.query;

  const outputPath = path.join(__dirname, 'downloads', fileName);

  if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
    fs.mkdirSync(path.join(__dirname, 'downloads'));
  }

  exec(`ipfs get ${cid} -o ${outputPath}`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error downloading file from IPFS');
      return;
    }

    const fileMimeType = mime.lookup(outputPath);
    console.log('Detected file MIME type:', fileMimeType);

    if (typeof fileMimeType === 'string' && fileMimeType.startsWith('image/')) {
      res.redirect(`/downloads/${fileName}`);
    } else if (fileMimeType === 'application/pdf') {
      res.redirect(`/downloads/${fileName}`);
    } else if (fileMimeType === 'text/plain') {
      res.redirect(`/downloads/${fileName}`);
    } else if (typeof fileMimeType === 'string' && fileMimeType.startsWith('audio/')) {
      res.redirect(`/downloads/${fileName}`);
    } else {
      res.status(400).send('Unsupported file type');
    }
  });
});




app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("dashboard");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res){
  req.logout((err) => {
    if (err) {
        console.error(err);
        return res.status(500).send("Internal Server Error");
    }else{
        res.redirect("/");
    }
 });
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








app.listen(3000, function () {
  console.log("Server started on port 3000");
});

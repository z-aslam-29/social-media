require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');

// App Initialization
const app = express();
app.use(bodyParser.json());

// Environment Variables
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// MongoDB Models
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    email: String,
    password: String,
    apiKey: String,
    platforms: [String],
    growstackToken: String,
  })
);

// Database Connection
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Helper Functions
const generateApiKey = () => crypto.randomBytes(16).toString('hex');

// Middleware: Authenticate JWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send({ message: 'Token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send({ message: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// Routes

// 1. Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (await User.findOne({ email }))
    return res.status(400).send({ message: 'User already exists. Please login.' });

  const newUser = new User({ email, password });
  await newUser.save();

  res.status(201).send({ message: 'Signup successful!', userId: newUser._id });
});

// 2. Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || user.password !== password)
    return res.status(401).send({ message: 'Invalid email or password.' });

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  res.send({ message: 'Login successful!', token });
});

// 3. Fill Required Fields
app.post('/fill-details', authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  const { details } = req.body;

  if (!details || Object.keys(details).length === 0)
    return res.status(400).send({ message: 'Please fill all required fields.' });

  await User.updateOne({ _id: userId }, { $set: details });
  res.send({ message: 'Details saved successfully!' });
});

// 4. Select Platforms and Generate API Key
app.post('/select-platforms', authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  const { platforms } = req.body;

  if (!platforms || platforms.length === 0)
    return res.status(400).send({ message: 'Please select at least one platform.' });

  const apiKey = generateApiKey();
  await User.updateOne({ _id: userId }, { platforms, apiKey });

  res.send({ message: 'Platforms selected and API key generated!', apiKey });
});

// 5. Connect to Growstack Media
app.post('/connect-growstack', authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  const user = await User.findById(userId);

  if (!user || !user.apiKey)
    return res.status(403).send({ message: 'API Key not generated yet.' });

  // Simulate external API token generation
  const growstackToken = crypto.randomBytes(20).toString('hex'); // Replace with actual API call

  await User.updateOne({ _id: userId }, { growstackToken });
  res.send({ message: 'Connected to Growstack successfully!', growstackToken });
});

// 6. Perform API Calls
app.post('/perform-api-call', authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  const { action } = req.body;

  const user = await User.findById(userId);
  if (!user || !user.growstackToken)
    return res.status(403).send({ message: 'Please connect to Growstack first.' });

  // Mock API Calls
  let result;
  switch (action) {
    case 'fetchPosts':
      result = { posts: ['Post 1', 'Post 2', 'Post 3'] }; // Replace with Growstack API calls
      break;
    case 'fetchComments':
      result = { comments: ['Comment 1', 'Comment 2'] }; // Replace with Growstack API calls
      break;
    case 'fetchLikes':
      result = { likes: 123 }; // Replace with Growstack API calls
      break;
    default:
      return res.status(400).send({ message: 'Invalid action specified.' });
  }

  res.send({ message: 'API call successful!', data: result });
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

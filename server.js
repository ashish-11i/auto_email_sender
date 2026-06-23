const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer storage for uploaded resumes/attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique name: timestamp + random + original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// API to check for default PDF resume in root (backward compatibility)
app.get('/api/attachment-status', (req, res) => {
  const defaultResume = 'Ashish_Kumar_Kushavaha_Java_Backend.pdf';
  const filePath = path.join(__dirname, defaultResume);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    return res.json({
      exists: true,
      filename: defaultResume,
      size: stats.size,
      path: filePath
    });
  }
  return res.json({ exists: false });
});

// API to handle dynamic file uploads
app.post('/api/upload-attachment', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  return res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

// API to send a single email
app.post('/api/send-email', async (req, res) => {
  const { 
    smtpHost, 
    smtpPort, 
    smtpUser, 
    smtpPass, 
    to, 
    subject, 
    body, 
    attachmentFilename, 
    attachmentOriginalName 
  } = req.body;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false // bypass SSL verification issues
      }
    });

    // Check and set dynamic attachment if uploaded
    let attachments = [];
    if (attachmentFilename) {
      const filePath = path.join(__dirname, 'uploads', attachmentFilename);
      if (fs.existsSync(filePath)) {
        attachments.push({
          filename: attachmentOriginalName || attachmentFilename,
          path: filePath
        });
      }
    }

    const mailOptions = {
      from: `"${smtpUser.split('@')[0]}" <${smtpUser}>`,
      to: to,
      subject: subject,
      text: body,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    return res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Mail sending error for recipient:', to, error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Kill previous running process if any port binding conflict occurs, otherwise start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

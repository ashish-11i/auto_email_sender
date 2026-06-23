const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Increase JSON request limits to support in-memory Base64 file attachments
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// API to check for default PDF resume in root (maintained for backward compatibility)
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

// API to send a single email with in-memory Base64 attachment
app.post('/api/send-email', async (req, res) => {
  const { 
    smtpHost, 
    smtpPort, 
    smtpUser, 
    smtpPass, 
    to, 
    subject, 
    body, 
    attachment 
  } = req.body;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false // bypass SSL verification issues
      }
    });

    // Check and configure attachment from Base64 string if present
    let attachments = [];
    if (attachment && attachment.content) {
      attachments.push({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, 'base64'),
        contentType: attachment.contentType
      });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const nodemailer = require('nodemailer');

export default async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://cayc-incubation.vercel.app'); // Adjust as needed
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  // Set CORS headers for other requests
  res.setHeader('Access-Control-Allow-Origin', 'https://cayc-incubation.vercel.app'); // Adjust as needed
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // Expecting the following keys in the JSON payload: to, subject, body
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, or body' });
    }

    // Create a transporter using your email service and credentials from environment variables.
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // or any other service like 'Yahoo', 'Outlook', etc.
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Set up the email options.
    const mailOptions = {
      from: process.env.EMAIL_USER, // sender address; adjust if needed
      to,                           // recipient address from the payload
      subject,                      // email subject
      text: body,                   // email body (plain text)
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

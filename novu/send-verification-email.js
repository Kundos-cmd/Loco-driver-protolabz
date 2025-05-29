// const { Novu } = require("@novu/node");
// const dotenv = require("dotenv");
// dotenv.config();

// const novu = new Novu(process.env.NOVU_SECRET_KEY);

// function sendVerificationEmail(email, link, sId) {
//   if (!email || !link) {
//     throw new Error("Not enough parameters for sending email");
//   }
//   console.log("email", email, sId);
//   novu.trigger("email-verification", {
//       to: {
//         subscriberId: sId,
//         email: email,
//       },
//       payload: {
//         link: link,
//       },
//     })
//     .then((res) => {
//       console.log("notification sent", res.data, email, sId);
//     })
//     .catch((err) => {
//       console.error("Novu API Error:", err.response?.data || err.message);
//     });
// }

// function sendResetEmail(email, link, sId) {
//   if (!email || !link) {
//     throw new Error("Not enough parameters for sending email");
//   }
//   console.log("email", email, sId);
//   novu
//     .trigger("reset-password", {
//       to: {
//         subscriberId: sId,
//         email: email,
//       },
//       payload: {
//         link: link,
//       },
//     })
//     .then((res) => {
//       console.log("email sent", res.data, email, sId);
//     });
// }
// module.exports = { sendVerificationEmail, sendResetEmail };

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, 
  port: process.env.SMTP_PORT, 
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const logoUrl = `https://res.cloudinary.com/dugjfejkq/image/upload/v1747901250/header-logo_xjwgdw_4_ikjzzn.png`;


// Verification email
async function sendVerificationEmail(email, link, name) {
  if (!email || !link) {
    throw new Error("Not enough parameters for sending email");
  }

  const mailOptions = {
    from: `"LocoDriver" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify Your Email",
    html: `
      <p>Hello ${name || ''},</p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${link}">Verify Email</a>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Verification email sent:", info.messageId, email);
  } catch (error) {
    console.error("SMTP Error:", error.message);
  }
}

{/* <div style="font-family: sans-serif;">
          <h2>Hi ${name},</h2>
          <p>Please find your invoice below.</p>
          <p><strong>Invoice Amount:</strong> $${data.total}</p>
          <p>Due by <strong>${data.dueDate}</strong>.</p>
          <p>Thank you for your business!</p>
        </div> */}

async function sendInvoiceEmail(email, data, name){
  const mailOptions = {
      from: `"Loco Driver" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Invoice #${data.invoiceId} from Your Company`,
      html: `
      <div style="font-family: Arial, sans-serif; color: #000000; font-size: 15px; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://res.cloudinary.com/dugjfejkq/image/upload/v1747901250/header-logo_xjwgdw_4_ikjzzn.png" alt="LocoDriver Logo" style="height: 60px;" />
        </div>
        <h2 style="color: #1294FF;">Your LocoDriver Invoice</h2>
        <p>Hi ${name || 'Customer'},</p>
        <p>Please find your invoice details below:</p>
        <p><strong>Invoice Amount:</strong> $${data.total}</p>
        <p><strong>Due Date:</strong> ${data.dueDate}</p>
        <p>Click on the following button to check your invoice.</p>
        <a href="${data.url}" style="background-color: #1294FF; color: #fff; padding: 12px 24px; text-decoration: none; margin-bottom:5px; border-radius: 6px; display: inline-block;">View Invoice</a>
        <p>Thank you for your business and continued support!</p>
        <p>Stay safe,<br>LocoDriver Billing Team</p>
      </div>
      `,
    };
    // 3. Send mail
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.messageId);

    return info;
}



async function sendResetEmail(email, link, name) {
  if (!email || !link) {
    throw new Error("Not enough parameters for sending email");
  }

  console.log(name);

  const mailOptions = {
    from: `"LocoDriver" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset Your Password",
    html: `
        <div style="font-family: Arial,sans-serif;  color: #000000; font-size:15px; max-width: 600px; margin: auto; padding: 20px; color: #333; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://res.cloudinary.com/dugjfejkq/image/upload/v1747901250/header-logo_xjwgdw_4_ikjzzn.png" alt="LocoDriver Logo" style="height: 60px;" />
        </div>
        <h2 style="color: #1294FF;">LocoDriver Password Reset</h2>
        <p>Dear ${name || 'User'},</p>
        <p>We received a request to reset your password for your LocoDriver account. To reset your password, click the button below:</p>
        <p style="text-align: center;">
          <a href="${link}" style="background-color: #1294FF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>If you did not request a password reset, please ignore this email. Your account is safe.</p>
        <p>Alternatively, you can copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${link}</p>
        <p>Stay secure,<br>LocoDriver Support Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Reset password email sent:", info.messageId, email);
  } catch (error) {
    console.error("SMTP Error:", error.message);
  }
}

module.exports = { sendVerificationEmail, sendResetEmail, sendInvoiceEmail };

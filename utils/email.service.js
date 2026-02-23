import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendOTP = async (email, fullName, otp) => {
  const mailOptions = {
    from: `"Sarvoday Admin" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Admin login OTP - Sarvoday Admin',
    html: getEmailTemplate(fullName, otp)
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Admin OTP sending failed:", error);
    return false;
  }
};

export const sendPasswordResetOTP = async (email, fullName, otp) => {
  const mailOptions = {
    from: `"Sarvoday Support" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset OTP - Sarvoday',
    html: getPasswordResetTemplate(fullName, otp)
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Password reset OTP sending failed:", error);
    return false;
  }
};

export const sendOrderConfirmation = async (email, fullName, orderData) => {
  const mailOptions = {
    from: `"Sarvoday Store" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Order Successfully Placed! - ${orderData.invoice_number}`,
    html: getOrderTemplate(fullName, orderData)
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Order confirmation email failed:", error);
    return false;
  }
};

const getEmailTemplate = (fullName, otp) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Login OTP</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333 text-align: center;">Welcome, ${fullName}!</h2>
        <p style="color: #555; font-size: 16px; text-align: center;">Your One-Time Password (OTP) for admin login is:</p>
        <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; border: 2px dashed #4CAF50; padding: 10px 20px; border-radius: 5px;">${otp}</span>
        </div>
        <p style="color: #555; font-size: 14px; text-align: center;">This OTP is valid for 15 minutes. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; text-align: center;">If you did not request this, please ignore this email.</p>
    </div>
</body>
</html>`;
};

const getPasswordResetTemplate = (fullName, otp) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Reset OTP</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333 text-align: center;">Password Reset Request</h2>
        <p style="color: #555; font-size: 16px;">Hello ${fullName},</p>
        <p style="color: #555; font-size: 16px;">You requested a password reset. Use the OTP below to proceed:</p>
        <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #2196F3; letter-spacing: 5px; border: 2px dashed #2196F3; padding: 10px 20px; border-radius: 5px;">${otp}</span>
        </div>
        <p style="color: #555; font-size: 14px;">Valid for 15 minutes.</p>
    </div>
</body>
</html>`;
};

const getOrderTemplate = (fullName, orderData) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Order Confirmed!</h2>
        <p>Dear ${fullName},</p>
        <p>Your order <strong>${orderData.invoice_number}</strong> has been successfully placed.</p>
        <p><strong>Total Amount:</strong> ₹${orderData.total_amount}</p>
        <hr>
        <p style="font-size: 12px; color: #777; text-align: center;">Thank you for shopping with Sarvoday!</p>
    </div>
</body>
</html>`;
};

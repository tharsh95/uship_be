"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    constructor() {
        // For development, you can use Gmail or other email providers
        // For production, consider using services like SendGrid, AWS SES, etc.
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
            },
        });
    }
    async sendEmail(emailData) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: emailData.to,
                subject: emailData.subject,
                html: emailData.html,
            };
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return true;
        }
        catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }
    async sendPasswordEmail(employeeName, employeeEmail, plainPassword) {
        const subject = 'Welcome to UShip - Your Account Credentials';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to UShip</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .password-box {
            background: #e8f4fd;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
          }
          .password {
            font-size: 18px;
            font-weight: bold;
            color: #1976d2;
            letter-spacing: 2px;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚢 Welcome to UShip!</h1>
          <p>Your account has been successfully created</p>
        </div>
        
        <div class="content">
          <h2>Hello ${employeeName},</h2>
          
          <p>Welcome to UShip! Your employee account has been successfully created. Below are your login credentials:</p>
          
          <div class="password-box">
            <strong>Your Temporary Password:</strong><br>
            <span class="password">${plainPassword}</span>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Notice:</strong><br>
            This is your temporary password. For security reasons, please change your password immediately after your first login.
          </div>
          
          <p>You can now log in to your account using your email address and the password above.</p>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5731'}/login" class="button">
            Login to Your Account
          </a>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>
          The UShip Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2024 UShip. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
        return await this.sendEmail({
            to: employeeEmail,
            subject,
            html,
        });
    }
}
exports.emailService = new EmailService();

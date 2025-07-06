# Email Setup for UShip Backend

This document explains how to set up email functionality to send password notifications to employees when their accounts are created.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Frontend URL (for email links)
FRONTEND_URL="http://localhost:3000"
```

## Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Navigate to Security
   - Under "2-Step Verification", click on "App passwords"
   - Generate a new app password for "Mail"
   - Use this password as `SMTP_PASS`

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
```

### Yahoo
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
```

### Custom SMTP Server
```env
SMTP_HOST="your-smtp-server.com"
SMTP_PORT="587"
SMTP_USER="your-username"
SMTP_PASS="your-password"
```

## Production Recommendations

For production environments, consider using dedicated email services:

### SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

### AWS SES
```env
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_USER="your-ses-smtp-username"
SMTP_PASS="your-ses-smtp-password"
```

### Mailgun
```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="your-mailgun-username"
SMTP_PASS="your-mailgun-password"
```

## Testing Email Functionality

1. Start the backend server
2. Create a new employee with an email address
3. Check the console logs for email sending status
4. Check the employee's email inbox for the welcome message

## Email Template

The email includes:
- Welcome message with employee name
- Generated temporary password
- Security warning to change password
- Login link to the frontend
- Professional styling with UShip branding

## Troubleshooting

### Common Issues

1. **Authentication failed**: Check your email credentials and app password
2. **Connection timeout**: Verify SMTP host and port settings
3. **Email not received**: Check spam folder and email provider settings

### Debug Mode

To enable detailed email logging, add this to your environment:
```env
DEBUG_EMAIL=true
```

## Security Notes

- Never commit email credentials to version control
- Use environment variables for all sensitive information
- Consider using email service providers with better deliverability for production
- Implement rate limiting for email sending to prevent abuse 

import nodemailer from 'nodemailer';

let transporterPromise;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      // Development only: Ethereal test email account
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Production email provider is not configured');
      }

      const account = await nodemailer.createTestAccount();

      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass
        }
      });
    })().catch(error => {
      transporterPromise = null;
      throw error;
    });
  }

  return transporterPromise;
}

export async function sendEmailChangeVerification(to, verificationUrl) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: '"ContextAI" <no-reply@contextai.test>',
    to,
    subject: 'Verify your new ContextAI email address',
    text:
      `You requested to change your ContextAI email address.\n\n` +
      `Verify your new email using this link:\n${verificationUrl}\n\n` +
      `This link expires in 15 minutes.\n\n` +
      `If you did not request this change, ignore this email.`
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log('ContextAI email preview:', previewUrl);
  }
}

import nodemailer from 'nodemailer'
import 'dotenv/config'

async function main() {
  let transporter
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      logger: true,
      debug: true,
    })
  } else {
    const testAccount = await nodemailer.createTestAccount()
    console.log('[SMTP] Using Ethereal test account:', testAccount.user)
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      logger: true,
      debug: true,
    })
  }

  try {
    await transporter.verify()
    console.log('[SMTP] verify OK')
  } catch (e) {
    console.error('[SMTP] verify FAILED', e)
  }

  const to = process.env.TEST_EMAIL_TO || process.env.SMTP_USER
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to,
    subject: 'Test email from File Uploader',
    text: 'This is a test email to verify SMTP configuration.',
    html: '<p>This is a <strong>test email</strong> to verify SMTP configuration.</p>'
  })

  const previewUrl = nodemailer.getTestMessageUrl?.(info)
  console.log('[MAIL] sent, id=', info.messageId, 'preview=', previewUrl)
}

main().catch((e) => {
  console.error('[emailTest] error', e)
  process.exit(1)
})

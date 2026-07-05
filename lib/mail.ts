import 'server-only';
import nodemailer from 'nodemailer';

// SMTP настраивается через env (SMTP_HOST/PORT/USER/PASS, MAIL_FROM, APP_URL).
// Без SMTP_HOST (локальная разработка) письмо не шлём — печатаем ссылку в лог
// сервера, чтобы флоу можно было пройти руками.

const FROM = process.env.MAIL_FROM || 'Almanax <no-reply@almanax.tech>';

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

/** Абсолютная ссылка на приложение — для писем и редиректов за прокси. */
export function appUrl(path: string): string {
  const base = process.env.APP_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '') + path;
}

function emailHtml(heading: string, body: string, cta: string, link: string, note: string): string {
  return `<div style="background:#f6f7f9;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #eceef2;border-radius:16px;padding:32px 30px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#8b909a;text-transform:uppercase;">Almanax</div>
    <h1 style="font-size:21px;letter-spacing:-.02em;margin:10px 0 8px;color:#1a1b1f;">${heading}</h1>
    <p style="font-size:14px;color:#5d626b;line-height:1.6;margin:0 0 22px;">${body}</p>
    <a href="${link}" style="display:inline-block;background:#5a63d8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px;">${cta}</a>
    <p style="font-size:12px;color:#8b909a;line-height:1.6;margin:22px 0 0;">${note}<br>
      Если кнопка не работает, открой ссылку вручную:<br>
      <a href="${link}" style="color:#5a63d8;word-break:break-all;">${link}</a></p>
  </div>
</div>`;
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.log(`[mail:dev] → ${to} | ${subject}\n${text}`);
    return;
  }
  await transport().sendMail({ from: FROM, to, subject, html, text });
}

export async function sendVerifyEmail(to: string, link: string): Promise<void> {
  await send(
    to,
    'Подтверждение почты в Almanax',
    emailHtml(
      'Подтверди почту',
      'Аккаунт в Almanax почти готов. Осталось подтвердить, что эта почта твоя.',
      'Подтвердить почту',
      link,
      'Ссылка действует 24 часа. Если ты не регистрировался, просто игнорируй это письмо.',
    ),
    `Подтверди почту для Almanax: ${link}\nСсылка действует 24 часа.`,
  );
}

export async function sendResetEmail(to: string, link: string): Promise<void> {
  await send(
    to,
    'Сброс пароля в Almanax',
    emailHtml(
      'Новый пароль',
      'Кто-то (надеемся, ты) запросил сброс пароля в Almanax. Задай новый по кнопке ниже.',
      'Задать новый пароль',
      link,
      'Ссылка действует 1 час. Если это был не ты, просто игнорируй письмо: пароль не изменится.',
    ),
    `Сброс пароля в Almanax: ${link}\nСсылка действует 1 час.`,
  );
}

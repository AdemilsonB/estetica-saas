export type EmailTemplateData = {
  customerName: string
  serviceName: string
  professionalName?: string
  dateTime: string
  tenantName: string
  tenantPhone?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;">
    <tr><td style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      ${content}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Você recebe este e-mail porque agendou um serviço. Em caso de dúvidas, entre em contato diretamente com o estabelecimento.
      </p>
    </td></tr>
  </table>
</body>
</html>`
}

export function bookingConfirmedHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#10b981;font-size:28px;margin:0 0 16px;">✅</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Agendamento confirmado!</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${escapeHtml(data.customerName)}!</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${escapeHtml(data.serviceName)}</p>
      ${data.professionalName ? `<p style="margin:0 0 4px;color:#64748b;font-size:14px;">com ${escapeHtml(data.professionalName)}</p>` : ''}
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${escapeHtml(data.tenantName)}</p>
  `, 'Agendamento confirmado')
}

export function bookingReminderHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#f59e0b;font-size:28px;margin:0 0 16px;">⏰</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Lembrete: seu agendamento é amanhã</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${escapeHtml(data.customerName)}! Só um lembrete do seu agendamento.</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${escapeHtml(data.serviceName)}</p>
      ${data.professionalName ? `<p style="margin:0 0 4px;color:#64748b;font-size:14px;">com ${escapeHtml(data.professionalName)}</p>` : ''}
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${escapeHtml(data.tenantName)}</p>
  `, 'Lembrete de agendamento')
}

export function bookingCancelledHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#ef4444;font-size:28px;margin:0 0 16px;">❌</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Agendamento cancelado</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${escapeHtml(data.customerName)}. Seu agendamento foi cancelado.</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${escapeHtml(data.serviceName)}</p>
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    ${data.tenantPhone ? `<p style="color:#64748b;font-size:14px;margin:0;">Para reagendar, entre em contato: ${escapeHtml(data.tenantPhone)}</p>` : ''}
  `, 'Agendamento cancelado')
}

type ProfessionalEmailData = {
  professionalName: string;
  customerName: string;
  serviceName: string;
  dateTime: string;
  tenantName: string;
};

export function professionalNewAppointmentHtml(data: ProfessionalEmailData): string {
  return baseLayout(`
    <p style="color:#7c3aed;font-size:28px;margin:0 0 16px;">📅</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Novo agendamento</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${escapeHtml(data.professionalName)}!</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${escapeHtml(data.customerName)}</p>
      <p style="margin:0 0 4px;color:#64748b;font-size:14px;">${escapeHtml(data.serviceName)}</p>
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${escapeHtml(data.tenantName)}</p>
  `, 'Novo agendamento')
}

export function professionalCancelledAppointmentHtml(data: ProfessionalEmailData): string {
  return baseLayout(`
    <p style="color:#ef4444;font-size:28px;margin:0 0 16px;">❌</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Agendamento cancelado</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${escapeHtml(data.professionalName)}!</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${escapeHtml(data.customerName)}</p>
      <p style="margin:0 0 4px;color:#64748b;font-size:14px;">${escapeHtml(data.serviceName)}</p>
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${escapeHtml(data.tenantName)}</p>
  `, 'Agendamento cancelado')
}

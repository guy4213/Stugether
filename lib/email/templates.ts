// Email templates: Hebrew, right-to-left, inline styles only (email clients
// ignore stylesheets). Every interpolated value is escaped.

const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function layout({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { label: string; url: string };
}) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:28px;text-align:right;" dir="rtl">
        <tr><td style="font-size:20px;font-weight:bold;color:#1d4ed8;padding-bottom:18px;">StuGether</td></tr>
        <tr><td style="font-size:20px;font-weight:bold;color:#0f1b33;padding-bottom:10px;">${title}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#334155;padding-bottom:22px;">${body}</td></tr>
        <tr><td>
          <a href="${escape(cta.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:12px;">${escape(cta.label)}</a>
        </td></tr>
        <tr><td style="font-size:12px;color:#94a3b8;padding-top:24px;">אפשר לכבות מיילים כאלה בעמוד ההתראות באתר.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function roomInvitationEmail(input: {
  inviterName: string;
  roomName: string;
  courseName: string | null;
  url: string;
}) {
  const inviter = escape(input.inviterName);
  const room = escape(input.roomName);
  const course = input.courseName ? escape(input.courseName) : null;
  const subject = `${input.inviterName} הזמין/ה אותך ללמוד יחד ב-StuGether`;
  const html = layout({
    title: "הוזמנת לחדר לימוד",
    body: `<strong>${inviter}</strong> הזמין/ה אותך לחדר „${room}”${
      course ? ` בקורס <strong>${course}</strong>` : ""
    }.<br />ההזמנה בתוקף ל-7 ימים. אפשר לאשר או לדחות אותה באתר.`,
    cta: { label: "לצפייה בהזמנה", url: input.url },
  });
  const text = `${input.inviterName} הזמין/ה אותך לחדר „${input.roomName}”${
    input.courseName ? ` בקורס ${input.courseName}` : ""
  }. ההזמנה בתוקף ל-7 ימים: ${input.url}`;
  return { subject, html, text };
}

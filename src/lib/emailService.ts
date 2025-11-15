import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = "carlitoelipan@gmail.com";
const EMAIL_FROM = process.env.EMAIL_FROM || "Good Life Music Portal <noreply@goodlife-publishing.com>";

/**
 * Email templates
 */

function getNewRequestEmailForAdmin(data: {
  artistName: string;
  artistEmail: string;
  amount: number;
  invoiceNumber: string;
  requestDate: string;
}): string {
  return `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:auto; padding:20px;">
      <div style="background-color: #2563EB; padding: 30px; border-radius: 8px 8px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">🎵 New Payment Request Received</h2>
      </div>
      <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin-top: 0;">Hello Admin,</p>
        <p style="color: #374151;">A new payment request has been submitted for review.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Artist:</strong> ${data.artistName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${data.artistEmail}</p>
          <p style="margin: 0 0 10px 0;"><strong>Amount:</strong> €${data.amount.toFixed(2)}</p>
          <p style="margin: 0 0 10px 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p style="margin: 0;"><strong>Date:</strong> ${data.requestDate}</p>
        </div>
        
        <p style="color: #374151;">Please review the attached PDF invoice and approve or reject this request in the admin dashboard.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            <a href="https://goodlifemusic.com/admin/payment-requests" style="color: #2563EB; text-decoration: none;">View in Admin Dashboard</a>
          </p>
        </div>
      </div>
      <div style="background-color: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 4px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Automated message — do not reply<br/>
          Good Life Music S.L | Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)
        </p>
      </div>
    </div>
  `;
}

function getApprovedEmailForArtist(data: {
  artistName: string;
  amount: number;
  invoiceNumber: string;
  approvalDate: string;
}): string {
  return `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:auto; padding:20px;">
      <div style="background-color: #10b981; padding: 30px; border-radius: 8px 8px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">✅ Payment Request Approved</h2>
      </div>
      <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin-top: 0;">Hi ${data.artistName},</p>
        <p style="color: #374151;">Great news! Your payment request of <strong>€${data.amount.toFixed(2)}</strong> has been approved.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p style="margin: 0 0 10px 0;"><strong>Approval Date:</strong> ${data.approvalDate}</p>
          <p style="margin: 0 0 10px 0;"><strong>Payment Mode:</strong> Bank Transfer</p>
          <p style="margin: 0;"><strong>Status:</strong> Approved</p>
        </div>
        
        <p style="color: #374151;">The official receipt is attached to this email. You can download and save it for your records.</p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Thank you for being part of Good Life Music!</p>
      </div>
      <div style="background-color: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 4px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Automated message — do not reply<br/>
          Good Life Music S.L | Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)
        </p>
      </div>
    </div>
  `;
}

function getRejectedEmailForArtist(data: {
  artistName: string;
  amount: number;
  invoiceNumber: string;
}): string {
  return `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:auto; padding:20px;">
      <div style="background-color: #ef4444; padding: 30px; border-radius: 8px 8px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">❌ Payment Request Rejected</h2>
      </div>
      <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin-top: 0;">Hi ${data.artistName},</p>
        <p style="color: #374151;">Your payment request of <strong>€${data.amount.toFixed(2)}</strong> has been <strong style="color: #ef4444;">rejected</strong>.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p style="margin: 0;">Your balance has been restored to your account.</p>
        </div>
        
        <p style="color: #374151;">If you believe this was a mistake or need more information, please contact our team:</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0 0 5px 0;">📧 Email: <a href="mailto:info@goodlifemusic.com" style="color: #2563EB; text-decoration: none;">info@goodlifemusic.com</a></p>
          <p style="margin: 0;">📞 Phone: +34 693 43 25 06</p>
        </div>
        
        <p style="color: #374151;">The attached PDF serves as your record of this action.</p>
      </div>
      <div style="background-color: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 4px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Automated message — do not reply<br/>
          Good Life Music S.L | Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)
        </p>
      </div>
    </div>
  `;
}

/**
 * Send payment request notification emails
 */

export async function sendNewPaymentRequestEmailToAdmin(data: {
  artistName: string;
  artistEmail: string;
  amount: number;
  invoiceNumber: string;
  requestDate: string;
  pdfBuffer?: Buffer;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const html = getNewRequestEmailForAdmin(data);

    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `🎵 New Payment Request Received — ${data.artistName}`,
      html,
      attachments: data.pdfBuffer
        ? [
            {
              filename: `${data.invoiceNumber}.pdf`,
              content: data.pdfBuffer.toString("base64"),
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    if (response.error) {
      console.error("Error sending admin email:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error("Error in sendNewPaymentRequestEmailToAdmin:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendPaymentApprovedEmailToArtist(data: {
  artistName: string;
  artistEmail: string;
  amount: number;
  invoiceNumber: string;
  approvalDate: string;
  pdfBuffer?: Buffer;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const html = getApprovedEmailForArtist(data);

    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: data.artistEmail,
      subject: `✅ Payment Request Approved — ${data.artistName}`,
      html,
      attachments: data.pdfBuffer
        ? [
            {
              filename: `${data.invoiceNumber}.pdf`,
              content: data.pdfBuffer.toString("base64"),
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    if (response.error) {
      console.error("Error sending approval email to artist:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error("Error in sendPaymentApprovedEmailToArtist:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendPaymentRejectedEmailToArtist(data: {
  artistName: string;
  artistEmail: string;
  amount: number;
  invoiceNumber: string;
  pdfBuffer?: Buffer;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const html = getRejectedEmailForArtist(data);

    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: data.artistEmail,
      subject: `❌ Payment Request Rejected — ${data.artistName}`,
      html,
      attachments: data.pdfBuffer
        ? [
            {
              filename: `${data.invoiceNumber}.pdf`,
              content: data.pdfBuffer.toString("base64"),
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    if (response.error) {
      console.error("Error sending rejection email to artist:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error("Error in sendPaymentRejectedEmailToArtist:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const html = `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:auto; padding:20px;">
        <div style="background-color: #2563EB; padding: 30px; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 24px;">🧪 Test Email</h2>
        </div>
        <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; margin-top: 0;">Test Message:</p>
          <p style="color: #374151; font-size: 16px; font-weight: 500;">${message}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: to,
      subject: "🧪 Test Email",
      html,
    });

    if (response.error) {
      console.error("Error sending test email:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error("Error in sendTestEmail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

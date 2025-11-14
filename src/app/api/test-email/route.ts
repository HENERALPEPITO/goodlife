import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const response = await resend.emails.send({
      from: "Good Life Music Portal <onboarding@resend.dev>",
      to: "carlitoelipan@gmail.com",
      subject: "Hello from Good Life Music Portal",
      html: `
        <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align:center; padding:40px; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563EB; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Hello Carlito!</h1>
          </div>
          <div style="background-color: white; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              This is a test email from Good Life Music Portal using Resend API.
            </p>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
              If you received this email, the email system is working correctly! 🎵
            </p>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 4px; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">Good Life Music S.L<br/>Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Test email sent successfully!",
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

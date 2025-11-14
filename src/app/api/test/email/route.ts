import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail(to: string, message: string) {
  try {
    const EMAIL_FROM = process.env.EMAIL_FROM || "Good Life Music Portal <noreply@goodlife-publishing.com>";
    const data = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: "Test Email",
      html: `<p>${message}</p>`,
    });

    return { success: true, messageId: (data as any)?.id ?? null, raw: data };
  } catch (error: unknown) {
    console.error("Resend error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to: requestedTo, message } = body ?? {};

    // Force recipient for testing as requested
    const forcedRecipient = "yupihaymabuhay@gmail.com";

    // Validate message presence
    if (!message) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
    }

    // Use forced recipient instead of provided `to`
    const to = forcedRecipient;

    const result = await sendTestEmail(to, message);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Test email sent successfully", messageId: result.messageId });
  } catch (error) {
    console.error("Error in test email POST route:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Test email API",
      usage: "POST { to: 'email@example.com', message: 'Your message' }",
      example: {
        method: "POST",
        url: "/api/test/email",
        body: { to: "clelipan@up.edu.ph", message: "hello test po" },
      },
    },
    { status: 200 }
  );
}

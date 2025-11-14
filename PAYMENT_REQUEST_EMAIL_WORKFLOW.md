/**
 * Payment Request Email Workflow - Testing Guide
 * 
 * This file documents the email workflow for payment requests.
 * 
 * WORKFLOW TRIGGERS:
 * 
 * 1. Artist Creates Payment Request
 *    Route: POST /api/payment/request
 *    Body: { artist_id: "uuid" }
 *    
 *    Emails Sent:
 *    - TO: carlitoelipan@gmail.com (ADMIN)
 *    - Subject: 🎵 New Payment Request Received — [Artist Name]
 *    - Attachment: PDF invoice (INV-[YEAR]-[AUTO_ID].pdf)
 *    
 * 2. Admin Approves Payment Request
 *    Route: POST /api/admin/payment-requests
 *    Body: { id: "payment_request_uuid", status: "approved" }
 *    
 *    Emails Sent:
 *    - TO: [Artist Email from Database]
 *    - Subject: ✅ Payment Request Approved — [Artist Name]
 *    - Attachment: Updated PDF invoice (Approved status)
 *    
 * 3. Admin Rejects Payment Request
 *    Route: POST /api/admin/payment-requests
 *    Body: { id: "payment_request_uuid", status: "rejected" }
 *    
 *    Emails Sent:
 *    - TO: [Artist Email from Database]
 *    - Subject: ❌ Payment Request Rejected — [Artist Name]
 *    - Attachment: Updated PDF invoice (Rejected status)
 *    
 * 
 * EMAIL SERVICE IMPLEMENTATION:
 * 
 * Location: src/lib/emailService.ts
 * 
 * Functions:
 * - sendNewPaymentRequestEmailToAdmin(data)
 * - sendPaymentApprovedEmailToArtist(data)
 * - sendPaymentRejectedEmailToArtist(data)
 * 
 * 
 * ENVIRONMENT CONFIGURATION:
 * 
 * Required in .env.local:
 * - RESEND_API_KEY=re_EDYHfdKh_NcKux1euV3mfabEqo2Gwxpin
 * 
 * Sender Email Configuration:
 * - From: "Good Life Music Portal <onboarding@resend.dev>"
 * - (Update to "no-reply@goodlife-publishing.com" once domain is verified in Resend)
 * 
 * Admin Email (Fixed):
 * - To: carlitoelipan@gmail.com
 * 
 * Artist Email (Dynamic):
 * - Fetched from user_profiles table
 * 
 * 
 * TESTING CHECKLIST:
 * 
 * ✅ Artist creates payment request
 *    - Check admin inbox for new request notification
 *    - Verify email includes artist name, amount, invoice number
 *    - Verify PDF invoice is attached
 *    - Verify email is professional and branded
 * 
 * ✅ Admin approves payment request
 *    - Check artist inbox for approval notification
 *    - Verify email subject includes artist name
 *    - Verify email shows approval date and payment mode
 *    - Verify PDF invoice shows "Approved" status
 *    - Verify PDF is attached
 * 
 * ✅ Admin rejects payment request
 *    - Check artist inbox for rejection notification
 *    - Verify email subject includes artist name
 *    - Verify email mentions balance restoration
 *    - Verify contact information is provided
 *    - Verify PDF invoice shows "Rejected" status
 *    - Verify PDF is attached
 * 
 * 
 * ERROR HANDLING:
 * 
 * - Emails are sent asynchronously after DB operations complete
 * - If email fails, the payment request is NOT rolled back
 * - Email errors are logged to console
 * - Failed emails should be retried manually or via email logs table
 * 
 * 
 * FUTURE ENHANCEMENTS:
 * 
 * 1. Create email_logs table to track all sent emails
 * 2. Implement email retry logic for failed deliveries
 * 3. Add email queue system if rate limits are hit
 * 4. Update sender domain once goodlife-publishing.com is verified
 * 5. Add email preferences per artist (opt-in/opt-out)
 * 6. Create admin email notification for rejections (admin@domain.com)
 */

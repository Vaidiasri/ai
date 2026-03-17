import AppointmentConfirmationEmail from "@/components/emails/AppointmentConfirmationEmail";
import resend from "@/lib/resend";

interface SendAppointmentEmailParams {
  userEmail: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType?: string;
  duration?: string;
  price?: string;
}

/**
 * Sends an appointment confirmation email using Resend.
 */
export async function sendAppointmentConfirmationEmail({
  userEmail,
  doctorName,
  appointmentDate,
  appointmentTime,
  appointmentType = "General Consultation",
  duration = "30 mins",
  price = "Free",
}: SendAppointmentEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') {
    console.warn("[EMAIL_SERVICE] WARNING: RESEND_API_KEY is missing or invalid.");
  }

  console.log(`[EMAIL_SERVICE] Attempting to send email to: ${userEmail}`);
  console.log(`[EMAIL_SERVICE] Details: Dr. ${doctorName}, Date: ${appointmentDate}, Time: ${appointmentTime}`);

  try {
    const { data, error } = await resend.emails.send({
      from: "DentWise <onboarding@resend.dev>",
      to: [userEmail],
      subject: "Appointment Confirmation - DentWise",
      react: AppointmentConfirmationEmail({
        doctorName,
        appointmentDate,
        appointmentTime,
        appointmentType,
        duration,
        price,
      }),
    });

    if (error) {
      console.error("[EMAIL_SERVICE] Resend API error:", JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log("[EMAIL_SERVICE] Email sent successfully via Resend. Response data:", JSON.stringify(data, null, 2));
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("Email service error:", err);
    return { success: false, error: err };
  }
}

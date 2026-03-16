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
  try {
    const { data, error } = await resend.emails.send({
      from: "DentWise <no-reply@resend.dev>",
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
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("Email service error:", err);
    return { success: false, error: err };
  }
}

/**
 * Placeholder function for sending email notifications when a prize is completed.
 * This will be implemented later with a real email service (via Cursor).
 *
 * @param prizeName - Name of the completed prize
 * @param adminEmail - Admin email address for this prize
 * @param ticketNumber - The ticket number assigned to the user
 * @param firstName - User's first name (optional)
 * @param lastName - User's last name (optional)
 */
export function onPrizeComplete(
  prizeName: string,
  adminEmail: string,
  ticketNumber: number,
  firstName?: string | null,
  lastName?: string | null,
) {
  // Log the prize completion details
  console.log(`[BK'REWARDS] Prize completed!`)
  console.log(`Prize: ${prizeName}`)
  console.log(`Admin Email: ${adminEmail}`)
  console.log(`Ticket Number: #${ticketNumber}`)
  console.log(`User: ${firstName || "N/A"} ${lastName || "N/A"}`)

  // TODO: Implement actual email sending via your preferred service
  // Example implementation with Resend, SendGrid, or similar:
  //
  // await sendEmail({
  //   to: adminEmail,
  //   subject: `[Bk'Rewards] Nouveau ticket généré - ${prizeName}`,
  //   body: `
  //     Un nouveau ticket a été généré pour le lot "${prizeName}".
  //
  //     Détails:
  //     - Numéro de ticket: #${ticketNumber}
  //     - Participant: ${firstName} ${lastName}
  //
  //     Connectez-vous au tableau d'administration pour plus de détails.
  //   `
  // })
}

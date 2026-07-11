/**
 * WhatsApp Business API service
 * Sends messages to live chat agents via their personal WhatsApp
 * when a patient sends a message through the website chat widget.
 * 
 * Required .env variables:
 *   WHATSAPP_PHONE_NUMBER_ID  — from Meta Developer App → WhatsApp → API Setup
 *   WHATSAPP_ACCESS_TOKEN     — permanent system user token from Meta Business
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN — your chosen verification string
 *   WHATSAPP_BUSINESS_NUMBER  — your business WhatsApp number (no + or spaces)
 */

const sendWhatsAppMessage = async (toNumber, messageBody) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  // Gracefully skip if WhatsApp credentials are not configured
  if (!phoneNumberId || !accessToken) {
    console.warn('[WhatsApp] Not configured — skipping notification. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to .env to enable.');
    return null;
  }

  // Strip any +, spaces, dashes, or brackets from the number
  const cleanNumber = String(toNumber).replace(/[\s+\-()]/g, '');

  if (!cleanNumber || cleanNumber.length < 7) {
    console.warn('[WhatsApp] Invalid phone number — skipping:', toNumber);
    return null;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type:    'individual',
          to:                cleanNumber,
          type:              'text',
          text:              { body: messageBody }
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('[WhatsApp] API error:', JSON.stringify(data));
      return null;
    }

    // Return the WhatsApp message ID so we can store it
    // and match agent replies back to this conversation
    const msgId = data.messages?.[0]?.id || null;
    if (msgId) {
      console.log(`[WhatsApp] Message sent successfully. ID: ${msgId}`);
    }
    return msgId;

  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message);
    return null;
  }
};

module.exports = { sendWhatsAppMessage };

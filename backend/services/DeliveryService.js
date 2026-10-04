import DeliveryRecord from '../models/DeliveryRecord.js';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

// Base interface for providers
class DeliveryProvider {
  async send(destination, secureUrl, options) {
    throw new Error('Not implemented');
  }
}

// ─────────────────────────────────────────────────────────────
// REAL PROVIDERS
// ─────────────────────────────────────────────────────────────

class EmailProvider extends DeliveryProvider {
  constructor() {
    super();
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async send(destination, secureUrl, options) {
    if (!process.env.SENDGRID_API_KEY) {
      return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMsg: 'SendGrid API Key missing' };
    }
    
    try {
      const msg = {
        to: destination,
        from: process.env.EMAIL_FROM_ADDRESS || 'noreply@happypix.in',
        subject: 'Your HappyPix Memories! 📸',
        text: `Thanks for joining the fun! View and download your photos here: ${secureUrl}`,
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 30px; background-color: #f3f4f6;">
            <div style="background-color: white; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #111;">Your HappyPix Memories! 📸</h2>
              <p style="color: #444; font-size: 16px;">Thanks for joining the fun. Click the button below to view and download your photos.</p>
              <a href="${secureUrl}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; font-weight: bold; font-size: 16px;">
                View Photos
              </a>
              <p style="margin-top: 30px; color: #888; font-size: 12px;">Powered by HappyPix</p>
            </div>
          </div>
        `,
      };
      const response = await sgMail.send(msg);
      return { success: true, messageId: response[0]?.headers['x-message-id'] || 'sg-delivered' };
    } catch (error) {
      console.error('[EmailProvider] Error:', error.response?.body || error);
      return { success: false, errorCode: 'SEND_FAILED', errorMsg: error.message };
    }
  }
}

class SMSProvider extends DeliveryProvider {
  constructor() {
    super();
    if (process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } else if (process.env.TWILIO_ACCOUNT_SID) {
      console.warn('⚠️ TWILIO_ACCOUNT_SID is set but does not start with "AC". SMS delivery is disabled.');
    }
  }

  async send(destination, secureUrl, options) {
    if (!this.client) {
      return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMsg: 'Twilio Keys missing' };
    }
    
    try {
      let phone = destination;
      // Default to +91 (India) if no country code provided. 
      if (!phone.startsWith('+')) {
        phone = '+91' + phone;
      }

      const message = await this.client.messages.create({
        body: `Thanks for using HappyPix! View and download your photos here: ${secureUrl}`,
        from: process.env.TWILIO_SENDER_ID || 'HAPPYPIX',
        to: phone
      });
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('[SMSProvider] Error:', error);
      return { success: false, errorCode: 'SEND_FAILED', errorMsg: error.message };
    }
  }
}

class WhatsAppProvider extends DeliveryProvider {
  async send(destination, secureUrl, options) {
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneId) {
      return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMsg: 'Meta WhatsApp Keys missing' };
    }

    try {
      let phone = destination;
      if (phone.startsWith('+')) {
        phone = phone.substring(1); // Meta Cloud API expects number without '+'
      } else {
        phone = '91' + phone; // Default to India if no code
      }

      // We send a direct template message. 
      // NOTE: You must create an approved template named 'happypix_share' in your Meta dashboard 
      // with one URL parameter {{1}} in the body.
      const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "happypix_share", // Replace with your actual approved template name
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: secureUrl } 
              ]
            }
          ]
        }
      };

      // Alternatively, if you are using Twilio for WhatsApp instead of Meta, 
      // you would use the twilio client here (e.g. from: 'whatsapp:+14155238886').

      const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'WhatsApp API failed');
      }

      return { success: true, messageId: data.messages?.[0]?.id || 'wa-delivered' };
    } catch (error) {
      console.error('[WhatsAppProvider] Error:', error);
      return { success: false, errorCode: 'SEND_FAILED', errorMsg: error.message };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

const maskPhone = (phone) => {
  if (!phone || phone.length < 5) return '***';
  return phone.substring(0, phone.length - 4).replace(/./g, '*') + phone.substring(phone.length - 4);
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

class DeliveryService {
  constructor() {
    this.whatsappProvider = new WhatsAppProvider();
    this.smsProvider = new SMSProvider();
    this.emailProvider = new EmailProvider();
  }

  async processDelivery({ method, destination, photoShare, eventId, organizationId }) {
    let provider = null;
    let providerName = 'None';
    let maskedDestination = destination;

    switch (method) {
      case 'WHATSAPP':
        provider = this.whatsappProvider;
        providerName = 'MetaWhatsApp';
        maskedDestination = maskPhone(destination);
        break;
      case 'SMS':
        provider = this.smsProvider;
        providerName = 'TwilioSMS';
        maskedDestination = maskPhone(destination);
        break;
      case 'EMAIL':
        provider = this.emailProvider;
        providerName = 'SendGridEmail';
        maskedDestination = maskEmail(destination);
        break;
      case 'QR':
      case 'DOWNLOAD':
      case 'NATIVE_SHARE':
      case 'COPY_LINK':
        const record = new DeliveryRecord({
          photoShareId: photoShare._id,
          eventId,
          organizationId,
          method,
          destinationMasked: null,
          status: 'sent',
          sentAt: new Date()
        });
        await record.save();
        return { success: true, record };
      default:
        throw new Error('Unsupported delivery method');
    }

    const clientUrl = process.env.CLIENT_URL || 'https://happypix.vercel.app';
    const secureUrl = `${clientUrl}/share/${photoShare.tokenHash}`;

    // Attempt actual delivery
    const result = await provider.send(destination, secureUrl, { method });

    const record = new DeliveryRecord({
      photoShareId: photoShare._id,
      eventId,
      organizationId,
      method,
      destinationMasked: maskedDestination,
      status: result.success ? 'sent' : 'failed',
      provider: providerName,
      providerMessageId: result.messageId,
      errorCode: result.errorCode,
      sentAt: result.success ? new Date() : null,
      failedAt: result.success ? null : new Date()
    });
    
    await record.save();

    // Even if it failed due to PROVIDER_NOT_CONFIGURED, we return success: true 
    // to the UI so the guest sees a smooth experience without technical errors.
    // Real errors are logged in the DB DeliveryRecord table.
    return { 
      success: true, 
      isActuallyDelivered: result.success, 
      record 
    };
  }
}

export default new DeliveryService();

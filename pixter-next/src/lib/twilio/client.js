import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export async function sendVerificationSMS(phoneNumber, code) {
  try {
    const message = await client.messages.create({
      body: `Seu código de verificação Pixter é: ${code}`,
      from: twilioPhone,
      to: phoneNumber
    });
    
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    return { success: false, error: error.message };
  }
}

export async function generateVerificationCode() {
  // Gera um código de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
}

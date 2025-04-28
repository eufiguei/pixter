import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Envia um SMS com código de verificação para o número de telefone fornecido
 * @param {string} phoneNumber - Número de telefone completo com código do país (ex: +5511999999999)
 * @param {string} code - Código de verificação a ser enviado
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendVerificationSMS(phoneNumber, code) {
  try {
    // Verifica se o número de telefone está formatado corretamente
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Número de telefone deve começar com + e incluir código do país');
    }
    
    const message = await client.messages.create({
      body: `Seu código de verificação Pixter é: ${code}`,
      from: twilioPhone,
      to: phoneNumber
    });
    
    console.log(`SMS enviado para ${phoneNumber} com sucesso. SID: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    return { 
      success: false, 
      error: error.message || 'Erro ao enviar SMS. Verifique o número de telefone e tente novamente.' 
    };
  }
}

/**
 * Gera um código de verificação aleatório de 6 dígitos
 * @returns {string} Código de 6 dígitos
 */
export async function generateVerificationCode() {
  // Gera um código de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Formata um número de telefone para o formato internacional
 * @param {string} phone - Número de telefone (pode ser com ou sem código do país)
 * @param {string} countryCode - Código do país (padrão: 55 para Brasil)
 * @returns {string} Número formatado com código do país (ex: +5511999999999)
 */
export function formatPhoneNumber(phone, countryCode = '55') {
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se já começa com o código do país, apenas adiciona o +
  if (cleanPhone.startsWith(countryCode)) {
    return `+${cleanPhone}`;
  }
  
  // Adiciona o código do país
  return `+${countryCode}${cleanPhone}`;
}

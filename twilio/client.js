{\rtf1\ansi\ansicpg1252\cocoartf2639
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0  // /src/lib/twilio/client.js\
import twilio from 'twilio';\
\
const accountSid = process.env.TWILIO_ACCOUNT_SID;\
const authToken = process.env.TWILIO_AUTH_TOKEN;\
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;\
\
const client = twilio(accountSid, authToken);\
\
export async function sendVerificationSMS(phoneNumber, code) \{\
  try \{\
    const message = await client.messages.create(\{\
      body: `Seu c\'f3digo de verifica\'e7\'e3o Pixter \'e9: $\{code\}`,\
      from: twilioPhone,\
      to: phoneNumber\
    \});\
    \
    return \{ success: true, messageId: message.sid \};\
  \} catch (error) \{\
    console.error('Erro ao enviar SMS:', error);\
    return \{ success: false, error: error.message \};\
  \}\
\}\
\
export async function generateVerificationCode() \{\
  return Math.floor(100000 + Math.random() * 900000).toString();\
\}\
}
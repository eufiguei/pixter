import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import QRCode from 'qrcode';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const driverId = url.searchParams.get('driverId');
    
    if (!driverId) {
      return NextResponse.json(
        { error: 'ID do motorista não fornecido' },
        { status: 400 }
      );
    }
    
    // Verificar autenticação
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session || authData.session.user.id !== driverId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }
    
    // Buscar dados do motorista
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
      
    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }
    
    // Gerar URL de pagamento
    const paymentUrl = `${process.env.NEXT_PUBLIC_URL}/pagamento/${driverId}`;
    
    // Gerar QR code
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl);
    
    return NextResponse.json({
      qrCode: qrCodeDataUrl,
      paymentUrl,
      driverName: driver.name
    });
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar QR code' },
      { status: 500 }
    );
  }
}

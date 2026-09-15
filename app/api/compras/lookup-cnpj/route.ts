import { NextResponse, type NextRequest } from 'next/server';
import { requireProfile } from '@/lib/auth';

interface BrasilApiCnpjResponse {
  razao_social?: string;
  nome_fantasia?: string;
}

/** Busca a razão social de um CNPJ no cadastro nacional (BrasilAPI, que por sua vez
 * consulta a Receita Federal) — usado pra preencher o Fornecedor a partir só do CNPJ, em
 * vez de tentar adivinhar o nome no texto do PDF (menos confiável, layout varia). */
export async function GET(request: NextRequest) {
  await requireProfile();

  const cnpjDigits = (request.nextUrl.searchParams.get('cnpj') ?? '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return NextResponse.json({ error: 'Informe um CNPJ com 14 dígitos.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
    if (!response.ok) {
      return NextResponse.json({ error: 'CNPJ não encontrado no cadastro nacional.' }, { status: 404 });
    }

    const data: BrasilApiCnpjResponse = await response.json();
    const companyName = data.razao_social || data.nome_fantasia || null;
    if (!companyName) {
      return NextResponse.json({ error: 'CNPJ encontrado, mas sem razão social cadastrada.' }, { status: 404 });
    }

    return NextResponse.json({ companyName });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o CNPJ agora.' }, { status: 502 });
  }
}

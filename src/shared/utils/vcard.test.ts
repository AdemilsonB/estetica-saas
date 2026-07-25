import { describe, expect, it } from 'vitest'
import { buildPreviewPhoneVariants, normalizeImportedPhone, parseVCards } from './vcard'

const CRLF = '\r\n'

// Dobra de linha do vCard (RFC 2426): quebra em ~75 octetos com CRLF + espaço
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 73) {
    out.push(rest.slice(0, 73))
    rest = ' ' + rest.slice(73)
  }
  out.push(rest)
  return out.join(CRLF)
}

function vcf(lines: string[]): string {
  return lines.join(CRLF) + CRLF
}

describe('parseVCards — exports reais de iPhone', () => {
  it('lê contato compartilhado do app Contatos com telefone de rótulo personalizado (item1.TEL)', () => {
    // iOS 17: telefone preferido com rótulo "WhatsApp" vira item1.TEL + item1.X-ABLabel,
    // e a foto sai em base64 dobrada em várias linhas
    const foto = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIA'.repeat(3)
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'PRODID:-//Apple Inc.//iPhone OS 17.5.1//EN',
      'N:Silva;Maria;;;',
      'FN:Maria Silva',
      'item1.TEL;type=pref:(11) 98765-4321',
      'item1.X-ABLabel:WhatsApp',
      'item2.ADR;type=HOME;type=pref:;;Rua das Flores 123;São Paulo;SP;01310-000;Brasil',
      'item2.X-ABADR:br',
      fold('PHOTO;ENCODING=b;TYPE=JPEG:' + foto),
      'END:VCARD',
    ])

    expect(parseVCards(content)).toEqual([{ name: 'Maria Silva', phone: '11987654321' }])
  })

  it('lê export completo do iCloud sem perder contatos (rótulo personalizado, FN dobrado, sem FN)', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'PRODID:-//Apple Inc.//iCloud Web Address Book 2504B31//EN',
      'N:Souza;Ana;;;',
      'FN:Ana Souza',
      'TEL;type=CELL;type=VOICE;type=pref:+55 11 91234-5678',
      'END:VCARD',
      // único telefone tem rótulo personalizado → item1.TEL
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Oliveira;Bruno;;;',
      'FN:Bruno Oliveira',
      'item1.TEL;type=pref:11 99876-1122',
      'item1.X-ABLabel:celular novo',
      'END:VCARD',
      // nome longo com emoji → FN dobrado pelo iOS em múltiplas linhas
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Nascimento;Cliente;;;',
      fold('FN:Cliente 💇‍♀️ Maria Aparecida do Nascimento Cabelo e Estética Unhas Decoradas'),
      'TEL;type=CELL;type=VOICE;type=pref:(21) 97777-8888',
      'END:VCARD',
      // só e-mail → ignorado (sem telefone não há como importar)
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;Fornecedor;;;',
      'FN:Fornecedor Loja',
      'EMAIL;type=INTERNET;type=pref:contato@loja.com.br',
      'END:VCARD',
      // sem FN → nome montado a partir do N (given + family)
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Pereira;Carla;;;',
      'TEL;type=CELL;type=VOICE;type=pref:(31) 96666-5544',
      'END:VCARD',
    ])

    expect(parseVCards(content)).toEqual([
      { name: 'Ana Souza', phone: '11912345678' },
      { name: 'Bruno Oliveira', phone: '11998761122' },
      {
        name: 'Cliente 💇‍♀️ Maria Aparecida do Nascimento Cabelo e Estética Unhas Decoradas',
        phone: '21977778888',
      },
      { name: 'Carla Pereira', phone: '31966665544' },
    ])
  })

  it('lê contato compartilhado pelo WhatsApp (waid no TEL, +55 normalizado)', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;Duda Sobrancelhas;;;',
      'FN:Duda Sobrancelhas',
      'TEL;type=CELL;waid=5511955443322:+55 11 95544-3322',
      'END:VCARD',
    ])

    expect(parseVCards(content)).toEqual([
      { name: 'Duda Sobrancelhas', phone: '11955443322' },
    ])
  })

  it('lê vCard 2.1 legado com quoted-printable (backup antigo de Android)', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=4A=6F=C3=A3=6F;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=4A=6F=C3=A3=6F=20=42=61=72=62=65=69=72=6F',
      'TEL;CELL:11987651234',
      'END:VCARD',
    ])

    expect(parseVCards(content)).toEqual([
      { name: 'João Barbeiro', phone: '11987651234' },
    ])
  })

  it('prefere o telefone marcado como pref; senão celular; senão o primeiro', () => {
    const comPref = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Com Pref',
      'TEL;type=HOME;type=VOICE:(11) 3333-4444',
      'TEL;type=CELL;type=VOICE;type=pref:(11) 98888-7777',
      'END:VCARD',
    ])
    expect(parseVCards(comPref)[0]?.phone).toBe('11988887777')

    const semPref = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Sem Pref',
      'TEL;type=HOME;type=VOICE:(11) 3333-4444',
      'TEL;type=CELL;type=VOICE:(11) 97777-6666',
      'END:VCARD',
    ])
    expect(parseVCards(semPref)[0]?.phone).toBe('11977776666')

    const soFixo = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Só Fixo',
      'TEL;type=HOME;type=VOICE:(11) 3333-4444',
      'END:VCARD',
    ])
    expect(parseVCards(soFixo)[0]?.phone).toBe('1133334444')
  })

  it('desfaz escape de vírgula e ponto-e-vírgula no nome (vCard 3.0)', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Maria\\, a Cabeleireira',
      'TEL;type=CELL:(11) 91111-2222',
      'END:VCARD',
    ])
    expect(parseVCards(content)[0]?.name).toBe('Maria, a Cabeleireira')
  })

  it('remove duplicados pelo telefone normalizado (mantém o primeiro)', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Maria Silva',
      'TEL;type=CELL:+55 11 98765-4321',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Maria Salão',
      'TEL;type=CELL:(11) 98765-4321',
      'END:VCARD',
    ])
    expect(parseVCards(content)).toEqual([
      { name: 'Maria Silva', phone: '11987654321' },
    ])
  })

  it('aceita quebras de linha LF puras (arquivos re-salvos em editor)', () => {
    const content = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Linha LF',
      'TEL;type=CELL:(11) 90000-1111',
      'END:VCARD',
    ].join('\n')
    expect(parseVCards(content)).toEqual([{ name: 'Linha LF', phone: '11900001111' }])
  })

  it('ignora bloco sem nome e sem N', () => {
    const content = vcf([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'TEL;type=CELL:(11) 92222-3333',
      'END:VCARD',
    ])
    expect(parseVCards(content)).toEqual([])
  })
})

describe('normalizeImportedPhone', () => {
  it('mantém número local de 10-11 dígitos', () => {
    expect(normalizeImportedPhone('(11) 98765-4321')).toBe('11987654321')
    expect(normalizeImportedPhone('(11) 3333-4444')).toBe('1133334444')
  })

  it('remove DDI +55 quando o resultado é um número brasileiro válido', () => {
    expect(normalizeImportedPhone('+55 11 98765-4321')).toBe('11987654321')
    expect(normalizeImportedPhone('+55 11 3333-4444')).toBe('1133334444')
  })

  it('não remove 55 quando faz parte do DDD/número', () => {
    // 10 dígitos começando com 55 = fixo do DDD 55 (RS) — não é DDI
    expect(normalizeImportedPhone('(55) 3222-1111')).toBe('5532221111')
  })

  it('remove zero de operadora à esquerda (011)', () => {
    expect(normalizeImportedPhone('011 98765-4321')).toBe('11987654321')
  })

  it('mantém número internacional não-brasileiro como está', () => {
    expect(normalizeImportedPhone('+1 (415) 555-0100')).toBe('14155550100')
  })
})

describe('buildPreviewPhoneVariants', () => {
  it('gera variante com DDI 55 para casar clientes gravados com o prefixo', () => {
    expect(buildPreviewPhoneVariants(['11987654321'])).toEqual([
      '11987654321',
      '5511987654321',
    ])
  })

  it('não duplica variantes nem expande números não-brasileiros', () => {
    expect(buildPreviewPhoneVariants(['14155550100', '14155550100'])).toEqual([
      '14155550100',
    ])
  })
})

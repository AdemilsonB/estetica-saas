import { describe, it, expect } from 'vitest'
import { resolveImageCrop } from '../image-crop'

describe('resolveImageCrop', () => {
  it('retorna objeto vazio quando a imagem não mudou e nenhum crop foi enviado', () => {
    expect(resolveImageCrop(false, {})).toEqual({})
  })

  it('reseta x/y/zoom para null quando a imagem mudou e nenhum crop foi enviado', () => {
    expect(resolveImageCrop(true, {})).toEqual({ x: null, y: null, zoom: null })
  })

  it('preserva os valores de crop enviados quando a imagem não mudou', () => {
    expect(resolveImageCrop(false, { x: 0.3, y: 0.7, zoom: 2 })).toEqual({ x: 0.3, y: 0.7, zoom: 2 })
  })

  it('preserva os valores de crop quando enviados junto com a nova imagem', () => {
    expect(resolveImageCrop(true, { x: 0.3, y: 0.7, zoom: 2 })).toEqual({ x: 0.3, y: 0.7, zoom: 2 })
  })

  it('considera "enviado" mesmo que apenas um dos 3 campos venha definido', () => {
    expect(resolveImageCrop(true, { x: 0.5 })).toEqual({ x: 0.5 })
  })
})

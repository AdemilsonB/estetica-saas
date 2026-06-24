type CropInput = {
  x?: number | null
  y?: number | null
  zoom?: number | null
}

/**
 * Decide o que persistir para os 3 campos de enquadramento de imagem.
 * Se a URL da imagem mudou e nenhum crop foi enviado junto, reseta para null
 * (a composição da foto mudou, o enquadramento salvo não é mais válido).
 * Se o crop foi enviado junto com a nova URL (mesma sessão de edição), respeita os valores.
 */
export function resolveImageCrop(imageChanged: boolean, crop: CropInput) {
  const hasExplicitCrop = crop.x !== undefined || crop.y !== undefined || crop.zoom !== undefined

  if (imageChanged && !hasExplicitCrop) {
    return { x: null, y: null, zoom: null } as const
  }

  return {
    ...(crop.x !== undefined && { x: crop.x }),
    ...(crop.y !== undefined && { y: crop.y }),
    ...(crop.zoom !== undefined && { zoom: crop.zoom }),
  }
}

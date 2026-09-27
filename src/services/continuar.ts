/**
 * "Continue assistindo" do site.
 *
 * O ponto de cada vídeo já era guardado (movie-progress-*), mas só pelo id do
 * vídeo — não dava para montar uma fileira com isso. Aqui fica também o
 * endereço do título no acervo, para o cartão abrir a ficha certa.
 */
import type { ItemDestaque } from './vodService';

const CHAVE = 'saimo-continuar';

export interface Andamento {
  origem: ItemDestaque;
  rotulo: string;
  fracao: number;
  quando: number;
}

function ler(): Andamento[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function registrar(origem: ItemDestaque, rotulo: string, tempo: number, duracao: number) {
  if (!origem?.titulo || !duracao) return;
  const fracao = tempo / duracao;
  const resto = ler().filter((a) => a.origem.titulo !== origem.titulo);
  // Acabou (ou quase): sai da fileira — série fica, no próximo episódio.
  if (fracao >= 0.95 && origem.tipo === 'f') {
    localStorage.setItem(CHAVE, JSON.stringify(resto));
    return;
  }
  const novo: Andamento = { origem, rotulo, fracao: Math.min(fracao, 1), quando: Date.now() };
  localStorage.setItem(CHAVE, JSON.stringify([novo, ...resto].slice(0, 20)));
}

export function lista(): Andamento[] {
  return ler().sort((a, b) => b.quando - a.quando);
}

export function remover(titulo: string) {
  localStorage.setItem(CHAVE, JSON.stringify(ler().filter((a) => a.origem.titulo !== titulo)));
}

/**
 * Diálogo da primeira abertura: "Endereço das listas". Aparece por cima do app
 * enquanto os dois endereços estiverem vazios; "Agora não" fecha e o site segue
 * vazio, e ele volta na próxima abertura. Se só um estiver preenchido, não
 * pergunta de novo: a seção que falta mostra o estado vazio, com atalho.
 */
import { useEffect, useRef, useState } from 'react';
import { useListas } from '../services/listas';
import { FormListas } from './FormListas';
import './Listas.css';

export function PerguntaListas() {
  const { canais, filmes } = useListas();
  const [adiado, setAdiado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const aberto = !canais && !filmes && !adiado;

  useEffect(() => {
    if (!aberto) return;
    caixa.current?.querySelector('input')?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdiado(true); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="listas-fundo" role="presentation">
      <div className="listas-janela" role="dialog" aria-modal="true" aria-labelledby="listas-titulo" ref={caixa}>
        <h1 id="listas-titulo">Endereço das listas</h1>
        <p>
          Informe o endereço da lista de canais e o da lista de filmes e séries.
          Você pode deixar em branco e informar depois em Ajustes.
        </p>
        <FormListas
          aoSalvar={() => setAdiado(true)}
          secundario={<button type="button" className="listas-botao" onClick={() => setAdiado(true)}>Agora não</button>}
        />
      </div>
    </div>
  );
}

/**
 * Ajustes: o que abrir ao iniciar, modo adulto, atalhos, limpezas e links.
 * (Importar/exportar canais e a atualização do aplicativo são do app; no site
 * a lista vem sempre do repositório e a versão nova chega sozinha.)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { useAdultMode } from '../contexts/adultoContexto';
import { useLocalStorage } from '../hooks/useLocalStorage';
import './Ajustes.css';

export type AoIniciar = 'inicio' | 'ultimo';
export const CHAVE_AO_INICIAR = 'saimo-ao-iniciar';

const ATALHOS_TELAS: [string, string][] = [
  ['Alt+1', 'Buscar'], ['Alt+2', 'Início'], ['Alt+3', 'Ao vivo'], ['Alt+4', 'Eventos'],
  ['Alt+5', 'On Demand'], ['Alt+6', 'Favoritos'], ['Alt+7', 'Rádios'], ['Alt+8', 'Ajustes'],
];

const LIMPAR: { rotulo: string; chaves: string[]; aviso: string }[] = [
  { rotulo: 'Limpar “Continue assistindo”', chaves: ['saimo-continuar'], aviso: 'Histórico limpo' },
  { rotulo: 'Limpar buscas recentes', chaves: ['saimo-buscas-recentes'], aviso: 'Buscas limpas' },
  { rotulo: 'Limpar rádios ouvidas', chaves: ['saimo-radios-recentes'], aviso: 'Rádios limpas' },
  { rotulo: 'Limpar favoritos', chaves: ['tv-favorites', 'saimo-vod-favoritos'], aviso: 'Favoritos limpos' },
];

export function Ajustes() {
  const navigate = useNavigate();
  const { isAdultUnlocked, lockAdult } = useAdultMode();
  const [aoIniciar, setAoIniciar] = useLocalStorage<AoIniciar>(CHAVE_AO_INICIAR, 'inicio');
  const [aviso, setAviso] = useState('');

  const limpar = (chaves: string[], texto: string) => {
    chaves.forEach((c) => localStorage.removeItem(c));
    window.dispatchEvent(new Event('saimo-vod-favoritos-mudou'));
    setAviso(texto);
    window.setTimeout(() => setAviso(''), 2500);
  };

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo ajustes">
        <h1 className="tela-titulo">Ajustes</h1>
        {aviso && <div className="ajustes-aviso">{aviso}</div>}

        <section className="ajustes-bloco">
          <h2>Ao iniciar</h2>
          <p>O que o site abre quando você entra.</p>
          <div className="pilulas">
            <button className={aoIniciar === 'inicio' ? 'on' : ''} onClick={() => setAoIniciar('inicio')}>Início</button>
            <button className={aoIniciar === 'ultimo' ? 'on' : ''} onClick={() => setAoIniciar('ultimo')}>Último canal assistido</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Modo adulto (+18)</h2>
          <p>{isAdultUnlocked
            ? 'Ligado: o catálogo mostra também o conteúdo adulto.'
            : 'Desligado. Para ligar, clique vinte vezes no ícone da barra do topo e digite o PIN.'}</p>
          {isAdultUnlocked && <button className="ajustes-botao" onClick={lockAdult}>Desligar</button>}
        </section>

        <section className="ajustes-bloco">
          <h2>Atalhos</h2>
          <dl className="ajustes-atalhos">
            {ATALHOS_TELAS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}
            <div><dt><kbd>?</kbd></dt><dd>Todos os atalhos do player</dd></div>
            <div><dt><kbd>G</kbd></dt><dd>Guia de programação (Ao vivo)</dd></div>
          </dl>
        </section>

        <section className="ajustes-bloco">
          <h2>Dados deste navegador</h2>
          <div className="ajustes-botoes">
            {LIMPAR.map((l) => (
              <button key={l.rotulo} className="ajustes-botao" onClick={() => limpar(l.chaves, l.aviso)}>{l.rotulo}</button>
            ))}
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Mais</h2>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={() => navigate('/app')}>Baixar o app (TV Box, celular, Mac, Windows)</button>
            <button className="ajustes-botao" onClick={() => navigate('/novidades')}>Novidades</button>
            <a className="ajustes-botao" href="https://discord.gg/8DKqT3xJvD" target="_blank" rel="noreferrer noopener">Comunidade no Discord</a>
            <a className="ajustes-botao" href="https://github.com/gabrielsaimo/SaimoPlayer" target="_blank" rel="noreferrer noopener">Lista de canais no GitHub</a>
          </div>
        </section>
      </div>
    </div>
  );
}

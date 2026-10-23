/**
 * Rádios: a lista do endereço de canais (`radios.txt`), em fileiras de ouvidas
 * por último e de A a Z. A que toca aparece no alto com o equalizador.
 * Toca num player só dela (um <audio>), e para ao sair da tela.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BarraTopo } from '../components/BarraTopo';
import { CampoBusca, Fileira, SemLista } from '../components/Telas';
import { useListas } from '../services/listas';
import { baixar, chave, locais, recentes, type Radio } from '../services/radios';
import { assinar, atual as atualRadio, parar, tocar } from '../services/radioPlayer';
import './Radios.css';

function CartaoRadio({ radio, tocando, aoTocar }: { radio: Radio; tocando: boolean; aoTocar: () => void }) {
  return (
    <button className={`cartao-radio ${tocando ? 'tocando' : ''}`} onClick={aoTocar} title={radio.nome}>
      <div className="cartao-radio-logo">
        {radio.logo
          ? <img src={radio.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span>{radio.nome.charAt(0)}</span>}
        {tocando && <Equalizador />}
      </div>
      <strong>{radio.nome}</strong>
    </button>
  );
}

function Equalizador() {
  return <span className="equalizador" aria-label="Tocando"><i /><i /><i /><i /></span>;
}

export function Radios() {
  const { canais: link } = useListas();
  const [lista, setLista] = useState<Radio[]>(locais);
  const [termo, setTermo] = useState('');
  const { radio: atual, estado } = useSyncExternalStore(assinar, atualRadio);
  const ouvidas = useMemo(() => {
    void atual;
    return recentes();
  }, [atual]);

  useEffect(() => {
    // Trocar ou apagar o endereço de canais troca ou esvazia a lista.
    setLista(locais());
    if (!link) return;
    let vivo = true;
    void baixar().then((l) => { if (vivo && l) setLista(l); });
    return () => { vivo = false; };
  }, [link]);

  const filtradas = useMemo(() => {
    const t = chave(termo.trim());
    return t ? lista.filter((r) => chave(r.nome).includes(t)) : lista;
  }, [lista, termo]);

  const recentesLista = useMemo(
    () => ouvidas.map((n) => lista.find((r) => r.nome === n)).filter((r): r is Radio => !!r), [ouvidas, lista]);

  const deAaZ = useMemo(() => [...filtradas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [filtradas]);

  const cartao = (r: Radio) => (
    <CartaoRadio key={r.nome} radio={r} tocando={atual?.nome === r.nome && estado !== 'erro'}
      aoTocar={() => (atual?.nome === r.nome && estado !== 'erro' ? parar() : tocar(r))} />
  );

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo">
        <section className="radio-topo">
          <div className="radio-agora">
            {atual ? (
              <>
                <div className="radio-agora-logo">
                  {atual.logo ? <img src={atual.logo} alt="" referrerPolicy="no-referrer" /> : <span>{atual.nome.charAt(0)}</span>}
                </div>
                <div>
                  <small>{estado === 'erro' ? 'Não foi possível tocar' : estado === 'carregando' ? 'Conectando…' : 'Tocando agora'}</small>
                  <h1>{atual.nome}</h1>
                  <p>Rádio</p>
                </div>
                {estado === 'tocando' && <Equalizador />}
                <button className="radio-parar" onClick={parar}>Parar</button>
              </>
            ) : (
              <div><small>Rádios</small><h1>Escolha uma rádio</h1><p>{lista.length} estações ao vivo</p></div>
            )}
          </div>
          <CampoBusca valor={termo} aoMudar={setTermo} placeholder="Buscar rádio" />
        </section>
      </div>

      {!link && <SemLista tipo="radios" />}
      {link && lista.length === 0 && <p className="tela-vazio">Carregando as rádios…</p>}
      {!termo && recentesLista.length > 0 && <Fileira titulo="Ouvidas por último">{recentesLista.map(cartao)}</Fileira>}
      {deAaZ.length > 0 && <Fileira titulo="Todas, de A a Z">{deAaZ.map(cartao)}</Fileira>}
      {lista.length > 0 && filtradas.length === 0 && <p className="tela-vazio">Nenhuma rádio com “{termo}”.</p>}
    </div>
  );
}

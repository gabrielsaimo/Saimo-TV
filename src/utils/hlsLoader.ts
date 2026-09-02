/**
 * Carregador do hls.js que corrige a pasta dos segmentos.
 *
 * Quando a playlist é tocada direto — sem passar pelo proxy, que é o caminho
 * preferido porque vários CDNs desta lista recusam IP de datacenter — quem monta
 * o endereço de cada segmento é o hls.js, e ele segue a regra do HLS: segmento
 * ao lado da playlist. Os canais servidos por proxy de terceiros guardam os
 * segmentos na pasta indicada pelo parâmetro `url=`, e o endereço pela regra
 * devolve 521. Este carregador aplica a mesma correção do app antes de cada
 * pedido sair.
 */

import Hls, { type HlsConfig, type LoaderContext } from 'hls.js';
import { fixNestedPath } from './streamUrl';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function makeNestedPathLoader(manifestUrl: string): HlsConfig['loader'] {
  // O tipo público do hls.js descreve o carregador como interface, não como
  // classe, então herdar dele exige apresentá-lo como construtor.
  const Base: new (config: HlsConfig) => any = Hls.DefaultConfig.loader as any;

  class NestedPathLoader extends Base {
    load(context: LoaderContext, config: unknown, callbacks: unknown): void {
      context.url = fixNestedPath(manifestUrl, context.url);
      super.load(context, config, callbacks);
    }
  }

  return NestedPathLoader as unknown as HlsConfig['loader'];
}

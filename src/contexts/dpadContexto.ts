import { createContext, useContext, useEffect, useRef } from 'react';

/*
 * O contexto da navegação por controle e os hooks que o usam, fora do arquivo
 * do componente: o recarregamento a quente do Vite só funciona em arquivo que
 * exporta apenas componentes.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface DpadContextValue {
  /** Elemento atualmente focado */
  focusedElement: HTMLElement | null;
  /** Define o foco em um elemento */
  setFocus: (element: HTMLElement | null, scrollIntoView?: boolean) => void;
  /** Move o foco na direção especificada */
  moveFocus: (direction: Direction) => boolean;
  /** Foca no primeiro elemento focável */
  focusFirst: (containerId?: string) => void;
  /** Foca em um elemento específico */
  focusElement: (selector: string, containerId?: string) => boolean;
  /** Registra um handler de voltar (modal, overlay, etc) */
  registerBackHandler: (handler: () => boolean | void) => () => void;
  /** Se a navegação D-pad está habilitada */
  isEnabled: boolean;
  /** Habilita/desabilita a navegação */
  setEnabled: (enabled: boolean) => void;
  /** Indica se está usando controle/teclado */
  isUsingDpad: boolean;
}

export const DpadContext = createContext<DpadContextValue | null>(null);

// Hook para usar o contexto
export function useDpad() {
  const context = useContext(DpadContext);
  if (!context) {
    throw new Error('useDpad must be used within a DpadNavigationProvider');
  }
  return context;
}

// Hook para tornar um elemento focável
export function useFocusable(options: {
  focusKey?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
} = {}) {
  const ref = useRef<HTMLElement>(null);
  const { setFocus, isUsingDpad } = useDpad();
  const { focusKey, disabled, onFocus, onBlur, autoFocus } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Marca como focável
    element.setAttribute('data-focusable', disabled ? 'false' : 'true');
    element.setAttribute('tabindex', disabled ? '-1' : '0');
    
    if (focusKey) {
      element.setAttribute('data-focus-key', focusKey);
    }

    // Auto focus
    if (autoFocus && isUsingDpad && !disabled) {
      setTimeout(() => setFocus(element), 100);
    }

    // Event listeners
    const handleFocus = () => onFocus?.();
    const handleBlur = () => onBlur?.();

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, [focusKey, disabled, onFocus, onBlur, autoFocus, setFocus, isUsingDpad]);

  return ref;
}

// Componente wrapper para tornar filhos focáveis

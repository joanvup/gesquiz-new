import { describe, it, expect } from 'vitest';
import { getQuizNavigationDecision } from '../lib/quiz-navigation';

describe('getQuizNavigationDecision', () => {
  it('avanza sin advertencia cuando la opción está desactivada', () => {
    expect(
      getQuizNavigationDecision({
        permitirRetroceso: false,
        advertirAlContinuar: false,
        currentIndex: 1,
        targetIndex: 2,
      })
    ).toBe('navigate');
  });

  it('muestra la advertencia al avanzar cuando la opción está activada', () => {
    expect(
      getQuizNavigationDecision({
        permitirRetroceso: false,
        advertirAlContinuar: true,
        currentIndex: 1,
        targetIndex: 2,
      })
    ).toBe('confirm');
  });

  it('no muestra advertencia cuando el quiz permite retroceso', () => {
    expect(
      getQuizNavigationDecision({
        permitirRetroceso: true,
        advertirAlContinuar: true,
        currentIndex: 1,
        targetIndex: 2,
      })
    ).toBe('navigate');
  });

  it('bloquea el retroceso aunque la advertencia esté activada', () => {
    expect(
      getQuizNavigationDecision({
        permitirRetroceso: false,
        advertirAlContinuar: true,
        currentIndex: 2,
        targetIndex: 1,
      })
    ).toBe('block');
  });

  it('bloquea el retroceso aunque la advertencia esté desactivada', () => {
    expect(
      getQuizNavigationDecision({
        permitirRetroceso: false,
        advertirAlContinuar: false,
        currentIndex: 2,
        targetIndex: 1,
      })
    ).toBe('block');
  });
});

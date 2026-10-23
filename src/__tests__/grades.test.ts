import { describe, it, expect } from 'vitest';
import { toGradeScale } from '../lib/grades';

describe('toGradeScale', () => {
  it('devuelve 10 cuando no hay aciertos', () => {
    expect(toGradeScale(0, 20)).toBe(10);
  });

  it('mantiene el piso de 10 para porcentajes de 5 % y 10 %', () => {
    expect(toGradeScale(1, 20)).toBe(10);
    expect(toGradeScale(2, 20)).toBe(10);
  });

  it('convierte el porcentaje de aciertos en nota', () => {
    expect(toGradeScale(3, 20)).toBe(15);
    expect(toGradeScale(10, 20)).toBe(50);
    expect(toGradeScale(11, 20)).toBe(55);
    expect(toGradeScale(19, 20)).toBe(95);
    expect(toGradeScale(20, 20)).toBe(100);
  });

  it('redondea al entero más cercano', () => {
    expect(toGradeScale(1, 3)).toBe(33);
    expect(toGradeScale(2, 3)).toBe(67);
    expect(toGradeScale(10.5, 20)).toBe(53);
  });

  it('limita la nota máxima a 100', () => {
    expect(toGradeScale(25, 20)).toBe(100);
  });

  it('devuelve null cuando falta el puntaje o el máximo', () => {
    expect(toGradeScale(null, 20)).toBeNull();
    expect(toGradeScale(10, null)).toBeNull();
    expect(toGradeScale(undefined, 20)).toBeNull();
    expect(toGradeScale(10, 0)).toBeNull();
  });
});

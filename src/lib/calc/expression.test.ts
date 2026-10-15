import { describe, expect, it } from 'vitest'
import { cleanCalcInput, evaluateDisplay, evaluateExpression } from './expression'

describe('calculator expressions', () => {
  it('follows operator precedence and brackets', () => {
    expect(evaluateExpression('2+3*4')).toBe(14)
    expect(evaluateExpression('(2+3)*4')).toBe(20)
    expect(evaluateExpression('-5+10')).toBe(5)
  })

  it('rejects incomplete sums', () => {
    expect(() => evaluateExpression('2+')).toThrow()
    expect(() => evaluateExpression('(2+3')).toThrow()
  })
})

describe('typing into the calculator', () => {
  it('turns keyboard operators into the ones the calculator shows', () => {
    expect(cleanCalcInput('12*3/4-1')).toBe('12×3÷4−1')
    expect(cleanCalcInput('2x3')).toBe('2×3')
  })

  it('drops anything that is not part of a sum', () => {
    expect(cleanCalcInput('1,200 + abc =')).toBe('1200+')
  })

  it('works out what is shown, to the paisa', () => {
    expect(evaluateDisplay('1200×3÷7')).toBe(514.29)
    expect(evaluateDisplay('(100+50)×2−30')).toBe(270)
  })
})

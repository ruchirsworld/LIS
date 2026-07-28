// Safe arithmetic expression evaluator for the amount calculator — a small
// recursive-descent parser (tokenize -> parse -> evaluate), deliberately NOT
// using eval()/Function() since this parses user-typed input. Supports
// +, -, *, /, parentheses, decimals, and unary minus, with standard
// operator precedence.

type Token = { type: 'num'; value: number } | { type: 'op'; value: '+' | '-' | '*' | '/' } | { type: 'lparen' } | { type: 'rparen' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ') {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch
      i++
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i]
        i++
      }
      tokens.push({ type: 'num', value: Number(num) })
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    throw new Error('Unexpected character: ' + ch)
  }
  return tokens
}

/** Throws on invalid/incomplete expressions — callers should catch and show "Error". */
export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr)
  if (tokens.length === 0) return 0
  let pos = 0

  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]

  function parseAtom(): number {
    const t = peek()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.type === 'num') {
      consume()
      return t.value
    }
    if (t.type === 'lparen') {
      consume()
      const v = parseExpr()
      const close = consume()
      if (!close || close.type !== 'rparen') throw new Error('Expected )')
      return v
    }
    if (t.type === 'op' && t.value === '-') {
      consume()
      return -parseAtom()
    }
    if (t.type === 'op' && t.value === '+') {
      consume()
      return parseAtom()
    }
    throw new Error('Unexpected token')
  }

  function parseTerm(): number {
    let v = parseAtom()
    for (let t = peek(); t && t.type === 'op' && (t.value === '*' || t.value === '/'); t = peek()) {
      consume()
      const rhs = parseAtom()
      v = t.value === '*' ? v * rhs : v / rhs
    }
    return v
  }

  function parseExpr(): number {
    let v = parseTerm()
    for (let t = peek(); t && t.type === 'op' && (t.value === '+' || t.value === '-'); t = peek()) {
      consume()
      const rhs = parseTerm()
      v = t.value === '+' ? v + rhs : v - rhs
    }
    return v
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('Unexpected trailing input')
  if (!isFinite(result)) throw new Error('Invalid result')
  return result
}
